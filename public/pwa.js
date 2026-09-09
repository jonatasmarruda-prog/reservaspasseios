/* Instalação PWA e estado de conexão */
(function(){
  let deferredPrompt=null;

  if('serviceWorker' in navigator){
    window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(err=>console.warn('SW:',err)));
  }

  window.addEventListener('beforeinstallprompt',e=>{
    e.preventDefault();
    deferredPrompt=e;
    window.dispatchEvent(new CustomEvent('trilheiros:pwa-ready'));
  });

  window.addEventListener('appinstalled',()=>{
    deferredPrompt=null;
    window.dispatchEvent(new CustomEvent('trilheiros:pwa-installed'));
  });

  window.installTrilheirosApp=async function(){
    if(deferredPrompt){
      deferredPrompt.prompt();
      const choice=await deferredPrompt.userChoice;
      if(choice.outcome==='accepted')deferredPrompt=null;
      return choice.outcome;
    }
    return 'manual';
  };

  window.isTrilheirosInstalled=()=>window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
})();
