# AI Koç — "30 Günlük Yolculuk" Tasarımı

- **Tarih:** 2026-06-25
- **Durum:** Onaylandı (uygulama planına hazır)
- **Proje:** Goodsoria (Herbalife bağımsız distribütör platformu) — Express + libSQL/Turso + vanilla JS

## 1. Amaç

AI Koç'un tek seferlik çıktısını, **kalıcı + oyunlaştırılmış 30 günlük bir yolculuğa** çevirmek. Üç iş hedefi:

1. **Dönüşüm:** anonim lead'i (mail) kayıtlı üyeye çevirmek.
2. **Bağlılık (retention):** her gün açılan bir takvim + sadakat puanı ile günlük etkileşim.
3. **Tekrar satış:** programın içine yerleşmiş ürün-tazeleme dürtüleri.

İkincil hedef: **token maliyetini minimuma indirmek** — pahalı 30 günlük üretim yalnızca commit eden kullanıcıya yapılır.

## 2. Kilitlenen kararlar

| Karar | Seçim |
|---|---|
| Kalıcılık + takvim + puan erişimi | **Üyelik şart.** Misafir PDF'i "tadımlık" alır; kaydetmek/takvim/puan için üye olur (verdiği mail prefill, sadece şifre). |
| Pahalı program üretimi | **Tadım → onay → kilit.** Önce ucuz hızlı set; "Beğendim" deyince 30 gün 1 kez üretilir; kaydedilince kilitlenir. |
| "Yeniden üret" hakkı | Hızlı set için **max 3**, feedback ile. 30 günlük program kaydedildikten sonra AI yeniden üretim **yok**. |
| PDF indirme (kayıtlı programdan) | **Sınırsız** (token harcamaz, saklanan veriden üretilir). |
| Takvim yeri | Ayrı sayfa: `public/takvim.html`. Panel ve ana sayfada mini "bugünün görevi" kartı. |
| Sadakat formülü | gün tamamla = +10p; 7'lik seri bonusu = +50p; sadakat% = tamamlanan ÷ bugüne kadar geçmesi gereken gün (max 100). |
| "Yeni hedef" döngüsü | Dahil. Yeni program kaydı eski aktif programı `archived` yapar. |

## 3. Akış (funnel)

```
Misafir formu doldurur → mail lead yakalanır (mevcut /api/coach quick gate)
   ↓
[1] HIZLI SET (ucuz, ~10sn): plan + ürün seti + günlük ritim + tips
   ↓ "Bu plan sana uygun mu?"
   ├─ "Beğenmedim / değiştir" → modal: "Neyi değiştirelim?"
   │     chips: daha ekonomik · farklı ürünler · daha çok protein · vejetaryen · serbest not
   │     → quick'i feedback ile YENİDEN üret (max 3, sayaç UI'da)
   └─ "Beğendim → 30 günlük programı kur"
         ↓
      [2] 30 GÜNLÜK PROGRAM (pahalı, yalnızca burada, 1 kez) → önizleme
      "Kaydet & takvime geçir"
         ↓ üye değilse → kayıt modalı (mail prefill) → lead, üyeye döner
      POST /api/programs → kaydeder + kilitler
         ↓
      takvim.html'e geç → takvim + puan + sınırsız PDF
```

Pahalı program yalnızca "Beğendim" diyene üretilir. Bounce eden ziyaretçiye token harcanmaz.

## 4. Veri modeli

Yeni tablo (`initDb` içine, `CREATE TABLE IF NOT EXISTS` + idempotent migration deseni mevcut leads/orders ile aynı):

```sql
CREATE TABLE IF NOT EXISTS programs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  goal TEXT, budget TEXT,
  lifestyle TEXT,            -- json array
  plan TEXT,
  tips TEXT,                 -- json array
  products TEXT,             -- json: [{slug,name,price,old,cat,catName,img,when,reason}]
  weeks TEXT,                -- json: [{week,theme}]
  days TEXT,                 -- json: [{day,nutrition,product,movement,motivation}]
  done_days TEXT DEFAULT '[]', -- json: [{day:Int, ts:ISO}]
  points INTEGER DEFAULT 0,
  best_streak INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',  -- 'active' | 'archived'
  locked_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
```

