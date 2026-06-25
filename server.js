/* =========================================================
   Goodsoria — Auth + sipariş/favori backend + statik site
   Express + libSQL (Turso/yerel SQLite) + bcryptjs + JWT cookie
   Yerel:  node server.js                 (DB = file:local.db)
   Canlı:  TURSO_DATABASE_URL + TURSO_AUTH_TOKEN env ile Turso
   ========================================================= */
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const { createClient } = require('@libsql/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const PORT = process.env.PORT || 8899;
const JWT_SECRET = process.env.JWT_SECRET || 'goodsoria-dev-secret-DEGISTIR-canli-oncesi';
const COOKIE = 'gs_token';
const PROD = process.env.NODE_ENV === 'production';

/* ---------- ayarlar: yerelde .env yükle (Vercel'de env panelden gelir) ---------- */
try {
  const fs = require('fs');
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
    }
  }
} catch (e) { /* .env yoksa sorun değil */ }

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();
const DISTRIBUTOR_WA = (process.env.DISTRIBUTOR_WA || '').replace(/[^\d]/g, ''); // wa.me için sadece rakam: 905xxxxxxxxx
const DISTRIBUTOR_EMAIL = process.env.DISTRIBUTOR_EMAIL || '';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const MAIL_FROM = process.env.MAIL_FROM || 'Goodsoria <onboarding@resend.dev>';

// AI Beslenme Koçu (ücretsiz Gemini Flash; anahtar yalnız backend .env'de)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODELS = (process.env.GEMINI_MODELS || 'gemini-2.5-flash,gemini-2.5-flash-lite,gemini-2.0-flash,gemini-flash-latest')
  .split(',').map(s => s.trim()).filter(Boolean);

function waLink(text) {
  if (!DISTRIBUTOR_WA) return null;
  return 'https://wa.me/' + DISTRIBUTOR_WA + '?text=' + encodeURIComponent(text);
}
// distribütöre e-posta (Resend REST; anahtar yoksa sessizce atla — sipariş akışını bloklamaz)
async function notifyEmail(subject, text) {
  if (!RESEND_API_KEY || !DISTRIBUTOR_EMAIL) return;
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: MAIL_FROM, to: [DISTRIBUTOR_EMAIL], subject, text }),
    });
  } catch (e) { console.error('notifyEmail:', e.message); }
}

// TEK KAYNAK katalog: frontend catalog.js'i vm'de çalıştırıp ürünleri sunucuda da kullan (kopya veri yok)
let _catalog;
function loadCatalog() {
  if (_catalog) return _catalog;
  const vm = require('vm');
  const fs = require('fs');
  const code = fs.readFileSync(path.join(__dirname, 'public', 'assets', 'catalog.js'), 'utf8');
  const sandbox = { window: {}, encodeURI, encodeURIComponent };
  vm.runInNewContext(code, sandbox);
  _catalog = sandbox.window.CATALOG;
  return _catalog;
}

// Gemini çağrısı — model fallback zinciri (biri olmazsa sıradakini dener)
async function geminiGenerate(system, user, schema, models) {
  let lastErr;
  for (const model of (models && models.length ? models : GEMINI_MODELS)) {
    try {
      const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + encodeURIComponent(GEMINI_API_KEY);
      const r = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: user }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 8192, responseMimeType: 'application/json', responseSchema: schema },
        }),
      });
      if (!r.ok) { lastErr = new Error('Gemini ' + model + ' HTTP ' + r.status); continue; }
      const d = await r.json();
      const parts = (((d.candidates || [])[0] || {}).content || {}).parts || [];
      const text = (parts[0] && parts[0].text) || '';
      return { data: JSON.parse(text), model };
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('AI yanıtı alınamadı.');
}

/* ---------- veritabanı (libSQL: yerelde dosya, canlıda Turso) ---------- */
const db = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:local.db',
  authToken: process.env.TURSO_AUTH_TOKEN, // yerelde undefined olur, sorun değil
});

