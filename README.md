# TIDEGLASS · 0.3

Aynı renkte kristalleri birleştir, yükselen dalgaya alan aç, rekorunu geliştir. Süre sınırı yoktur. Oyun Türkçedir.

## Açma

Masaüstünde `TIDEGLASS.html` dosyasını indirip modern bir web tarayıcısında aç. Bu dosya bütün oyun kodunu ve stilleri içerir; oyun sırasında internet, hesap veya kurulum gerekmez.

iPhone/iPad'in Dosyalar uygulaması HTML'yi yalnızca önizleme olarak açabilir; bu önizleme oyunu çalıştırmayabilir. Mobilde en güvenilir yöntem dosyaların bir statik web sunucusundan Safari ile açılmasıdır. Bu paket bir yayın bağlantısı içermez.

Kaynak sürümü için dosyaları birlikte tut ve `index.html` dosyasını aç. İstersen bu klasörde `python3 -m http.server 8000` komutunu çalıştırıp aynı bilgisayardaki tarayıcıdan `http://localhost:8000` adresini açabilirsin.

## Oynanış

- Aynı renkten en az üç komşu kristali basılı tutup sürükleyerek birleştir. Çapraz bağlantılar geçerlidir.
- Bırakınca zincir toplanır. Önceki kristale geri dönerek son seçimi geri alabilirsin.
- 3–5 kristal toplamak bir dalga getirir. 6+ kristal dalgayı durdurur.
- En az beş kristallik zincirin başlangıcına geri dönmek bir halka oluşturur. O rengin bütün kristalleri temizlenir, dalga durur.
- Ardışık 5+ zincirler Akıntı çarpanını yükseltir: 1,25 → 1,50 → 1,75 → 2. Kısa zincir çarpanı sıfırlar.
- 18 kristal toplayınca Dalgakıran dolar; alt sıraları temizlemek için düğmeye bas. Gücü hemen kullanman gerekmez.
- Yıldızlar ve komşu kayalar bonus verir. Önizleme kaya bonusunu da içerir. Taşacak bir hamle `TAŞAR!` diye işaretlenir.
- Her yedi hamlede bir sonraki bölgeye geçilir. Üçüncü bölgede dördüncü renk, dördüncü bölgede aralıklı kayalar gelir.
- Değişen sefer hedefi +300 puan verir. Kaptan Günlüğü başarıları, rütbeyi ve toplam ilerlemeyi gösterir.

## Kontroller

Dokunmatik/fare: basılı tut, sürükle, bırak. Klavye: oklarla gez, Boşluk ile kristal ekle, Enter ile topla, E ile Dalgakıran kullan. Esc seçimi iptal eder veya duraklatır. Ses düğmesiyle prosedürel ses efektlerini açabilirsin; varsayılan kapalıdır.

## Kayıt

Oyun her tamamlanmış hamleden sonra aktif seferi kaydeder. Ana menüdeki **Kaldığın yerden devam** düğmesi tahtayı, puanı, hedefi ve rastgele üretimin kaldığı noktayı geri getirir. Tarayıcı kayıt izni vermezse oyun yine çalışır, fakat yenileme sonrası ilerleme tutulamaz. Tarayıcı verilerini silmek kayıtları siler. Farklı tarayıcı, adres veya yerel dosya konumu ayrı kayıt alanı kullanabilir.

## Geliştirme

Oynamak için bağımlılık yoktur. Kod düzeni:

- `engine.js`: oyun kuralları, puanlama, durum doğrulama ve kayıt/geri yükleme
- `game.js`: arayüz, girişler, çizim, ses ve sefer akışı
- `style.css`: duyarlı arayüz ve görsel tema
- `build.cjs`: kaynaklardan tek HTML oluşturma
- `test-engine.cjs`, `test-ui.cjs`: mantık ve olay testleri

Node.js 24+ ile `npm install`, ardından `npm test` kullan. `node build.cjs` bağımlılık kurmadan tek dosyalık sürümü yeniden oluşturur.

## Doğrulama sınırı

Mantık, simülasyon, kayıt/geri yükleme, klavye ve pointer olayları test edildi. DOM testleri çizim bağlamını taklit eder; gerçek tarayıcı yerleşimi, GPU performansı veya fiziksel dokunmatik cihaz testi değildir. Test tarayıcısının yerel sunucuya erişimi engellendiği için bu sürümün gerçek Safari/Chrome görsel ve cihaz testi henüz tamamlanmadı. Ticari yayın öncesinde bu kontrol ve gerçek oyuncu denemesi gereklidir.
