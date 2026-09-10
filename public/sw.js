const CACHE='trilheiros-admin-v22-20260910';
const APP_SHELL=['/','/admin','/offline.html','/manifest.webmanifest','/app.css','/premium.css','/features-v2.css','/public-premium.css','/public-flow-v3.css','/public-polish-v5.css','/public-simple-v9.css','/public-seat-selector-v11.css','/admin-v6.css','/admin-v7.css','/admin-responsive-v8.css','/enhancements-v10.css','/ui-polish-v12.css','/special-passenger-v13.css','/pdf-preview-v14.css','/public-premium-v15.css','/public-simple-v17.css','/public-hero-v18.css','/sales-flow-v21.css','/sales-management-v22.css','/spark.js','/admin-fix.js','/features-v2.js','/public-premium.js','/public-flow-v4.js','/public-polish-v5.js','/preboot.js','/v7-overrides.js','/public-simple-v9.js','/public-seat-selector-v11.js','/pwa.js','/admin-v6.js','/admin-v7.js','/admin-v7-access.js','/admin-v7-runtime-fix.js','/enhancements-v10.js','/enhancements-v10-syncfix.js','/special-passenger-v13.js','/pdf-preview-v14.js','/public-premium-v15.js','/pdf-actions-v16.js','/public-simple-v17.js','/public-hero-v18.js','/sales-flow-v21.js','/sales-management-v22.js','/app-icon-192.svg','/app-icon-512.svg'];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(APP_SHELL)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});

self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET') return;
  const url=new URL(req.url);
  if(url.origin!==location.origin) return;

  if(req.mode==='navigate'){
    event.respondWith(fetch(req).then(res=>{const clone=res.clone();caches.open(CACHE).then(c=>c.put(req,clone));return res}).catch(async()=>{
      return (await caches.match(req))||(await caches.match('/admin'))||(await caches.match('/offline.html'));
    }));
    return;
  }

  event.respondWith(caches.match(req).then(cached=>{
    const fresh=fetch(req).then(res=>{if(res&&res.ok){const clone=res.clone();caches.open(CACHE).then(c=>c.put(req,clone))}return res}).catch(()=>cached);
    return cached||fresh;
  }));
});

self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const target=event.notification.data?.url||'/admin';
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
    for(const client of list){if('focus' in client){client.navigate(target);return client.focus()}}
    if(clients.openWindow)return clients.openWindow(target);
  }));
});
