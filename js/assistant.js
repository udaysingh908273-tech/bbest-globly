(()=>{const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const KEY='bg_support_chat';let history=[];try{history=JSON.parse(localStorage.getItem(KEY)||'[]')}catch{history=[]}
const token=localStorage.getItem('bg_token')||'';
const fab=document.createElement('button');fab.id='bg-ai-fab';fab.innerHTML='<span class="ai-fab-spark">✦</span><span class="ai-fab-pulse"></span>';fab.title='BBest Globly AI Support';fab.setAttribute('aria-label','Open BBest Globly AI Support');
const chat=document.createElement('div');chat.id='bg-ai-chat';chat.innerHTML='<div class="bg-ai-head"><div class="bg-ai-brand"><div class="bg-ai-avatar">✦</div><div><strong>BBest Globly AI</strong><span>24×7 product & order support</span></div></div><div class="bg-ai-head-actions"><button type="button" id="bgAiMin" aria-label="Minimize chat">−</button><button type="button" id="bgAiHuman">Human</button><button type="button" id="bgAiClear">Clear</button></div></div><div class="bg-ai-quick" id="bgAiQuick"><button data-q="Where is my order?">Track order</button><button data-q="Help me choose a product">Product help</button><button data-q="What payment methods do you accept?">Payments</button><button data-q="What is your return policy?">Returns</button></div><div class="bg-ai-body"><div class="bg-ai-msgs" id="bgAiMsgs"></div><div class="bg-ai-typing" id="bgAiTyping"><i></i><i></i><i></i><span>AI is checking your store data…</span></div><form class="bg-ai-form" id="bgAiForm"><input id="bgAiInput" placeholder="Ask anything about products, orders or support…" autocomplete="off" maxlength="1000"><button aria-label="Send message">→</button></form><div class="bg-ai-foot">Answers use current BBest Globly store data. Sensitive actions are handled by support.</div></div>';
document.body.append(fab,chat);
const msgs=chat.querySelector('#bgAiMsgs'),typing=chat.querySelector('#bgAiTyping'),input=chat.querySelector('#bgAiInput'),send=chat.querySelector('#bgAiForm button');
function save(){history=history.slice(-50);localStorage.setItem(KEY,JSON.stringify(history))}
function draw(){msgs.innerHTML='';if(!history.length)msgs.innerHTML='<div class="bg-ai-msg ai"><strong>Hi 👋</strong><span>I can help with products, pricing, payment methods, order tracking, delivery status, returns, account questions and general support. Ask me anything about BBest Globly.</span></div>';history.forEach(m=>msgs.insertAdjacentHTML('beforeend','<div class="bg-ai-msg '+(m.role==='user'?'user':'ai')+'">'+esc(m.content).replace(/\n/g,'<br>')+'</div>'));msgs.scrollTop=msgs.scrollHeight}
function setBusy(b){typing.classList.toggle('show',b);input.disabled=b;send.disabled=b}
function ask(text){input.value=text;chat.querySelector('#bgAiForm').requestSubmit()}
draw();
fab.onclick=()=>chat.classList.toggle('open');
chat.querySelector('#bgAiMin').onclick=()=>chat.classList.remove('open');
chat.querySelector('#bgAiClear').onclick=()=>{history=[];save();draw()};
chat.querySelectorAll('#bgAiQuick button').forEach(b=>b.onclick=()=>ask(b.dataset.q));
chat.querySelector('#bgAiHuman').onclick=async()=>{
  const subject=(history.filter(x=>x.role==='user').slice(-1)[0]?.content||'Customer support request').slice(0,120);
  const latest=history.slice(-10).map(x=>String(x.role||'')+': '+String(x.content||'')).join('\n').slice(0,4000);
  const body={subject,message:latest||'Please help me with my order or product question.'};
  try{
    const headers={'Content-Type':'application/json'};if(token)headers.Authorization='Bearer '+token;
    const r=await fetch('/api/support/tickets',{method:'POST',headers,body:JSON.stringify(body)}),d=await r.json();if(!r.ok)throw Error(d.error||'Unable to create support ticket');
    history.push({role:'assistant',content:'I created a human-support ticket for you. Ticket ID: '+d.id+'. The Support team can continue from the inbox.'});save();draw();
  }catch(e){history.push({role:'assistant',content:'I could not create the support ticket right now: '+e.message});save();draw()}
};
chat.querySelector('#bgAiForm').onsubmit=async e=>{
  e.preventDefault();const msg=input.value.trim();if(!msg||input.disabled)return;
  history.push({role:'user',content:msg});save();draw();input.value='';setBusy(true);
  try{
    const headers={'Content-Type':'application/json'};if(token)headers.Authorization='Bearer '+token;
    const r=await fetch('/api/ai/chat',{method:'POST',headers,body:JSON.stringify({message:msg,channel:'website',task:'customer_support',context:{conversation:history.slice(-16)}})}),d=await r.json();
    history.push({role:'assistant',content:d.reply||d.error||'I could not answer that right now.'});
  }catch{history.push({role:'assistant',content:'Support is temporarily unavailable. Please try again or use Human support.'})}
  finally{save();draw();setBusy(false);input.focus()}
};
})();