async function initDb() {
  await db.execute(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'customer',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
  // orders: user_id NULL olabilir (misafir sipariş) + iletişim/ödeme alanları
  const ORDERS_SCHEMA = `CREATE TABLE %T% (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    ono TEXT NOT NULL,
    items TEXT NOT NULL,
    total INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'yeni',
    guest_name TEXT,
    phone TEXT,
    email TEXT,
    payment_method TEXT,
    address TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`;
  await db.execute(ORDERS_SCHEMA.replace('%T%', 'IF NOT EXISTS orders'));
  // eski şemadan (user_id NOT NULL, misafir alanları yok) geldiyse koruyarak taşı
  const oinfo = await db.execute("PRAGMA table_info('orders')");
  if (!oinfo.rows.some(r => r.name === 'payment_method')) {
    await db.execute('ALTER TABLE orders RENAME TO orders_old');
    await db.execute(ORDERS_SCHEMA.replace('%T%', 'orders'));
    await db.execute(`INSERT INTO orders (id, user_id, ono, items, total, status, address, created_at)
                      SELECT id, user_id, ono, items, total, status, address, created_at FROM orders_old`);
    await db.execute('DROP TABLE orders_old');
  }
  await db.execute(`CREATE TABLE IF NOT EXISTS favorites (
    user_id INTEGER NOT NULL,
    product TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, product)
  )`);
  // sepet: kullanıcı başına 1 satır (cihazlar arası senkron)
  await db.execute(`CREATE TABLE IF NOT EXISTS carts (
    user_id INTEGER PRIMARY KEY,
    items TEXT NOT NULL DEFAULT '[]',
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
  await db.execute(`CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    rating INTEGER NOT NULL,
    body TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (user_id, product)
  )`);
  // leads: VKİ + ürün bulucu ilgi kayıtları (distribütöre düşen potansiyel müşteri)
  await db.execute(`CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    phone TEXT,
    email TEXT,
    source TEXT,
    bmi TEXT,
    category TEXT,
    goal TEXT,
    note TEXT,
    status TEXT NOT NULL DEFAULT 'yeni',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
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
}

/* ---------- yardımcılar ---------- */
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const publicUser = (u) => ({ id: u.id, email: u.email, name: u.name, role: u.role });
const sign = (u) => jwt.sign({ id: u.id }, JWT_SECRET, { expiresIn: '7d' });
function setAuthCookie(res, token) {
  res.cookie(COOKIE, token, {
    httpOnly: true, sameSite: 'lax', secure: PROD,
    maxAge: 7 * 24 * 3600 * 1000, path: '/',
  });
}
async function getUserById(id) {
  const r = await db.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [id] });
  return r.rows[0] || null;
}
async function getUserByEmail(email) {
  const r = await db.execute({ sql: 'SELECT * FROM users WHERE email = ?', args: [email] });
  return r.rows[0] || null;
}
// ADMIN_EMAIL ile eşleşen kullanıcıyı otomatik admin yap (distribütör normal kayıt olur, sonra yetkilenir)
async function ensureAdmin(u) {
  if (u && ADMIN_EMAIL && String(u.email).toLowerCase() === ADMIN_EMAIL && u.role !== 'admin') {
    await db.execute({ sql: "UPDATE users SET role = 'admin' WHERE id = ?", args: [u.id] });
    u.role = 'admin';
  }
  return u;
}
async function currentUser(req) {
  const t = req.cookies && req.cookies[COOKIE];
  if (!t) return null;
  try { return await ensureAdmin(await getUserById(jwt.verify(t, JWT_SECRET).id)); } catch (e) { return null; }
}
async function requireAuth(req, res, next) {
  const u = await currentUser(req);
  if (!u) return res.status(401).json({ error: 'Bu işlem için giriş yapmalısın.' });
  req.user = u; next();
}
async function requireAdmin(req, res, next) {
  const u = await currentUser(req);
  if (!u) return res.status(401).json({ error: 'Giriş yapmalısın.' });
  if (u.role !== 'admin') return res.status(403).json({ error: 'Bu alan yöneticilere özeldir.' });
  req.user = u; next();
}

/* ---------- app ---------- */
const app = express();
app.use(express.json());
app.use(cookieParser());

/* şema hazır olsun (memoized — Vercel cold-start'ta da tabloları garanti eder) */
let _ready;
function ready() { if (!_ready) _ready = initDb(); return _ready; }
app.use(async (req, res, next) => {
  try { await ready(); next(); }
  catch (e) { console.error('DB init:', e); res.status(500).json({ error: 'Veritabanı hatası.' }); }
});

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    if (!name || !String(name).trim()) return res.status(400).json({ error: 'Ad Soyad gerekli.' });
    if (!email || !emailRe.test(String(email))) return res.status(400).json({ error: 'Geçerli bir e-posta gir.' });
    if (!password || String(password).length < 6) return res.status(400).json({ error: 'Şifre en az 6 karakter olmalı.' });
    const mail = String(email).toLowerCase().trim();
    if (await getUserByEmail(mail)) return res.status(409).json({ error: 'Bu e-posta zaten kayıtlı. Giriş yapmayı dene.' });
    const hash = bcrypt.hashSync(String(password), 10);
    const ins = await db.execute({ sql: 'INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)', args: [mail, hash, String(name).trim()] });
    const user = await ensureAdmin(await getUserById(Number(ins.lastInsertRowid)));
    setAuthCookie(res, sign(user));
    res.json({ user: publicUser(user) });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Sunucu hatası.' }); }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'E-posta ve şifre gerekli.' });
    const user = await getUserByEmail(String(email).toLowerCase().trim());
    if (!user || !bcrypt.compareSync(String(password), user.password_hash))
      return res.status(401).json({ error: 'E-posta veya şifre hatalı.' });
    await ensureAdmin(user);
    setAuthCookie(res, sign(user));
    res.json({ user: publicUser(user) });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Sunucu hatası.' }); }
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie(COOKIE, { path: '/' });
  res.json({ ok: true });
});

app.get('/api/auth/me', async (req, res) => {
  const u = await currentUser(req);
  res.json({ user: u ? publicUser(u) : null });
});

app.get('/api/orders', requireAuth, async (req, res) => {
  const r = await db.execute({ sql: 'SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC', args: [req.user.id] });
  const orders = r.rows.map(o => ({ id: o.id, ono: o.ono, items: JSON.parse(o.items || '[]'), total: o.total, status: o.status, created_at: o.created_at, payment_method: o.payment_method || 'kapida', address: o.address || '', phone: o.phone || '' }));
  res.json({ orders });
});

// sipariş: misafir DE verebilir (giriş zorunlu değil) — para sızıntısını kapatır
app.post('/api/orders', async (req, res) => {
  const { items, address, name, phone, email, payment_method } = req.body || {};
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'Sepet boş.' });
  const user = await currentUser(req);
  const gname = String(name || (user && user.name) || '').trim().slice(0, 120);
  const gphone = String(phone || '').trim().slice(0, 40);
  const gmail = String(email || (user && user.email) || '').trim().slice(0, 160);
  const addr = String(address || '').trim().slice(0, 400);
  if (!user && (!gname || !gphone || !addr)) return res.status(400).json({ error: 'Ad, telefon ve adres gerekli.' });
  const pm = ['kapida', 'havale'].includes(String(payment_method)) ? String(payment_method) : 'kapida';
  const clean = items.map(i => ({ name: String(i.name || '').slice(0, 120), price: Math.max(0, parseInt(i.price) || 0), qty: Math.max(1, parseInt(i.qty) || 1) }));
  const total = clean.reduce((s, i) => s + i.price * i.qty, 0);
  const ono = 'GD-' + Math.floor(100000 + Math.random() * 900000);
  const ins = await db.execute({
    sql: 'INSERT INTO orders (user_id, ono, items, total, status, guest_name, phone, email, payment_method, address) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    args: [user ? user.id : null, ono, JSON.stringify(clean), total, 'yeni', gname, gphone, gmail, pm, addr],
  });
  const pmLabel = pm === 'havale' ? 'Havale/EFT' : 'Kapıda ödeme';
  const lines = clean.map(i => '• ' + i.name + ' x' + i.qty + ' = ' + (i.price * i.qty).toLocaleString('tr-TR') + ' ₺').join('\n');
  const summary = 'Yeni sipariş ' + ono + '\n' + gname + ' · ' + gphone + '\nÖdeme: ' + pmLabel + '\nAdres: ' + addr + '\n' + lines + '\nToplam: ' + total.toLocaleString('tr-TR') + ' ₺';
  notifyEmail('Yeni sipariş ' + ono + ' — ' + total.toLocaleString('tr-TR') + ' ₺', summary);
  res.json({ order: { id: Number(ins.lastInsertRowid), ono, items: clean, total, status: 'yeni' }, wa: waLink(summary) });
});

