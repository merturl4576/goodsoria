# AI Koç "30 Günlük Yolculuk" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** AI Koç'un tek seferlik çıktısını, üyelik-şartlı kalıcı + oyunlaştırılmış 30 günlük bir takvim yolculuğuna çevirmek; pahalı üretimi yalnızca commit eden kullanıcıya yapmak; PDF indirmeyi gerçek dosya indirmesine düzeltmek.

**Architecture:** Express + libSQL/Turso backend'e yeni `programs` tablosu + 5 uç + sunucu-tarafı puan hesabı eklenir. Vanilla JS frontend'de `koc.html` "tadım → onay → kilit" akışına dönüştürülür, yeni `takvim.html` interaktif grid + sadakat paneli sunar. PDF için `html2pdf` yerel vendor edilir.

**Tech Stack:** Node.js/Express, @libsql/client, JWT (httpOnly cookie gs_token), vanilla JS, html2pdf.js (yerel), Gemini Flash (REST).

## Global Constraints

- Katalog **tek kaynak**: `public/assets/catalog.js` (sunucu vm ile okur). Ürün verisi kopyalanmaz.
- API anahtarı yalnız backend `.env` (`GEMINI_API_KEY`); asla frontend/commit'te değil.
- Compliance korunur: "resmî Herbalife sitesi değildir", gelir/sonuç garantisi yok, KVKK onayı, sağlık disclaimer'ı, hafif hareket önerileri.
- Pahalı 30 günlük program **yalnızca** "Beğendim" sonrası 1 kez üretilir. Kayıtlı programdan PDF/okuma sınırsız (token yok).
- Para birimi `tr-TR` + ` ₺`. Türkçe metinler UTF-8.
- **Test framework yok.** Doğrulama: (a) `node` betikleri `http://localhost:8899`'a, (b) DB kontrolü `@libsql/client` ile **proje kökünden** çalıştırılır, (c) `chrome --headless --dump-dom`. Her task somut bir doğrulama komutu + beklenen çıktı ile biter.
- **Commit'ler önerilen kontrol noktalarıdır.** Repo `main` üzerinde çalışıyor; commit yalnız kullanıcı isterse atılır.
- Sunucu yeniden başlatma deseni: port 8899'daki PID'i durdur, `node server.js`'i arka planda başlat, `/api/auth/me` ile erişilebilirliği doğrula.

---

### Task 1: `programs` tablosu (initDb)

**Files:**
- Modify: `server.js` — `initDb()` içinde `leads` CREATE'inden sonra (yaklaşık satır 152 sonrası)

**Interfaces:**
- Produces: `programs` tablosu (kolonlar: id, user_id, goal, budget, lifestyle, plan, tips, products, weeks, days, done_days, points, best_streak, status, locked_at, created_at).

- [ ] **Step 1: Tablo DDL'ini ekle**

`server.js` içinde `leads` tablosunun `CREATE TABLE IF NOT EXISTS leads (...)` bloğundan hemen sonra:

```js
  // 30 günlük kişisel program (yalnız kayıtlı kullanıcı; kullanıcı başına 1 aktif)
  await db.execute(`CREATE TABLE IF NOT EXISTS programs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    goal TEXT, budget TEXT,
    lifestyle TEXT,
    plan TEXT,
    tips TEXT,
    products TEXT,
    weeks TEXT,
    days TEXT,
    done_days TEXT DEFAULT '[]',
    points INTEGER DEFAULT 0,
    best_streak INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    locked_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
```

- [ ] **Step 2: Sunucuyu yeniden başlat ve tabloyu doğrula**

Proje kökünde `_tmp_check.js` oluştur:

```js
const { createClient } = require('@libsql/client');
const db = createClient({ url: process.env.TURSO_DATABASE_URL || 'file:local.db', authToken: process.env.TURSO_AUTH_TOKEN });
(async () => {
  const r = await db.execute("PRAGMA table_info('programs')");
  console.log('cols:', r.rows.map(x => x.name).join(','));
})().catch(e => { console.error(e.message); process.exit(1); });
```

Run: sunucuyu yeniden başlat (initDb çalışsın), sonra `node _tmp_check.js`
Expected: `cols: id,user_id,goal,budget,lifestyle,plan,tips,products,weeks,days,done_days,points,best_streak,status,locked_at,created_at`
Sonra `_tmp_check.js`'i sil.

- [ ] **Step 3: Commit (opsiyonel)**

```bash
git add server.js && git commit -m "feat(koc): programs tablosu (30 günlük program saklama)"
```

---

### Task 2: Program uçları + puan hesabı + coach feedback

**Files:**
- Modify: `server.js` — `/api/coach` quick dalına `feedback`; admin bölümünden önce yeni uçlar.

**Interfaces:**
- Consumes: `requireAuth`, `currentUser`, `db`.
- Produces:
  - `programProgress(row) -> {doneDays:number[], doneCount, points, streak, best_streak, dedication, badges:string[], elapsed}`
  - `POST /api/programs` (🔒) → `{ok, id, progress}`
  - `GET /api/programs/active` (🔒) → `{program|null, progress?}`
  - `POST /api/programs/:id/day` (🔒) body `{day,done}` → `{ok, progress}`
  - `POST /api/programs/:id/archive` (🔒) → `{ok}`

- [ ] **Step 1: Puan/ilerleme yardımcı fonksiyonu ekle**

`server.js`'de `/api/coach` handler'ından **önce** (örn. `WHENS`/`PROGRAM_MODELS` sabitlerinin yanına):

```js
function clampInt(n, lo, hi) { n = parseInt(n) || 0; return Math.max(lo, Math.min(hi, n)); }
function programProgress(row) {
  let done; try { done = JSON.parse(row.done_days || '[]'); } catch (e) { done = []; }
  const doneSet = new Set(done.map(d => parseInt(d.day)).filter(n => n >= 1 && n <= 30));
  const doneCount = doneSet.size;
  const elapsed = clampInt(row._elapsed != null ? row._elapsed : 1, 1, 30);
  let d = elapsed, streak = 0;
  if (!doneSet.has(d)) d--;            // bugün henüz yapılmadıysa dünden say
  while (d >= 1 && doneSet.has(d)) { streak++; d--; }
  const best = Math.max(parseInt(row.best_streak) || 0, streak);
  const points = doneCount * 10 + Math.floor(doneCount / 7) * 50;
  const badges = [];
  if (doneCount >= 7) badges.push('1. Hafta Şampiyonu');
  if (doneCount >= 14) badges.push('Yarı Yol');
  if (doneCount >= 21) badges.push('3. Hafta');
  if (doneCount >= 30) badges.push('30 Gün Şampiyonu');
  const dedication = Math.min(100, Math.round(100 * doneCount / Math.max(1, elapsed)));
  return { doneDays: [...doneSet].sort((a, b) => a - b), doneCount, points, streak, best_streak: best, dedication, badges, elapsed };
}
```

- [ ] **Step 2: coach quick dalına `feedback` ekle**

`/api/coach` içinde quick dalındaki `const user = 'Kişi: ' + person.name ...` ifadesine, `\nKendi sözleriyle durumu: ...` satırından sonra ekle:

```js
    + (String(b.feedback || '').trim() ? '\nKullanıcı önceki öneriyi beğenmedi, şunu istedi (buna göre REVİZE et): ' + String(b.feedback).trim().slice(0, 500) : '');
