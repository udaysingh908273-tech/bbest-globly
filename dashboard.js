const $=(s,e=document)=>e.querySelector(s), $$=(s,e=document)=>[...e.querySelectorAll(s)];
let token=localStorage.getItem('bg_admin')||'',products=[],orders=[],currentView='overview',aiHistory=[];
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
async function refresh(){products=await api('/api/admin/products');orders=await api('/api/admin/orders')}
function setView(v){currentView=v;$$('.view').forEach(x=>x.classList.toggle('hidden',x.id!==v));$$('.nav-btn').forEach(x=>x.classList.toggle('active',x.dataset.view===v));const t={overview:'Business Overview',products:'Product Management',orders:'Orders',suppliers:'Supplier / Dropshipping',research:'AI Product Research',marketing:'AI Marketing',seo:'AI SEO Manager',support:'Customer Support',approvals:'Approval Center'};$('#pageTitle').textContent=t[v]||'Business Overview';render()}
function render(){if(!token)return;if(currentView==='overview')overview();if(currentView==='products')productView();if(currentView==='orders')orderView();if(currentView==='suppliers')supplierView();if(currentView==='research')researchView();if(currentView==='marketing')marketingView();if(currentView==='seo')seoView();if(currentView==='support')supportView();if(currentView==='approvals')approvalView()}
function overview(){const revenue=orders.filter(o=>o.status!=='CANCELLED').reduce((s,o)=>s+Number(o.totals?.total_inr||0),0),pending=orders.filter(o=>o.status==='PENDING').length;$('#overview').innerHTML='<div class="grid stats"><div class="stat"><div class="label">Orders</div><div class="value">'+orders.length+'</div></div><div class="stat"><div class="label">Revenue</div><div class="value">'+money(revenue)+'</div></div><div class="stat"><div class="label">Pending</div><div class="value">'+pending+'</div></div><div class="stat"><div class="label">Products</div><div class="value">'+products.length+'</div></div></div><div class="section-card"><div class="section-head"><h2>Store Overview</h2><span class="badge">AI Manager on the right →</span></div><p class="muted">Your main dashboard stays clean. Open the AI Manager from the right side whenever you need it.</p></div><div class="section-card"><div class="section-head"><h2>Quick actions</h2></div><div class="actions"><button class="btn soft" data-go="products">Add product</button><button class="btn soft" data-go="research">Research products</button><button class="btn soft" data-go="marketing">Create campaign</button><button class="btn soft" data-go="seo">SEO audit</button></div></div>';$('[data-go="products"]').onclick=()=>setView('products');$('[data-go="research"]').onclick=()=>setView('research');$('[data-go="marketing"]').onclick=()=>setView('marketing');$('[data-go="seo"]').onclick=()=>setView('seo')}function renderAgentActions(actions){
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
function researchView(){$('#research').innerHTML='<div class="ai-box"><h2>🔎 AI Product Researcher</h2><p>Run research through the configured AI/live data providers. The system will never fabricate trend data.</p><textarea id="researchCmd" class="command" placeholder="Example: Research 5 home products for Diwali under ₹1500."></textarea><button id="runResearch" class="btn primary">Research</button><div id="researchOut" class="ai-output">No research run yet.</div></div>';$('#runResearch').onclick=async()=>{const o=$('#researchOut');o.textContent='Researching…';try{const d=await api('/api/ai/chat',{method:'POST',body:{message:$('#researchCmd').value,task:'product_research',context:{products}}});o.textContent=d.reply||'No result'}catch(e){o.textContent='AI/research provider not configured: '+e.message}}}
function marketingView(){const seasons=['Diwali','Holi','Eid','Christmas','New Year','Summer','Monsoon','Winter'];$('#marketing').innerHTML='<div class="section-card"><div class="section-head"><div><h2>AI Marketing Manager</h2><div class="muted">Prepare campaigns using season, festivals, trends and actual products.</div></div></div><div class="toolbar"><select id="season">'+seasons.map(x=>'<option>'+x+'</option>').join('')+'</select><button class="btn primary" id="mk">Prepare campaign</button></div><div id="mkout" class="ai-output">Select an occasion and generate a draft.</div></div>';$('#mk').onclick=async()=>{const o=$('#mkout');o.textContent='Preparing…';try{const d=await api('/api/ai/chat',{method:'POST',body:{message:'Prepare a marketing campaign draft for '+$('#season').value+' using actual BBest Globly products and clearly label assumptions.',task:'marketing',context:{products,orders}}});o.textContent=d.reply||'No result'}catch(e){o.textContent='AI not configured: '+e.message}}}
function seoView(){const opts=products.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+'</option>').join('');$('#seo').innerHTML='<div class="ai-box"><h2>🧠 AI SEO Manager</h2><p>Generate SEO drafts from real product data.</p><select id="seoP" class="command" style="color:#111">'+opts+'</select><button id="seoBtn" class="btn primary">Generate SEO</button><div id="seoOut" class="ai-output">Ready.</div></div>';$('#seoBtn').onclick=async()=>{const p=products.find(x=>x.id===$('#seoP').value),o=$('#seoOut');o.textContent='Generating…';try{const d=await api('/api/ai/chat',{method:'POST',body:{message:'Create SEO title, meta description, slug, keywords and FAQ for this product. Product: '+JSON.stringify(p),task:'seo',context:{product:p}}});o.textContent=d.reply||'No result'}catch(e){o.textContent='AI not configured: '+e.message}}}
function supportView(){$('#support').innerHTML='<div class="section-card"><h2>Customer Support</h2><p class="muted">Central support is ready for website/app/WhatsApp integration once official messaging credentials are configured.</p><div class="notice">WhatsApp Business API and live human inbox require official provider credentials.</div></div>'}
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
$('#loginBtn').onclick=async()=>{try{const r=await fetch('/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:$('#loginUser').value,password:$('#loginPass').value})});const d=await r.json();if(!r.ok)throw Error(d.error);token=d.token;localStorage.setItem('bg_admin',token);$('#loginPanel').classList.add('hidden');$('#appPanel').classList.remove('hidden');await refresh();render();checkAI()}catch(e){$('#loginErr').textContent=e.message}};
$('#logoutBtn').onclick=()=>{token='';localStorage.removeItem('bg_admin');location.reload()};
async function checkAI(){try{const d=await api('/api/admin/ai/status');$('#integrationStatus').textContent=d.configured?'AI connected':'AI needs setup'}catch{$('#integrationStatus').textContent='AI unavailable'}}
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
