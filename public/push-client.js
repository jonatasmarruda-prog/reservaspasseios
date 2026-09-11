/* Trilheiros Gestão — registro FCM para notificações com o app fechado */
(function(){
  'use strict';
  const VAPID_KEY='BHkqY6PmyREIcUGPdsfmdDDCf5Zsjb7qjrjRU3HwOz0M5RPFxqIW4Onyr0bC49PpQW2iPeoFz-vge1v5voVHiGE';
  const REGISTER_URL='https://southamerica-east1-trilheiros-reservas.cloudfunctions.net/registerPushDevice';
  const TOKEN_KEY='trilheiros_fcm_token_v1';
  const ICON='https://i.postimg.cc/JnF2F9Hw/LOGO-TRILHEIROS-Photoroom.png?v=20260911-push8';
  let running=false,lastAttempt=0;

  function patchNotificationIcon(){
    try{
      const proto=globalThis.ServiceWorkerRegistration?.prototype;
      if(!proto?.showNotification||proto.showNotification.__trilheirosIconPatched)return;
      const native=proto.showNotification;
      const wrapped=function(title,options={}){
        const next={...options,icon:options.icon||ICON};
        delete next.badge;
        return native.call(this,title,next);
      };
      wrapped.__trilheirosIconPatched=true;
      proto.showNotification=wrapped;
    }catch(_){ }
  }
  patchNotificationIcon();

  async function registerPush(force=false){
    if(running)return false;
    if(!location.pathname.startsWith('/admin'))return false;
    if(!('serviceWorker' in navigator)||!('Notification' in window)||Notification.permission!=='granted')return false;
    if(!window.firebase?.messaging||!window.firebase?.auth)return false;
    const user=firebase.auth().currentUser;
    if(!user||user.isAnonymous)return false;
    if(!force&&Date.now()-lastAttempt<15000)return false;
    running=true;lastAttempt=Date.now();
    try{
      const reg=await navigator.serviceWorker.ready;
      await reg.update().catch(()=>{});
      const messaging=firebase.messaging();
      const token=await messaging.getToken({vapidKey:VAPID_KEY,serviceWorkerRegistration:reg});
      if(!token)throw new Error('FCM_TOKEN_EMPTY');
      const idToken=await user.getIdToken(true);
      const response=await fetch(REGISTER_URL,{
        method:'POST',
        cache:'no-store',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${idToken}`},
        body:JSON.stringify({token,platform:'web-pwa-android'})
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok||!data.ok)throw new Error(data.error||`HTTP_${response.status}`);
      localStorage.setItem(TOKEN_KEY,token);
      localStorage.setItem('trilheiros_fcm_registered_at',new Date().toISOString());
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
    setTimeout(()=>registerPush(false),700);
    setTimeout(()=>registerPush(true),3500);
    setTimeout(()=>registerPush(true),12000);
  }

  window.addEventListener('load',schedule,{once:true});
  window.addEventListener('focus',()=>registerPush(false));
  window.addEventListener('online',()=>registerPush(true));
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')registerPush(false)});
  document.addEventListener('click',event=>{
    const button=event.target?.closest?.('#mobileNotifyEnable,#mobileNotifyTest');
    if(button)setTimeout(()=>registerPush(true),700);
  },true);

  try{
    firebase.auth().onAuthStateChanged(user=>{if(user&&!user.isAnonymous)setTimeout(()=>registerPush(true),500)});
  }catch(_){ }
})();
