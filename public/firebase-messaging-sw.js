/* Trilheiros Gestão — Firebase Messaging em segundo plano */
importScripts('/__/firebase/10.14.1/firebase-app-compat.js');
importScripts('/__/firebase/10.14.1/firebase-messaging-compat.js');
importScripts('/__/firebase/init.js');

const ICON='https://i.postimg.cc/65Q2jp4c/LOGO-TRILHEIROS-Photoroom.png';
let messaging=null;
try{messaging=firebase.messaging()}catch(err){console.error('FCM_SW_INIT',err)}

if(messaging){
  messaging.onBackgroundMessage(payload=>{
    const data=payload?.data||{};
    const notification=payload?.notification||{};
    const title=data.title||notification.title||'🥾 Trilheiros Gestão';
    const options={
      body:data.body||notification.body||'Há uma nova atualização.',
      icon:data.icon||notification.icon||ICON,
      tag:data.tag||'trilheiros-background',
      renotify:true,
      vibrate:[180,80,180],
      data:{url:data.url||'/admin'}
    };
    return self.registration.showNotification(title,options);
  });
}

self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const target=event.notification?.data?.url||'/admin';
  event.waitUntil((async()=>{
    const list=await clients.matchAll({type:'window',includeUncontrolled:true});
    for(const client of list){
      if('focus'in client){await client.focus();try{if('navigate'in client)await client.navigate(target)}catch(_){}return}
    }
    if(clients.openWindow)return clients.openWindow(target);
  })());
});
