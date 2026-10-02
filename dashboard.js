const $=(s,e=document)=>e.querySelector(s), $$=(s,e=document)=>[...e.querySelectorAll(s)];
let token=localStorage.getItem('bg_admin')||'',products=[],orders=[],customers=[],currentView='overview',aiHistory=[];
try{aiHistory=JSON.parse(sessionStorage.getItem('bg_ai_history')||'[]');if(!Array.isArray(aiHistory))aiHistory=[];}catch{aiHistory=[]}
function reportClientError(message){console.error('[dashboard]',message);const el=$('#loginErr');if(el){el.style.color='var(--danger)';el.textContent='Dashboard error: '+String(message||'Unexpected error');}}
window.addEventListener('error',e=>reportClientError(e.message||'Unexpected client error'));
window.addEventListener('unhandledrejection',e=>reportClientError(e.reason?.message||String(e.reason||'Unexpected async error')));
function saveAIHistory(){aiHistory=aiHistory.slice(-30);sessionStorage.setItem('bg_ai_history',JSON.stringify(aiHistory));}
function renderAIHistory(){const box=$('#aiHistory');if(!box)return;box.innerHTML=aiHistory.map(m=>'<div class="ai-message '+esc(m.role)+'"><strong>'+esc(m.role==='user'?'You':'AI')+'</strong><div>'+esc(m.content)+'</div></div>').join('');box.scrollTop=box.scrollHeight;}
async function api(path,opt={}){
  const headers={}; if(opt.body)headers['Content-Type']='application/json'; if(token)headers.Authorization='Bearer '+token;
  const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),15000);
  try{
    const r=await fetch(path,{method:opt.method||'GET',headers,body:opt.body?JSON.stringify(opt.body):undefined,signal:controller.signal,cache:'no-store'});
    let d={}; try{d=await r.json()}catch{}
    if(!r.ok)throw Error(d.error||('Request failed ('+r.status+')'));
    return d;
  }catch(e){if(e?.name==='AbortError')throw Error('Request timed out. Please retry.');throw e}
  finally{clearTimeout(timer)}
}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}function money(n){return '₹'+Number(n||0).toLocaleString('en-IN')}
async function refresh(){[products,orders,customers]=await Promise.all([api('/api/admin/products'),api('/api/admin/orders'),api('/api/admin/customers')])}
function setView(v){currentView=v;$$('.view').forEach(x=>x.classList.toggle('hidden',x.id!==v));$$('.nav-btn').forEach(x=>x.classList.toggle('active',x.dataset.view===v));const t={overview:'Business Overview',products:'Product Management',orders:'Orders',customers:'Customers',suppliers:'Supplier / Dropshipping',research:'AI Product Research',pricing:'Pricing & Offers',marketing:'AI Marketing',seo:'AI SEO Manager',support:'Customer Support',finance:'Finance & Profit',controls:'AI Control Center',security:'Security & Audit',approvals:'Approval Center'};$('#pageTitle').textContent=t[v]||'Business Overview';render()}
function render(){if(!token)return;if(currentView==='overview')overview();if(currentView==='products')productView();if(currentView==='orders')orderView();if(currentView==='customers')customerView();if(currentView==='suppliers')supplierView();if(currentView==='research')researchView();if(currentView==='pricing')pricingView();if(currentView==='marketing')marketingView();if(currentView==='seo')seoView();if(currentView==='support')supportView();if(currentView==='finance')financeView();if(currentView==='controls')controlsView();if(currentView==='security')securityView();if(currentView==='approvals')approvalView()}
async function overview(){
  const active=orders.filter(o=>o.status!=="CANCELLED");
  const booked=active.reduce((s,o)=>s+Number(o.totals?.total_inr||0),0);
  const collected=active.filter(o=>o.payment?.paid===true).reduce((s,o)=>s+Number(o.totals?.total_inr||0),0);
  const open=active.filter(o=>!["DELIVERED","CANCELLED"].includes(o.status)).length;
  const aov=active.length?booked/active.length:0;
  const today=new Date();today.setHours(0,0,0,0);
  const todaySales=active.filter(o=>new Date(o.created||0)>=today).reduce((s,o)=>s+Number(o.totals?.total_inr||0),0);
  const units={};
  for(const o of active)for(const item of (o.items||[])){
    const qty=Math.max(0,Number(item.qty)||0),p=products.find(x=>x.id===item.id);
    if(!p)continue;
    if(!units[p.id])units[p.id]={name:p.name,units:0,sales:0};
    units[p.id].units+=qty;units[p.id].sales+=qty*Number(item.price_inr||p.price_inr||0);
  }
  const top=Object.values(units).sort((a,b)=>b.sales-a.sales).slice(0,5);
  const lowStock=products.filter(p=>p.published!==false&&Number(p.stock??0)<=5);
  $("#overview").innerHTML=
    "<div class=\"grid stats\">"+
      "<div class=\"stat\"><div class=\"label\">Today sales</div><div class=\"value\">"+money(todaySales)+"</div></div>"+
      "<div class=\"stat\"><div class=\"label\">Orders</div><div class=\"value\">"+orders.length+"</div></div>"+
      "<div class=\"stat\"><div class=\"label\">Sales booked</div><div class=\"value\">"+money(booked)+"</div></div>"+
      "<div class=\"stat\"><div class=\"label\">AOV</div><div class=\"value\">"+money(aov)+"</div></div>"+
    "</div>"+
    "<div class=\"grid stats\" style=\"margin-top:16px\">"+
      "<div class=\"stat\"><div class=\"label\">Collected</div><div class=\"value\">"+money(collected)+"</div></div>"+
      "<div class=\"stat\"><div class=\"label\">Open orders</div><div class=\"value\">"+open+"</div></div>"+
      "<div class=\"stat\"><div class=\"label\">Customers</div><div class=\"value\">"+customers.length+"</div></div>"+
      "<div class=\"stat\"><div class=\"label\">Low stock</div><div class=\"value\">"+lowStock.length+"</div></div>"+
    "</div>"+
    "<div class=\"section-card\"><div class=\"section-head\"><div><h2>Growth Analytics · Last 7 Days</h2><div class=\"muted\">Tracked storefront events only. No invented traffic.</div></div><button class=\"btn soft\" id=\"refreshAnalytics\">Refresh</button></div>"+
      "<div id=\"growthGrid\" class=\"grid stats\"><div class=\"notice\">Loading analytics…</div></div><div id=\"growthTop\" class=\"table-wrap\" style=\"margin-top:14px\"></div>"+
    "</div>"+
    "<div class=\"section-card\"><div class=\"section-head\"><div><h2>AI Activity · Today</h2><div class=\"muted\">Recent AI planning/execution events recorded in Supabase.</div></div><button class=\"btn soft\" id=\"refreshActivity\">Refresh</button></div><div id=\"aiActivity\" class=\"table-wrap\"><div class=\"notice\">Loading activity…</div></div></div>"+
    "<div class=\"section-card\"><div class=\"section-head\"><div><h2>Top Products</h2><div class=\"muted\">Based on recorded order lines.</div></div><span class=\"badge\">No invented metrics</span></div>"+
      "<div class=\"table-wrap\"><table class=\"tbl\"><thead><tr><th>Product</th><th>Units</th><th>Booked sales</th></tr></thead><tbody>"+
      (top.length?top.map(x=>"<tr><td>"+esc(x.name)+"</td><td>"+x.units+"</td><td>"+money(x.sales)+"</td></tr>").join(""):"<tr><td colspan=\"3\">No product sales recorded yet.</td></tr>")+
      "</tbody></table></div></div>"+
    "<div class=\"section-card\"><div class=\"section-head\"><div><h2>Operational Readiness</h2><div class=\"muted\">Live connection checks for the admin workspace.</div></div><button class=\"btn soft\" id=\"refreshReadiness\">Refresh</button></div><div id=\"readinessGrid\" class=\"grid readiness-grid\"><div class=\"notice\">Checking integrations…</div></div></div>"+
    "<div class=\"section-card\"><div class=\"section-head\"><h2>Quick actions</h2></div><div class=\"actions\"><button class=\"btn soft\" data-go=\"products\">Add product</button><button class=\"btn soft\" data-go=\"research\">Research products</button><button class=\"btn soft\" data-go=\"pricing\">Pricing & offers</button><button class=\"btn soft\" data-go=\"marketing\">Create campaign</button><button class=\"btn soft\" data-go=\"finance\">Check profit</button></div></div>";
  $("[data-go=\"products\"]").onclick=()=>setView("products");$("[data-go=\"research\"]").onclick=()=>setView("research");$("[data-go=\"pricing\"]").onclick=()=>setView("pricing");$("[data-go=\"marketing\"]").onclick=()=>setView("marketing");$("[data-go=\"finance\"]").onclick=()=>setView("finance");

  async function analytics(){
    try{
      const d=await api("/api/admin/analytics/summary?days=7"),e=d.events||{};
      const items=[["Unique sessions",d.unique_sessions||0],["Product views",e.product_view||0],["Add to cart",e.add_to_cart||0],["Checkout starts",e.checkout_start||0],["Purchase events",e.purchase_success||0]];
      $("#growthGrid").innerHTML=items.map(x=>"<div class=\"stat\"><div class=\"label\">"+esc(x[0])+"</div><div class=\"value\">"+x[1]+"</div></div>").join("");
      const tp=d.top_products||[];$("#growthTop").innerHTML=tp.length?("<h3 style=\"margin:0 0 8px\">Most viewed products</h3><table class=\"tbl\"><thead><tr><th>Product</th><th>Views</th></tr></thead><tbody>"+tp.map(x=>"<tr><td>"+esc(x.name)+"</td><td>"+x.views+"</td></tr>").join("")+"</tbody></table>"):"<div class=\"notice\">No product-view events recorded yet.</div>";
    }catch(e){$("#growthGrid").innerHTML="<div class=\"notice\">Analytics unavailable: "+esc(e.message)+"</div>";$("#growthTop").innerHTML=""}
  }
  async function activity(){
    try{
      const rows=await api("/api/admin/agent/logs");
      const todayStart=Date.now()-86400000,logs=rows.filter(x=>new Date(x.created_at||0).getTime()>=todayStart).slice(0,12);
      $("#aiActivity").innerHTML=logs.length?'<table class="tbl"><thead><tr><th>Time</th><th>Role</th><th>Activity</th></tr></thead><tbody>'+logs.map(x=>'<tr><td>'+esc(new Date(x.created_at).toLocaleTimeString('en-IN'))+'</td><td>'+esc(x.role||'AI')+'</td><td>'+esc(String(x.message||'').slice(0,180))+'</td></tr>').join('')+'</tbody></table>':'<div class="notice">No AI activity recorded today.</div>';
    }catch(e){$("#aiActivity").innerHTML='<div class="notice">AI activity unavailable: '+esc(e.message)+'</div>'}
  }
  async function readiness(){
    try{
      const d=await api("/api/admin/readiness"),items=[["AI Manager",d.ai?.configured,d.ai?.liveResearchConfigured?"AI + live research":"AI only"],["Supabase data",d.persistence?.configured,d.persistence?.configured?"Connected":"Not connected"],["Password recovery",d.password_recovery?.configured,d.password_recovery?.configured?"Gmail OTP ready":"Needs Gmail SMTP"],["Razorpay",d.payments?.configured,d.payments?.configured?"Payments ready":"Keys not ready"],["Shiprocket",d.shipping?.configured,d.shipping?.configured?"Shipping ready":"Not connected"],["Qikink",d.supplier_qikink?.configured,d.supplier_qikink?.configured?"Supplier API ready":"Not connected"]];
      $("#readinessGrid").innerHTML=items.map(x=>"<div class=\"stat\"><div class=\"label\">"+esc(x[0])+"</div><div class=\"value\" style=\"font-size:1rem\">"+(x[1]?"READY":"SETUP NEEDED")+"</div><div class=\"muted\">"+esc(x[2])+"</div></div>").join("");
    }catch(e){$("#readinessGrid").innerHTML="<div class=\"notice\">Readiness check failed: "+esc(e.message)+"</div>"}
  }
  $("#refreshAnalytics").onclick=analytics;$("#refreshActivity").onclick=activity;$("#refreshReadiness").onclick=readiness;
  analytics();activity();readiness();
}
function renderAgentActions(actions){
  const box=$('#aiHistory'); if(!box) return;
  const cards=(actions||[]).map((a,i)=>{
    return '<div class="agent-action" id="agentAction'+i+'"><strong>Approval required</strong><div class="agent-type">'+esc(a.type||'action')+'</div><div class="muted">'+esc(a.reason||'Owner approval required')+'</div><pre>'+esc(JSON.stringify(a.payload||{},null,2))+'</pre><div class="actions"><button class="btn primary agent-approve" data-index="'+i+'">Approve & Execute</button><button class="btn danger agent-reject" data-index="'+i+'">Reject</button></div></div>';
  }).join('');
  box.insertAdjacentHTML('beforeend',cards);
  $$('#aiHistory .agent-approve').forEach(btn=>btn.onclick=async()=>{
    const idx=Number(btn.dataset.index), action=actions[idx]; btn.disabled=true; btn.textContent='Executing…';
    try{
      const d=await api('/api/admin/agent/execute',{method:'POST',body:{approval_id:action.approvalId}});
      btn.textContent='Done ✓'; btn.classList.remove('primary'); btn.classList.add('soft');
      aiHistory.push({role:'assistant',content:'Executed '+action.type+' successfully.'}); saveAIHistory(); renderAIHistory();
      await refresh(); if(currentView!=='approvals') setView(currentView);
    }catch(e){btn.disabled=false;btn.textContent='Approve & Execute';alert(e.message)}
  });
  $$('#aiHistory .agent-reject').forEach(btn=>btn.onclick=async()=>{
    const idx=Number(btn.dataset.index), action=actions[idx]; btn.disabled=true; btn.textContent='Rejecting…';
    try{
      await api('/api/admin/approvals/'+encodeURIComponent(action.approvalId)+'/reject',{method:'POST'});
      btn.textContent='Rejected ✓'; btn.classList.remove('danger'); btn.classList.add('soft');
    }catch(e){btn.disabled=false;btn.textContent='Reject';alert(e.message)}
  });
}
async function runAgent(command){
  if(!command.trim())return;
  const input=$('#aiCommand'),out=$('#aiOutput');
  const userMessage=command.trim();
  aiHistory.push({role:'user',content:'[AGENT] '+userMessage}); saveAIHistory(); renderAIHistory();
  out.textContent='Planning…';
  try{
    const d=await api('/api/admin/agent/command',{method:'POST',body:{command:userMessage}});
    const reply=d.reply||'Agent plan ready.';
    aiHistory.push({role:'assistant',content:reply}); saveAIHistory(); renderAIHistory();
    if(d.actions?.length) renderAgentActions(d.actions);
    out.textContent=d.actions?.length?('Agent found '+d.actions.length+' action(s). Approve or reject them below.'):'No executable action was generated.';
    input.value=''; input.focus();
  }catch(e){out.textContent='Agent error: '+e.message}
}
async function askAI(command){
  if(!command.trim())return;
  const input=$('#aiCommand'),out=$('#aiOutput');
  const userMessage=command.trim();
  aiHistory.push({role:'user',content:userMessage}); saveAIHistory(); renderAIHistory();
  out.textContent='Thinking…';
  try{
    const d=await api('/api/ai/chat',{method:'POST',body:{
      message:userMessage,
      context:{products,orders,conversation:aiHistory.slice(-12)}
    }});
    const reply=d.reply||d.error||'No response';
    aiHistory.push({role:'assistant',content:reply}); saveAIHistory(); renderAIHistory();
    out.textContent='';
    input.value='';
    input.focus();
  }catch(e){
    aiHistory.push({role:'assistant',content:'AI error: '+e.message}); saveAIHistory(); renderAIHistory();
    out.textContent='';
    input.focus();
  }
}

