import admin from 'firebase-admin';

const raw=process.env.FIREBASE_SERVICE_ACCOUNT||'';
if(!raw)throw new Error('FIREBASE_SERVICE_ACCOUNT ausente');
const service=JSON.parse(raw);
if(!admin.apps.length)admin.initializeApp({credential:admin.credential.cert(service)});
const db=admin.firestore(),FV=admin.firestore.FieldValue;
const HOUR=60*60*1000,LOOKBACK=72*HOUR;
const now=Date.now();
const clean=v=>String(v??'').trim();
const num=v=>Math.max(0,Number(v||0)||0);
const stampMs=v=>{try{if(!v)return 0;if(typeof v.toMillis==='function')return v.toMillis();if(v.seconds)return Number(v.seconds)*1000;const d=new Date(v);return Number.isNaN(d.getTime())?0:d.getTime()}catch{return 0}};
const active=v=>!['cancelled','canceled','cancelado','cancelada','deleted','refunded'].includes(clean(v).toLowerCase());

const trips=await db.collection('trips').limit(500).get();
let checked=0,repaired=0,skippedOld=0;
for(const tripDoc of trips.docs){
  const t=tripDoc.data()||{};
  if(!active(t.status)||String(t.status||'').toLowerCase()==='completed')continue;
  const rs=await tripDoc.ref.collection('reservations').limit(1000).get();
  for(const doc of rs.docs){
    const r=doc.data()||{};
    if(!active(r.status))continue;
    const when=Math.max(stampMs(r.created_at),stampMs(r.registration_completed_at),stampMs(r.updated_at));
    if(when&&now-when>LOOKBACK){skippedOld++;continue}
    checked++;
    const saleId=clean(r.sale_id)||doc.id;
    const saleRef=db.collection('sales').doc(saleId),saleSnap=await saleRef.get();
    if(saleSnap.exists)continue;
    const seats=Math.max(1,Math.round(num(r.seats)||1));
    const total=num(r.sale_total)||num(t.default_price)*seats;
    const paid=num(r.paid_amount),refunded=num(r.refunded_amount),balance=Math.max(0,Number.isFinite(Number(r.balance_due))?Number(r.balance_due):total-paid);
    const pstatus=balance<=0.009&&paid>0?'paid':paid>0?'partial':'pending';
    const customerName=clean(r.responsible_name||r.name||r.participants?.[0]?.full_name)||'Participante';
    const customerEmail=clean(r.email||r.participants?.[0]?.email).toLowerCase();
    await saleRef.set({
      trip_id:tripDoc.id,trip_name:clean(r.trip_name||t.name),trip_date:r.trip_date||t.trip_date||'',
      customer_name:customerName,customer_cpf:clean(r.responsible_cpf||r.participants?.[0]?.cpf),
      customer_email:customerEmail,seats,sale_total:total,paid_amount:paid,balance_due:balance,refunded_amount:refunded,
      payment_method:r.payment_method||'a_confirmar',payment_status:pstatus,installment_total:Math.max(1,Math.round(num(r.installment_total)||1)),
      next_due_date:r.next_due_date||'',payment_history:Array.isArray(r.payment_history)?r.payment_history:[],received_date:r.received_date||'',
      registration_status:r.registration_status||'completed',sale_status:'active',claimed_uid:r.claimed_uid||doc.id,
      protocol:r.protocol||'',category:r.category||'',participants:Array.isArray(r.participants)?r.participants:[],
      notes:'Pendência reconstruída automaticamente a partir de reserva existente sem venda vinculada.',
      source:String(r.source||'').includes('public_portal')?'public_portal_v27':'public_portal_v27',
      channel:r.channel||'canva_reserva_passeios',payment_trigger:r.payment_trigger||'repair_orphan',
      recovered_from_orphan_reservation:true,recovered_at:FV.serverTimestamp(),
      created_at:r.created_at||FV.serverTimestamp(),updated_at:FV.serverTimestamp()
    });
    if(!r.sale_id)await doc.ref.set({sale_id:saleId,updated_at:FV.serverTimestamp()},{merge:true});
    repaired++;
  }
}
console.log(`Recuperacao de pendencias: recentes conferidas=${checked}, pendencias reconstruidas=${repaired}, antigas ignoradas=${skippedOld}`);
