const $=(s,e=document)=>e.querySelector(s), $$=(s,e=document)=>[...e.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const INR_USD=85;
const state={products:[],siteConfig:{brand:'BBest Globly',hero:{kicker:'✦ New arrivals',title:'Everyday upgrades, curated for India & the world.',subtitle:'Trending tech, wellness and home picks.'},theme:{accent:'#4f46e5'}},cart:JSON.parse(localStorage.getItem('bg_cart')||'[]'),token:localStorage.getItem('bg_token')||'',user:null,adminToken:localStorage.getItem('bg_admin')||'',currency:localStorage.getItem('bg_cur')||'INR'};
const shop={q:'',cat:'All',sort:'featured'};
const money=n=>state.currency==='USD'?'$'+Math.round(n/INR_USD):'₹'+Number(n).toLocaleString('en-IN');
async function api(path,opt={}){const h={};if(opt.body)h['Content-Type']='application/json';if(opt.auth==='user'&&state.token)h.Authorization='Bearer '+state.token;if(opt.auth==='admin'&&state.adminToken)h.Authorization='Bearer '+state.adminToken;const r=await fetch(path,{method:opt.method||'GET',headers:h,body:opt.body?JSON.stringify(opt.body):undefined});let d={};try{d=await r.json()}catch{}if(!r.ok)throw Error(d.error||'HTTP '+r.status);return d}
const ANALYTICS_SESSION_KEY='bg_analytics_session';
const analyticsSession=localStorage.getItem(ANALYTICS_SESSION_KEY)||((crypto.randomUUID?crypto.randomUUID():('s-'+Date.now()+'-'+Math.random().toString(36).slice(2))));
localStorage.setItem(ANALYTICS_SESSION_KEY,analyticsSession);
function trackEvent(event_name,data={}){
  try{
    const body={event_name,session_id:analyticsSession,page:location.pathname,product_id:data.product_id||null,order_id:data.order_id||null,metadata:data.metadata||{}};
    const headers={'Content-Type':'application/json'};if(state.token)headers.Authorization='Bearer '+state.token;
    fetch('/api/analytics/event',{method:'POST',headers,body:JSON.stringify(body),keepalive:true}).catch(()=>{});
  }catch{}
}
let trackedPage='';
function trackPageView(){
  const page=location.pathname;
  if(page===trackedPage)return;
  trackedPage=page;
  trackEvent('page_view');
}

function saveCart(){localStorage.setItem('bg_cart',JSON.stringify(state.cart));badge()}
function badge(){const b=$('#cartBadge');if(b)b.textContent=state.cart.reduce((n,x)=>n+x.qty,0)}
function add(id,qty=1){let x=state.cart.find(i=>i.id===id);x?x.qty=Math.min(10,x.qty+qty):state.cart.push({id,qty:Math.min(10,qty)});saveCart();trackEvent('add_to_cart',{product_id:id,metadata:{qty}});toast('Added to cart')}
function remove(id){state.cart=state.cart.filter(i=>i.id!==id);saveCart();render()}
function setQty(id,qty){const x=state.cart.find(i=>i.id===id);if(x)x.qty=Math.max(1,Math.min(10,qty));saveCart();render()}
function lines(){return state.cart.map(i=>({i,p:state.products.find(p=>p.id===i.id)})).filter(x=>x.p)}
function subtotal(){return lines().reduce((s,x)=>s+x.p.price_inr*x.i.qty,0)}
function nav(u){history.pushState({},'',u);render()}
function meta(t,d){document.title=t;const m=$('meta[name="description"]');if(m)m.content=d||''}
function applySiteConfig(){const a=state.siteConfig?.theme?.accent;if(a)document.documentElement.style.setProperty('--accent',a)}
function card(p){
  const badge=(p.badges||[])[0]||'Pick';
  const saving=p.compare_at_inr?Math.max(0,Math.round((1-p.price_inr/p.compare_at_inr)*100)):0;
  return '<article class="card reveal-card"><a class="card-media" href="/product/'+p.id+'"><div class="media-glow"></div><img src="'+p.img+'" alt="'+esc(p.name)+'" loading="lazy" onerror="this.style.display=\'none\'"><span class="badge">'+esc(badge)+'</span>'+(saving?'<span class="save-badge">-'+saving+'%</span>':'')+'</a><div class="card-body"><span class="card-cat">'+esc(p.category)+'</span><a class="card-name" href="/product/'+p.id+'">'+esc(p.name)+'</a><p class="card-tagline">'+esc(p.tagline||'')+'</p><div class="card-price"><strong>'+money(p.price_inr)+'</strong>'+(p.compare_at_inr?'<s>'+money(p.compare_at_inr)+'</s>':'')+'</div><button class="btn btn-primary btn-block card-add" onclick="event.preventDefault();add(\''+p.id+'\')"><span>Add to Cart</span><span class="btn-arrow">→</span></button></div></article>';
}
function renderAuth(){const a=$('#authArea');if(!a)return;a.innerHTML=state.user?'<a href="/account" class="nav-auth">👤 '+esc(state.user.name.split(' ')[0])+'</a>':'<span class="nav-auth-group"><a href="/login" class="nav-auth">Login</a><span class="nav-auth-sep">·</span><a href="/register" class="nav-auth nav-auth-create">Create account</a></span>'}
function home(){
  const cfg=state.siteConfig||{},hero=cfg.hero||{},featured=state.products[0];
  meta((cfg.brand||'BBest Globly')+' — Everyday Upgrades | India & Worldwide','Trending tech, wellness, home and pet products — curated for India and worldwide.');
  const cats=[...new Set(state.products.map(p=>p.category))];
  const featuredHtml=featured?'<a class="hero-product-card" href="/product/'+featured.id+'"><div class="hero-product-image"><img src="'+featured.img+'" alt="'+esc(featured.name)+'" loading="eager"></div><div class="hero-product-info"><span>Featured pick</span><strong>'+esc(featured.name)+'</strong><b>'+money(featured.price_inr)+'</b></div><span class="hero-product-arrow">↗</span></a>':'';
  $('#app').innerHTML='<section class="hero"><div class="hero-bg" style="background-image:url(\'img/hero.jpg\')"></div><div class="hero-noise"></div><div class="hero-orb orb-a"></div><div class="hero-orb orb-b"></div><div class="hero-in wrap"><div class="hero-copy reveal-up"><span class="hero-kicker"><i></i>'+esc(hero.kicker||'✦ New arrivals')+'</span><h1>'+esc(hero.title||'Everyday upgrades, curated for India & the world.')+'</h1><p>'+esc(hero.subtitle||'Trending tech, wellness and home picks — hand-picked, honestly priced, delivered to your door.')+'</p><div class="hero-cta"><a class="btn btn-primary btn-lg" href="/shop">Explore collection <span>↗</span></a><a class="hero-text-link" href="/track">Track an order <span>→</span></a></div><div class="hero-micro-proof"><span><b>'+state.products.length+'+</b> curated picks</span><span class="proof-dot"></span><span>COD where enabled</span><span class="proof-dot"></span><span>Support in chat</span></div></div>'+featuredHtml+'</div><div class="hero-bottom-fade"></div></section><section class="wrap"><div class="value-row reveal-stagger"><div class="value"><span class="v-ico">✦</span><div><strong>Curated catalogue</strong><span>Useful upgrades, not endless clutter</span></div></div><div class="value"><span class="v-ico">↗</span><div><strong>Clear pricing</strong><span>See the price before you checkout</span></div></div><div class="value"><span class="v-ico">⌁</span><div><strong>Order tracking</strong><span>Follow your order after dispatch</span></div></div></div><section class="category-panel reveal-up"><div class="category-panel-head"><div><span class="eyebrow">BROWSE SMART</span><h2>Shop by category</h2></div><a href="/shop">View all <span>→</span></a></div><div class="category-grid">'+cats.map((c,i)=>'<button class="category-tile" onclick="goShop(\''+esc(c)+'\')"><span class="category-num">0'+(i+1)+'</span><strong>'+esc(c)+'</strong><span>Explore picks <b>↗</b></span></button>').join('')+'</div></section><section class="featured-section"><div class="section-heading reveal-up"><div><span class="eyebrow">CURATED FOR NOW</span><h2>Trending now</h2><p>Products selected around everyday use, gifting and useful upgrades.</p></div><a class="section-link" href="/shop">See the full shop →</a></div><div class="grid">'+state.products.map(card).join('')+'</div></section><section class="editorial-panel reveal-up"><div><span class="eyebrow">THE BBEST APPROACH</span><h2>Less scrolling. Better picks.</h2><p>We keep the storefront focused on products with a clear use case, simple pricing and an easy path from discovery to delivery.</p><a class="btn btn-outline" href="/shop">Browse the collection <span>→</span></a></div><div class="editorial-stats"><div><strong>01</strong><span>Discover</span></div><div><strong>02</strong><span>Choose</span></div><div><strong>03</strong><span>Track</span></div></div></section></section>';
}
function product(id){
  const p=state.products.find(x=>x.id===id);if(!p)return notFound();
  trackEvent('product_view',{product_id:id});meta(p.name+' — BBest Globly',p.tagline);
  $('#app').innerHTML='<section class="page"><p class="breadcrumb"><a href="/">Home</a> / <a href="/shop">Shop</a> / '+esc(p.category)+'</p><div class="pd"><div class="pd-media"><img src="'+p.img+'" alt="'+esc(p.name)+'" onerror="this.style.display=\'none\'"></div><div class="pd-info"><span class="card-cat">'+esc(p.category)+'</span><h1>'+esc(p.name)+'</h1><p class="tagline">'+esc(p.tagline)+'</p><div class="pd-price">'+money(p.price_inr)+(p.compare_at_inr?'<s>'+money(p.compare_at_inr)+'</s>':'')+'</div><p class="desc">'+esc(p.description)+'</p><ul class="features">'+(p.features||[]).map(f=>'<li>'+esc(f)+'</li>').join('')+'</ul><div class="pd-actions"><button class="btn btn-primary" onclick="add(\''+p.id+'\')">Add to Cart</button><a class="btn btn-outline" href="/cart">Go to Cart</a></div></div></div><section id="productReviews" class="section-card" style="margin-top:24px"><h2>Customer reviews</h2><div class="muted">Loading verified reviews…</div></section></section>';
  fetch('/api/products/'+encodeURIComponent(id)+'/reviews').then(r=>r.ok?r.json():[]).then(rows=>{
    const box=$('#productReviews');if(!box)return;
    const list=Array.isArray(rows)?rows:[];
    box.innerHTML='<h2>Customer reviews</h2>'+(list.length?list.map(x=>'<article class="review-item"><div><strong>'+esc('★'.repeat(Number(x.rating||0)))+'</strong> <span class="muted">'+esc(x.created_at?new Date(x.created_at).toLocaleDateString('en-IN'):'')+'</span></div><p>'+esc(x.review)+'</p></article>').join(''):'<p class="muted">No published reviews yet.</p>');
  }).catch(()=>{});
}function cart(){meta('Cart — BBest Globly');const ls=lines();$('#app').innerHTML='<section class="page"><h1>Your Cart</h1>'+(!ls.length?'<p class="empty">Your cart is empty. <a href="/shop" style="color:var(--accent);font-weight:700">Shop now →</a></p>':'<div class="co"><div>'+ls.map(x=>'<div class="cart-line"><img src="'+x.p.img+'" alt=""><div><a class="card-name" href="/product/'+x.p.id+'">'+esc(x.p.name)+'</a><div class="muted">'+money(x.p.price_inr)+' × '+x.i.qty+'</div><div class="qty"><button onclick="setQty(\''+x.p.id+'\','+(x.i.qty-1)+')">−</button><span>'+x.i.qty+'</span><button onclick="setQty(\''+x.p.id+'\','+(x.i.qty+1)+')">+</button></div></div><button class="link-danger" onclick="remove(\''+x.p.id+'\')">Remove</button></div>').join('')+'</div><aside class="summary"><h3>Order summary</h3><div class="sum-row"><span>Subtotal</span><strong>'+money(subtotal())+'</strong></div><div class="sum-row"><span>Shipping</span><span>Calculated at checkout</span></div><div class="sum-row total"><span>Total</span><strong>'+money(subtotal())+'</strong></div><a class="btn btn-primary btn-block" href="/checkout">Checkout</a></aside></div>')}
async function checkout(){
  meta('Checkout — BBest Globly');
  trackEvent('checkout_start',{metadata:{cart_units:state.cart.reduce((s,x)=>s+Number(x.qty||0),0),cart_items:state.cart.map(x=>({id:x.id,qty:Number(x.qty||0)})),cart_value_inr:subtotal()}});
  if(!lines().length)return nav('/cart');
  let payCfg={razorpay:{enabled:false}};try{payCfg=await api('/api/payment/config')}catch{}
  const onlineEnabled=!!payCfg.razorpay?.enabled;
  const paymentOptions='<label class="radio-card on"><input type="radio" name="pay" value="cod" checked><strong>Cash on Delivery</strong><span>Pay when your order arrives</span></label>'+(onlineEnabled?'<label class="radio-card"><input type="radio" name="pay" value="online"><strong>UPI / Card / Netbanking</strong><span>Secure online payment via Razorpay</span></label>':'<div class="notice">Online payments are temporarily unavailable.</div>');
  $('#app').innerHTML='<section class="page"><h1>Checkout</h1><p class="muted">Guest checkout is available — account creation is optional.</p><div class="co"><div class="summary"><h3>Customer details</h3><div class="form-grid"><div><label>Name</label><input id="name" autocomplete="name"></div><div><label>Phone</label><input id="phone" inputmode="tel" autocomplete="tel"></div><div class="full"><label>Email</label><input id="email" type="email" autocomplete="email"></div><div class="full"><label>Address</label><textarea id="address" rows="3" autocomplete="street-address"></textarea></div><div><label>City</label><input id="city"></div><div><label>State</label><input id="state"></div><div><label>Pincode</label><input id="pincode" inputmode="numeric" autocomplete="postal-code"></div><div><label>Country</label><input id="country" value="India" autocomplete="country-name"></div></div><h3 class="form-title">Payment</h3><div class="payment-options">'+paymentOptions+'</div><p id="coErr" class="form-err"></p><button id="place" class="btn btn-primary btn-block">Place COD Order · '+money(subtotal())+'</button></div><aside class="summary"><h3>Order summary</h3>'+lines().map(x=>'<div class="sum-row"><span>'+esc(x.p.name)+' ×'+x.i.qty+'</span><strong>'+money(x.p.price_inr*x.i.qty)+'</strong></div>').join('')+'<div class="sum-row total"><span>Total</span><strong>'+money(subtotal())+'</strong></div></aside></div></section>';
  $$('input[name="pay"]').forEach(r=>r.onchange=()=>{$('#place').textContent=r.checked&&r.value==='online'?'Pay securely · '+money(subtotal()):'Place COD Order · '+money(subtotal())});
  $('#place').onclick=async()=>{
    const b={name:$('#name').value.trim(),phone:$('#phone').value.trim(),email:$('#email').value.trim(),address:$('#address').value.trim(),city:$('#city').value.trim(),state:$('#state').value.trim(),pincode:$('#pincode').value.trim(),country:$('#country').value.trim()||'India',payment_method:document.querySelector('input[name="pay"]:checked')?.value||'cod',items:lines().map(x=>({id:x.p.id,qty:x.i.qty}))};
    const err=$('#coErr');err.textContent='';
    if(!b.name||!b.phone||!b.address||!b.city||!b.state||!b.pincode){err.textContent='Please fill all required delivery fields.';return}
    if(!/^[0-9]{10}$/.test(b.phone.replace(/\D/g,''))){err.textContent='Enter a valid 10-digit phone number.';return}
    if(!/^[0-9]{6}$/.test(b.pincode)){err.textContent='Enter a valid 6-digit pincode.';return}
    if(b.email && !/^\S+@\S+\.\S+$/.test(b.email)){err.textContent='Enter a valid email or leave it blank.';return}
    const place=$('#place');place.disabled=true;place.textContent=b.payment_method==='online'?'Creating secure payment…':'Placing order…';
    try{
      const d=await api('/api/orders',{method:'POST',body:b});
      localStorage.setItem('bg_last_order_phone',b.phone);
      if(b.payment_method!=='online'){trackEvent('purchase_success',{order_id:d.orderId});state.cart=[];saveCart();return nav('/order/'+d.orderId)}
      const gateway=await api('/api/payment/order',{method:'POST',body:{orderId:d.orderId}});
      await loadRazorpay();
      new window.Razorpay({key:payCfg.razorpay.key_id,amount:gateway.amount,currency:gateway.currency,name:'BBest Globly',description:'Order '+d.orderId,order_id:gateway.razorpay_order_id,prefill:{name:b.name,email:b.email,contact:b.phone},theme:{color:getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()||'#4f46e5'},handler:async response=>{
        try{await api('/api/payment/verify',{method:'POST',body:{orderId:d.orderId,...response}});trackEvent('purchase_success',{order_id:d.orderId});state.cart=[];saveCart();nav('/order/'+d.orderId)}
        catch(e){err.textContent='Payment verification failed: '+e.message;place.disabled=false}
      },modal:{ondismiss:()=>{err.textContent='Payment cancelled. You can retry.';place.disabled=false;place.textContent='Pay securely · '+money(subtotal())}}}).open();
    }catch(e){err.textContent=e.message;place.disabled=false;place.textContent=b.payment_method==='online'?'Pay securely · '+money(subtotal()):'Place COD Order · '+money(subtotal())}
  };
}

async function order(id){
  meta('Order '+id+' — BBest Globly');
  $('#app').innerHTML='<section class="page"><p class="empty">Loading order…</p></section>';
  try{
    const phone=localStorage.getItem('bg_last_order_phone')||'';
    const o=await api('/api/order/'+encodeURIComponent(id)+(state.token?'':'?phone='+encodeURIComponent(phone)));
    const ship=o.shiprocket_awb?'<p><strong>AWB:</strong> '+esc(o.shiprocket_awb)+(o.shiprocket_courier?' · '+esc(o.shiprocket_courier):'')+'</p><p><span class="status-pill">'+esc(o.shipping_status||'SHIPPING')+'</span></p>':'<p class="muted">Shipment tracking will appear after dispatch.</p>';
    const codPending=o.payment?.method==='COD'&&o.payment?.cod_confirmation_status==='PENDING';
    const codUi=codPending?'<div class="notice" style="margin:14px 0">This is a Cash on Delivery order. Please confirm it before fulfillment.<div class="actions" style="margin-top:10px"><button id="confirmCod" class="btn btn-primary">Confirm COD order</button><button id="declineCod" class="btn btn-outline">Decline</button></div><p id="codMsg" class="muted"></p></div>':'';
    $('#app').innerHTML='<section class="page"><div class="success-box"><h1>Order placed 🎉</h1><p>Your order ID</p><div class="order-id">'+esc(o.id)+'</div><p><span class="status-pill">'+esc(o.status)+'</span></p><p>Total: <strong>₹'+Number(o.total_inr||0).toLocaleString('en-IN')+'</strong></p>'+ship+codUi+'<a class="btn btn-primary" href="/track">Track order</a>'+(state.token&&['DELIVERED','CONFIRMED'].includes(o.status)?'<div id="reviewBox" style="margin-top:14px"></div>':'')+'</div></section>';
    const setCod=async(confirm)=>{
      const msg=$('#codMsg');try{
        const d=await api('/api/order/'+encodeURIComponent(o.id)+'/cod-confirm',{method:'POST',body:{confirm,phone:state.token?'':phone}});
        msg.textContent=confirm?'COD order confirmed.':'COD order declined.';$('#confirmCod')?.remove();$('#declineCod')?.remove();
      }catch(e){msg.textContent=e.message}
    };
    $('#confirmCod')?.addEventListener('click',()=>setCod(true));$('#declineCod')?.addEventListener('click',()=>setCod(false));
    if($('#reviewBox')&&state.token){
      const delivered=o.status==='DELIVERED',items=(o.items||[]).filter(Boolean);
      $('#reviewBox').innerHTML=delivered?'<h3>Share a review</h3>'+items.map(i=>'<div class="review-form" data-p="'+esc(i.id)+'"><strong>'+esc(i.name)+'</strong><div class="field"><label>Rating</label><select class="review-rating"><option value="5">5 — Great</option><option value="4">4 — Good</option><option value="3">3 — Okay</option><option value="2">2 — Needs work</option><option value="1">1 — Poor</option></select></div><textarea class="review-text" rows="2" placeholder="Tell us about your experience"></textarea><button class="btn btn-outline review-submit">Submit review</button><span class="muted review-msg"></span></div>').join(''):'';
      $$('.review-submit',$('#reviewBox')).forEach(btn=>btn.onclick=async()=>{
        const box=btn.closest('.review-form');btn.disabled=true;
        try{await api('/api/orders/review',{method:'POST',auth:'user',body:{order_id:o.id,product_id:box.dataset.p,rating:box.querySelector('.review-rating').value,review:box.querySelector('.review-text').value}});box.querySelector('.review-msg').textContent='Review submitted for moderation.'}
        catch(e){box.querySelector('.review-msg').textContent=e.message;btn.disabled=false}
      });
    }
  }catch(e){notFound()}
}async function track(){
  meta('Track Order — BBest Globly');
  $('#app').innerHTML='<section class="page"><div class="auth-card"><h1>Track your order</h1><p class="sub">Enter your order ID and the phone number used at checkout.</p><div class="field"><label>Order ID</label><input id="oid" placeholder="BG-..."></div><div class="field"><label>Phone number</label><input id="oph" inputmode="tel" autocomplete="tel" placeholder="10-digit phone"></div><p id="terr" class="form-err"></p><button id="tb" class="btn btn-primary btn-block">Track</button></div></section>';
  $('#tb').onclick=async()=>{
    const id=$('#oid').value.trim(),phone=$('#oph').value.replace(/\D/g,'');
    const err=$('#terr');err.textContent='';
    if(!id||phone.length!==10){err.textContent='Enter a valid order ID and 10-digit phone number.';return}
    try{
      localStorage.setItem('bg_last_order_phone',phone);
      const o=await api('/api/order/'+encodeURIComponent(id)+'?phone='+encodeURIComponent(phone));
      const ship=o.shiprocket_awb?'<p><strong>AWB:</strong> '+esc(o.shiprocket_awb)+(o.shiprocket_courier?' · '+esc(o.shiprocket_courier):'')+'</p><p><span class="status-pill">'+esc(o.shipping_status||'Shipping')+'</span></p>':'<p class="muted">Shipment details will appear after dispatch.</p>';
      const cod=o.payment?.method==='COD'?'<p class="muted">COD confirmation: '+esc(o.payment?.cod_confirmation_status||'PENDING')+'</p>':'';
      $('#app').innerHTML='<section class="page"><div class="success-box"><h1>Order '+esc(o.id)+'</h1><p><span class="status-pill">'+esc(o.status)+'</span></p><p>Total ₹'+Number(o.total_inr||0).toLocaleString('en-IN')+'</p>'+ship+cod+'</div></section>';
    }catch(e){err.textContent=e.message}
  };
}function login(){authForm(false)}
function register(){authForm(true)}
function authForm(reg){
  meta((reg?'Create account':'Login')+' — BBest Globly');
  $('#app').innerHTML='<section class="page"><div class="auth-card"><h1>'+(reg?'Create your BBest Globly account':'Welcome back to BBest Globly')+'</h1><p class="sub">'+(reg?'Enter your name, email and mobile number. We will verify your email with a one-time 6-digit code.':'Enter the email address linked to your BBest Globly account. We will send a one-time 6-digit login code.')+'</p>'+(reg?'<div class="field"><label>Full name <span class="required">*</span></label><input id="otpName" type="text" autocomplete="name" placeholder="Your full name" maxlength="80" required></div>':'')+'<div class="field"><label>Email address <span class="required">*</span></label><input id="otpEmail" type="email" autocomplete="email" placeholder="you@example.com" required></div>'+(reg?'<div class="field"><label>Mobile number <span class="required">*</span></label><input id="otpPhone" inputmode="tel" autocomplete="tel" placeholder="10-digit mobile number" maxlength="15" required></div>':'')+'<p id="otpErr" class="form-err"></p><button id="sendCustomerOtp" class="btn btn-primary btn-block">'+(reg?'Send email verification code':'Send login code')+'</button><div id="otpStep" class="hidden"><div class="field"><label>6-digit verification code</label><input id="customerOtp" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="Enter the code"></div><button id="verifyCustomerOtp" class="btn btn-primary btn-block">Verify & '+(reg?'Create Account':'Login')+'</button><button id="resendCustomerOtp" type="button" class="btn btn-outline btn-block" style="margin-top:10px">Send code again</button></div><div class="auth-link" style="margin-top:14px">'+(reg?'Already have an account? <a href="/login">Login</a>':'New to BBest Globly? <a href="/register">Create an account</a>')+'</div></div></section>';
  const err=$('#otpErr');
  const emailValue=()=>$('#otpEmail').value.trim().toLowerCase();
  const send=async()=>{
    const email=emailValue();err.style.color='var(--danger)';err.textContent='';
    if(!/^\S+@\S+\.\S+$/.test(email)){err.textContent='Enter a valid email address.';return}
    if(reg&&$('#otpName').value.trim().length<2){err.textContent='Full name is required to create your account.';return}
    if(reg&&$('#otpPhone').value.replace(/\D/g,'').length!==10){err.textContent='Enter a valid 10-digit mobile number.';return}
    const b=$('#sendCustomerOtp');b.disabled=true;b.textContent='Sending…';
    try{
      const d=await api('/api/auth/email/request',{method:'POST',body:{email,mode:reg?'register':'login'}});
      $('#otpStep').classList.remove('hidden');$('#customerOtp').focus();
      err.style.color='var(--ok)';
      err.textContent=(reg?'Verification code sent to ':'Login code sent to ')+(d.masked_email||email)+'. It expires in 5 minutes.';
    }catch(e){err.textContent=e.message}
    finally{b.disabled=false;b.textContent=reg?'Send email verification code':'Send login code';}
  };
  $('#sendCustomerOtp').onclick=send;$('#resendCustomerOtp').onclick=send;
  $('#verifyCustomerOtp').onclick=async()=>{
    const email=emailValue(),otp=$('#customerOtp').value.trim();
    const name=reg?$('#otpName').value.trim():'',phone=reg?$('#otpPhone').value.trim():'';
    err.style.color='var(--danger)';err.textContent='';
    if(!/^\S+@\S+\.\S+$/.test(email)){err.textContent='Enter a valid email address.';return}
    if(reg&&name.length<2){err.textContent='Enter your full name.';return}
    if(reg&&phone.replace(/\D/g,'').length!==10){err.textContent='Enter a valid 10-digit mobile number.';return}
    if(!/^\d{6}$/.test(otp)){err.textContent='Enter the 6-digit verification code.';return}
    const b=$('#verifyCustomerOtp');b.disabled=true;b.textContent='Verifying…';
    try{
      const d=await api('/api/auth/email/verify',{method:'POST',body:{email,otp,name,phone,mode:reg?'register':'login'}});
      state.token=d.token;state.user=d.customer;localStorage.setItem('bg_token',d.token);
      trackEvent(d.is_new?'sign_up':'login',{metadata:{method:'email_verification',flow:reg?'register':'login'}});
      nav('/account');
    }catch(e){err.textContent=e.message}
    finally{b.disabled=false;b.textContent='Verify & '+(reg?'Create Account':'Login');}
  };
}
async function account(){
  if(!state.token)return nav('/login');
  try{
    const me=await api('/api/auth/me',{auth:'user'}),os=await api('/api/my/orders',{auth:'user'});state.user=me;meta('My Account — BBest Globly');
    $('#app').innerHTML='<section class="page" style="max-width:980px"><h1>My Account</h1><div class="co"><div><div class="summary"><h3>Profile</h3><div class="field"><label>Name</label><input id="profileName" value="'+esc(me.name||'')+'" autocomplete="name"></div><div class="field"><label>Email</label><input id="profileEmail" type="email" value="'+esc(me.email||'')+'" autocomplete="email"></div><div class="profile-row"><span>Mobile number</span><strong>'+esc(me.phone||'—')+'</strong> '+(me.phone_verified?'<span class="badge">VERIFIED</span>':'')+'</div><p id="profileMsg" class="muted" style="font-size:.78rem"></p><button id="saveProfile" class="btn btn-primary btn-block">Save profile</button><hr style="margin:18px 0;border:0;border-top:1px solid var(--line)"><h3>Marketing preferences</h3><p class="muted">Choose exactly where you want to receive BBest Globly offers, relevant product recommendations and seasonal updates. Order/service messages are separate.</p><label class="check-row"><input id="mEmail" type="checkbox" '+(me.marketing_email_opt_in?'checked':'')+'> <span>Email offers & recommendations</span></label><label class="check-row"><input id="mSms" type="checkbox" '+(me.marketing_sms_opt_in?'checked':'')+'> <span>SMS offers & recommendations</span></label><label class="check-row"><input id="mWa" type="checkbox" '+(me.marketing_whatsapp_opt_in?'checked':'')+'> <span>WhatsApp offers & seasonal updates</span></label><div class="field" style="margin-top:10px"><label>Preferred marketing channel</label><select id="mChannel"><option value="">Choose a preferred channel</option><option value="whatsapp" '+(me.preferred_marketing_channel==='whatsapp'?'selected':'')+'>WhatsApp</option><option value="sms" '+(me.preferred_marketing_channel==='sms'?'selected':'')+'>SMS</option><option value="email" '+(me.preferred_marketing_channel==='email'?'selected':'')+'>Email</option></select></div><p class="muted" style="font-size:.76rem">You can change these choices anytime.</p><button id="saveMarketing" class="btn btn-outline btn-block">Save marketing choices</button><p id="marketingMsg" class="muted" style="font-size:.78rem"></p><button id="logout" class="btn btn-outline btn-block" style="margin-top:16px">Logout</button></div></div><div><h3 style="margin-top:0">Order history ('+os.length+')</h3>'+(os.length?os.map(o=>'<div class="cart-line" style="grid-template-columns:1fr auto"><div><a class="card-name" href="/order/'+o.id+'">'+esc(o.id)+'</a><div class="muted">'+new Date(o.created).toLocaleString('en-IN')+'</div></div><div><strong>₹'+Number(o.totals.total_inr).toLocaleString('en-IN')+'</strong><br><span class="st">'+esc(o.status)+'</span></div></div>').join(''):'<p class="muted">No orders yet.</p>')+'</div></div></section>';
    $('#saveProfile').onclick=async()=>{const msg=$('#profileMsg');try{const d=await api('/api/auth/profile',{method:'PATCH',auth:'user',body:{name:$('#profileName').value.trim(),email:$('#profileEmail').value.trim()}});state.user=d.customer;msg.style.color='var(--ok)';msg.textContent='Profile saved.';}catch(e){msg.style.color='var(--danger)';msg.textContent=e.message}};
    $('#saveMarketing').onclick=async()=>{const msg=$('#marketingMsg'),b={marketing_email_opt_in:$('#mEmail').checked,marketing_sms_opt_in:$('#mSms').checked,marketing_whatsapp_opt_in:$('#mWa').checked};try{b.preferred_marketing_channel=$('#mChannel').value||'';const d=await api('/api/auth/marketing-preferences',{method:'PATCH',auth:'user',body:b});state.user=d;msg.style.color='var(--ok)';msg.textContent=d.marketing_opt_in?'Marketing choices saved.':'Marketing messages disabled.';}catch(e){msg.style.color='var(--danger)';msg.textContent=e.message}};
    $('#logout').onclick=async()=>{try{await api('/api/auth/logout',{method:'POST',auth:'user'})}catch{}state.token='';state.user=null;localStorage.removeItem('bg_token');nav('/')};
  }catch(e){state.token='';localStorage.removeItem('bg_token');nav('/login')}
}
async function admin(){if(!state.adminToken)return adminLogin();try{const [s,os]=await Promise.all([api('/api/admin/stats',{auth:'admin'}),api('/api/admin/orders',{auth:'admin'})]);meta('Admin — BBest Globly');$('#app').innerHTML='<section class="page"><h1>Admin Dashboard</h1><div class="stat-grid"><div class="stat"><div class="n">'+s.orders+'</div><div class="l">Orders</div></div><div class="stat"><div class="n">'+s.pending+'</div><div class="l">Pending</div></div><div class="stat"><div class="n">₹'+Number(s.revenue_inr).toLocaleString('en-IN')+'</div><div class="l">Revenue</div></div><div class="stat"><div class="n">'+s.customers+'</div><div class="l">Customers</div></div></div><div class="table-wrap"><table class="tbl"><thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Status</th></tr></thead><tbody>'+(os.length?os.map(o=>'<tr><td>'+esc(o.id)+'</td><td>'+esc(o.customer.name)+'</td><td>₹'+Number(o.totals.total_inr).toLocaleString('en-IN')+'</td><td><select class="mini" data-id="'+o.id+'">'+['PENDING','CONFIRMED','SHIPPED','DELIVERED','CANCELLED'].map(x=>'<option '+(x===o.status?'selected':'')+'>'+x+'</option>').join('')+'</select></td></tr>').join(''):'<tr><td colspan="4">No orders yet.</td></tr>')+'</tbody></table></div></section>';$$('.mini').forEach(s=>s.onchange=async()=>{try{await api('/api/admin/order-status',{method:'POST',auth:'admin',body:{id:s.dataset.id,status:s.value}});toast('Status updated')}catch(e){toast(e.message);admin()}})}catch(e){state.adminToken='';localStorage.removeItem('bg_admin');adminLogin()}}
function adminLogin(){meta('Admin Login — BBest Globly');$('#app').innerHTML='<section class="page"><div class="auth-card"><h1>Admin Login</h1><div class="field"><label>Username</label><input id="au" value="admin"></div><div class="field"><label>Password</label><input id="ap" type="password"></div><p id="aerr" class="form-err"></p><button id="alb" class="btn btn-primary btn-block">Login</button></div></section>';$('#alb').onclick=async()=>{try{const d=await api('/api/admin/login',{method:'POST',body:{username:$('#au').value,password:$('#ap').value}});state.adminToken=d.token;localStorage.setItem('bg_admin',d.token);admin()}catch(e){$('#aerr').textContent=e.message}}}
function goShop(cat){shop.cat=cat;nav('/shop')}
function motionInit(){
  try{
    const targets=document.querySelectorAll('.reveal-up,.reveal-stagger,.reveal-card');
    if(!('IntersectionObserver' in window)){targets.forEach(x=>x.classList.add('is-visible'));return}
    const io=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('is-visible');io.unobserve(e.target)}}),{threshold:.12,rootMargin:'0px 0px -30px 0px'});
    targets.forEach(x=>io.observe(x));
    const hero=document.querySelector('.hero');
    if(hero){
      const bg=hero.querySelector('.hero-bg');
      const onMove=e=>{const r=hero.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;if(bg)bg.style.transform='scale(1.04) translate3d('+(-x*10)+'px,'+(-y*8)+'px,0)'};
      hero.addEventListener('pointermove',onMove,{passive:true});
      hero.addEventListener('pointerleave',()=>{if(bg)bg.style.transform='scale(1.04) translate3d(0,0,0)'},{passive:true});
    }
  }catch{}
}
function notFound(){meta('Page Not Found — BBest Globly');$('#app').innerHTML='<section class="page" style="text-align:center"><h1>Page not found</h1><a class="btn btn-primary" href="/">Back Home</a></section>'}
function toast(msg){let t=$('#toast');if(!t){t=document.createElement('div');t.id='toast';t.className='toast';document.body.appendChild(t)}t.textContent=msg;t.classList.add('show');clearTimeout(window.__t);window.__t=setTimeout(()=>t.classList.remove('show'),2200)}
function render(){renderAuth();badge();trackPageView();const p=location.pathname.replace(/\/+$/,'')||'/';if(p==='/')home();else if(p==='/shop')shopPage();else if(p==='/cart')cart();else if(p==='/checkout')checkout();else if(p==='/track')track();else if(p==='/login')login();else if(p==='/register')register();else if(p==='/account')account();else if(p==='/admin')admin();else if(p.startsWith('/product/'))product(p.split('/')[2]);else if(p.startsWith('/order/'))order(p.split('/')[2]);else notFound();if(p!=='/'&&!document.querySelector('#app .store-back')){$('#app').insertAdjacentHTML('afterbegin','<div class="page-back wrap">'+backControl()+'</div>')}motionInit()}
document.addEventListener('click',async e=>{if(e.target.id==='forgotCustomer'){const card=e.target.closest('.auth-card');if(!card)return;let box=$('#customerReset');if(!box){box=document.createElement('div');box.id='customerReset';box.className='reset-box';box.innerHTML='<h3>Reset password</h3><div class="field"><label>Account email</label><input id="rEmail" type="email"></div><button id="rSend" type="button" class="btn btn-outline btn-block">Send OTP</button><div class="field"><label>OTP</label><input id="rOtp" inputmode="numeric" maxlength="6"></div><div class="field"><label>New password</label><input id="rPw" type="password"></div><button id="rVerify" type="button" class="btn btn-primary btn-block">Reset password</button><p id="rMsg" class="form-err"></p>';card.appendChild(box)}box.classList.remove('hidden');$('#rEmail').value=$('#em')?.value.trim()||'';$('#rEmail').focus();return}
if(e.target.id==='rSend'){const email=$('#rEmail')?.value.trim()||'',msg=$('#rMsg'),b=e.target;if(!email){msg.textContent='Enter your account email.';return}b.disabled=true;b.textContent='Sending…';try{const d=await api('/api/auth/forgot-password/request',{method:'POST',body:{email}});msg.style.color='var(--ok)';msg.textContent=d.message||'Check your email for the OTP.';$('#rOtp').focus()}catch(err){msg.style.color='var(--danger)';msg.textContent=err.message}finally{b.disabled=false;b.textContent='Send OTP'}return}
if(e.target.id==='rVerify'){const email=$('#rEmail')?.value.trim()||'',otp=$('#rOtp')?.value.trim()||'',pw=$('#rPw')?.value||'',msg=$('#rMsg'),b=e.target;if(!email||!otp||!pw){msg.textContent='Fill email, OTP and new password.';return}b.disabled=true;b.textContent='Resetting…';try{const d=await api('/api/auth/forgot-password/verify',{method:'POST',body:{email,otp,new_password:pw}});msg.style.color='var(--ok)';msg.textContent=d.message||'Password reset. Please login.';$('#em').value=email;$('#pw').focus()}catch(err){msg.style.color='var(--danger)';msg.textContent=err.message}finally{b.disabled=false;b.textContent='Reset password'}}});
document.addEventListener('click',e=>{const a=e.target.closest('a');if(!a)return;const h=a.getAttribute('href')||'';if(h.startsWith('/')&&!h.startsWith('//')){e.preventDefault();nav(h)}});window.addEventListener('popstate',render);

