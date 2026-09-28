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
const loadBusinessKnowledge = () => readJSON('business_knowledge.json', {
  brand:'BBest Globly', business_type:'Ecommerce store', markets:['India','Worldwide'],
  catalogue_categories:['Tech','Wellness','Home','Pet'],
  decision_rules:{require_owner_approval_for_public_product_publish:true,require_owner_approval_for_public_site_redesign:true},
  tone:'Professional, practical, transparent about uncertainty'
});
const loadSiteConfig = () => readJSON('site_config.json', {
  brand:'BBest Globly',
  hero:{kicker:'✦ New arrivals',title:'Everyday upgrades, curated for India & the world.',subtitle:'Trending tech, wellness and home picks.'},
  theme:{accent:'#4f46e5'}, features:{cod:true,tracking:true}
});
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
const writeJSON = (f, d) => {
  fs.writeFileSync(fpath(f), JSON.stringify(d, null, 2));
  if (typeof syncJsonFile === 'function') queueMicrotask(() => syncJsonFile(f, d).catch(e => console.error('[supabase sync]', e.message)));
};

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseReady = !!(SUPABASE_URL && SUPABASE_SECRET_KEY);

async function supabaseRequest(pathname, options = {}) {
  if (!supabaseReady) throw new Error('Supabase is not configured');
  const r = await fetch(SUPABASE_URL + '/rest/v1/' + pathname, {
    ...options,
    headers: {
      'Content-Type':'application/json',
      'apikey':SUPABASE_SECRET_KEY,
      'Authorization':'Bearer '+SUPABASE_SECRET_KEY,
      ...(options.headers||{})
    }
  });
  const text = await r.text();
  let data = null; try { data = text ? JSON.parse(text) : null; } catch {}
  if (!r.ok) throw new Error('Supabase '+r.status+': '+(data?.message || data?.hint || text || 'request failed'));
  return data;
}

async function syncJsonFile(file, data) {
  if (!supabaseReady) return;
  if (file === 'products.json') {
    const rows = (Array.isArray(data)?data:[]).map(x => ({
      id:x.id,name:x.name,category:x.category||'',tagline:x.tagline||'',
      price_inr:Number(x.price_inr||0),compare_at_inr:Number(x.compare_at_inr||0),
      img:x.img||'',badges:x.badges||[],demo:!!x.demo,description:x.description||'',
      features:x.features||[],sku:x.sku||null,stock:Number(x.stock??100),updated_at:new Date().toISOString()
    }));
    await supabaseRequest('products?on_conflict=id',{method:'POST',headers:{'Prefer':'resolution=merge-duplicates'},body:JSON.stringify(rows)});
  } else if (file === 'orders.json') {
    const rows=(Array.isArray(data)?data:[]).map(x=>({...x,created:x.created||new Date().toISOString()}));
    if(rows.length) await supabaseRequest('orders?on_conflict=id',{method:'POST',headers:{'Prefer':'resolution=merge-duplicates'},body:JSON.stringify(rows)});
  } else if (file === 'customers.json') {
    const rows=(Array.isArray(data)?data:[]).map(x=>({id:x.id,name:x.name,email:x.email,phone:x.phone||'',pass:x.pass,salt:x.salt,created:x.created||new Date().toISOString()}));
    if(rows.length) await supabaseRequest('customers?on_conflict=id',{method:'POST',headers:{'Prefer':'resolution=merge-duplicates'},body:JSON.stringify(rows)});
  } else if (file === 'site_config.json') {
    await supabaseRequest('site_config?on_conflict=id',{method:'POST',headers:{'Prefer':'resolution=merge-duplicates'},body:JSON.stringify([{id:'default',config:data,updated_at:new Date().toISOString()}])});
  } else if (file === 'business_knowledge.json') {
    await supabaseRequest('business_knowledge?on_conflict=id',{method:'POST',headers:{'Prefer':'resolution=merge-duplicates'},body:JSON.stringify([{id:'default',knowledge:data,updated_at:new Date().toISOString()}])});
  }
}

