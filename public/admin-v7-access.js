/* Ajuste de sincronização para perfil Apoio: sem carregar financeiro. */
(function(){
  const baseStart=window.startSync;
  if(typeof baseStart!=='function')return;
  window.startSync=function(){
    if(state.role!=='support')return baseStart();
    clearListeners();let tLoaded=false,rLoaded=false;
    state.expenses=[];state.commSettings={};
    const done=()=>{if(tLoaded&&rLoaded){state.sync=new Date();enrich();renderAdmin()}};
    unsubs.push(db.collection('trips').onSnapshot(s=>{state.trips=s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>String(a.trip_date).localeCompare(String(b.trip_date)));tLoaded=true;done()},e=>toast(e.message,'error')));
    unsubs.push(db.collectionGroup('reservations').onSnapshot(s=>{state.reservations=s.docs.map(d=>({id:d.id,trip_id:d.ref.parent.parent.id,...d.data()}));rLoaded=true;done()},e=>toast(e.message,'error')));
  };
  try{startSync=window.startSync}catch(_){ }
})();
