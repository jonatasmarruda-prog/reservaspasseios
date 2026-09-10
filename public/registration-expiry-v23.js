/* Trilheiros de Rondonópolis — Expiração automática dos links de cadastro V23 */
(function(){
  const LOGO='https://i.postimg.cc/JnF2F9Hw/LOGO-TRILHEIROS-Photoroom.png';
  const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const fmtDate=v=>{const s=String(v||'').slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return s||'—';const[y,m,d]=s.split('-');return`${d}/${m}/${y}`};
  const todayCuiaba=()=>new Date().toLocaleDateString('en-CA',{timeZone:'America/Cuiaba'});
  const tripDate=v=>String(v||'').slice(0,10);
  const isExpired=v=>{const d=tripDate(v);return /^\d{4}-\d{2}-\d{2}$/.test(d)&&d<=todayCuiaba()};
  const isToday=v=>tripDate(v)===todayCuiaba();

  let blocked=false;
  let overlay=null;

  function makeOverlay(){
    if(overlay?.isConnected)return overlay;
    overlay=document.createElement('div');
    overlay.id='registrationExpiryV23';
    overlay.className='expiryOverlayV23 checking';
    overlay.innerHTML=`<section class="expiryCardV23"><img src="${LOGO}" alt="Trilheiros de Rondonópolis"><div class="expirySpinnerV23"></div><span>CADASTRO DO PASSEIO</span><h1>Verificando prazo...</h1><p>Aguarde um instante.</p></section>`;
    document.body.appendChild(overlay);
    return overlay;
  }

  function clearOverlay(){
    if(blocked)return;
    overlay?.remove();overlay=null;
  }

  function showExpired(name,dateValue,today){
    blocked=true;
    const el=makeOverlay();
    el.className='expiryOverlayV23 expired';
    el.innerHTML=`<section class="expiryCardV23 expiredCardV23"><img src="${LOGO}" alt="Trilheiros de Rondonópolis"><div class="expiryIconV23">${today?'🥾':'✓'}</div><span>${today?'O PASSEIO É HOJE':'PRAZO ENCERRADO'}</span><h1>${today?'É HOJE!':'Cadastro encerrado'}</h1><h2>${safe(name||'Passeio')}</h2><p>${today?'O cadastro foi encerrado porque o passeio acontece hoje. Obrigado por fazer parte dessa experiência. Nos vemos na trilha! 💚':`O prazo para preencher os dados deste passeio terminou em ${fmtDate(dateValue)}. Obrigado!`}</p><div class="expiryDateV23">📅 ${fmtDate(dateValue)}</div><small>Trilheiros de Rondonópolis • Aqui ninguém vai só.</small></section>`;
  }

  function showUnavailable(msg){
    blocked=true;
    const el=makeOverlay();el.className='expiryOverlayV23 expired';
    el.innerHTML=`<section class="expiryCardV23 expiredCardV23"><img src="${LOGO}" alt="Trilheiros de Rondonópolis"><div class="expiryIconV23">!</div><span>CADASTRO INDISPONÍVEL</span><h1>Não foi possível abrir</h1><p>${safe(msg||'Solicite um novo link aos Trilheiros.')}</p></section>`;
  }

  async function waitFirebase(){
    for(let i=0;i<120;i++){
      try{if(typeof db!=='undefined'&&db&&typeof auth!=='undefined'&&auth&&typeof ensureAnon==='function')return true}catch(_){ }
      await new Promise(r=>setTimeout(r,50));
    }
    return false;
  }

  async function guardCurrentRoute(){
    blocked=false;
    const saleMatch=location.pathname.match(/^\/cadastro-venda\/([^/]+)/);
    const legacyMatch=location.pathname.match(/^\/cadastro\/([^/]+)/);
    if(!saleMatch&&!legacyMatch){clearOverlay();return}
    makeOverlay();
    try{
      if(!await waitFirebase())throw Error('Não foi possível verificar o prazo do cadastro. Recarregue a página.');
      await ensureAnon();
      if(saleMatch){
        const ss=await db.collection('sales').doc(saleMatch[1]).get();
        if(!ss.exists)throw Error('Este link não foi encontrado.');
        const s=ss.data();
        /* Cadastro já concluído pode continuar mostrando apenas a confirmação. */
        if(s.registration_status==='completed'){clearOverlay();return}
        const ts=await db.collection('trips').doc(s.trip_id).get();
        if(!ts.exists)throw Error('Passeio não encontrado.');
        const t=ts.data(),d=tripDate(t.trip_date||s.trip_date);
        if(isExpired(d)){showExpired(t.name||s.trip_name,d,isToday(d));return}
        clearOverlay();return;
      }
      const ts=await db.collection('trips').doc(legacyMatch[1]).get();
      if(!ts.exists)throw Error('Passeio não encontrado.');
      const t=ts.data(),d=tripDate(t.trip_date);
      if(isExpired(d)){showExpired(t.name,d,isToday(d));return}
      clearOverlay();
    }catch(e){showUnavailable(e.message||'Solicite um novo link aos Trilheiros.')}
  }

  /* Impede envio mesmo se alguma tela antiga tentar ficar por baixo do aviso. */
  document.addEventListener('submit',e=>{
    if(!blocked)return;
    e.preventDefault();e.stopImmediatePropagation();
  },true);

  /* Na página pública geral, remove automaticamente passeios de hoje e datas passadas. */
  const originalRender=window.renderRegistration;
  if(typeof originalRender==='function'&&!originalRender.__expiryV23){
    const wrapped=function(trips,fixed){
      const list=Array.isArray(trips)?trips:[];
      return originalRender.call(this,fixed?list:list.filter(t=>!isExpired(t?.trip_date)),fixed);
    };
    wrapped.__expiryV23=true;
    window.renderRegistration=wrapped;
    try{renderRegistration=wrapped}catch(_){ }
  }

  guardCurrentRoute();
  window.addEventListener('load',guardCurrentRoute);
  window.addEventListener('popstate',guardCurrentRoute);
})();
