// ==========================================
// 1. INVENTORY & STATE
// ==========================================
// Prices here are for display only. The server has its own price list (server.js)
// and calculates every bill from that, so keep both in sync if you change a price.
const inventory = [
    { id: 'Z01', name: "Zenzy Graphic T-Shirt", price: 599, image: "https://assets.myntassets.com/w_412,q_50,,dpr_3,fl_progressive,f_webp/assets/images/22194038/2024/9/28/7159f452-c0b6-4cf6-98f7-f0bcff82f3021727530844469-VEIRDO-Graphic-Printed-Oversized-Fit-Cotton-T-shirt-42172753-1.jpg" },
    { id: 'Z02', name: "Classic Polo Shirt", price: 899, image: "https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=500&q=80" },
    { id: 'Z03', name: "Slim Fit Denim Jeans", price: 1299, image: "https://images.unsplash.com/photo-1542272604-787c3835535d?w=500&q=80" },
    { id: 'Z04', name: "Cotton Chinos", price: 1150, image: "https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=500&q=80" },
    { id: 'Z05', name: "Winter Hoodie", price: 1499, image: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=500&q=80" },
    { id: 'Z06', name: "Formal White Shirt", price: 999, image: "https://www.myntra.com/shirts/hancock/hancock-men-white-slim-fit-solid-formal-shirt/11103910/buy" },
    { id: 'Z07', name: "Classic Black Crew Neck T-Shirt", price: 499, image: "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=500&q=80" },
    { id: 'Z08', name: "Blue Linen Casual Shirt", price: 1199, image: "https://images.unsplash.com/photo-1740711152088-88a009e877bb?w=500&q=80" },
    { id: 'Z09', name: "Plain White T-Shirt", price: 399, image: "https://images.unsplash.com/photo-1778671394516-8270eac13c42?w=500&q=80" },
    { id: 'Z10', name: "Casual Everyday Wear", price: 799, image: "https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=500&q=80" },
    { id: 'Z11', name: "White Full Sleeve Sweatshirt", price: 1099, image: "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=500&q=80" },
    { id: 'Z12', name: "Classic Blue Jeans", price: 1399, image: "https://images.unsplash.com/photo-1714143136372-ddaf8b606da7?w=500&q=80" },
    { id: 'Z13', name: "Pink Cargo Joggers", price: 1299, image: "https://images.unsplash.com/photo-1789110520495-8f1b8545c0ff?w=500&q=80" }
];

let cart = [];
let currentUser = null;   // logged-in employee email (null = logged out)
let pendingPage = null;   // page to open after a successful login

// Shown when a product image fails to load (e.g. a bad URL)
const IMAGE_FALLBACK = "data:image/svg+xml;utf8," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="100%" height="100%" fill="#e2e8f0"/>' +
    '<text x="50%" y="50%" fill="#64748b" font-family="sans-serif" font-size="20" text-anchor="middle">No image</text></svg>'
);

// ==========================================
// 2. HELPERS & API
// ==========================================
function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function api(path, options = {}) {
    const opts = { method: options.method || 'GET', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } };
    if (options.body) opts.body = JSON.stringify(options.body);
    const res = await fetch(path, opts);
    let data = {};
    try { data = await res.json(); } catch (e) {}
    // Session expired / not logged in -> show login popup
    if (res.status === 401 && path !== '/api/login') { setUser(null); openLogin(); }
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
}

// ==========================================
// 3. AUTHENTICATION
// ==========================================
function setUser(email) {
    currentUser = email;
    document.getElementById('user-menu').style.display = email ? 'block' : 'none';
    document.getElementById('user-dropdown').classList.remove('show');
    if (email) {
        document.getElementById('employee-id-label').textContent = email.split('@')[0];
        document.getElementById('employee-email-full').textContent = email;
    }
}

function openLogin(nextPage) {
    if (nextPage) pendingPage = nextPage;
    document.getElementById('login-error').textContent = '';
    document.getElementById('login-password').value = '';
    document.getElementById('login-modal').classList.add('show');
    document.getElementById('login-email').focus();
}

