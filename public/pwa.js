/* Trilheiros Gestão — PWA, atualização e notificações personalizadas */
(function(){
  'use strict';
  const LOGO='https://i.postimg.cc/JnF2F9Hw/LOGO-TRILHEIROS-Photoroom.png';
  const NOTIFICATION_BADGE='/notification-badge.png?v=20260910-brand4';
  const NOTIF_KEY='trilheiros_admin_notifications_v6';
  let deferredPrompt=null,swRegistration=null,salesUnsub=null,salesBaseline=false,authBound=false,authBindTries=0;
  const saleState=new Map();

  const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v||0));
  const paymentLabel=v=>{
    const s=String(v||'').toLowerCase();
    if(s.includes('parcel')||s.includes('install'))return'PIX parcelado';
    if(s.includes('card')||s.includes('cart'))return'Cartão';
    if(s.includes('pix'))return'PIX';
    if(s.includes('cash')||s.includes('dinheiro'))return'Dinheiro';
    if(s.includes('transfer'))return'Transferência';
    return'Pagamento';
  };

  async function registerServiceWorker(){
    if(!('serviceWorker' in navigator))return null;
    try{
      swRegistration=await navigator.serviceWorker.register('/sw.js?v=20260910-notify-brand4',{updateViaCache:'none'});
      const update=()=>swRegistration?.update?.().catch(()=>{});
      if('requestIdleCallback' in window)requestIdleCallback(update,{timeout:2500});else setTimeout(update,1200);
      return swRegistration;
    }catch(err){console.warn('SW:',err);return null}
  }

  window.addEventListener('load',registerServiceWorker,{once:true});
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferredPrompt=event;window.dispatchEvent(new CustomEvent('trilheiros-install-ready'))});
  window.addEventListener('appinstalled',()=>{deferredPrompt=null});

  window.installTrilheirosApp=async function(){
    if(window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true)return'installed';
    if(!deferredPrompt)return'manual';
    deferredPrompt.prompt();const choice=await deferredPrompt.userChoice;deferredPrompt=null;return choice?.outcome||'dismissed';
  };
  window.isTrilheirosInstalled=()=>window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;

  async function syncAppBadge(count){
    try{
      if(count>0&&navigator.setAppBadge)await navigator.setAppBadge(count);
      else if(count<=0&&navigator.clearAppBadge)await navigator.clearAppBadge();
    }catch(_){ }
  }

  async function mobileNotify({title='🥾 Trilheiros Gestão',body='',url='/admin',tag='trilheiros-gestao',force=false}={}){
    if(!('Notification' in window)||Notification.permission!=='granted')return false;
    if(!force&&document.visibilityState==='visible')return false;
    const options={body,icon:LOGO,badge:NOTIFICATION_BADGE,tag,renotify:true,vibrate:[180,80,180],timestamp:Date.now(),data:{url},actions:[{action:'open',title:'Abrir Gestão'}]};
    try{
      const reg=swRegistration||await navigator.serviceWorker?.ready;
      if(reg?.showNotification){await reg.showNotification(title,options);return true}
      const notice=new Notification(title,options);notice.onclick=()=>{window.focus();location.href=url};return true;
    }catch(err){console.warn('Notificação:',err);return false}
  }
  window.trilheirosMobileNotify=mobileNotify;

  function saveHistory(){try{if(typeof state!=='undefined')localStorage.setItem(NOTIF_KEY,JSON.stringify((state.notifications||[]).slice(0,100)))}catch(_){ }}
  function refreshBadge(){
    try{
      if(typeof state==='undefined')return;
      const count=(state.notifications||[]).filter(x=>!x.read).length,a=document.getElementById('notifyCount'),b=document.getElementById('sideNotifyCount');
      if(a)a.textContent=count?String(count):'';if(b)b.textContent=count?`(${count})`:'';syncAppBadge(count);
    }catch(_){ }
  }
  function addHistory({key,title,body,type='info',data={}},showSystem=false){
    if(typeof state==='undefined')return;
    state.notifications=Array.isArray(state.notifications)?state.notifications:[];
    if(state.notifications.some(x=>x.key===key))return;
    state.notifications=[{id:(globalThis.crypto?.randomUUID?.()||String(Date.now()+Math.random())),key,title,body,type,data,read:false,created_at:new Date().toISOString()},...state.notifications].slice(0,100);
    saveHistory();refreshBadge();if(showSystem)mobileNotify({title,body,url:data.url||'/admin',tag:key}).catch(()=>{});
  }

  async function requestNotifications(){
    if(!('Notification' in window)){
      try{toast('Este navegador não oferece notificações do sistema.','error')}catch(_){alert('Este navegador não oferece notificações do sistema.')}
      return;
    }
    try{
      const permission=await Notification.requestPermission();
      if(permission==='granted'){
        addHistory({key:'notifications-enabled-v2',title:'🔔 Notificações ativadas',body:'O Trilheiros Gestão pode avisar novas reservas, cancelamentos e pagamentos.',type:'system',data:{url:'/admin?tab=notifications'}},false);
        await mobileNotify({title:'🥾 Trilheiros Gestão',body:'Notificações personalizadas ativadas neste celular.',url:'/admin?tab=notifications',tag:'trilheiros-test-enabled',force:true});
        try{toast('Notificações ativadas neste celular.')}catch(_){ }
      }else try{toast('Permissão de notificações não concedida.','error')}catch(_){ }
      window.renderNotifications?.();
    }catch(err){console.warn(err)}
  }

  async function testNotification(){
    if(!('Notification' in window)||Notification.permission!=='granted')return requestNotifications();
    await mobileNotify({title:'🥾 Teste — Trilheiros Gestão',body:'Tudo certo. Este celular está pronto para receber os alertas do sistema.',url:'/admin?tab=notifications',tag:'trilheiros-manual-test',force:true});
  }
  window.testAdminNotification=testNotification;

  function injectNotificationControls(){
    if(!location.pathname.startsWith('/admin'))return;
    const content=document.getElementById('content');if(!content||document.getElementById('mobileNotificationStatus'))return;
    const panel=content.querySelector('.panel');if(!panel)return;
    const permission=!('Notification' in window)?'indisponível':Notification.permission==='granted'?'ativada':Notification.permission==='denied'?'bloqueada':'não ativada';
    const installed=window.isTrilheirosInstalled?.()?'App instalado':'Navegador';
    const box=document.createElement('div');box.id='mobileNotificationStatus';box.style.cssText='margin:16px 20px;padding:15px 16px;border-radius:16px;background:#edf7f2;border:1px solid #cfe5da;display:flex;gap:14px;justify-content:space-between;align-items:center;flex-wrap:wrap';
    box.innerHTML=`<div><b style="display:block;color:#073226">📱 Alertas personalizados no celular</b><small style="display:block;margin-top:5px;color:#5f746b">Status: ${permission} • ${installed}. Alertas: novas reservas, cancelamentos e pagamentos atualizados.</small></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn ghost" id="mobileNotifyEnable">Ativar notificações</button><button class="btn primary" id="mobileNotifyTest">Testar agora</button></div>`;
    panel.querySelector('.panelHead')?.after(box);
    document.getElementById('mobileNotifyEnable')?.addEventListener('click',requestNotifications);
    document.getElementById('mobileNotifyTest')?.addEventListener('click',testNotification);
  }

  function enhanceNotificationScreen(){
    const old=window.renderNotifications;if(typeof old!=='function'||old.__mobileEnhanced)return;
    const wrapped=function(...args){const out=old.apply(this,args);setTimeout(injectNotificationControls,0);return out};
    wrapped.__mobileEnhanced=true;window.renderNotifications=wrapped;try{globalThis.renderNotifications=wrapped}catch(_){ }window.requestAdminNotifications=requestNotifications;
  }

  function saleSnapshotState(s){return{paid:Number(s?.paid_amount||0),status:String(s?.payment_status||''),cancelled:s?.sale_status==='cancelled'}}
  function beginSalesPaymentAlerts(){
    if(salesUnsub||!location.pathname.startsWith('/admin'))return;
    try{
      if(typeof db==='undefined'||typeof auth==='undefined'||!auth?.currentUser||auth.currentUser.isAnonymous)return;
      salesUnsub=db.collection('sales').orderBy('created_at','desc').limit(200).onSnapshot(snapshot=>{
        if(!salesBaseline){snapshot.docs.forEach(d=>saleState.set(d.id,saleSnapshotState(d.data())));salesBaseline=true;return}
        snapshot.docChanges().forEach(change=>{
          const id=change.doc.id,s=change.doc.data(),next=saleSnapshotState(s),prev=saleState.get(id)||{paid:0,status:'',cancelled:false};saleState.set(id,next);
          if(change.type!=='modified')return;
          const delta=Math.max(0,next.paid-prev.paid);
          if(delta>0.009){
            const balance=Math.max(0,Number(s.balance_due||0)),title=`💰 Pagamento confirmado — ${s.customer_name||'Cliente'}`,body=`${s.trip_name||'Passeio'} • ${paymentLabel(s.payment_method)} • ${money(delta)}${balance>0.009?` • saldo ${money(balance)}`:' • quitado'}`,key=`payment:${id}:${next.paid.toFixed(2)}`;
            addHistory({key,title,body,type:'payment',data:{sale_id:id,trip_id:s.trip_id||'',url:'/admin?tab=pending'}},document.visibilityState!=='visible');
          }
        });
      },err=>console.warn('Alertas de pagamento:',err));
    }catch(err){console.warn('Alertas de pagamento:',err)}
  }
  function stopSalesPaymentAlerts(){try{salesUnsub?.()}catch(_){ }salesUnsub=null;salesBaseline=false;saleState.clear()}

  function applyRequestedTab(){
    if(!location.pathname.startsWith('/admin')||typeof state==='undefined'||typeof renderAdmin!=='function')return;
    const tab=new URLSearchParams(location.search).get('tab'),allowed=['dashboard','trips','people','finance','day','reports','pending','communications','feedback','notifications','settings','audit','trash','salesV21','safetyV40','waitlistV40'];
    if(tab&&allowed.includes(tab)&&state.tab!==tab){state.tab=tab;renderAdmin()}
  }

  function bindAuthAlerts(){
    if(authBound)return;
    try{
      if(typeof auth!=='undefined'&&auth?.onAuthStateChanged){
        authBound=true;
        auth.onAuthStateChanged(user=>{
          if(user&&!user.isAnonymous)setTimeout(()=>{enhanceNotificationScreen();beginSalesPaymentAlerts();applyRequestedTab()},250);
          else stopSalesPaymentAlerts();
        });
        return;
      }
    }catch(_){ }
    if(authBindTries++<20)setTimeout(bindAuthAlerts,250+authBindTries*50);
  }

  window.addEventListener('load',()=>{
    enhanceNotificationScreen();bindAuthAlerts();
    setTimeout(()=>{enhanceNotificationScreen();applyRequestedTab();refreshBadge()},350);
  },{once:true});
})();
