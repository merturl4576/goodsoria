# DESIGN.md — "Goodsoria" görsel sistemi (v2 · zümrüt app-shell)

> v1 (tek-sayfa landing, teal+mercan) reddedildi: "blog gibi, platform değil".
> v2 = içine girilen, kapsamlı **platform** hissi. Bu dosya v2'yi tanımlar.

## Mood (tek cümle)
Premium, enerjik, güven veren bir sağlık **platformu** — broşür değil, sistem.
Herbalife dünyasına yakın yeşil ama resmî siteye benzemez (compliance güvenli).

## Yapı — APP-SHELL (en kritik karar)
Girişten önce bile platform hissi veren **sol sabit menü** + üst bar + içerik.
- Sol menü (koyu zümrüt drench): Keşfet (Ana Sayfa · Mağaza · Ürün Bulucu · Distribütör Ol · Topluluk) + Hesabım (Panelim · Siparişlerim · Ekip Portalı) + "üye ol" kartı.
- Üst bar: arama (`/` kısayolu) · bildirim · sepet · Giriş/Üye ol.
- Mobil: sol menü gizlenir → alt tab bar + hamburger drawer.
- HER alan AYRI sayfa (tek sayfaya sıkışmaz): `platform.html` `magaza.html` `panel.html` `distributor.html` `topluluk.html`.

## Renk — premium zümrüt + lime + gold (OKLCH, hex yok)
- `--bg: oklch(0.975 0.012 152)`        /* app canvas, çok açık yeşil-gri */
- `--surface: oklch(1 0 0)`             /* kartlar */
- `--ink: oklch(0.24 0.030 162)` · `--muted: oklch(0.505 0.028 162)` · `--line: oklch(0.905 0.016 155)`
- `--brand: oklch(0.475 0.115 162)`     /* zümrüt — marka/CTA */
- `--brand-deep: oklch(0.305 0.072 166)` · `--brand-deeper: oklch(0.235 0.055 168)` /* sidebar/drench */
- `--lime: oklch(0.865 0.185 126)`      /* taze enerji aksanı; üstünde koyu metin (--lime-ink 0.34 0.10 142) */
- `--gold: oklch(0.80 0.125 80)`        /* RÜTBE / President motifi; başarı/kariyer */
Kural: saturated dolgularda metin kontrastı (zümrüt üstü beyaz, lime üstü koyu).

## Tipografi
- Display: **Bricolage Grotesque** (700/800), clamp başlıklar, letter-spacing ~-.03em.
- Body/UI: **Hanken Grotesk** (400–800), Türkçe karakter tam.

## İmza bileşenler (platformu "1 numara" yapan)
- **President rütbe merdiveni**: Distribütör → Süpervizör → World Team → GET → President (gold). İlham/harita amaçlı; GERÇEK takip değil (kişinin rütbe/hacmi MyHerbalife'ta, Goodsoria erişemez).
- **Üye paneli** (panel.html): KPI'lar, sipariş durumları, hedef ring'i — müşterinin Goodsoria'da gerçekten olan verisi.
- **Ekip Portalı** (ekibim.html): sponsor destek merkezi — onboarding checklist + eğitim akademisi + hazır pazarlama kiti + mentorluk + rütbe haritası. Downline satış/hacim/rütbe TAKİBİ YOK (o veri MyHerbalife'ta).
- **İki yol kartı**: "Ürün almak" vs "Para kazanmak" (vizyondaki iki kayıt tipi).
- **Pazaryeri yoğunluğunda mağaza**: sol filtre paneli + sıralama + 12+ ürün + detay modalı.

## Hareket
Niyetli; page-load staggered reveal (data-reveal → .in), ilerleme barı fill, hover lift.
`prefers-reduced-motion` zorunlu; içerik fallback ile her hâlükârda görünür.

## Compliance (tasarıma gömülü)
- Üstte zorunlu şerit: "Herbalife Bağımsız Distribütör · Mert Ural · İstanbul · telefon".
- Açılışta zorunlu Herbalife bilgi pop-up'ı (yalnız `platform.html`; session başına 1).
- Fiyat görünürlüğü = `PRICE_PUBLIC` tek anahtarı (diri.js). ŞU AN AÇIK (Mert kararı, risk kabul); `false` → "Fiyat üyelikte" kilidine saniyelik dönüş. Fiyatlar demo/örnek.
- Gelir vaadi YOK; "Ortalama Kazanç Beyanı" linki + "kazanç garanti değil" notları.
- Resmî Herbalife sitesine link; "resmî site değildir" beyanı footer'da.
- Topluluk = destek/içerik; satış yalnız sitede.

## Teknik
Statik çok-sayfa: ortak `assets/diri.css` + `assets/diri.js` (her sayfa link'ler).
Sayfaya özel JS (mağaza filtre/modal, panel, form) sayfa altında inline.
Görseller: doğrulanmış Unsplash URL'leri. `python -m http.server 8899` ile sunulur.
