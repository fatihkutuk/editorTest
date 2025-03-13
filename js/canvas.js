/**
 * SVG Canvas (Tuval) İşlemleri - Düzeltilmiş Versiyon
 * - Büyütme/Küçültme (Zoom)
 * - Kaydırma (Pan)
 * - Görünüm Sıfırlama
 */

class CanvasManager {
    constructor() {
        this.canvas = null;
        this.canvasContainer = null;
        this.isPanning = false;
        this.startX = 0;
        this.startY = 0;
        this.currentScale = 1;
        this.minScale = 0.1;
        this.maxScale = 10;
        this.scaleStep = 0.1;

        // Bağlam koruma
        this.onMouseDown = this.onMouseDown.bind(this);
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onMouseUp = this.onMouseUp.bind(this);
        this.onWheel = this.onWheel.bind(this);
        this.zoomIn = this.zoomIn.bind(this);
        this.zoomOut = this.zoomOut.bind(this);
        this.resetZoom = this.resetZoom.bind(this);
    }

    /**
     * Canvas yöneticisini başlat
     */
    init() {
        // Canvas elementlerini al
        this.canvas = document.getElementById('editor-canvas');
        this.canvasContainer = document.querySelector('.canvas-area');

        if (!this.canvas || !this.canvasContainer) {
            console.error('Canvas veya container bulunamadı!');
            return;
        }
        this.addGridBackground();

        // Olay dinleyicileri ekle
        this.setupEventListeners();

        // Zoom kontrollerini ayarla
        this.setupZoomControls();

        // Canvas'a arkaplan rengi ekle (eğer yoksa)
        if (!this.canvas.style.backgroundColor) {
            this.canvas.style.backgroundColor = '#ffffff';
        }

        console.log('CanvasManager başlatıldı');
    }

