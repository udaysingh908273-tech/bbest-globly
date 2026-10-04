const CACHE='bbg-v4-auth';const ASSETS=['/','/index.html','/css/styles.css','/js/app.js?v=20261004-auth2','/js/assistant.js','/dashboard.css','/manifest.webmanifest'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const url=new URL(e.request.url);
  if(url.pathname.startsWith('/api/'))return;
  if(url.pathname==='/admin' || url.pathname==='/dashboard' || url.pathname==='/dashboard.html' || url.pathname==='/dashboard.js' || url.pathname==='/dashboard.css')return;
  e.respondWith(fetch(e.request).then(r=>{
    const x=r.clone();caches.open(CACHE).then(c=>c.put(e.request,x));return r;
  }).catch(()=>caches.match(e.request).then(c=>c||caches.match('/index.html'))));
});