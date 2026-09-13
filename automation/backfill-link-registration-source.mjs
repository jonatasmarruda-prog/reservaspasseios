import admin from 'firebase-admin';

const raw=process.env.FIREBASE_SERVICE_ACCOUNT||'';
if(!raw){console.error('FIREBASE_SERVICE_ACCOUNT ausente.');process.exit(1)}
let service;try{service=JSON.parse(raw)}catch{console.error('FIREBASE_SERVICE_ACCOUNT inválido.');process.exit(1)}
if(!admin.apps.length)admin.initializeApp({credential:admin.credential.cert(service)});
const db=admin.firestore();
const FV=admin.firestore.FieldValue;
const norm=v=>String(v??'').trim().toLowerCase();
const isPaid=r=>{
  const status=norm(r?.payment_status);
  const total=Math.max(0,Number(r?.sale_total||0)||0),paid=Math.max(0,Number(r?.paid_amount||0)||0),balance=Math.max(0,Number.isFinite(Number(r?.balance_due))?Number(r.balance_due):total-paid);
  return balance<=0.009&&(['paid','confirmed','approved','completed','pago','quitado'].includes(status)||(total>0&&paid>=total-0.009));
};

let updated=0,scanned=0;
const trips=await db.collection('trips').limit(300).get();
for(const tripDoc of trips.docs){
  const reservations=await tripDoc.ref.collection('reservations').limit(1000).get();
  const batch=db.batch();
  let batchCount=0;
  for(const doc of reservations.docs){
    scanned++;
    const r=doc.data()||{};
    const source=norm(r.source),registrationSource=norm(r.registration_source),completed=norm(r.registration_status)==='completed';
    const fromLink=source.includes('public_portal')||registrationSource==='direct_trip_link';
    if(!completed||!fromLink||isPaid(r))continue;
    const patch={registration_source:'direct_trip_link',updated_at:FV.serverTimestamp()};
    if(!r.registration_completed_at)patch.registration_completed_at=r.created_at||r.updated_at||FV.serverTimestamp();
    batch.set(doc.ref,patch,{merge:true});batchCount++;updated++;
    if(batchCount>=400){await batch.commit();batchCount=0}
  }
  if(batchCount>0)await batch.commit();
}
console.log(`Backfill de inscrições pelo link: ${scanned} lida(s), ${updated} marcada(s) para confirmação por e-mail.`);