```

- [ ] **Step 3: Program uçlarını ekle**

`/* ---------- admin (yalnız role='admin') ---------- */` yorumundan **önce** ekle:

```js
/* ---------- 30 günlük program (kayıtlı kullanıcı) ---------- */
const ELAPSED_SQL = "CAST(julianday('now') - julianday(created_at) AS INTEGER) + 1 AS _elapsed";

app.get('/api/programs/active', requireAuth, async (req, res) => {
  const r = await db.execute({ sql: `SELECT *, ${ELAPSED_SQL} FROM programs WHERE user_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1`, args: [req.user.id] });
  if (!r.rows.length) return res.json({ program: null });
  const row = r.rows[0];
  const program = {
    id: row.id, goal: row.goal, budget: row.budget,
    plan: row.plan, tips: JSON.parse(row.tips || '[]'),
    products: JSON.parse(row.products || '[]'),
    weeks: JSON.parse(row.weeks || '[]'), days: JSON.parse(row.days || '[]'),
    created_at: row.created_at, locked_at: row.locked_at,
  };
  res.json({ program, progress: programProgress(row) });
});

app.post('/api/programs', requireAuth, async (req, res) => {
  const b = req.body || {};
  const days = Array.isArray(b.days) ? b.days.filter(d => d && (parseInt(d.day) >= 1) && (parseInt(d.day) <= 30)) : [];
  if (days.length < 30) return res.status(400).json({ error: 'Program eksik görünüyor, lütfen tekrar oluştur.' });
  const clean = {
    goal: String(b.goal || '').slice(0, 60), budget: String(b.budget || '').slice(0, 20),
    lifestyle: Array.isArray(b.lifestyle) ? b.lifestyle.slice(0, 10) : [],
    plan: String(b.plan || '').slice(0, 1500),
    tips: Array.isArray(b.tips) ? b.tips.slice(0, 6) : [],
    products: Array.isArray(b.products) ? b.products.slice(0, 12) : [],
    weeks: Array.isArray(b.weeks) ? b.weeks.slice(0, 4) : [],
    days: days.slice(0, 30),
  };
  await db.execute({ sql: "UPDATE programs SET status = 'archived' WHERE user_id = ? AND status = 'active'", args: [req.user.id] });
  const ins = await db.execute({
    sql: `INSERT INTO programs (user_id, goal, budget, lifestyle, plan, tips, products, weeks, days, status, locked_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', datetime('now'))`,
    args: [req.user.id, clean.goal, clean.budget, JSON.stringify(clean.lifestyle), clean.plan, JSON.stringify(clean.tips), JSON.stringify(clean.products), JSON.stringify(clean.weeks), JSON.stringify(clean.days)],
  });
  const r = await db.execute({ sql: 'SELECT *, 1 AS _elapsed FROM programs WHERE id = ?', args: [ins.lastInsertRowid] });
  res.json({ ok: true, id: Number(ins.lastInsertRowid), progress: programProgress(r.rows[0]) });
});

app.post('/api/programs/:id/day', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id) || 0;
  const day = clampInt((req.body || {}).day, 1, 30);
  const done = !!(req.body || {}).done;
  const r = await db.execute({ sql: `SELECT *, ${ELAPSED_SQL} FROM programs WHERE id = ? AND user_id = ?`, args: [id, req.user.id] });
  if (!r.rows.length) return res.status(404).json({ error: 'Program bulunamadı.' });
  const row = r.rows[0];
  let arr; try { arr = JSON.parse(row.done_days || '[]'); } catch (e) { arr = []; }
  arr = arr.filter(x => parseInt(x.day) !== day);
  if (done) arr.push({ day, ts: new Date().toISOString() });
  row.done_days = JSON.stringify(arr);
  const prog = programProgress(row);
  await db.execute({ sql: 'UPDATE programs SET done_days = ?, points = ?, best_streak = ? WHERE id = ?', args: [row.done_days, prog.points, prog.best_streak, id] });
  res.json({ ok: true, progress: prog });
});

