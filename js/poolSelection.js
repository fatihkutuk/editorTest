$(document).ready(function() {
    // Global değişkenler
    let selectedPoolId = null;
    let selectedPoolName = "";
    let selectedPoolType = "";

    // Select2 başlatma
    $('#typename-filter').select2({
        placeholder: "Tüm havuz tiplerini göster",
        allowClear: true
    });

    // Havuz verilerini çeken fonksiyon
    function fetchPoolData() {
        // Loading göster
        $('#loading-indicator').show();
        $('#pool-list').hide();

        $.ajax({
            url: '/svcdevices/Keppoollist?sel=101',
            type: 'GET',
            dataType: 'json',
            success: function(data) {
                // Loading gizle
                $('#loading-indicator').hide();
                $('#pool-list').show();

                displayPoolData(data);
                populateTypeNameFilter(data);
            },
            error: function(error) {
                // Hata durumunda
                console.error('Veri çekme hatası:', error);
                $('#loading-indicator').hide();
                $('#pool-list').html('<div class="error">Veri yüklenirken bir hata oluştu. Lütfen sayfayı yenileyin.</div>').show();
            }
        });
    }

    // Havuz verilerini görüntüleme fonksiyonu
    function displayPoolData(data) {
        if (!data || data.length === 0) {
            $('#pool-list').html('<div class="no-data">Havuz verisi bulunamadı.</div>');
            return;
        }

        let poolListHtml = '';

        // Her havuz için liste öğesi oluştur
        data.forEach(function(pool) {
            poolListHtml += `
                <div class="pool-item" data-id="${pool.id}" data-type="${pool.typeName}" data-name="${pool.description}">
                    <div class="pool-name">${pool.description}</div>
                    <div class="pool-type">${pool.typeName}</div>
                </div>
            `;
        });

        $('#pool-list').html(poolListHtml);

        // Havuz öğelerine tıklama olayı ekle
        $('.pool-item').on('click', function() {
            // Seçim vurgusunu güncelle
            $('.pool-item').removeClass('selected');
            $(this).addClass('selected');

            // Seçilen havuz bilgilerini kaydet
            selectedPoolId = $(this).data('id');
            selectedPoolName = $(this).data('name');
            selectedPoolType = $(this).data('type');

            // Devam butonunu etkinleştir
            $('#continue-btn').prop('disabled', false);
        });
    }

    // TypeName filtresi için seçenekleri doldur
    function populateTypeNameFilter(data) {
        if (!data || data.length === 0) return;

        // Benzersiz typeName değerlerini topla
        const typeNames = [...new Set(data.map(pool => pool.typeName))];

        // Select2 için seçenekleri oluştur
        let options = '<option value="">Tüm Tipler</option>';
        typeNames.forEach(function(typeName) {
            options += `<option value="${typeName}">${typeName}</option>`;
        });

        // Select2'yi güncelle
        $('#typename-filter').html(options).trigger('change');

        // TypeName filtresine değişiklik olayı ekle
        $('#typename-filter').on('change', function() {
            const selectedType = $(this).val();
            filterPoolsByType(selectedType);
        });
    }

    // TypeName'e göre havuzları filtrele
    function filterPoolsByType(typeName) {
        if (!typeName) {
            // Filtre temizlendiyse tüm öğeleri göster
            $('.pool-item').show();
            return;
        }

        // TypeName eşleşmesine göre filtrele
        $('.pool-item').each(function() {
            const itemType = $(this).data('type');
            if (itemType === typeName) {
                $(this).show();
            } else {
                $(this).hide();
            }
        });
    }

    // Devam butonuna tıklama olayı
    $('#continue-btn').on('click', function() {
        if (selectedPoolId) {
            // Seçilen havuz bilgilerini local storage'a kaydet
            localStorage.setItem('selectedPoolId', selectedPoolId);
            localStorage.setItem('selectedPoolName', selectedPoolName);
            localStorage.setItem('selectedPoolType', selectedPoolType);

            // Template oluşturma sayfasına yönlendir
            window.location.href = '/editor/template';
        }
    });

    // Sayfa başlatma
    fetchPoolData();
});