/* ===== Storefront IA: Home + department/subcategory navigation ===== */
const STORE_CATEGORIES=[
  {id:'beauty',name:'Beauty',icon:'✦',desc:'Skincare, haircare & beauty essentials',subs:['Skincare','Haircare','Makeup','Personal Care']},
  {id:'fashion',name:'Clothing',icon:'◌',desc:'Everyday fashion for everyone',subs:['Girls Clothing','Boys Clothing','Women Clothing','Men Clothing']},
  {id:'kids',name:'Kids',icon:'◇',desc:'Fun, useful picks for little ones',subs:['Kids Fashion','Toys & Games','Baby Care','School & Activity']},
  {id:'home',name:'Home & Living',icon:'⌂',desc:'Make every room feel better',subs:['Home Decor','Kitchen','Storage & Organization','Lighting']},
  {id:'tech',name:'Tech & Gadgets',icon:'⌁',desc:'Smart upgrades for everyday life',subs:['Mobile Accessories','Gadgets','Wearables','Desk Setup']},
  {id:'wellness',name:'Health & Wellness',icon:'♡',desc:'Everyday wellness and self-care',subs:['Fitness','Wellness','Personal Care']},
  {id:'pets',name:'Pet Care',icon:'◇',desc:'Useful picks for happy pets',subs:['Dog Care','Cat Care','Grooming','Pet Accessories']}
];
const CATEGORY_ALIASES={
  beauty:['Beauty','Skincare','Haircare','Makeup','Personal Care'],
  fashion:['Clothing','Girls Clothing','Boys Clothing','Women Clothing','Men Clothing'],
  kids:['Kids','Kids Fashion','Toys & Games','Baby Care','School & Activity'],
  home:['Home & Decor','Kitchen & Wellness','Home','Kitchen','Storage & Organization','Lighting'],
  tech:['Mobile & Tech','Tech & Gadgets','Mobile Accessories','Gadgets','Wearables'],
  wellness:['Health & Wellness','Fitness & Wearables','Wellness','Fitness'],
  pets:['Pet Care','Dog Care','Cat Care','Grooming']
};
const categoryProducts=(id)=>state.products.filter(p=>(CATEGORY_ALIASES[id]||[]).some(x=>String(p.category||'').toLowerCase()===x.toLowerCase()));
function hasCategory(id){return categoryProducts(id).length>0}
function goCategory(id,sub=''){
  shop.cat=sub||id;
  shop.parent=sub?'':id;
  nav('/shop?category='+encodeURIComponent(id)+(sub?'&sub='+encodeURIComponent(sub):''));
}
function goAllProducts(){shop.parent='';shop.cat='All';shop.q='';nav('/shop')}
function parseShopParams(){
  const u=new URL(location.href),id=u.searchParams.get('category'),sub=u.searchParams.get('sub');
  if(id&&STORE_CATEGORIES.some(c=>c.id===id)){shop.parent=id;shop.cat=sub||id}else if(!id){shop.parent='';if(!STORE_CATEGORIES.some(c=>c.id===shop.cat))shop.cat='All'}
}
function storefrontBack(){
  if(history.length>1) history.back(); else nav('/');
}
function backControl(){
  return '<button type="button" class="store-back" onclick="storefrontBack()" aria-label="Go back">← <span>Back</span></button>';
}
function categoryTile(c,i){
  const count=categoryProducts(c.id).length;
  return '<button class="category-tile category-tile-lg" onclick="goCategory(\''+c.id+'\')" aria-label="Shop '+esc(c.name)+'"><span class="category-icon">'+c.icon+'</span><span class="category-num">0'+(i+1)+'</span><strong>'+esc(c.name)+'</strong><span>'+esc(c.desc)+'</span><small>'+count+' '+(count===1?'product':'products')+' · Explore →</small></button>';
}
function home(){
  const cfg=state.siteConfig||{},hero=cfg.hero||{},featured=state.products[0];
  meta((cfg.brand||'BBest Globly')+' — Modern Shopping for Everyday Life','Shop beauty, fashion, kids, home, tech, wellness and pet products at BBest Globly.');
  const featuredHtml=featured?'<a class="hero-product-card" href="/product/'+featured.id+'"><div class="hero-product-image"><img src="'+featured.img+'" alt="'+esc(featured.name)+'" loading="eager"></div><div class="hero-product-info"><span>Featured pick</span><strong>'+esc(featured.name)+'</strong><b>'+money(featured.price_inr)+'</b></div><span class="hero-product-arrow">↗</span></a>':'';
  $('#app').innerHTML='<section class="hero"><div class="hero-bg" style="background-image:url(\'img/hero.jpg\')"></div><div class="hero-noise"></div><div class="hero-orb orb-a"></div><div class="hero-orb orb-b"></div><div class="hero-in wrap"><div class="hero-copy reveal-up"><span class="hero-kicker"><i></i>'+esc(hero.kicker||'✦ New arrivals')+'</span><h1>Find your next <em>favourite.</em></h1><p>Beauty, fashion, kids, home, tech and everyday essentials — organised so you can find what you need faster.</p><div class="hero-cta"><a class="btn btn-primary btn-lg" href="/shop">Shop everything <span>↗</span></a><a class="hero-text-link" href="#departments" onclick="event.preventDefault();document.getElementById(\'departments\')?.scrollIntoView({behavior:\'smooth\'})">Browse categories <span>↓</span></a></div><div class="hero-micro-proof"><span><b>'+state.products.length+'+</b> live picks</span><span class="proof-dot"></span><span>Simple checkout</span><span class="proof-dot"></span><span>Order tracking</span></div></div>'+featuredHtml+'</div><div class="hero-bottom-fade"></div></section><section class="wrap"><div class="value-row reveal-stagger"><div class="value"><span class="v-ico">✦</span><div><strong>Curated categories</strong><span>Find products without endless scrolling</span></div></div><div class="value"><span class="v-ico">↗</span><div><strong>Easy discovery</strong><span>Shop by department or search directly</span></div></div><div class="value"><span class="v-ico">⌁</span><div><strong>Track every order</strong><span>Know what is happening next</span></div></div></div><section id="departments" class="category-panel reveal-up"><div class="category-panel-head"><div><span class="eyebrow">SHOP BY DEPARTMENT</span><h2>What are you shopping for?</h2><p class="muted">Choose a department, then narrow down to exactly what you want.</p></div><a href="/shop">View all <span>→</span></a></div><div class="category-grid category-grid-main">'+STORE_CATEGORIES.map(categoryTile).join('')+'</div></section><section class="subcat-showcase reveal-up"><div class="section-heading"><div><span class="eyebrow">MADE FOR EVERYONE</span><h2>Popular sections</h2></div></div><div class="subcat-pills">'+STORE_CATEGORIES.flatMap(c=>c.subs.slice(0,2).map(s=>'<button onclick="goCategory(\''+c.id+'\',\''+esc(s).replace(/'/g,"&#39;")+'\')">'+esc(s)+' <span>→</span></button>')).join('')+'</div></section><section class="featured-section"><div class="section-heading reveal-up"><div><span class="eyebrow">CURATED FOR NOW</span><h2>Trending now</h2><p>Live products from the current catalogue. More departments will appear as inventory is added.</p></div><a class="section-link" href="/shop">See the full shop →</a></div><div class="grid">'+state.products.map(card).join('')+'</div></section><section class="editorial-panel reveal-up"><div><span class="eyebrow">THE BBEST APPROACH</span><h2>One store. Clear departments. Less scrolling.</h2><p>Use Home to discover, Departments to browse, Search to find, and your account to track everything after checkout.</p><a class="btn btn-outline" href="/shop">Browse all products <span>→</span></a></div><div class="editorial-stats"><div><strong>01</strong><span>Discover</span></div><div><strong>02</strong><span>Choose</span></div><div><strong>03</strong><span>Track</span></div></div></section></section>';
}
function shopPage(){
  parseShopParams();
  const activeParent=shop.parent;
  const parentDef=STORE_CATEGORIES.find(c=>c.id===activeParent);
  const cats=activeParent?['All',...(parentDef?.subs||[])]:['All',...STORE_CATEGORIES.map(c=>c.id)];
  meta((parentDef?parentDef.name+' — ':'')+'Shop — BBest Globly','Browse BBest Globly products by department and category.');
  const back=activeParent?backControl():'';
  $('#app').innerHTML='<section class="page"><div class="shop-topline">'+back+'<div><span class="eyebrow">BBEST GLOBLY</span><h1>'+(parentDef?esc(parentDef.name):'Shop')+'</h1><p class="muted">'+(parentDef?esc(parentDef.desc):'Browse every department in one place.')+'</p></div></div><div class="department-rail"><button class="all-department '+(!activeParent?'on':'')+'" onclick="goAllProducts()"><span>✦</span>All</button>'+STORE_CATEGORIES.map(c=>'<button class="'+(c.id===activeParent?'on':'')+'" onclick="goCategory(\''+c.id+'\')"><span>'+c.icon+'</span>'+esc(c.name)+'</button>').join('')+'</div><div class="toolbar"><input id="q" type="search" placeholder="Search products…" value="'+esc(shop.q)+'"><select id="sort"><option value="featured">Featured</option><option value="price-asc">Price: Low → High</option><option value="price-desc">Price: High → Low</option></select></div><div class="chips" id="cats">'+cats.map(c=>'<button class="chip '+((!activeParent&&shop.cat==='All'&&c==='All')||(activeParent&&(c==='All'?shop.cat===activeParent:shop.cat===c))?'on':'')+'" data-cat="'+esc(c)+'">'+esc(c==='All'?'All':c)+'</button>').join('')+'</div><div class="grid" id="grid"></div></section>';
  $('#q').oninput=e=>{shop.q=e.target.value;drawShop();if(shop.q.trim()){document.querySelectorAll('#cats .chip').forEach(x=>x.classList.remove('on'))}};
  $('#sort').value=shop.sort;
  $('#sort').onchange=e=>{shop.sort=e.target.value;drawShop()};
  $$('#cats .chip').forEach(b=>b.onclick=()=>{
    const v=b.dataset.cat;
    shop.cat=v==='All'?(activeParent||'All'):v;
    $$('#cats .chip').forEach(x=>x.classList.toggle('on',x===b));
    drawShop();
  });
  drawShop();
}
function drawShop(){
  const activeParent=shop.parent;
  const query=shop.q.trim().toLowerCase();
  const aliases=activeParent?(CATEGORY_ALIASES[activeParent]||[]):null;
  let a=state.products.filter(p=>{
    const hay=(p.name+' '+p.category+' '+p.tagline+' '+(p.description||'')+' '+(p.features||[]).join(' ')).toLowerCase();
    const matchesQuery=!query||hay.includes(query);
    // Search is global: once a customer types a query, show matching products from the whole store.
    if(query)return matchesQuery;
    const inParent=!aliases||aliases.some(x=>String(p.category||'').toLowerCase()===x.toLowerCase());
    const inSub=!activeParent||shop.cat===activeParent||shop.cat==='All'||String(p.category||'').toLowerCase()===String(shop.cat).toLowerCase();
    return inParent&&inSub;
  });
  if(shop.sort==='price-asc')a=a.slice().sort((x,y)=>x.price_inr-y.price_inr);
  if(shop.sort==='price-desc')a=a.slice().sort((x,y)=>y.price_inr-x.price_inr);
  $('#grid').innerHTML=a.length?a.map(card).join(''):'<div class="category-empty"><div class="category-empty-icon">✦</div><h3>This section is ready for new products</h3><p>We have created this category for the store. Products will appear here as inventory is added.</p><a class="btn btn-outline" href="/shop">Browse all products</a></div>';
}

(async()=>{try{const [productsCfg,siteCfg]=await Promise.all([api('/api/products').catch(()=>api('/data/products.json')),api('/api/site/config').catch(()=>state.siteConfig)]);state.products=Array.isArray(productsCfg)?productsCfg:[];state.siteConfig=siteCfg||state.siteConfig;applySiteConfig();if(state.token){try{state.user=await api('/api/auth/me',{auth:'user'})}catch{state.token='';localStorage.removeItem('bg_token')}}}catch{state.products=[]}const inr=$('#curINR'),usd=$('#curUSD');if(inr)inr.onclick=()=>{state.currency='INR';localStorage.setItem('bg_cur','INR');render()};if(usd)usd.onclick=()=>{state.currency='USD';localStorage.setItem('bg_cur','USD');render()};render()})();