app.post('/api/programs/:id/archive', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id) || 0;
  await db.execute({ sql: "UPDATE programs SET status = 'archived' WHERE id = ? AND user_id = ?", args: [id, req.user.id] });
  res.json({ ok: true });
});
```

- [ ] **Step 4: Uçları test et (kimlik doğrulamalı)**

Proje kökünde `_tmp_prog.js` oluştur (signup → program kaydet → gün tikle → active oku):

```js
const BASE = 'http://localhost:8899';
let cookie = '';
async function j(path, opts = {}) {
  const r = await fetch(BASE + path, Object.assign({ headers: Object.assign({ 'Content-Type': 'application/json' }, cookie ? { Cookie: cookie } : {}) }, opts));
  const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
  let d; try { d = await r.json(); } catch (e) { d = {}; }
  return { status: r.status, d };
}
(async () => {
  const email = 'prog_test_' + Date.now() + '@example.com';
  await j('/api/auth/signup', { method: 'POST', body: JSON.stringify({ name: 'Prog Test', email, password: 'test1234' }) });
  const days = Array.from({ length: 30 }, (_, i) => ({ day: i + 1, nutrition: 'n' + (i + 1), product: 'Formül 1 Vanilya Shake', movement: 'yürüyüş', motivation: 'devam!' }));
  const save = await j('/api/programs', { method: 'POST', body: JSON.stringify({ goal: 'kilo', budget: 'dengeli', lifestyle: ['masabasi'], plan: 'plan', tips: ['t1'], products: [{ slug: 'formul-1-vanilya', name: 'Formül 1 Vanilya Shake', price: 1150 }], weeks: [{ week: 1, theme: 'Uyum' }], days }) });
  console.log('save:', save.status, JSON.stringify(save.d.progress));
  const id = save.d.id;
  const tick1 = await j('/api/programs/' + id + '/day', { method: 'POST', body: JSON.stringify({ day: 1, done: true }) });
  console.log('tick day1:', tick1.status, 'points=' + tick1.d.progress.points, 'streak=' + tick1.d.progress.streak, 'ded=' + tick1.d.progress.dedication);
  const active = await j('/api/programs/active');
  console.log('active:', active.status, 'days=' + (active.d.program.days || []).length, 'doneCount=' + active.d.progress.doneCount);
  // temizlik
  const { createClient } = require('@libsql/client');
  const db = createClient({ url: process.env.TURSO_DATABASE_URL || 'file:local.db' });
  await db.execute({ sql: 'DELETE FROM programs WHERE user_id IN (SELECT id FROM users WHERE email = ?)', args: [email] });
  await db.execute({ sql: 'DELETE FROM users WHERE email = ?', args: [email] });
  console.log('cleaned');
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
```

Run: `node _tmp_prog.js` (sunucu açıkken)
Expected:
```
save: 200 {"doneDays":[],"doneCount":0,"points":0,...,"dedication":0,...}
tick day1: 200 points=10 streak=1 ded=100
active: 200 days=30 doneCount=1
cleaned
```
Sonra `_tmp_prog.js`'i sil.

- [ ] **Step 5: Commit (opsiyonel)**

```bash
git add server.js && git commit -m "feat(koc): program kaydet/oku/tikle uçları + sadakat puanı + coach feedback"
```

---

### Task 3: PDF — html2pdf yerel vendor

**Files:**
- Create: `public/assets/vendor/html2pdf.bundle.min.js`
- Modify: `public/koc.html` (CDN `<script>` → yerel)

**Interfaces:**
- Produces: `window.html2pdf` global'i her zaman yüklü (CDN bağımsız).

- [ ] **Step 1: Kütüphaneyi yerel indir**

Run (proje kökü):
```bash
mkdir -p public/assets/vendor
curl -L -o public/assets/vendor/html2pdf.bundle.min.js https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js
```
Expected: dosya ~250KB+, `head -c 40` ile JS içeriği (HTML hata sayfası değil). Boyut < 50KB ise indirme başarısız demektir — tekrar dene.

- [ ] **Step 2: koc.html'de yerel referansa geç**

`public/koc.html` içindeki:
```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js" defer></script>
```
→
```html
<script src="assets/vendor/html2pdf.bundle.min.js" defer></script>
```

(Aynı referansı Task 5'te `takvim.html`'e de eklersin.)

- [ ] **Step 3: Doğrula**

Run: `node -e "const s=require('fs').statSync('public/assets/vendor/html2pdf.bundle.min.js'); console.log('bytes', s.size)"`
Expected: `bytes` 200000+ civarı.
Headless: `chrome --headless --dump-dom http://localhost:8899/koc.html` çıktısında `assets/vendor/html2pdf.bundle.min.js` geçer, `cdnjs` geçmez.

- [ ] **Step 4: Commit (opsiyonel)**

```bash
git add public/assets/vendor/html2pdf.bundle.min.js public/koc.html && git commit -m "fix(koc): html2pdf yerel vendor — gerçek PDF indirme (CDN bağımlılığı kaldırıldı)"
```

---

### Task 4: koc.html — tadım → onay → kilit akışı

**Files:**
- Modify: `public/koc.html` (`<script>` bloğu — `run`/`renderResult`/`loadProgram` ve sonrası)
- Modify: `public/assets/diri.js` (`openAuth` imzası: `prefill` desteği)

**Interfaces:**
- Consumes: `POST /api/coach` (quick+feedback, program), `POST /api/programs`, `window.isAuthed`, `openAuth({signup,prefill})`.
- Produces: kullanıcı "Beğendim → kaydet" sonrası `takvim.html`'e yönlendirilir.

**Davranış özeti:** quick render edilince auto-program ÇAĞRILMAZ. Bunun yerine karar çubuğu: `[👍 Beğendim → 30 günlük programı kur]` `[🔄 Yeniden üret (kalan: n)]`. Yeniden üret → feedback modalı (chips + serbest not), max 3. Beğendim → program mode üretimi → önizleme + `[💾 Kaydet & takvime geçir]` + `[⬇️ PDF indir]`. Kaydet → üye değilse kayıt (prefill) → `POST /api/programs` → `takvim.html`.

- [ ] **Step 1: `diri.js` `openAuth`'a prefill ekle**

`openAuth(opts)` fonksiyonunda formu açtıktan sonra (ad/email inputları DOM'a geldikten sonra) ekle:

```js
  if (opts && opts.prefill) {
    const f = $('#authForm') || document;
    const setv = (sel, v) => { const el = f.querySelector(sel); if (el && v) el.value = v; };
    setv('input[name=name],#authName', opts.prefill.name);
    setv('input[type=email],#authEmail', opts.prefill.email);
  }
```
(Not: gerçek selector'lar `openAuth` markup'ına göre ayarlanır; amaç signup formundaki ad+email'i doldurmak.)

- [ ] **Step 2: koc.html JS — karar çubuğu + state**

`renderResult(d)` sonundaki `result.querySelectorAll('.miniadd')...` listener'larından önce, innerHTML kurgusunda program zonu yerine **karar çubuğu** koy. `progZone` placeholder'ını şununla değiştir:

```js
    + '<div class="decide" id="decideBar">'
    +   '<div class="dq">Bu plan sana uygun mu? Beğenirsen sana özel <b>30 günlük takvim programını</b> kurayım.</div>'
    +   '<div class="dbtns">'
    +     '<button class="btn btn-primary" id="likeBtn">👍 Beğendim → 30 günlük programı kur</button>'
    +     '<button class="btn btn-ghost" id="regenBtn">🔄 Yeniden üret <span class="rq">(kalan: '+regenLeft+')</span></button>'
    +   '</div>'
    + '</div>'
    + '<div class="prog-wrap" id="progZone" hidden></div>'
```

Üst tarafta global state ekle: `let regenLeft = 3; let lastBase = null;`. `run()` ilk çağrıda (retry değilse) `regenLeft` sıfırlanmaz — sadece yeni form gönderiminde `regenLeft=3` yapılır (kullanıcı baştan formu değiştirip gönderirse). `run()` içinde quick başarılı olunca `lastBase = base;`.

- [ ] **Step 3: koc.html JS — beğen/yeniden-üret/feedback**

`renderResult` listener kurulumuna ekle:

```js
  const likeBtn = $('#likeBtn');
  if (likeBtn) likeBtn.addEventListener('click', () => generateProgram());
  const regenBtn = $('#regenBtn');
  if (regenBtn) regenBtn.addEventListener('click', () => openFeedback());
```

Yeni fonksiyonlar (script sonuna):

```js
/* yeniden üret — feedback modalı */
function openFeedback() {
  if (regenLeft <= 0) { toast('Yeniden üretim hakkın doldu — beğendiysen programı kur'); return; }
  fbModal.classList.add('show'); document.body.style.overflow = 'hidden';
}
function closeFeedback() { fbModal.classList.remove('show'); document.body.style.overflow = ''; }
async function doRegen() {
  const chips = $$('#fbChips .opt-chip[aria-pressed=true]').map(c => c.textContent.trim());
  const note = $('#fbNote').value.trim();
  const feedback = [chips.join(', '), note].filter(Boolean).join('. ');
  if (!feedback) { toast('Neyi değiştirelim, seç ya da yaz'); return; }
  closeFeedback();
  regenLeft--;
  const useCart = $('#useCart') && $('#useCart').checked;
  const cart = (window.getCart && window.getCart()) || [];
  result.innerHTML = '<div class="kstep"><div class="thinking">Önerini güncelliyorum <span class="dots"><i></i><i></i><i></i></span></div></div>';
  try {
    const r = await fetch('/api/coach', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(Object.assign({ mode: 'quick', feedback }, lastBase, LEAD ? { name: LEAD.name, email: LEAD.email, phone: LEAD.phone, kvkk: true } : {}, { cart: useCart ? cart.map(i => ({ name: i.name, qty: i.qty })) : [] })) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { toast(d.error || 'Olmadı, tekrar dene'); return; }
    LAST = d; renderResult(d);
  } catch (e) { toast('Bağlantı hatası'); }
}
```

- [ ] **Step 4: koc.html JS — program üretimi + önizleme + kaydet**

```js
/* "Beğendim" → 30 günlük programı üret (pahalı, 1 kez) */
async function generateProgram() {
  const zone = $('#progZone'); const decide = $('#decideBar');
  if (decide) decide.querySelectorAll('button').forEach(b => b.disabled = true);
  zone.hidden = false; zone.innerHTML = '<div class="thinking sm">📅 30 günlük programın hazırlanıyor… <span class="dots"><i></i><i></i><i></i></span></div>';
  zone.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const setProducts = ((LAST && LAST.products) || []).map(p => p.name);
  const payload = Object.assign({ mode: 'program' }, lastBase, { setProducts, name: (LEAD && LEAD.name) || ((LAST && LAST.person && LAST.person.name) || '') });
  try {
    const r = await fetch('/api/coach', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(payload) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.program || !(d.program.days || []).length) { zone.innerHTML = '<div class="kstep coach-soon"><p>Program oluşturulamadı.</p><button class="btn btn-primary btn-sm" onclick="generateProgram()">Tekrar dene</button></div>'; if (decide) decide.querySelectorAll('button').forEach(b => b.disabled = false); return; }
    PROGRAM = d.program; renderProgramPreview();
  } catch (e) { zone.innerHTML = '<div class="kstep coach-soon"><p>Bağlantı hatası.</p></div>'; }
}
function renderProgramPreview() {
  const zone = $('#progZone'); const weeks = PROGRAM.weeks || [], days = PROGRAM.days || [];
  const wk = weeks.map(w => '<div class="wk"><b>' + esc(w.week) + '. HAFTA</b><span>' + esc(w.theme) + '</span></div>').join('');
  const dc = d => '<div class="dcard"><span class="dn">' + esc(d.day) + '. gün</span><ul><li><em>🥗</em><span>' + esc(d.nutrition) + '</span></li><li><em>🌿</em><span>' + esc(d.product) + '</span></li><li><em>🚶</em><span>' + esc(d.movement) + '</span></li><li><em>✨</em><span>' + esc(d.motivation) + '</span></li></ul></div>';
  zone.innerHTML =
    '<div class="prog-head"><div class="ph-t"><h2>📅 30 günlük programın hazır</h2><p>Beğendiysen hesabına kaydet — her günü takvimde işaretle, sadakat puanı kazan. PDF olarak da indirebilirsin.</p></div>'
    + '<div style="display:flex;gap:.6rem;flex-wrap:wrap"><button class="btn btn-pdf" id="saveBtn">💾 Kaydet & takvime geçir</button><button class="btn btn-ghost btn-sm" id="pdfBtn">⬇️ PDF indir</button></div></div>'
    + (weeks.length ? '<div class="weeks">' + wk + '</div>' : '')
    + '<div class="days">' + days.slice(0, 6).map(dc).join('') + '</div>'
    + '<div class="prog-more"><span class="sub">…ve 24 gün daha. Kaydedince tamamı takviminde.</span></div>';
  $('#pdfBtn').addEventListener('click', downloadPdf);
  $('#saveBtn').addEventListener('click', saveProgram);
}
async function saveProgram() {
  if (!PROGRAM) return;
  if (!(window.isAuthed && window.isAuthed())) {
    if (window.openAuth) openAuth({ signup: true, prefill: { name: (LEAD && LEAD.name) || '', email: (LEAD && LEAD.email) || '' } });
    else { const j = document.querySelector('[data-join]'); if (j) j.click(); }
    // kullanıcı kayıt olunca tekrar "Kaydet"e basar; basitlik için burada bekliyoruz
    toast('Ücretsiz hesabını oluştur, sonra Kaydet’e tekrar bas');
    return;
  }
  const btn = $('#saveBtn'); if (btn) { btn.disabled = true; btn.textContent = 'Kaydediliyor…'; }
  try {
    const body = Object.assign({}, lastBase, { plan: LAST.plan, tips: LAST.tips, products: LAST.products, weeks: PROGRAM.weeks, days: PROGRAM.days });
    const r = await fetch('/api/programs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { toast(d.error || 'Kaydedilemedi'); if (btn) { btn.disabled = false; btn.textContent = '💾 Kaydet & takvime geçir'; } return; }
    location.href = 'takvim.html';
  } catch (e) { toast('Bağlantı hatası'); if (btn) { btn.disabled = false; btn.textContent = '💾 Kaydet & takvime geçir'; } }
}
```

`run()` içindeki `loadProgram(base)` çağrısını **kaldır**; yerine `lastBase = base;` ata. `run()` yeni form gönderiminde `regenLeft = 3;` ayarla (retry=false dalında). Eski `loadProgram`/`progError`/`renderProgram` fonksiyonlarını sil (yerlerini yukarıdakiler aldı); `dayCardHtml` korunabilir ya da `dc` ile değişir.

- [ ] **Step 5: koc.html — feedback modalı markup + CSS**

`<div class="lgate" id="lgate">` bloğundan sonra ikinci bir modal ekle:

```html
<div class="lgate" id="fbModal" role="dialog" aria-modal="true">
  <div class="gcard">
    <button class="gx" id="fbClose" aria-label="Kapat">&times;</button>
    <span class="gi">🔄</span>
    <h3>Neyi değiştirelim?</h3>
    <p class="lsub">Önerini sana göre güncelleyeyim.</p>
    <div class="cset" id="fbChips" style="margin-bottom:.8rem">
      <button type="button" class="opt-chip" aria-pressed="false">Daha ekonomik</button>
      <button type="button" class="opt-chip" aria-pressed="false">Farklı ürünler</button>
      <button type="button" class="opt-chip" aria-pressed="false">Daha çok protein</button>
      <button type="button" class="opt-chip" aria-pressed="false">Vejetaryen</button>
      <button type="button" class="opt-chip" aria-pressed="false">Daha az ürün</button>
    </div>
    <textarea class="koc-msg" id="fbNote" maxlength="400" placeholder="İstersen kendi sözlerinle yaz…"></textarea>
    <button class="btn btn-primary" id="fbGo" style="width:100%;margin-top:.8rem">Yeniden üret</button>
  </div>
</div>
```

CSS (`.coach-soon` yanına): `.decide{background:linear-gradient(160deg,oklch(0.97 0.035 150),var(--surface,#fff));border:1px solid var(--line);border-radius:16px;padding:1.1rem 1.2rem;margin:.4rem 0 1.1rem}` `.decide .dq{font-size:.95rem;margin-bottom:.8rem;line-height:1.5}` `.decide .dbtns{display:flex;gap:.7rem;flex-wrap:wrap}` `.decide .rq{opacity:.8;font-weight:600}`.

JS (chip toggle + modal wiring, script sonuna):

```js
const fbModal = $('#fbModal');
$$('#fbChips .opt-chip').forEach(c => c.addEventListener('click', () => c.setAttribute('aria-pressed', c.getAttribute('aria-pressed') === 'true' ? 'false' : 'true')));
$('#fbClose').addEventListener('click', closeFeedback);
fbModal.addEventListener('click', e => { if (e.target === fbModal) closeFeedback(); });
$('#fbGo').addEventListener('click', doRegen);
```

- [ ] **Step 6: Doğrula (headless + akış)**

Run: sunucu açık; `chrome --headless --dump-dom http://localhost:8899/koc.html` → çıktıda `id="fbModal"`, `id="lgate"`, `assets/vendor/html2pdf` geçer; `progZone` var.
Manuel/script: quick yanıtından sonra DOM'da `decideBar`, `likeBtn`, `regenBtn` üretildiğini bir önceki uçtan-uca akış betiğiyle (Task 7) doğrula.
Expected: parse hatası yok (DOM uzunluğu > 40KB), elemanlar mevcut.

- [ ] **Step 7: Commit (opsiyonel)**

```bash
git add public/koc.html public/assets/diri.js && git commit -m "feat(koc): tadım→onay→kilit akışı + feedback ile yeniden üret + kaydet/kayıt-prefill"
```

---

### Task 5: takvim.html — interaktif takvim + sadakat paneli

**Files:**
- Create: `public/takvim.html`
- Modify: `public/assets/diri.js` (NAV — "Takvimim" girişi, auth gerektiren), gerekiyorsa

**Interfaces:**
- Consumes: `GET /api/programs/active`, `POST /api/programs/:id/day`, `window.addToCart`, `window.html2pdf`.
- Produces: tam 30 günlük takvim + sadakat paneli + tazeleme/upsell CTA.

- [ ] **Step 1: Sayfa iskeleti**

`public/takvim.html` oluştur — `koc.html`'in head/shell yapısını (compliance bar, `.app`/`.sidebar`/`.content`/topbar/footer, `diri.js`+`catalog.js`+`html2pdf` vendor script) kopyala, `data-page="takvim"` ve `data-requires-auth` ekle (giriş yoksa diri.js auth gate'ine düşsün). `<main>` içeriği:

```html
<main>
  <div class="crumb"><a href="platform.html">Ana Sayfa</a><span class="s">/</span><span>30 Günlük Takvimim</span></div>
  <section id="tkRoot"><div class="thinking">Takvimin yükleniyor <span class="dots"><i></i><i></i><i></i></span></div></section>
</main>
```

- [ ] **Step 2: Veri çek + render**

`<script>` (diri.js+catalog.js'ten sonra):

```js
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmt = n => (n || 0).toLocaleString('tr-TR') + ' ₺';
let PROG = null, PROGRESS = null;
const root = $('#tkRoot');

async function load() {
  try {
    const r = await fetch('/api/programs/active', { credentials: 'same-origin' });
    const d = await r.json().catch(() => ({}));
    if (!d.program) { root.innerHTML = '<div class="kstep coach-soon"><p style="font-weight:700;color:var(--ink)">Henüz aktif programın yok</p><p>AI Koç sana özel 30 günlük bir program kursun.</p><a class="btn btn-primary" href="koc.html">AI Koç’a git</a></div>'; return; }
    PROG = d.program; PROGRESS = d.progress; render();
  } catch (e) { root.innerHTML = '<div class="kstep coach-soon"><p>Yüklenemedi, sayfayı yenile.</p></div>'; }
}

function dayState(day) {
  const done = new Set((PROGRESS.doneDays) || []);
  if (done.has(day)) return 'done';
  if (day === PROGRESS.elapsed) return 'today';
  if (day < PROGRESS.elapsed) return 'missed';
  return 'future';
}
function render() {
  const days = PROG.days || [];
  const p = PROGRESS;
  const cells = days.map(d => {
    const st = dayState(d.day);
    return '<button class="tk-cell ' + st + '" data-day="' + d.day + '"><span class="tk-n">' + d.day + '</span><span class="tk-ic">' + ({ done: '✅', today: '🔵', missed: '🔴', future: '' })[st] + '</span></button>';
  }).join('');
  const badges = (p.badges || []).map(b => '<span class="tk-badge">🏅 ' + esc(b) + '</span>').join('') || '<span class="sub">İlk rozetin 7. günde 🔓</span>';
  const reorder = p.elapsed >= 20 ? '<div class="tk-upsell">⏳ Ürünlerin bitmek üzere — setini tek tıkla tazele <button class="btn btn-sm" id="reorderBtn">🛒 Seti sepete ekle</button></div>' : '';
  root.innerHTML =
    '<div class="tk-panel">'
    + '<div class="tk-ring" style="--p:' + p.dedication + '"><b>%' + p.dedication + '</b><small>sadakat</small></div>'
    + '<div class="tk-stats"><div><b>🔥 ' + p.streak + '</b><small>seri (gün)</small></div><div><b>' + p.points + '</b><small>puan</small></div><div><b>' + p.doneCount + '/30</b><small>tamamlanan</small></div></div>'
    + '<div class="tk-badges">' + badges + '</div></div>'
    + '<div class="tk-today" id="tkToday"></div>'
    + '<div class="tk-grid">' + cells + '</div>'
    + reorder
    + '<div class="tk-actions"><button class="btn btn-ghost btn-sm" id="pdfBtn">⬇️ PDF indir</button></div>'
    + '<p class="coach-disc">Bu program genel bilgilendirme amaçlıdır, tıbbi tavsiye değildir. Sonuçlar kişiden kişiye değişir.</p>';
  renderToday();
  $$('.tk-cell').forEach(c => c.addEventListener('click', () => openDay(parseInt(c.dataset.day))));
  const rb = $('#reorderBtn'); if (rb) rb.addEventListener('click', reorderSet);
  $('#pdfBtn').addEventListener('click', downloadPdf);
}
function renderToday() {
  const day = Math.min(30, PROGRESS.elapsed);
  const d = (PROG.days || []).find(x => x.day === day); if (!d) return;
  const done = new Set(PROGRESS.doneDays || []).has(day);
  $('#tkToday').innerHTML = '<div class="tk-todaycard"><div class="tk-th"><b>Bugün · ' + day + '. gün</b>' + (done ? '<span class="tk-ok">✓ tamamlandı</span>' : '') + '</div>'
    + '<ul class="dcard-ul"><li>🥗 ' + esc(d.nutrition) + '</li><li>🌿 ' + esc(d.product) + '</li><li>🚶 ' + esc(d.movement) + '</li><li>✨ ' + esc(d.motivation) + '</li></ul>'
    + '<button class="btn btn-primary btn-sm" id="todayDone">' + (done ? 'Geri al' : 'Bugünü tamamladım ✓') + '</button></div>';
  $('#todayDone').addEventListener('click', () => toggleDay(day, !done));
}
```

- [ ] **Step 3: Gün detay modalı + tik + tazeleme**

```js
function openDay(day) {
  const d = (PROG.days || []).find(x => x.day === day); if (!d) return;
  const done = new Set(PROGRESS.doneDays || []).has(day);
  const m = document.createElement('div'); m.className = 'lgate show'; m.id = 'dayModal';
  m.innerHTML = '<div class="gcard"><button class="gx">&times;</button><h3>' + day + '. gün</h3>'
    + '<ul class="dcard-ul"><li>🥗 ' + esc(d.nutrition) + '</li><li>🌿 ' + esc(d.product) + '</li><li>🚶 ' + esc(d.movement) + '</li><li>✨ ' + esc(d.motivation) + '</li></ul>'
    + '<button class="btn btn-primary" style="width:100%">' + (done ? 'Geri al' : 'Bu günü tamamladım ✓') + '</button></div>';
  document.body.appendChild(m); document.body.style.overflow = 'hidden';
  const close = () => { m.remove(); document.body.style.overflow = ''; };
  m.querySelector('.gx').addEventListener('click', close);
  m.addEventListener('click', e => { if (e.target === m) close(); });
  m.querySelector('.btn-primary').addEventListener('click', async () => { await toggleDay(day, !done); close(); });
}
async function toggleDay(day, done) {
  try {
    const r = await fetch('/api/programs/' + PROG.id + '/day', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ day, done }) });
    const d = await r.json().catch(() => ({})); if (!r.ok) { toast(d.error || 'Olmadı'); return; }
    const prevBadges = (PROGRESS.badges || []).length;
    PROGRESS = d.progress; render();
    if (done) toast('Aferin! +puan 🎉');
    if ((PROGRESS.badges || []).length > prevBadges) toast('🏅 Yeni rozet: ' + PROGRESS.badges[PROGRESS.badges.length - 1]);
  } catch (e) { toast('Bağlantı hatası'); }
}
function reorderSet() {
  (PROG.products || []).forEach(p => window.addToCart && window.addToCart({ id: p.slug, name: p.name, price: p.price }));
  toast('Setin sepete eklendi ✓');
}
```

- [ ] **Step 4: PDF (koc.html'deki `buildProgramHtml`/`downloadPdf`/`printFallback`'i taşı)**

`koc.html`'deki `buildProgramHtml`, `downloadPdf`, `printFallback` fonksiyonlarını takvim'e uyarlanmış halde ekle: `LAST`→`PROG`, `PROGRAM`→`PROG`, kişi adı `window.currentUser()?.name`, `goal` `PROG.goal`, ürünler `PROG.products`, günler `PROG.days`, haftalar `PROG.weeks`. (Mantık aynı; veri kaynağı kayıtlı programdır.)

- [ ] **Step 5: CSS**

`<style>` bloğuna takvim stilleri: `.tk-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:.5rem}` (mobilde `repeat(5,1fr)`), `.tk-cell{aspect-ratio:1;border:1px solid var(--line);border-radius:12px;background:var(--surface);display:grid;place-items:center;cursor:pointer;position:relative}`, durumlar: `.tk-cell.done{background:var(--brand);color:#fff;border-color:var(--brand)}` `.tk-cell.today{outline:2px solid var(--brand);font-weight:800}` `.tk-cell.missed{opacity:.55}` `.tk-cell.future{color:var(--muted)}`. `.tk-panel`/`.tk-ring` (conic-gradient halka: `background:conic-gradient(var(--brand) calc(var(--p)*1%),var(--line) 0)`), `.tk-stats`, `.tk-badge`, `.tk-upsell`, `.tk-todaycard`. Detaylar koc.html palet/değişkenleriyle uyumlu.

- [ ] **Step 6: NAV girişi**

`diri.js` `NAV_DISCOVER` ya da hesap menüsüne `{href:'takvim.html',page:'takvim',label:'Takvimim',auth:true,icon:'<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>'}` ekle (giriş gerektiren). Footer "Hesap" sütununa `<a href="takvim.html">Takvimim</a>`.

- [ ] **Step 7: Doğrula**

Headless: `chrome --headless --dump-dom http://localhost:8899/takvim.html` (giriş yoksa auth gate). Auth'lu akış Task 7'de uçtan uca.
Run: `node -e` ile `takvim.html` dosyasının var olduğunu ve `tkRoot`, `tk-grid`, `programs/active` stringlerini içerdiğini doğrula.
Expected: dosya mevcut, anahtar stringler geçer.

- [ ] **Step 8: Commit (opsiyonel)**

```bash
git add public/takvim.html public/assets/diri.js && git commit -m "feat(takvim): interaktif 30 günlük takvim + sadakat paneli + tazeleme/upsell"
```

---

### Task 6: Mini "bugünün görevi" kartı (panel + ana sayfa)

**Files:**
- Modify: `public/panel.html`, `public/platform.html`

**Interfaces:**
- Consumes: `GET /api/programs/active`.

- [ ] **Step 1: Ortak mini-kart fonksiyonu**

Her iki sayfada (script sonuna), giriş varsa aktif programı çekip bir kart bas:

```js
(async function todayCard() {
  if (!(window.isAuthed && window.isAuthed())) return;
  try {
    const r = await fetch('/api/programs/active', { credentials: 'same-origin' });
    const d = await r.json().catch(() => ({})); if (!d.program) return;
    const day = Math.min(30, d.progress.elapsed);
    const t = (d.program.days || []).find(x => x.day === day); if (!t) return;
    const host = document.querySelector('#todaySlot'); if (!host) return;
    host.innerHTML = '<a class="today-card" href="takvim.html"><div class="tc-h">📅 Bugünün görevi · ' + day + '. gün <span>%' + d.progress.dedication + ' sadakat · 🔥' + d.progress.streak + '</span></div><div class="tc-b">🌿 ' + (t.product || '') + '</div><div class="tc-cta">Takvime git →</div></a>';
  } catch (e) {}
})();
```

`#todaySlot` host elemanını her iki sayfada uygun bir yere (panel: üst; platform: hero altı) ekle. `.today-card` için kısa CSS (marka renkli kart).

- [ ] **Step 2: Doğrula**

Task 7 uçtan-uca akışında giriş yapmış kullanıcıda `#todaySlot` doluyor mu kontrol et (headless dump-dom + cookie).
Expected: aktif programı olan kullanıcıda kart render olur.

- [ ] **Step 3: Commit (opsiyonel)**

```bash
git add public/panel.html public/platform.html && git commit -m "feat: ana sayfa + panel 'bugünün görevi' mini kartı"
```

---

### Task 7: Uçtan uca doğrulama + temizlik

**Files:**
- Create (geçici): proje kökünde `_tmp_e2e.js`

- [ ] **Step 1: Tam akış betiği**

Misafir mail gate → quick → (feedback regen) → program üret → signup → /api/programs kaydet → /day tikle → /active oku → PDF veri bütünlüğü. `_tmp_e2e.js`:

```js
const BASE = 'http://localhost:8899'; let cookie = '';
async function j(p, o = {}) { const r = await fetch(BASE + p, Object.assign({ headers: Object.assign({ 'Content-Type': 'application/json' }, cookie ? { Cookie: cookie } : {}) }, o)); const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0]; let d; try { d = await r.json(); } catch (e) { d = {}; } return { status: r.status, d }; }
(async () => {
  const base = { goal: 'kilo', budget: 'dengeli', lifestyle: ['masabasi', 'tatli'], message: 'sabah vakit yok' };
  let q = await j('/api/coach', { method: 'POST', body: JSON.stringify(Object.assign({ mode: 'quick' }, base)) });
  console.log('quick no-lead:', q.status, q.d.needLead === true ? 'needLead OK' : 'FAIL');
  q = await j('/api/coach', { method: 'POST', body: JSON.stringify(Object.assign({ mode: 'quick' }, base, { name: 'E2E', email: 'e2e_' + Date.now() + '@example.com', kvkk: true })) });
  console.log('quick +lead:', q.status, 'products=' + (q.d.products || []).length);
  const prog = await j('/api/coach', { method: 'POST', body: JSON.stringify(Object.assign({ mode: 'program', setProducts: (q.d.products || []).map(p => p.name) }, base, { name: 'E2E' })) });
  console.log('program:', prog.status, 'days=' + ((prog.d.program || {}).days || []).length);
  const email = 'e2euser_' + Date.now() + '@example.com';
  await j('/api/auth/signup', { method: 'POST', body: JSON.stringify({ name: 'E2E User', email, password: 'test1234' }) });
  const save = await j('/api/programs', { method: 'POST', body: JSON.stringify(Object.assign({}, base, { plan: q.d.plan, tips: q.d.tips, products: q.d.products, weeks: prog.d.program.weeks, days: prog.d.program.days })) });
  console.log('save:', save.status, 'id=' + save.d.id);
  const t = await j('/api/programs/' + save.d.id + '/day', { method: 'POST', body: JSON.stringify({ day: 1, done: true }) });
  console.log('tick:', t.status, 'points=' + t.d.progress.points);
  const a = await j('/api/programs/active'); console.log('active:', a.status, 'doneCount=' + a.d.progress.doneCount, 'days=' + (a.d.program.days || []).length);
  const { createClient } = require('@libsql/client');
  const db = createClient({ url: process.env.TURSO_DATABASE_URL || 'file:local.db' });
  await db.execute({ sql: 'DELETE FROM programs WHERE user_id IN (SELECT id FROM users WHERE email = ?)', args: [email] });
  await db.execute({ sql: 'DELETE FROM users WHERE email = ?', args: [email] });
  await db.execute("DELETE FROM leads WHERE source='koc' AND email LIKE 'e2e_%@example.com'");
  console.log('cleaned');
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
```

Run: `node _tmp_e2e.js`
Expected (kabaca):
```
quick no-lead: 400 needLead OK
quick +lead: 200 products=3..4
program: 200 days=30
save: 200 id=<n>
tick: 200 points=10
active: 200 doneCount=1 days=30
cleaned
```

- [ ] **Step 2: Geçici betikleri sil + leads/programs tablosunu kontrol et**

Run: `_tmp_e2e.js` sil. `node -e "..."` ile `SELECT COUNT(*) FROM programs` ve test lead'leri temizliğini doğrula (0 kalıntı test verisi).

- [ ] **Step 3: Memory güncelle**

`C:\Users\MERT\.claude\projects\C--Users-MERT-Desktop-herbalife\memory\goodsoria-project.md`'ye "30 Günlük Yolculuk (v4)" özetini ekle.

- [ ] **Step 4: Commit (opsiyonel)**

```bash
git add -A && git commit -m "test(koc): 30 günlük yolculuk uçtan uca doğrulama"
```

## Self-Review

- **Spec coverage:** (1) programs tablosu → Task 1; (2) 5 uç + puan → Task 2; (3) PDF yerel vendor → Task 3; (4) koc.html tadım→onay→kilit + feedback + kaydet/prefill → Task 4; (5) takvim grid + sadakat + tik + tazeleme/upsell → Task 5; (6) mini kart panel+ana sayfa → Task 6; (7) uçtan uca + temizlik → Task 7. Tüm spec maddeleri karşılanıyor.
- **Placeholder scan:** kod blokları gerçek; "TBD/uygun şekilde" yok. (Task 5 CSS/markup tarif edilmiş ama somut sınıf/JS verilmiş — yürütülebilir.)
- **Type consistency:** `programProgress` çıktısı `{doneDays,doneCount,points,streak,best_streak,dedication,badges,elapsed}` tüm tüketicilerde aynı kullanılıyor (takvim `dayState`/`render`, mini kart). `PROG.id`, `PROG.days[].day` tutarlı. `/api/programs/:id/day` body `{day,done}` her yerde aynı.
</content>
