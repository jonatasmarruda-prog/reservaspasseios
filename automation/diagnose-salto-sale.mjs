import admin from 'firebase-admin';

const raw=process.env.FIREBASE_SERVICE_ACCOUNT||'';
if(!raw)throw new Error('FIREBASE_SERVICE_ACCOUNT ausente');
const service=JSON.parse(raw);
if(!admin.apps.length)admin.initializeApp({credential:admin.credential.cert(service)});
const db=admin.firestore();

const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const num=v=>Number(v||0)||0;
const stamp=v=>{try{if(!v)return'';if(typeof v.toDate==='function')return v.toDate().toISOString();if(v.seconds)return new Date(v.seconds*1000).toISOString();return new Date(v).toISOString()}catch{return''}};
const slimSale=s=>({
 id:s.id,
 source:s.source||'',
 sale_status:s.sale_status||'',
 payment_status:s.payment_status||'',
 registration_status:s.registration_status||'',
 seats:num(s.seats),
 sale_total:num(s.sale_total),
 paid_amount:num(s.paid_amount),
 refunded_amount:num(s.refunded_amount),
 balance_due:num(s.balance_due),
 cancel_reason:s.cancel_reason||'',
 created_at:stamp(s.created_at),
 updated_at:stamp(s.updated_at),
 cancelled_at:stamp(s.cancelled_at),
 payment_completed_at:stamp(s.payment_completed_at),
 last_payment_confirmed_at:stamp(s.last_payment_confirmed_at)
});
const slimRes=r=>({
 status:r.status||'',
 payment_status:r.payment_status||'',
 registration_status:r.registration_status||'',
 paid_amount:num(r.paid_amount),
 balance_due:num(r.balance_due),
 cancel_reason:r.cancel_reason||'',
 source:r.source||'',
 updated_at:stamp(r.updated_at)
});

const ts=await db.collection('trips').limit(400).get();
const trips=ts.docs.map(d=>({id:d.id,...d.data()})).filter(t=>norm(t.name).includes('salto das nuvens'));
console.log('TRIPS',JSON.stringify(trips.map(t=>({id:t.id,name:t.name,trip_date:t.trip_date,status:t.status}))));
for(const trip of trips){
 const ss=await db.collection('sales').where('trip_id','==',trip.id).get();
 const sales=ss.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.created_at?.seconds||0)-(a.created_at?.seconds||0));
 console.log('SALES',trip.id,JSON.stringify(sales.map(slimSale)));
 for(const s of sales){
   const rs=await db.collection('trips').doc(trip.id).collection('reservations').doc(s.id).get();
   if(rs.exists)console.log('RES',s.id,JSON.stringify(slimRes(rs.data())));
 }
 const ids=new Set(sales.map(s=>s.id));
 const audits=await db.collection('audit_logs').orderBy('created_at','desc').limit(500).get();
 const matched=audits.docs.map(d=>({id:d.id,...d.data()})).filter(a=>ids.has(a.entity_id)||norm(a.summary).includes('salto das nuvens'));
 console.log('AUDIT',JSON.stringify(matched.map(a=>({action:a.action||'',entity:a.entity||'',entity_id:a.entity_id||'',summary:a.summary||'',created_at:stamp(a.created_at),has_actor:!!a.user_uid}))));
}
