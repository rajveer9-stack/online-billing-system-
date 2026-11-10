// Fills the database with realistic DEMO bills for previous months and days,
// so the Sales Database page has data to show.
//
//   node seed-demo.js           -> adds demo data (only if there are no bills yet)
//   node seed-demo.js --reset   -> deletes ALL existing bills, then adds fresh demo data
//
// To go back to a completely empty database: stop the server and delete zenzy.db.

const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs');

const START_DATE = '2026-07-01';   // first day of demo data (YYYY-MM-DD); data runs up to today

const db = new DatabaseSync(process.env.DB_PATH || path.join(__dirname, 'zenzy.db'));
db.exec('PRAGMA foreign_keys = ON;');
db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

// ---- make sure employees & products exist (same data as server.js) ----
const EMPLOYEES = [
  '2025kuec2054@iiitkota.ac.in', '2025kuec2051@iiitkota.ac.in',
  '2025kuec2052@iiitkota.ac.in', '2025kuec2053@iiitkota.ac.in',
  '2025kuec2055@iiitkota.ac.in', '2025kuec2058@iiitkota.ac.in',
  '2025kuec2059@iiitkota.ac.in', '2025kuec2060@iiitkota.ac.in'
];
const PRODUCTS = [
  ['Z01', 'Zenzy Graphic T-Shirt', 599], ['Z02', 'Classic Polo Shirt', 899],
  ['Z03', 'Slim Fit Denim Jeans', 1299], ['Z04', 'Cotton Chinos', 1150],
  ['Z05', 'Winter Hoodie', 1499], ['Z06', 'Formal White Shirt', 999],
  ['Z07', 'Classic Black Crew Neck T-Shirt', 499], ['Z08', 'Blue Linen Casual Shirt', 1199],
  ['Z09', 'Plain White T-Shirt', 399], ['Z10', 'Casual Everyday Wear', 799],
  ['Z11', 'White Full Sleeve Sweatshirt', 1099], ['Z12', 'Classic Blue Jeans', 1399],
  ['Z13', 'Pink Cargo Joggers', 1299]
];
const hash = bcrypt.hashSync('12345', 10);
EMPLOYEES.forEach(e => db.prepare('INSERT OR IGNORE INTO users (email, password_hash) VALUES (?, ?)').run(e, hash));
PRODUCTS.forEach(p => db.prepare(
  'INSERT INTO products (id, name, price) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, price = excluded.price'
).run(...p));

// ---- safety check ----
const existing = db.prepare('SELECT COUNT(*) AS n FROM bills').get().n;
if (existing > 0) {
  if (!process.argv.includes('--reset')) {
    console.log(`The database already has ${existing} bill(s), so nothing was added.`);
    console.log('Run "node seed-demo.js --reset" to delete ALL bills and create fresh demo data.');
    process.exit(0);
  }
  db.exec('DELETE FROM bill_items; DELETE FROM bills; DELETE FROM sqlite_sequence WHERE name IN (\'bills\', \'bill_items\');');
  console.log(`Deleted ${existing} existing bill(s).`);
}