function productView(){let rows=products.map(p=>'<div class="product-row"><img src="'+esc(p.img||'')+'" alt=""><div><strong>'+esc(p.name)+'</strong><div class="muted">'+esc(p.category||'')+' · '+money(p.price_inr)+'</div><span class="badge">'+esc((p.badges||[])[0]||'Product')+'</span>'+(p.supplier?'<div class="muted">Supplier: '+esc(p.supplier)+(p.supplier_sku?' · SKU '+esc(p.supplier_sku):'')+'</div>':'')+'</div><div class="actions"><button class="btn soft edit" data-id="'+esc(p.id)+'">Edit</button><button class="btn danger del" data-id="'+esc(p.id)+'">Delete</button></div></div>').join('');$('#products').innerHTML='<div class="section-card"><div class="section-head"><div><h2>Products</h2><div class="muted">'+products.length+' products</div></div><button class="btn primary" id="newProduct">+ Add Product</button></div>'+rows+'</div>';$('#newProduct').onclick=()=>openProductModal();$$('#products .edit').forEach(b=>b.onclick=()=>openProductModal(products.find(p=>p.id===b.dataset.id)));$$('#products .del').forEach(b=>b.onclick=()=>deleteProduct(b.dataset.id))}
function openProductModal(p){const edit=!!p,m=document.createElement('div');m.className='modal';m.innerHTML='<div class="modal-card"><button class="close">✕</button><h2>'+(edit?'Edit':'Add')+' Product</h2><div class="form-grid"><div><label>Name</label><input id="pn" value="'+esc(p?.name||'')+'"></div><div><label>Category</label><input id="pc" value="'+esc(p?.category||'')+'"></div><div><label>Price (INR)</label><input id="pp" type="number" value="'+Number(p?.price_inr||0)+'"></div><div><label>Compare at</label><input id="px" type="number" value="'+Number(p?.compare_at_inr||0)+'"></div><div class="full"><label>Image URL/path</label><input id="pi" value="'+esc(p?.img||'img/p1.svg')+'"></div><div class="full"><label>Tagline</label><input id="pt" value="'+esc(p?.tagline||'')+'"></div><div class="full"><label>Description</label><textarea id="pd" rows="4">'+esc(p?.description||'')+'</textarea></div><div class="full"><label>Features (one per line)</label><textarea id="pf" rows="4">'+esc((p?.features||[]).join('\n'))+'</textarea></div><div><label>Badge</label><input id="pb" value="'+esc((p?.badges||[])[0]||'New')+'"></div><div><label>SKU</label><input id="ps" value="'+esc(p?.sku||'')+'"></div><div><label>Supplier</label><input id="psup" placeholder="Qikink" value="'+esc(p?.supplier||'')+'"></div><div><label>Supplier SKU</label><input id="psku" value="'+esc(p?.supplier_sku||'')+'" placeholder="Used for supplier fulfillment"></div><div><label>Supplier Cost (INR)</label><input id="pcost" type="number" value="'+Number(p?.supplier_cost_inr||0)+'"></div></div><div class="actions" style="margin-top:14px"><button id="saveP" class="btn primary">'+(edit?'Save changes':'Create product')+'</button><button id="cancelP" class="btn">Cancel</button></div><p id="perr" class="error"></p></div>';document.body.appendChild(m);const close=()=>m.remove();$('.close',m).onclick=close;$('#cancelP',m).onclick=close;$('#saveP',m).onclick=async()=>{const body={name:$('#pn',m).value,category:$('#pc',m).value,price_inr:Number($('#pp',m).value),compare_at_inr:Number($('#px',m).value)||0,img:$('#pi',m).value,tagline:$('#pt',m).value,description:$('#pd',m).value,features:$('#pf',m).value.split(/\n+/).map(x=>x.trim()).filter(Boolean),badges:[$('#pb',m).value||'New'],sku:$('#ps',m).value.trim(),supplier:$('#psup',m).value.trim(),supplier_sku:$('#psku',m).value.trim(),supplier_cost_inr:Number($('#pcost',m).value)||0};try{await api(edit?'/api/admin/products/'+encodeURIComponent(p.id):'/api/admin/products',{method:edit?'PUT':'POST',body});await refresh();close();productView()}catch(e){$('#perr',m).textContent=e.message}}}
async function deleteProduct(id){if(!confirm('Delete this product?'))return;try{await api('/api/admin/products/'+encodeURIComponent(id),{method:'DELETE'});await refresh();productView()}catch(e){alert(e.message)}}
function orderView(){
  const rows=orders.length?orders.map(o=>{
    const shipping=o.shiprocket_awb?('AWB '+esc(o.shiprocket_awb)):(o.fulfillment_state||'UNFULFILLED');
    const canShip=o.status!=='CANCELLED' && !o.shiprocket_awb;
    return '<tr><td>'+esc(o.id)+'</td><td>'+esc(o.customer?.name||'')+'</td><td>'+money(o.totals?.total_inr)+'</td><td><select data-order="'+esc(o.id)+'">'+['PENDING','CONFIRMED','AWAITING_PAYMENT','SHIPPED','DELIVERED','CANCELLED'].map(x=>'<option value="'+x+'" '+(x===o.status?'selected':'')+'>'+x+'</option>').join('')+'</select></td><td><div class="muted">'+shipping+'</div>'+(canShip?'<button class="btn soft ship-order" data-id="'+esc(o.id)+'">Create Shipment</button>':'')+'</td></tr>';
  }).join(''):'<tr><td colspan="5">No orders</td></tr>';
  $('#orders').innerHTML='<div class="section-card"><div class="section-head"><h2>Orders</h2><button id="refreshOrders" class="btn soft">Refresh</button></div><div class="table-wrap"><table class="tbl"><thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Status</th><th>Fulfillment</th></tr></thead><tbody>'+rows+'</tbody></table></div></div>';
  $('#refreshOrders').onclick=async()=>{await refresh();orderView()};
  $$('#orders select').forEach(s=>s.onchange=async()=>{try{await api('/api/admin/order-status',{method:'POST',body:{id:s.dataset.order,status:s.value}});await refresh();orderView()}catch(e){alert(e.message)}});
  $$('#orders .ship-order').forEach(b=>b.onclick=async()=>{
    if(!confirm('Create the Shiprocket shipment and try to assign an AWB for this order?'))return;
    b.disabled=true;b.textContent='Creating…';
    try{const r=await api('/api/admin/fulfillment/ship/'+encodeURIComponent(b.dataset.id),{method:'POST'});toast(r.awb?'Shipment created · AWB '+r.awb:'Shiprocket order created');await refresh();orderView()}catch(e){b.disabled=false;b.textContent='Create Shipment';alert(e.message)}
  });
}
async function supplierView(){
  $('#suppliers').innerHTML='<div class="section-card"><div class="section-head"><div><h2>🚚 Supplier / Dropshipping</h2><div class="muted">AI researches the supplier catalog, prepares products and sends only approved actions for execution.</div></div><button class="btn soft" id="supplierRefresh">Refresh</button></div><div id="supplierStatus" class="notice">Checking supplier connection…</div></div><div class="section-card"><div class="section-head"><div><h2>🤖 AI Qikink Product Scout</h2><div class="muted">No manual SKU copying for the research workflow. AI uses Qikink public catalog data and creates approval-ready product drafts.</div></div><span class="badge">AI + Approval</span></div><textarea id="qikinkScoutCmd" class="command" placeholder="Example: Find 3 Qikink products for a Diwali gifting collection under ₹900, target at least 30% gross margin before shipping/ads."></textarea><div class="actions" style="margin-top:8px"><button type="button" class="btn primary" id="qikinkScout">Run AI Scout</button><button type="button" class="btn soft" id="openApprovals">Open Approvals</button></div><div id="qikinkScoutOut" class="ai-output">Ready.</div></div><div class="section-card"><div class="section-head"><h2>Qikink</h2><span class="badge">Open API</span></div><p class="muted">Order forwarding uses the Qikink Open API. Automatic supplier ordering stays off until explicitly enabled, so paid supplier actions remain owner-approved.</p><div id="qikinkOrders"></div></div>';

  async function load(){
    try{
      const s=await api('/api/admin/suppliers/qikink/status');
      $('#supplierStatus').innerHTML=s.configured?'<strong>Qikink connected.</strong><div class="muted">Shipping: '+(s.shipping?'Qikink':'Self')+' · Auto fulfillment: '+(s.autoFulfill?'ON':'OFF')+'</div>':'<strong>Qikink not connected.</strong><div class="muted">Add QIKINK_AUTH_TOKEN in Render.</div>';
      const rows=orders.map(o=>{
        const hasSku=(o.items||[]).every(i=>{const p=products.find(x=>x.id===i.id);return !!(p?.supplier_sku||p?.sku)});
        const ready=o.status!=='CANCELLED' && hasSku && !o.supplier_order_id;
        return '<div class="product-row"><div><strong>'+esc(o.id)+'</strong><div class="muted">'+esc(o.customer?.name||'')+' · '+money(o.totals?.total_inr)+'</div><span class="badge">'+esc(o.supplier_status||'Not sent')+'</span></div><div class="muted">'+(hasSku?'Supplier SKU ready':'Missing supplier SKU')+'</div><div class="actions">'+(ready?'<button class="btn primary qikink-send" data-id="'+esc(o.id)+'">Send to Qikink</button>':'')+'</div></div>';
      }).join('');
      $('#qikinkOrders').innerHTML=rows||'<div class="notice">No orders yet.</div>';
      $$('.qikink-send').forEach(btn=>btn.onclick=async()=>{
        btn.disabled=true;btn.textContent='Sending…';
        try{const r=await api('/api/admin/suppliers/qikink/orders/'+encodeURIComponent(btn.dataset.id),{method:'POST'});toast('Qikink order created'+(r.supplier_order_id?' · #'+r.supplier_order_id:''));await refresh();await load()}catch(e){btn.disabled=false;btn.textContent='Send to Qikink';alert(e.message)}
      });
    }catch(e){$('#supplierStatus').textContent='Supplier status error: '+e.message}
  }

  window.__qikinkScout=async()=>{
    const out=$('#qikinkScoutOut'), cmd=$('#qikinkScoutCmd').value.trim();
    out.textContent='Starting AI Scout…';
    if(!cmd){out.textContent='Enter the product goal for the AI scout.';$('#qikinkScoutCmd').focus();return}
    const btn=$('#qikinkScout'); if(btn){btn.disabled=true;btn.textContent='Researching…'}
    try{
      const d=await api('/api/admin/suppliers/qikink/ai-scout',{method:'POST',body:{command:cmd}});
      const names=(d.actions||[]).map(a=>a.payload?.name||'product').join(', ');
      out.textContent=(d.reply||'AI scout finished.')+'\n\n'+(d.actions?.length?('Approval requests created: '+d.actions.length+'. '+names):'No approval-ready products were created.');
    }catch(e){
      out.textContent='AI scout error: '+e.message;
    }finally{
      if(btn){btn.disabled=false;btn.textContent='Run AI Scout'}
    }
  };
  $('#qikinkScout').onclick=(e)=>{e.preventDefault();window.__qikinkScout()};
  $('#openApprovals').onclick=(e)=>{e.preventDefault();setView('approvals')};
  $('#supplierRefresh').onclick=load;
  await load();
}

