// Correção segura para os modais do painel administrativo.
// O código original chama modal.remove(), mas modal é uma função global.
// Adicionamos um método remove() à própria função para fechar o elemento correto.
(function(){
  function attachModalRemove(){
    if(typeof window.modal === 'function'){
      window.modal.remove = function(){
        const el=document.getElementById('modal');
        if(el) el.remove();
      };
    }
  }

  function loadTripWeather(){
    if(!location.pathname.startsWith('/admin')||document.querySelector('script[data-admin-weather]'))return;
    const s=document.createElement('script');
    s.src='/admin-weather.js?v=20260911-weather2';
    s.defer=true;
    s.dataset.adminWeather='1';
    document.head.appendChild(s);
  }

  attachModalRemove();
  loadTripWeather();
  window.addEventListener('load',()=>{attachModalRemove();loadTripWeather()});

  // Reaplica a correção sempre que um modal for aberto.
  document.addEventListener('click', function(){
    setTimeout(attachModalRemove,0);
  }, true);
})();