// lead: VKİ / ürün bulucu ilgisini distribütöre ulaştır (localStorage yerine DB + bildirim)
app.post('/api/leads', async (req, res) => {
  const { name, phone, email, source, bmi, category, goal, note } = req.body || {};
  const nm = String(name || '').trim().slice(0, 120);
  const ph = String(phone || '').trim().slice(0, 40);
  const em = String(email || '').trim().slice(0, 160);
  if (!nm || (!ph && !em)) return res.status(400).json({ error: 'Ad ve en az bir iletişim (telefon veya e-posta) gerekli.' });
  const src = String(source || 'web').slice(0, 40);
  await db.execute({
    sql: 'INSERT INTO leads (name, phone, email, source, bmi, category, goal, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    args: [nm, ph, em, src, String(bmi || '').slice(0, 20), String(category || '').slice(0, 60), String(goal || '').slice(0, 60), String(note || '').slice(0, 500)],
  });
  const summary = 'Yeni ilgi (' + src + ')\n' + nm + ' · ' + (ph || em)
    + (bmi ? '\nVKİ: ' + bmi + (category ? ' (' + category + ')' : '') : '')
    + (goal ? '\nHedef: ' + goal : '');
  notifyEmail('Yeni lead — ' + nm, summary);
  res.json({ ok: true, wa: waLink(summary) });
});

app.get('/api/favorites', requireAuth, async (req, res) => {
  const r = await db.execute({ sql: 'SELECT product FROM favorites WHERE user_id = ?', args: [req.user.id] });
  const keys = r.rows.map(x => x.product);
  // favoriler ürün ADIYLA (lowercase) saklanır → katalogdan tam detayı çöz (panel her sayfada çalışsın)
  let products = [];
  try {
    const cat = loadCatalog();
    const byName = {};
    cat.products.forEach(p => { byName[p.name.toLowerCase()] = p; });
    products = keys.map(k => byName[k]).filter(Boolean).map(p => ({
      key: p.name.toLowerCase(), slug: p.slug, name: p.name,
      price: p.price, old: p.old || null, cat: p.cat, catName: cat.catName(p.cat),
      img: cat.imgSrc(p), stock: p.stock !== false
    }));
  } catch (e) { /* katalog okunamazsa yalnız anahtarlar döner */ }
  res.json({ favorites: keys, products });
});

app.post('/api/favorites/toggle', requireAuth, async (req, res) => {
  const p = String((req.body && req.body.product) || '').trim().toLowerCase().slice(0, 120);
  if (!p) return res.status(400).json({ error: 'Ürün gerekli.' });
  const has = (await db.execute({ sql: 'SELECT 1 FROM favorites WHERE user_id = ? AND product = ?', args: [req.user.id, p] })).rows.length > 0;
  if (has) await db.execute({ sql: 'DELETE FROM favorites WHERE user_id = ? AND product = ?', args: [req.user.id, p] });
  else await db.execute({ sql: 'INSERT OR IGNORE INTO favorites (user_id, product) VALUES (?, ?)', args: [req.user.id, p] });
  const count = (await db.execute({ sql: 'SELECT COUNT(*) AS c FROM favorites WHERE user_id = ?', args: [req.user.id] })).rows[0].c;
  res.json({ product: p, favorited: !has, count: Number(count) });
});

/* ---------- SEPET (kullanıcıya bağlı, cihazlar arası senkron) ---------- */
function cleanCartItems(arr) {
  if (!Array.isArray(arr)) return [];
  const map = {};
  for (const it of arr) {
    if (!it || it.id == null) continue;
    const id = String(it.id).slice(0, 120);
    const qty = Math.max(1, Math.min(99, parseInt(it.qty) || 1));
    const price = Math.max(0, parseInt(it.price) || 0);
    const name = String(it.name || '').slice(0, 160);
    if (map[id]) map[id].qty = Math.min(99, map[id].qty + qty);
    else map[id] = { id, name, price, qty };
  }
  return Object.values(map).slice(0, 100);
}
app.get('/api/cart', requireAuth, async (req, res) => {
  const r = await db.execute({ sql: 'SELECT items FROM carts WHERE user_id = ?', args: [req.user.id] });
  let items = [];
  if (r.rows.length) { try { items = JSON.parse(r.rows[0].items || '[]'); } catch (e) { items = []; } }
  res.json({ items });
});
app.put('/api/cart', requireAuth, async (req, res) => {
  const items = cleanCartItems(req.body && req.body.items);
  await db.execute({
    sql: `INSERT INTO carts (user_id, items, updated_at) VALUES (?, ?, datetime('now'))
          ON CONFLICT(user_id) DO UPDATE SET items = excluded.items, updated_at = excluded.updated_at`,
    args: [req.user.id, JSON.stringify(items)],
  });
  res.json({ items });
});

