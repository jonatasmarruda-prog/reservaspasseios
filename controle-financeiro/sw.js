const CACHE="nosso-controle-v4";
const ASSETS=["./","./index.html","./manifest.webmanifest","./icon.svg"];
const CDN_HOSTS=new Set(["cdn.jsdelivr.net"]);

self.addEventListener("install",event=>{
  event.waitUntil(
    caches.open(CACHE)
      .then(cache=>cache.addAll(ASSETS))
      .then(()=>self.skipWaiting())
  );
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