async function hydrateSupabase() {
  if (!supabaseReady) return;
  try {
    const products=await supabaseRequest('products?select=*&order=created_at.asc');
    if(Array.isArray(products) && products.length) writeJSON('products.json',products.map(x=>({
      id:x.id,name:x.name,category:x.category,tagline:x.tagline,price_inr:Number(x.price_inr),
      compare_at_inr:Number(x.compare_at_inr||0),img:x.img,badges:x.badges||[],demo:!!x.demo,
      description:x.description,features:x.features||[],sku:x.sku,stock:Number(x.stock||0)
    })));
    const orders=await supabaseRequest('orders?select=*&order=created.asc');
    if(Array.isArray(orders)) writeJSON('orders.json',orders);
    const customers=await supabaseRequest('customers?select=*&order=created.asc');
    if(Array.isArray(customers)) writeJSON('customers.json',customers);
    const cfg=await supabaseRequest('site_config?select=config&id=eq.default');
    if(cfg?.[0]?.config) writeJSON('site_config.json',cfg[0].config);
    const bk=await supabaseRequest('business_knowledge?select=knowledge&id=eq.default');
    if(bk?.[0]?.knowledge) writeJSON('business_knowledge.json',bk[0].knowledge);
    console.log('[supabase] persistence connected');
  } catch(e) {
    console.error('[supabase hydrate]',e.message);
  }
}
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

// ---- AI configuration (optional; never claim live AI/research when not configured) ----
const AI_API_KEY = process.env.AI_API_KEY || process.env.OPENAI_API_KEY || '';
const AI_API_URL = process.env.AI_API_URL || 'https://openrouter.ai/api/v1/chat/completions';
const AI_MODEL = process.env.AI_MODEL || 'openrouter/free';
const aiReady = !!AI_API_KEY;

async function callAI(messages, options = {}) {
  if (!aiReady) throw new Error('AI provider is not configured. Add AI_API_KEY in Render Environment.');
  const payload = {
    model: options.model || AI_MODEL,
    temperature: options.temperature ?? 0.2,
    messages
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const headers = {
      'Content-Type':'application/json',
      'Authorization':'Bearer '+AI_API_KEY,
      'X-Title':'BBest Globly'
    };
    if (BASE_URL && !BASE_URL.includes('REPLACE-WITH-YOUR')) headers['HTTP-Referer']=BASE_URL;
    const r = await fetch(AI_API_URL, {
      method:'POST', headers, body:JSON.stringify(payload), signal:controller.signal
    });
    let d={}; try{d=await r.json()}catch{}
    if(!r.ok) {
      const detail = d?.error?.message || d?.message || ('HTTP '+r.status);
      throw new Error('OpenRouter: '+detail);
    }
    const reply = d.choices?.[0]?.message?.content || d.output_text || '';
    if(!reply) throw new Error('AI returned an empty response');
    return reply;
  } catch(e) {
    if(e.name==='AbortError') throw new Error('AI provider timed out after 30 seconds');
    throw e;
  } finally { clearTimeout(timer); }
}