function cancelLogin() {
    pendingPage = null;
    document.getElementById('login-modal').classList.remove('show');
}

async function submitLogin() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const btn = document.getElementById('login-continue');
    btn.disabled = true;
    try {
        const data = await api('/api/login', { method: 'POST', body: { email, password } });
        setUser(data.email);
        document.getElementById('login-modal').classList.remove('show');
        const next = pendingPage; pendingPage = null;
        if (next) switchPage(next);
    } catch (err) {
        document.getElementById('login-error').textContent = err.message;
    } finally {
        btn.disabled = false;
    }
}

async function logout() {
    try { await api('/api/logout', { method: 'POST' }); } catch (e) {}
    setUser(null);
    cart = [];
    updateCartUI();
    switchPage('home-page');
}

function toggleUserDropdown(event) {
    event.stopPropagation();
    document.getElementById('user-dropdown').classList.toggle('show');
}
document.addEventListener('click', () => document.getElementById('user-dropdown').classList.remove('show'));
document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && document.getElementById('login-modal').classList.contains('show')) submitLogin();
});

// ==========================================
// 4. PAGE NAVIGATION LOGIC
// ==========================================
function switchPage(pageId) {
    // Billing and the sales database need an active employee session
    if ((pageId === 'order-page' || pageId === 'database-page') && !currentUser) {
        openLogin(pageId);
        return;
    }

    document.querySelectorAll('.page').forEach(page => page.classList.remove('active-page'));
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));

    document.getElementById(pageId).classList.add('active-page');
    const navBtn = document.getElementById(`nav-${pageId}`);
    if (navBtn) navBtn.classList.add('active');

    if (pageId === 'products-page') renderProducts('full-catalog-grid', false);
    if (pageId === 'order-page') renderProducts('order-catalog-grid', true);
    if (pageId === 'database-page') renderDatabase();
}

// ==========================================
// 5. PRODUCTS CATALOG RENDERER
// ==========================================
function renderProducts(containerId, isClickable) {
    const container = document.getElementById(containerId);
    container.innerHTML = inventory.map(product => `
        <div class="product-card" ${isClickable ? `onclick='addToCart("${product.id}")'` : ''}>
            <img src="${product.image}" alt="${product.name}" class="product-image" onerror="this.onerror=null;this.src=IMAGE_FALLBACK;">
            <h4>${product.name}</h4>
            <span class="price">₹${product.price}</span>
            ${isClickable ? '<p style="font-size:0.85rem; color:#10b981; margin-top:8px; font-weight:bold;">+ Click to Add to Bill</p>' : ''}
        </div>
    `).join('');
}

// ==========================================
// 6. CART (BILLING) LOGIC
// ==========================================
function addToCart(productId) {
    const product = inventory.find(p => p.id === productId);
    const existingItem = cart.find(item => item.id === productId);

    if (existingItem) {
        existingItem.quantity = Math.min(existingItem.quantity + 1, 1000);
    } else {
        cart.push({ ...product, quantity: 1 });
    }
    updateCartUI();
}

// Called when the quantity input is edited
function setQuantity(productId, value) {
    const item = cart.find(i => i.id === productId);
    if (!item) return;
    let qty = parseInt(value, 10);
    if (isNaN(qty) || qty < 1) qty = 1;
    item.quantity = Math.min(qty, 1000);
    updateCartUI();
}

// The X button: remove the item completely
function removeFromCart(productId) {
    cart = cart.filter(i => i.id !== productId);
    updateCartUI();
}

// Reads the "Discount Given" field (percentage). Empty/invalid/negative = 0.
function getDiscountPercent() {
    const value = parseFloat(document.getElementById('discount-given').value);
    return (isNaN(value) || value < 0) ? 0 : value;
}

// Converts a discount percentage into a rupee amount (rounded to 2 decimals)
function calculateDiscountAmount(subtotal, percent) {
    return Math.round(subtotal * percent) / 100;
}

