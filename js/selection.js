/**
 * SVG Editör için Seçim İşlemleri - Geliştirilmiş Versiyon
 * - Çoklu Seçim ve Grup İşlemleri
 * - Alan Seçimi
 * - Öne/Arkaya Getirme
 * - Kopyalama/Silme
 */

class SelectionManager {
    constructor() {
        this.selectedElements = [];
        this.selectionArea = null;
        this.isAreaSelecting = false;
        this.isDrawing = false;
        this.startX = 0;
        this.startY = 0;
        this.clipboard = null;
        this.canvas = null;
        this.activeTool = 'select'; // Varsayılan araç: seçim
        this.tempElement = null; // Çizim için geçici element
        this.drawingStarted = false;

        // Bağlam koruma
        this.onMouseDown = this.onMouseDown.bind(this);
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onMouseUp = this.onMouseUp.bind(this);
        this.onKeyDown = this.onKeyDown.bind(this);
        this.startAreaSelection = this.startAreaSelection.bind(this);
        this.selectElementsInArea = this.selectElementsInArea.bind(this);
        this.showCanvasProperties = this.showCanvasProperties.bind(this);
        this.handleDrawingTools = this.handleDrawingTools.bind(this);
        this.setActiveTool = this.setActiveTool.bind(this);
    }

