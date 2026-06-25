# Goodsoria — Yol Haritası & Strateji Dökümanı

> **Amaç:** Türkiye'de Herbalife bağımsız distribütörlüğünde "en mükemmel" dijital platform olmak.
> Sadece bir online dükkan değil; **ürün + kişiselleştirme + kazanç sistemi + topluluk**'u tek çatı altında toplayan, rakiplerin tek başına asla kuramayacağı bir platform.
>
> **Kıyas referansı:** `herbalexpress.com.tr` (Abdullah Karaman) — standart bir e-ticaret şablonu.
> **Bizim avantajımız:** Tasarım ve kurgu zaten bir lig üstünde. **Eksiğimiz:** motor demo; gerçek satış üretmiyor.
> **Strateji özeti:** Önce motoru gerçek yap → ticaret paritesini yakala → sonra rakibin yapamayacağını ekle (AI, abonelik, CRM).

---

## 0. İçindekiler
1. Mevcut Durum (Goodsoria)
2. Rakip Analizi (HerbalExpress)
3. Karşılaştırma Tablosu
4. Faz Faz Yol Haritası (0 → 4)
5. Teknik Mimari Kararları
6. Veri Modeli Genişlemeleri
7. Compliance (Herbalife + KVKK) Çerçevesi
8. Riskler & Açık Sorular
9. Önerilen Başlangıç Sırası

---

## 1. Mevcut Durum (Goodsoria)

### Teknik yapı
- **Backend:** Node.js + Express (`server.js`), libSQL/Turso (yerelde SQLite `local.db`).
- **Auth:** signup/login/logout/me — JWT httpOnly cookie + bcrypt. ✅ Gerçek çalışıyor.
- **API:** `/api/orders`, `/api/favorites` — ✅ Gerçek (ama sadece **girişli** kullanıcı için).
- **Frontend:** Vanilla JS + tek CSS (`diri.css`) + tek JS kabuk (`diri.js`). Framework yok, hafif, hızlı.
- **Deploy:** Vercel (statik `public/` + serverless Express).

### Sayfalar
| Sayfa | İçerik | Durum |
|---|---|---|
| `platform.html` | Anasayfa: hero, **VKİ aracı**, ürün bulucu, öne çıkan ürünler, iki yol, rütbe, topluluk, güven | İyi tasarlanmış |
| `magaza.html` | 12 ürünlü katalog, filtre (kategori/hedef/puan), sıralama, ürün detay modalı | Demo veri |
| `sepet.html` | localStorage sepet, **kayıtsız (misafir) checkout**, KVKK onayı | Demo akış |
| `panel.html` | Üye paneli: siparişler, hedef halkası, öneriler, KPI'lar | Yarı-gerçek |
| `distributor.html` | Kazanç sayfası: rütbe merdiveni, SSS, başvuru formu, referans linki | Demo form |
| `bulucu.html` | Hedef + yaşam tarzı quiz → ürün önerisi | Demo veri |
| `topluluk.html` | WhatsApp/Telegram, etkinlik, içerik feed, yorumlar | Statik içerik |

### Güçlü yönler
- Premium, modern tasarım (Bricolage Grotesque + Hanken Grotesk, OKLCH renk, reveal animasyon).
- **Çift yol:** müşteri + distribütör — net ayrılmış.
- **VKİ lead-magnet** (anasayfa) — rakipte yok.
- Hedef bazlı interaktif **ürün bulucu**.
- Topluluk entegrasyonu (WhatsApp + Telegram + etkinlik + içerik).
- **Compliance-first:** "resmî site değildir", gelir garantisi yok, KVKK metinleri, `PRICE_PUBLIC` anahtarı.

### ⚠️ Kritik açıklar (para sızıntısı)
1. **Misafir siparişi distribütöre ulaşmıyor.** `sepet.html` → sipariş `localStorage`'a yazılıyor, kullanıcı "Siparişin alındı 🎉" görüyor ama **distribütörün haberi olmuyor.** (Girişli kullanıcıda `/api/orders`'a gidiyor ama misafirde gitmiyor.)
2. **VKİ lead'leri hiçbir yere gitmiyor.** `goodsoria_leads` → sadece `localStorage`. En sıcak müşteri verisi kayboluyor.
3. **Ürünler demo:** jenerik isimler ("Formül 1 Besleyici Shake") + Unsplash görselleri + placeholder fiyatlar.
4. **Yorumlar/yıldızlar sahte/statik** (kodda sabit).
5. **Gerçek ödeme yok** — checkout demo.