Kullanıcı başına en fazla **1 aktif** program (`status='active'`). Yeni kayıt eski aktifi `archived` yapar.

Türetilen alanlar (kayıtta saklanmaz, okurken hesaplanır):
- **sadakat%** = `round(100 * tamamlanan_gün / max(1, geçmesi_gereken_gün))`, cap 100. `geçmesi_gereken_gün = clamp(1..30, floor((now - created_at)/gün) + 1)`.
- **seri (streak)** = bugünden geriye ardışık tamamlanan günler.
- **rozetler** = tamamlanan gün eşiklerine göre (7/14/21/30).

## 5. Backend uçları

| Uç | Auth | Davranış |
|---|---|---|
| `POST /api/coach` `mode:quick` | — | Mevcut. Yeni opsiyonel `feedback` (string) + `refineOf` bilgisi prompt'a eklenir ("kullanıcı şunu değiştirmek istedi: ..."). Lead gate aynı. |
| `POST /api/coach` `mode:program` | — | Mevcut. 30 günü üretir, **DB'ye yazmaz**, JSON döner. |
| `POST /api/programs` | 🔒 requireAuth | Body: tam program (plan, tips, products, weeks, days, goal, budget, lifestyle). Validasyon: days 1..30 dolu. Mevcut `active` varsa `archived` yapar, yenisini `active`+`locked_at=now` ile yazar. Döner: `{program, progress}`. |
| `GET /api/programs/active` | 🔒 | Aktif programı + türetilmiş `progress{points,streak,best_streak,dedication,doneCount,badges}` döner. Yoksa `{program:null}`. |
| `POST /api/programs/:id/day` | 🔒 | Body `{day:Int, done:Bool}`. `done_days` günceller, `points`/`best_streak` yeniden hesaplar, kaydeder. Döner güncel `progress`. Sahiplik kontrolü (program.user_id === req.user.id). |
| `POST /api/programs/:id/archive` | 🔒 | "Yeni hedef" — aktifi arşivler. Döner `{ok:true}`. |

Puan hesabı sunucuda (tek doğruluk kaynağı): her done gün +10; ardışık 7'nin tamamlanışında +50 bonus; `best_streak` güncellenir.

## 6. Frontend

### 6.1 `koc.html` (değişiklikler)
- Hızlı set render edilince **karar çubuğu**: `[👍 Beğendim → 30 günlük programı kur]` `[🔄 Yeniden üret (kalan: n)]`.
- "Yeniden üret" → mini modal (chips + serbest not) → `feedback` ile quick yeniden çağrılır; sayaç 3→0; 0'da buton pasifleşir ("Beğendim'e basıp programını kur").
- "Beğendim" → program mode çağrısı → önizleme (haftalık temalar + ilk 6 gün) + `[💾 Kaydet & takvime geçir]` `[⬇️ PDF indir]`.
- "Kaydet" → `isAuthed()` değilse kayıt modalı (mail+ad prefill) → başarı sonrası `POST /api/programs` → `takvim.html`'e yönlendir.
- LocalStorage'da geçici taslak tutulur ki kayıt sonrası kaybolmasın (sayfa yenilense de "Beğendim" sonrası veri elde kalsın).

### 6.2 Kayıt prefill
`openAuth({signup:true, prefill:{name,email}})` — `diri.js` `openAuth` imzasına opsiyonel `prefill` eklenir; signup formundaki ad/email alanlarını doldurur (kullanıcı yalnız şifre girer).