async function customerView(){
  const box=$("#customers");
  box.innerHTML='<div class="section-card"><div class="section-head"><div><h2>Customers</h2><div class="muted">Customer value and order history from recorded store data.</div></div><button class="btn soft" id="refreshCustomers">Refresh</button></div><div id="customerTable" class="table-wrap">Loading…</div></div>';
  async function load(){
    const t=$("#customerTable");
    try{
      const rows=await api("/api/admin/customers");
      t.innerHTML=rows.length?'<table class="tbl"><thead><tr><th>Customer</th><th>Orders</th><th>Spent</th><th>Last order</th></tr></thead><tbody>'+rows.map(x=>'<tr><td><strong>'+esc(x.name)+'</strong><br><span class="muted">'+esc(x.email)+'</span><br><span class="muted">'+esc(x.phone||'')+'</span></td><td>'+x.order_count+'</td><td>'+money(x.spent_inr)+'</td><td>'+ (x.last_order_at?new Date(x.last_order_at).toLocaleString('en-IN'):'—')+'</td></tr>').join('')+'</tbody></table>':'<div class="notice">No customer accounts yet.</div>';
    }catch(e){t.innerHTML='<div class="notice">Customer data unavailable: '+esc(e.message)+'</div>'}
  }
  $("#refreshCustomers").onclick=load; await load();
}
async function financeView(){
  const box=$("#finance");
  box.innerHTML='<div class="section-card"><div class="section-head"><div><h2>Finance, GST & Reconciliation</h2><div class="muted">Recorded sales, refunds, advertising, expenses and GST estimate.</div></div><button class="btn soft" id="refreshFinance">Refresh</button></div><div id="financeStats" class="grid stats"><div class="notice">Loading…</div></div><div id="financeNote" class="notice" style="margin-top:14px"></div></div><div class="section-card"><div class="section-head"><h2>Supplier cost breakdown</h2></div><div id="supplierCostBreakdown" class="table-wrap"></div></div><div class="section-card"><div class="section-head"><h2>Returns & refunds</h2><button class="btn soft" id="refreshReturns">Refresh</button></div><div id="returnsList">Loading…</div></div><div class="section-card"><div class="section-head"><h2>Advertising attribution</h2><button class="btn soft" id="refreshAds">Refresh</button></div><div id="adsStats" class="grid stats">Loading…</div><div class="actions" style="margin-top:12px"><button class="btn soft" id="importAds">Import ad spend</button></div></div><div class="section-card"><h2>Add financial expense</h2><div class="form-grid"><div><label>Category</label><input id="finCat" value="Other"></div><div><label>Amount ₹</label><input id="finAmt" type="number" min="0"></div><div><label>GST rate %</label><input id="finGst" type="number" min="0" max="100" value="0"></div><div><label>Date</label><input id="finDate" type="date"></div></div><textarea id="finNotes" class="command" placeholder="Notes / reference"></textarea><button class="btn primary" id="addFin">Save expense</button></div>';
  async function load(){
    try{
      const d=await api("/api/admin/finance/reconciliation?days=30");
      $("#financeStats").innerHTML=[["Sales",money(d.sales_inr)],["Refunds",money(d.refunds_inr)],["Ad spend",money(d.ad_spend_inr)],["Other expenses",money(d.expenses_inr)],["GST estimate",money(d.gst_output_inr)],["Net before tax",money(d.net_before_tax_inr)]].map(x=>'<div class="stat"><div class="label">'+esc(x[0])+'</div><div class="value" style="font-size:1.2rem">'+esc(String(x[1]))+'</div></div>').join('');
      $("#financeNote").textContent=d.note||'';
      const base=await api("/api/admin/finance/summary"),b=base.supplier_cost_breakdown||{},entries=Object.entries(b).sort((a,b)=>b[1]-a[1]);
      $("#supplierCostBreakdown").innerHTML=entries.length?'<table class="tbl"><thead><tr><th>Supplier</th><th>Recorded cost</th></tr></thead><tbody>'+entries.map(x=>'<tr><td>'+esc(x[0])+'</td><td>'+money(x[1])+'</td></tr>').join('')+'</tbody></table>':'<div class="notice">No supplier cost data.</div>';
    }catch(e){$("#financeStats").innerHTML='<div class="notice">Finance unavailable: '+esc(e.message)+'</div>'}
  }
  async function returns(){
    try{
      const rows=await api("/api/admin/returns");
      $("#returnsList").innerHTML=rows.length?'<table class="tbl"><thead><tr><th>Return</th><th>Order</th><th>Reason</th><th>Status</th><th>Action</th></tr></thead><tbody>'+rows.map(x=>'<tr><td>'+esc(x.id)+'</td><td>'+esc(x.order_id)+'</td><td>'+esc(x.reason||'')+'</td><td>'+esc(x.status)+'</td><td><select class="ret-status" data-id="'+esc(x.id)+'">'+['REQUESTED','APPROVED','REJECTED','RECEIVED','REFUNDED','CLOSED'].map(s=>'<option '+(s===x.status?'selected':'')+'>'+s+'</option>').join('')+'</select></td></tr>').join('')+'</tbody></table>':'<div class="notice">No return requests.</div>';
      $$('.ret-status').forEach(s=>s.onchange=async e=>{try{await api('/api/admin/returns/'+encodeURIComponent(e.target.dataset.id),{method:'PATCH',body:{status:e.target.value}});await returns()}catch(err){alert(err.message)}});
    }catch(e){$("#returnsList").innerHTML='<div class="notice">Returns unavailable: '+esc(e.message)+'</div>'}
  }
  async function ads(){
    try{const d=await api("/api/admin/ads/summary?days=30");$("#adsStats").innerHTML=[["Spend",money(d.spend_inr)],["Clicks",d.clicks||0],["Conversions",d.conversions||0],["CPA",d.cpa_inr==null?"—":money(d.cpa_inr)]].map(x=>'<div class="stat"><div class="label">'+esc(x[0])+'</div><div class="value" style="font-size:1.15rem">'+esc(String(x[1]))+'</div></div>').join('')}catch(e){$("#adsStats").innerHTML='<div class="notice">Ad attribution unavailable: '+esc(e.message)+'</div>'}
  }
  $("#refreshFinance").onclick=load;$("#refreshReturns").onclick=returns;$("#refreshAds").onclick=ads;
  $("#importAds").onclick=async()=>{try{const d=await api("/api/admin/ads/import",{method:"POST"});alert("Imported "+d.saved+" ad-spend rows.");await ads();await load()}catch(e){alert(e.message)}};
  $("#addFin").onclick=async()=>{try{await api("/api/admin/finance/entries",{method:"POST",body:{category:$("#finCat").value,amount_inr:Number($("#finAmt").value||0),gst_rate:Number($("#finGst").value||0),entry_date:$("#finDate").value||undefined,notes:$("#finNotes").value}});alert("Expense saved.");await load()}catch(e){alert(e.message)}};
  load();returns();ads();
}
async function pricingView(){
  const options=products.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+'</option>').join('');
  $("#pricing").innerHTML='<div class="section-card"><div class="section-head"><div><h2>Pricing & Offers</h2><div class="muted">Margin-safe simulator. Changes require owner approval.</div></div></div><div class="form-grid"><div><label>Product</label><select id="priceProduct">'+options+'</select></div><div><label>Target margin floor (%)</label><input id="targetMargin" type="number" min="0" max="90" value="25"></div><div><label>Extra shipping / handling cost</label><input id="extraCost" type="number" min="0" value="0"></div><div><label>Discount to simulate (%)</label><input id="discountPct" type="number" min="0" max="100" value="0"></div></div><div class="actions" style="margin-top:12px"><button class="btn primary" id="calcPrice">Calculate</button><button class="btn soft" id="aiPrice">Ask AI for pricing draft</button></div><div id="priceOut" class="ai-output">Select a product and calculate.</div></div><div class="section-card"><div class="section-head"><h2>Offer Manager</h2><button class="btn soft" id="refreshOffers">Refresh</button></div><div class="form-grid"><div><label>Offer name</label><input id="offerName" placeholder="Festival sale"></div><div><label>Code</label><input id="offerCode" placeholder="FESTIVE10"></div><div><label>Discount %</label><input id="offerValue" type="number" min="0" max="100" value="10"></div><div><label>Minimum order ₹</label><input id="offerMin" type="number" min="0" value="0"></div></div><div class="actions" style="margin-top:10px"><button class="btn primary" id="createOffer">Create offer</button></div><div id="offerList" style="margin-top:14px">Loading offers…</div></div>';
  const calc=()=>{
    const p=products.find(x=>x.id===$("#priceProduct").value),out=$("#priceOut");if(!p){out.textContent='No product selected.';return}
    const cost=Number(p.supplier_cost_inr||0)+Math.max(0,Number($("#extraCost").value)||0),margin=Math.max(0,Math.min(90,Number($("#targetMargin").value)||0))/100,discount=Math.max(0,Math.min(99,Number($("#discountPct").value)||0))/100;
    const floor=margin<1?cost/(1-margin):cost,list=discount<1?floor/(1-discount):0,discounted=list*(1-discount),actual=discounted?((discounted-cost)/discounted)*100:0;
    out.textContent='Recorded supplier cost: '+money(cost)+'\\nMinimum price at margin floor: '+money(floor)+'\\nSuggested list price: '+money(list)+'\\nDiscounted selling price: '+money(discounted)+'\\nResulting gross margin: '+actual.toFixed(1)+'%\\n\\nGateway fees, taxes, returns and ad spend are excluded.';
  };
  $("#calcPrice").onclick=calc;
  $("#aiPrice").onclick=async()=>{const p=products.find(x=>x.id===$("#priceProduct").value),out=$("#priceOut");if(!p)return;out.textContent='AI is preparing a pricing draft…';try{const d=await api('/api/ai/chat',{method:'POST',body:{message:'Create a pricing and offer draft for this actual product. Respect the configured margin floor. Do not change the product.',task:'pricing',context:{product:p}}});out.textContent=d.reply||'No pricing draft returned.'}catch(e){out.textContent='AI pricing unavailable: '+e.message}};
  async function offers(){
    try{
      const rows=await api('/api/admin/offers');
      $("#offerList").innerHTML=rows.length?'<table class="tbl"><thead><tr><th>Offer</th><th>Discount</th><th>Status</th></tr></thead><tbody>'+rows.map(o=>'<tr><td><strong>'+esc(o.name)+'</strong><br><span class="muted">'+esc(o.code||'No code')+'</span></td><td>'+Number(o.discount_value).toFixed(0)+'%</td><td>'+ (o.active?'ACTIVE':'DRAFT')+'</td></tr>').join('')+'</tbody></table>':'<div class="notice">No offers created yet.</div>';
    }catch(e){$("#offerList").innerHTML='<div class="notice">Offer data unavailable: '+esc(e.message)+'</div>'}
  }
  $("#createOffer").onclick=async()=>{const b={name:$("#offerName").value.trim()||'Untitled offer',code:$("#offerCode").value.trim(),discount_type:'PERCENT',discount_value:Number($("#offerValue").value||0),min_order_inr:Number($("#offerMin").value||0),active:false};try{await api('/api/admin/offers',{method:'POST',body:b});await offers()}catch(e){alert(e.message)}};
  $("#refreshOffers").onclick=offers; offers();
}
async function controlsView(){
  const box=$("#controls");
  box.innerHTML='<div class="section-card"><div class="section-head"><div><h2>AI Control Center</h2><div class="muted">Kill switch, agent modes and safety limits. State-changing actions remain approval-gated.</div></div><span id="killState" class="badge">Loading…</span></div><div id="controlRows">Loading…</div></div>';
  async function load(){
    try{
      const rows=await api("/api/admin/agent-controls"),wrap=$("#controlRows");
      wrap.innerHTML=rows.map(r=>'<div class="control-row"><div><strong>'+esc(r.label)+'</strong><div class="muted">Margin floor '+Number(r.min_margin_pct).toFixed(0)+'% · Max discount '+Number(r.max_discount_pct).toFixed(0)+'% · Max refund '+money(r.max_refund_inr)+'</div></div><div class="control-fields"><label><input type="checkbox" class="c-enabled" data-id="'+esc(r.id)+'" '+(r.enabled?'checked':'')+'> Enabled</label><select class="c-mode" data-id="'+esc(r.id)+'"><option '+(r.mode==='AUTO'?'selected':'')+'>AUTO</option><option '+(r.mode==='LIMITED_AUTO'?'selected':'')+'>LIMITED_AUTO</option><option '+(r.mode==='APPROVAL_ONLY'?'selected':'')+'>APPROVAL_ONLY</option></select><input class="c-margin" data-id="'+esc(r.id)+'" type="number" min="0" max="100" value="'+Number(r.min_margin_pct)+'" aria-label="minimum margin"><input class="c-discount" data-id="'+esc(r.id)+'" type="number" min="0" max="100" value="'+Number(r.max_discount_pct)+'" aria-label="maximum discount"><input class="c-refund" data-id="'+esc(r.id)+'" type="number" min="0" value="'+Number(r.max_refund_inr)+'" aria-label="maximum refund"><button class="btn primary c-save" data-id="'+esc(r.id)+'">Save</button></div></div>').join('');
      const g=rows.find(x=>x.id==='global');$("#killState").textContent=g?.enabled?'Kill Switch OFF':'Kill Switch ON';$("#killState").className='badge '+(g?.enabled?'':'danger');
      $$('.c-save',wrap).forEach(btn=>btn.onclick=async()=>{
        const id=btn.dataset.id;
        try{
          await api('/api/admin/agent-controls',{method:'PUT',body:{id,enabled:$('[data-id="'+id+'"].c-enabled',wrap).checked,mode:$('[data-id="'+id+'"].c-mode',wrap).value,min_margin_pct:Number($('[data-id="'+id+'"].c-margin',wrap).value),max_discount_pct:Number($('[data-id="'+id+'"].c-discount',wrap).value),max_refund_inr:Number($('[data-id="'+id+'"].c-refund',wrap).value)}});
          await load();
        }catch(e){alert(e.message)}
      });
    }catch(e){$("#controlRows").innerHTML='<div class="notice">AI controls unavailable: '+esc(e.message)+'</div>'}
  }
  await load();
}
async function securityView(){
  const box=$("#security");
  box.innerHTML='<div class="section-card"><div class="section-head"><div><h2>Security & Audit</h2><div class="muted">Readiness plus recent admin activity.</div></div><button class="btn soft" id="refreshSecurity">Refresh</button></div><div id="securityReadiness" class="grid readiness-grid"><div class="notice">Loading…</div></div></div><div class="section-card"><h2>Recent audit events</h2><div id="auditList">Loading…</div></div>';
  async function load(){
    try{
      const r=await api("/api/admin/readiness");
      $("#securityReadiness").innerHTML=[
        ["Supabase",r.persistence?.configured],["AI",r.ai?.configured],["Gmail OTP",r.password_recovery?.configured],["Razorpay",r.payments?.configured],["Shiprocket",r.shipping?.configured],["Qikink",r.supplier_qikink?.configured]
      ].map(x=>'<div class="stat"><div class="label">'+esc(x[0])+'</div><div class="value" style="font-size:1rem">'+(x[1]?'READY':'SETUP NEEDED')+'</div></div>').join('');
      const logs=await api("/api/admin/audit-logs");
      $("#auditList").innerHTML=logs.length?'<div class="table-wrap"><table class="tbl"><thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Target</th></tr></thead><tbody>'+logs.map(x=>'<tr><td>'+esc(new Date(x.created_at).toLocaleString('en-IN'))+'</td><td>'+esc(x.actor)+'</td><td>'+esc(x.action)+'</td><td>'+esc((x.target_type||'')+(x.target_id?': '+x.target_id:''))+'</td></tr>').join('')+'</tbody></table></div>':'<div class="notice">No audit events recorded yet.</div>';
    }catch(e){$("#auditList").innerHTML='<div class="notice">Security data unavailable: '+esc(e.message)+'</div>'}
  }
  $("#refreshSecurity").onclick=load; await load();
}

