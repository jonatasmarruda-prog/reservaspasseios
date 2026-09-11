/* Trilheiros Gestão — inicialização estável do Firestore, cache e bibliotecas críticas */
(function(){
  'use strict';
  const BUILD='20260911-stable-admin2';
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

  /* jsPDF 2.5.2 no cdnjs não possui o arquivo UMD usado pelo painel.
     Mantemos um carregador único e idempotente para garantir jsPDF + AutoTable,
     com fallback entre CDNs. Todos os relatórios podem reutilizar esta função. */
  let pdfPromise=null;
  function pdfReady(){
    const Ctor=window.jspdf?.jsPDF;
    return !!(Ctor&&typeof Ctor.prototype?.autoTable==='function');
  }
  function loadScript(src,key){
    return new Promise((resolve,reject)=>{
      if(key&&document.querySelector(`script[data-${key}]`)){
        const started=Date.now();
        const wait=()=>{
          if(pdfReady()||(key==='jspdf'&&window.jspdf?.jsPDF))return resolve();
          if(Date.now()-started>8000)return reject(new Error(`Timeout ao carregar ${key}`));
          setTimeout(wait,80);
        };
        return wait();
      }
      const s=document.createElement('script');
      s.src=src;s.async=true;s.crossOrigin='anonymous';
      if(key)s.dataset[key]='1';
      s.onload=()=>resolve();s.onerror=()=>reject(new Error(`Falha ao carregar ${src}`));
      document.head.appendChild(s);
    });
  }
  async function loadFirst(urls,key,check){
    if(check())return;
    let last;
    for(const url of urls){
      try{await loadScript(url,key);if(check())return}catch(err){last=err}
    }
    throw last||new Error(`Biblioteca ${key} indisponível.`);
  }
  window.ensurePdfLibraries=function(){
    if(pdfReady())return Promise.resolve(true);
    if(pdfPromise)return pdfPromise;
    pdfPromise=(async()=>{
      await loadFirst([
        'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
        'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js'
      ],'jspdf',()=>!!window.jspdf?.jsPDF);
      await loadFirst([
        'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.4/jspdf.plugin.autotable.min.js',
        'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.4/dist/jspdf.plugin.autotable.min.js'
      ],'autotable',pdfReady);
      if(!pdfReady())throw new Error('Gerador de PDF não pôde ser inicializado.');
      return true;
    })().catch(err=>{pdfPromise=null;console.error('PDF_LIBRARY_LOAD',err);throw err});
    return pdfPromise;
  };
  window.ensurePdfLibraries().catch(()=>{});

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