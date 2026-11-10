const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite'); // built into Node 22.5+ (no install / compile needed)
const bcrypt = require('bcryptjs');

const PORT = process.env.PORT || 3000;
const COOKIE_NAME = 'zenzy_sid';
const TEN_YEARS_MS = 10 * 365 * 24 * 60 * 60 * 1000; // "indefinite" login until explicit logout

// ---------- Database ----------
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'zenzy.db');
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA foreign_keys = ON;');
db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

// Hard-coded employees (all share password 12345)
const EMPLOYEES = [
  '2025kuec2054@iiitkota.ac.in', '2025kuec2051@iiitkota.ac.in',
  '2025kuec2052@iiitkota.ac.in', '2025kuec2053@iiitkota.ac.in',
  '2025kuec2055@iiitkota.ac.in', '2025kuec2058@iiitkota.ac.in',
  '2025kuec2059@iiitkota.ac.in', '2025kuec2060@iiitkota.ac.in'
];
const hash = bcrypt.hashSync('12345', 10);
const seedUser = db.prepare('INSERT OR IGNORE INTO users (email, password_hash) VALUES (?, ?)');
EMPLOYEES.forEach(e => seedUser.run(e, hash));

// Same catalogue as the frontend's `inventory` (prices are authoritative HERE)
const PRODUCTS = [
  ['Z01', 'Zenzy Graphic T-Shirt', 599], ['Z02', 'Classic Polo Shirt', 899],
  ['Z03', 'Slim Fit Denim Jeans', 1299], ['Z04', 'Cotton Chinos', 1150],
  ['Z05', 'Winter Hoodie', 1499], ['Z06', 'Formal White Shirt', 999],
  ['Z07', 'Classic Black Crew Neck T-Shirt', 499], ['Z08', 'Blue Linen Casual Shirt', 1199],
  ['Z09', 'Plain White T-Shirt', 399], ['Z10', 'Casual Everyday Wear', 799],
  ['Z11', 'White Full Sleeve Sweatshirt', 1099], ['Z12', 'Classic Blue Jeans', 1399],
  ['Z13', 'Pink Cargo Joggers', 1299]
];
const upsertProduct = db.prepare(
  'INSERT INTO products (id, name, price) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, price = excluded.price'
);
PRODUCTS.forEach(p => upsertProduct.run(...p));

// On free hosting the disk is wiped on every restart, so when AUTO_SEED=true and the
// database has no bills, the demo data (July -> today) is created automatically.
if (process.env.AUTO_SEED === 'true' && db.prepare('SELECT COUNT(*) AS n FROM bills').get().n === 0) {
  try {
    require('child_process').execFileSync(process.execPath, [path.join(__dirname, 'seed-demo.js')], { stdio: 'inherit', env: process.env });
  } catch (err) {
    console.error('Demo seeding failed:', err.message);
  }
}

// ---------- Helpers ----------
const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');
const round2 = n => Math.round(n * 100) / 100;

function parseCookies(header = '') {
  return Object.fromEntries(
    header.split(';').map(c => c.trim()).filter(Boolean).map(c => {
      const i = c.indexOf('=');
      return [c.slice(0, i), decodeURIComponent(c.slice(i + 1))];
    })
  );
}

// Current date/time in India (so "today" and monthly totals match the shop's clock)
function istNow() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date());
  const g = t => parts.find(p => p.type === t).value;
  return { date: `${g('year')}-${g('month')}-${g('day')}`, time: `${g('hour')}:${g('minute')}:${g('second')}` };
}

