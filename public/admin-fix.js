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

  attachModalRemove();
  window.addEventListener('load', attachModalRemove);

  // Reaplica a correção sempre que um modal for aberto.
  document.addEventListener('click', function(){
    setTimeout(attachModalRemove,0);
  }, true);
})();
