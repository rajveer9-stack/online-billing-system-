PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
    email         TEXT PRIMARY KEY,               
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);


CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    email      TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);


CREATE TABLE IF NOT EXISTS products (
    id    TEXT PRIMARY KEY,
    name  TEXT NOT NULL,
    price REAL NOT NULL CHECK (price >= 0)
);

CREATE TABLE IF NOT EXISTS bills (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    bill_no          TEXT NOT NULL UNIQUE,
    employee_email   TEXT NOT NULL REFERENCES users(email),
    customer_name    TEXT NOT NULL,
    customer_phone   TEXT NOT NULL,
    gst_number       TEXT,
    subtotal         REAL NOT NULL,
    discount_percent REAL NOT NULL DEFAULT 0,
    discount_amount  REAL NOT NULL DEFAULT 0,
    total            REAL NOT NULL,
    bill_date        TEXT NOT NULL,             
    bill_time        TEXT NOT NULL,               
    created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);


CREATE TABLE IF NOT EXISTS bill_items (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    bill_id      INTEGER NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
    product_id   TEXT NOT NULL,
    product_name TEXT NOT NULL,
    unit_price   REAL NOT NULL,
    quantity     INTEGER NOT NULL CHECK (quantity > 0),
    line_total   REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bills_date     ON bills(bill_date);
CREATE INDEX IF NOT EXISTS idx_bills_employee ON bills(employee_email);
CREATE INDEX IF NOT EXISTS idx_items_bill     ON bill_items(bill_id);