/* ---------- yorumlar / gerçek değerlendirme ---------- */
// herkese açık: tek ürünün yorumları + ortalama
app.get('/api/reviews', async (req, res) => {
  const product = String(req.query.product || '').trim().toLowerCase();
  if (!product) return res.status(400).json({ error: 'Ürün gerekli.' });
  const r = await db.execute({ sql: 'SELECT name, rating, body, created_at FROM reviews WHERE product = ? ORDER BY id DESC LIMIT 50', args: [product] });
  const ratings = r.rows.map(x => Number(x.rating));
  const count = ratings.length;
  const avg = count ? ratings.reduce((a, b) => a + b, 0) / count : 0;
  let mine = null;
  const u = await currentUser(req);
  if (u) {
    const m = await db.execute({ sql: 'SELECT rating, body FROM reviews WHERE product = ? AND user_id = ?', args: [product, u.id] });
    if (m.rows[0]) mine = { rating: Number(m.rows[0].rating), body: m.rows[0].body || '' };
  }
  res.json({ reviews: r.rows, avg: Math.round(avg * 10) / 10, count, mine, canReview: !!u });
});

// herkese açık: tüm ürünlerin özet puanı (katalog grid'i için tek istek)
app.get('/api/reviews/summary', async (req, res) => {
  const r = await db.execute('SELECT product, COUNT(*) AS c, AVG(rating) AS a FROM reviews GROUP BY product');
  const summary = {};
  r.rows.forEach(x => { summary[x.product] = { count: Number(x.c), avg: Math.round(Number(x.a) * 10) / 10 }; });
  res.json({ summary });
});

// giriş gerekli: yorum ekle/güncelle (kullanıcı başına ürün başına 1)
app.post('/api/reviews', requireAuth, async (req, res) => {
  const { product, rating, body } = req.body || {};
  const slug = String(product || '').trim().toLowerCase().slice(0, 120);
  const rt = parseInt(rating);
  if (!slug) return res.status(400).json({ error: 'Ürün gerekli.' });
  if (!(rt >= 1 && rt <= 5)) return res.status(400).json({ error: 'Puan 1-5 yıldız arası olmalı.' });
  const txt = String(body || '').trim().slice(0, 1000);
  await db.execute({
    sql: `INSERT INTO reviews (product, user_id, name, rating, body) VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(user_id, product) DO UPDATE SET rating = excluded.rating, body = excluded.body, created_at = datetime('now')`,
    args: [slug, req.user.id, req.user.name, rt, txt],
  });
  const agg = await db.execute({ sql: 'SELECT COUNT(*) AS c, AVG(rating) AS a FROM reviews WHERE product = ?', args: [slug] });
  const row = agg.rows[0];
  res.json({ ok: true, count: Number(row.c), avg: Math.round(Number(row.a) * 10) / 10 });
});

/* ---------- AI Alışveriş/Beslenme Koçu (Gemini Flash, ücretsiz) ---------- */
const LIFESTYLE_LABELS = {
  masabasi: 'Masa başı / hareketsiz çalışıyor', spor: 'Düzenli spor yapıyor',
  'ogun-atla': 'Sık öğün atlıyor', tatli: 'Tatlı / atıştırma krizleri yaşıyor',
  'az-su': 'Az su içiyor', uyku: 'Uyku düzeni bozuk', sindirim: 'Sindirim hassasiyeti var',
  bagisiklik: 'Bağışıklık desteği istiyor', vejetaryen: 'Bitki bazlı / vejetaryen',
};
const BUDGET_LABELS = { ekonomik: 'Ekonomik başlangıç (2-3 temel ürün)', dengeli: 'Dengeli program (3-4 ürün)', kapsamli: 'Kapsamlı program (paket/daha dolu set)' };
const WHENS = ['sabah', 'ara öğün', 'öğle', 'akşam', 'gün boyu'];
// 30 günlük program ağır iş — hız için önce flash-lite dene, sonra normal zincir.
const PROGRAM_MODELS = ['gemini-2.5-flash-lite'].concat(GEMINI_MODELS.filter(m => m !== 'gemini-2.5-flash-lite'));

// --- program ilerleme/puan (sunucu tek doğruluk kaynağı) ---
// Her günde 3 işaretlenebilir görev: beslenme, ürün, hareket. (motivasyon sadece metin)
const DAY_TASKS = ['nutrition', 'product', 'movement'];
function clampInt(n, lo, hi) { n = parseInt(n) || 0; return Math.max(lo, Math.min(hi, n)); }
function programProgress(row) {
  let done; try { done = JSON.parse(row.done_days || '[]'); } catch (e) { done = []; }
  // kayıtlar: {day, task, ts} (görev-bazlı) veya eski {day, ts} (tüm gün)
  const byDay = {}, legacy = new Set();
  done.forEach(e => {
    const day = parseInt(e.day); if (!(day >= 1 && day <= 30)) return;
    if (e.task && DAY_TASKS.includes(e.task)) { (byDay[day] = byDay[day] || new Set()).add(e.task); }
    else legacy.add(day);
  });
  const elapsed = clampInt(row._elapsed != null ? row._elapsed : 1, 1, 30);
  const doneTasks = {}; const completeDays = []; let tickedTasks = 0;
  for (let day = 1; day <= 30; day++) {
    let tasks = byDay[day] ? [...byDay[day]] : [];
    if (legacy.has(day)) tasks = DAY_TASKS.slice();   // eski tüm-gün kaydı = hepsi işaretli
    if (tasks.length) { doneTasks[day] = tasks; tickedTasks += tasks.length; }
    if (tasks.length >= DAY_TASKS.length) completeDays.push(day);
  }
  const completeSet = new Set(completeDays);
  let d = elapsed, streak = 0;
  if (!completeSet.has(d)) d--;            // bugün henüz tamamlanmadıysa dünden say
  while (d >= 1 && completeSet.has(d)) { streak++; d--; }
  const best = Math.max(parseInt(row.best_streak) || 0, streak);
  const doneCount = completeDays.length;
  const points = tickedTasks * 5;          // her görev = +5 (kısmi ilerleme de ödüllenir)
  const badges = [];
  if (doneCount >= 7) badges.push('1. Hafta Şampiyonu');
  if (doneCount >= 14) badges.push('Yarı Yol');
  if (doneCount >= 21) badges.push('3. Hafta');
  if (doneCount >= 30) badges.push('30 Gün Şampiyonu');
  const dedication = Math.min(100, Math.round(100 * tickedTasks / Math.max(1, elapsed * DAY_TASKS.length)));
  return { doneTasks, completeDays, doneCount, tickedTasks, points, streak, best_streak: best, dedication, badges, elapsed };
}