function updateCartUI() {
    const cartContainer = document.getElementById('cart-items');
    const subtotalEl = document.getElementById('subtotal-amount');
    const discountEl = document.getElementById('discount-amount');

    if (cart.length === 0) {
        cartContainer.innerHTML = '<div class="empty-cart">No clothes added to the order.</div>';
        subtotalEl.textContent = '₹0.00';
        discountEl.textContent = '- ₹0.00 (0%)';
        document.getElementById('grand-total').textContent = '₹0.00';
        return;
    }

    cartContainer.innerHTML = cart.map(item => `
        <div class="cart-item">
            <div class="cart-item-info">
                <strong>${escapeHtml(item.name)}</strong><br>
                <span style="font-size:0.9rem; color:#64748b;">₹${item.price} each</span>
            </div>
            <div class="cart-item-controls">
                <input type="number" class="qty-input" min="1" max="1000" step="1" value="${item.quantity}"
                       onchange="setQuantity('${item.id}', this.value)" aria-label="Quantity">
                <strong style="min-width:70px; text-align:right; color:var(--primary);">₹${item.price * item.quantity}</strong>
                <button class="remove-btn" title="Remove item" onclick="removeFromCart('${item.id}')">✕</button>
            </div>
        </div>
    `).join('');

    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    // Discount % is capped at 100 so the total never goes negative
    const percent = Math.min(getDiscountPercent(), 100);
    const discount = calculateDiscountAmount(subtotal, percent);
    const total = subtotal - discount;

    subtotalEl.textContent = `₹${subtotal.toFixed(2)}`;
    discountEl.textContent = `- ₹${discount.toFixed(2)} (${percent}%)`;
    document.getElementById('grand-total').textContent = `₹${total.toFixed(2)}`;
}

// ==========================================
// 7. CHECKOUT (saves the bill on the server)
// ==========================================
async function generateBill() {
    const customerName = document.getElementById('customer-name').value.trim();
    const customerPhone = document.getElementById('customer-phone').value.trim();
    const gstNumber = document.getElementById('customer-gst').value.trim().toUpperCase();
    const discountPercent = getDiscountPercent();

    if (!customerName || !customerPhone) return alert("Please enter Customer Name and Mobile Number.");
    if (cart.length === 0) return alert("Please add at least one item to the cart before generating a bill.");
    if (discountPercent > 100) return alert("Discount cannot be more than 100%.");
    if (gstNumber && !/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstNumber)) {
        return alert("Please enter a valid 15-character GST number (or leave it empty).");
    }

    const btn = document.querySelector('.generate-bill-btn');
    btn.disabled = true;
    try {
        const { bill } = await api('/api/bills', {
            method: 'POST',
            body: {
                customerName, customerPhone, gstNumber, discountPercent,
                items: cart.map(i => ({ id: i.id, quantity: i.quantity }))
            }
        });

        // Reset form & cart for the next customer
        document.getElementById('customer-name').value = '';
        document.getElementById('customer-phone').value = '';
        document.getElementById('customer-gst').value = '';
        document.getElementById('discount-given').value = '';
        cart = [];
        updateCartUI();

        showBill(bill);
    } catch (err) {
        alert(err.message);   // a 401 here already re-opens the login popup
    } finally {
        btn.disabled = false;
    }
}

