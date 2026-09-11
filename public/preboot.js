/* Trilheiros Gestão — inicialização estável do Firestore e proteção contra travamentos */
(function(){
  'use strict';
  const BUILD='20260911-stable-admin1';
  window.__TRILHEIROS_BUILD=BUILD;

  /* Limpa somente caches antigos do shell do app. Não apaga login, preferências
     nem a persistência offline do Firestore. */
  try{
    const key='trilheiros_runtime_build';
    if(localStorage.getItem(key)!==BUILD){
      if('caches' in window){
        caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('trilheiros-shell-')).map(k=>caches.delete(k)))).catch(()=>{});
      }
      if('serviceWorker' in navigator){
        navigator.serviceWorker.getRegistrations().then(regs=>Promise.all(regs.map(r=>r.update().catch(()=>{})))).catch(()=>{});
      }
      localStorage.setItem(key,BUILD);
    }
  }catch(_){ }

  try{
    if(!window.firebase?.apps?.length)return;
    const store=firebase.firestore();
    try{
      store.settings({cacheSizeBytes:firebase.firestore.CACHE_SIZE_UNLIMITED,ignoreUndefinedProperties:true});
    }catch(_){ }
    window.__trilheirosOfflinePersistence='starting';
    store.enablePersistence({synchronizeTabs:true}).then(()=>{
      window.__trilheirosOfflinePersistence='enabled';
      window.dispatchEvent(new CustomEvent('trilheiros:persistence',{detail:{enabled:true,build:BUILD}}));
    }).catch(err=>{
      const known=['failed-precondition','unimplemented'];
      window.__trilheirosOfflinePersistence=known.includes(err?.code)?'limited':'error';
      window.dispatchEvent(new CustomEvent('trilheiros:persistence',{detail:{enabled:false,code:err?.code||'',build:BUILD}}));
      console.warn('Persistência offline não pôde ser ativada:',err?.code||err);
    });
  }catch(err){
    window.__trilheirosOfflinePersistence='error';
    console.warn('Falha ao preparar modo offline:',err);
  }
})();
