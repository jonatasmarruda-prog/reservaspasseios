/* Garante a sincronização do WhatsApp público depois que o Firebase/Auth terminar de iniciar. */
(function(){
  async function mirror(){
    try{
      if(!location.pathname.startsWith('/admin')||!window.firebase?.apps?.length||!auth?.currentUser||!db)return;
      const s=await db.collection('settings').doc('general').get();
      if(!s.exists)return;
      const g=s.data();
      await db.collection('settings').doc('public').set({business_name:g.business_name||'Trilheiros de Rondonópolis',whatsapp:g.whatsapp||'',updated_at:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});
    }catch(_){ }
  }
  window.addEventListener('load',()=>setTimeout(mirror,1800));
  document.addEventListener('submit',e=>{if(e.target?.id==='generalSettings')setTimeout(mirror,1200)},true);
})();
