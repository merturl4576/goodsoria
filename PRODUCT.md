# PRODUCT.md — Herbalife Distribütör Platformu (marka: "Goodsoria")

**Ne:** Türkiye'de bir Herbalife **bağımsız distribütörü**nün tek çatı altında platformu.
İlk faz: sahibinin (Mert) kendi platformu. Sonraki faz: aynı sistemi başka distribütörlere
açan SaaS (her distribütöre AYRI site — kural gereği).

**Kimler için:**
- Sağlık / forma / kilo hedefi olan günlük TR kullanıcıları (ürün almak isteyen müşteri).
- Ek gelir / kendi işini kurmak isteyenler (distribütör adayı, sahibin ekibine katılır).

**Parçalar:**
- Ürün e-mağazası (fiyat sadece kayıt + giriş sonrası görünür).
- Birebir danışmanlık / lead toplama.
- "Distribütör ol" akışı (sahibin referans kodu gömülü).
- Topluluk (WhatsApp + Telegram).
- Admin panel (ürün/sipariş/müşteri/aday yönetimi — kod bilmeden).

**Register:** landing & pazarlama yüzeyleri = `brand`; admin panel = `product`.

**Fark yaratan:** compliance-by-default (kuralları otomatik uygulayan platform) + özgün premium tasarım.
Rakipler jenerik WooCommerce/ideasoft temaları kullanıyor; biz ayrışıyoruz.

**Compliance kısıtları (tasarımı bağlar) — Herbalife kurallarıyla DOĞRULANDI (2026-06-23):**
- Fiyat halka açık gösterilemez → yalnız giriş/şifre arkasında ("Price Advertising Rule"). Açık fiyatlı rakip (herbalurunler.com) kuralı ihlal ediyor, sadece yaptırım görmemiş.
  - **KARAR (2026-06-23, Mert):** Buna rağmen TAM AÇIK fiyatla başlandı (rakip gibi; risk bilinçli kabul edildi). **Mitigasyon:** `assets/diri.js` içinde `PRICE_PUBLIC` TEK ANAHTARI — uyarı gelirse `false` yap → tüm site (magaza+bulucu+kopya) saniyede giriş-arkası fiyata döner, SEO/marka kaybı yok. Fiyatlar şu an DEMO/örnek. Canlı öncesi Herbalife TR'den (0216 542 75 80) teyit önerilir; MyHerbalife erişimi şu an yok (arkadaş hesabıymış).
- Domain'de Herbalife markası YASAK → "goodsoria.com" güvenli.
- "Resmî/yetkili" iddiası RİSKLİ → yalnız "Bağımsız Distribütör" denir (kendini Herbalife'ın resmî temsilcisi gibi gösteremez). Üst şerit rozeti "Orijinal Herbalife ürünleri" olarak değiştirildi.
- Kendi sitede satış OK ama **Herbalife ONAYI gerekli** (site açmadan önce); 3rd-party e-ticaret platformları (Trendyol/Amazon) YASAK.
- Gelir vaadi YOK; spesifik gelir / lüks yaşam / "işini bırak" yasak; "Ortalama Kazanç Beyanı" linki + disclaimer.
- Ekip üyesinin satış/hacim/rütbe verisi MyHerbalife'ta → Goodsoria takip paneli SUNAMAZ. "Ekibim" → **Ekip Portalı** (sponsor destek: onboarding+akademi+kit+mentorluk).
- Her ziyarette değiştirilmemiş Herbalife açılır bilgi penceresi.
- Üstte "Herbalife Bağımsız Distribütör" + sahibin adı/telefonu/adresi (above-the-fold).
- Resmî Herbalife sitelerine benzemeyecek; footer'da "resmî site değildir" beyanı.
- Tek distribütör = tek site; sosyal medyada satış işlemi yok (satış sitede).
- Kilo/ürün iddialarında her sayfada disclaimer (Herbalife "Claims Guide" — onaylı ifadeler).