    /**
     * Olay dinleyicileri kur
     */
    setupEventListeners() {
        // Orta tuş veya Alt+Sol tuş ile kaydırma (pan) için
        this.canvasContainer.addEventListener('mousedown', this.onMouseDown);
        document.addEventListener('mousemove', this.onMouseMove);
        document.addEventListener('mouseup', this.onMouseUp);
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Alt') {
                this.canvasContainer.style.cursor = 'grab';
            }
        });
        document.addEventListener('keyup', (e) => {
            if (e.key === 'Alt') {
                this.canvasContainer.style.cursor = 'default';
            }
        });

        // Fare tekerleği ile zoom için
        this.canvasContainer.addEventListener('wheel', this.onWheel, { passive: false });
    }

    /**
     * Zoom kontrollerini ayarla
     */
    setupZoomControls() {
        const zoomInBtn = document.getElementById('zoom-in');
        const zoomOutBtn = document.getElementById('zoom-out');
        const zoomReset = document.getElementById('zoom-reset');
        const zoomLevel = document.getElementById('zoom-level');

        if (zoomInBtn) {
            zoomInBtn.addEventListener('click', () => {
                this.zoomIn();
            });
        }

        if (zoomOutBtn) {
            zoomOutBtn.addEventListener('click', () => {
                this.zoomOut();
            });
        }

        if (zoomReset) {
            zoomReset.addEventListener('click', () => {
                this.resetZoom();
            });
        }

        // Zoom seviyesi göstergesini güncelle
        this.updateZoomLevel();
    }

    /**
     * Mouse aşağı olayı
     * @param {MouseEvent} e Mouse olayı
     */
    onMouseDown(e) {
        // Orta tuş kontrolü veya Alt+Sol tuş (kaydırma için)
        if (e.button === 1 || (e.button === 0 && e.altKey)) {
            e.preventDefault();
            e.stopPropagation();

            // SubjX wrapper içinde ise işlem yapma
            if (e.target.closest('.sjx-wrapper') || e.target.closest('.transform-controls')) {
                return;
            }

            this.isPanning = true;
            this.startX = e.clientX;
            this.startY = e.clientY;

            // Kaydırma modunda imleci değiştir
            this.canvasContainer.style.cursor = 'grabbing';
            this.canvasContainer.classList.add('panning');
        }
    }

    /**
     * Mouse hareketi olayı
     * @param {MouseEvent} e Mouse olayı
     */
    onMouseMove(e) {
        if (!this.isPanning) return;

        const dx = e.clientX - this.startX;
        const dy = e.clientY - this.startY;

        // Canvas'ın mevcut scroll pozisyonunu al
        const currentScrollLeft = this.canvasContainer.scrollLeft;
        const currentScrollTop = this.canvasContainer.scrollTop;

        // Yeni scroll pozisyonunu ayarla
        this.canvasContainer.scrollLeft = currentScrollLeft - dx;
        this.canvasContainer.scrollTop = currentScrollTop - dy;

        // Başlangıç noktasını güncelle
        this.startX = e.clientX;
        this.startY = e.clientY;
    }

    /**
     * Mouse yukarı olayı
     */
    onMouseUp(e) {
        if (this.isPanning) {
            this.isPanning = false;

            // Normal imleci geri getir
            this.canvasContainer.style.cursor = e.altKey ? 'grab' : 'default';
            this.canvasContainer.classList.remove('panning');

            // Eğer kaydırma sırasında çok az hareket olduysa (tıklama gibi), olayı durdurma
            if (Math.abs(e.clientX - this.startX) < 5 && Math.abs(e.clientY - this.startY) < 5) {
                e.stopPropagation();
            }
        }
    }

    /**
     * Fare tekerleği olayı
     * @param {WheelEvent} e Fare tekerleği olayı
     */
    onWheel(e) {
        // Ctrl tuşu basılıyken zoom işlemi
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();

            const delta = e.deltaY > 0 ? -1 : 1;

            // Fare pozisyonunu merkez alarak zoom yap
            this.zoomAtPoint(e.clientX, e.clientY, delta);
        }
        // Normal tekerlek kaydırma
        else {
            // Sayfanın normal scroll davranışı
        }
    }

    /**
     * Belirli bir noktayı merkez alarak zoom yap
     * @param {number} clientX Mouse X pozisyonu
     * @param {number} clientY Mouse Y pozisyonu
     * @param {number} delta Zoom yönü (1: yakınlaş, -1: uzaklaş)
     */
    zoomAtPoint(clientX, clientY, delta) {
        // Zoom öncesi pozisyon
        const rect = this.canvasContainer.getBoundingClientRect();
        const offsetX = clientX - rect.left;
        const offsetY = clientY - rect.top;

        // Scrollbar pozisyonları
        const scrollLeft = this.canvasContainer.scrollLeft;
        const scrollTop = this.canvasContainer.scrollTop;

        // Fare pozisyonunun canvas içindeki tam konumu
        const pointX = scrollLeft + offsetX;
        const pointY = scrollTop + offsetY;

        // Yeni zoom seviyesini hesapla
        const newScale = this.currentScale + (delta * this.scaleStep);

        // Zoom sınırları kontrolü
        if (newScale < this.minScale || newScale > this.maxScale) return;

        // Zoom faktörü
        const factor = newScale / this.currentScale;

        // Zoom'u uygula
        this.currentScale = newScale;
        this.canvas.style.transform = `scale(${this.currentScale})`;
        this.canvas.style.transformOrigin = '0 0';

        // Merkezi korumak için scroll pozisyonlarını güncelle
        this.canvasContainer.scrollLeft = pointX * factor - offsetX;
        this.canvasContainer.scrollTop = pointY * factor - offsetY;

        // Zoom seviyesi göstergesini güncelle
        this.updateZoomLevel();

        // SubjX için ölçek değişikliği olayını tetikle
        const scaleEvent = new CustomEvent('scale-changed', {
            detail: { scale: this.currentScale }
        });
        document.dispatchEvent(scaleEvent);
    }

    /**
     * Zoom seviyesini göstergeye yaz
     */
    updateZoomLevel() {
        const zoomLevel = document.getElementById('zoom-level');
        if (zoomLevel) {
            zoomLevel.textContent = `${Math.round(this.currentScale * 100)}%`;
        }
    }

    /**
     * Büyüt (Zoom In)
     */
    zoomIn() {
        if (this.currentScale >= this.maxScale) return;

        const newScale = Math.min(this.currentScale + this.scaleStep, this.maxScale);

        // Merkezi koruyarak zoom
        const containerWidth = this.canvasContainer.clientWidth;
        const containerHeight = this.canvasContainer.clientHeight;

        this.zoomAtPoint(
            this.canvasContainer.getBoundingClientRect().left + containerWidth / 2,
            this.canvasContainer.getBoundingClientRect().top + containerHeight / 2,
            1
        );
    }

    /**
     * Küçült (Zoom Out)
     */
    zoomOut() {
        if (this.currentScale <= this.minScale) return;

        const newScale = Math.max(this.currentScale - this.scaleStep, this.minScale);

        // Merkezi koruyarak zoom
        const containerWidth = this.canvasContainer.clientWidth;
        const containerHeight = this.canvasContainer.clientHeight;

        this.zoomAtPoint(
            this.canvasContainer.getBoundingClientRect().left + containerWidth / 2,
            this.canvasContainer.getBoundingClientRect().top + containerHeight / 2, -1
        );
    }

    /**
     * Zoom'u sıfırla
     */
    resetZoom() {
        // Eski ölçeği kaydet
        const oldScale = this.currentScale;

        this.currentScale = 1;
        this.canvas.style.transform = 'scale(1)';

        // Scroll pozisyonlarını merkeze ayarla
        this.centerCanvas();

        // Zoom seviyesi göstergesini güncelle
        this.updateZoomLevel();

        // SubjX için ölçek değişikliği olayını tetikle
        if (oldScale !== 1) {
            const scaleEvent = new CustomEvent('scale-changed', {
                detail: { scale: this.currentScale }
            });
            document.dispatchEvent(scaleEvent);
        }
    }

    /**
     * Canvas'ı görünüm alanının ortasına getir
     */
    centerCanvas() {
        const containerWidth = this.canvasContainer.clientWidth;
        const containerHeight = this.canvasContainer.clientHeight;
        const canvasWidth = this.canvas.getBBox().width || this.canvas.getAttribute('width') || 800;
        const canvasHeight = this.canvas.getBBox().height || this.canvas.getAttribute('height') || 600;

        this.canvasContainer.scrollLeft = (canvasWidth * this.currentScale - containerWidth) / 2;
        this.canvasContainer.scrollTop = (canvasHeight * this.currentScale - containerHeight) / 2;
    }

    /**
     * Canvas'ın arkaplan rengini ayarla
     * @param {string} color HEX veya RGB renk değeri
     */
    setBackgroundColor(color) {
        if (this.canvas) {
            this.canvas.style.backgroundColor = color;
        }
    }

    /**
     * Canvas'ın boyutlarını ayarla
     * @param {number} width Genişlik
     * @param {number} height Yükseklik
     */
    setCanvasSize(width, height) {
            if (this.canvas) {
                this.canvas.setAttribute('width', width);
                this.canvas.setAttribute('height', height);
                this.canvas.setAttribute('viewBox', `0 0 ${width} ${height}`);
            }
        }
        // Izgara arka plan ekleme
    addGridBackground() {
        // CSS ile ızgara arka plan ekle
        const style = document.createElement('style');
        style.textContent = `
        .canvas-area {
            background-color: #f0f0f0;
            background-image: 
                linear-gradient(45deg, #e0e0e0 25%, transparent 25%),
                linear-gradient(-45deg, #e0e0e0 25%, transparent 25%),
                linear-gradient(45deg, transparent 75%, #e0e0e0 75%),
                linear-gradient(-45deg, transparent 75%, #e0e0e0 75%);
            background-size: 20px 20px;
            background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
        }
    `;
        document.head.appendChild(style);
    }
}

// CanvasManager sınıfını örnekle
const canvasManager = new CanvasManager();

// Document hazır olduğunda başlat
$(document).ready(function() {
    canvasManager.init();

    // Canvas tıklama ve özellik kontrollerini dinle
    $('#canvas-color').on('change', function() {
        canvasManager.setBackgroundColor($(this).val());
    });

    $('#canvas-width, #canvas-height').on('change', function() {
        const width = $('#canvas-width').val();
        const height = $('#canvas-height').val();
        canvasManager.setCanvasSize(width, height);
    });
});