// ---- repeatable random numbers (same demo data every time) ----
let seed = 20261110;
function rand() {            // mulberry32
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const randInt = (a, b) => a + Math.floor(rand() * (b - a + 1));
const pick = arr => arr[Math.floor(rand() * arr.length)];
const pad = n => String(n).padStart(2, '0');

const FIRST = ['Aarav', 'Vivaan', 'Aditya', 'Rohan', 'Karan', 'Arjun', 'Rahul', 'Amit', 'Sanjay', 'Vikram', 'Neha', 'Priya', 'Anjali', 'Pooja', 'Sneha', 'Kavya', 'Riya', 'Meera', 'Deepak', 'Manish', 'Rajveer', 'Harsh', 'Nikhil', 'Pankaj', 'Divya'];
const LAST = ['Sharma', 'Verma', 'Patel', 'Gupta', 'Singh', 'Yadav', 'Joshi', 'Mehta', 'Jain', 'Chouhan', 'Rathore', 'Dubey', 'Tiwari', 'Malviya', 'Soni'];
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const ALNUM = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const randStr = (chars, n) => Array.from({ length: n }, () => chars[Math.floor(rand() * chars.length)]).join('');
const fakeGst = () => pick(['23', '08', '27', '07', '24']) + randStr(LETTERS, 5) + randStr('0123456789', 4) + randStr(LETTERS, 1) + randInt(1, 9) + 'Z' + randStr(ALNUM, 1);
const fakePhone = () => pick(['6', '7', '8', '9']) + randStr('0123456789', 9);

// ---- date range: START_DATE up to and including today (IST) ----
const nowIst = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
const today = Date.UTC(nowIst.getFullYear(), nowIst.getMonth(), nowIst.getDate());
const [sy, sm, sd] = START_DATE.split('-').map(Number);
const start = Date.UTC(sy, sm - 1, sd);
const nowTime = `${pad(nowIst.getHours())}:${pad(nowIst.getMinutes())}:${pad(nowIst.getSeconds())}`;
const DAY = 86400000;

const bills = [];
for (let t = start; t <= today; t += DAY) {
  const d = new Date(t);
  const date = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  const dow = d.getUTCDay();                                    // 0 = Sunday
  const month = d.getUTCMonth() + 1, day = d.getUTCDate();

  let mult = (dow === 0 || dow === 6) ? 1.6 : 1;                // busier weekends
  if ((month === 10 && day >= 18) || (month === 11 && day <= 8)) mult *= 1.8;  // festive season
  if (month === 12 || month === 1) mult *= 1.2;                 // winter sale (if range reaches it)
  if (rand() < 0.04) continue;                                  // occasional closed day

  const count = Math.max(2, Math.round(6 * mult * (0.6 + rand() * 0.8)));
  for (let i = 0; i < count; i++) {
    const time = `${pad(randInt(10, 20))}:${pad(randInt(0, 59))}:${pad(randInt(0, 59))}`;
    if (t === today && time > nowTime) continue;   // no bills in the future (today only goes up to the current time)

    const lineCount = pick([1, 1, 2, 2, 3, 4]);
    const chosen = [...PRODUCTS].sort(() => rand() - 0.5).slice(0, lineCount);
    const items = chosen.map(([id, name, price]) => {
      const quantity = pick([1, 1, 1, 2, 2, 3]);
      return { id, name, price, quantity, lineTotal: price * quantity };
    });

    const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
    const discountPercent = rand() < 0.6 ? 0 : pick([5, 10, 10, 15, 20]);
    const discount = Math.round(subtotal * discountPercent) / 100;   // same formula as the app

    bills.push({
      date, time, items, subtotal, discountPercent, discount,
      total: Math.round((subtotal - discount) * 100) / 100,
      employee: pick(EMPLOYEES),
      name: `${pick(FIRST)} ${pick(LAST)}`,
      phone: fakePhone(),
      gst: rand() < 0.25 ? fakeGst() : null
    });
  }
}
bills.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));   // oldest first

// ---- insert everything in one transaction ----
const insBill = db.prepare(`INSERT INTO bills
  (bill_no, employee_email, customer_name, customer_phone, gst_number, subtotal,
   discount_percent, discount_amount, total, bill_date, bill_time, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
const setNo = db.prepare('UPDATE bills SET bill_no = ? WHERE id = ?');
const insItem = db.prepare(`INSERT INTO bill_items
  (bill_id, product_id, product_name, unit_price, quantity, line_total) VALUES (?, ?, ?, ?, ?, ?)`);

db.exec('BEGIN');
try {
  bills.forEach((b, idx) => {
    const info = insBill.run('TMP-' + idx, b.employee, b.name, b.phone, b.gst, b.subtotal,
      b.discountPercent, b.discount, b.total, b.date, b.time, `${b.date} ${b.time}`);
    const id = Number(info.lastInsertRowid);
    setNo.run('ZENZY-' + String(id).padStart(5, '0'), id);
    b.items.forEach(i => insItem.run(id, i.id, i.name, i.price, i.quantity, i.lineTotal));
  });
  db.exec('COMMIT');
} catch (err) {
  db.exec('ROLLBACK');
  throw err;
}

// ---- summary ----
console.log(`\nAdded ${bills.length} demo bills from ${bills[0].date} to ${bills[bills.length - 1].date}.\n`);
console.log('Month      Bills   Revenue');
db.prepare(`SELECT substr(bill_date,1,7) AS m, COUNT(*) AS n, ROUND(SUM(total),2) AS s
            FROM bills GROUP BY m ORDER BY m`).all()
  .forEach(r => console.log(`${r.m}    ${String(r.n).padStart(5)}   ₹${r.s.toLocaleString('en-IN')}`));
console.log('\nNow start the server (npm start) and open the Database page.');