---

## 2. Rakip Analizi (HerbalExpress — Abdullah Karaman)

> Not: Site içerik düzeyinde (metin/yapı) incelendi; görsel tasarımı birebir görülmedi.

### Ne var
- **9 kategori:** Tanıtım Paketleri, Temel Beslenme, İçecekler, Atıştırmalıklar, Besin Takviyeleri, Aktif Yaşam, HL/SKIN Serisi, Aloe Care Serisi, Tüm Ürünler.
- **8 başlangıç/tanıtım paketi** — gerçek fiyat + indirim. Örn:
  - "Dengeli Yaşam Paketi" — **3.180₺** (eski 3.800₺)
  - "Sporcu Protein Paketi" — 3.330₺
  - "Uyku Kalitesi Paketi" — 3.280₺ (eski 4.300₺)
- **Gerçek ürün fiyatları + üstü çizili indirim** (örn. Formül 1 Vanilya: 1.150₺ / 1.620₺).
- **Üyelik:** "+Life Beslenme Merkezi Üyeliği" — 5.000₺ (eski 5.400₺) → üyeye özel fiyat açar.
- **Çoklu ödeme:** kart, havale, **kapıda ödeme**.
- **Ücretsiz kargo eşiği** (var, detay net değil).
- **Beslenme analizi** hizmeti (statik form/danışmanlık).
- **Blog:** ürün güvenliği, yeni başlayan rehberi, shake ile kilo verme.
- **Sosyal medya:** Facebook, Instagram, LinkedIn.
- **Güven:** "Güvenli Alışveriş" rozeti + ödeme ikonları, SSS, iade politikası, KVKK.
- **İş fırsatı:** "sıfır sermaye ile başlangıç".
- Ürün sayfasında: protein/şeker bilgisi ("15g protein", "şekersiz"), aroma seçenekleri, yıldız puanı.

### Zayıf yönleri (bizim fırsatımız)
- Sıradan e-ticaret şablonu — deneyim/kişiselleştirme zayıf.
- Statik "beslenme analizi" formu (canlı/akıllı değil).
- Topluluk sadece bir WhatsApp linki.
- Tekrar satış / abonelik / sadakat döngüsü yok.
- Distribütör tarafı sadece bir "iş fırsatı" sayfası — sistem/araç yok.

---

## 3. Karşılaştırma Tablosu

| Alan | HerbalExpress | Goodsoria | Önde |
|---|---|---|---|
| Tasarım / UX | Sıradan şablon | Premium, modern | 🟢 Biz |
| Çift yol (müşteri+distribütör) | Zayıf | Güçlü | 🟢 Biz |
| Lead toplama (VKİ aracı) | Yok | Var (bağlı değil) | 🟢 Biz (potansiyel) |
| Kişiselleştirme / ürün bulucu | Statik form | İnteraktif quiz | 🟢 Biz |
| Topluluk | WhatsApp linki | WA+TG+etkinlik+içerik | 🟢 Biz |
| Gerçek ürün kataloğu | ✅ 9 kategori | ❌ 12 demo | 🔴 O |
| Paket/set ürünler | ✅ 8 paket | ❌ Yok | 🔴 O |
| Gerçek fiyat + indirim | ✅ | ❌ Demo | 🔴 O |
| Üyelik/sadakat tier | ✅ +Life | ❌ Yok | 🔴 O |
| Çoklu ödeme (kart/havale/kapıda) | ✅ | ❌ Demo | 🔴 O |
| Ücretsiz kargo eşiği | ✅ | ❌ | 🔴 O |
| Blog / SEO | ✅ | ❌ | 🔴 O |
| Sosyal medya + güven rozetleri | ✅ | ❌ | 🔴 O |
| **Sipariş distribütöre ulaşıyor mu** | ✅ | ❌ localStorage | 🔴 O |

**Sonuç:** Deneyimde öndeyiz, işleyen ticarette geride. İkisini birleştirince kimse yetişemez.

---

## 4. Faz Faz Yol Haritası

### FAZ 0 — Motoru Gerçek Yap ⭐ (ZORUNLU temel)
> Vitrin hazır; arkasını gerçek yap. Bu faz olmadan site tek satış üretemez.