function researchView(){$('#research').innerHTML='<div class="ai-box"><h2>🔎 AI Product Researcher</h2><p>Run research through the configured AI/live data providers. The system will never fabricate trend data.</p><textarea id="researchCmd" class="command" placeholder="Example: Research 5 home products for Diwali under ₹1500."></textarea><button id="runResearch" class="btn primary">Research</button><div id="researchOut" class="ai-output">No research run yet.</div></div>';$('#runResearch').onclick=async()=>{const o=$('#researchOut');o.textContent='Researching…';try{const d=await api('/api/ai/chat',{method:'POST',body:{message:$('#researchCmd').value,task:'product_research',context:{products}}});o.textContent=d.reply||'No result'}catch(e){o.textContent='AI/research provider not configured: '+e.message}}}
function marketingView(){const seasons=['Diwali','Holi','Eid','Christmas','New Year','Summer','Monsoon','Winter'];$('#marketing').innerHTML='<div class="section-card"><div class="section-head"><div><h2>AI Marketing Manager</h2><div class="muted">Prepare campaigns using season, festivals, trends and actual products.</div></div></div><div class="toolbar"><select id="season">'+seasons.map(x=>'<option>'+x+'</option>').join('')+'</select><button class="btn primary" id="mk">Prepare campaign</button></div><div id="mkout" class="ai-output">Select an occasion and generate a draft.</div></div>';$('#mk').onclick=async()=>{const o=$('#mkout');o.textContent='Preparing…';try{const d=await api('/api/ai/chat',{method:'POST',body:{message:'Prepare a marketing campaign draft for '+$('#season').value+' using actual BBest Globly products and clearly label assumptions.',task:'marketing',context:{products,orders}}});o.textContent=d.reply||'No result'}catch(e){o.textContent='AI not configured: '+e.message}}}
function seoView(){const opts=products.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+'</option>').join('');$('#seo').innerHTML='<div class="ai-box"><h2>🧠 AI SEO Manager</h2><p>Generate SEO drafts from real product data.</p><select id="seoP" class="command" style="color:#111">'+opts+'</select><button id="seoBtn" class="btn primary">Generate SEO</button><div id="seoOut" class="ai-output">Ready.</div></div>';$('#seoBtn').onclick=async()=>{const p=products.find(x=>x.id===$('#seoP').value),o=$('#seoOut');o.textContent='Generating…';try{const d=await api('/api/ai/chat',{method:'POST',body:{message:'Create SEO title, meta description, slug, keywords and FAQ for this product. Product: '+JSON.stringify(p),task:'seo',context:{product:p}}});o.textContent=d.reply||'No result'}catch(e){o.textContent='AI not configured: '+e.message}}}
async function supportView(){
  $("#support").innerHTML='<div class="section-card"><div class="section-head"><div><h2>Customer Support Inbox</h2><div class="muted">AI can answer common questions; complex cases can be handed to a human through tickets.</div></div><button class="btn soft" id="refreshTickets">Refresh</button></div><div id="ticketList">Loading…</div></div>';
  async function load(){
    const box=$("#ticketList");
    try{
      const rows=await api("/api/admin/support/tickets");
      box.innerHTML=rows.length?rows.map(r=>'<div class="agent-action"><div class="section-head"><strong>'+esc(r.subject)+'</strong><span class="badge">'+esc(r.priority)+' · '+esc(r.status)+'</span></div><div class="muted">'+esc(r.customer_name||'Guest')+' · '+esc(r.customer_email||'no email')+(r.order_id?' · Order '+esc(r.order_id):'')+'</div><div style="margin-top:8px">'+(Array.isArray(r.messages)?r.messages.map(m=>'<div><strong>'+esc(m.role)+'</strong>: '+esc(m.content)+'</div>').join(''):'')+'</div><div class="actions" style="margin-top:10px"><select class="ticket-status" data-id="'+esc(r.id)+'">'+['OPEN','IN_PROGRESS','WAITING','RESOLVED','CLOSED'].map(x=>'<option '+(x===r.status?'selected':'')+'>'+x+'</option>').join('')+'</select><select class="ticket-priority" data-id="'+esc(r.id)+'">'+['LOW','NORMAL','HIGH','URGENT'].map(x=>'<option '+(x===r.priority?'selected':'')+'>'+x+'</option>').join('')+'</select></div></div>').join(''):'<div class="notice">No support tickets yet.</div>';
      $$('.ticket-status',box).forEach(s=>s.onchange=save);
      $$('.ticket-priority',box).forEach(s=>s.onchange=save);
    }catch(e){box.innerHTML='<div class="notice">Support inbox unavailable: '+esc(e.message)+'</div>'}
  }
  async function save(e){
    const el=e.currentTarget,id=el.dataset.id;
    const status=$('[data-id="'+id+'"].ticket-status',box)?.value;
    const priority=$('[data-id="'+id+'"].ticket-priority',box)?.value;
    try{await api('/api/admin/support/tickets/'+encodeURIComponent(id),{method:'PATCH',body:{status,priority}});await load()}catch(err){alert(err.message)}
  }
  $("#refreshTickets").onclick=load; await load();
}