/*
 * AI Koç iki aşamalı çalışır (latency için):
 *  - mode 'quick' (varsayılan): lead kapısı + lead kaydı + HIZLI sonuç (plan + ürün seti + cartAdvice + tips). ~birkaç sn.
 *  - mode 'program': 30 günlük takvim. Kapı yok (quick'te geçildi); hız için flash-lite öncelikli zincir.
 *    quick'in önerdiği ürün adları (setProducts) tutarlılık için programa beslenir.
 */
app.post('/api/coach', async (req, res) => {
  if (!GEMINI_API_KEY) return res.status(503).json({ error: 'AI Koç henüz yapılandırılmadı. (Sunucuda GEMINI_API_KEY gerekli.)' });
  const b = req.body || {};
  const mode = b.mode === 'program' ? 'program' : 'quick';
  const goal = String(b.goal || '').slice(0, 60);
  const message = String(b.message || '').slice(0, 800);
  const budget = String(b.budget || '').slice(0, 20);
  const lifestyle = Array.isArray(b.lifestyle) ? b.lifestyle.map(x => String(x).slice(0, 30)).slice(0, 10) : [];
  const cart = Array.isArray(b.cart) ? b.cart.slice(0, 30).map(i => ({ name: String(i.name || '').slice(0, 120), qty: Math.max(1, parseInt(i.qty) || 1) })) : [];
  if (!goal && !message && !lifestyle.length) return res.status(400).json({ error: 'Hedefini ya da yaşam tarzını seç; istersen durumunu da yaz.' });

  let cat;
  try { cat = loadCatalog(); } catch (e) { console.error('katalog:', e.message); return res.status(500).json({ error: 'Katalog okunamadı.' }); }
  const inStock = cat.products.filter(p => p.stock && p.price);
  const list = inStock.map(p => p.slug + ' | ' + p.name + ' | ' + cat.catName(p.cat) + ' | hedef:' + ((p.goals || []).join(',') || '-') + ' | ' + p.price + 'TL').join('\n');
  const lifeText = lifestyle.map(k => LIFESTYLE_LABELS[k] || k).join('; ') || 'belirtilmedi';

  /* ---- AŞAMA 2: 30 günlük program ---- */
  if (mode === 'program') {
    const setNames = Array.isArray(b.setProducts) ? b.setProducts.map(x => String(x).slice(0, 120)).filter(Boolean).slice(0, 8) : [];
    const pname = String(b.name || '').trim().slice(0, 120) || 'sen';
    const productNames = inStock.map(p => p.name);
    const system =
      'Sen "Goodsoria" adlı Herbalife bağımsız distribütör platformunun beslenme ve yaşam koçusun. '
      + 'Görevin: kişiye 30 GÜNLÜK, takvim gibi günü gününe bir program kurmak.\n'
      + 'KURALLAR:\n'
      + '- Türkçe, samimi, net yaz. TIBBİ TAVSİYE VERME. Hareketler HAFİF ve genel olsun (yürüyüş, esneme, hafif kuvvet); riskli/yoğun antrenman verme.\n'
      + '- "product" alanında SADECE aşağıdaki gerçek ürün adlarından birini yaz (kişinin önerilen seti öncelikli). Ürün UYDURMA.\n'
      + '- Haftalar kademeli ilerlesin (uyum → ritim → hız → kalıcılık). Günler tekdüze olmasın; öğünler, su, uyku, hareket çeşitlensin.\n'
      + 'ÇIKTI: "weeks" = 4 hafta (week 1-4, theme = o haftanın kısa odağı). "days" = 30 gün (day 1-30). '
      + 'Her gün KISA tek cümlelik alanlar: nutrition (o günün beslenme odağı), product (o gün öne çıkan Herbalife ürünü ve nasıl kullanılacağı), movement (hafif hareket), motivation (motive edici tek cümle).\n\n'
      + 'KULLANILABİLİR ÜRÜN ADLARI:\n' + productNames.join('\n');
    const user = 'Kişi: ' + pname
      + '\nHedef: ' + (goal || 'genel sağlık')
      + '\nYaşam tarzı: ' + lifeText
      + '\nBütçe tercihi: ' + (BUDGET_LABELS[budget] || 'belirtilmedi')
      + '\nÖnerilen ürün seti (programda bunlara öncelik ver): ' + (setNames.join(', ') || 'belirtilmedi')
      + '\nKendi sözleriyle durumu: ' + (message || 'belirtilmedi');
    const schema = {
      type: 'object',
      properties: {
        weeks: { type: 'array', items: { type: 'object', properties: { week: { type: 'integer' }, theme: { type: 'string' } }, required: ['week', 'theme'] } },
        days: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              day: { type: 'integer' },
              nutrition: { type: 'string' },
              product: { type: 'string' },
              movement: { type: 'string' },
              motivation: { type: 'string' },
            },
            required: ['day', 'nutrition', 'product', 'movement', 'motivation'],
          },
        },
      },
      required: ['weeks', 'days'],
    };
    try {
      const { data, model } = await geminiGenerate(system, user, schema, PROGRAM_MODELS);
      const weeks = Array.isArray(data.weeks) ? data.weeks.slice(0, 4).map(w => ({ week: parseInt(w.week) || 0, theme: String(w.theme || '').slice(0, 140) })) : [];
      const days = Array.isArray(data.days) ? data.days.map(d => ({
        day: parseInt(d.day) || 0,
        nutrition: String(d.nutrition || '').slice(0, 220),
        product: String(d.product || '').slice(0, 160),
        movement: String(d.movement || '').slice(0, 220),
        motivation: String(d.motivation || '').slice(0, 220),
      })).filter(d => d.day >= 1 && d.day <= 30).sort((a, b) => a.day - b.day) : [];
      return res.json({ program: { weeks, days }, model });
    } catch (e) {
      console.error('coach program:', e.message);
      return res.status(502).json({ error: 'Program şu an oluşturulamadı, birazdan tekrar dene.' });
    }
  }

  /* ---- AŞAMA 1: hızlı sonuç + lead kapısı ---- */
  // lead kapısı: üye ise bilgisi var (bypass), misafir ise ad+e-posta+KVKK şart (lead yakalanır)
  const account = await currentUser(req);
  let person;
  if (account) {
    person = { name: account.name, email: account.email };
  } else {
    const lname = String(b.name || '').trim().slice(0, 120);
    const lmail = String(b.email || '').trim().slice(0, 160);
    const lphone = String(b.phone || '').trim().slice(0, 40);
    if (!lname || !emailRe.test(lmail)) return res.status(400).json({ error: 'Programın için adını ve geçerli bir e-posta gir.', needLead: true });
    if (!b.kvkk) return res.status(400).json({ error: 'Devam için KVKK onayı gerekli.', needLead: true });
    person = { name: lname, email: lmail };
    const noteParts = ['AI Koç 30 günlük program'];
    if (goal) noteParts.push('Hedef: ' + goal);
    if (lifestyle.length) noteParts.push('Yaşam: ' + lifestyle.map(k => LIFESTYLE_LABELS[k] || k).join(', '));
    if (budget) noteParts.push('Bütçe: ' + budget);
    const note = noteParts.join(' · ').slice(0, 500);
    try {
      await db.execute({ sql: 'INSERT INTO leads (name, phone, email, source, goal, note) VALUES (?, ?, ?, ?, ?, ?)', args: [lname, lphone, lmail, 'koc', goal || '', note] });
      notifyEmail('Yeni lead (AI Koç) — ' + lname, 'Yeni AI Koç lead\n' + lname + ' · ' + (lphone || lmail) + '\n' + note);
    } catch (e) { console.error('koc lead:', e.message); }
  }

  const cartText = cart.length ? cart.map(i => i.name + ' x' + i.qty).join(', ') : 'boş';

  const system =
    'Sen "Goodsoria" adlı bir Herbalife bağımsız distribütör platformunun akıllı beslenme ve yaşam koçusun. '
    + 'Görevin: kişiye (1) günlük bir ürün ritmi ve (2) MAĞAZADAKİ gerçek Herbalife ürünlerinden bir set kurmak.\n'
    + 'GENEL KURALLAR:\n'
    + '- Ürünleri SADECE aşağıdaki listeden seç; her öneride ürünün tam "slug" değerini kullan. Listede olmayan ürün UYDURMA.\n'
    + '- TIBBİ TAVSİYE VERME. plan içinde "Sonuçlar kişiden kişiye değişir; dengeli beslenme ve düzenli aktiviteyle birlikte değerlendir." fikrini doğal geçir.\n'
    + '- Türkçe, samimi ve net yaz.\n'
    + 'ÇIKTI ALANLARI:\n'
    + '- plan: 2-4 cümle kişisel özet. tips: 3-4 kısa gündelik ipucu.\n'
    + '- products: ürün seti. Her ürün: slug + when (yalnızca: sabah, ara öğün, öğle, akşam, gün boyu) + reason (kısa, yaşam tarzına atıfla). Bütçeye saygı göster (ekonomik=2-3, dengeli=3-4, kapsamlı=daha dolu).\n'
    + (cart.length ? '- cartAdvice: kullanıcının sepetindeki ürünleri değerlendir (onayla/tamamla/nazikçe alternatif). Sette sepettekini tekrar etme.\n' : '')
    + '\nMAĞAZADAKİ ÜRÜNLER (slug | ad | kategori | hedef | fiyat):\n' + list;

  const user = 'Kişi: ' + person.name
    + '\nHedef: ' + (goal || 'belirtilmedi')
    + '\nYaşam tarzı: ' + lifeText
    + '\nBütçe tercihi: ' + (BUDGET_LABELS[budget] || 'belirtilmedi')
    + '\nSepetindeki ürünler: ' + cartText
    + '\nKendi sözleriyle durumu: ' + (message || 'belirtilmedi')
    + (String(b.feedback || '').trim() ? '\nKullanıcı önceki öneriyi beğenmedi, şunu istedi (buna göre REVİZE et): ' + String(b.feedback).trim().slice(0, 500) : '');

  const schema = {
    type: 'object',
    properties: {
      plan: { type: 'string' },
      cartAdvice: { type: 'string' },
      tips: { type: 'array', items: { type: 'string' } },
      products: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            slug: { type: 'string' },
            when: { type: 'string', description: 'Yalnızca: sabah, ara öğün, öğle, akşam, gün boyu' },
            reason: { type: 'string' },
          },
          required: ['slug', 'when', 'reason'],
        },
      },
    },
    required: ['plan', 'products'],
  };

  try {
    const { data, model } = await geminiGenerate(system, user, schema);
    const bySlug = {}; cat.products.forEach(p => { bySlug[p.slug] = p; });
    const seen = new Set();
    const products = (data.products || []).map(rec => {
      const p = bySlug[rec.slug];
      if (!p || !p.stock || !p.price || seen.has(p.slug)) return null;
      seen.add(p.slug);
      let when = String(rec.when || '').toLowerCase().trim();
      if (!WHENS.includes(when)) when = 'gün boyu';
      return { slug: p.slug, name: p.name, price: p.price, old: p.old || null, cat: p.cat, catName: cat.catName(p.cat), img: cat.imgSrc(p), when, reason: String(rec.reason || '').slice(0, 240) };
    }).filter(Boolean);

    res.json({
      person: { name: person.name },
      plan: String(data.plan || '').slice(0, 1200),
      cartAdvice: cart.length ? String(data.cartAdvice || '').slice(0, 600) : '',
      tips: Array.isArray(data.tips) ? data.tips.slice(0, 6).map(t => String(t).slice(0, 200)) : [],
      products,
      model,
      disclaimer: 'Bu içerik genel bilgilendirme amaçlıdır, tıbbi tavsiye değildir. Sonuçlar kişiden kişiye değişir; dengeli beslenme ve düzenli aktiviteyle birlikte değerlendirilmelidir.',
    });
  } catch (e) {
    console.error('coach:', e.message);
    res.status(502).json({ error: 'AI yanıtı şu an alınamadı, birazdan tekrar dene.' });
  }
});

