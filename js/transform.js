/**
 * SVG Nesneleri için SubjX ile Transform İşlemleri - Geliştirilmiş Versiyon
 * - Taşıma (Moving)
 * - Boyutlandırma (Resizing)
 * - Döndürme (Rotation)
 * - Çoklu Seçim İçin Grup Transform
 */
class TransformHandler {
    constructor() {
        this.activeElement = null;
        this.selectedElements = []; // Birden fazla seçim için
        this.subjx = null;
        this.draged = null;
        this.canvas = null;
        this.canvasContainer = null;
        this.currentScale = 1;
        this.temporaryGroup = null;

        // Bağlam koruma
        this.initSubjx = this.initSubjx.bind(this);
        this.makeElementDraggable = this.makeElementDraggable.bind(this);
        this.makeGroupTransformable = this.makeGroupTransformable.bind(this);
        this.clearSelection = this.clearSelection.bind(this);
        this.hideTransformControls = this.hideTransformControls.bind(this);
        this.showTransformControls = this.showTransformControls.bind(this);
        this.updatePropertiesPanel = this.updatePropertiesPanel.bind(this);
        this.waitForCanvas = this.waitForCanvas.bind(this);
        this.applyGroupTransform = this.applyGroupTransform.bind(this);
    }

    /**
     * Transform işleyicisini başlat
     */
    init() {
        this.loadSubjxLibrary()
            .then(() => {
                console.log('SubjX kütüphanesi yüklendi');
                this.waitForCanvas();
            })
            .catch(error => {
                console.error('SubjX yüklenemedi:', error);
            });
    }

    /**
     * Canvas elementinin DOM'a yüklenmesini bekle
     */
    waitForCanvas() {
        this.canvas = document.getElementById('editor-canvas');
        this.canvasContainer = document.querySelector('.canvas-area');

        if (!this.canvas || !this.canvasContainer) {
            console.log('Canvas henüz yüklenmedi, tekrar deneniyor...');
            setTimeout(this.waitForCanvas, 100);
            return;
        }

        console.log('Canvas bulundu, SubjX başlatılıyor');
        this.initSubjx();

        // Scale bilgisini al (varsa)
        if (window.canvasManager) {
            this.currentScale = window.canvasManager.currentScale;
        }

        // Scroll/pan sırasında subjX güncellemesi
        this.canvasContainer.addEventListener('scroll', () => {
            if (this.draged) {
                try {
                    this.draged.refresh();
                } catch (error) {
                    console.error('SubjX güncelleme hatası:', error);
                }
            }
        });

        // Ölçek değişikliği olayını dinle
        document.addEventListener('scale-changed', (e) => {
            this.currentScale = e.detail.scale;
            if (this.draged) {
                try {
                    this.draged.refresh();
                } catch (error) {
                    console.error('SubjX ölçek güncelleme hatası:', error);
                }
            }
        });

        console.log('SubjX transform işleyicisi hazır');
    }