**Özellikler**
- [ ] **Misafir siparişi → backend.** `POST /api/orders` misafire de açılsın (auth opsiyonel; ad/tel/adres body'de). Sipariş DB'ye düşsün.
- [ ] **Sipariş bildirimi → distribütör.** Yeni sipariş anında:
  - E-posta (distribütöre + müşteriye onay), ve/veya
  - **WhatsApp deep-link** (`wa.me`) ile tek tık iletişim, ve/veya WhatsApp Cloud API ile otomatik mesaj.
- [ ] **VKİ + bulucu lead'leri → backend.** `POST /api/leads` (ad, tel, e-posta, VKİ, hedef). DB + distribütöre bildirim.
- [ ] **Admin paneli (basit).** Distribütör girişiyle: gelen siparişler + lead'ler listesi, durum güncelleme. (`role='admin'` zaten var.)
- [ ] **Gerçek/yarı-gerçek ürün kataloğu.** DB'de `products` tablosu; gerçek Herbalife ürün adları, doğru kategoriler, gerçek görseller, compliance'a uygun fiyat gösterimi.

**Teknik:** Express route'ları + libSQL tabloları + e-posta sağlayıcı (Resend) + opsiyonel WhatsApp.
**Etki:** 🚀🚀🚀 (en yüksek) — para sızıntısını kapatır.
**Süre tahmini:** 1–2 hafta.

---

### FAZ 1 — Ticaret Paritesi
> Rakipte olan her şey, ama bizim tasarımımızla daha iyi.

**Özellikler**
- [ ] **Paket/set ürünler.** `packages` tablosu + paket detay sayfası. "Başlangıç Seti", "Sporcu Paketi" vb. Sepet ortalamasını 3–5x büyütür. *(En yüksek getirili tek özellik.)*
- [ ] **İndirim mantığı.** Üstü çizili eski fiyat + yüzde + (opsiyonel) kampanya etiketi/sayaç.
- [ ] **Çoklu ödeme.**
  - Kapıda ödeme + havale/EFT = entegrasyonsuz (sipariş bayrağı + manuel tahsilat).
  - Kart = **iyzico** veya **PayTR** (3D Secure + taksit). *Karar gerekiyor (bkz. §8).*
- [ ] **Ücretsiz kargo eşiği.** "X₺ üzeri kargo bedava" — sepet sayfasında ilerleme çubuğu.
- [ ] **Zengin ürün detay sayfası.** İçindekiler, porsiyon, kalori/protein, **aroma varyantları**, kullanım, **gerçek yorumlar**.
- [ ] **Sadakat/üyelik tier'ı.** `PRICE_PUBLIC` altyapısı üyeye-özel-fiyat katmanına dönüştürülür.

**Etki:** 🚀🚀🚀 (paketler) / 🚀🚀 (diğerleri).
**Süre tahmini:** 2–4 hafta.

---

### FAZ 2 — Dönüşüm & Elde Tutma Makinesi
> Rakibin hiç düşünmediği yer: bir kez satıp bırakmak yerine **abone et**.

**Özellikler**
- [ ] **🔁 Abonelik / otomatik ikmal.** "Shake'in her ay otomatik gelsin." Herbalife = sarf malzemesi → gelir-tekrarı altın madeni. `subscriptions` tablosu + döngü.
- [ ] **⭐ Gerçek yorum sistemi.** Sipariş sonrası yorum/puan; moderasyon. (Sahte yıldızların yerine.)
- [ ] **📲 WhatsApp ticaret.** Sipariş anında müşteri + distribütöre otomatik mesaj; sipariş durumu güncellemeleri.
- [ ] **✉️ E-posta/SMS otomasyonu.** Sepeti terk hatırlatması, sipariş durumu, "ürünün bitmek üzere" ikmal hatırlatıcısı.

**Etki:** 🚀🚀🚀 (abonelik — LTV'yi katlar).
**Süre tahmini:** 1–2 ay.

---

### FAZ 3 — 🤯 "Akıl Almaz" Katman (asıl moat)
> Rakip tek başına bir satıcı. Biz bir **platform** oluyoruz. Bunları bir bayi tek başına kuramaz.

**1. 🤖 AI Beslenme Koçu (Claude API)**
- VKİ'nin ötesinde: **sohbet eden** asistan. Kişiye özel 12 haftalık plan çıkarır, ürün önerir, soru cevaplar, ilerleme takip eder.
- Rakibin statik "beslenme analizi" formuna karşı **canlı yapay zekâ**. Tek başına bizi efsane yapar.
- **Teknik:** Backend route `/api/coach` (API anahtarı asla client'ta değil). `@anthropic-ai/sdk`, streaming chat. Model: varsayılan `claude-opus-4-8` (en yüksek kalite); yüksek hacimde maliyet için `claude-sonnet-4-6` / `claude-haiku-4-5` seçenek (model tercihi senin kararın). Sağlık disclaimer'ı her yanıtta; "tıbbi tavsiye değildir".

**2. 📈 Dönüşüm Takibi & Oyunlaştırma**
- Önce/sonra fotoğraf, haftalık check-in, kilo/ölçü grafiği, **seri (streak)**, rozet, ilerleme halkası (panelde temel var).

**3. 🧰 Distribütör CRM / Lead Motoru**
- Tüm lead'ler (VKİ + bulucu + checkout) bir **satış hattına** düşer: durum, takip hatırlatması, hazır WhatsApp şablonları, notlar.
- Sadece satmıyoruz — bir **satış SİSTEMİ** kuruyoruz. Bu sistemi ekipteki (downline) diğer distribütörler de kullanabilir → **ağ etkisi**.

**4. 📝 İçerik / SEO Motoru**
- Blog + tarif arşivi (mevcut topluluk feed'i temel) → Google'dan sürekli organik müşteri.

**Etki:** 🚀🚀🚀 (kalıcı rekabet avantajı / moat).
**Süre tahmini:** 1–3 ay (parça parça).

---

### FAZ 4 — Ölçek (Platformlaşma)
> Tek bayilikten gerçek SaaS'a.

- [ ] **Çok-distribütörlü mod.** Her bayinin kendi alt-sitesi/subdomain'i, senin altyapın üstünde. CRM + AI koç + mağaza hazır gelir.
- [ ] **"Çok daha üst" olmak budur:** sen ürün satan biri değil, **distribütörlere sistem satan** bir platform olursun.

---

## 5. Teknik Mimari Kararları

> İlke: Mevcut hafif stack'i koru (Express + libSQL + vanilla JS). Gereksiz framework migration **yapma**. Her şey serverless-uyumlu (Vercel) kalsın.

| İhtiyaç | Öneri | Neden / Alternatif |
|---|---|---|
| **Veritabanı** | Mevcut libSQL/Turso | Zaten kurulu, serverless-dostu. Tabloları genişlet. |
| **Kart ödemesi** | **iyzico** veya **PayTR** | TR yerel, 3D Secure, taksit. MVP'de kapıda/havale ile entegrasyonsuz başla. |
| **Kapıda ödeme / havale** | Entegrasyonsuz | Sipariş bayrağı + manuel tahsilat. Türkiye'de güven için kritik. |
| **E-posta** | **Resend** (veya Nodemailer+SMTP) | Serverless'ta temiz API; sipariş/lead bildirimleri + onay. |
| **WhatsApp** | MVP: `wa.me` deep-link (ücretsiz) → ileri: WhatsApp Cloud API (Meta) | Otomatik bildirim için Cloud API; başlangıçta tek-tık link yeterli. |
| **SMS (opsiyonel)** | NetGSM / İletimerkezi | OTP, sipariş durumu. Faz 2. |
| **AI koç** | **`@anthropic-ai/sdk`** (Anthropic) | Backend route `/api/coach`, streaming, adaptive thinking. Model: `claude-opus-4-8` (varsayılan) — maliyet için sonnet/haiku seçilebilir. **API anahtarı yalnızca sunucuda.** |
| **Görseller** | Gerçek ürün görselleri (Herbalife medya) | Unsplash placeholder'lar gider. |
| **Analitik** | Plausible / basit kendi event log'u | Dönüşüm ölçümü. |

**Güvenlik notları:**
- AI/ödeme/e-posta API anahtarları **asla** frontend'e konmaz; hepsi env var + backend route.
- `JWT_SECRET` canlıda mutlaka değiştirilecek (kodda dev-secret uyarısı var).
- KVKK: lead/sipariş verisi açık rıza ile; saklama/silme politikası.

---

## 6. Veri Modeli Genişlemeleri (libSQL tabloları)

Mevcut: `users`, `orders`, `favorites`.

Eklenecekler (faz sırasına göre):

```
-- FAZ 0
leads(id, name, phone, email, source, goal, bmi, status, note, created_at)
products(id, slug, name, category, goals, description, image, price, rating, review_count, in_stock, sort, created_at)
-- orders'a ekle: guest_name, guest_phone, guest_email, payment_method, shipping_status

-- FAZ 1
categories(id, slug, name, sort)
product_variants(id, product_id, flavor, sku, stock)          -- aromalar
packages(id, slug, name, description, image, price, old_price) -- setler
package_items(package_id, product_id, qty)
discounts(id, scope, value_type, value, starts_at, ends_at)    -- indirim/kampanya

-- FAZ 2
reviews(id, product_id, user_id, rating, body, status, created_at)
subscriptions(id, user_id, items_json, interval_days, next_run, status)

-- FAZ 1/2
memberships(user_id, tier, started_at, expires_at)             -- sadakat/+Life benzeri

-- FAZ 3
coach_sessions(id, user_id, messages_json, plan_json, updated_at)  -- AI koç hafızası
progress(id, user_id, date, weight, measurements_json, photo_url)  -- dönüşüm takibi
crm_pipeline(lead_id, stage, assigned_to, next_followup_at, notes) -- distribütör CRM
```

---

## 7. Compliance (Herbalife + KVKK) Çerçevesi

Yeni özellik eklerken bu çizgi **korunacak** — "akıl almaz" olmak kural ihlali değil, daha akıllı sistem demek.

- **"Resmî Herbalife sitesi değildir"** beyanı + bağımsız distribütör kimliği her sayfada (zaten var).
- **Gelir vaadi yasak.** Distribütör tarafında "kazanç kişiden kişiye değişir, garanti yok" + Ortalama Kazanç Beyanı (zaten var).
- **Sağlık iddiası dikkatli.** VKİ ve AI koç çıktıları "tıbbi tavsiye değildir" disclaimer'ı taşır.
- **Fiyat gösterimi.** `PRICE_PUBLIC` anahtarı korunur; Herbalife'ın fiyat/satış kurallarına göre açık ya da üyelik-arkası seçilebilir kalır.
- **KVKK.** Lead/sipariş verisinde açık rıza, aydınlatma metni, saklama/silme. AI koç sohbetlerinde kişisel veri minimizasyonu.
- **Satış kanalı.** Sosyal medya tanıtım; satış/ödeme platform üzerinden (mevcut topluluk notu bunu söylüyor).

---

## 8. Riskler & Açık Sorular

**Karar bekleyen sorular:**
1. **Ödeme:** iyzico mı PayTR mı? Yoksa MVP'de sadece kapıda ödeme + havale ile mi başlayalım?
2. **Fiyat politikası:** Fiyatlar herkese açık mı (`PRICE_PUBLIC=true`), yoksa üyelik-arkası mı? (Herbalife kuralı + strateji.)
3. **Ürün verisi:** Gerçek Herbalife ürün adları/görselleri/fiyatları kaynağı? (Distribütör panelinden mi alınacak?)
4. **WhatsApp:** Tek-tık `wa.me` yeterli mi, yoksa otomatik Cloud API kurulumu mu?
5. **AI koç:** Anthropic API anahtarı/bütçesi var mı? Hangi model tier (opus/sonnet/haiku)?
6. **Çok-distribütörlü (Faz 4):** Bu gerçekten hedef mi, yoksa tek bayi (Goodsoria/Abdoul) için mi optimize edeceğiz?

**Riskler:**
- Herbalife marka/kural uyumu — özellik eklerken sürekli kontrol.
- Gerçek ödeme = PCI/güvenlik sorumluluğu → sağlayıcıya devret (iyzico/PayTR hosted).
- AI koç maliyeti → model tier + önbellek + hız sınırı ile kontrol.
- KVKK ihlali riski → açık rıza + veri minimizasyonu.

---

## 9. Önerilen Başlangıç Sırası

En yüksek etkiden başlayarak:

1. **FAZ 0 — Motoru gerçek yap** ⭐ (sipariş + lead gerçekten distribütöre ulaşsın + admin paneli). *Bu olmadan hiçbir şeyin anlamı yok.*
2. **Paketler + indirim** (Faz 1'in en getirili parçası).
3. **AI Beslenme Koçu** (Faz 3'ün "akıl almaz" farkı — pazarlama kozu).
4. Geri kalan Faz 1 → Faz 2 → Faz 3 → Faz 4.

> **Not:** Her faz bağımsız değer üretir; sırayla ilerleyip aralarda ölçüm yapacağız.

---

*Bu döküman canlıdır — kararlar netleştikçe güncellenecek.*
