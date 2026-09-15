# 0.3 geliştirme notları

Bu tur, yeni mekanik eklemekten çok mevcut oyunun güvenilirliğini ve okunabilirliğini geliştirdi.

## İncelenen oyuncu yorumları

Aşağıdaki yorumlar küçük bir nitel örneklemdir; pazarın tamamını temsil etmez. Sayfa değerlendirmeleri öznel görüşlerdir.

| Oyun | Yorumlarda görülen beklenti | TIDEGLASS'taki karar |
| --- | --- | --- |
| Two Dots | Sakin estetik beğeniliyor; yoğun menüler, popuplar ve öngörülemez zorluk bazı oyuncuları uzaklaştırıyor. | Yeni özellik kalabalığı eklenmedi. Taşma riski hamle bırakılmadan gösteriliyor. |
| I Love Hue | Renk düzeni ve rahatlatıcı deneyim övülüyor. | Renk kimliği korundu; semboller büyütüldü, hareket azaltma ayarı canvas üzerinde de uygulandı. |
| Block Blast | Bazı yorumlar tema seçiminin korunmasını istiyor. | Seçilen palet kalıcı kaldı ve menüye renk önizlemeleri eklendi. |

Kaynaklar: [Two Dots App Store yorumları](https://apps.apple.com/pl/app/two-dots-connect-the-colours/id880178264?platform=ipad&see-all=reviews), [I Love Hue App Store yorumları](https://apps.apple.com/nz/app/i-love-hue/id1081075274?platform=iphone&see-all=reviews), [Block Blast Google Play yorumları](https://play.google.com/store/apps/details?hl=en&id=com.block.juggle).

## Düzeltilen sorunlar

- Aktif sefer yenilemede kayboluyordu. Şimdi doğrulanmış tahta, hedef ve rastgele üretim durumu geri yükleniyor.
- Sayfadan ayrılmak seferi erken tamamlanmış sayabiliyordu. Tamamlanan/terk edilen sefer yalnızca bir kez sayılıyor.
- Kaybedilen hamlede tamamlanan hedefin 300 puanı gösterilip eklenmeyebiliyordu.
- Sonuç animasyonu bitmeden sayfa kapanırsa puan kaybolabiliyordu.
- Kapalı halka seçiliyken klavyeyle Dalgakıran kullanımı seçim durumunu açık bırakabiliyordu.
- İkinci parmağın iptal olayı aktif parmağın zincirini bozabiliyordu.
- Kaya bonusu puan önizlemesinde görünmüyordu.
- Hareketsiz menü ve duraklatma ekranında arka plan sürekli çiziliyordu.
- Hareket azaltma tercihi canvas su ve kristal hareketlerini tamamen kapsamıyordu.
- Halka aramasına sınırlı işlem bütçesi eklendi; ipucu aramasının uzun sürmesi önlendi.

## Görsel değişiklikler

Daha okunur HUD, kristallerde belirgin şekiller, palet önizlemeleri, daha büyük dokunma hedefleri, dar ekranlarda taşmayı azaltan metin düzeni ve kısa yatay ekranlarda yan yana yerleşim eklendi. Bunlar kaynakta uygulanmış değişikliklerdir; gerçek cihaz görsel kontrolü henüz tamamlanmadı.

## Testler

Testler: mevcut kurallar ve giriş senaryoları, 80 farklı sefer kaydında kayıttan sonra birebir aynı rastgele üretim, bozuk kayıt reddi, tekrarsız sefer sayımı, ölüm hamlesinde hedef ödülü, ikinci parmak iptali, taşma önizlemesi ve menü/duraklatma çizim sayısı kontrolleri. Test sayıları insanlarla oynanabilirlik değerlendirmesinin yerine geçmez.
