/* Compatibilidade entre V6 e V7: estado de rede e contador de notificações. */
(function(){
  window.setNetworkUI=function(){
    const online=navigator.onLine;
    const b=document.querySelector('#networkBadge');
    if(b){b.textContent=online?'● Online':'● Offline';b.className='networkBadge '+(online?'online':'offline')}
    const s=document.querySelector('#sync');
    if(s&&!online){s.textContent='☁ Offline • dados locais';s.classList.add('offline')}
  };
  window.updateNotificationBadge=function(){
    const count=(state.notifications||[]).filter(n=>!n.read).length;
    const b=document.querySelector('#notifyCount');if(b)b.textContent=count?String(count):'';
    const s=document.querySelector('#sideNotifyCount');if(s)s.textContent=count?`(${count})`:'';
  };
  window.addEventListener('online',()=>{setNetworkUI();});
  window.addEventListener('offline',()=>{setNetworkUI();});
})();