    /**
     * Seçim yöneticisini başlat
     */
    init() {
        // Tuval alanını al
        this.canvas = document.getElementById('editor-canvas');
        this.canvasContainer = document.querySelector('.canvas-area');

        // Seçim alanı elementi oluştur
        this.createSelectionArea();

        // Olay dinleyicileri ekle
        this.canvas.addEventListener('mousedown', this.onMouseDown);
        document.addEventListener('mousemove', this.onMouseMove);
        document.addEventListener('mouseup', this.onMouseUp);
        document.addEventListener('keydown', this.onKeyDown);

        // Çoklu seçim için tuşları dinle
        document.addEventListener('keydown', (e) => {
            if (e.shiftKey) {
                this.canvas.classList.add('multi-select-mode');
            }
        });

        document.addEventListener('keyup', (e) => {
            if (!e.shiftKey) {
                this.canvas.classList.remove('multi-select-mode');
            }
        });

        // Sağ tık menüsünü engelle
        this.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.showContextMenu(e);
            return false;
        });

        window.addEventListener('resize', () => {
            if (this.selectedElements.length === 1 && typeof transformHandler !== 'undefined') {
                try {
                    transformHandler.updateControlsPosition();
                } catch (error) {
                    console.log('Transform kontrollerini güncellerken hata:', error);
                }
            }
        });

        // Aktif aracı ayarla
        this.setActiveTool('select');

        console.log('SelectionManager başlatıldı');
    }

    /**
     * Aktif aracı ayarla
     * @param {string} toolName Araç adı
     */
    setActiveTool(toolName) {
        this.activeTool = toolName;

        // Tüm araç butonlarından active sınıfını kaldır
        $('.tool-btn').removeClass('active');

        // Seçilen araç butonuna active sınıfını ekle
        $(`.tool-btn[data-tool="${toolName}"]`).addClass('active');

        // Çizim aracı seçildiğinde tuval için uygun imleç ayarla
        if (toolName === 'select') {
            this.canvas.style.cursor = 'default';
        } else if (toolName === 'rectangle' || toolName === 'circle' || toolName === 'ellipse') {
            this.canvas.style.cursor = 'crosshair';
        } else if (toolName === 'line' || toolName === 'path') {
            this.canvas.style.cursor = 'crosshair';
        } else if (toolName === 'text') {
            this.canvas.style.cursor = 'text';
        } else {
            this.canvas.style.cursor = 'default';
        }

        console.log('Aktif araç:', toolName);
    }

    /**
     * Seçim alanı elementi oluştur
     */
    createSelectionArea() {
        // Mevcut bir selection-area elementi var mı kontrol et
        this.selectionArea = document.getElementById('selection-area');

        // Yoksa yeni oluştur
        if (!this.selectionArea) {
            this.selectionArea = document.createElement('div');
            this.selectionArea.id = 'selection-area';
            this.selectionArea.className = 'selection-area';
            this.selectionArea.style.display = 'none';
            document.body.appendChild(this.selectionArea);
        }
    }

    /**
     * Mouse aşağı olayı
     * @param {MouseEvent} e Mouse olayı
     */
    onMouseDown(e) {
        // Alt+Sol tuş basılıyken (pan) olayı pas geç
        if (e.button === 0 && e.altKey) {
            return;
        }

        // Sağ tık menüsü
        if (e.button === 2) {
            e.preventDefault();
            e.stopPropagation();
            this.showContextMenu(e);
            return false;
        }

        // Sol tık (button === 0)
        if (e.button === 0) {
            // SubjX veya transform kontrolleri üzerindeyse
            if (e.target.closest('.sjx-wrapper') || e.target.closest('.transform-controls')) {
                return;
            }

            // Tuval üzerindeki pozisyonu hesapla
            const canvasRect = this.canvas.getBoundingClientRect();
            const mouseX = e.clientX - canvasRect.left;
            const mouseY = e.clientY - canvasRect.top;

            // CTM'yi tersine çevirerek SVG koordinatlarını hesapla
            const svgPoint = this.canvas.createSVGPoint();
            svgPoint.x = mouseX;
            svgPoint.y = mouseY;
            const transformedPoint = svgPoint.matrixTransform(this.canvas.getScreenCTM().inverse());

            // Aktif araca göre işlem yap
            if (this.activeTool === 'select') {
                // SVG nesne seçimi
                if (e.target !== this.canvas && e.target.tagName.toLowerCase() !== 'svg') {
                    // Seçilen nesneyi bul
                    let targetElement = e.target;

                    // SVG wrapper bul
                    if (!$(targetElement).hasClass('svg-object-wrapper')) {
                        const $wrapper = $(targetElement).closest('.svg-object-wrapper');
                        if ($wrapper.length) {
                            targetElement = $wrapper[0];
                        }
                    }

                    // Shift tuşu basılı değilse mevcut seçimi temizle
                    if (!e.shiftKey) {
                        this.clearSelection();
                    }

                    // Bu elementi seçime ekle
                    this.addToSelection(targetElement);

                    // Transform kontrollerini göster
                    if (this.selectedElements.length === 1) {
                        if (typeof transformHandler !== 'undefined') {
                            transformHandler.showTransformControls(this.selectedElements[0]);
                        }
                    } else if (this.selectedElements.length > 1) {
                        // Birden fazla seçimde grup transform kontrollerini göster
                        this.showGroupControls();
                    }

                    e.stopPropagation();
                } else {
                    // Boş alana tıklama - Alan seçimi başlat
                    if (!e.shiftKey) {
                        this.clearSelection();
                    }

                    // Canvas özelliklerini göster
                    this.showCanvasProperties();

                    // Alan seçimini başlat
                    this.startAreaSelection(e);
                }
            } else {
                // Çizim araçları
                this.drawingStarted = true;
                this.handleDrawingTools(transformedPoint.x, transformedPoint.y);
            }
        }
    }

    /**
     * Çizim araçlarını yönet
     * @param {number} x Fare X koordinatı (SVG koordinat sisteminde)
     * @param {number} y Fare Y koordinatı (SVG koordinat sisteminde)
     */
    handleDrawingTools(x, y) {
        // Önce seçimi temizle
        this.clearSelection();

        // Çizim başlangıç koordinatları
        this.startX = x;
        this.startY = y;

        switch (this.activeTool) {
            case 'rectangle':
                // Yeni dikdörtgen oluştur
                this.tempElement = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                this.tempElement.setAttribute('x', x);
                this.tempElement.setAttribute('y', y);
                this.tempElement.setAttribute('width', 0);
                this.tempElement.setAttribute('height', 0);
                this.tempElement.setAttribute('fill', '#4285f4');
                this.tempElement.setAttribute('stroke', '#000000');
                this.tempElement.setAttribute('stroke-width', 1);
                this.canvas.appendChild(this.tempElement);
                break;

            case 'circle':
                // Yeni daire oluştur
                this.tempElement = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                this.tempElement.setAttribute('cx', x);
                this.tempElement.setAttribute('cy', y);
                this.tempElement.setAttribute('r', 0);
                this.tempElement.setAttribute('fill', '#4285f4');
                this.tempElement.setAttribute('stroke', '#000000');
                this.tempElement.setAttribute('stroke-width', 1);
                this.canvas.appendChild(this.tempElement);
                break;

            case 'ellipse':
                // Yeni elips oluştur
                this.tempElement = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
                this.tempElement.setAttribute('cx', x);
                this.tempElement.setAttribute('cy', y);
                this.tempElement.setAttribute('rx', 0);
                this.tempElement.setAttribute('ry', 0);
                this.tempElement.setAttribute('fill', '#4285f4');
                this.tempElement.setAttribute('stroke', '#000000');
                this.tempElement.setAttribute('stroke-width', 1);
                this.canvas.appendChild(this.tempElement);
                break;

            case 'line':
                // Yeni çizgi oluştur
                this.tempElement = document.createElementNS("http://www.w3.org/2000/svg", "line");
                this.tempElement.setAttribute('x1', x);
                this.tempElement.setAttribute('y1', y);
                this.tempElement.setAttribute('x2', x);
                this.tempElement.setAttribute('y2', y);
                this.tempElement.setAttribute('stroke', '#000000');
                this.tempElement.setAttribute('stroke-width', 1);
                this.canvas.appendChild(this.tempElement);
                break;

            case 'text':
                // Metin elementi ekle
                this.tempElement = document.createElementNS("http://www.w3.org/2000/svg", "text");
                this.tempElement.setAttribute('x', x);
                this.tempElement.setAttribute('y', y);
                this.tempElement.setAttribute('font-family', 'Arial');
                this.tempElement.setAttribute('font-size', '16');
                this.tempElement.setAttribute('fill', '#000000');
                this.tempElement.textContent = 'Metin';
                this.canvas.appendChild(this.tempElement);

                // Hemen seçili hale getir
                this.finishDrawing();
                break;
        }
    }

    /**
     * Çizim işlemini tamamla
     */
    finishDrawing() {
        if (!this.tempElement) return;

        // Çizim tamamlandığında çizilen nesneyi bir wrapper içine al
        const wrapper = document.createElementNS("http://www.w3.org/2000/svg", "g");
        wrapper.setAttribute('class', 'svg-object-wrapper');
        wrapper.setAttribute('data-object-id', Date.now());

        // Nesne tipine göre isim ata
        let objectName = '';
        switch (this.tempElement.tagName.toLowerCase()) {
            case 'rect':
                objectName = 'Dikdörtgen';
                break;
            case 'circle':
                objectName = 'Daire';
                break;
            case 'ellipse':
                objectName = 'Elips';
                break;
            case 'line':
                objectName = 'Çizgi';
                break;
            case 'text':
                objectName = 'Metin';
                break;
            default:
                objectName = 'SVG Nesne';
        }

        wrapper.setAttribute('data-object-name', objectName);

        // Geçici elementi wrapper'a taşı
        const finalElement = this.tempElement.cloneNode(true);
        this.canvas.removeChild(this.tempElement);

        // Seçim için görünmez rect
        const selectionRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        selectionRect.setAttribute('class', 'selection-handle');

        // Elementin sınırlarını hesapla
        let bbox;
        try {
            bbox = finalElement.getBBox();
        } catch (error) {
            // getBBox hata verirse varsayılan boyut kullan
            bbox = { x: 0, y: 0, width: 80, height: 80 };
        }

        selectionRect.setAttribute('width', bbox.width);
        selectionRect.setAttribute('height', bbox.height);
        selectionRect.setAttribute('x', bbox.x);
        selectionRect.setAttribute('y', bbox.y);
        selectionRect.setAttribute('fill', 'transparent');
        selectionRect.setAttribute('stroke', 'transparent');
        selectionRect.setAttribute('stroke-width', 1);

        // Wrapper'a elemanları ekle ve doğru hizala
        wrapper.appendChild(selectionRect);
        wrapper.appendChild(finalElement);

        // Canvas'a ekle
        this.canvas.appendChild(wrapper);

        // Çizilen nesneyi seç
        this.clearSelection();
        this.addToSelection(wrapper);

        // Transform için hazırla
        if (typeof transformHandler !== 'undefined') {
            transformHandler.showTransformControls(wrapper);
        }

        // Nesne listesini güncelle
        this.updateObjectsList();

        // Seçim aracına geri dön
        this.setActiveTool('select');

        this.tempElement = null;
        this.drawingStarted = false;
    }

    /**
     * Canvas özelliklerini göster
     */
    showCanvasProperties() {
        // Canvas element
        const canvas = document.getElementById('editor-canvas');

        // Canvas özelliklerini al
        const width = canvas.getAttribute('width') || 800;
        const height = canvas.getAttribute('height') || 600;
        const viewBox = canvas.getAttribute('viewBox') || `0 0 ${width} ${height}`;
        const backgroundColor = canvas.style.backgroundColor || '#ffffff';

        // Canvas özelliklerini göster
        $('#properties-panel').html(`
            <div class="property-group">
                <h3>Canvas Özellikleri</h3>
            </div>
            
            <div class="property-group">
                <label>Başlık:</label>
                <input type="text" id="canvas-title" value="Drawing">
            </div>
            
            <div class="property-group">
                <label>Genişlik:</label>
                <input type="number" id="canvas-width" value="${width}">
            </div>
            
            <div class="property-group">
                <label>Yükseklik:</label>
                <input type="number" id="canvas-height" value="${height}">
            </div>
            
            <div class="property-group">
                <label>Arkaplan Rengi:</label>
                <input type="color" id="canvas-color" value="${this.rgbToHex(backgroundColor)}">
            </div>
            
            <div class="property-group">
                <label>Boyut:</label>
                <select id="canvas-size">
                    <option value="${width}x${height}" selected>${width}x${height}</option>
                    <option value="800x600">800x600</option>
                    <option value="1024x768">1024x768</option>
                    <option value="1280x720">1280x720</option>
                    <option value="1920x1080">1920x1080</option>
                </select>
            </div>
        `);

        // Canvas özellik değişikliği olaylarını ekle
        $('#canvas-width, #canvas-height').off('change').on('change', function() {
            const width = $('#canvas-width').val();
            const height = $('#canvas-height').val();

            // Canvas boyutlarını güncelle
            canvas.setAttribute('width', width);
            canvas.setAttribute('height', height);
            canvas.setAttribute('viewBox', `0 0 ${width} ${height}`);

            // Size dropdown'ını güncelle
            $('#canvas-size').val(`${width}x${height}`);
        });

        $('#canvas-size').off('change').on('change', function() {
            const [width, height] = $(this).val().split('x');

            // Canvas boyutlarını güncelle
            $('#canvas-width').val(width);
            $('#canvas-height').val(height);

            // Canvas boyutlarını güncelle
            canvas.setAttribute('width', width);
            canvas.setAttribute('height', height);
            canvas.setAttribute('viewBox', `0 0 ${width} ${height}`);
        });

        $('#canvas-color').off('change').on('change', function() {
            const color = $(this).val();

            // Canvas arkaplan rengini güncelle
            canvas.style.backgroundColor = color;
        });

        // Panel göster
        $('#no-selection-message').hide();
        $('#properties-panel').show();
    }

    /**
     * Alan seçimini başlat
     * @param {MouseEvent} e Mouse olayı
     */
    startAreaSelection(e) {
        // Fare başlangıç pozisyonunu kaydet
        this.startX = e.clientX;
        this.startY = e.clientY;
        this.isAreaSelecting = true;

        // Seçim alanını görünür yap
        this.selectionArea.style.display = 'block';
        this.selectionArea.style.left = `${this.startX}px`;
        this.selectionArea.style.top = `${this.startY}px`;
        this.selectionArea.style.width = '0';
        this.selectionArea.style.height = '0';

        // Canvas'a seçim modu sınıfı ekle
        this.canvas.classList.add('area-selecting');
    }

    /**
     * Mouse hareketi olayı
     * @param {MouseEvent} e Mouse olayı
     */
    onMouseMove(e) {
        // Alan seçimi aktifse
        if (this.isAreaSelecting) {
            // Genişlik ve yüksekliği hesapla
            const width = e.clientX - this.startX;
            const height = e.clientY - this.startY;

            // Negatif değerleri düzelt
            const left = width < 0 ? e.clientX : this.startX;
            const top = height < 0 ? e.clientY : this.startY;
            const absWidth = Math.abs(width);
            const absHeight = Math.abs(height);

            // Seçim alanını güncelle
            this.selectionArea.style.left = `${left}px`;
            this.selectionArea.style.top = `${top}px`;
            this.selectionArea.style.width = `${absWidth}px`;
            this.selectionArea.style.height = `${absHeight}px`;
        }
        // Çizim işlemi aktifse
        else if (this.drawingStarted && this.tempElement) {
            // Tuval üzerindeki pozisyonu hesapla
            const canvasRect = this.canvas.getBoundingClientRect();
            const mouseX = e.clientX - canvasRect.left;
            const mouseY = e.clientY - canvasRect.top;

            // CTM'yi tersine çevirerek SVG koordinatlarını hesapla
            const svgPoint = this.canvas.createSVGPoint();
            svgPoint.x = mouseX;
            svgPoint.y = mouseY;
            const transformedPoint = svgPoint.matrixTransform(this.canvas.getScreenCTM().inverse());

            const currentX = transformedPoint.x;
            const currentY = transformedPoint.y;

            // Element tipine göre güncelle
            const tagName = this.tempElement.tagName.toLowerCase();
            switch (tagName) {
                case 'rect':
                    // Dikdörtgeni güncelle
                    const rectX = Math.min(this.startX, currentX);
                    const rectY = Math.min(this.startY, currentY);
                    const rectWidth = Math.abs(currentX - this.startX);
                    const rectHeight = Math.abs(currentY - this.startY);

                    this.tempElement.setAttribute('x', rectX);
                    this.tempElement.setAttribute('y', rectY);
                    this.tempElement.setAttribute('width', rectWidth);
                    this.tempElement.setAttribute('height', rectHeight);
                    break;

                case 'circle':
                    // Daireyi güncelle
                    const radius = Math.sqrt(
                        Math.pow(currentX - this.startX, 2) +
                        Math.pow(currentY - this.startY, 2)
                    );

                    this.tempElement.setAttribute('r', radius);
                    break;

                case 'ellipse':
                    // Elipsi güncelle
                    const rx = Math.abs(currentX - this.startX);
                    const ry = Math.abs(currentY - this.startY);

                    this.tempElement.setAttribute('rx', rx);
                    this.tempElement.setAttribute('ry', ry);
                    break;

                case 'line':
                    // Çizgiyi güncelle
                    this.tempElement.setAttribute('x2', currentX);
                    this.tempElement.setAttribute('y2', currentY);
                    break;
            }
        }
    }

    /**
     * Mouse yukarı olayı
     * @param {MouseEvent} e Mouse olayı
     */
    onMouseUp(e) {
        // Alan seçimi tamamlandıysa
        if (this.isAreaSelecting) {
            this.isAreaSelecting = false;
            this.canvas.classList.remove('area-selecting');

            // Seçim alanı yeterince büyükse
            const area = this.selectionArea.getBoundingClientRect();
            if (area.width > 5 && area.height > 5) {
                // Seçim alanındaki nesneleri seç
                this.selectElementsInArea();
            }

            // Seçim alanını gizle
            this.selectionArea.style.display = 'none';
        }
        // Çizim tamamlandıysa
        else if (this.drawingStarted && this.tempElement) {
            this.finishDrawing();
        }
    }

    /**
     * Klavye tuşu olayı
     * @param {KeyboardEvent} e Klavye olayı
     */
    onKeyDown(e) {
        // Input alanında değilse işlem yap
        if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
            return;
        }

        // Kopyalama: Ctrl+C veya Cmd+C
        if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
            this.copySelectedElements();
        }
        // Yapıştırma: Ctrl+V veya Cmd+V
        else if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
            this.pasteElements();
        }
        // Silme: Delete tuşu
        else if (e.key === 'Delete' || e.key === 'Backspace') {
            this.deleteSelectedElements();
        }
        // Gruplandırma: Ctrl+G veya Cmd+G
        else if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
            e.preventDefault();
            this.groupSelectedElements();
        }
        // Grubu dağıtma: Ctrl+Shift+G veya Cmd+Shift+G
        else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'g') {
            e.preventDefault();
            this.ungroupSelectedElements();
        }
        // En öne getir: Ctrl+Shift+↑ veya Cmd+Shift+↑
        else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'ArrowUp') {
            e.preventDefault();
            this.bringToFront();
        }
        // En arkaya gönder: Ctrl+Shift+↓ veya Cmd+Shift+↓
        else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'ArrowDown') {
            e.preventDefault();
            this.sendToBack();
        }
        // Bir adım öne getir: Ctrl+↑ veya Cmd+↑
        else if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowUp') {
            e.preventDefault();
            this.bringForward();
        }
        // Bir adım arkaya gönder: Ctrl+↓ veya Cmd+↓
        else if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowDown') {
            e.preventDefault();
            this.sendBackward();
        }
    }

    /**
     * Birden fazla objede transform için grup kontrollerini göster
     */
    showGroupControls() {
        if (this.selectedElements.length <= 1 || !transformHandler) return;

        // Tüm elemanların BBox'larını birleştir
        let minX = Infinity,
            minY = Infinity;
        let maxX = -Infinity,
            maxY = -Infinity;

        this.selectedElements.forEach(element => {
            const bbox = element.getBBox();
            const ctm = element.getCTM();

            // Köşe noktalarını transform et
            const corners = [
                { x: bbox.x, y: bbox.y },
                { x: bbox.x + bbox.width, y: bbox.y },
                { x: bbox.x, y: bbox.y + bbox.height },
                { x: bbox.x + bbox.width, y: bbox.y + bbox.height }
            ];

            corners.forEach(corner => {
                const transformedPoint = this.transformPoint(corner.x, corner.y, ctm);
                minX = Math.min(minX, transformedPoint.x);
                minY = Math.min(minY, transformedPoint.y);
                maxX = Math.max(maxX, transformedPoint.x);
                maxY = Math.max(maxY, transformedPoint.y);
            });
        });

        // Grup kutusunun boyutları
        const width = maxX - minX;
        const height = maxY - minY;

        // Geçici grup elementi
        const groupElement = document.createElementNS("http://www.w3.org/2000/svg", "g");
        groupElement.setAttribute('class', 'temporary-group');
        groupElement.setAttribute('transform', `translate(${minX}, ${minY})`);

        // Grup sınır kutusu
        const boundingBox = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        boundingBox.setAttribute('width', width);
        boundingBox.setAttribute('height', height);
        boundingBox.setAttribute('fill', 'transparent');
        boundingBox.setAttribute('stroke', '#4285f4');
        boundingBox.setAttribute('stroke-width', '1');
        boundingBox.setAttribute('stroke-dasharray', '5,5');

        groupElement.appendChild(boundingBox);

        // Geçici grubu canvas'a ekle
        this.canvas.appendChild(groupElement);

        // SubjX ile transform kontrollerini göster
        transformHandler.makeGroupTransformable(groupElement, this.selectedElements);
    }

    /**
     * Seçim alanındaki tüm SVG nesnelerini seç
     */
    selectElementsInArea() {
        // Seçim alanının koordinatlarını al
        const areaRect = this.selectionArea.getBoundingClientRect();

        // Yalnızca ana SVG nesnelerini seç (wrapper'ları)
        const svgElements = this.canvas.querySelectorAll('.svg-object-wrapper, .svg-object-group');

        let selectedCount = 0;
        const selectedElements = new Set();

        svgElements.forEach(element => {
            // Element sınırlarını al
            const elementRect = element.getBoundingClientRect();

            // Kesişim kontrolü
            if (
                elementRect.left < areaRect.right &&
                elementRect.right > areaRect.left &&
                elementRect.top < areaRect.bottom &&
                elementRect.bottom > areaRect.top
            ) {
                // SVG wrapper veya grup ise ve henüz seçilmediyse
                if (($(element).hasClass('svg-object-wrapper') || $(element).hasClass('svg-object-group')) &&
                    !selectedElements.has(element)) {

                    this.addToSelection(element);
                    selectedElements.add(element);
                    selectedCount++;
                }
            }
        });

        // Birden fazla seçimde grup transform kontrollerini göster
        if (selectedCount > 1) {
            this.showGroupControls();
            this.showNotification(`${selectedCount} nesne seçildi`, 'info');
        }
    }

    /**
     * Elementi seçime ekle
     * @param {HTMLElement} element Seçilecek element
     */
    addToSelection(element) {
        // Eğer element bir grup içindeki alt element ise, asıl grubu seç
        if (!$(element).hasClass('svg-object-wrapper') &&
            !$(element).hasClass('svg-object-group') &&
            $(element).parents('.svg-object-wrapper').length > 0) {

            element = $(element).closest('.svg-object-wrapper')[0];
        }

        // Element zaten seçili mi kontrol et
        const alreadySelected = this.selectedElements.includes(element);

        // Zaten seçili değilse ekle
        if (!alreadySelected) {
            this.selectedElements.push(element);

            // Seçim vurgusunu ekle
            if ($(element).hasClass('svg-object-wrapper')) {
                $(element).attr('data-selected', 'true');
                $(element).find('rect.selection-handle').attr('stroke', '#4285f4').attr('stroke-dasharray', '5,5');
            } else {
                $(element).attr('stroke-dasharray', '5,5').attr('data-selected', 'true');
            }

            // Nesne listesini güncelle
            if (typeof updateObjectsList === 'function') {
                updateObjectsList();
            } else if (typeof this.updateObjectsList === 'function') {
                this.updateObjectsList();
            }

            // Özellikler paneli ile seçilen nesnenin özelliklerini göster
            if (this.selectedElements.length === 1) {
                if (typeof transformHandler !== 'undefined' && typeof transformHandler.updatePropertiesPanel === 'function') {
                    transformHandler.updatePropertiesPanel(element);
                }
            }
        }
    }

    /**
     * Elementi seçimden çıkar
     * @param {HTMLElement} element Seçimden çıkarılacak element
     */
    removeFromSelection(element) {
        // Elementi seçim listesinden çıkar
        const index = this.selectedElements.indexOf(element);
        if (index !== -1) {
            this.selectedElements.splice(index, 1);

            // Seçim vurgusunu kaldır
            if ($(element).hasClass('svg-object-wrapper')) {
                $(element).removeAttr('data-selected');
                $(element).find('rect.selection-handle').attr('stroke', 'transparent').removeAttr('stroke-dasharray');
            } else {
                $(element).removeAttr('stroke-dasharray').removeAttr('data-selected');
            }

            // Nesne listesini güncelle
            if (typeof updateObjectsList === 'function') {
                updateObjectsList();
            } else if (typeof this.updateObjectsList === 'function') {
                this.updateObjectsList();
            }
        }
    }

    /**
     * Tüm seçimleri temizle
     */
    clearSelection() {
        // Transform kontrollerini gizle
        if (typeof transformHandler !== 'undefined') {
            try {
                transformHandler.hideTransformControls();
            } catch (error) {
                console.log('Transform kontrollerini gizlerken hata:', error);
            }
        }

        // Tüm seçili elementlerin vurgusunu kaldır
        this.selectedElements.forEach(element => {
            if ($(element).hasClass('svg-object-wrapper')) {
                $(element).removeAttr('data-selected');
                $(element).find('rect.selection-handle').attr('stroke', 'transparent').removeAttr('stroke-dasharray');
            } else {
                $(element).removeAttr('stroke-dasharray').removeAttr('data-selected');
            }
        });

        // Geçici grup elementlerini temizle
        const tempGroups = this.canvas.querySelectorAll('.temporary-group');
        tempGroups.forEach(group => group.remove());

        // Seçim listesini temizle
        this.selectedElements = [];

        // Nesne listesini güncelle
        if (typeof updateObjectsList === 'function') {
            updateObjectsList();
        } else if (typeof this.updateObjectsList === 'function') {
            this.updateObjectsList();
        }
    }

    /**
     * Seçili nesneleri kopyala
     */
    copySelectedElements() {
        if (this.selectedElements.length === 0) {
            this.showNotification('Kopyalanacak nesne seçilmedi', 'warning');
            return;
        }

        // Kopyalama işlemi için seçili nesneleri sakla
        this.clipboard = [];

        this.selectedElements.forEach(element => {
            // Element HTML'ini al
            const clone = element.cloneNode(true);
            this.clipboard.push(clone);
        });

        this.showNotification('Nesne kopyalandı', 'success');
    }

    /**
     * Kopyalanan nesneleri yapıştır
     */
    pasteElements() {
        if (!this.clipboard || this.clipboard.length === 0) {
            this.showNotification('Yapıştırılacak nesne bulunamadı', 'warning');
            return;
        }

        // Önce mevcut seçimi temizle
        this.clearSelection();

        // Canvas'ın merkezi
        const canvasRect = this.canvas.getBoundingClientRect();
        const canvasCenterX = canvasRect.width / 2;
        const canvasCenterY = canvasRect.height / 2;

        // SVG koordinat sistemine dönüştür
        const svgPoint = this.canvas.createSVGPoint();
        svgPoint.x = canvasCenterX;
        svgPoint.y = canvasCenterY;

        // Görünüm dönüşümünü hesapla
        const CTM = this.canvas.getScreenCTM();
        const transformedPoint = svgPoint.matrixTransform(CTM.inverse());

        // Kopyalanan her nesneyi yapıştır
        this.clipboard.forEach((clonedElement, index) => {
            // Yeni bir kopya oluştur
            const newElement = clonedElement.cloneNode(true);

            // Benzersiz ID'ler üret (gerekirse)
            this.generateUniqueIds(newElement);

            // SVG wrapper'ları için spesifik işlemler
            if ($(newElement).hasClass('svg-object-wrapper') || $(newElement).hasClass('svg-object-group')) {
                // Orijinal transform bilgilerini al
                const transform = $(newElement).attr('transform') || '';
                const translateMatch = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);

                if (translateMatch) {
                    // Orijinal konumu al
                    let x = parseFloat(translateMatch[1]);
                    let y = parseFloat(translateMatch[2]);

                    // Merkeze göre ofset ekle veya birden fazla nesne yapıştırılıyorsa ofset ekle
                    if (this.clipboard.length === 1) {
                        x = transformedPoint.x;
                        y = transformedPoint.y;
                    } else {
                        x += 20 * (index + 1);
                        y += 20 * (index + 1);
                    }

                    // Transform attribute'u güncelle
                    $(newElement).attr('transform', transform.replace(
                        /translate\([^)]+\)/,
                        `translate(${x}, ${y})`
                    ));
                } else {
                    // Transform yoksa yeni ekle
                    $(newElement).attr('transform', `translate(${transformedPoint.x + index*20}, ${transformedPoint.y + index*20})`);
                }
            }

            // SVG canvas'a ekle
            this.canvas.appendChild(newElement);

            // Yeni elementi seçime ekle
            this.addToSelection(newElement);
        });

        // Nesne listesini güncelle
        if (typeof updateObjectsList === 'function') {
            updateObjectsList();
        } else if (typeof this.updateObjectsList === 'function') {
            this.updateObjectsList();
        }

        // Eğer tek bir element yapıştırıldıysa transform kontrollerini göster
        if (this.selectedElements.length === 1 && typeof transformHandler !== 'undefined') {
            try {
                transformHandler.showTransformControls(this.selectedElements[0]);
            } catch (error) {
                console.error('Transform kontrollerini gösterirken hata:', error);
            }
        } else if (this.selectedElements.length > 1) {
            // Birden fazla element yapıştırıldıysa grup transform kontrollerini göster
            this.showGroupControls();
        }

        this.showNotification('Nesne yapıştırıldı', 'success');
    }

    /**
     * Elementi içindeki tüm ID'leri eşsiz olarak günceller
     * @param {HTMLElement} element Güncellenecek element
     */
    generateUniqueIds(element) {
        // Elementin kendi ID'si varsa güncelle
        if (element.id) {
            element.id = `${element.id}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        }

        // Özellikleri tara href, xlink:href gibi referansları güncelle
        Array.from(element.attributes).forEach(attr => {
            if (attr.value.startsWith('#')) {
                // ID referansı bulundu, güncelle
                const oldId = attr.value.substring(1);
                const newId = `${oldId}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

                // Referansı güncelle
                element.setAttribute(attr.name, `#${newId}`);

                // Referans edilen elementi bul ve ID'sini güncelle
                const refElement = element.querySelector(`#${oldId}`);
                if (refElement) {
                    refElement.id = newId;
                }
            }
        });

        // Alt elementleri işle
        Array.from(element.children).forEach(child => {
            this.generateUniqueIds(child);
        });
    }

    /**
     * Seçili nesneleri sil
     */
    deleteSelectedElements() {
        if (this.selectedElements.length === 0) {
            this.showNotification('Silinecek nesne seçilmedi', 'warning');
            return;
        }

        // Transform kontrollerini gizle
        if (typeof transformHandler !== 'undefined') {
            try {
                transformHandler.hideTransformControls();
            } catch (error) {
                console.log('Transform kontrollerini gizlerken hata:', error);
            }
        }

        // Geçici grup elementlerini temizle
        const tempGroups = this.canvas.querySelectorAll('.temporary-group');
        tempGroups.forEach(group => group.remove());

        // Tüm seçili elementleri sil
        this.selectedElements.forEach(element => {
            element.remove();
        });

        // Seçim listesini temizle
        this.selectedElements = [];

        // Nesne listesini güncelle
        if (typeof updateObjectsList === 'function') {
            updateObjectsList();
        } else if (typeof this.updateObjectsList === 'function') {
            this.updateObjectsList();
        }

        // Özellikler panelini gizle
        $('#properties-panel').hide();
        $('#no-selection-message').show();

        this.showNotification('Nesne silindi', 'success');
    }

    /**
     * Nesne listesini güncelle
     */
    updateObjectsList() {
        const objects = $('#editor-canvas').children('.svg-object-wrapper, .svg-object-group');
        let objectsList = '';

        objects.each(function(index) {
            const tagName = this.tagName.toLowerCase();
            let icon, name;

            if ($(this).hasClass('svg-object-wrapper')) {
                icon = 'fa-puzzle-piece';
                name = $(this).data('object-name') || 'SVG Obje';
            } else if ($(this).hasClass('svg-object-group')) {
                icon = 'fa-object-group';
                name = $(this).data('object-name') || 'Grup';
            } else {
                switch (tagName) {
                    case 'rect':
                        icon = 'fa-square';
                        name = 'Dikdörtgen';
                        break;
                    case 'circle':
                        icon = 'fa-circle';
                        name = 'Daire';
                        break;
                    case 'ellipse':
                        icon = 'fa-egg';
                        name = 'Elips';
                        break;
                    case 'line':
                        icon = 'fa-slash';
                        name = 'Çizgi';
                        break;
                    case 'text':
                        icon = 'fa-font';
                        name = 'Metin';
                        break;
                    case 'g':
                        icon = 'fa-object-group';
                        name = 'Grup';
                        break;
                    default:
                        icon = 'fa-object-group';
                        name = 'Nesne';
                }
            }

            const isSelected = $(this).attr('data-selected') === 'true';
            objectsList += `
        <div class="object-item ${isSelected ? 'selected' : ''}" data-index="${index}">
            <i class="fas ${icon}"></i>
            <span>${name} ${index + 1}</span>
        </div>
    `;
        });

        $('#svg-objects').html(objectsList);

        // Nesne öğelerine tıklama olayı ekle
        $('.object-item').on('click', function(event) {
            const index = $(this).data('index');
            const element = $('#editor-canvas').children('.svg-object-wrapper, .svg-object-group')[index];

            // Shift tuşu basılı değilse mevcut seçimi temizle
            if (!event.shiftKey) {
                selectionManager.clearSelection();
            }

            // Seçilen elemanı selectionManager ile seç
            selectionManager.addToSelection(element);

            // Nesne listesinde seçimi güncelle
            $('.object-item').removeClass('selected');
            $(this).addClass('selected');
        });
    }


    makeIdsUnique(element) {
        if (!element) return;

        // Elementin kendi ID'si
        if (element.id) {
            element.id = `${element.id}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        }

        // Alt elementleri işle
        Array.from(element.children).forEach(child => {
            this.makeIdsUnique(child);
        });

        // Özniteliklerden ID referanslarını bul ve güncelle
        Array.from(element.attributes).forEach(attr => {
            if (attr.value && attr.value.includes('#')) {
                const idMatch = attr.value.match(/#([a-zA-Z][\w-]*)/g);
                if (idMatch) {
                    idMatch.forEach(id => {
                        const oldId = id.substring(1);
                        const newId = `${oldId}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

                        // Referansı güncelle
                        attr.value = attr.value.replace(id, `#${newId}`);

                        // Elementler içinde de id'yi değiştir
                        try {
                            const targetElement = element.querySelector(`#${oldId}`);
                            if (targetElement) {
                                targetElement.id = newId;
                            }
                        } catch (e) {
                            console.error('ID güncelleme hatası:', e);
                        }
                    });
                }
            }
        });
    }

    /**
     * Seçili nesneleri grupla
     */
    groupSelectedElements() {
        if (this.selectedElements.length <= 1) {
            this.showNotification('Gruplamak için en az iki nesne seçin', 'warning');
            return;
        }

        // Transform kontrollerini gizle
        if (typeof transformHandler !== 'undefined') {
            try {
                transformHandler.hideTransformControls();
            } catch (error) {
                console.log('Transform kontrollerini gizlerken hata:', error);
            }
        }

        // Geçici grup elementlerini temizle
        const tempGroups = this.canvas.querySelectorAll('.temporary-group');
        tempGroups.forEach(group => group.remove());

        // Yeni grup elementi oluştur
        const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
        group.setAttribute('class', 'svg-object-wrapper svg-object-group');
        group.setAttribute('data-group', 'true');
        group.setAttribute('data-object-name', 'Grup');

        // Grubun sınırlarını hesapla (tüm seçili elementleri kapsayacak şekilde)
        let minX = Infinity,
            minY = Infinity;
        let maxX = -Infinity,
            maxY = -Infinity;

        // Tüm seçili elementlerin gerçek koordinatlarını al
        this.selectedElements.forEach(element => {
            try {
                // Element pozisyonu ve boyutlarını hesapla
                const bbox = element.getBBox();
                const ctm = element.getCTM();

                if (!bbox || !ctm) return;

                // CTM ile transform edilmiş köşe noktaları
                const corners = [
                    { x: bbox.x, y: bbox.y },
                    { x: bbox.x + bbox.width, y: bbox.y },
                    { x: bbox.x, y: bbox.y + bbox.height },
                    { x: bbox.x + bbox.width, y: bbox.y + bbox.height }
                ];

                corners.forEach(corner => {
                    const transformedPoint = this.transformPoint(corner.x, corner.y, ctm);
                    minX = Math.min(minX, transformedPoint.x);
                    minY = Math.min(minY, transformedPoint.y);
                    maxX = Math.max(maxX, transformedPoint.x);
                    maxY = Math.max(maxY, transformedPoint.y);
                });
            } catch (error) {
                console.error('Element sınırlarını hesaplama hatası:', error);
            }
        });

        // Grubun boyutları
        const width = maxX - minX;
        const height = maxY - minY;

        if (width <= 0 || height <= 0) {
            this.showNotification('Grup oluşturulamadı: Geçersiz boyutlar', 'error');
            return;
        }

        // Grup pozisyonunu ayarla
        group.setAttribute('transform', `translate(${minX}, ${minY})`);

        // Seçim için görünmez rect ekle
        const selectionRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        selectionRect.setAttribute('class', 'selection-handle');
        selectionRect.setAttribute('width', width);
        selectionRect.setAttribute('height', height);
        selectionRect.setAttribute('fill', 'transparent');
        selectionRect.setAttribute('stroke', 'transparent');
        selectionRect.setAttribute('stroke-width', '1');
        selectionRect.setAttribute('x', 0);
        selectionRect.setAttribute('y', 0);

        // Seçim rect'ini grup başına ekle
        group.appendChild(selectionRect);

        // Tüm seçili elementleri gruba taşı ve realtif pozisyonlarını hesapla
        this.selectedElements.forEach(element => {
            // Elementin klonunu oluştur
            const clone = element.cloneNode(true);

            // Elementin CTM'ini al
            const elementCTM = element.getCTM();
            const groupCTM = this.createSVGMatrix();
            groupCTM.e = minX;
            groupCTM.f = minY;

            if (!elementCTM) return;

            // Grup koordinatlarına göre düzeltilmiş transform hesapla
            const transformMatrix = groupCTM.inverse().multiply(elementCTM);

            // Yeni translate değerlerini ayarla
            let newTransform = `translate(${transformMatrix.e}, ${transformMatrix.f})`;

            // Rotasyon varsa ekle
            if (transformMatrix.a !== 1 || transformMatrix.b !== 0 || transformMatrix.c !== 0 || transformMatrix.d !== 1) {
                const angle = Math.atan2(transformMatrix.b, transformMatrix.a) * (180 / Math.PI);
                newTransform += ` rotate(${angle})`;
            }

            // Yeni transform değerini ayarla
            clone.setAttribute('transform', newTransform);

            // Alt elementlerin id'lerini benzersiz yap
            this.makeIdsUnique(clone);

            // Klonu gruba ekle
            group.appendChild(clone);
        });

        // Grup elementini canvas'a ekle
        this.canvas.appendChild(group);

        // Orijinal elementleri kaldır
        this.selectedElements.forEach(element => {
            element.remove();
        });

        // Seçimi temizle ve yeni grubu seç
        this.clearSelection();
        this.addToSelection(group);

        // Transform kontrollerini göster
        if (typeof transformHandler !== 'undefined') {
            try {
                transformHandler.showTransformControls(group);
            } catch (error) {
                console.error('Transform kontrollerini gösterirken hata:', error);
            }
        }

        this.showNotification('Nesneler gruplandı', 'success');

        // Nesne listesini güncelle
        if (typeof updateObjectsList === 'function') {
            updateObjectsList();
        } else if (typeof this.updateObjectsList === 'function') {
            this.updateObjectsList();
        }
    }

    /**
     * SVG matrisi oluşturmak için yardımcı fonksiyon
     */
    createSVGMatrix() {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        return svg.createSVGMatrix();
    }

    /**
     * Noktayı transform et
     * @param {number} x X koordinatı
     * @param {number} y Y koordinatı
     * @param {SVGMatrix} matrix Transform matrisi
     * @returns {Object} Transform edilmiş nokta {x, y}
     */
    transformPoint(x, y, matrix) {
        return {
            x: x * matrix.a + y * matrix.c + matrix.e,
            y: x * matrix.b + y * matrix.d + matrix.f
        };
    }

    /**
     * Seçili grup nesnesini dağıt
     */
    ungroupSelectedElements() {
        if (this.selectedElements.length !== 1) {
            this.showNotification('Grubu dağıtmak için bir grup seçin', 'warning');
            return;
        }

        const groupElement = this.selectedElements[0];

        // Grup elementi mi kontrol et
        const isGroup = groupElement.tagName.toLowerCase() === 'g' &&
            ($(groupElement).hasClass('svg-object-group') || $(groupElement).attr('data-group') === 'true');

        if (!isGroup) {
            this.showNotification('Seçilen nesne bir grup değil', 'warning');
            return;
        }

        // Transform kontrollerini gizle
        if (typeof transformHandler !== 'undefined') {
            try {
                transformHandler.hideTransformControls();
            } catch (error) {
                console.log('Transform kontrollerini gizlerken hata:', error);
            }
        }

        // Grup pozisyonunu al
        const groupTransform = $(groupElement).attr('transform') || '';
        const translateMatch = groupTransform.match(/translate\(([^,]+),\s*([^)]+)\)/);
        let groupX = 0,
            groupY = 0;

        if (translateMatch) {
            groupX = parseFloat(translateMatch[1]);
            groupY = parseFloat(translateMatch[2]);
        }

        // Grup içindeki tüm elementleri (ilk selection-handle rect'i hariç) kopyala
        const childElements = [];
        Array.from(groupElement.children).forEach((child, index) => {
            // İlk rect selection-handle ise atla
            if (index === 0 && child.tagName.toLowerCase() === 'rect' && $(child).hasClass('selection-handle')) return;

            // Elemanın klonunu oluştur
            const clone = child.cloneNode(true);

            // SVG wrapper için pozisyon güncelleme
            if ($(clone).hasClass('svg-object-wrapper')) {
                // Transform bilgilerini al
                const transform = $(clone).attr('transform') || '';
                const childTranslateMatch = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);

                if (childTranslateMatch) {
                    // Mevcut translate değerlerini al
                    let translateX = parseFloat(childTranslateMatch[1]);
                    let translateY = parseFloat(childTranslateMatch[2]);

                    // Grup pozisyonuna ekle
                    translateX = translateX + groupX;
                    translateY = translateY + groupY;

                    // Transform attribute'unu güncelle
                    $(clone).attr('transform', transform.replace(
                        /translate\([^)]+\)/,
                        `translate(${translateX}, ${translateY})`
                    ));
                } else {
                    // Yeni transform attribute'u ekle
                    $(clone).attr('transform', `translate(${groupX}, ${groupY}) ${transform}`);
                }
            } else {
                // Diğer SVG nesneleri için pozisyon güncelleme
                const tagName = clone.tagName.toLowerCase();

                switch (tagName) {
                    case 'rect':
                        const rectX = parseFloat($(clone).attr('x') || 0) + groupX;
                        const rectY = parseFloat($(clone).attr('y') || 0) + groupY;
                        $(clone).attr('x', rectX).attr('y', rectY);
                        break;
                    case 'circle':
                        const cx = parseFloat($(clone).attr('cx') || 0) + groupX;
                        const cy = parseFloat($(clone).attr('cy') || 0) + groupY;
                        $(clone).attr('cx', cx).attr('cy', cy);
                        break;
                    case 'ellipse':
                        const ecx = parseFloat($(clone).attr('cx') || 0) + groupX;
                        const ecy = parseFloat($(clone).attr('cy') || 0) + groupY;
                        $(clone).attr('cx', ecx).attr('cy', ecy);
                        break;
                    default:
                        // Transform attribute'u kullanarak pozisyon güncelleme
                        const transform = $(clone).attr('transform') || '';
                        if (transform.includes('translate')) {
                            const translateMatch = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
                            if (translateMatch) {
                                const translateX = parseFloat(translateMatch[1]) + groupX;
                                const translateY = parseFloat(translateMatch[2]) + groupY;
                                $(clone).attr('transform', transform.replace(
                                    /translate\([^)]+\)/,
                                    `translate(${translateX}, ${translateY})`
                                ));
                            }
                        } else {
                            // Yeni transform attribute'u ekle
                            $(clone).attr('transform', `translate(${groupX}, ${groupY}) ${transform}`);
                        }
                }
            }

            // Klonu çocuk elementler listesine ekle
            childElements.push(clone);
        });

        // Grubu kaldır
        groupElement.remove();

        // Child elementleri canvas'a ekle
        childElements.forEach(child => {
            this.canvas.appendChild(child);
        });

        // Seçimi temizle ve çıkarılan nesneleri seç
        this.clearSelection();
        childElements.forEach(child => {
            this.addToSelection(child);
        });

        // Nesne listesini güncelle
        if (typeof updateObjectsList === 'function') {
            updateObjectsList();
        } else if (typeof this.updateObjectsList === 'function') {
            this.updateObjectsList();
        }

        // Birden fazla nesne için grup transform kontrollerini göster
        if (childElements.length > 1) {
            this.showGroupControls();
        }

        this.showNotification('Grup dağıtıldı', 'success');
    }

    /**
     * Seçili nesneleri en öne getir
     */
    bringToFront() {
        if (this.selectedElements.length === 0) {
            this.showNotification('Öne getirilecek nesne seçilmedi', 'warning');
            return;
        }

        // Tüm seçili elementleri en öne getir
        this.selectedElements.forEach(element => {
            try {
                // Elementi canvas'tan kaldır ve en üste yeniden ekle
                this.canvas.removeChild(element);
                this.canvas.appendChild(element);
            } catch (error) {
                console.error('Öne getirme işlemi başarısız:', error);
            }
        });

        this.showNotification('Nesne en öne getirildi', 'success');
    }

    /**
     * Seçili nesneleri en arkaya gönder
     */
    sendToBack() {
        if (this.selectedElements.length === 0) {
            this.showNotification('Arkaya gönderilecek nesne seçilmedi', 'warning');
            return;
        }

        // Tüm seçili elementleri en arkaya gönder (en üsttekinden başlayarak)
        [...this.selectedElements].reverse().forEach(element => {
            try {
                // Elementi canvas'tan kaldır ve en alta yeniden ekle
                this.canvas.removeChild(element);
                this.canvas.insertBefore(element, this.canvas.firstChild);
            } catch (error) {
                console.error('Arkaya gönderme işlemi başarısız:', error);
            }
        });

        this.showNotification('Nesne en arkaya gönderildi', 'success');
    }

    /**
     * Seçili nesneyi bir adım öne getir
     */
    bringForward() {
        if (this.selectedElements.length === 0) {
            this.showNotification('Öne getirilecek nesne seçilmedi', 'warning');
            return;
        }

        // Her bir seçili element için
        this.selectedElements.forEach(element => {
            try {
                // Canvas içindeki tüm elementleri diziye al
                const children = Array.from(this.canvas.children);

                // Elementin şu anki pozisyonunu bul
                const currentIndex = children.indexOf(element);

                // Eğer zaten en üstteyse işlem yapma
                if (currentIndex >= children.length - 1) return;

                // Elementi canvas'tan çıkar
                this.canvas.removeChild(element);

                // Bir sonraki elementin sonrasına ekle
                if (currentIndex + 2 < children.length) {
                    this.canvas.insertBefore(element, children[currentIndex + 2]);
                } else {
                    this.canvas.appendChild(element);
                }
            } catch (error) {
                console.error('Öne getirme işlemi başarısız:', error);
            }
        });

        this.showNotification('Nesne bir adım öne getirildi', 'success');
    }

    /**
     * Seçili nesneyi bir adım arkaya gönder
     */
    sendBackward() {
        if (this.selectedElements.length === 0) {
            this.showNotification('Arkaya gönderilecek nesne seçilmedi', 'warning');
            return;
        }

        // Her bir seçili element için (en alttakinden başlayarak)
        [...this.selectedElements].reverse().forEach(element => {
            try {
                // Canvas içindeki tüm elementleri diziye al
                const children = Array.from(this.canvas.children);

                // Elementin şu anki pozisyonunu bul
                const currentIndex = children.indexOf(element);

                // Eğer zaten en alttaysa işlem yapma
                if (currentIndex <= 0) return;

                // Elementi canvas'tan çıkar
                this.canvas.removeChild(element);

                // Bir önceki elementin öncesine ekle
                this.canvas.insertBefore(element, children[currentIndex - 1]);
            } catch (error) {
                console.error('Arkaya gönderme işlemi başarısız:', error);
            }
        });

        this.showNotification('Nesne bir adım arkaya gönderildi', 'success');
    }

    /**
     * Sağ tık menüsü göster
     * @param {MouseEvent} e Mouse olayı
     */
    showContextMenu(e) {
        // Varsa mevcut menüyü kaldır
        const existingMenu = document.querySelector('.context-menu');
        if (existingMenu) {
            existingMenu.remove();
        }

        // Menü oluştur
        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.style.position = 'absolute';
        menu.style.left = `${e.clientX}px`;
        menu.style.top = `${e.clientY}px`;
        menu.style.zIndex = '9999';

        // Seçili elemana göre menü öğeleri
        const hasSelection = this.selectedElements.length > 0;
        const multiSelection = this.selectedElements.length > 1;

        // Menü öğeleri
        const items = [];

        // Seçim işlemleri
        if (hasSelection) {
            items.push({ text: '<i class="fas fa-copy"></i> Kopyala', action: () => this.copySelectedElements() });
            items.push({ text: '<i class="fas fa-trash"></i> Sil', action: () => this.deleteSelectedElements() });
            items.push({ type: 'divider' });
        }

        // Yapıştırma işlemi (her zaman aktif)
        if (this.clipboard && this.clipboard.length > 0) {
            items.push({ text: '<i class="fas fa-paste"></i> Yapıştır', action: () => this.pasteElements() });
            items.push({ type: 'divider' });
        }

        // Grup işlemleri
        if (hasSelection) {
            if (multiSelection) {
                items.push({ text: '<i class="fas fa-object-group"></i> Grupla', action: () => this.groupSelectedElements() });
            } else if ($(this.selectedElements[0]).hasClass('svg-object-group')) {
                items.push({ text: '<i class="fas fa-object-ungroup"></i> Grubu Dağıt', action: () => this.ungroupSelectedElements() });
            }

            items.push({ type: 'divider' });

            // Katman işlemleri
            items.push({ text: '<i class="fas fa-level-up-alt"></i> En Öne Getir', action: () => this.bringToFront() });
            items.push({ text: '<i class="fas fa-level-down-alt"></i> En Arkaya Gönder', action: () => this.sendToBack() });
            items.push({ text: '<i class="fas fa-arrow-up"></i> Bir Adım Öne', action: () => this.bringForward() });
            items.push({ text: '<i class="fas fa-arrow-down"></i> Bir Adım Arkaya', action: () => this.sendBackward() });
        }

        // Çizim araçları
        items.push({ type: 'divider' });
        items.push({ text: '<i class="fas fa-mouse-pointer"></i> Seçim Aracı', action: () => this.setActiveTool('select') });
        items.push({ text: '<i class="fas fa-square"></i> Dikdörtgen', action: () => this.setActiveTool('rectangle') });
        items.push({ text: '<i class="fas fa-circle"></i> Daire', action: () => this.setActiveTool('circle') });
        items.push({ text: '<i class="fas fa-ellipsis-h"></i> Elips', action: () => this.setActiveTool('ellipse') });
        items.push({ text: '<i class="fas fa-slash"></i> Çizgi', action: () => this.setActiveTool('line') });
        items.push({ text: '<i class="fas fa-font"></i> Metin', action: () => this.setActiveTool('text') });

        // Menü öğelerini oluştur
        items.forEach(item => {
            if (item.type === 'divider') {
                const divider = document.createElement('div');
                divider.className = 'divider';
                divider.style.height = '1px';
                divider.style.backgroundColor = '#e0e0e0';
                divider.style.margin = '5px 0';
                menu.appendChild(divider);
            } else {
                const menuItem = document.createElement('div');
                menuItem.innerHTML = item.text;
                menuItem.style.padding = '8px 15px';
                menuItem.style.cursor = 'pointer';
                menuItem.style.whiteSpace = 'nowrap';

                menuItem.addEventListener('mouseover', () => {
                    menuItem.style.backgroundColor = '#f0f0f0';
                });

                menuItem.addEventListener('mouseout', () => {
                    menuItem.style.backgroundColor = 'transparent';
                });

                menuItem.addEventListener('click', () => {
                    item.action();
                    menu.remove();
                });

                menu.appendChild(menuItem);
            }
        });

        // Menü dışına tıklandığında kapat
        document.addEventListener('click', function closeMenu(event) {
            if (!menu.contains(event.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        });

        // Sağ tık yaptığında menü kapanmasın
        menu.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            return false;
        });

        document.body.appendChild(menu);
    }

    /**
     * RGB renk değerini HEX'e dönüştürme
     * @param {string} rgb RGB renk değeri
     * @returns {string} HEX renk değeri
     */
    rgbToHex(rgb) {
        if (!rgb) return '#ffffff';
        if (rgb.startsWith('#')) return rgb;

        const rgbValues = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
        if (!rgbValues) return rgb;

        function hex(x) {
            return ("0" + parseInt(x).toString(16)).slice(-2);
        }

        return "#" + hex(rgbValues[1]) + hex(rgbValues[2]) + hex(rgbValues[3]);
    }

    /**
     * Bildirim göster
     * @param {string} message Bildirim mesajı
     * @param {string} type Bildirim tipi (success, info, warning, error)
     * @param {number} duration Bildirim süresi (ms)
     */
    showNotification(message, type = 'info', duration = 2000) {
        // Önceki bildirimleri temizle
        $('.notification').remove();

        // HTML ve stil yoksa ekle
        if ($('.notification-styles').length === 0) {
            $('head').append(`
        <style class="notification-styles">
            .notification {
                position: fixed;
                top: 0;
                left: 50%;
                transform: translateX(-50%);
                background-color: #333;
                color: white;
                padding: 10px 20px;
                border-radius: 5px;
                z-index: 9999;
                opacity: 0;
                box-shadow: 0 2px 10px rgba(0,0,0,0.2);
                transition: all 0.3s ease;
            }
            .notification.info {
                background-color: #2196F3;
            }
            .notification.success {
                background-color: #4CAF50;
            }
            .notification.warning {
                background-color: #FF9800;
            }
            .notification.error {
                background-color: #F44336;
            }
        </style>
    `);
        }

        // Yeni bildirim oluştur
        const notification = $(`<div class="notification ${type}">${message}</div>`);
        $('body').append(notification);

        // Animasyon ile göster
        setTimeout(() => {
            notification.css({
                opacity: 1,
                top: '20px'
            });

            // Belirli süre sonra gizle
            setTimeout(() => {
                notification.css({
                    opacity: 0,
                    top: '0px'
                });

                // Tamamen kaldır
                setTimeout(() => {
                    notification.remove();
                }, 300);
            }, duration);
        }, 10);
    }
}

