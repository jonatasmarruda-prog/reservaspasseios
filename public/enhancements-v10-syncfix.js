/* Garante sincronização tardia e mantém atalhos operacionais essenciais visíveis no Admin. */
(function(){
  async function mirror(){
    try{
      if(!location.pathname.startsWith('/admin')||!window.firebase?.apps?.length||!auth?.currentUser||!db)return;
      const s=await db.collection('settings').doc('general').get();
      if(!s.exists)return;
      const g=s.data();
      await db.collection('settings').doc('public').set({business_name:g.business_name||'Trilheiros de Rondonópolis',whatsapp:g.whatsapp||'',updated_at:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});
    }catch(_){ }
  }

  function openDayTrip(){
    try{
      if(typeof state==='undefined')return;
      state.tab='day';
      if(typeof window.toggleAdminSide==='function')window.toggleAdminSide(false);
      if(typeof window.renderAdmin==='function')window.renderAdmin();
    }catch(e){console.warn('DAY_TRIP_OPEN',e)}
  }
  window.openDayTrip=window.openDayTrip||openDayTrip;

  function ensureDayNav(){
    if(!location.pathname.startsWith('/admin'))return;
    const nav=document.querySelector('.admin .nav');
    if(!nav||nav.querySelector('[data-tab="day"]'))return;
    const button=document.createElement('button');
    button.dataset.tab='day';
    button.innerHTML='☀ Dia do passeio';
    button.onclick=openDayTrip;
    const reports=nav.querySelector('[data-tab="reports"]');
    if(reports)nav.insertBefore(button,reports);
    else nav.appendChild(button);
  }

  function enhanceDayPdfActions(){
    if(typeof state==='undefined'||state.tab!=='day')return;
    const toolbar=document.querySelector('.dayGrid .panel .panelHead .toolbar');
    if(!toolbar||toolbar.dataset.dayPdfReady==='1')return;
    toolbar.dataset.dayPdfReady='1';
    const tripId=()=>state.dayTrip||document.querySelector('#dayTripSelect')?.value||'';
    const current=[...toolbar.querySelectorAll('button')];
    const generic=current.find(b=>/pdf/i.test(b.textContent||'')&&!/seguro/i.test(b.textContent||''));
    if(generic)generic.textContent='Lista participantes';
    const add=(label,fn)=>{
      const b=document.createElement('button');
      b.type='button';b.className='btn ghost';b.textContent=label;
      b.onclick=()=>{const id=tripId();if(!id)return;const action=window[fn];if(typeof action==='function')action(id)};
      toolbar.appendChild(b);
    };
    add('PDF Transporte','driverPdfV7');
    add('PDF Hospedagem','roomsPdfV7');
  }

  function keepOperationalUi(){ensureDayNav();enhanceDayPdfActions()}

  window.addEventListener('load',()=>{
    setTimeout(mirror,1800);
    setTimeout(keepOperationalUi,900);
    setTimeout(keepOperationalUi,2200);
  });
  document.addEventListener('submit',e=>{if(e.target?.id==='generalSettings')setTimeout(mirror,1200)},true);
  document.addEventListener('click',()=>setTimeout(keepOperationalUi,80),true);
  setInterval(keepOperationalUi,1600);
})();
