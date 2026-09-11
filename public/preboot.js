/* Trilheiros Gestão — inicialização estável do Firestore e proteção contra travamentos */
(function(){
  'use strict';
  const BUILD='20260911-stability3';
  window.__TRILHEIROS_BUILD=BUILD;

  /*
   * Algumas camadas antigas do admin usam MutationObserver apenas para reaplicar
   * ajustes visuais. A V42 observava o documento inteiro e chamava patch() a cada
   * alteração; o próprio patch alterava o DOM novamente, criando um ciclo que
   * deixava a aba Relatórios sem responder. O modo Dia do Passeio também usa um
   * observer para atualizar o resumo, então nele filtramos apenas as mutações que
   * foram causadas pelo próprio resumo, preservando atualizações reais do check-in.
   */
  try{
    if(location.pathname.startsWith('/admin')&&window.MutationObserver&&!window.__TRILHEIROS_OBSERVER_GUARD){
      const NativeObserver=window.MutationObserver;
      const GuardedObserver=function(callback){
        const source=Function.prototype.toString.call(callback).replace(/\s+/g,'');

        /* admin-stable-v42.js: o renderAdmin + timers já executam patch();
           o observer global é redundante e era a principal fonte do loop. */
        if(source.includes("location.pathname.startsWith('/admin')")&&source.includes('patch()')){
          const observer=new NativeObserver(()=>{});
          observer.__trilheirosSuppressed='v42-global-patch';
          return observer;
        }

        /* admin-trip-operations.js: mantém o observer, mas ignora alterações
           feitas dentro do próprio resumo, evitando render contínuo. */
        if(source==='()=>schedule()'){
          return new NativeObserver((mutations,observer)=>{
            const meaningful=(mutations||[]).some(m=>{
              const node=m.target?.nodeType===1?m.target:m.target?.parentElement;
              return !node?.closest?.('#tripOpsSummary');
            });
            if(meaningful)callback(mutations,observer);
          });
        }

        return new NativeObserver(callback);
      };
      GuardedObserver.prototype=NativeObserver.prototype;
      window.MutationObserver=GuardedObserver;
      window.__TRILHEIROS_OBSERVER_GUARD=true;
    }
  }catch(err){console.warn('Proteção de renderização:',err)}

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
