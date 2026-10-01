import admin from 'firebase-admin';

const raw=process.env.FIREBASE_SERVICE_ACCOUNT||'';
if(!raw)throw new Error('FIREBASE_SERVICE_ACCOUNT ausente');
const service=JSON.parse(raw);
if(!admin.apps.length)admin.initializeApp({credential:admin.credential.cert(service)});
const db=admin.firestore(),FV=admin.firestore.FieldValue;

const clean=v=>String(v??'').trim();
const norm=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9@._+-]+/g,' ').replace(/\s+/g,' ').trim();
const mail=v=>clean(v).toLowerCase();
const num=v=>Math.max(0,Number(v||0)||0);
const active=v=>!['cancelled','canceled','cancelado','cancelada','expired','deleted','refunded'].includes(norm(v));
const identity=(name,email)=>{const e=mail(email),n=norm(name);return e&&n?`${e}|${n}`:''};
const participantKey=p=>identity(p?.full_name||p?.name,p?.email)||norm(p?.full_name||p?.name)||clean(p?.cpf);

function reservationIdentity(r){
  return identity(r?.responsible_name||r?.name,r?.email)||identity(r?.participants?.[0]?.full_name,r?.participants?.[0]?.email);
}
function saleIdentity(s){
  return identity(s?.customer_name||s?.responsible_name,s?.customer_email||s?.email)||identity(s?.participants?.[0]?.full_name,s?.participants?.[0]?.email);
}
function mergeParticipants(rows){
  const map=new Map();
  for(const row of rows){
    for(const p of (Array.isArray(row?.participants)?row.participants:[])){
      const key=participantKey(p);if(!key)continue;
      const old=map.get(key)||{};
      map.set(key,{...old,...p,full_name:clean(p?.full_name||p?.name)||old.full_name||'',email:mail(p?.email)||old.email||''});
    }
  }
  return [...map.values()];
}
function scoreSale(s){
  let x=0;
  if(num(s.paid_amount)>0)x+=100000+num(s.paid_amount);
  if(['paid','partial'].includes(norm(s.payment_status)))x+=50000;
  if(s.channel==='canva_reserva_passeios')x+=1000;
  if(Array.isArray(s.participants))x+=s.participants.length*10;
  return x;
}

const tripsSnap=await db.collection('trips').limit(500).get();
let mergedGroups=0,deletedSales=0,deletedReservations=0,recounted=0;

for(const tripDoc of tripsSnap.docs){
  const tripId=tripDoc.id;
  const [salesSnap,resSnap]=await Promise.all([
    db.collection('sales').where('trip_id','==',tripId).get(),
    tripDoc.ref.collection('reservations').get()
  ]);
  const sales=salesSnap.docs.map(d=>({id:d.id,ref:d.ref,...d.data()})).filter(s=>active(s.sale_status));
  const reservations=resSnap.docs.map(d=>({id:d.id,ref:d.ref,...d.data()})).filter(r=>active(r.status));
  const groups=new Map();
  for(const s of sales){
    const key=saleIdentity(s);if(!key)continue;
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(s);
  }

  for(const [key,dups] of groups.entries()){
    if(dups.length<2)continue;
    const ordered=[...dups].sort((a,b)=>scoreSale(b)-scoreSale(a));
    const keep=ordered[0],remove=ordered.slice(1);
    const related=reservations.filter(r=>[keep,...remove].some(s=>r.id===s.id||r.sale_id===s.id||reservationIdentity(r)===key));
    const participants=mergeParticipants([...dups,...related]);
    const seats=Math.max(1,participants.length||Math.max(...dups.map(x=>num(x.seats)||1)));
    const paid=Math.max(...dups.map(x=>num(x.paid_amount)),0);
    const refunded=Math.max(...dups.map(x=>num(x.refunded_amount)),0);
    const total=Math.max(...dups.map(x=>num(x.sale_total)),paid);
    const balance=Math.max(0,total-paid);
    const pstatus=balance<=0.009&&paid>0?'paid':paid>0?'partial':'pending';
    const method=(dups.find(x=>num(x.paid_amount)===paid&&clean(x.payment_method))||keep).payment_method||'a_confirmar';
    const sources=[...new Set(dups.flatMap(x=>Array.isArray(x.registration_sources)?x.registration_sources:[x.channel||x.source]).filter(Boolean))];
    const now=FV.serverTimestamp();

    await keep.ref.set({
      customer_name:keep.customer_name||keep.responsible_name||related[0]?.responsible_name||'',
      customer_email:keep.customer_email||keep.email||related[0]?.email||'',
      participants,seats,sale_total:total,paid_amount:paid,refunded_amount:refunded,balance_due:balance,
      payment_status:pstatus,payment_method:method,registration_status:'completed',registration_sources:sources,
      dedupe_key:key,deduped_at:now,updated_at:now
    },{merge:true});

    let keepReservation=related.find(r=>r.id===keep.id||r.sale_id===keep.id)||related[0]||null;
    if(keepReservation){
      await keepReservation.ref.set({
        sale_id:keep.id,responsible_name:keep.customer_name||keepReservation.responsible_name||'',
        email:keep.customer_email||keepReservation.email||'',participants,seats,sale_total:total,paid_amount:paid,
        refunded_amount:refunded,balance_due:balance,payment_status:pstatus,payment_method:method,
        registration_status:'completed',dedupe_key:key,deduped_at:now,updated_at:now
      },{merge:true});
    }

    for(const s of remove){await s.ref.delete();deletedSales++}
    for(const r of related){
      if(keepReservation&&r.id===keepReservation.id)continue;
      await r.ref.delete();deletedReservations++;
    }
    mergedGroups++;
  }

  const freshRes=await tripDoc.ref.collection('reservations').get();
  const seen=new Set();let clients=0;
  for(const d of freshRes.docs){
    const r=d.data()||{};if(!active(r.status))continue;
    const ps=Array.isArray(r.participants)&&r.participants.length?r.participants:[{full_name:r.responsible_name,email:r.email,cpf:r.responsible_cpf}];
    for(let i=0;i<ps.length;i++){
      const p=ps[i],k=participantKey(p)||`${d.id}:${i}`;
      if(seen.has(k))continue;seen.add(k);clients++;
    }
  }
  const t=tripDoc.data()||{},guide=t.special_seat_counted===false?0:1,total=num(t.total_spots),used=clients+guide,remaining=total>0?Math.max(0,total-used):num(t.remaining_spots);
  if(num(t.used_spots)!==used||num(t.remaining_spots)!==remaining){
    await tripDoc.ref.set({used_spots:used,remaining_spots:remaining,participant_count_unique:clients,participant_count_identity:'email+name',participant_count_reconciled_at:FV.serverTimestamp()},{merge:true});
    recounted++;
  }
}
console.log(`Deduplicacao concluida: grupos=${mergedGroups}, vendas removidas=${deletedSales}, reservas removidas=${deletedReservations}, passeios recontados=${recounted}`);
