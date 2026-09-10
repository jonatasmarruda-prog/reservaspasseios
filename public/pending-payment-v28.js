/* Pendências V28 — exibe nome, passeio e forma de pagamento nas pendências de pagamento. */
(function(){
  function paymentLabel(value){
    const v=String(value||'').toLowerCase();
    if(v.includes('card')||v.includes('cart')) return 'CARTÃO';
    if(v.includes('pix')) return 'PIX';
    return 'A CONFIRMAR';
  }

  function enhancePaymentPending(){
    try{
      if(typeof state==='undefined'||state.tab!=='pending') return;
      const list=document.querySelector('.pendingList');
      if(!list) return;

      const reservations=(state.reservations||[]).filter(r=>
        ['pending','partial'].includes(r.payment_status)&&r.status!=='cancelled'
      );

      const paymentItems=[...list.querySelectorAll('.pendingItem')].filter(item=>
        String(item.querySelector('span')?.textContent||'').trim().toLowerCase()==='pagamento'
      );

      paymentItems.forEach((item,index)=>{
        const r=reservations[index];
        if(!r) return;
        const trip=(state.trips||[]).find(t=>t.id===r.trip_id);
        const name=r.responsible_name||(r.participants?.[0]?.full_name)||'Sem nome';
        const tripName=trip?.name||r.trip_name||'Passeio';
        const method=paymentLabel(r.payment_method);
        const text=`${name} • ${tripName} • ${method}`;
        const strong=item.querySelector('strong');
        if(strong&&strong.textContent!==text) strong.textContent=text;
      });
    }catch(_){ }
  }

  const originalRenderAdmin=window.renderAdmin;
  if(typeof originalRenderAdmin==='function'){
    window.renderAdmin=function(...args){
      const out=originalRenderAdmin.apply(this,args);
      queueMicrotask(enhancePaymentPending);
      return out;
    };
    try{renderAdmin=window.renderAdmin}catch(_){ }
  }

  const observer=new MutationObserver(()=>{
    if(document.querySelector('.pendingList')) enhancePaymentPending();
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});

  document.addEventListener('DOMContentLoaded',enhancePaymentPending);
  setTimeout(enhancePaymentPending,300);
})();
