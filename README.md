# Web Development Project

## Zenzy Clothing Wear – Online Billing System

---

---

## 📝 Project Description

It's an online billing (POS) website for a clothing store. Employees log in, select clothes, enter customer details (name, mobile, GST number, discount), generate and print the final bill, and every bill is saved permanently in a SQL database with its date, time and employee ID. A Sales Database page shows month-by-month and day-by-day sales.

**Tech stack:** HTML, CSS, JavaScript, Node.js, Express, SQLite

---

## 🚀 Deployment Link (Mandatory)

Live Project Link: https://zenzy-billing.onrender.com

> The site is on a free host that sleeps when unused, so the **first load can take 30–60 seconds**. Please wait, then refresh once if needed.

### 🔑 Login for testing

Click **Start New Billing** and log in with:

- **Email:** `2025kuec2051@iiitkota.ac.in`
- **Password:** `12345`

(Other employee emails also work with the same password: 2025kuec2054, 2025kuec2052, 2025kuec2053, 2025kuec2055, 2025kuec2058, 2025kuec2059, 2025kuec2060 — all `@iiitkota.ac.in`.)

---

## ✨ Features

- Employee login with a persistent session, ID shown in the navbar, and logout
- Product catalogue and billing screen with editable quantity and a remove (✕) button
- Customer name, mobile number, GST number and discount (%) on every bill
- Printable final bill
- All bills stored permanently in a SQL database (date, time, employee ID)
- Sales Database page: monthly sales, daily sales and all bills
- Demo data from July to today loaded automatically

---

## 💻 Run Locally

Requires Node.js 22.5 or newer.

```bash
npm install
npm start
```

Open http://localhost:3000

---

## 📁 Project Structure

```text
├── server.js        Express server + API
├── schema.sql       Database tables
├── seed-demo.js     Demo data generator
├── render.yaml      Hosting configuration
└── public/          Frontend (index.html, style.css, app.js)
```

---

## ℹ️ Note

The free host resets its disk when it restarts, so bills made on the live site may disappear later, and the demo data is recreated automatically.