// ---------- Prepared statements ----------
const q = {
  userByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
  insertSession: db.prepare('INSERT INTO sessions (token_hash, email) VALUES (?, ?)'),
  sessionUser: db.prepare('SELECT email FROM sessions WHERE token_hash = ?'),
  deleteSession: db.prepare('DELETE FROM sessions WHERE token_hash = ?'),
  product: db.prepare('SELECT * FROM products WHERE id = ?'),
  insertBill: db.prepare(`INSERT INTO bills
    (bill_no, employee_email, customer_name, customer_phone, gst_number, subtotal,
     discount_percent, discount_amount, total, bill_date, bill_time)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
  setBillNo: db.prepare('UPDATE bills SET bill_no = ? WHERE id = ?'),
  insertItem: db.prepare(`INSERT INTO bill_items (bill_id, product_id, product_name, unit_price, quantity, line_total)
    VALUES (?, ?, ?, ?, ?, ?)`),
  recentBills: db.prepare(`SELECT b.*,
      (SELECT group_concat(product_name || ' (x' || quantity || ')', ', ') FROM bill_items WHERE bill_id = b.id) AS items_summary
    FROM bills b ORDER BY b.id DESC LIMIT 200`),
  summary: db.prepare('SELECT COUNT(*) AS bills, COALESCE(ROUND(SUM(total), 2), 0) AS sales FROM bills'),
  daily: db.prepare(`SELECT bill_date AS date, COUNT(*) AS bills, ROUND(SUM(total), 2) AS sales
    FROM bills GROUP BY bill_date ORDER BY bill_date DESC LIMIT 366`),
  monthly: db.prepare(`SELECT substr(bill_date, 1, 7) AS month, COUNT(*) AS bills, ROUND(SUM(total), 2) AS sales
    FROM bills GROUP BY substr(bill_date, 1, 7) ORDER BY month DESC`)
};

// Saves the bill and all its items atomically (all or nothing)
function createBill(data) {
  db.exec('BEGIN');
  try {
    const info = q.insertBill.run(
      'PENDING-' + crypto.randomUUID(), data.employee, data.name, data.phone, data.gst, data.subtotal,
      data.discountPercent, data.discount, data.total, data.date, data.time
    );
    const id = Number(info.lastInsertRowid);
    const billNo = 'ZENZY-' + String(id).padStart(5, '0');
    q.setBillNo.run(billNo, id);
    data.items.forEach(i => q.insertItem.run(id, i.id, i.name, i.price, i.quantity, i.lineTotal));
    db.exec('COMMIT');
    return billNo;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

// ---------- App ----------
const app = express();
app.set('trust proxy', 1);   // needed behind Render's HTTPS proxy
app.use(express.json({ limit: '100kb' }));

function requireAuth(req, res, next) {
  const token = parseCookies(req.headers.cookie)[COOKIE_NAME];
  const row = token && q.sessionUser.get(sha256(token));
  if (!row) return res.status(401).json({ error: 'Please log in.' });
  req.user = row.email;
  next();
}

// --- Auth ---
app.post('/api/login', (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const user = q.userByEmail.get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }
  const token = crypto.randomBytes(32).toString('hex');
  q.insertSession.run(sha256(token), user.email);
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true, sameSite: 'lax', maxAge: TEN_YEARS_MS,
    secure: process.env.NODE_ENV === 'production'
  });
  res.json({ email: user.email });
});

app.post('/api/logout', (req, res) => {
  const token = parseCookies(req.headers.cookie)[COOKIE_NAME];
  if (token) q.deleteSession.run(sha256(token));
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

app.get('/api/me', (req, res) => {
  const token = parseCookies(req.headers.cookie)[COOKIE_NAME];
  const row = token && q.sessionUser.get(sha256(token));
  res.json({ email: row ? row.email : null });
});

// --- Bills ---
const GST_REGEX = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

app.post('/api/bills', requireAuth, (req, res) => {
  const { customerName, customerPhone, gstNumber, discountPercent, items } = req.body;
  const name = String(customerName || '').trim();
  const phone = String(customerPhone || '').trim();
  const gst = String(gstNumber || '').trim().toUpperCase();
  const percent = Number(discountPercent || 0);

  if (!name || !phone) return res.status(400).json({ error: 'Customer name and mobile number are required.' });
  if (!/^[0-9+\-\s]{7,15}$/.test(phone)) return res.status(400).json({ error: 'Invalid mobile number.' });
  if (gst && !GST_REGEX.test(gst)) return res.status(400).json({ error: 'Invalid GST number format.' });
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    return res.status(400).json({ error: 'Discount must be between 0 and 100%.' });
  }
  if (!Array.isArray(items) || items.length === 0 || items.length > 100) {
    return res.status(400).json({ error: 'Add at least one item.' });
  }

  // Rebuild line items from DB prices (ignores any price sent by the browser)
  const lines = [];
  for (const it of items) {
    const product = q.product.get(String(it.id));
    const qty = Number(it.quantity);
    if (!product) return res.status(400).json({ error: `Unknown product: ${it.id}` });
    if (!Number.isInteger(qty) || qty < 1 || qty > 1000) {
      return res.status(400).json({ error: `Invalid quantity for ${product.name}.` });
    }
    lines.push({ id: product.id, name: product.name, price: product.price, quantity: qty, lineTotal: product.price * qty });
  }

  const subtotal = round2(lines.reduce((s, l) => s + l.lineTotal, 0));
  const discount = Math.round(subtotal * percent) / 100;      // same formula as the frontend
  const total = round2(subtotal - discount);
  const { date, time } = istNow();

  const billNo = createBill({
    employee: req.user, name, phone, gst: gst || null, subtotal,
    discountPercent: percent, discount, total, date, time, items: lines
  });

  res.status(201).json({
    bill: {
      orderId: billNo, name, phone, gst, employee: req.user, date, time,
      items: lines.map(l => ({ name: l.name, price: l.price, quantity: l.quantity })),
      subtotal, discountPercent: percent, discount, total
    }
  });
});

app.get('/api/bills', requireAuth, (req, res) => {
  res.json(q.recentBills.all().map(b => ({
    orderId: b.bill_no, name: b.customer_name, phone: b.customer_phone, gst: b.gst_number,
    employee: b.employee_email, date: b.bill_date, time: b.bill_time,
    itemsSummary: b.items_summary, discountPercent: b.discount_percent,
    discount: b.discount_amount, total: b.total
  })));
});

// --- Sales analytics ---
app.get('/api/analytics', requireAuth, (req, res) => {
  res.json({ summary: q.summary.get(), daily: q.daily.all(), monthly: q.monthly.all() });
});

// --- Frontend (put index.html, app.js, style.css inside ./public) ---
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => console.log(`Zenzy POS running at http://localhost:${PORT}`));