async function approvalView(){
  $('#approvals').innerHTML='<div class="section-card ai-center-card"><div class="section-head"><div><h2>🤖 BBest Globly AI Manager</h2><div class="muted">Business AI, Agent actions and owner approvals are kept together here.</div></div><div class="actions"><button class="btn soft" id="clearAIChat">New Chat</button><button class="btn soft" id="dailyReport">Daily summary</button></div></div><div id="aiHistory" class="ai-history ai-center-history"></div><div id="aiOutput" class="ai-output">Ask about products, orders, SEO, marketing or operations.</div><textarea id="aiCommand" class="command" placeholder="Ask your AI Manager…"></textarea><div class="ai-center-actions"><button class="btn primary" id="askAI">Ask AI</button><button class="btn soft" id="runAgent">Run Agent</button></div></div><div class="section-card"><div class="section-head"><div><h2>Approval Center</h2><div class="muted">Persistent owner approvals stored in Supabase.</div></div><button class="btn soft" id="refreshApprovals">Refresh</button></div><div id="approvalList" class="approval-list">Loading…</div></div>';
  renderAIHistory();

  $('#clearAIChat').onclick=()=>{
    aiHistory=[];
    sessionStorage.removeItem('bg_ai_history');
    renderAIHistory();
    $('#aiOutput').textContent='New chat started. Ask your AI Manager…';
    $('#aiCommand').focus();
  };
  $('#askAI').onclick=()=>askAI($('#aiCommand').value);
  $('#runAgent').onclick=()=>runAgent($('#aiCommand').value);
  $('#dailyReport').onclick=()=>askAI('Give a daily business report using actual BBest Globly data. Do not invent numbers.');
  $('#aiCommand').addEventListener('keydown',e=>{
    if((e.ctrlKey||e.metaKey)&&e.key==='Enter') askAI(e.currentTarget.value);
  });

  async function load(){
    const box=$('#approvalList');
    try{
      const rows=await api('/api/admin/approvals');
      if(!rows.length){box.innerHTML='<div class="notice">No approval requests yet.</div>';return;}
      box.innerHTML=rows.map(r=>{
        const pending=r.status==='PENDING';
        return '<div class="agent-action"><div class="section-head"><strong>'+esc(r.action_type)+'</strong><span class="badge">'+esc(r.status)+'</span></div><div class="muted">'+esc(r.reason||'Owner approval required')+'</div><pre>'+esc(JSON.stringify(r.payload||{},null,2))+'</pre><div class="actions">'+(pending?'<button class="btn primary approve-row" data-id="'+esc(r.id)+'">Approve & Execute</button><button class="btn danger reject-row" data-id="'+esc(r.id)+'">Reject</button>':'')+'</div></div>';
      }).join('');
      $$('.approve-row',box).forEach(btn=>btn.onclick=async()=>{
        btn.disabled=true;btn.textContent='Executing…';
        try{
          await api('/api/admin/agent/execute',{method:'POST',body:{approval_id:btn.dataset.id}});
          await load();await refresh();
        }catch(e){btn.disabled=false;btn.textContent='Approve & Execute';alert(e.message)}
      });
      $$('.reject-row',box).forEach(btn=>btn.onclick=async()=>{
        btn.disabled=true;btn.textContent='Rejecting…';
        try{await api('/api/admin/approvals/'+encodeURIComponent(btn.dataset.id)+'/reject',{method:'POST'});await load()}catch(e){btn.disabled=false;btn.textContent='Reject';alert(e.message)}
      });
    }catch(e){box.innerHTML='<div class="notice">Approval Center error: '+esc(e.message)+'</div>'}
  }
  $('#refreshApprovals').onclick=load;
  await load();
}

