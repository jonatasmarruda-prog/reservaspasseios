/* Ajustes finais do Portal V26 */
(function(){
  'use strict';

  document.addEventListener('click',function(e){
    const back=e.target.closest?.('#backTrips,#bottomBack,#soldBack');
    if(!back)return;
    try{
      const a=window.firebase?.auth?.();
      if(a?.currentUser?.isAnonymous)a.signOut().catch(()=>{});
    }catch(_){ }
  },true);

  document.addEventListener('DOMContentLoaded',function(){
    const toast=document.getElementById('toast');
    if(!toast||!window.MutationObserver)return;
    const obs=new MutationObserver(function(){
      if(!/não foi possível copiar/i.test(toast.textContent||''))return;
      const btn=document.getElementById('startPix');
      if(!btn)return;
      const pm=document.getElementById('paymentMethod')?.value;
      btn.disabled=false;
      btn.textContent=pm==='pix_parcelado'?'COPIAR PIX DA PARCELA':'COPIAR PIX';
    });
    obs.observe(toast,{childList:true,characterData:true,subtree:true,attributes:true});
  });
})();