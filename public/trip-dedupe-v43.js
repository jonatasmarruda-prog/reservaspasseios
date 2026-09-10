/* Trilheiros Gestão V43 — consolidação segura de passeios duplicados */
(function(){
'use strict';
if(typeof state==='undefined')return;

const OWNER='trilheiros.roomt@gmail.com';
const GUIDE='Jonatas Marques de Arruda';
const GUIDE_ROLE='GUIA DE TURISMO';
const TEMPLATES=[
  {id:'chapada_guimaraes',date:'2026-09-26',name:'Chapada dos Guimarães',aliases:['chapada','chapada dos guimaraes','chapada dos guimaraes mt']},
  {id:'salto_nuvens',date:'2026-10-10',name:'Salto das Nuvens',aliases:['salto das nuvens','saltos das nuvens']},
  {id:'nobres_bom_jardim',date:'2026-10-24',name:'Nobres – Bom Jardim',aliases:['nobres','bom jardim','nobres bom jardim']},
  {id:'rio_cristalino',date:'2026-11-08',name:'Rio Cristalino + Aldeia Dom Bosco',aliases:['rio cristalino','aldeia dom bosco','rio cristalino aldeia dom bosco']},
  {id:'jaciara_canyon',date:'2026-11-15',name:'Jaciara – Cânion das Índias',aliases:['canion das indias','canyon das indias','jaciara canion das indias']}
];
const q=(s,r=document)=>r.querySelector(s);
const n=v=>Math.max(0,Number(v||0)||0);
function norm(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim()}
function day(v){return String(v||'').slice(0,10)}
function notify(msg,type=''){try{return typeof toast==='function'?toast(msg,type):alert(msg)}catch(_){alert(msg)}}
function currentRole(){return state?.role||''}
function canManage(){return ['owner','admin'].includes(currentRole())}
function templateForData(x){
  const d=day(x?.trip_date||x?.date),text=norm(`${x?.name||''} ${x?.destination||''} ${x?.portal_template_id||''}`);
  return TEMPLATES.find(t=>d===t.date&&(x?.id===t.id||x?.portal_template_id===t.id||t.aliases.some(a=>text.includes(norm(a)))))||null;
}
function score(x){
  let s=0;
  if(!String(x?.source||'').includes('public_portal'))s+=60;
  if(Array.isArray(x?.cost_items)&&x.cost_items.length)s+=100+x.cost_items.length*5;
  ['destination','departure_time','return_time','return_info','departure_point','whatsapp_group_url','what_to_bring','cancellation_policy'].forEach(k=>{if(String(x?.[k]||'').trim())s+=8});
  if(n(x?.total_spots)>0)s+=5;
  if(n(x?.default_price)>0)s+=5;
  return s;
}
function meaningful(v){return !(v===undefined||v===null||v===''||(Array.isArray(v)&&v.length===0))}
function sameBusinessTrip(a,b){
  if(day(a?.trip_date)!==day(b?.trip_date))return false;
  const ta=templateForData(a),tb=templateForData(b);
  if(ta&&tb)return ta.id===tb.id;
  const an=norm(a?.name),bn=norm(b?.name);
  return !!an&&an===bn;
}
async function commitOps(ops){
  let i=0;
  while(i<ops.length){
    const batch=db.batch();
    const chunk=ops.slice(i,i+350);
    chunk.forEach(op=>{
      if(op.kind==='set')batch.set(op.ref,op.data,{merge:op.merge!==false});
      else if(op.kind==='update')batch.update(op.ref,op.data);
      else if(op.kind==='delete')batch.delete(op.ref);
    });
    await batch.commit();
    i+=chunk.length;
  }
}
async function moveSubcollection(sourceId,targetId,name){
  const src=db.collection('trips').doc(sourceId).collection(name),dst=db.collection('trips').doc(targetId).collection(name),snap=await src.get();
  if(snap.empty)return 0;
  const ops=[];
  snap.docs.forEach(d=>{
    const data={...d.data()};
    if(name==='reservations')data.trip_id=targetId;
    ops.push({kind:'set',ref:dst.doc(d.id),data,merge:true});
    ops.push({kind:'delete',ref:d.ref});
  });
  await commitOps(ops);
  return snap.size;
}
async function repointTopLevel(collection,sourceId,targetId,tpl){
  const snap=await db.collection(collection).where('trip_id','==',sourceId).get();
  if(snap.empty)return 0;
  const ops=snap.docs.map(d=>({kind:'update',ref:d.ref,data:{trip_id:targetId,trip_name:tpl.name,trip_date:tpl.date,updated_at:firebase.firestore.FieldValue.serverTimestamp()}}));
  await commitOps(ops);
  return snap.size;
}
async function consolidateTemplate(tpl,allDocs){
  const candidates=allDocs.filter(x=>templateForData(x)?.id===tpl.id);
  if(candidates.length<2)return null;
  const canonicalRef=db.collection('trips').doc(tpl.id),canonical=candidates.find(x=>x.id===tpl.id)||null;
  const ordered=[...candidates].sort((a,b)=>score(a)-score(b));
  const preferred=ordered[ordered.length-1];
  const merged={};
  ordered.forEach(x=>Object.entries(x).forEach(([k,v])=>{if(k!=='id'&&meaningful(v))merged[k]=v}));
  const bestCosts=candidates.filter(x=>Array.isArray(x.cost_items)).sort((a,b)=>(a.cost_items?.length||0)-(b.cost_items?.length||0)).pop();
  if(bestCosts?.cost_items?.length)merged.cost_items=bestCosts.cost_items;
  const total=Math.max(1,...candidates.map(x=>n(x.total_spots)));
  Object.assign(merged,{
    name:tpl.name,
    trip_date:tpl.date,
    total_spots:total,
    portal_template_id:tpl.id,
    special_seat_reserved:true,
    special_seat_counted:true,
    special_seat_count:1,
    special_passenger_name:GUIDE,
    special_passenger_role:GUIDE_ROLE,
    dedupe_version:'v43',
    consolidated_at:firebase.firestore.FieldValue.serverTimestamp(),
    consolidated_from:candidates.filter(x=>x.id!==tpl.id).map(x=>x.id),
    source:String(preferred?.source||'admin').includes('public_portal')?'admin_consolidated_v43':(preferred?.source||'admin_consolidated_v43')
  });
  delete merged.id;
  delete merged.used_spots;
  delete merged.remaining_spots;
  await canonicalRef.set(merged,{merge:true});

  let movedReservations=0;
  for(const dup of candidates.filter(x=>x.id!==tpl.id)){
    movedReservations+=await moveSubcollection(dup.id,tpl.id,'reservations');
    await moveSubcollection(dup.id,tpl.id,'operations');
    await moveSubcollection(dup.id,tpl.id,'feedback');
    await repointTopLevel('sales',dup.id,tpl.id,tpl);
    await repointTopLevel('expenses',dup.id,tpl.id,tpl);
    await db.collection('trips').doc(dup.id).delete();
  }
  await repointTopLevel('sales',tpl.id,tpl.id,tpl);
  await repointTopLevel('expenses',tpl.id,tpl.id,tpl);

  const rs=await canonicalRef.collection('reservations').get();
  const occupied=rs.docs.map(d=>d.data()).filter(r=>!['cancelled','refunded','deleted'].includes(String(r.status||'active').toLowerCase())).reduce((s,r)=>s+n(r.seats),0);
  const used=1+occupied,finalTotal=Math.max(total,used);
  await canonicalRef.set({
    name:tpl.name,
    trip_date:tpl.date,
    total_spots:finalTotal,
    used_spots:used,
    remaining_spots:Math.max(0,finalTotal-used),
    status:merged.status==='cancelled'?'cancelled':'open',
    portal_template_id:tpl.id,
    special_seat_reserved:true,
    special_seat_counted:true,
    special_seat_count:1,
    special_passenger_name:GUIDE,
    special_passenger_role:GUIDE_ROLE,
    updated_at:firebase.firestore.FieldValue.serverTimestamp()
  },{merge:true});
  return{tpl,duplicates:candidates.length-1,movedReservations,canonicalHadDoc:!!canonical};
}

let running=false;
window.consolidateDuplicateTripsV43=async function(){
  if(running||!location.pathname.startsWith('/admin')||!canManage())return[];
  running=true;
  try{
    const snap=await db.collection('trips').get(),docs=snap.docs.map(d=>({id:d.id,...d.data()})),results=[];
    for(const tpl of TEMPLATES){const r=await consolidateTemplate(tpl,docs);if(r)results.push(r)}
    if(results.length){
      console.info('V43_DEDUPE_OK',results);
      notify(`Passeios duplicados consolidados: ${results.reduce((s,x)=>s+x.duplicates,0)}. Reservas, vendas e despesas foram reunidas no passeio correto.`,'success');
      setTimeout(()=>location.reload(),1400);
    }
    return results;
  }catch(e){console.error('V43_DEDUPE_ERROR',e);notify('Não foi possível consolidar os passeios duplicados. Veja o console para o diagnóstico.','error');return[]}
  finally{running=false}
};

/* Impede criar novamente um passeio que já existe na mesma data. */
document.addEventListener('submit',e=>{
  const form=e.target;
  if(!(form instanceof HTMLFormElement)||form.id!=='tripFormV36')return;
  const eyebrow=form.querySelector('.eyebrow')?.textContent||form.closest('.modal')?.querySelector('.eyebrow')?.textContent||'';
  if(/EDITAR/i.test(eyebrow))return;
  const name=form.elements?.name?.value?.trim()||'',date=form.elements?.tripDate?.value||'';
  const probe={name,trip_date:date};
  const existing=(state.trips||[]).find(t=>sameBusinessTrip(t,probe));
  if(existing){
    e.preventDefault();e.stopImmediatePropagation();
    notify(`Este passeio já está cadastrado em ${date.split('-').reverse().join('/')}. Abra o passeio existente e edite nele.`,'error');
    setTimeout(()=>{document.getElementById('modal')?.remove();if(typeof window.openTripV7==='function')window.openTripV7(existing.id)},250);
  }
},true);

async function boot(){
  if(!location.pathname.startsWith('/admin'))return;
  for(let i=0;i<100;i++){
    try{if(typeof db!=='undefined'&&db&&typeof auth!=='undefined'&&auth?.currentUser&&canManage())break}catch(_){ }
    await new Promise(r=>setTimeout(r,100));
  }
  if(!canManage())return;
  await window.consolidateDuplicateTripsV43();
}
window.addEventListener('load',()=>setTimeout(boot,900));
setTimeout(boot,1800);
})();