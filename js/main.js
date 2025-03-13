$(document).ready(function() {
    // Mode seçim kutularına tıklama olayını dinle
    $('.mode-box').on('click', function() {
        // Tüm kutuların seçim sınıfını kaldır
        $('.mode-box').removeClass('selected');

        // Tıklanan kutuya seçim sınıfını ekle
        $(this).addClass('selected');

        // Hangi modun seçildiğini belirle
        const selectedMode = $(this).attr('id');

        // Seçilen moda göre yönlendirme yap (şimdilik konsola yazdır)
        console.log('Seçilen mod:', selectedMode);

        // 1 saniye sonra yönlendirme yap
        setTimeout(function() {
            if (selectedMode === 'template-mode') {
                // Havuz seçimi sayfasına yönlendir
                localStorage.setItem('redirectFromMain', 'true');
                window.location.href = '/editor/poolSelection';
            } else if (selectedMode === 'multiple-node-mode') {
                // Çoklu düğüm moduna yönlendir (ileride kullanılacak)
                // window.location.href = '/editor/multipleNode.html';
                alert('Multiple Node Screen moduna yönlendiriliyorsunuz...');
            }
        }, 1000);
    });
});