// ==========================================
// 8. FINAL BILL (RECEIPT) VIEW
// ==========================================
function showBill(order) {
    const itemRows = order.items.map(item => `
        <tr>
            <td>${escapeHtml(item.name)}</td>
            <td class="num">${item.quantity}</td>
            <td class="num">₹${item.price}</td>
            <td class="num">₹${item.price * item.quantity}</td>
        </tr>
    `).join('');

    const [y, m, d] = order.date.split('-');

    document.getElementById('bill-content').innerHTML = `
        <div class="bill-meta">
            <div><strong>Bill No:</strong> ${escapeHtml(order.orderId)}</div>
            <div><strong>Date:</strong> ${d}/${m}/${y} &nbsp; ${escapeHtml(order.time)}</div>
            <div><strong>Customer:</strong> ${escapeHtml(order.name)}</div>
            <div><strong>Mobile:</strong> ${escapeHtml(order.phone)}</div>
            <div><strong>GST No:</strong> ${order.gst ? escapeHtml(order.gst) : '—'}</div>
            <div><strong>Billed by:</strong> ${escapeHtml(order.employee)}</div>
        </div>

        <table class="bill-table">
            <thead>
                <tr>
                    <th>Product</th>
                    <th class="num">Qty</th>
                    <th class="num">Price</th>
                    <th class="num">Amount</th>
                </tr>
            </thead>
            <tbody>${itemRows}</tbody>
        </table>

        <div class="bill-summary">
            <div class="summary-row"><span>Subtotal:</span><span>₹${order.subtotal.toFixed(2)}</span></div>
            <div class="summary-row"><span>Discount (${order.discountPercent}%):</span><span>- ₹${order.discount.toFixed(2)}</span></div>
            <div class="total-row"><span>Final Total:</span><span>₹${order.total.toFixed(2)}</span></div>
        </div>
    `;

    document.getElementById('bill-modal').classList.add('show');
}

function closeBill() {
    document.getElementById('bill-modal').classList.remove('show');
    // Go to the database page to see the saved record
    switchPage('database-page');
}

// ==========================================
// 9. SALES DATABASE PAGE
// ==========================================
function formatMonth(ym) {
    const [y, m] = ym.split('-');
    return new Date(y, m - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
}
function formatDay(iso) {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
}

async function renderDatabase() {
    try {
        const [analytics, bills] = await Promise.all([api('/api/analytics'), api('/api/bills')]);

        document.getElementById('total-orders-count').textContent = analytics.summary.bills;
        document.getElementById('total-sales-amount').textContent = `₹${analytics.summary.sales.toFixed(2)}`;

        const empty = cols => `<tr><td colspan="${cols}" style="text-align:center; padding:20px; color:#64748b;">No data yet. Start billing to see records here.</td></tr>`;

        document.getElementById('monthly-table-body').innerHTML = analytics.monthly.length
            ? analytics.monthly.map(r => `<tr><td>${formatMonth(r.month)}</td><td>${r.bills}</td><td style="color:#10b981; font-weight:bold;">₹${r.sales.toFixed(2)}</td></tr>`).join('')
            : empty(3);

        document.getElementById('daily-table-body').innerHTML = analytics.daily.length
            ? analytics.daily.map(r => `<tr><td>${formatDay(r.date)}</td><td>${r.bills}</td><td style="color:#10b981; font-weight:bold;">₹${r.sales.toFixed(2)}</td></tr>`).join('')
            : empty(3);

        document.getElementById('db-table-body').innerHTML = bills.length
            ? bills.map(b => `
                <tr>
                    <td><strong>${escapeHtml(b.orderId)}</strong></td>
                    <td>${formatDay(b.date)}<br><span style="color:#64748b; font-size:0.85rem;">${escapeHtml(b.time)}</span></td>
                    <td style="font-size:0.85rem;">${escapeHtml(b.employee)}</td>
                    <td>${escapeHtml(b.name)}</td>
                    <td>${escapeHtml(b.phone)}</td>
                    <td>${b.gst ? escapeHtml(b.gst) : '—'}</td>
                    <td style="font-size:0.95rem; color:#334155;">${escapeHtml(b.itemsSummary)}</td>
                    <td style="color:#64748b;">${b.discountPercent}% (₹${b.discount.toFixed(2)})</td>
                    <td style="color:#10b981; font-weight:bold;">₹${b.total.toFixed(2)}</td>
                </tr>`).join('')
            : empty(9);
    } catch (err) {
        console.error(err);
    }
}

// ==========================================
// 10. INITIALISE
// ==========================================
window.onload = async () => {
    try {
        const { email } = await api('/api/me');   // restores the login after refresh / browser restart
        setUser(email);
    } catch (e) {}
    switchPage('home-page');
};