/* ---------- 30 günlük program (kayıtlı kullanıcı) ---------- */
// gün indeksi TÜRKİYE takvim gününe göre (UTC+3): her yeni TR günü 00:00'da bir sonraki güne geçer
const ELAPSED_SQL = "CAST(ROUND(julianday(date('now','+3 hours')) - julianday(date(created_at,'+3 hours'))) AS INTEGER) + 1 AS _elapsed";

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
  const task = String((req.body || {}).task || '');
  const done = !!(req.body || {}).done;
  if (!DAY_TASKS.includes(task)) return res.status(400).json({ error: 'Geçersiz görev.' });
  const r = await db.execute({ sql: `SELECT *, ${ELAPSED_SQL} FROM programs WHERE id = ? AND user_id = ?`, args: [id, req.user.id] });
  if (!r.rows.length) return res.status(404).json({ error: 'Program bulunamadı.' });
  const row = r.rows[0];
  const elapsed = clampInt(row._elapsed, 1, 30);
  if (day > elapsed) return res.status(400).json({ error: 'Bu günün görevleri henüz açılmadı.' });   // tarih kilidi: ileri gün işaretlenemez
  let arr; try { arr = JSON.parse(row.done_days || '[]'); } catch (e) { arr = []; }
  // bu gün için eski (task'sız) kaydı temizle + bu (day,task)'ı kaldır, sonra gerekiyorsa ekle
  arr = arr.filter(x => !(parseInt(x.day) === day && (!x.task || x.task === task)));
  if (done) arr.push({ day, task, ts: new Date().toISOString() });
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