    /**
     * SubjX kütüphanesini dinamik olarak yükle
     */
    loadSubjxLibrary() {
        return new Promise((resolve, reject) => {
            if (window.subjx) {
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/subjx@1.1.0/dist/js/subjx.min.js';
            script.onload = () => {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = 'https://cdn.jsdelivr.net/npm/subjx@1.1.0/dist/style/subjx.min.css';
                document.head.appendChild(link);
                link.onload = () => resolve();
                link.onerror = () => reject(new Error('SubjX CSS yüklenemedi'));
            };
            script.onerror = () => reject(new Error('SubjX JavaScript yüklenemedi'));
            document.head.appendChild(script);
        });
    }

    /**
     * SubjX'i başlat
     */
    initSubjx() {
            if (!this.canvas) {
                console.error('Canvas elementi bulunamadı, SubjX başlatılamıyor!');
                return;
            }
            this.subjx = window.subjx;

            // Özel CSS ekle
            this.addCustomStyles();

            console.log('SubjX başlatıldı ve olay dinleyicileri eklendi');
        }
        /**
         * Grup transform değişikliğini uygula
         * @param {HTMLElement} groupElement Grup elementi
         */
    updateGroupTransform(groupElement) {
            if (!groupElement) return;

            // Grup dönüşüm matrisini son değerlere ayarla
            const ctm = groupElement.getCTM();
            if (!ctm) return;

            // Mevcut transformasyonla ilgili değerleri sıfırla
            const rect = $(groupElement).find('rect.selection-handle').first();
            if (rect.length) {
                rect.removeAttr('data-original-width');
                rect.removeAttr('data-original-height');
            }

            // Ölçekleme işlemlerini finalleştir - ileride potansiyel olarak grupları düzenleme
            // veya tekrar gruplandırma için gerekirse buraya ek kod eklenebilir
        }
        /**
         * SubjX için özel stiller ekle
         */
    addCustomStyles() {
        const style = document.createElement('style');
        style.textContent = `
            /* Transform kontrol düğmelerini daha belirgin yap */
            .sjx-hdl {
                background-color: #fff !important;
                border: 2px solid #4285f4 !important;
                width: 12px !important;
                height: 12px !important;
            }
            
            /* Döndürme kontrolü */
            .sjx-hdl-rotator {
                background-color: #4285f4 !important;
                border: 2px solid #fff !important;
                top: -30px !important;
            }
            
            /* Geçici grup için stil */
            .temporary-group {
                pointer-events: all;
            }
            
            /* Geçici grup sınır kutusu */
            .temporary-group rect {
                stroke: #4285f4;
                stroke-width: 1;
                stroke-dasharray: 5, 5;
                fill: transparent;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Elementi sürüklenebilir yap
     * @param {HTMLElement} element Sürüklenecek element
     */
    makeElementDraggable(element) {
        if (!element || !this.subjx) return;

        // Önceki subjX overlay'larını tamamen kaldır
        this.hideTransformControls();

        this.activeElement = element;
        this.selectedElements = [element]; // Tek element

        // Eğer bu bir grup element ise
        const isGroup = element.tagName.toLowerCase() === 'g' &&
            ($(element).hasClass('svg-object-group') ||
                $(element).attr('data-group') === 'true');

        try {
            this.draged = this.subjx(element).drag({
                container: this.canvas,
                proportions: true,
                draggable: true,
                resizable: true,
                scalable: true,
                rotatable: true,
                // Dönüş noktası ayarı
                rotatorAnchor: "n",
                rotatorOffset: 30,
                snap: { x: 1, y: 1, angle: 5 },
                cursorMove: "move",
                cursorRotate: "crosshair",
                cursorResize: "nesw-resize",
                onInit: () => {
                    $(element).attr('data-selected', 'true');
                    $('#no-selection-message').hide();
                    $('#properties-panel').show();

                    // SelectionManager ile entegrasyon
                    if (typeof selectionManager !== 'undefined' && typeof selectionManager.addToSelection === 'function') {
                        // Eğer zaten seçilmediyse ekle
                        if (!selectionManager.selectedElements.includes(element)) {
                            selectionManager.addToSelection(element);
                        }
                    }

                    // Grup ise özel işlemler
                    if (isGroup) {
                        // Grup nesnelerini göster ve grup olduğunu belirten bir işaret ekle
                        $(element).attr('data-is-active-group', 'true');
                    }
                },
                onMove: () => {
                    this.updatePropertiesPanel(element);
                },
                onResize: () => {
                    this.updatePropertiesPanel(element);

                    if (isGroup) {
                        // Grup içi nesneleri yeniden ölçeklendir
                        this.resizeGroupContents(element);
                    } else {
                        // Sıradan SVG wrapper için boyutları güncelle
                        if ($(element).hasClass('svg-object-wrapper')) {
                            const rect = $(element).find('rect.selection-handle');
                            const svg = $(element).find('svg');

                            if (rect.length && svg.length) {
                                const width = parseFloat(rect.attr('width'));
                                const height = parseFloat(rect.attr('height'));

                                svg.attr('width', width);
                                svg.attr('height', height);
                            }
                        }
                    }
                },
                onRotate: () => {
                    this.updatePropertiesPanel(element);
                },
                onDrop: () => {
                    // Dönüştürme sonrası son değerleri kaydet
                    this.saveFinalTransform(element);

                    // Grup içeriğini güncelle
                    if (isGroup) {
                        this.updateGroupTransform(element);
                    }

                    // Nesne listesini güncelle
                    if (typeof updateObjectsList === 'function') {
                        updateObjectsList();
                    }
                }
            }).enable();

            console.log('Element başarıyla seçilebilir yapıldı:', element);

            // Özellikleri güncelle
            this.updatePropertiesPanel(element);
        } catch (error) {
            console.error('Element sürüklenebilir yapılırken hata:', error);
        }
    }


    /**
     * Grup boyut değişiminde içerik ölçekleme
     * @param {HTMLElement} groupElement Grup elementi
     */
    resizeGroupContents(groupElement) {
        if (!groupElement) return;

        // Grup handle rect'ini bul
        const rect = $(groupElement).find('rect.selection-handle').first();
        if (!rect.length) return;

        // Orijinal ve yeni boyutları al
        const originalWidth = parseFloat(rect.attr('data-original-width') || rect.attr('width'));
        const originalHeight = parseFloat(rect.attr('data-original-height') || rect.attr('height'));

        const newWidth = parseFloat(rect.attr('width'));
        const newHeight = parseFloat(rect.attr('height'));

        // İlk defa değiştiriliyorsa orijinal boyutları kaydet
        if (!rect.attr('data-original-width')) {
            rect.attr('data-original-width', originalWidth);
            rect.attr('data-original-height', originalHeight);
        }

        // Ölçek faktörlerini hesapla
        const scaleX = newWidth / originalWidth;
        const scaleY = newHeight / originalHeight;

        // Grup transform matrisini hesapla
        const groupTransform = groupElement.getAttribute('transform') || '';

        // Grup çocuklarını bul (ilk rect.selection-handle hariç)
        const children = Array.from(groupElement.children).filter(child => {
            return child !== rect[0];
        });

        // Her çocuğun transform değerini orantılı olarak güncelle
        children.forEach(child => {
            const transform = child.getAttribute('transform') || '';
            const translateMatch = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);

            if (translateMatch) {
                const tx = parseFloat(translateMatch[1]);
                const ty = parseFloat(translateMatch[2]);

                // Yeni translate değerleri - ölçekli
                const newTx = tx * scaleX;
                const newTy = ty * scaleY;

                // Transform'u güncelle
                const newTransform = transform.replace(
                    /translate\([^)]+\)/,
                    `translate(${newTx}, ${newTy})`
                );

                child.setAttribute('transform', newTransform);

                // Eğer rect, circle gibi boyutu olan bir element ise boyutları da güncelle
                const tagName = child.tagName.toLowerCase();
                if (tagName === 'rect') {
                    const width = parseFloat(child.getAttribute('width') || 0);
                    const height = parseFloat(child.getAttribute('height') || 0);
                    child.setAttribute('width', width * scaleX);
                    child.setAttribute('height', height * scaleY);
                } else if (tagName === 'circle') {
                    const r = parseFloat(child.getAttribute('r') || 0);
                    child.setAttribute('r', r * Math.min(scaleX, scaleY));
                } else if (tagName === 'ellipse') {
                    const rx = parseFloat(child.getAttribute('rx') || 0);
                    const ry = parseFloat(child.getAttribute('ry') || 0);
                    child.setAttribute('rx', rx * scaleX);
                    child.setAttribute('ry', ry * scaleY);
                }

                // SVG wrapper ise içindeki svg'nin boyutlarını güncelle
                if ($(child).hasClass('svg-object-wrapper')) {
                    const svg = $(child).find('svg');
                    if (svg.length) {
                        svg.attr('width', parseFloat(svg.attr('width')) * scaleX);
                        svg.attr('height', parseFloat(svg.attr('height')) * scaleY);
                    }
                }
            }
        });
    }

    /**
     * Birden fazla element için geçici grup oluşturup transform kontrollerini göster
     * @param {HTMLElement} groupElement Geçici grup elementi
     * @param {Array} elements Seçili elementler
     */
    makeGroupTransformable(groupElement, elements) {
        if (!groupElement || !elements || elements.length === 0 || !this.subjx) return;

        // Önceki transform kontrollerini kaldır
        this.hideTransformControls();

        this.temporaryGroup = groupElement;
        this.activeElement = groupElement;
        this.selectedElements = [...elements]; // Seçili elementleri kopyala

        try {
            this.draged = this.subjx(groupElement).drag({
                container: this.canvas,
                proportions: true,
                draggable: true,
                resizable: true,
                scalable: true,
                rotatable: true,
                // Dönüş noktası ayarı
                rotatorAnchor: "n",
                rotatorOffset: 30,
                snap: { x: 1, y: 1, angle: 5 },
                cursorMove: "move",
                cursorRotate: "crosshair",
                cursorResize: "nesw-resize",
                onInit: () => {
                    $('#no-selection-message').hide();
                    $('#properties-panel').show();

                    // Çoklu seçim özellikleri panelini göster
                    this.showMultiSelectionProperties(elements);
                },
                onMove: () => {
                    // Tüm seçili elementleri grup hareketiyle güncelle
                    requestAnimationFrame(() => {
                        this.applyGroupTransform(groupElement, elements);
                    });
                },
                onResize: () => {
                    // Tüm seçili elementleri grup boyutu değişimiyle güncelle
                    requestAnimationFrame(() => {
                        this.applyGroupTransform(groupElement, elements);
                    });
                },
                onRotate: () => {
                    // Tüm seçili elementleri grup dönüşüyle güncelle
                    requestAnimationFrame(() => {
                        this.applyGroupTransform(groupElement, elements);
                    });
                },
                onDrop: () => {
                    // Transform işlemi tamamlandığında tüm elementlere yeni transform değerlerini uygula
                    this.finalizeGroupTransform(groupElement, elements);
                }
            }).enable();

            console.log('Grup başarıyla transform edilebilir yapıldı:', elements.length, 'element');
        } catch (error) {
            console.error('Grup transform hatası:', error);
        }
    }

    /**
     * Geçici grup transformasyonunu elementlere uygula (gerçek zamanlı)
     * @param {HTMLElement} groupElement Geçici grup elementi
     * @param {Array} elements Etkilenecek elementler
     */
    applyGroupTransform(groupElement, elements) {
        // Bu sadece gerçek zamanlı önizleme - henüz gerçek değerleri değiştirme
        if (!groupElement || !elements || elements.length === 0) return;

        try {
            // Grup transform değerlerini al
            const groupTransform = groupElement.getAttribute('transform') || '';

            // Elementlerin orijinal transform değerlerini sakla
            elements.forEach(element => {
                // Eğer saklanmış orijinal transform değeri yoksa kaydet
                if (!element.dataset.originalTransform) {
                    element.dataset.originalTransform = element.getAttribute('transform') || '';
                    element.dataset.inGroupTransform = 'true';
                }
            });
        } catch (error) {
            console.error('Grup transform uygulama hatası:', error);
        }
    }

    /**
     * Grup transform işlemini tamamla ve tüm elementlere uygula
     * @param {HTMLElement} groupElement Geçici grup elementi
     * @param {Array} elements Seçili elementler
     */
    finalizeGroupTransform(groupElement, elements) {
        if (!groupElement || !elements || elements.length === 0) return;

        try {
            // Grup transform değerlerini al
            const groupTransform = groupElement.getAttribute('transform') || '';
            const groupBBox = groupElement.getBBox();

            // Grup transform matrisini hesapla
            const groupMatrix = this.getTransformMatrix(groupElement);

            // Her element için yeni transform değerlerini hesapla ve uygula
            elements.forEach(element => {
                const originalTransform = element.dataset.originalTransform || '';
                const elementMatrix = this.getTransformMatrix(element);

                // Orjinal matris ile grup matrisini birleştir
                const combinedMatrix = groupMatrix.multiply(elementMatrix);

                // Yeni transform değerlerini ayarla
                let newTransform = `matrix(${combinedMatrix.a}, ${combinedMatrix.b}, ${combinedMatrix.c}, ${combinedMatrix.d}, ${combinedMatrix.e}, ${combinedMatrix.f})`;

                // Element'in transform değerini güncelle
                element.setAttribute('transform', newTransform);

                // Data özelliklerini temizle
                delete element.dataset.originalTransform;
                delete element.dataset.inGroupTransform;
            });

            // Transform kontrollerini yeniden göster - bu sefer geçici grup olmadan
            this.showGroupControls(elements);

            // Geçici grup elementini kaldır
            if (groupElement.parentNode) {
                groupElement.parentNode.removeChild(groupElement);
            }

            this.temporaryGroup = null;

            // Nesne listesini güncelle
            if (typeof updateObjectsList === 'function') {
                updateObjectsList();
            }
        } catch (error) {
            console.error('Grup transform tamamlama hatası:', error);
        }
    }

    /**
     * Element için transform matrisini hesapla
     * @param {HTMLElement} element Elementi
     * @returns {SVGMatrix} Transform matrisi
     */
    getTransformMatrix(element) {
        try {
            // CTM (Current Transform Matrix) al
            return element.getCTM();
        } catch (error) {
            console.error('Transform matrisi hesaplama hatası:', error);
            // Boş matris döndür
            const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            return svg.createSVGMatrix();
        }
    }

    /**
     * Birden fazla elementten yeni bir grup kontrol kutusu oluştur
     * @param {Array} elements Seçili elementler
     */
    showGroupControls(elements) {
        if (!elements || elements.length === 0) return;

        // Önceki kontrolleri kaldır
        this.hideTransformControls();

        // Tüm elemanların BBox'larını birleştir
        let minX = Infinity,
            minY = Infinity;
        let maxX = -Infinity,
            maxY = -Infinity;

        elements.forEach(element => {
            try {
                //const bbox = element.getBBox();
                const ctm = element.getCTM();

                if (!bbox || !ctm) return;

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
            } catch (error) {
                console.error('Element sınırlarını hesaplama hatası:', error);
            }
        });

        // Grup kutusunun boyutları
        const width = maxX - minX;
        const height = maxY - minY;

        if (width <= 0 || height <= 0) return;

        // Geçici grup elementi
        const groupElement = document.createElementNS("http://www.w3.org/2000/svg", "g");
        groupElement.setAttribute('class', 'temporary-group');
        groupElement.setAttribute('transform', `translate(${minX}, ${minY})`);

        // Grup sınır kutusu
        const boundingBox = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        boundingBox.setAttribute('width', width);
        boundingBox.setAttribute('height', height);
        boundingBox.setAttribute('x', 0);
        boundingBox.setAttribute('y', 0);
        boundingBox.setAttribute('fill', 'transparent');
        boundingBox.setAttribute('stroke', '#4285f4');
        boundingBox.setAttribute('stroke-width', '1');
        boundingBox.setAttribute('stroke-dasharray', '5,5');

        groupElement.appendChild(boundingBox);

        // Geçici grubu canvas'a ekle
        this.canvas.appendChild(groupElement);

        // SubjX ile transform kontrollerini göster
        this.makeGroupTransformable(groupElement, elements);
    }

    /**
     * Çoklu seçim için özellikler panelini göster
     * @param {Array} elements Seçili elementler
     */
    showMultiSelectionProperties(elements) {
        if (!elements || elements.length === 0) return;

        const count = elements.length;
        let groupTypes = '';

        // Element tiplerini say
        const typeCount = {};
        elements.forEach(element => {
            let type = 'SVG Nesne';

            if ($(element).hasClass('svg-object-wrapper')) {
                type = $(element).data('object-name') || 'SVG Nesne';
            } else if ($(element).hasClass('svg-object-group')) {
                type = 'Grup';
            } else {
                const tagName = element.tagName.toLowerCase();
                switch (tagName) {
                    case 'rect':
                        type = 'Dikdörtgen';
                        break;
                    case 'circle':
                        type = 'Daire';
                        break;
                    case 'ellipse':
                        type = 'Elips';
                        break;
                    case 'line':
                        type = 'Çizgi';
                        break;
                    case 'text':
                        type = 'Metin';
                        break;
                    case 'g':
                        type = 'Grup';
                        break;
                }
            }

            typeCount[type] = (typeCount[type] || 0) + 1;
        });

        // Tip listesini oluştur
        for (const [type, count] of Object.entries(typeCount)) {
            groupTypes += `${type}: ${count}, `;
        }
        groupTypes = groupTypes.slice(0, -2); // Son virgül ve boşluğu kaldır

        // Grup özelliklerini panelde göster
        $('#properties-panel').html(`
            <div class="property-group">
                <h3>Çoklu Seçim Özellikleri</h3>
            </div>
            
            <div class="property-group">
                <label>Seçilen Nesne Sayısı:</label>
                <input type="text" disabled value="${count}">
            </div>
            
            <div class="property-group">
                <label>Nesne Tipleri:</label>
                <input type="text" disabled value="${groupTypes}">
            </div>
            
            <div class="property-group">
                <label>Grup İşlemleri:</label>
                <button id="group-selected" class="btn btn-primary">Grupla</button>
                <button id="ungroup-selected" class="btn btn-secondary">Grubu Dağıt</button>
            </div>
            
            <div class="property-group">
                <label>Hizalama:</label>
                <div class="align-buttons">
                    <button data-align="left" title="Sola Hizala"><i class="fas fa-align-left"></i></button>
                    <button data-align="center" title="Ortala"><i class="fas fa-align-center"></i></button>
                    <button data-align="right" title="Sağa Hizala"><i class="fas fa-align-right"></i></button>
                    <button data-align="top" title="Üste Hizala"><i class="fas fa-align-left fa-rotate-90"></i></button>
                    <button data-align="middle" title="Dikeyde Ortala"><i class="fas fa-align-center fa-rotate-90"></i></button>
                    <button data-align="bottom" title="Alta Hizala"><i class="fas fa-align-right fa-rotate-90"></i></button>
                </div>
            </div>
            
            <div class="property-group">
                <label>Katman İşlemleri:</label>
                <div class="layer-buttons">
                    <button id="bring-front" title="En Öne Getir"><i class="fas fa-level-up-alt"></i></button>
                    <button id="send-back" title="En Arkaya Gönder"><i class="fas fa-level-down-alt"></i></button>
                </div>
            </div>
        `);

        // Hizalama butonları olayları
        $('.align-buttons button').on('click', (e) => {
            const align = $(e.currentTarget).data('align');
            this.alignElements(elements, align);
        });

        // Katman butonları olayları
        $('#bring-front').on('click', () => {
            if (typeof selectionManager !== 'undefined' && typeof selectionManager.bringToFront === 'function') {
                selectionManager.bringToFront();
            }
        });

        $('#send-back').on('click', () => {
            if (typeof selectionManager !== 'undefined' && typeof selectionManager.sendToBack === 'function') {
                selectionManager.sendToBack();
            }
        });

        // Grup işlemleri butonları
        $('#group-selected').on('click', () => {
            if (typeof selectionManager !== 'undefined' && typeof selectionManager.groupSelectedElements === 'function') {
                selectionManager.groupSelectedElements();
            }
        });

        $('#ungroup-selected').on('click', () => {
            if (typeof selectionManager !== 'undefined' && typeof selectionManager.ungroupSelectedElements === 'function') {
                selectionManager.ungroupSelectedElements();
            }
        });
    }

    /**
     * Elementleri hizala
     * @param {Array} elements Hizalanacak elementler
     * @param {string} alignment Hizalama yönü (left, center, right, top, middle, bottom)
     */
    alignElements(elements, alignment) {
        if (!elements || elements.length <= 1) return;

        // Tüm elemanların BBox'larını hesapla
        const elementsWithBounds = elements.map(element => {
            const bbox = element.getBBox();
            const ctm = element.getCTM();

            // CTM ile köşe noktalarını transform et
            const tl = this.transformPoint(bbox.x, bbox.y, ctm);
            const br = this.transformPoint(bbox.x + bbox.width, bbox.y + bbox.height, ctm);

            return {
                element,
                bounds: {
                    left: tl.x,
                    top: tl.y,
                    right: br.x,
                    bottom: br.y,
                    width: br.x - tl.x,
                    height: br.y - tl.y,
                    centerX: (tl.x + br.x) / 2,
                    centerY: (tl.y + br.y) / 2
                }
            };
        });

        // Referans değerini hesapla
        let referenceValue = 0;

        switch (alignment) {
            case 'left':
                referenceValue = Math.min(...elementsWithBounds.map(e => e.bounds.left));
                break;
            case 'center':
                referenceValue = elementsWithBounds.reduce((sum, e) => sum + e.bounds.centerX, 0) / elementsWithBounds.length;
                break;
            case 'right':
                referenceValue = Math.max(...elementsWithBounds.map(e => e.bounds.right));
                break;
            case 'top':
                referenceValue = Math.min(...elementsWithBounds.map(e => e.bounds.top));
                break;
            case 'middle':
                referenceValue = elementsWithBounds.reduce((sum, e) => sum + e.bounds.centerY, 0) / elementsWithBounds.length;
                break;
            case 'bottom':
                referenceValue = Math.max(...elementsWithBounds.map(e => e.bounds.bottom));
                break;
        }

        // Her element için yeni pozisyonu hesapla ve uygula
        elementsWithBounds.forEach(item => {
            const { element, bounds } = item;
            const transform = element.getAttribute('transform') || '';
            const translateMatch = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);

            if (!translateMatch) return;

            let tx = parseFloat(translateMatch[1]);
            let ty = parseFloat(translateMatch[2]);

            // Yeni pozisyon hesapla
            switch (alignment) {
                case 'left':
                    tx += (referenceValue - bounds.left);
                    break;
                case 'center':
                    tx += (referenceValue - bounds.centerX);
                    break;
                case 'right':
                    tx += (referenceValue - bounds.right);
                    break;
                case 'top':
                    ty += (referenceValue - bounds.top);
                    break;
                case 'middle':
                    ty += (referenceValue - bounds.centerY);
                    break;
                case 'bottom':
                    ty += (referenceValue - bounds.bottom);
                    break;
            }

            // Transform özelliğini güncelle
            const newTransform = transform.replace(/translate\([^)]+\)/, `translate(${tx}, ${ty})`);
            element.setAttribute('transform', newTransform);
        });

        // Yeni grup kontrollerini göster
        this.showGroupControls(elements);
    }

    /**
     * Seçimi temizle
     */
    clearSelection() {
        // Aktif SubjX dönüştürücüyü kaldır
        this.hideTransformControls();

        // Geçici grup elementlerini temizle
        if (this.temporaryGroup && this.temporaryGroup.parentNode) {
            this.temporaryGroup.parentNode.removeChild(this.temporaryGroup);
            this.temporaryGroup = null;
        }

        // Seçili elementi ve elementleri sıfırla
        this.activeElement = null;
        this.selectedElements = [];
    }

    /**
     * Transform kontrollerini gizle
     */
    hideTransformControls() {
        // Aktif SubjX dönüştürücüyü kaldır
        if (this.draged) {
            try {
                this.draged.disable();
                this.draged = null;
            } catch (error) {
                console.error('SubjX dönüştürücü devre dışı bırakılırken hata:', error);
            }
        }

        // Sayfa üzerinde kalan tüm SubjX wrapper'larını da temizle
        document.querySelectorAll('.sjx-wrapper').forEach(el => el.remove());
        document.querySelectorAll('g.sjx-svg-wrapper').forEach(el => el.remove());
    }

    /**
     * Transform kontrollerini göster
     * @param {HTMLElement} element Seçilen element
     */
    showTransformControls(element) {
        if (!element) return;
        this.makeElementDraggable(element);
    }

    /**
     * Son transform değerlerini kaydet
     * @param {HTMLElement} element Dönüştürülen element
     */
    saveFinalTransform(element) {
        if (!element) return;

        // SubjX'in uyguladığı transform değerlerini SVG elementine kaydet
        const transform = element.getAttribute('transform');

        // SVG wrapper ise içindeki rect ve svg güncelle
        if ($(element).hasClass('svg-object-wrapper')) {
            const rect = $(element).find('rect.selection-handle');
            if (rect.length) {
                const bbox = element.getBBox();

                // Boyutları güncelle
                rect.attr('width', bbox.width);
                rect.attr('height', bbox.height);
            }
        }
    }

    /**
     * Kontrol pozisyonlarını güncelle
     */
    updateControlsPosition() {
        if (this.draged) {
            try {
                this.draged.refresh();
            } catch (error) {
                console.error('Transform kontrollerini güncellerken hata:', error);
            }
        }
    }

    /**
     * Özellikler panelini güncelle
     * @param {HTMLElement} element Dönüştürülen element
     */
    updatePropertiesPanel(element) {
        if (!element) return;

        const $el = $(element);

        try {
            // Transform bilgilerini al
            const ctm = element.getCTM();
            const bbox = element.getBBox();

            if (!ctm || !bbox) return;

            // Rotasyon açısını ayıkla
            let rotation = 0;
            const transform = $el.attr('transform') || '';
            const rotateMatch = transform.match(/rotate\(([^,)]+)/);
            if (rotateMatch) {
                rotation = parseFloat(rotateMatch[1]);
            }

            // SVG wrapper için stiller ve boyutlar
            let fill = '#000000';
            let stroke = '#000000';
            let strokeWidth = 1;
            let opacity = 1;

            if ($el.hasClass('svg-object-wrapper')) {
                // Stiller
                fill = $el.attr('fill') || '#000000';
                stroke = $el.attr('stroke') || '#000000';
                strokeWidth = $el.attr('stroke-width') || 1;
                opacity = $el.attr('opacity') || 1;

                // SVG boyutları
                const svg = $el.find('svg');
                if (svg.length) {
                    fill = svg.attr('fill') || fill;
                    stroke = svg.attr('stroke') || stroke;
                    strokeWidth = svg.attr('stroke-width') || strokeWidth;
                    opacity = svg.attr('opacity') || opacity;
                }
            } else {
                // Diğer SVG elementleri için doğrudan stil alımı
                fill = $el.attr('fill') || '#000000';
                stroke = $el.attr('stroke') || '#000000';
                strokeWidth = $el.attr('stroke-width') || 1;
                opacity = $el.attr('opacity') || 1;
            }

            // Nesne özelliklerini panelde göster
            $('#properties-panel').html(`
                <div class="property-group">
                    <h3>Nesne Özellikleri</h3>
                </div>
                
                <div class="property-group">
                    <label>Nesne Tipi:</label>
                    <input type="text" disabled value="${$el.data('object-name') || 'SVG Nesne'}">
                </div>
                
                <div class="property-group">
                    <label>Konum X:</label>
                    <input type="number" id="pos-x" value="${Math.round(ctm.e)}">
                </div>
                
                <div class="property-group">
                    <label>Konum Y:</label>
                    <input type="number" id="pos-y" value="${Math.round(ctm.f)}">
                </div>
                
                <div class="property-group">
                    <label>Genişlik:</label>
                    <input type="number" id="width" value="${Math.round(bbox.width)}">
                </div>
                
                <div class="property-group">
                    <label>Yükseklik:</label>
                    <input type="number" id="height" value="${Math.round(bbox.height)}">
                </div>
                
                <div class="property-group">
                    <label>Dolgu Rengi:</label>
                    <input type="color" id="fill-color" value="${this.rgbToHex(fill)}">
                </div>
                
                <div class="property-group">
                    <label>Çizgi Rengi:</label>
                    <input type="color" id="stroke-color" value="${this.rgbToHex(stroke)}">
                </div>
                
                <div class="property-group">
                    <label>Çizgi Kalınlığı:</label>
                    <input type="number" id="stroke-width" value="${strokeWidth}" min="0" max="10">
                </div>
                
                <div class="property-group">
                    <label>Opaklık:</label>
                    <input type="range" id="opacity" min="0" max="1" step="0.1" value="${opacity}">
                </div>
                
                <div class="property-group">
                    <label>Döndürme Açısı:</label>
                    <input type="number" id="rotation" value="${Math.round(rotation)}" min="0" max="360">
                </div>
            `);

            // Özellik değişikliği olaylarını ekle
            this.addPropertyChangeHandlers(element);
        } catch (error) {
            console.error('Özellikler paneli güncellenirken hata:', error);
        }
    }

    /**
     * Özellik değişikliği olaylarını ekle
     * @param {HTMLElement} element Değiştirilecek element
     */
    addPropertyChangeHandlers(element) {
        // Pozisyon değişikliği
        $('#pos-x, #pos-y').off('change').on('change', function() {
            if (!element) return;

            const posX = parseFloat($('#pos-x').val()) || 0;
            const posY = parseFloat($('#pos-y').val()) || 0;

            // Transform'u güncelle
            let transform = element.getAttribute('transform') || '';

            // Translate değerini güncelle
            if (transform.includes('translate')) {
                transform = transform.replace(/translate\([^)]+\)/, `translate(${posX}, ${posY})`);
            } else {
                transform = `translate(${posX}, ${posY}) ${transform}`;
            }

            element.setAttribute('transform', transform);

            // SubjX dönüştürücüyü güncelle
            if (this.draged) {
                this.draged.refresh();
            }
        });

        // Boyut değişikliği
        $('#width, #height').off('change').on('change', function() {
            if (!element) return;

            const width = parseFloat($('#width').val()) || 10;
            const height = parseFloat($('#height').val()) || 10;

            // SVG wrapper ise içindeki rect ve svg güncelle
            if ($(element).hasClass('svg-object-wrapper')) {
                const rect = $(element).find('rect.selection-handle');
                const svg = $(element).find('svg');

                if (rect.length) {
                    rect.attr('width', width);
                    rect.attr('height', height);
                }

                if (svg.length) {
                    svg.attr('width', width);
                    svg.attr('height', height);
                }
            }
            // Rect elementi ise doğrudan width/height güncelle
            else if (element.tagName.toLowerCase() === 'rect') {
                $(element).attr('width', width);
                $(element).attr('height', height);
            }

            // SubjX dönüştürücüyü güncelle
            if (this.draged) {
                this.draged.refresh();
            }
        });

        // Rotasyon değişikliği
        $('#rotation').off('change').on('change', function() {
            if (!element) return;

            const rotation = parseFloat($('#rotation').val()) || 0;

            // Element merkezi
            const bbox = element.getBBox();
            const centerX = bbox.x + bbox.width / 2;
            const centerY = bbox.y + bbox.height / 2;

            // Transform'u güncelle
            let transform = element.getAttribute('transform') || '';

            // Rotate değerini güncelle
            if (transform.includes('rotate')) {
                transform = transform.replace(/rotate\([^)]+\)/, `rotate(${rotation}, ${centerX}, ${centerY})`);
            } else {
                transform = `${transform} rotate(${rotation}, ${centerX}, ${centerY})`;
            }

            element.setAttribute('transform', transform);

            // SubjX dönüştürücüyü güncelle
            if (this.draged) {
                this.draged.refresh();
            }
        });

        // Stil değişiklikleri
        $('#fill-color').off('change').on('change', function() {
            if (!element) return;

            const fill = $(this).val();
            $(element).attr('fill', fill);

            // SVG wrapper ise içindeki svg'yi de güncelle
            if ($(element).hasClass('svg-object-wrapper')) {
                const svg = $(element).find('svg');
                if (svg.length) {
                    svg.attr('fill', fill);
                }
            }
        });

        $('#stroke-color').off('change').on('change', function() {
            if (!element) return;

            const stroke = $(this).val();
            $(element).attr('stroke', stroke);

            // SVG wrapper ise içindeki svg'yi de güncelle
            if ($(element).hasClass('svg-object-wrapper')) {
                const svg = $(element).find('svg');
                if (svg.length) {
                    svg.attr('stroke', stroke);
                }
            }
        });

        $('#stroke-width').off('change').on('change', function() {
            if (!element) return;

            const strokeWidth = $(this).val();
            $(element).attr('stroke-width', strokeWidth);

            // SVG wrapper ise içindeki svg'yi de güncelle
            if ($(element).hasClass('svg-object-wrapper')) {
                const svg = $(element).find('svg');
                if (svg.length) {
                    svg.attr('stroke-width', strokeWidth);
                }
            }
        });

        $('#opacity').off('change').on('change', function() {
            if (!element) return;

            const opacity = $(this).val();
            $(element).attr('opacity', opacity);

            // SVG wrapper ise içindeki svg'yi de güncelle
            if ($(element).hasClass('svg-object-wrapper')) {
                const svg = $(element).find('svg');
                if (svg.length) {
                    svg.attr('opacity', opacity);
                }
            }
        });
    }

    /**
     * RGB renk değerini HEX'e dönüştürme
     * @param {string} rgb RGB renk değeri
     * @returns {string} HEX renk değeri
     */
    rgbToHex(rgb) {
        if (!rgb) return '#000000';
        if (rgb.startsWith('#')) return rgb;

        const rgbValues = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
        if (!rgbValues) return rgb;

        function hex(x) {
            return ("0" + parseInt(x).toString(16)).slice(-2);
        }

        return "#" + hex(rgbValues[1]) + hex(rgbValues[2]) + hex(rgbValues[3]);
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
     * Elementi merkez alarak görünüme getir
     * @param {HTMLElement} element Hedef element
     */
    focusOnElement(element) {
        if (!element || !this.canvasContainer) return;

        // Element sınırlarını al
        const bbox = element.getBBox();
        const ctm = element.getCTM();

        // Canvas container merkezi
        const containerWidth = this.canvasContainer.clientWidth;
        const containerHeight = this.canvasContainer.clientHeight;

        // Scroll pozisyonunu hesapla
        const centerX = ctm.e + bbox.width / 2;
        const centerY = ctm.f + bbox.height / 2;

        // Scroll yap
        this.canvasContainer.scrollLeft = centerX * this.currentScale - containerWidth / 2;
        this.canvasContainer.scrollTop = centerY * this.currentScale - containerHeight / 2;
    }
}

// TransformHandler sınıfını örnekle
const transformHandler = new TransformHandler();

// Document hazır olduğunda başlat
$(document).ready(function() {
    // SubjX ile transform işleyicisini başlat
    console.log('Document hazır, transform işleyicisi başlatılıyor...');
    transformHandler.init();
});