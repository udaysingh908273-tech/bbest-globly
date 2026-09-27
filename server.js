/* =========================================================
   BBest Globly Store server v2 — zero dependencies
   Static storefront + Products + Orders + Customer Auth
   + Admin API + dynamic sitemap
   ========================================================= */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const PORT = process.env.PORT || 3000;
const DATA = path.join(ROOT, 'data');
const BASE_URL = (process.env.BASE_URL || 'https://REPLACE-WITH-YOUR-DOMAIN.example').replace(/\/+$/, '');
const ORDER_STATUSES = ['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
const RZP_KEY_ID = process.env.RAZORPAY_KEY_ID || '';
const RZP_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';
const paymentsReady = !!(RZP_KEY_ID && RZP_KEY_SECRET);
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webp': 'image/webp',
  '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8',
  '.mp4': 'video/mp4', '.mp3': 'audio/mpeg'
};

fs.mkdirSync(DATA, { recursive: true });

const fpath = f => path.join(DATA, f);
const readJSON = (f, d) => { try { return JSON.parse(fs.readFileSync(fpath(f), 'utf8')); } catch (e) { return d; } };
const writeJSON = (f, d) => fs.writeFileSync(fpath(f), JSON.stringify(d, null, 2));
const send = (res, code, body, type) => { res.writeHead(code, { 'Content-Type': type || 'application/json' }); res.end(body); };
const json = (res, code, obj) => send(res, code, JSON.stringify(obj));
const hashPw = (pw, salt) => crypto.scryptSync(String(pw), salt, 32).toString('hex');
const newSalt = () => crypto.randomBytes(16).toString('hex');
const newToken = () => crypto.randomBytes(32).toString('hex');

function readBody(req) {
  return new Promise((resolve, reject) => {
    let b = '';
    req.on('data', c => { b += c; if (b.length > 1e6) { reject(new Error('payload too large')); req.destroy(); } });
    req.on('end', () => { try { resolve(JSON.parse(b || '{}')); } catch (e) { reject(new Error('invalid JSON')); } });
  });
}
const loadCatalog = () => readJSON('products.json', []);
const loadOrders = () => readJSON('orders.json', []);
const saveOrders = o => writeJSON('orders.json', o);

/* ---- admin bootstrap (password saved to data/admin.json — never printed to chat/logs) ---- */
(function ensureAdmin() {
  if (fs.existsSync(fpath('admin.json'))) return;
  const salt = newSalt();
  const plain = crypto.randomBytes(9).toString('base64url');
  writeJSON('admin.json', {
    username: 'admin', salt, pass: hashPw(plain, salt), password_plain: plain,
    created: new Date().toISOString(),
    note: 'Owner reference only. In production set ADMIN_PASSWORD env var and delete password_plain.'
  });
  console.log('[admin] account created — password saved to data/admin.json');
})();