/* ---------- 30 günlük program PDF (sunucu tarafı; gerçek dosya indirmesi) ----------
   Not: site CSS'i oklch kullandığından client html2canvas çalışmıyordu; PDF burada pdfkit ile üretilir. */
let _pdfFonts;
function pdfFonts() {
  if (_pdfFonts) return _pdfFonts;
  const fs = require('fs');
  _pdfFonts = {
    reg: fs.readFileSync(path.join(__dirname, 'fonts', 'DejaVuSans.ttf')),
    bold: fs.readFileSync(path.join(__dirname, 'fonts', 'DejaVuSans-Bold.ttf')),
  };
  return _pdfFonts;
}
const GOAL_LABELS = { kilo: 'Kilo vermek', kas: 'Kas & form', enerji: 'Enerji & canlılık', sindirim: 'Sindirim & hafiflik', genel: 'Genel sağlık' };
const WHEN_LABELS = { 'sabah': 'Sabah', 'ara öğün': 'Ara öğün', 'öğle': 'Öğle', 'akşam': 'Akşam', 'gün boyu': 'Gün boyu' };
function fmtTL(n) { n = Math.round(Number(n) || 0); return n.toLocaleString('tr-TR') + ' TL'; }

app.post('/api/program-pdf', async (req, res) => {
  const b = req.body || {};
  const days = Array.isArray(b.days) ? b.days.filter(d => d && parseInt(d.day) >= 1 && parseInt(d.day) <= 30).slice(0, 30) : [];
  if (!days.length) return res.status(400).json({ error: 'Program verisi eksik.' });
  let PDFDocument; try { PDFDocument = require('pdfkit'); } catch (e) { return res.status(500).json({ error: 'PDF motoru kullanılamıyor.' }); }
  let F; try { F = pdfFonts(); } catch (e) { return res.status(500).json({ error: 'PDF yazı tipi bulunamadı.' }); }

  const name = String(b.name || '').slice(0, 120);
  const goalLabel = GOAL_LABELS[String(b.goal || '')] || 'Genel sağlık';
  const plan = String(b.plan || '').slice(0, 1500);
  const products = Array.isArray(b.products) ? b.products.slice(0, 12) : [];
  const weeks = Array.isArray(b.weeks) ? b.weeks.slice(0, 4) : [];
  let dt = ''; try { dt = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) {}

  const GREEN = '#16623a', DARK = '#1c2b22', MUTED = '#6a7a6f', LINE = '#d8e0d8', MOTIV = '#3a6b46';
  const doc = new PDFDocument({ size: 'A4', margin: 50, info: { Title: 'Goodsoria 30 Gunluk Program', Author: 'Goodsoria' } });
  doc.registerFont('DV', F.reg); doc.registerFont('DVB', F.bold);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="Goodsoria-30-gunluk-program.pdf"');
  doc.pipe(res);

  const M = 50, W = doc.page.width - M * 2, BOT = doc.page.height - M;
  let y = M;
  const ensure = (h) => { if (y + h > BOT) { doc.addPage(); y = M; } };
  const line = (str, font, size, color, opts) => {
    doc.font(font).fontSize(size).fillColor(color);
    const o = Object.assign({ width: W }, opts || {});
    const h = doc.heightOfString(str, o);
    ensure(h);
    doc.text(str, M, y, o);
    y += h;
  };

  // başlık
  doc.font('DVB').fontSize(20).fillColor(GREEN).text('Goodsoria', M, y);
  doc.font('DV').fontSize(9).fillColor(MUTED).text(dt, M, y + 6, { width: W, align: 'right' });
  doc.font('DV').fontSize(9).fillColor(MUTED).text('Herbalife Bağımsız Distribütör Platformu', M, y + 25);
  y += 42;
  doc.moveTo(M, y).lineTo(M + W, y).lineWidth(2).strokeColor(GREEN).stroke(); y += 14;

  line('30 Günlük Kişisel Program', 'DVB', 16, '#11331f'); y += 3;
  line((name ? name + ' için · ' : '') + 'Hedef: ' + goalLabel, 'DV', 11, '#3a4a40'); y += 10;

  if (plan) {
    doc.font('DV').fontSize(10.5).fillColor(DARK);
    const ph = doc.heightOfString(plan, { width: W - 20 });
    ensure(ph + 16);
    doc.roundedRect(M, y, W, ph + 16, 8).fill('#f3f8f3');
    doc.fillColor(DARK).text(plan, M + 10, y + 8, { width: W - 20 });
    y += ph + 16 + 10;
  }

  if (products.length) {
    line('Önerilen Ürün Setin', 'DVB', 13, GREEN); y += 4;
    let total = 0;
    products.forEach(p => {
      total += Number(p.price) || 0;
      const w = WHEN_LABELS[String(p.when || '')] || '';
      line('•  ' + String(p.name || '') + (w ? '  (' + w + ')' : '') + '  —  ' + fmtTL(p.price), 'DV', 10.5, DARK);
      y += 2;
    });
    y += 2; line('Toplam: ' + fmtTL(total), 'DVB', 11, DARK, { align: 'right' }); y += 12;
  }

  if (weeks.length) {
    line('Haftalık Odak', 'DVB', 13, GREEN); y += 4;
    weeks.forEach(w => { line('• ' + (parseInt(w.week) || 0) + '. Hafta — ' + String(w.theme || ''), 'DV', 10.5, DARK); y += 2; });
    y += 10;
  }

  line('Günlük Takvim (1–30)', 'DVB', 13, GREEN); y += 6;
  days.sort((a, b) => (parseInt(a.day) || 0) - (parseInt(b.day) || 0)).forEach(d => {
    ensure(64);
    line(d.day + '. Gün', 'DVB', 11.5, '#11331f'); y += 2;
    line('Beslenme: ' + String(d.nutrition || ''), 'DV', 10, DARK);
    line('Ürün: ' + String(d.product || ''), 'DV', 10, DARK);
    line('Hareket: ' + String(d.movement || ''), 'DV', 10, DARK);
    if (d.motivation) line('“' + String(d.motivation) + '”', 'DV', 10, MOTIV);
    y += 9;
  });

  ensure(60);
  y += 4; doc.moveTo(M, y).lineTo(M + W, y).lineWidth(1).strokeColor(LINE).stroke(); y += 8;
  line('Sağlık bildirimi: Bu program genel bilgilendirme amaçlıdır, tıbbi tavsiye değildir. Sonuçlar kişiden kişiye değişir; dengeli beslenme ve düzenli aktiviteyle birlikte değerlendirilmelidir. Hareket önerileri hafif ve geneldir. Sağlık sorunun varsa programa başlamadan hekimine danış.', 'DV', 8.5, MUTED);
  y += 4;
  line('Bu belge bir Herbalife Bağımsız Distribütörü tarafından hazırlanmıştır ve Herbalife’ın resmî belgesi değildir. © 2026 Goodsoria.', 'DV', 8.5, MUTED);

  doc.end();
});

