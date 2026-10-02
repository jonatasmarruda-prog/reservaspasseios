import admin from 'firebase-admin';

const raw=process.env.FIREBASE_SERVICE_ACCOUNT||'';
if(!raw)throw new Error('FIREBASE_SERVICE_ACCOUNT ausente');
const service=JSON.parse(raw);
if(!admin.apps.length)admin.initializeApp({credential:admin.credential.cert(service)});
const db=admin.firestore();
const FV=admin.firestore.FieldValue;

const clean=v=>String(v??'').trim();
const num=v=>Math.max(0,Number(v||0)||0);
const norm=v=>clean(v).toLowerCase();
const active=v=>!['cancelled','canceled','cancelado','cancelada','deleted','refunded'].includes(norm(v));

let scanned=0,repaired=0,skipped=0;
const trips=await db.collection('trips').limit(500).get();

for(const tripDoc of trips.docs){
  const trip={id:tripDoc.id,...tripDoc.data()};
  const rs=await tripDoc.ref.collection('reservations').limit(1000).get();
  for(const doc of rs.docs){
    const r={id:doc.id,...doc.data()};
    scanned++;
    const isPortal=String(r.source||r.registration_source||'').includes('public_portal')||r.channel==='canva_reserva_passeios';
    if(!isPortal||!active(r.status)){skipped++;continue}
    const saleId=clean(r.sale_id)||doc.id;
    const saleRef=db.collection('sales').doc(saleId);
    const saleSnap=await saleRef.get();
    if(saleSnap.exists){skipped++;continue}

    const total=num(r.sale_total);
    const paid=num(r.paid_amount);
    const refunded=num(r.refunded_amount);
    const balance=Number.isFinite(Number(r.balance_due))?num(r.balance_due):Math.max(0,total-paid);
    const pstatus=clean(r.payment_status)||((balance<=0.009&&paid>0)?'paid':paid>0?'partial':'pending');
    const participants=Array.isArray(r.participants)&&r.participants.length?r.participants:[{
      full_name:r.responsible_name||r.name||'',
      cpf:r.responsible_cpf||'',
      email:r.email||''
    }];

    await saleRef.set({
      trip_id:tripDoc.id,
      trip_name:trip.name||r.trip_name||'',
      trip_date:trip.trip_date||r.trip_date||'',
      customer_name:r.responsible_name||r.name||participants[0]?.full_name||'',
      customer_cpf:r.responsible_cpf||participants[0]?.cpf||'',
      customer_email:r.email||participants[0]?.email||'',
      seats:Math.max(1,Number(r.seats||participants.length||1)),
      sale_total:total,
      paid_amount:paid,
      balance_due:balance,
      refunded_amount:refunded,
      payment_method:r.payment_method||'a_confirmar',
      payment_status:pstatus,
      installment_total:Math.max(1,Number(r.installment_total||1)),
      next_due_date:r.next_due_date||'',
      payment_history:Array.isArray(r.payment_history)?r.payment_history:[],
      received_date:r.received_date||'',
      registration_status:r.registration_status||'completed',
      sale_status:'active',
      claimed_uid:r.claimed_uid||saleId,
      protocol:r.protocol||'',
      category:r.category||'',
      accommodation:r.accommodation||'',
      participants,
      notes:'Venda reconstruída automaticamente a partir de uma reserva do portal que estava sem pendência vinculada.',
      source:'public_portal_v27',
      channel:'canva_reserva_passeios',
      payment_trigger:r.payment_trigger||'recovered_orphan_reservation',
      payment_started_at:r.payment_started_at||r.created_at||FV.serverTimestamp(),
      recovered_from_reservation:true,
      recovered_from_reservation_id:doc.id,
      created_at:r.created_at||FV.serverTimestamp(),
      updated_at:FV.serverTimestamp()
    },{merge:false});

    await doc.ref.set({sale_id:saleId,orphan_sale_repaired_at:FV.serverTimestamp(),updated_at:FV.serverTimestamp()},{merge:true});
    repaired++;
  }
}

console.log(`Reconciliação de pendências órfãs concluída: reservas lidas=${scanned}, vendas reconstruídas=${repaired}, ignoradas=${skipped}.`);
