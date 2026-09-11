/* Trilheiros Gestão — Service Worker otimizado */
const CACHE='trilheiros-shell-20260911-stability2';
const NOTIFICATION_ICON='https://i.postimg.cc/JnF2F9Hw/LOGO-TRILHEIROS-Photoroom.png?v=20260911-stability2';
const APP_SHELL=[
  '/offline.html',
  '/manifest.webmanifest?v=20260910-brand7',
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
  if(/\.(?:js|css|html|webmanifest)$/i.test(url.pathname)||url.pathname.startsWith('/__/firebase/')){
    event.respondWith(networkFirst(request,false));
    return;
  }
  event.respondWith(staleWhileRevalidate(request));
});

function normalizePushPayload(event){
  if(!event.data)return{};
  try{
    const raw=event.data.json()||{};
    const notification=raw.notification||raw?.data?.notification||{};
    const webpushNotification=raw?.webpush?.notification||{};
    const data=raw.data||{};
    return{
      ...data,
      ...raw,
      title:raw.title||notification.title||webpushNotification.title||data.title,
      body:raw.body||notification.body||webpushNotification.body||data.body,
      icon:raw.icon||notification.icon||webpushNotification.icon||data.icon,
      url:raw.url||data.url||raw?.fcmOptions?.link||raw?.webpush?.fcmOptions?.link,
      tag:raw.tag||notification.tag||webpushNotification.tag||data.tag
    };
  }catch(_){
    try{return{body:event.data.text()}}catch(__){return{}}
  }
}

function notificationOptions(data={}){
  return{
    body:data.body||'Há uma nova atualização no Trilheiros Gestão.',
    icon:data.icon||NOTIFICATION_ICON,
    tag:data.tag||'trilheiros-gestao',
    renotify:data.renotify===true||data.renotify==='true',
    requireInteraction:data.requireInteraction===true||data.requireInteraction==='true',
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
