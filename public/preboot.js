/* Trilheiros Gestão — inicialização estável do Firestore e proteção contra travamentos */
(function(){
  'use strict';
  const BUILD='20260911-stability4';
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

/*
 * Seletor de passeio da Central de Relatórios.
 * Em alguns Androids o <select> nativo da tela era fechado/recriado por camadas
 * antigas do painel antes da escolha terminar. Mantemos o select original oculto
 * (para os geradores de PDF continuarem usando #reportTrip.value) e exibimos uma
 * lista touch-safe de botões. Assim a escolha não depende do dropdown do navegador.
 */
(function(){
  'use strict';
  if(!location.pathname.startsWith('/admin'))return;

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

  function ensureStyle(){
    if(document.getElementById('reportTripTouchStyle'))return;
    const style=document.createElement('style');
    style.id='reportTripTouchStyle';
    style.textContent=`
      #reportTrip{display:none!important}
      .reportTripTouchSelector{max-width:560px;width:100%;display:grid;gap:9px}
      .reportTripTouchCurrent{min-height:48px;padding:10px 13px;border:1px solid #c9d9d2;border-radius:12px;background:#f7fbf9;color:#173b30;display:flex;align-items:center;justify-content:space-between;gap:12px}
      .reportTripTouchCurrent span{font-size:10px;font-weight:900;color:#6a7e75;text-transform:uppercase;letter-spacing:.04em}
      .reportTripTouchCurrent strong{font-size:12px;text-align:right;color:#073226}
      .reportTripTouchList{display:grid;gap:7px;max-height:260px;overflow:auto;padding:7px;border:1px solid #dbe6e1;border-radius:14px;background:#fff;-webkit-overflow-scrolling:touch}
      .reportTripTouchOption{width:100%;min-height:48px;border:1px solid #e0e9e5;border-radius:11px;background:#fff;color:#173b30;padding:10px 12px;text-align:left;cursor:pointer;touch-action:manipulation}
      .reportTripTouchOption strong{display:block;font-size:12px}.reportTripTouchOption small{display:block;margin-top:3px;color:#6d8077;font-size:10px}
      .reportTripTouchOption.active{background:#e9f5ef;border-color:#6da58e;box-shadow:inset 3px 0 0 #0d6549}
      .reportTripTouchEmpty{padding:12px;color:#6d8077;font-size:11px}
      @media(max-width:780px){.reportTripSelect{padding-top:14px}.reportTripTouchSelector{max-width:none}.reportTripTouchCurrent{align-items:flex-start;flex-direction:column}.reportTripTouchCurrent strong{text-align:left}.reportTripTouchList{max-height:300px}.reportTripTouchOption{min-height:54px;padding:12px}}
    `;
    document.head.appendChild(style);
  }

  function formatDate(v){
    const s=String(v||'').slice(0,10);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return'';
    const [y,m,d]=s.split('-');return `${d}/${m}/${y}`;
  }

  function applyReportSelector(){
    try{
      if(typeof state==='undefined'||state.tab!=='reports')return;
      const select=document.getElementById('reportTrip');
      if(!select)return;
      ensureStyle();
      const parent=select.closest('.reportTripSelect')||select.parentElement;
      if(!parent)return;

      const options=[...select.options].filter(o=>o.value);
      const valid=new Set(options.map(o=>o.value));
      if(state.reportTripTouch&&!valid.has(state.reportTripTouch))state.reportTripTouch='';
      if(state.reportTripTouch)select.value=state.reportTripTouch;

      let host=document.getElementById('reportTripTouchSelector');
      if(!host){
        host=document.createElement('div');
        host.id='reportTripTouchSelector';
        host.className='reportTripTouchSelector';
        select.insertAdjacentElement('afterend',host);
      }

      const selected=options.find(o=>o.value===select.value&&o.value);
      host.innerHTML=`
        <div class="reportTripTouchCurrent"><span>Passeio selecionado</span><strong>${selected?esc(selected.textContent):'Nenhum — toque em um passeio abaixo'}</strong></div>
        <div class="reportTripTouchList">
          ${options.length?options.map(o=>{
            const trip=(state.trips||[]).find(t=>t.id===o.value);
            const date=trip?.trip_date?formatDate(trip.trip_date):'';
            const destination=trip?.destination?` • ${esc(trip.destination)}`:'';
            return `<button type="button" class="reportTripTouchOption ${o.value===select.value?'active':''}" data-report-trip-touch="${esc(o.value)}"><strong>${esc(trip?.name||o.textContent||'Passeio')}</strong><small>${date}${destination}</small></button>`;
          }).join(''):'<div class="reportTripTouchEmpty">Nenhum passeio disponível.</div>'}
        </div>`;

      host.querySelectorAll('[data-report-trip-touch]').forEach(btn=>{
        btn.onclick=e=>{
          e.preventDefault();
          e.stopPropagation();
          const value=btn.dataset.reportTripTouch||'';
          if(!valid.has(value))return;
          select.value=value;
          state.reportTripTouch=value;
          select.dispatchEvent(new Event('input',{bubbles:true}));
          select.dispatchEvent(new Event('change',{bubbles:true}));
          applyReportSelector();
        };
      });
    }catch(err){console.warn('REPORT_TRIP_TOUCH_SELECTOR',err)}
  }

  function install(){
    const current=window.renderAdmin;
    if(typeof current==='function'&&!current.__reportTripTouchSafe){
      const wrapped=function(...args){
        const out=current.apply(this,args);
        setTimeout(applyReportSelector,0);
        return out;
      };
      wrapped.__reportTripTouchSafe=true;
      window.renderAdmin=wrapped;
      try{globalThis.renderAdmin=wrapped}catch(_){ }
    }
    applyReportSelector();
  }

  window.addEventListener('DOMContentLoaded',()=>{install();setTimeout(install,180)});
  window.addEventListener('load',()=>setTimeout(install,320));
})();
