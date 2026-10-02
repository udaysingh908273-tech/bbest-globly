(()=>{const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const KEY='bg_support_chat';let history=[];try{history=JSON.parse(localStorage.getItem(KEY)||'[]')}catch{history=[]}
const fab=document.createElement('button');fab.id='bg-ai-fab';fab.textContent='✦';fab.title='BBest Globly AI Support';
const chat=document.createElement('div');chat.id='bg-ai-chat';chat.innerHTML='<div class="bg-ai-head"><div><strong>BBest Globly AI Support</strong><span>Products, orders & support</span></div><div><button type="button" id="bgAiHuman">Human</button><button type="button" id="bgAiClear">Clear</button></div></div><div class="bg-ai-body"><div class="bg-ai-msgs" id="bgAiMsgs"></div><form class="bg-ai-form" id="bgAiForm"><input id="bgAiInput" placeholder="Ask about a product, order or delivery…" autocomplete="off"><button>Send</button></form></div>';
document.body.append(fab,chat);
const msgs=chat.querySelector('#bgAiMsgs');
function save(){history=history.slice(-40);localStorage.setItem(KEY,JSON.stringify(history))}
function draw(){msgs.innerHTML='';if(!history.length)msgs.innerHTML='<div class="bg-ai-msg ai">Hi! I can help with products, orders, shipping and support.</div>';history.forEach(m=>msgs.insertAdjacentHTML('beforeend','<div class="bg-ai-msg '+(m.role==='user'?'user':'ai')+'">'+esc(m.content)+'</div>'));msgs.scrollTop=msgs.scrollHeight}
draw();
fab.onclick=()=>chat.classList.toggle('open');
chat.querySelector('#bgAiHuman').onclick=async()=>{
  const subject=(history.filter(x=>x.role==='user').slice(-1)[0]?.content||'Customer support request').slice(0,120);
  const latest=history.slice(-8).map(x=>String(x.role||'')+': '+String(x.content||'')).join('\n').slice(0,3000);
  const customerName=document.querySelector('#em')?.value||'Guest';
  try{
    const r=await fetch('/api/support/tickets',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({subject,message:latest||'Please help me with my order or product question.',customer_email:customerName.includes('@')?customerName:''})});
    const d=await r.json(); if(!r.ok)throw Error(d.error||'Unable to create support ticket');
    history.push({role:'assistant',content:'I created a support ticket for you. Ticket ID: '+d.id+'. A human can continue from the Support inbox.'});save();draw();
  }catch(e){history.push({role:'assistant',content:'I could not create a human-support ticket right now: '+e.message});save();draw()}
};
chat.querySelector('#bgAiClear').onclick=()=>{history=[];save();draw()};
chat.querySelector('#bgAiForm').onsubmit=async e=>{e.preventDefault();const input=chat.querySelector('#bgAiInput'),msg=input.value.trim();if(!msg)return;history.push({role:'user',content:msg});save();draw();input.value='';input.disabled=true;const send=chat.querySelector('form button');send.disabled=true;try{const r=await fetch('/api/ai/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:msg,channel:'website',context:{conversation:history.slice(-12)}})}),d=await r.json();history.push({role:'assistant',content:d.reply||d.error||'I could not answer that right now.'})}catch{history.push({role:'assistant',content:'Support is temporarily unavailable. Please try again.'})}finally{save();draw();input.disabled=false;send.disabled=false;input.focus()}};
})();