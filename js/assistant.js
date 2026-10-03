(()=>{
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const CHAT_KEY='bg_ai_conversation_id',SESSION_KEY='bg_analytics_session';
let sessionId=localStorage.getItem(SESSION_KEY)||((crypto.randomUUID?crypto.randomUUID():('s-'+Date.now()+'-'+Math.random().toString(36).slice(2))));
localStorage.setItem(SESSION_KEY,sessionId);
let conversationId=localStorage.getItem(CHAT_KEY)||'';
let history=[];

function authHeaders(){
  const h={'Content-Type':'application/json','X-AI-Session-Id':sessionId};
  const token=localStorage.getItem('bg_token')||'';if(token)h.Authorization='Bearer '+token;
  return h;
}
const fab=document.createElement('button');
fab.id='bg-ai-fab';
fab.innerHTML='<span class="ai-fab-spark">✦</span><span class="ai-fab-pulse"></span>';
fab.title='BBest Globly AI Support';
fab.setAttribute('aria-label','Open BBest Globly AI Support');

const chat=document.createElement('div');
chat.id='bg-ai-chat';
chat.innerHTML='<div class="bg-ai-head"><div class="bg-ai-brand"><div class="bg-ai-avatar">✦</div><div><strong>BBest Globly AI</strong><span>24×7 product & order support</span></div></div><div class="bg-ai-head-actions"><button type="button" id="bgAiMin" aria-label="Minimize chat">−</button><button type="button" id="bgAiHuman">Human</button><button type="button" id="bgAiClear">Delete chat</button></div></div><div class="bg-ai-quick" id="bgAiQuick"><button data-q="Where is my order?">Track order</button><button data-q="Help me choose a product">Product help</button><button data-q="What payment methods do you accept?">Payments</button><button data-q="What is your return policy?">Returns</button></div><div class="bg-ai-body"><div class="bg-ai-msgs" id="bgAiMsgs"></div><div class="bg-ai-typing" id="bgAiTyping"><i></i><i></i><i></i><span>AI is checking your store data…</span></div><form class="bg-ai-form" id="bgAiForm"><input id="bgAiInput" placeholder="Ask anything about products, orders or support…" autocomplete="off" maxlength="1000"><button aria-label="Send message">→</button></form><div class="bg-ai-foot">Chat history is saved to your BBest Globly account/session. Sensitive actions are handled by support.</div></div>';
document.body.append(fab,chat);

const msgs=chat.querySelector('#bgAiMsgs'),typing=chat.querySelector('#bgAiTyping'),input=chat.querySelector('#bgAiInput'),send=chat.querySelector('#bgAiForm button');

function saveLocal(){
  try{localStorage.setItem('bg_ai_last_preview',JSON.stringify(history.slice(-20)))}catch{}
}
function draw(){
  msgs.innerHTML='';
  if(!history.length)msgs.innerHTML='<div class="bg-ai-msg ai"><strong>Hi 👋</strong><span>I can help with products, order tracking, payments, returns, account questions and general support. Your chat can continue across multiple messages.</span></div>';
  history.forEach(m=>msgs.insertAdjacentHTML('beforeend','<div class="bg-ai-msg '+(m.role==='user'?'user':'ai')+'">'+esc(m.content).replace(/\n/g,'<br>')+'</div>'));
  msgs.scrollTop=msgs.scrollHeight;
}
function setBusy(b){typing.classList.toggle('show',b);input.disabled=b;send.disabled=b}

async function loadConversation(){
  try{
    if(!conversationId){
      const list=await fetch('/api/ai/conversations',{headers:authHeaders()});
      if(list.ok){const d=await list.json();if(Array.isArray(d)&&d[0])conversationId=d[0].id}
    }
    if(!conversationId){draw();return}
    const r=await fetch('/api/ai/conversations/'+encodeURIComponent(conversationId)+'/messages',{headers:authHeaders()});
    if(!r.ok){conversationId='';localStorage.removeItem(CHAT_KEY);draw();return}
    const d=await r.json();
    history=(d.messages||[]).filter(x=>x.role==='user'||x.role==='assistant').map(x=>({role:x.role,content:x.content}));
    localStorage.setItem(CHAT_KEY,conversationId);
    saveLocal();draw();
  }catch{
    try{history=JSON.parse(localStorage.getItem('bg_ai_last_preview')||'[]')}catch{history=[]}
    draw();
  }
}
async function deleteConversation(){
  try{
    if(conversationId)await fetch('/api/ai/conversations/'+encodeURIComponent(conversationId),{method:'DELETE',headers:authHeaders()});
  }catch{}
  conversationId='';history=[];localStorage.removeItem(CHAT_KEY);saveLocal();draw();
}
async function ask(textValue){
  input.value=textValue;
  chat.querySelector('#bgAiForm').requestSubmit();
}

draw();
loadConversation();
fab.onclick=()=>chat.classList.toggle('open');
chat.querySelector('#bgAiMin').onclick=()=>chat.classList.remove('open');
chat.querySelector('#bgAiClear').onclick=()=>deleteConversation();
chat.querySelectorAll('#bgAiQuick button').forEach(b=>b.onclick=()=>ask(b.dataset.q));

chat.querySelector('#bgAiHuman').onclick=async()=>{
  const latest=history.slice(-12).map(x=>String(x.role||'')+': '+String(x.content||'')).join('\n').slice(0,5000);
  const body={subject:(history.filter(x=>x.role==='user').slice(-1)[0]?.content||'Customer support request').slice(0,120),message:latest||'Please help me with my order or product question.'};
  try{
    const r=await fetch('/api/support/tickets',{method:'POST',headers:authHeaders(),body:JSON.stringify(body)}),d=await r.json();
    if(!r.ok)throw Error(d.error||'Unable to create support ticket');
    history.push({role:'assistant',content:'I created a human-support ticket for you. Ticket ID: '+d.id+'. The Support team can continue from the inbox.'});saveLocal();draw();
  }catch(e){
    history.push({role:'assistant',content:'I could not create the support ticket right now: '+e.message});saveLocal();draw();
  }
};

chat.querySelector('#bgAiForm').onsubmit=async e=>{
  e.preventDefault();const msg=input.value.trim();if(!msg||input.disabled)return;
  setBusy(true);input.value='';
  try{
    const payload={message:msg,channel:'website',task:'customer_support',session_id:sessionId};
    if(conversationId)payload.conversation_id=conversationId;
    const r=await fetch('/api/ai/chat',{method:'POST',headers:authHeaders(),body:JSON.stringify(payload)}),d=await r.json();
    if(!r.ok)throw Error(d.error||'Support unavailable');
    conversationId=d.conversation_id||conversationId;
    if(conversationId)localStorage.setItem(CHAT_KEY,conversationId);
    history=(d.messages||[]).filter(x=>x.role==='user'||x.role==='assistant').map(x=>({role:x.role,content:x.content}));
    saveLocal();draw();
  }catch(e){
    history.push({role:'assistant',content:'Support is temporarily unavailable: '+e.message+'. Please try again or use Human support.'});
    saveLocal();draw();
  }finally{setBusy(false);input.focus()}
};
})();