// SelectionManager sınıfını örnekle
const selectionManager = new SelectionManager();

// Document hazır olduğunda başlat
$(document).ready(function() {
    selectionManager.init();

    // Araç butonlarına işlevsellik ekle
    $('.tool-btn').on('click', function() {
        const toolName = $(this).data('tool');

        // İşlev butonları
        if (toolName === 'copy') {
            selectionManager.copySelectedElements();
        } else if (toolName === 'paste') {
            selectionManager.pasteElements();
        } else if (toolName === 'delete') {
            selectionManager.deleteSelectedElements();
        } else if (toolName === 'bring-front') {
            selectionManager.bringToFront();
        } else if (toolName === 'send-back') {
            selectionManager.sendToBack();
        } else if (toolName === 'bring-forward') {
            selectionManager.bringForward();
        } else if (toolName === 'send-backward') {
            selectionManager.sendBackward();
        } else if (toolName === 'group') {
            selectionManager.groupSelectedElements();
        } else if (toolName === 'ungroup') {
            selectionManager.ungroupSelectedElements();
        } else {
            // Çizim araçları - aktif aracı ayarla
            selectionManager.setActiveTool(toolName);
        }
    });

    // Canvas için sağ tık menüsünü engelle ve kendi menümüzü göster
    $('#editor-canvas').on('contextmenu', function(e) {
        e.preventDefault();
        e.stopPropagation();
        selectionManager.showContextMenu(e);
        return false;
    });

    // Sayfa genelinde editor-canvas içinde sağ tık menüsünü engelle
    $(document).on('contextmenu', function(e) {
        if ($(e.target).closest('#editor-canvas').length) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
    });

    // Selection area için CSS ekle
    $('head').append(`
<style>
.selection-area {
    position: absolute;
    border: 2px dashed #4285f4;
    background-color: rgba(66, 133, 244, 0.1);
    pointer-events: none;
    z-index: 999;
}

.area-selecting {
    cursor: crosshair !important;
}

.context-menu {
    position: absolute;
    background-color: white;
    border: 1px solid #ddd;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
    border-radius: 4px;
    padding: 5px 0;
    z-index: 9999;
    min-width: 180px;
    font-size: 14px;
}

.svg-object-wrapper, .svg-object-group {
    cursor: pointer;
}

.temporary-group {
    pointer-events: none;
}
</style>
`);

    // Global olarak updateObjectsList fonksiyonunu tanımla
    window.updateObjectsList = selectionManager.updateObjectsList.bind(selectionManager);
});