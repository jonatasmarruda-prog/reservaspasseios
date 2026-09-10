/* Trilheiros Gestão — Service Worker otimizado */
const CACHE='trilheiros-shell-20260910-perf2';
const APP_SHELL=[
  '/offline.html',
  '/manifest.webmanifest',
  '/app-icon-192.svg',
  '/app-icon-512.svg',
  '/app.css',
  '/premium.css',
  '/admin-v7.css',
  '/admin-responsive-v8.css',
  '/admin-master-v40.css'
];

self.addEventListener('install',event=>{
  event.waitUntil(
    caches.open(CACHE)
      .then(cache=>cache.addAll(APP_SHELL))
      .catch(err=>console.warn('SW cache inicial:',err))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});

async function networkFirst(request,offlineFallback=false){
  const cache=await caches.open(CACHE);
  try{
    const response=await fetch(request);
    if(response&&response.ok)cache.put(request,response.clone()).catch(()=>{});
    return response;
  }catch(err){
    const cached=await cache.match(request);
    if(cached)return cached;
    if(offlineFallback)return (await cache.match('/offline.html'))||Response.error();
    throw err;
  }
}

async function staleWhileRevalidate(request){
  const cache=await caches.open(CACHE);
  const cached=await cache.match(request);
  const update=fetch(request).then(response=>{
    if(response&&response.ok)cache.put(request,response.clone()).catch(()=>{});
    return response;
  }).catch(()=>null);
  return cached||await update||Response.error();
}

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;

  if(request.mode==='navigate'){
    event.respondWith(networkFirst(request,true));
    return;
  }

  /* Código e configurações sempre tentam rede primeiro para evitar JS antigo preso no celular. */
  if(/\.(?:js|css|html|webmanifest)$/i.test(url.pathname)||url.pathname.startsWith('/__/firebase/')){
    event.respondWith(networkFirst(request,false));
    return;
  }

  /* Imagens/fontes locais podem abrir instantaneamente do cache e atualizar em paralelo. */
  event.respondWith(staleWhileRevalidate(request));
});

function normalizePushPayload(event){
  if(!event.data)return{};
  try{return event.data.json()||{}}catch(_){
    try{return{body:event.data.text()}}catch(__){return{}}
  }
}

function notificationOptions(data={}){
  return{
    body:data.body||'Há uma nova atualização no Trilheiros Gestão.',
    icon:data.icon||'/app-icon-192.svg',
    badge:data.badge||'/app-icon-192.svg',
    tag:data.tag||'trilheiros-gestao',
    renotify:Boolean(data.renotify),
    requireInteraction:Boolean(data.requireInteraction),
    timestamp:Number(data.timestamp||Date.now()),
    vibrate:Array.isArray(data.vibrate)?data.vibrate:[180,80,180],
    data:{url:data.url||'/admin',...(data.data||{})},
    actions:Array.isArray(data.actions)&&data.actions.length?data.actions:[{action:'open',title:'Abrir Gestão'}]
  };
}

self.addEventListener('push',event=>{
  const data=normalizePushPayload(event);
  const title=data.title||'🥾 Trilheiros Gestão';
  event.waitUntil(self.registration.showNotification(title,notificationOptions(data)));
});

self.addEventListener('message',event=>{
  const data=event.data||{};
  if(data.type==='SKIP_WAITING'){
    self.skipWaiting();
    return;
  }
  if(data.type==='SHOW_NOTIFICATION'){
    const payload=data.payload||{};
    event.waitUntil?.(self.registration.showNotification(payload.title||'🥾 Trilheiros Gestão',notificationOptions(payload)));
  }
});

self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const target=event.notification.data?.url||'/admin';
  event.waitUntil((async()=>{
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const client of windows){
      try{
        const current=new URL(client.url);
        const wanted=new URL(target,self.location.origin);
        if(current.origin===wanted.origin){
          await client.focus();
          if('navigate' in client&&current.href!==wanted.href)await client.navigate(wanted.href);
          return;
        }
      }catch(_){ }
    }
    if(self.clients.openWindow)return self.clients.openWindow(target);
  })());
});
