/* Trilheiros Gestão — inicialização estável do Firestore */
(function(){
  'use strict';
  const BUILD='20260911-stability2';
  window.__TRILHEIROS_BUILD=BUILD;
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
