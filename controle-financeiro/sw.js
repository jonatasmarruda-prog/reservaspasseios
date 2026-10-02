const CACHE="nosso-controle-v5";
const ASSETS=["./","./index.html","./manifest.webmanifest","./icon.svg"];
const EXTERNAL=[
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/dist/umd/supabase.min.js",
  "https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.min.js",
  "https://cdn.jsdelivr.net/npm/chart.js@4.5.1/dist/chart.umd.min.js",
  "https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js",
  "https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.4/dist/jspdf.plugin.autotable.min.js"
];
const CDN_HOSTS=new Set(["cdn.jsdelivr.net"]);

self.addEventListener("install",event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    await cache.addAll(ASSETS);
    await Promise.allSettled(EXTERNAL.map(async url=>{
      const response=await fetch(url,{mode:"cors"});
      if(response && response.ok)await cache.put(url,response.clone());
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate",event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  const url=new URL(event.request.url);

  if(url.origin===self.location.origin){
    if(event.request.mode==="navigate"){
      event.respondWith(
        fetch(event.request)
          .then(response=>{
            const copy=response.clone();
            caches.open(CACHE).then(cache=>cache.put("./index.html",copy)).catch(()=>{});
            return response;
          })
          .catch(()=>caches.match("./index.html"))
      );
      return;
    }
    event.respondWith(
      caches.match(event.request).then(cached=>{
        if(cached)return cached;
        return fetch(event.request).then(response=>{
          const copy=response.clone();
          caches.open(CACHE).then(cache=>cache.put(event.request,copy)).catch(()=>{});
          return response;
        });
      })
    );
    return;
  }

  if(CDN_HOSTS.has(url.hostname)){
    event.respondWith(
      caches.match(event.request).then(cached=>{
        const network=fetch(event.request).then(response=>{
          if(response && (response.ok || response.type==="opaque")){
            const copy=response.clone();
            caches.open(CACHE).then(cache=>cache.put(event.request,copy)).catch(()=>{});
          }
          return response;
        }).catch(()=>cached);
        return cached || network;
      })
    );
  }
});
