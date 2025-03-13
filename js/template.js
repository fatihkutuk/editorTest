$(document).ready(function() {
    // Havuz bilgilerini yükleme
    const selectedPoolId = localStorage.getItem('selectedPoolId');
    const selectedPoolName = localStorage.getItem('selectedPoolName');
    const selectedPoolType = localStorage.getItem('selectedPoolType');

    // Global değişkenler
    let activeTool = 'select';
    let selectedElement = null;

    // Havuz bilgilerini göster
    if (selectedPoolName) {
        $('#selected-pool-name').text(selectedPoolName);
    } else {
        // Havuz seçilmemişse geri yönlendir
        // window.location.href = '/editor/poolSelection.html';
    }

    // Araç butonlarını dinle
    $('.tool-btn').on('click', function() {
        // Önceki aktif sınıfını kaldır
        $('.tool-btn').removeClass('active');
        // Yeni tıklanan butona aktif sınıfı ekle
        $(this).addClass('active');
        // Aktif aracı güncelle
        activeTool = $(this).data('tool');

        // Özel araç işlemleri
        if (activeTool === 'group' && typeof selectionManager !== 'undefined') {
            // Grup aracı seçildiğinde gruplandırma işlemi yap
            selectionManager.groupSelectedElements();
            // Sonra seçim aracına dön
            activeTool = 'select';
            $('.tool-btn[data-tool="select"]').addClass('active');
        } else if (activeTool === 'ungroup' && typeof selectionManager !== 'undefined') {
            // Grup dağıtma aracı seçildiğinde grup dağıtma işlemi yap
            selectionManager.ungroupSelectedElements();
            // Sonra seçim aracına dön
            activeTool = 'select';
            $('.tool-btn[data-tool="select"]').addClass('active');
        } else if (activeTool === 'bring-front' && typeof selectionManager !== 'undefined') {
            // Öne getirme aracı seçildiğinde öne getirme işlemi yap
            selectionManager.bringToFront();
            // Sonra seçim aracına dön
            activeTool = 'select';
            $('.tool-btn[data-tool="select"]').addClass('active');
        } else if (activeTool === 'send-back' && typeof selectionManager !== 'undefined') {
            // Arkaya gönderme aracı seçildiğinde arkaya gönderme işlemi yap
            selectionManager.sendToBack();
            // Sonra seçim aracına dön
            activeTool = 'select';
            $('.tool-btn[data-tool="select"]').addClass('active');
        }

        console.log('Aktif araç:', activeTool);
    });

    // İlk yükleme için select aracını aktif yap
    $('.tool-btn[data-tool="select"]').addClass('active');

    // Havuz detaylarını yükleme
    function loadPoolDetails() {
        if (!selectedPoolId) return;

        // Havuz tag'lerini yükle
        // $.ajax({
        //     url: `/editor/Keppooldetails?id=${selectedPoolId}`,
        //     type: 'GET',
        //     dataType: 'json',
        //     success: function(data) {
        //         console.log('Havuz detayları yüklendi:', data);
        //         if (data && data.allTagJsons) {
        //             try {
        //                 poolTags = JSON.parse(data.allTagJsons);
        //                 console.log('Havuz tag\'leri:', poolTags);
        //             } catch (e) {
        //                 console.error('Tag parsing hatası:', e);
        //             }
        //         }
        //     },
        //     error: function(error) {
        //         console.error('Havuz detayları yüklenirken hata:', error);
        //         // Hata durumunda demo amaçlı devam et
        //     }
        // });
    }

    // SVG nesnelerini JSON'dan yükleme
    let svgObjectsData = null;
    let currentCategory = 'all';

    function loadSvgObjects() {
        $.ajax({
            url: '/app/views/editor/svgObjects.json',
            type: 'GET',
            dataType: 'json',
            success: function(data) {
                svgObjectsData = data;
                populateCategories(data.categories);
                populateSvgGallery('all');
            },
            error: function(error) {
                console.error('SVG objeleri yüklenirken hata:', error);
                $('#svg-gallery').html('<div class="error">SVG objeleri yüklenirken bir hata oluştu.</div>');

                // Hata durumunda demo kategorileri oluştur
                const demoCategories = [
                    { id: 'sensor', name: 'Sensörler' },
                    { id: 'valve', name: 'Vanalar' },
                    { id: 'pump', name: 'Pompalar' },
                    { id: 'tank', name: 'Tanklar' },
                    { id: 'pipe', name: 'Borular' }
                ];
                populateCategories(demoCategories);
            }
        });
    }

    // Kategorileri listeleme
    function populateCategories(categories) {
        let categoriesHtml = `
            <div class="category-item active" data-category="all">
                <i class="fas fa-th-large"></i>
                <span>Tümü</span>
            </div>
        `;

        categories.forEach(function(category) {
            categoriesHtml += `
                <div class="category-item" data-category="${category.id}">
                    <i class="fas fa-folder"></i>
                    <span>${category.name}</span>
                </div>
            `;
        });

        $('#svg-categories').html(categoriesHtml);

        // Kategori öğelerine tıklama olayı ekle
        $('.category-item').on('click', function() {
            $('.category-item').removeClass('active');
            $(this).addClass('active');

            currentCategory = $(this).data('category');
            populateSvgGallery(currentCategory);
        });
    }

    // SVG galerisini doldurma
    function populateSvgGallery(categoryId) {
        $('#svg-gallery').html('<div class="loading-objects">Yükleniyor...</div>');

        // Demo modunda veya verilerin olmaması durumunda
        if (!svgObjectsData) {
            // Demo SVG objelerini oluştur
            const demoObjects = [];
            for (let i = 1; i <= 10; i++) {
                demoObjects.push({
                    id: i,
                    name: `Demo Obje ${i}`,
                    file: `${i}.svg`,
                    properties: {
                        width: 80,
                        height: 80,
                        fill: "#e8f4ff",
                        stroke: "#0066cc",
                        "stroke-width": 1.5
                    }
                });
            }

            displaySVGGalleryObjects(demoObjects);
            return;
        }

        // SVG objelerini getir
        let objects = [];

        if (categoryId === 'all') {
            // Tüm kategorilerdeki objeleri birleştir
            svgObjectsData.categories.forEach(function(category) {
                objects = objects.concat(category.objects);
            });
        } else {
            // Seçilen kategorideki objeleri bul
            const category = svgObjectsData.categories.find(c => c.id === categoryId);
            if (category) {
                objects = category.objects;
            }
        }

        displaySVGGalleryObjects(objects);
    }

    // SVG galeri objelerini görüntüle
    function displaySVGGalleryObjects(objects) {
        if (objects.length === 0) {
            $('#svg-gallery').html('<div class="no-objects">Bu kategoride obje bulunamadı.</div>');
            return;
        }

        let galleryHtml = '';

        // Her obje için önizleme oluştur, belli bir limite kadar göster
        const maxDisplay = 20; // Bir sayfada gösterilecek maksimum nesne sayısı
        const displayObjects = objects.slice(0, maxDisplay);

        displayObjects.forEach(function(obj) {
            galleryHtml += `
                <div class="svg-gallery-item" data-object-id="${obj.id}" data-file="${obj.file}">
                    <div class="svg-preview">
                        <img src="/app/views/editor/svgObjects/${obj.file}" alt="${obj.name}" title="${obj.name}" />
                    </div>
                    <div class="svg-name">${obj.name}</div>
                </div>
            `;
        });

        // Daha fazla nesne varsa, bilgilendirme mesajı ekle
        if (objects.length > maxDisplay) {
            galleryHtml += `
                <div class="more-objects-info">
                    +${objects.length - maxDisplay} nesne daha...
                </div>
            `;
        }

        $('#svg-gallery').html(galleryHtml);

        // SVG önizleme öğelerine tıklama olayı ekle
        $('.svg-gallery-item').on('click', function() {
            const objectId = $(this).data('object-id');
            const objectFile = $(this).data('file');

            // Nesne verilerini bul
            let selectedObject = null;
            if (svgObjectsData) {
                svgObjectsData.categories.forEach(function(category) {
                    const foundObj = category.objects.find(obj => obj.id === objectId);
                    if (foundObj) selectedObject = foundObj;
                });
            } else {
                // Demo modunda
                selectedObject = {
                    id: objectId,
                    name: `Demo Obje ${objectId}`,
                    file: objectFile,
                    properties: {
                        width: 80,
                        height: 80,
                        fill: "#e8f4ff",
                        stroke: "#0066cc",
                        "stroke-width": 1.5
                    }
                };
            }

            if (selectedObject) {
                addSvgObjectToCanvas(selectedObject);
            }
        });
    }
    // template.js içinde
    $(document).ready(function() {
        // Araç butonlarını dinle
        $('.tool-btn').on('click', function() {
            // Önceki aktif sınıfını kaldır
            $('.tool-btn').removeClass('active');
            // Yeni tıklanan butona aktif sınıfı ekle
            $(this).addClass('active');
            // Aktif aracı güncelle
            activeTool = $(this).data('tool');

            // Her araç için özel işlem ekle
            switch (activeTool) {
                case 'rectangle':
                    initRectangleTool();
                    break;
                case 'circle':
                    initCircleTool();
                    break;
                case 'ellipse':
                    initEllipseTool();
                    break;
                case 'line':
                    initLineTool();
                    break;
                case 'path':
                    initPathTool();
                    break;
                case 'polygon':
                    initPolygonTool();
                    break;
                case 'text':
                    initTextTool();
                    break;
                    // Diğer araçlar...
            }

            console.log('Aktif araç:', activeTool);
        });

        // Her çizim aracı için fonksiyonlar ekle
        function initRectangleTool() {
            // Dikdörtgen çizim aracı aktifleştirme
        }

        function initCircleTool() {
            // Daire çizim aracı aktifleştirme
        }

        // Diğer araçlar...
    });
    // SVG nesnesini canvas'a ekleme
    function addSvgObjectToCanvas(objectData) {
        // Yükleme göstergesi
        $('#loading-indicator').show();

        // SVG dosyasını yükle
        $.ajax({
            url: `/app/views/editor/svgObjects/${objectData.file}`,
            type: 'GET',
            dataType: 'text',
            success: function(svgContent) {
                try {
                    const parser = new DOMParser();
                    const svgDoc = parser.parseFromString(svgContent, "image/svg+xml");

                    // Parsing hatası kontrolü
                    const parserError = svgDoc.querySelector("parsererror");
                    if (parserError) {
                        console.error("SVG parsing error", parserError);
                        createDemoSvgObject(objectData);
                        $('#loading-indicator').hide();
                        return;
                    }

                    const svgElement = svgDoc.documentElement;

                    // Ana SVG grup elementi oluştur:
                    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
                    group.setAttribute('class', 'svg-object-wrapper');
                    group.setAttribute('data-object-id', objectData.id);
                    group.setAttribute('data-object-name', objectData.name || 'SVG Obje');

                    // Canvas merkezi hesaplama:
                    const canvas = document.getElementById('editor-canvas');
                    const canvasRect = canvas.getBoundingClientRect();
                    const centerX = canvasRect.width / 2 - 40;
                    const centerY = canvasRect.height / 2 - 40;
                    group.setAttribute('transform', `translate(${centerX}, ${centerY})`);

                    // Seçim için görünmez rect:
                    const selectionRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                    selectionRect.setAttribute('class', 'selection-handle');
                    selectionRect.setAttribute('width', 80);
                    selectionRect.setAttribute('height', 80);
                    selectionRect.setAttribute('fill', 'transparent');
                    selectionRect.setAttribute('stroke', 'transparent');
                    selectionRect.setAttribute('stroke-width', '1');
                    selectionRect.setAttribute('pointer-events', 'all');

                    // SVG içeriğini kopyala:
                    const svgContainer = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                    svgContainer.setAttribute('width', 80);
                    svgContainer.setAttribute('height', 80);
                    const viewBox = svgElement.getAttribute('viewBox') || '0 0 100 100';
                    svgContainer.setAttribute('viewBox', viewBox);
                    svgContainer.setAttribute('preserveAspectRatio', 'xMidYMid meet');

                    // SVG'nin orijinal stili (CSS)
                    if (svgElement.hasAttribute('style')) {
                        svgContainer.setAttribute('style', svgElement.getAttribute('style'));
                    }

                    // Çocuk node'ları kopyala - ÖNEMLİ: SVG içindeki renkler/stiller korunmalı
                    Array.from(svgElement.childNodes).forEach(node => {
                        const clonedNode = node.cloneNode(true);
                        svgContainer.appendChild(clonedNode);
                    });

                    // Kopyalanacak diğer attribute'lar:
                    Array.from(svgElement.attributes).forEach(attr => {
                        if (!['width', 'height', 'xmlns'].includes(attr.name)) {
                            svgContainer.setAttribute(attr.name, attr.value);
                        }
                    });

                    // objectData.properties'ten gelen renk/stil özelliklerini SVG'ye UYGULAMIYORUZ
                    // Bu, orijinal renkleri korumamızı sağlar

                    // Elemanları gruba ekle
                    group.appendChild(selectionRect);
                    group.appendChild(svgContainer);

                    // Canvas'a ekle
                    canvas.appendChild(group);

                    // Nesne listesini güncelle
                    updateObjectsList();

                    // Yeni elementi SubjX ile seçilebilir hale getir
                    if (typeof transformHandler !== 'undefined') {
                        // SubjX ile seçim
                        setTimeout(function() {
                            transformHandler.clearSelection();
                            transformHandler.makeElementDraggable(group);
                        }, 100);
                    } else if (typeof selectionManager !== 'undefined') {
                        // Eski seçim yöntemi (kullanılıyorsa)
                        selectionManager.clearSelection();
                        selectionManager.addToSelection(group);
                    }

                    // Yükleme göstergesini gizle
                    $('#loading-indicator').hide();

                } catch (error) {
                    console.error('SVG işleme hatası:', error);
                    createDemoSvgObject(objectData);
                    $('#loading-indicator').hide();
                }
            },
            error: function(error) {
                console.error('SVG dosyası yüklenirken hata:', error);
                createDemoSvgObject(objectData);
                $('#loading-indicator').hide();
            }
        });
    }
    // Demo SVG Obje oluşturma yardımcı fonksiyonu - iyileştirilmiş
    function createDemoSvgObject(objectData) {
        try {
            const canvas = document.getElementById('editor-canvas');

            // Ana grup elementi oluştur
            const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
            group.setAttribute('class', 'svg-object-wrapper');
            group.setAttribute('data-object-id', objectData.id);
            group.setAttribute('data-object-name', objectData.name || 'Demo Obje');

            // Canvas merkezi
            const canvasRect = canvas.getBoundingClientRect();
            const centerX = canvasRect.width / 2 - 40;
            const centerY = canvasRect.height / 2 - 40;

            // Grup pozisyonunu ayarla
            group.setAttribute('transform', `translate(${centerX}, ${centerY})`);

            // Seçim için görünmez rect
            const selectionRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            selectionRect.setAttribute('class', 'selection-handle');
            selectionRect.setAttribute('width', 80);
            selectionRect.setAttribute('height', 80);
            selectionRect.setAttribute('fill', 'transparent');
            selectionRect.setAttribute('stroke', 'transparent');
            selectionRect.setAttribute('stroke-width', '1');
            selectionRect.setAttribute('pointer-events', 'all');

            // Demo obje için basit bir SVG
            const svgContainer = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            svgContainer.setAttribute('width', 80);
            svgContainer.setAttribute('height', 80);
            svgContainer.setAttribute('viewBox', '0 0 100 100');

            // Demo içerik - dikdörtgen ve etiket
            const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            rect.setAttribute('x', 10);
            rect.setAttribute('y', 10);
            rect.setAttribute('width', 80);
            rect.setAttribute('height', 80);
            rect.setAttribute('fill', objectData.properties && objectData.properties.fill ? objectData.properties.fill : '#cccccc');
            rect.setAttribute('stroke', objectData.properties && objectData.properties.stroke ? objectData.properties.stroke : '#333333');
            rect.setAttribute('stroke-width', objectData.properties && objectData.properties['stroke-width'] ? objectData.properties['stroke-width'] : '2');

            const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
            text.setAttribute('x', 50);
            text.setAttribute('y', 55);
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('font-size', '12');
            text.setAttribute('fill', '#000000');
            text.textContent = objectData.name || 'Demo';

            svgContainer.appendChild(rect);
            svgContainer.appendChild(text);

            // Elemanları gruba ekle
            group.appendChild(selectionRect);
            group.appendChild(svgContainer);

            // Canvas'a ekle
            canvas.appendChild(group);

            // Nesne listesini güncelle
            updateObjectsList();

            // Yeni elementi SubjX ile seçilebilir hale getir
            if (typeof transformHandler !== 'undefined') {
                setTimeout(function() {
                    transformHandler.clearSelection();
                    transformHandler.makeElementDraggable(group);
                }, 100);
            } else if (typeof selectionManager !== 'undefined') {
                selectionManager.clearSelection();
                selectionManager.addToSelection(group);
            }
        } catch (error) {
            console.error('Demo SVG oluşturma hatası:', error);
        }
    }


    // Demo SVG Obje oluşturma yardımcı fonksiyonu
    function createDemoSvgObject(objectData) {
        const canvas = document.getElementById('editor-canvas');

        // Ana grup elementi oluştur
        const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
        group.setAttribute('class', 'svg-object-wrapper');
        group.setAttribute('data-object-id', objectData.id);
        group.setAttribute('data-object-name', objectData.name || 'Demo Obje');

        // Canvas merkezi
        const canvasRect = canvas.getBoundingClientRect();
        const centerX = canvasRect.width / 2 - 40;
        const centerY = canvasRect.height / 2 - 40;

        // Grup pozisyonunu ayarla
        group.setAttribute('transform', `translate(${centerX}, ${centerY})`);

        // Seçim için görünmez rect
        const selectionRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        selectionRect.setAttribute('class', 'selection-handle');
        selectionRect.setAttribute('width', 80);
        selectionRect.setAttribute('height', 80);
        selectionRect.setAttribute('fill', 'transparent');
        selectionRect.setAttribute('stroke', 'transparent');
        selectionRect.setAttribute('stroke-width', '1');
        selectionRect.setAttribute('pointer-events', 'all');

        // Demo obje için basit bir SVG
        const svgContainer = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svgContainer.setAttribute('width', 80);
        svgContainer.setAttribute('height', 80);
        svgContainer.setAttribute('viewBox', '0 0 100 100');

        // Demo içerik - dikdörtgen ve etiket
        const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        rect.setAttribute('x', 10);
        rect.setAttribute('y', 10);
        rect.setAttribute('width', 80);
        rect.setAttribute('height', 80);
        rect.setAttribute('fill', objectData.properties && objectData.properties.fill ? objectData.properties.fill : '#cccccc');
        rect.setAttribute('stroke', objectData.properties && objectData.properties.stroke ? objectData.properties.stroke : '#333333');
        rect.setAttribute('stroke-width', objectData.properties && objectData.properties['stroke-width'] ? objectData.properties['stroke-width'] : '2');

        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute('x', 50);
        text.setAttribute('y', 55);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('font-size', '12');
        text.setAttribute('fill', '#000000');
        text.textContent = objectData.name || 'Demo';

        svgContainer.appendChild(rect);
        svgContainer.appendChild(text);

        // Elemanları gruba ekle
        group.appendChild(selectionRect);
        group.appendChild(svgContainer);

        // Canvas'a ekle
        canvas.appendChild(group);

        // Nesne listesini güncelle
        updateObjectsList();

        // Seçimi temizle ve yeni nesneyi seç
        if (typeof selectionManager !== 'undefined') {
            selectionManager.clearSelection();
            selectionManager.addToSelection(group);

            // Transform kontrollerini göster
            if (typeof transformHandler !== 'undefined') {
                transformHandler.showTransformControls(group);
            }
        }
    }
    // SVG içeriğini canvas'a ekle
    function addSvgContentToCanvas(svgContent, objectData) {
        try {
            // SVG içeriğini ayrıştır
            const parser = new DOMParser();
            const svgDoc = parser.parseFromString(svgContent, "image/svg+xml");

            // Hatalı ayrıştırma kontrolü
            const parserError = svgDoc.querySelector("parsererror");
            if (parserError) {
                throw new Error("SVG parsing error");
            }

            const svgElement = svgDoc.documentElement;

            // Standart boyut
            const standardWidth = 80;
            const standardHeight = 80;

            // Orijinal viewBox'ı al
            const originalViewBox = svgElement.getAttribute('viewBox');

            // Tüm SVG içeriğini bir yabancı nesne içine yerleştir
            const foreignObject = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
            foreignObject.setAttribute('width', standardWidth);
            foreignObject.setAttribute('height', standardHeight);

            // SVG içeriğini bir div içine al
            const div = document.createElement('div');
            div.style.width = '100%';
            div.style.height = '100%';
            div.style.pointerEvents = 'none'; // Tıklama olaylarını geçir
            div.innerHTML = svgContent;

            foreignObject.appendChild(div);

            // Ana konteyner grup oluştur (tüm SVG'yi tek parça olarak ele almak için)
            const wrapper = document.createElementNS("http://www.w3.org/2000/svg", "g");
            wrapper.setAttribute('class', 'svg-object-wrapper');
            wrapper.setAttribute('data-object-id', objectData.id);
            wrapper.setAttribute('data-object-name', objectData.name || 'SVG Obje');

            // Canvas merkezi
            const canvas = document.getElementById('editor-canvas');
            const canvasRect = canvas.getBoundingClientRect();
            const centerX = canvasRect.width / 2 - standardWidth / 2;
            const centerY = canvasRect.height / 2 - standardHeight / 2;

            // Wrapper pozisyonu
            wrapper.setAttribute('transform', `translate(${centerX}, ${centerY})`);

            // Seçim ve taşıma için görünmez rect
            const selectionRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            selectionRect.setAttribute('width', standardWidth);
            selectionRect.setAttribute('height', standardHeight);
            selectionRect.setAttribute('fill', 'transparent');
            selectionRect.setAttribute('stroke', 'transparent');
            selectionRect.setAttribute('stroke-width', '1');
            selectionRect.setAttribute('class', 'selection-handle');

            // SVG içeriğini ekle
            wrapper.appendChild(selectionRect);

            // SVG içeriğini wrapper içine yerleştir
            if (objectData.properties) {
                for (const [key, value] of Object.entries(objectData.properties)) {
                    if (key !== 'width' && key !== 'height' && key !== 'x' && key !== 'y') {
                        wrapper.setAttribute(key, value);
                    }
                }
            }

            // SVG içeriği ekle
            const svgClone = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            svgClone.setAttribute('width', standardWidth);
            svgClone.setAttribute('height', standardHeight);
            svgClone.setAttribute('viewBox', originalViewBox || '0 0 100 100');
            svgClone.setAttribute('preserveAspectRatio', 'xMidYMid meet');

            // İçeriği kopyala
            while (svgElement.firstChild) {
                svgClone.appendChild(svgElement.firstChild.cloneNode(true));
            }

            // Wrapper'a ekle
            wrapper.appendChild(svgClone);

            // Canvas'a ekle
            canvas.appendChild(wrapper);

            // Nesne listesini güncelle
            updateObjectsList();

            // Seçimi temizle ve yeni nesneyi seç
            if (typeof selectionManager !== 'undefined') {
                selectionManager.clearSelection();
                selectionManager.addToSelection(wrapper);

                // Transform kontrollerini göster
                if (typeof transformHandler !== 'undefined') {
                    transformHandler.showTransformControls(wrapper);
                }
            }

            // Seçim aracına geç
            activeTool = 'select';
            $('.tool-btn').removeClass('active');
            $('.tool-btn[data-tool="select"]').addClass('active');

        } catch (error) {
            console.error("SVG yükleme hatası:", error);
            alert("SVG nesnesi yüklenirken bir hata oluştu!");
        }
    }

    // Nesne listesini güncelleme
    function updateObjectsList() {
        const objects = $('#editor-canvas').children();
        let objectsList = '';

        objects.each(function(index) {
            const tagName = this.tagName.toLowerCase();
            let icon, name;

            if ($(this).hasClass('svg-object-wrapper')) {
                icon = 'fa-puzzle-piece';
                name = $(this).data('object-name') || 'SVG Obje';
            } else if ($(this).hasClass('svg-object-group')) {
                icon = 'fa-object-group';
                name = 'Grup';
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
            const element = $('#editor-canvas').children()[index];

            // Shift tuşu basılı değilse mevcut seçimi temizle
            if (!event.shiftKey && typeof selectionManager !== 'undefined') {
                selectionManager.clearSelection();
            }

            // Seçilen elemanı selectionManager ile seç
            if (typeof selectionManager !== 'undefined') {
                selectionManager.addToSelection(element);

                // Eğer tek bir element seçildiyse transform kontrollerini göster
                if (selectionManager.selectedElements.length === 1) {
                    transformHandler.showTransformControls(element);
                }
            } else {
                // Eski yöntemle seçim (selectionManager yoksa)
                clearSelection();
                selectedElement = element;

                if ($(selectedElement).hasClass('svg-object-wrapper')) {
                    $(selectedElement).attr('data-selected', 'true');
                    $(selectedElement).find('rect:first').attr('stroke-dasharray', '5,5').attr('stroke', '#4285f4');
                } else {
                    $(selectedElement).attr('stroke-dasharray', '5,5').attr('data-selected', 'true');
                }

                updatePropertiesPanel();
                $('#no-selection-message').hide();
                $('#properties-panel').show();
            }

            // Nesne listesinde seçimi güncelle
            $('.object-item').removeClass('selected');
            $(this).addClass('selected');
        });
    }

    // Seçimi temizleme
    function clearSelection() {
        if (selectedElement) {
            if ($(selectedElement).hasClass('svg-object-wrapper')) {
                $(selectedElement).removeAttr('data-selected');
                $(selectedElement).find('rect:first').attr('stroke', 'transparent').removeAttr('stroke-dasharray');
            } else {
                $(selectedElement).removeAttr('stroke-dasharray').removeAttr('data-selected');
            }
            selectedElement = null;
        }
    }

    // Geri butonu işlemi
    $('#back-btn').on('click', function() {
        window.location.href = '/app/views/editor/poolSelection';
    });

    // Kaydet butonu işlemi
    $('#save-btn').on('click', function() {
        const svgContent = $('#editor-canvas')[0].outerHTML;
        console.log('SVG içeriği kaydediliyor...');

        // Demo amaçlı olarak başarılı kaydetme mesajı göster
        alert('SVG içeriği başarıyla kaydedildi!');
    });

    // Başlangıç
    function init() {
        // Havuz detaylarını yükle
        loadPoolDetails();

        // SVG Objelerini yükle
        loadSvgObjects();

        // İlk yüklemeyi yap
        updateObjectsList();
    }

    // Uygulamayı başlat
    init();
});