function safeJson(text) {
  const raw = String(text||'').trim().replace(/^\`\`\`json\s*/i,'').replace(/^\`\`\`\s*/,'').replace(/\s*\`\`\`$/,'').trim();
  try { return JSON.parse(raw); } catch {}
  const a=raw.indexOf('{'), b=raw.lastIndexOf('}');
  if(a>=0 && b>a) { try{return JSON.parse(raw.slice(a,b+1));}catch{} }
  return null;
}

function currentAIContext(extra={}) {
  return {
    business_knowledge: loadBusinessKnowledge(),
    site_config: loadSiteConfig(),
    products: loadCatalog().map(x=>({
      id:x.id,name:x.name,category:x.category,price_inr:x.price_inr,
      compare_at_inr:x.compare_at_inr||0,stock:x.stock||0,tagline:x.tagline||'',description:x.description||''
    })),
    orders: loadOrders().map(x=>({
      id:x.id,status:x.status,total_inr:x.totals?.total_inr||0,created:x.created,
      items:(x.items||[]).map(i=>({id:i.id,name:i.name,qty:i.qty}))
    })),
    ...extra
  };
}

async function askAI(message, context = {}, task = 'general') {
  const system = [
    'You are BBest Globly AI Business Manager.',
    'You manage business analysis, product operations, marketing, SEO, customer support and storefront operations.',
    'Treat the supplied business_knowledge, site_config, products and orders as authoritative store data.',
    'Never invent live market data, supplier facts, sales, stock, ad performance or customer facts.',
    'Clearly distinguish REAL DATA, AI ANALYSIS, AI RECOMMENDATION and NEEDS OWNER APPROVAL.',
    'Public product publishing, deletion, major price changes, public site redesigns and paid advertising require owner approval.',
    'Be practical and concise.'
  ].join(' ');
  const user = JSON.stringify({task,message,context:currentAIContext(context)});
  return {configured:true, reply:await callAI([{role:'system',content:system},{role:'user',content:user}])};
}

async function agentCommand(command) {
  const system = [
    'You are the BBest Globly Agentic Business Manager.',
    'Plan concrete business actions from the owner request using ONLY supplied store data and business knowledge.',
    'Return JSON ONLY with this exact shape:',
    '{"reply":"string","actions":[{"type":"add_product|update_product|delete_product|set_site_config|set_order_status","payload":{},"reason":"string","requiresApproval":true}]}',
    'Never fabricate missing product facts. Ask for missing essential details in reply and return no action when needed.',
    'Every action returned must have requiresApproval=true.',
    'For add_product, payload may include name, category, tagline, price_inr, compare_at_inr, img, badges, description, features, sku, stock.',
    'For update_product, payload must include id plus fields to update.',
    'For delete_product, payload must include id.',
    'For set_site_config, payload may include hero and theme fields only.',
    'For set_order_status, payload must include id and status.'
  ].join(' ');
  const raw=await callAI([
    {role:'system',content:system},
    {role:'user',content:JSON.stringify({command,context:currentAIContext()})}
  ],{temperature:0.1});
  const parsed=safeJson(raw);
  if(!parsed) return {configured:true,reply:raw,actions:[]};
  return {
    configured:true,
    reply:String(parsed.reply||'Agent plan ready.'),
    actions:Array.isArray(parsed.actions)?parsed.actions.map(a=>({...a,requiresApproval:true})).slice(0,5):[]
  };
}


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


    /* ---------------- AI support ---------------- */
    if (p === '/api/ai/chat' && req.method === 'POST') {
      const a = getAuth(req);
      const b = await readBody(req);
      const channel = String(b.channel || 'website');
      if (channel !== 'website' && (!a || a.session.admin !== true)) {
        return json(res, 401, {error:'admin authentication required'});
      }
      const publicProducts = loadCatalog().map(x => ({
        id:x.id,name:x.name,category:x.category,price_inr:x.price_inr,
        stock:x.stock||0,tagline:x.tagline,description:x.description
      }));
      let context = {products:publicProducts, channel};
      if (a && a.session.admin === true) {
        context.orders = loadOrders().map(x => ({
          id:x.id,status:x.status,total_inr:x.totals?.total_inr,created:x.created,
          items:x.items?.map(i=>({id:i.id,name:i.name,qty:i.qty}))
        }));
      }
      try {
        const result = await askAI(String(b.message||''), context, String(b.task||'general'));
        return json(res, 200, result);
      } catch(e) {
        return json(res, 502, {configured:true,error:e.message});
      }
    }

    /* ---------------- public storefront config ---------------- */
    if (p === '/api/site/config' && req.method === 'GET') {
      return json(res, 200, loadSiteConfig());
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

      if (p === '/api/admin/products' && req.method === 'GET') return json(res, 200, loadCatalog());
      if (p === '/api/admin/products' && req.method === 'POST') {
        try {
          const b = await readBody(req);
          const catalog = loadCatalog();
          const prod = normalizeProductBody(b);
          if (catalog.some(x => x.id === prod.id || x.name.toLowerCase() === prod.name.toLowerCase())) return json(res, 409, {error:'A product with this name/id already exists'});
          catalog.push(prod);
          writeJSON('products.json', catalog);
          return json(res, 201, {ok:true, product:prod});
        } catch(e) { return json(res, 400, {error:e.message}); }
      }
      if (p.startsWith('/api/admin/products/') && req.method === 'PUT') {
        try {
          const id = decodeURIComponent(p.slice('/api/admin/products/'.length));
          const b = await readBody(req);
          const catalog = loadCatalog();
          const ix = catalog.findIndex(x => x.id === id);
          if (ix < 0) return json(res, 404, {error:'product not found'});
          const prod = normalizeProductBody(b, id);
          catalog[ix] = {...catalog[ix], ...prod};
          writeJSON('products.json', catalog);
          return json(res, 200, {ok:true, product:catalog[ix]});
        } catch(e) { return json(res, 400, {error:e.message}); }
      }
      if (p.startsWith('/api/admin/products/') && req.method === 'DELETE') {
        const id = decodeURIComponent(p.slice('/api/admin/products/'.length));
        const catalog = loadCatalog();
        const next = catalog.filter(x => x.id !== id);
        if (next.length === catalog.length) return json(res, 404, {error:'product not found'});
        writeJSON('products.json', next);
        return json(res, 200, {ok:true, deleted:id});
      }
      if (p === '/api/admin/ai/status' && req.method === 'GET') {
        return json(res, 200, {configured:aiReady, model:aiReady ? AI_MODEL : null, liveResearchConfigured:!!(process.env.RESEARCH_API_URL && process.env.RESEARCH_API_KEY)});
      }

      if (p === '/api/admin/agent/command' && req.method === 'POST') {
        const b = await readBody(req);
        if (!String(b.command||'').trim()) return json(res,400,{error:'command is required'});
        try { return json(res,200,await agentCommand(String(b.command))); }
        catch(e) { return json(res,502,{configured:aiReady,error:e.message}); }
      }

      if (p === '/api/admin/agent/execute' && req.method === 'POST') {
        const b = await readBody(req);
        const type=String(b.type||'');
        const payload=b.payload||{};
        try {
          if(type==='add_product'){
            const catalog=loadCatalog();
            const prod=normalizeProductBody(payload);
            if(catalog.some(x=>x.id===prod.id||x.name.toLowerCase()===prod.name.toLowerCase())) return json(res,409,{error:'A product with this name/id already exists'});
            catalog.push(prod); writeJSON('products.json',catalog);
            return json(res,200,{ok:true,action:type,product:prod});
          }
          if(type==='update_product'){
            if(!payload.id) return json(res,400,{error:'product id is required'});
            const catalog=loadCatalog(), ix=catalog.findIndex(x=>x.id===payload.id);
            if(ix<0) return json(res,404,{error:'product not found'});
            const merged={...catalog[ix],...payload,id:catalog[ix].id,updated:new Date().toISOString()};
            const prod=normalizeProductBody(merged,catalog[ix].id);
            catalog[ix]=prod; writeJSON('products.json',catalog);
            return json(res,200,{ok:true,action:type,product:prod});
          }
          if(type==='delete_product'){
            if(!payload.id) return json(res,400,{error:'product id is required'});
            const catalog=loadCatalog(), next=catalog.filter(x=>x.id!==payload.id);
            if(next.length===catalog.length) return json(res,404,{error:'product not found'});
            writeJSON('products.json',next); return json(res,200,{ok:true,action:type,deleted:payload.id});
          }
          if(type==='set_site_config'){
            const cfg=loadSiteConfig(), next={...cfg};
            if(payload.hero && typeof payload.hero==='object'){
              next.hero={...cfg.hero,...payload.hero};
              for(const k of ['kicker','title','subtitle']) next.hero[k]=String(next.hero[k]||'').slice(0,300);
            }
            if(payload.theme && typeof payload.theme==='object' && payload.theme.accent) next.theme={...cfg.theme,accent:String(payload.theme.accent).slice(0,30)};
            writeJSON('site_config.json',next);
            return json(res,200,{ok:true,action:type,site_config:next});
          }
          if(type==='set_order_status'){
            const allowed=['PENDING','CONFIRMED','SHIPPED','DELIVERED','CANCELLED'];
            if(!payload.id || !allowed.includes(payload.status)) return json(res,400,{error:'invalid order action'});
            const orders=loadOrders(), o=orders.find(x=>x.id===payload.id);
            if(!o) return json(res,404,{error:'order not found'});
            o.status=payload.status; o.status_updated=new Date().toISOString(); saveOrders(orders);
            return json(res,200,{ok:true,action:type,id:o.id,status:o.status});
          }
          return json(res,400,{error:'unsupported agent action'});
        } catch(e) { return json(res,400,{error:e.message}); }
      }

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


    if (p === '/dashboard' || p === '/dashboard.html') {
      return fs.readFile(path.join(ROOT, 'dashboard.html'), (err, data) => err ? json(res,404,{error:'dashboard not found'}) : send(res,200,data,MIME['.html']));
    }

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

hydrateSupabase().finally(() => {
  server.listen(PORT, '0.0.0.0', () => console.log('BBest Globly store v2.1 listening on http://0.0.0.0:' + PORT));
});
