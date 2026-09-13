/* Trilheiros Gestão — registro FCM + Web Push imediato com o app fechado */
(function(){
  'use strict';
  const FCM_VAPID='BHkqY6PmyREIcUGPdsfmdDDCf5Zsjb7qjrjRU3HwOz0M5RPFxqIW4Onyr0bC49PpQW2iPeoFz-vge1v5voVHiGE';
  const REGISTER_URL='https://southamerica-east1-trilheiros-reservas.cloudfunctions.net/registerPushDevice';
  const TOKEN_KEY='trilheiros_fcm_token_v1';
  const WEB_PUSH_PUBLIC='BKO4HsShdL-gS2uZdoahQMU75NKAsIlBBJ7Z6JJ7J5ZjI-KcRV9WNznDDII4im1ILIKRNXEo6mBrttsGyffwCF4';
  const WEB_PUSH_VERSION='v2';
  const WEB_PUSH_SW='/webpush-sw.js';
  const WEB_PUSH_SCOPE='/push-native/';
  const ICON='https://i.postimg.cc/JnF2F9Hw/LOGO-TRILHEIROS-Photoroom.png?v=20260912-push-immediate2';
  let running=false,lastAttempt=0,nativeRunning=false;

  function b64ToUint8(v){
    const p='='.repeat((4-v.length%4)%4),s=(v+p).replace(/-/g,'+').replace(/_/g,'/'),raw=atob(s),out=new Uint8Array(raw.length);
    for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);return out;
  }

  function tokenId(token){
    let h=0;for(let i=0;i<token.length;i++)h=((h<<5)-h)+token.charCodeAt(i)|0;
    return `owner_${Math.abs(h)}_${token.slice(-18).replace(/[^a-zA-Z0-9_-]/g,'')}`;
  }

  function patchNotificationIcon(){
    try{
      const proto=globalThis.ServiceWorkerRegistration?.prototype;
      if(!proto?.showNotification||proto.showNotification.__trilheirosIconPatched)return;
      const native=proto.showNotification;
      const wrapped=function(title,options={}){const next={...options,icon:options.icon||ICON};delete next.badge;return native.call(this,title,next)};
      wrapped.__trilheirosIconPatched=true;proto.showNotification=wrapped;
    }catch(_){ }
  }
  patchNotificationIcon();

  async function saveTokenFree(token,user){
    try{
      const database=typeof db!=='undefined'?db:(window.firebase?.firestore?.());if(!database)return false;
      const FV=firebase.firestore.FieldValue,stamp=FV.serverTimestamp();
      const deviceRef=database.collection('push_devices').doc(tokenId(token));
      await Promise.all([
        database.collection('settings').doc('push_device_owner').set({tokens:FV.arrayUnion(token),owner_uid:user.uid,owner_email:user.email||'',active:true,platform:'web-pwa-android',updated_at:stamp},{merge:true}),
        deviceRef.set({token,owner_uid:user.uid,owner_email:user.email||'',active:true,platform:'web-pwa-android',source:'admin_push_client',updated_at:stamp,created_at:stamp},{merge:true})
      ]);
      return true;
    }catch(err){console.warn('Registro push gratuito:',err?.message||err);return false}
  }

  async function registerNativePush(force=false){
    if(nativeRunning)return null;
    if(!location.pathname.startsWith('/admin'))return null;
    if(!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window)||Notification.permission!=='granted')return null;
    nativeRunning=true;
    try{
      const reg=await navigator.serviceWorker.register(WEB_PUSH_SW,{scope:WEB_PUSH_SCOPE,updateViaCache:'none'});
      await reg.update().catch(()=>{});
      let sub=await reg.pushManager.getSubscription();
      const migrated=localStorage.getItem('trilheiros_webpush_key_version')===WEB_PUSH_VERSION;
      if(sub&&!migrated){try{await sub.unsubscribe()}catch(_){ }sub=null;localStorage.removeItem('trilheiros_webpush_subscription_v1')}
      if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64ToUint8(WEB_PUSH_PUBLIC)});
      const json=sub.toJSON();
      localStorage.setItem('trilheiros_webpush_subscription_v2',JSON.stringify(json));
      localStorage.setItem('trilheiros_webpush_key_version',WEB_PUSH_VERSION);
      localStorage.setItem('trilheiros_webpush_registered_at',new Date().toISOString());
      window.__trilheirosWebPushReady=true;
      return json;
    }catch(err){
      window.__trilheirosWebPushReady=false;
      if(force)console.warn('Web Push imediato:',err?.message||err);
      return null;
    }finally{nativeRunning=false}
  }

  window.getTrilheirosWebPushSubscription=async function(){
    const live=await registerNativePush(false);if(live)return live;
    try{return JSON.parse(localStorage.getItem('trilheiros_webpush_subscription_v2')||'null')}catch(_){return null}
  };
  window.registerTrilheirosNativePush=registerNativePush;

  async function registerPush(force=false){
    if(running)return false;
    if(!location.pathname.startsWith('/admin'))return false;
    if(!('serviceWorker' in navigator)||!('Notification' in window)||Notification.permission!=='granted')return false;
    if(!window.firebase?.messaging||!window.firebase?.auth)return false;
    const user=firebase.auth().currentUser;if(!user||user.isAnonymous)return false;
    if(!force&&Date.now()-lastAttempt<15000)return false;
    running=true;lastAttempt=Date.now();
    try{
      const reg=(await navigator.serviceWorker.getRegistration('/'))||await navigator.serviceWorker.ready;
      if(!reg)throw new Error('SERVICE_WORKER_NOT_READY');
      await reg.update().catch(()=>{});
      const messaging=firebase.messaging();
      const token=await messaging.getToken({vapidKey:FCM_VAPID,serviceWorkerRegistration:reg});
      if(!token)throw new Error('FCM_TOKEN_EMPTY');
      const directSaved=await saveTokenFree(token,user);
      let functionSaved=false;
      try{
        const idToken=await user.getIdToken(true),response=await fetch(REGISTER_URL,{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json','Authorization':`Bearer ${idToken}`},body:JSON.stringify({token,platform:'web-pwa-android'})}),data=await response.json().catch(()=>({}));
        functionSaved=!!(response.ok&&data.ok);
      }catch(_){functionSaved=false}
      if(!directSaved&&!functionSaved)throw new Error('PUSH_REGISTER_FAILED');
      localStorage.setItem(TOKEN_KEY,token);
      localStorage.setItem('trilheiros_fcm_registered_at',new Date().toISOString());
      localStorage.setItem('trilheiros_fcm_registration_mode',directSaved?'free-firestore':'cloud-function');
      window.__trilheirosPushReady=true;
      await registerNativePush(force).catch(()=>null);
      window.dispatchEvent(new CustomEvent('trilheiros:push-ready'));
      return true;
    }catch(err){window.__trilheirosPushReady=false;console.warn('Push em segundo plano:',err?.message||err);await registerNativePush(force).catch(()=>null);return false}
    finally{running=false}
  }

  window.registerTrilheirosPush=registerPush;
  function schedule(){setTimeout(()=>registerPush(false),700);setTimeout(()=>registerPush(true),3500);setTimeout(()=>registerPush(true),12000);setTimeout(()=>registerNativePush(true),1600)}
  window.addEventListener('load',schedule,{once:true});
  window.addEventListener('focus',()=>registerPush(false));
  window.addEventListener('online',()=>registerPush(true));
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')registerPush(false)});
  document.addEventListener('click',event=>{const button=event.target?.closest?.('#mobileNotifyEnable,#mobileNotifyTest');if(button)setTimeout(()=>{registerPush(true);registerNativePush(true)},700)},true);
  try{firebase.auth().onAuthStateChanged(user=>{if(user&&!user.isAnonymous)setTimeout(()=>registerPush(true),500)});}catch(_){ }
})();
