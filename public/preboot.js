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

/* Estabiliza a Central de Relatórios no admin.
   A V42 observava mutações e reescrevia os mesmos textos repetidamente na aba
   Relatórios, criando um ciclo de MutationObserver que bloqueava o seletor no celular. */
(function(){
  if(!location.pathname.startsWith('/admin'))return;

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#039;'}[c]));

  function ensureStyle(){
    if(document.getElementById('reportsStableStyle'))return;
    const style=document.createElement('style');
    style.id='reportsStableStyle';
    style.textContent=`
      .reportTripStable{position:relative;width:100%}
      .reportTripStablePicker{width:100%;min-height:48px;border:1px solid #cbdad3;border-radius:12px;background:#fff;color:#173b30;padding:0 14px;font-weight:800;display:flex;align-items:center;justify-content:space-between;gap:12px;text-align:left;cursor:pointer}
      .reportTripStablePicker:after{content:'▾';font-size:14px;color:#5f776d}.reportTripStablePicker.open:after{content:'▴'}
      .reportTripStableMenu{display:none;margin-top:8px;padding:7px;border:1px solid #dbe6e1;border-radius:14px;background:#fff;box-shadow:0 12px 30px rgba(7,50,38,.10);max-height:330px;overflow:auto;gap:6px}
      .reportTripStableMenu.open{display:grid}
      .reportTripStableOption{width:100%;border:1px solid #e1eae6;border-radius:11px;background:#fff;color:#173b30;padding:11px 12px;text-align:left;font-weight:750;cursor:pointer}
      .reportTripStableOption:hover,.reportTripStableOption.active{background:#eef7f3;border-color:#8eb8a7}
      @media(max-width:760px){.reportTripStablePicker{min-height:52px;font-size:15px}.reportTripStableMenu{max-height:300px}.reportTripStableOption{padding:13px 12px}}
    `;
    document.head.appendChild(style);
  }

  function neutralizeV42ReportLoop(root){
    const rules=[
      {needle:'pdfTrip(',title:'Lista para ônibus / atrativos',desc:'Somente Nº, nome do participante e tipo/opção escolhida. Sem CPF e sem “responsável”.'},
      {needle:'insuranceCsvV7(',title:'Seguro',desc:'Lista separada com CPF somente quando a seguradora exigir.'},
      {needle:'roomsPdfV7(',title:'Hospedagem',desc:'Nome, tipo/opção e quarto. Sem CPF.'},
      {needle:'driverPdfV7(',title:'Transporte / ônibus',desc:'Nome, tipo/opção, veículo e assento. Sem CPF.'}
    ];
    root.querySelectorAll('.reportCards button').forEach(btn=>{
      const action=btn.getAttribute('onclick')||'';
      const rule=rules.find(r=>action.includes(r.needle));
      if(!rule)return;
      const strong=btn.querySelector('strong'),small=btn.querySelector('small');
      if(strong&&strong.textContent!==rule.title)strong.textContent=rule.title;
      if(small&&small.textContent!==rule.desc)small.textContent=rule.desc;
    });
  }

  function stabilizeReports(){
    try{
      if(typeof state==='undefined'||state.tab!=='reports')return;
      const root=document.getElementById('content');
      if(!root)return;
      ensureStyle();
      neutralizeV42ReportLoop(root);

      const select=root.querySelector('#reportTrip');
      if(!select)return;

      const valid=[...select.options].filter(o=>o.value);
      if(state.reportTripStable&&valid.some(o=>o.value===state.reportTripStable))select.value=state.reportTripStable;
      select.hidden=true;

      let wrap=root.querySelector('#reportTripStable');
      if(!wrap){
        wrap=document.createElement('div');
        wrap.id='reportTripStable';
        wrap.className='reportTripStable';
        wrap.innerHTML='<button type="button" class="reportTripStablePicker"><span>Selecione um passeio</span></button><div class="reportTripStableMenu"></div>';
        select.parentNode.insertBefore(wrap,select);
      }

      const picker=wrap.querySelector('.reportTripStablePicker');
      const label=picker.querySelector('span');
      const menu=wrap.querySelector('.reportTripStableMenu');

      const refresh=()=>{
        const current=[...select.options].find(o=>o.value===select.value&&o.value);
        label.textContent=current?.textContent||'Selecione um passeio';
        menu.replaceChildren();
        [...select.options].filter(o=>o.value).forEach(o=>{
          const btn=document.createElement('button');
          btn.type='button';
          btn.className='reportTripStableOption'+(o.value===select.value?' active':'');
          btn.dataset.value=o.value;
          btn.textContent=o.textContent||'Passeio';
          btn.onclick=e=>{
            e.preventDefault();e.stopPropagation();
            select.value=o.value;
            state.reportTripStable=o.value;
            select.dispatchEvent(new Event('change',{bubbles:true}));
            refresh();
            menu.classList.remove('open');picker.classList.remove('open');
          };
          menu.appendChild(btn);
        });
      };

      if(!picker.dataset.bound){
        picker.dataset.bound='1';
        picker.onclick=e=>{
          e.preventDefault();e.stopPropagation();
          const open=!menu.classList.contains('open');
          menu.classList.toggle('open',open);picker.classList.toggle('open',open);
        };
      }
      refresh();
    }catch(err){console.warn('REPORTS_STABILITY_FIX',err)}
  }

  function install(){
    const current=window.renderAdmin;
    if(typeof current==='function'&&!current.__reportsStable20260911){
      const wrapped=function(...args){
        const out=current.apply(this,args);
        stabilizeReports();
        return out;
      };
      wrapped.__reportsStable20260911=true;
      window.renderAdmin=wrapped;
      try{globalThis.renderAdmin=wrapped}catch(_){ }
    }
    stabilizeReports();
  }

  window.addEventListener('DOMContentLoaded',()=>{install();setTimeout(install,120)});
  window.addEventListener('load',()=>setTimeout(install,300));
})();
