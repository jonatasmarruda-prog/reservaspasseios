/* Trilheiros Gestão V22.1 — guardas de segurança */
(function(){
  const ownerOrAdmin=()=>{try{return['owner','admin'].includes(state?.role)}catch{return false}};
  const deny=()=>{try{if(typeof toast==='function')toast('Somente proprietário ou administrador pode alterar vendas.','error');else alert('Somente proprietário ou administrador pode alterar vendas.')}catch(_){ }};

  ['openSaleModalV21','openPaymentV22','openEditSaleV22','cancelSaleV22','openAccommodationInventoryV22'].forEach(name=>{
    const fn=window[name];if(typeof fn!=='function')return;
    window[name]=function(...args){if(!ownerOrAdmin()){deny();return}return fn.apply(this,args)};
    try{globalThis[name]=window[name]}catch(_){ }
  });

  function patchAdminButtons(){
    if(!location.pathname.startsWith('/admin'))return;
    const allowed=ownerOrAdmin();
    const b=document.querySelector('#newSaleV21');if(b){b.disabled=!allowed;b.onclick=window.openSaleModalV21}
    document.querySelectorAll('[data-pay-v22],[data-edit-v22],[data-cancel-v22],#accInventoryV22,#salesNewV21').forEach(x=>{if(!allowed)x.disabled=true});
  }

  let cancelledSale=null;
  function renderCancelled(){
    if(!cancelledSale)return;
    const app=document.getElementById('app');if(!app)return;
    if(app.querySelector('[data-cancelled-sale-v221="1"]'))return;
    app.innerHTML=`<main class="salePublicPageV21"><header class="salePublicTopV21"><img src="https://i.postimg.cc/JnF2F9Hw/LOGO-TRILHEIROS-Photoroom.png" alt="Trilheiros de Rondonópolis"><div><strong>TRILHEIROS DE RONDONÓPOLIS</strong><span>Cadastro do passeio</span></div></header><section class="salePublicMessageV21" data-cancelled-sale-v221="1"><h1>Este link foi encerrado</h1><p>A venda foi cancelada e as vagas já foram devolvidas ao passeio. Se precisar de atendimento, fale com os Trilheiros.</p></section></main>`;
  }

  function guardCancelledSale(){
    const m=location.pathname.match(/^\/cadastro-venda\/([^/]+)/);if(!m)return;
    let tries=0;const timer=setInterval(async()=>{
      tries++;try{
        if(typeof db!=='undefined'&&db){clearInterval(timer);const s=await db.collection('sales').doc(m[1]).get();if(s.exists&&s.data().sale_status==='cancelled'){cancelledSale=s.data();renderCancelled()}}
      }catch(_){ }
      if(tries>100)clearInterval(timer);
    },80);
  }

  const obs=new MutationObserver(()=>{patchAdminButtons();if(cancelledSale)renderCancelled()});
  obs.observe(document.documentElement,{subtree:true,childList:true});
  window.addEventListener('load',()=>{patchAdminButtons();guardCancelledSale()});
  setTimeout(()=>{patchAdminButtons();guardCancelledSale()},300);
})();