/* ---------- admin (yalnız role='admin') ---------- */
app.get('/api/admin/orders', requireAdmin, async (req, res) => {
  const r = await db.execute('SELECT * FROM orders ORDER BY id DESC LIMIT 500');
  res.json({ orders: r.rows.map(o => ({ ...o, items: JSON.parse(o.items || '[]') })) });
});
app.get('/api/admin/leads', requireAdmin, async (req, res) => {
  const r = await db.execute('SELECT * FROM leads ORDER BY id DESC LIMIT 500');
  res.json({ leads: r.rows });
});
app.post('/api/admin/orders/:id/status', requireAdmin, async (req, res) => {
  const st = String((req.body && req.body.status) || '');
  if (!['yeni', 'hazirlaniyor', 'kargoda', 'teslim', 'iptal'].includes(st)) return res.status(400).json({ error: 'Geçersiz durum.' });
  await db.execute({ sql: 'UPDATE orders SET status = ? WHERE id = ?', args: [st, parseInt(req.params.id) || 0] });
  res.json({ ok: true, status: st });
});
app.post('/api/admin/leads/:id/status', requireAdmin, async (req, res) => {
  const st = String((req.body && req.body.status) || '');
  if (!['yeni', 'arandi', 'kazanildi', 'kayip'].includes(st)) return res.status(400).json({ error: 'Geçersiz durum.' });
  await db.execute({ sql: 'UPDATE leads SET status = ? WHERE id = ?', args: [st, parseInt(req.params.id) || 0] });
  res.json({ ok: true, status: st });
});

/* ---------- statik site (public/; API'den SONRA) ---------- */
const PUBLIC = path.join(__dirname, 'public');
app.get('/', (req, res) => res.sendFile(path.join(PUBLIC, 'platform.html')));
app.use(express.static(PUBLIC, { extensions: ['html'] }));

/* ---------- başlat: yalnız doğrudan çalıştırılınca (Vercel'de app export edilir) ---------- */
if (require.main === module) {
  ready()
    .then(() => app.listen(PORT, () => console.log(`Goodsoria → http://localhost:${PORT}  (site + /api/*)`)))
    .catch((e) => { console.error('DB başlatma hatası:', e); process.exit(1); });
}

module.exports = app;
