/* Inicialização antecipada do Firestore para modo offline + push */
(function(){
  try{
    if(!window.firebase?.apps?.length) return;
    const store=firebase.firestore();
    try{
      store.settings({cacheSizeBytes:firebase.firestore.CACHE_SIZE_UNLIMITED,ignoreUndefinedProperties:true});
    }catch(_){ }
    window.__trilheirosOfflinePersistence='starting';
    store.enablePersistence({synchronizeTabs:true}).then(()=>{
      window.__trilheirosOfflinePersistence='enabled';
      window.dispatchEvent(new CustomEvent('trilheiros:persistence',{detail:{enabled:true}}));
    }).catch(err=>{
      const known=['failed-precondition','unimplemented'];
      window.__trilheirosOfflinePersistence=known.includes(err?.code)?'limited':'error';
      window.dispatchEvent(new CustomEvent('trilheiros:persistence',{detail:{enabled:false,code:err?.code||''}}));
      console.warn('Persistência offline não pôde ser ativada:',err?.code||err);
    });

    if(location.pathname.startsWith('/admin')){
      const operations=document.createElement('script');
      operations.src='/admin-trip-operations.js?v=20260911-ops1';
      operations.defer=true;
      document.head.appendChild(operations);

      const messaging=document.createElement('script');
      messaging.src='/__/firebase/10.14.1/firebase-messaging-compat.js';
      messaging.defer=true;
      messaging.onload=()=>{
        const push=document.createElement('script');
        push.src='/push-client.js?v=20260910-bgpush1';
        push.defer=true;
        document.head.appendChild(push);
      };
      messaging.onerror=()=>console.warn('Firebase Messaging não pôde ser carregado.');
      document.head.appendChild(messaging);
    }
  }catch(err){console.warn('Falha ao preparar modo offline:',err)}
})();
