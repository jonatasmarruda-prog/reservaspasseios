/* Trilheiros Gestão — registro FCM para notificações com o app fechado */
(function(){
  'use strict';
  const VAPID_KEY='BHkqY6PmyREIcUGPdsfmdDDCf5Zsjb7qjrjRU3HwOz0M5RPFxqIW4Onyr0bC49PpQW2iPeoFz-vge1v5voVHiGE';
  const REGISTER_URL='https://southamerica-east1-trilheiros-reservas.cloudfunctions.net/registerPushDevice';
  const TOKEN_KEY='trilheiros_fcm_token_v1';
  let running=false,lastAttempt=0;

  async function registerPush(force=false){
    if(running)return false;
    if(!location.pathname.startsWith('/admin'))return false;
    if(!('serviceWorker' in navigator)||!('Notification' in window)||Notification.permission!=='granted')return false;
    if(!window.firebase?.messaging||!window.firebase?.auth)return false;
    if(!firebase.auth().currentUser||firebase.auth().currentUser.isAnonymous)return false;
    if(!force&&Date.now()-lastAttempt<15000)return false;
    running=true;lastAttempt=Date.now();
    try{
      const reg=await navigator.serviceWorker.ready;
      const messaging=firebase.messaging();
      const token=await messaging.getToken({vapidKey:VAPID_KEY,serviceWorkerRegistration:reg});
      if(!token)throw new Error('FCM_TOKEN_EMPTY');
      const idToken=await firebase.auth().currentUser.getIdToken();
      const response=await fetch(REGISTER_URL,{
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${idToken}`},
        body:JSON.stringify({token,platform:'web-pwa-android'})
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok||!data.ok)throw new Error(data.error||`HTTP_${response.status}`);
      localStorage.setItem(TOKEN_KEY,token);
      window.__trilheirosPushReady=true;
      window.dispatchEvent(new CustomEvent('trilheiros:push-ready'));
      return true;
    }catch(err){
      window.__trilheirosPushReady=false;
      console.warn('Push em segundo plano:',err?.message||err);
      return false;
    }finally{running=false;}
  }

  window.registerTrilheirosPush=registerPush;

  function schedule(){
    setTimeout(()=>registerPush(false),1200);
    setTimeout(()=>registerPush(false),5000);
  }

  window.addEventListener('load',schedule,{once:true});
  window.addEventListener('focus',()=>registerPush(false));
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')registerPush(false)});
  document.addEventListener('click',event=>{
    const button=event.target?.closest?.('#mobileNotifyEnable,#mobileNotifyTest');
    if(button)setTimeout(()=>registerPush(true),1800);
  },true);

  try{
    firebase.auth().onAuthStateChanged(user=>{if(user&&!user.isAnonymous)setTimeout(()=>registerPush(false),900)});
  }catch(_){ }
})();
