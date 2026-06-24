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
  await db.execute(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    ono TEXT NOT NULL,
    items TEXT NOT NULL,
    total INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'hazir',
    address TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
  await db.execute(`CREATE TABLE IF NOT EXISTS favorites (
    user_id INTEGER NOT NULL,
    product TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, product)
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
async function currentUser(req) {
  const t = req.cookies && req.cookies[COOKIE];
  if (!t) return null;
  try { return await getUserById(jwt.verify(t, JWT_SECRET).id); } catch (e) { return null; }
}
async function requireAuth(req, res, next) {
  const u = await currentUser(req);
  if (!u) return res.status(401).json({ error: 'Bu işlem için giriş yapmalısın.' });
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
    const user = await getUserById(Number(ins.lastInsertRowid));
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
  const orders = r.rows.map(o => ({ id: o.id, ono: o.ono, items: JSON.parse(o.items || '[]'), total: o.total, status: o.status, created_at: o.created_at }));
  res.json({ orders });
});

app.post('/api/orders', requireAuth, async (req, res) => {
  const { items, address } = req.body || {};
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'Sepet boş.' });
  const clean = items.map(i => ({ name: String(i.name || '').slice(0, 120), price: Math.max(0, parseInt(i.price) || 0), qty: Math.max(1, parseInt(i.qty) || 1) }));
  const total = clean.reduce((s, i) => s + i.price * i.qty, 0);
  const ono = 'GD-' + Math.floor(100000 + Math.random() * 900000);
  const ins = await db.execute({ sql: 'INSERT INTO orders (user_id, ono, items, total, status, address) VALUES (?, ?, ?, ?, ?, ?)', args: [req.user.id, ono, JSON.stringify(clean), total, 'hazir', String(address || '').slice(0, 400)] });
  res.json({ order: { id: Number(ins.lastInsertRowid), ono, items: clean, total, status: 'hazir' } });
});

app.get('/api/favorites', requireAuth, async (req, res) => {
  const r = await db.execute({ sql: 'SELECT product FROM favorites WHERE user_id = ?', args: [req.user.id] });
  res.json({ favorites: r.rows.map(x => x.product) });
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