function initAISidePanel(){ /* AI Manager is rendered inside Approval Center. */ }
$$('.nav-btn').forEach(b=>b.onclick=()=>setView(b.dataset.view));
$('#forgotBtn').onclick=()=>{
  $('#resetPanel').classList.toggle('hidden');
  $('#resetEmail').focus();
  $('#loginErr').textContent='';
};
$('#sendOtpBtn').onclick=async()=>{
  const email=$('#resetEmail').value.trim(), msg=$('#resetMsg');
  if(!email){msg.textContent='Enter your recovery Gmail.';return}
  const b=$('#sendOtpBtn'); b.disabled=true; b.textContent='Sending…'; msg.textContent='';
  try{
    const r=await fetch('/api/admin/forgot-password/request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email})});
    const d=await r.json(); if(!r.ok) throw Error(d.error||'Unable to request OTP');
    msg.style.color='var(--ok)'; msg.textContent=d.message||'Check your Gmail for the OTP.';
    $('#resetOtp').focus();
  }catch(e){msg.style.color='var(--danger)';msg.textContent=e.message}
  finally{b.disabled=false;b.textContent='Send OTP'}
};
$('#resetPasswordBtn').onclick=async()=>{
  const email=$('#resetEmail').value.trim(), otp=$('#resetOtp').value.trim(), pw=$('#resetNewPw').value;
  const msg=$('#resetMsg');
  if(!email||!otp||!pw){msg.style.color='var(--danger)';msg.textContent='Fill email, OTP and new password.';return}
  const b=$('#resetPasswordBtn'); b.disabled=true; b.textContent='Resetting…'; msg.textContent='';
  try{
    const r=await fetch('/api/admin/forgot-password/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,otp,new_password:pw})});
    const d=await r.json(); if(!r.ok) throw Error(d.error||'Password reset failed');
    msg.style.color='var(--ok)'; msg.textContent=d.message||'Password reset. You can now login.';
  }catch(e){msg.style.color='var(--danger)';msg.textContent=e.message}
  finally{b.disabled=false;b.textContent='Reset password'}
};
$('#recoveryKeyBtn').onclick=async()=>{
  const key=prompt('Enter your ADMIN_RESET_KEY from Render Environment Variables:');
  if(key===null)return;
  const pw=prompt('Set a new admin password (minimum 10 characters):');
  if(pw===null)return;
  try{
    const r=await fetch('/api/admin/forgot-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({recovery_key:key,new_password:pw})});
    const d=await r.json();
    if(!r.ok) throw Error(d.error||'Password reset failed');
    $('#loginErr').textContent=d.message||'Password reset successfully. Please log in.';
    $('#loginErr').style.color='var(--ok)';
  }catch(e){
    $('#loginErr').textContent=e.message;
    $('#loginErr').style.color='var(--danger)';
  }
};
$('#loginBtn').onclick=async()=>{try{const username=$('#loginUser').value.trim(),r=await fetch('/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password:$('#loginPass').value})}),d=await r.json();if(!r.ok)throw Error(d.error);if(d.requires_2fa){$('#login2faPanel').classList.remove('hidden');$('#login2faMsg').style.color='var(--ok)';$('#login2faMsg').textContent='OTP sent. Check the admin recovery email.';$('#loginOtp').focus();return}token=d.token;localStorage.setItem('bg_admin',token);$('#loginPanel').classList.add('hidden');$('#appPanel').classList.remove('hidden');await refresh();render();checkAI()}catch(e){$('#loginErr').textContent=e.message}};
$('#verifyLoginOtpBtn').onclick=async()=>{const msg=$('#login2faMsg');try{const username=$('#loginUser').value.trim(),r=await fetch('/api/admin/login/verify-otp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,otp:$('#loginOtp').value.trim()})}),d=await r.json();if(!r.ok)throw Error(d.error);token=d.token;localStorage.setItem('bg_admin',token);$('#loginPanel').classList.add('hidden');$('#appPanel').classList.remove('hidden');await refresh();render();checkAI()}catch(e){msg.style.color='var(--danger)';msg.textContent=e.message}};
$('#logoutBtn').onclick=()=>{token='';localStorage.removeItem('bg_admin');location.reload()};
async function checkAI(){try{const d=await api('/api/admin/ai/status');$('#integrationStatus').textContent=d.configured?'AI connected':'AI needs setup'}catch{$('#integrationStatus').textContent='AI unavailable'}}

function initGlobalSearch(){
  const btn=$("#globalSearchBtn"); if(!btn)return;
  const open=()=>{
    let modal=$("#globalSearchModal");
    if(!modal){
      modal=document.createElement("div");modal.id="globalSearchModal";modal.className="modal";
      modal.innerHTML='<div class="modal-card search-card"><button class="close" id="closeSearch">✕</button><h2>Search business data</h2><input id="globalSearchInput" class="command" placeholder="Search products, customers, orders…"><div id="globalSearchResults" class="search-results"></div></div>';
      document.body.appendChild(modal);
      $("#closeSearch").onclick=()=>modal.remove();
      $("#globalSearchInput").oninput=e=>{
        const q=e.target.value.trim().toLowerCase(),results=[];
        if(!q){$("#globalSearchResults").innerHTML='<div class="notice">Type to search.</div>';return}
        for(const p of products)if((p.name+" "+p.category+" "+p.sku).toLowerCase().includes(q))results.push('<button class="search-result" data-go-view="products"><strong>Product</strong> · '+esc(p.name)+'<span>'+money(p.price_inr)+'</span></button>');
        for(const o of orders)if((o.id+" "+(o.customer?.name||"")+" "+(o.customer?.email||"")).toLowerCase().includes(q))results.push('<button class="search-result" data-go-view="orders"><strong>Order</strong> · '+esc(o.id)+'<span>'+money(o.totals?.total_inr)+'</span></button>');
        for(const u of customers)if((u.name+" "+u.email+" "+u.phone).toLowerCase().includes(q))results.push('<button class="search-result" data-go-view="customers"><strong>Customer</strong> · '+esc(u.name)+'<span>'+money(u.spent_inr)+'</span></button>');
        $("#globalSearchResults").innerHTML=results.length?results.slice(0,20).join(''):'<div class="notice">No match found.</div>';
        $$('.search-result').forEach(x=>x.onclick=()=>{setView(x.dataset.goView);modal.remove()});
      };
      modal.onclick=e=>{if(e.target===modal)modal.remove()};
    }
    modal.classList.remove("hidden");$("#globalSearchInput").value="";$("#globalSearchResults").innerHTML='<div class="notice">Type to search.</div>';$("#globalSearchInput").focus();
  };
  btn.onclick=open;
  document.addEventListener("keydown",e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();open()}if(e.key==='Escape'&&$("#globalSearchModal"))$("#globalSearchModal").remove()});
}
initGlobalSearch();
initAISidePanel();
(async()=>{if(token){$('#appPanel').classList.remove('hidden');try{await refresh();render();checkAI()}catch{token='';localStorage.removeItem('bg_admin');$('#loginPanel').classList.remove('hidden')}}else $('#loginPanel').classList.remove('hidden')})();
// Robust dynamic button handler for supplier AI actions.
document.addEventListener('click', async (event)=>{
  const target=event.target.closest('#qikinkScout');
  if(!target) return;
  event.preventDefault();
  const out=$('#qikinkScoutOut'), input=$('#qikinkScoutCmd');
  if(!out || !input) return;
  const cmd=input.value.trim();
  if(!cmd){out.textContent='Enter the product goal for the AI scout.'; input.focus(); return;}
  target.disabled=true; target.textContent='Researching…'; out.textContent='AI is researching Qikink…';
  try{
    const d=await api('/api/admin/suppliers/qikink/ai-scout',{method:'POST',body:{command:cmd}});
    const names=(d.actions||[]).map(a=>a.payload?.name||'product').join(', ');
    out.textContent=(d.reply||'AI scout finished.')+'\\n\\n'+(d.actions?.length?('Approval requests created: '+d.actions.length+'. '+names):'No approval-ready products were created.');
  }catch(e){ out.textContent='AI scout error: '+e.message; }
  finally{ target.disabled=false; target.textContent='Run AI Scout'; }
});