function getAuth(req) {
  const m = (req.headers['authorization'] || '').match(/^Bearer (.+)$/);
  if (!m) return null;
  const s = readJSON('sessions.json', {})[m[1]];
  if (!s || s.expires < Date.now()) return null;
  return { token: m[1], session: s };
}
function startSession(kind, id) {
  const sessions = readJSON('sessions.json', {});
  const token = newToken();
  sessions[token] = kind === 'admin'
    ? { admin: true, expires: Date.now() + 7 * 864e5 }
    : { customerId: id, expires: Date.now() + 7 * 864e5 };
  writeJSON('sessions.json', sessions);
  return token;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  let p;
  try { p = decodeURIComponent(url.pathname); } catch (e) { return json(res, 400, { error: 'bad path' }); }
  try {
    if (p === '/api/health') return json(res, 200, { ok: true, service: 'bbest-globly-store', version: 2.1, uptime: process.uptime() | 0, time: new Date().toISOString() });

    if (p === '/sitemap.xml' && req.method === 'GET') {
      const urls = ['', '/shop', '/track'].concat(loadCatalog().map(x => '/product/' + x.id));
      const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<!-- Set BASE_URL env var to your real domain before production -->\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
        urls.map(u => '  <url><loc>' + BASE_URL + u + '</loc></url>').join('\n') + '\n</urlset>';
      return send(res, 200, xml, 'application/xml; charset=utf-8');
    }

    if (p === '/api/products' && req.method === 'GET') return send(res, 200, fs.readFileSync(fpath('products.json')));

    /* ---------------- customer auth ---------------- */
    if (p === '/api/auth/register' && req.method === 'POST') {
      const b = await readBody(req);
      const name = String(b.name || '').trim(), email = String(b.email || '').trim().toLowerCase();
      const phone = String(b.phone || '').trim(), pw = String(b.password || '');
      if (name.length < 3) return json(res, 400, { error: 'Name must be at least 3 characters' });
      if (!/^\S+@\S+\.\S+$/.test(email)) return json(res, 400, { error: 'Invalid email address' });
      if (pw.length < 6) return json(res, 400, { error: 'Password must be at least 6 characters' });
      const customers = readJSON('customers.json', []);
      if (customers.some(c => c.email === email)) return json(res, 409, { error: 'This email is already registered — please login' });
      const salt = newSalt();
      const cust = {
        id: 'CUS-' + crypto.randomBytes(4).toString('hex').toUpperCase(),
        name, email, phone, pass: hashPw(pw, salt), salt, created: new Date().toISOString()
      };
      customers.push(cust); writeJSON('customers.json', customers);
      const token = startSession('customer', cust.id);
      console.log('[auth] registered:', email);
      return json(res, 201, { ok: true, token, customer: { name, email, phone } });
    }

    if (p === '/api/auth/login' && req.method === 'POST') {
      const b = await readBody(req);
      const email = String(b.email || '').trim().toLowerCase(), pw = String(b.password || '');
      const c = readJSON('customers.json', []).find(x => x.email === email);
      if (!c) return json(res, 401, { error: 'Invalid email or password' });
      const h = hashPw(pw, c.salt);
      const ok = h.length === c.pass.length && crypto.timingSafeEqual(Buffer.from(h), Buffer.from(c.pass));
      if (!ok) return json(res, 401, { error: 'Invalid email or password' });
      console.log('[auth] login:', email);
      return json(res, 200, { ok: true, token: startSession('customer', c.id), customer: { name: c.name, email: c.email, phone: c.phone } });
    }

    if (p === '/api/auth/logout' && req.method === 'POST') {
      const a = getAuth(req);
      if (a) { const sessions = readJSON('sessions.json', {}); delete sessions[a.token]; writeJSON('sessions.json', sessions); }
      return json(res, 200, { ok: true });
    }

    if (p === '/api/auth/me' && req.method === 'GET') {
      const a = getAuth(req);
      if (!a || !a.session.customerId) return json(res, 401, { error: 'not logged in' });
      const c = readJSON('customers.json', []).find(x => x.id === a.session.customerId);
      if (!c) return json(res, 401, { error: 'account not found' });
      return json(res, 200, { name: c.name, email: c.email, phone: c.phone });
    }

    /* ---------------- orders ---------------- */
    if (p === '/api/orders' && req.method === 'POST') {
      const b = await readBody(req);
      for (const k of ['name', 'phone', 'address', 'city', 'state', 'pincode']) {
        if (!b[k] || !String(b[k]).trim()) return json(res, 400, { error: 'missing field: ' + k });
      }
      if (!Array.isArray(b.items) || b.items.length === 0) return json(res, 400, { error: 'cart is empty' });
      const catalog = loadCatalog();
      const items = [];
      for (const i of b.items) {
        const prod = catalog.find(x => x.id === i.id);
        if (!prod) return json(res, 400, { error: 'unknown product: ' + i.id });
        const qty = Math.max(1, Math.min(10, Number(i.qty) | 0));
        items.push({ id: prod.id, name: prod.name, price_inr: prod.price_inr, qty, line_inr: prod.price_inr * qty });
      }
      const subtotal = items.reduce((s, i) => s + i.line_inr, 0);
      const id = 'BG-' + Date.now().toString(36).toUpperCase() + '-' + (100 + Math.floor(Math.random() * 900));
      const auth = getAuth(req);
      const order = {
        id, created: new Date().toISOString(), status: 'PENDING',
        customer_id: auth && auth.session.customerId ? auth.session.customerId : undefined,
        payment: { method: b.payment_method === 'online' ? 'UPI/Card (Razorpay)' : 'COD', paid: false },
        customer: {
          name: String(b.name).trim().slice(0, 80), phone: String(b.phone).trim().slice(0, 20),
          email: String(b.email || '').trim().slice(0, 80)
        },
        shipping: {
          address: String(b.address).trim().slice(0, 200), city: String(b.city).trim().slice(0, 60),
          state: String(b.state).trim().slice(0, 60), pincode: String(b.pincode).trim().slice(0, 12),
          country: String(b.country || 'India').trim().slice(0, 40)
        },
        items, totals: { subtotal_inr: subtotal, shipping_inr: 0, total_inr: subtotal }
      };
      const orders = loadOrders(); orders.push(order); saveOrders(orders);
      console.log('[order] placed:', id, 'total ₹' + order.totals.total_inr, order.customer_id ? '(customer ' + order.customer_id + ')' : '(guest)');
      return json(res, 201, { ok: true, orderId: id, total_inr: order.totals.total_inr });
    }

    if (p.startsWith('/api/order/') && req.method === 'GET') {
      const id = p.slice('/api/order/'.length);
      const o = loadOrders().find(x => x.id === id);
      if (!o) return json(res, 404, { error: 'order not found' });
      const safe = { ...o, customer: { name: o.customer.name, phone: '••••' + String(o.customer.phone).slice(-4), email: o.customer.email ? '•••' : '' } };
      return json(res, 200, safe);
    }

    if (p === '/api/my/orders' && req.method === 'GET') {
      const a = getAuth(req);
      if (!a || !a.session.customerId) return json(res, 401, { error: 'not logged in' });
      const c = readJSON('customers.json', []).find(x => x.id === a.session.customerId);
      if (!c) return json(res, 401, { error: 'account not found' });
      const mine = loadOrders()
        .filter(o => o.customer_id === c.id || (o.customer.email && o.customer.email.toLowerCase() === c.email))
        .reverse();
      return json(res, 200, mine);
    }

    /* ---------------- admin ---------------- */
    if (p === '/api/admin/login' && req.method === 'POST') {
      const b = await readBody(req);
      const admin = readJSON('admin.json', null);
      if (!admin) return json(res, 500, { error: 'admin not configured' });
      const userOk = String(b.username || '') === admin.username;
      const passOk = process.env.ADMIN_PASSWORD
        ? String(b.password || '') === process.env.ADMIN_PASSWORD
        : hashPw(String(b.password || ''), admin.salt) === admin.pass;
      if (!userOk || !passOk) return json(res, 401, { error: 'invalid credentials' });
      console.log('[admin] login ok');
      return json(res, 200, { ok: true, token: startSession('admin') });
    }

    if (p.startsWith('/api/admin/')) {
      const a = getAuth(req);
      if (!a || a.session.admin !== true) return json(res, 401, { error: 'admin access required' });
      if (p === '/api/admin/orders' && req.method === 'GET') return json(res, 200, loadOrders().reverse());
      if (p === '/api/admin/stats' && req.method === 'GET') {
        const orders = loadOrders();
        return json(res, 200, {
          orders: orders.length,
          pending: orders.filter(o => o.status === 'PENDING').length,
          revenue_inr: orders.filter(o => o.status !== 'CANCELLED').reduce((s, o) => s + o.totals.total_inr, 0),
          customers: readJSON('customers.json', []).length
        });
      }
      if (p === '/api/admin/order-status' && req.method === 'POST') {
        const b = await readBody(req);
        if (!b.id) return json(res, 400, { error: 'missing order id' });
        if (ORDER_STATUSES.indexOf(b.status) === -1) return json(res, 400, { error: 'invalid status' });
        const orders = loadOrders();
        const o = orders.find(x => x.id === b.id);
        if (!o) return json(res, 404, { error: 'order not found' });
        o.status = b.status; o.status_updated = new Date().toISOString();
        saveOrders(orders);
        console.log('[admin] order', b.id, '→', b.status);
        return json(res, 200, { ok: true, id: b.id, status: b.status });
      }
      return json(res, 404, { error: 'unknown admin route' });
    }

    /* ---------------- payments (Razorpay-ready — activates via env keys) ---------------- */
    if (p === '/api/payment/config' && req.method === 'GET') {
      return json(res, 200, { razorpay: { enabled: paymentsReady, key_id: paymentsReady ? RZP_KEY_ID : null } });
    }
    if (p === '/api/payment/order' && req.method === 'POST') {
      if (!paymentsReady) return json(res, 503, { error: 'payment gateway not configured (set RAZORPAY_KEY_ID & RAZORPAY_KEY_SECRET)' });
      const b = await readBody(req);
      const o = loadOrders().find(x => x.id === b.orderId);
      if (!o) return json(res, 404, { error: 'order not found' });
      if (o.status === 'CANCELLED') return json(res, 400, { error: 'order cancelled' });
      try {
        const r = await fetch('https://api.razorpay.com/v1/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Basic ' + Buffer.from(RZP_KEY_ID + ':' + RZP_KEY_SECRET).toString('base64') },
          body: JSON.stringify({ amount: o.totals.total_inr * 100, currency: 'INR', receipt: o.id, notes: { order_id: o.id } })
        });
        const d = await r.json();
        if (!r.ok) return json(res, 502, { error: (d && d.error && d.error.description) || 'gateway error' });
        console.log('[payment] gateway order created for', o.id);
        return json(res, 200, { ok: true, razorpay_order_id: d.id, amount: d.amount, currency: 'INR' });
      } catch (e) { return json(res, 502, { error: 'gateway unreachable' }); }
    }
    if (p === '/api/payment/verify' && req.method === 'POST') {
      if (!paymentsReady) return json(res, 503, { error: 'payment gateway not configured' });
      const b = await readBody(req);
      const expected = crypto.createHmac('sha256', RZP_KEY_SECRET).update(String(b.razorpay_order_id) + '|' + String(b.razorpay_payment_id)).digest('hex');
      if (expected !== String(b.razorpay_signature)) return json(res, 400, { error: 'payment signature mismatch' });
      const orders = loadOrders();
      const o = orders.find(x => x.id === b.orderId);
      if (!o) return json(res, 404, { error: 'order not found' });
      o.payment = { method: 'UPI/Card (Razorpay)', paid: true, payment_id: b.razorpay_payment_id, paid_at: new Date().toISOString() };
      if (o.status === 'PENDING') o.status = 'CONFIRMED';
      saveOrders(orders);
      console.log('[payment] verified:', o.id);
      return json(res, 200, { ok: true });
    }

    if (p.startsWith('/api/')) return json(res, 404, { error: 'unknown api route' });

    /* ---------------- static files ---------------- */
    const fp = p === '/' ? '/index.html' : p;
    const full = path.join(ROOT, path.normalize(fp));
    if (!full.startsWith(ROOT)) return json(res, 403, { error: 'forbidden' });
    fs.readFile(full, (err, data) => {
      if (err) {
        if (!path.extname(full)) {
          return fs.readFile(path.join(ROOT, 'index.html'), (e2, d2) => (e2 ? json(res, 404, { error: 'not found' }) : send(res, 200, d2, MIME['.html'])));
        }
        return json(res, 404, { error: 'not found' });
      }
      send(res, 200, data, MIME[path.extname(full).toLowerCase()] || 'application/octet-stream');
    });
  } catch (e) {
    json(res, 500, { error: 'server error: ' + e.message });
  }
});

server.listen(PORT, '0.0.0.0', () => console.log('BBest Globly store v2.1 listening on http://0.0.0.0:' + PORT));