### 6.3 `takvim.html` (yeni)
- Üst panel: **sadakat halkası %**, **🔥 seri**, **puan**, **rozetler**, **"Bugünün görevi"** kartı.
- **30 günlük grid** (haftalık satırlar). Hücre durumları: ✅ tamam · 🔵 bugün · ⚪ gelecek · 🔴 kaçırıldı. Tıkla → gün detayı (beslenme/ürün/hareket/motivasyon) + "Bugünü tamamladım ✓".
- Tik → `POST /api/programs/:id/day` → panel anında güncellenir (puan/seri/sadakat animasyonu).
- `[⬇️ PDF indir]` (saklanan veriden, sınırsız). `[🛒 Setini tazele]` (kayıtlı seti sepete ekle).
- Aktif program yoksa → "Henüz programın yok, AI Koç'tan oluştur" CTA.
- Panel.html + platform.html: mini "bugünün görevi" kartı (aktif program varsa) → takvime götürür.

## 7. Oyunlaştırma mekaniği

- **Puan:** gün=+10, 7'lik seri bonusu=+50.
- **Sadakat %:** tamamlanan ÷ geçmesi gereken gün (commitment göstergesi; geç kalınca düşer, motive eder).
- **Seri:** ardışık tamamlanan gün; kaçırınca sıfırlanır.
- **Rozetler:** 7 "1. Hafta Şampiyonu", 14 "Yarı Yol", 21 "3. Hafta", 30 "30 Gün Şampiyonu".
- **Kutlama:** her hafta/30. gün tamamlanınca toast + rozet animasyonu.

## 8. Satış entegrasyonu (öncelik)

- Her günün ürünü takvimde görünür (programda mevcut).
- **Tazeleme dürtüsü:** 20. günden sonra "Ürünlerin bitmek üzere — setini tek tıkla tazele" → kayıtlı seti sepete ekle.
- **30. gün:** "Tebrikler 🏆 sonraki 30 güne devam et" → yeni program (upsell) + seti yeniden sipariş.
- Tüm CTA'lar mevcut sepet/sipariş hattına bağlanır (yeni ödeme akışı yok).

## 9. PDF düzeltmesi

- Kök neden: `html2pdf` CDN'den (`defer`) gelmediğinde kod `window.print()` fallback'ine düşüyor (yazıcı diyaloğu).
- Çözüm: `html2pdf.bundle.min.js` `public/assets/vendor/`'a **yerel** vendor edilir, lokal referans verilir → her zaman yüklenir, gerçek `.pdf` iner. `window.print()` yalnızca gerçek son çare.
- PDF şablonu görselsiz/markalı (mevcut `buildProgramHtml`) korunur.

## 10. Compliance (korunur)

"Resmî Herbalife sitesi değildir", gelir/sonuç garantisi yok, KVKK onayı (lead + kayıt), sağlık disclaimer'ı, hafif hareket önerileri. Sadakat puanı sağlık iddiası değil, plana bağlılık göstergesidir.

## 11. Kapsam dışı (YAGNI — bu sürümde yok)

- Push/e-posta hatırlatma bildirimleri (ileride).
- Birden fazla eşzamanlı aktif program.
- Sosyal paylaşım / liderlik tablosu.
- Premium/ücretli yeniden-üretim (ileride; altyapı `archived` ile hazır).
- Ürün tüketim hesabıyla otomatik bitiş tahmini (basit "20. gün" eşiği kullanılır).

## 12. Uygulama fazları

1. **Backend:** `programs` tablosu + 5 uç + sunucu puan hesabı.
2. **PDF fix:** html2pdf yerel vendor.
3. **koc.html:** karar çubuğu + yeniden-üret modalı (feedback) + program önizleme + kaydet/kayıt-prefill.
4. **takvim.html:** grid + sadakat paneli + tik + tazeleme/upsell CTA.
5. **Mini kartlar:** panel.html + platform.html "bugünün görevi".
6. **Doğrulama:** uçtan uca (misafir→beğen→üret→kayıt→kaydet→tik→puan→PDF→tazele); test verisi temizliği.
</content>
