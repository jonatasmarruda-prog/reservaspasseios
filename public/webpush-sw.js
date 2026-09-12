/* Trilheiros Gestão — service worker exclusivo para Web Push imediato */
const ICON='https://i.postimg.cc/JnF2F9Hw/LOGO-TRILHEIROS-Photoroom.png';

self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));

self.addEventListener('push',event=>{
  let data={};
  try{data=event.data?event.data.json():{}}catch(_){try{data={body:event.data?.text?.()||''}}catch(__){data={}}}
  const title=data.title||'🥾 Trilheiros Gestão';
  const options={
    body:data.body||'Há uma nova atualização no Trilheiros Gestão.',
    icon:data.icon||ICON,
    tag:data.tag||'trilheiros-immediate',
    renotify:true,
    timestamp:Number(data.timestamp||Date.now()),
    vibrate:[180,80,180],
    data:{url:data.url||'/admin'},
    actions:[{action:'open',title:'Abrir Gestão'}]
  };
  event.waitUntil(self.registration.showNotification(title,options));
});

self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const target=event.notification.data?.url||'/admin';
  event.waitUntil((async()=>{
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const client of windows){
      try{
        const wanted=new URL(target,self.location.origin);
        const current=new URL(client.url);
        if(current.origin===wanted.origin){
          await client.focus();
          if('navigate' in client&&current.href!==wanted.href)await client.navigate(wanted.href);
          return;
        }
      }catch(_){ }
    }
    if(self.clients.openWindow)return self.clients.openWindow(target);
  })());
});
