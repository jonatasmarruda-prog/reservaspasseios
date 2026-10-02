import admin from 'firebase-admin';
const raw=process.env.FIREBASE_SERVICE_ACCOUNT||'';if(!raw)throw new Error('FIREBASE_SERVICE_ACCOUNT ausente');
const service=JSON.parse(raw);if(!admin.apps.length)admin.initializeApp({credential:admin.credential.cert(service)});
const db=admin.firestore();
const num=v=>Math.max(0,Number(v||0)||0);
const active=v=>!['cancelled','canceled','cancelado','cancelada','deleted','refunded'].includes(String(v||'').toLowerCase());
const tripIds=['chapada_guimaraes','salto_nuvens'];
const sales=(await db.collection('sales').limit(5000).get()).docs.map(d=>({id:d.id,...d.data()}));
for(const id of tripIds){
  const ts=await db.collection('trips').doc(id).get();if(!ts.exists)continue;
  const t={id,...ts.data()},rs=(await ts.ref.collection('reservations').get()).docs.map(d=>({id:d.id,...d.data()})).filter(r=>active(r.status));
  const ss=sales.filter(s=>s.trip_id===id&&active(s.sale_status));
  const out={
    trip_id:id,status:t.status||'',date:t.trip_date||'',financial_locked:!!t.financial_locked,
    closure:t.financial_closure?{
      received:num(t.financial_closure.received),cost_actual:num(t.financial_closure.cost_actual),
      profit_actual:Number(t.financial_closure.profit_actual||0),margin_percent:Number(t.financial_closure.margin_percent||0)
    }:null,
    active_reservations:rs.length,reservation_seats:rs.reduce((a,r)=>a+num(r.seats),0),
    reservation_paid_sum:rs.reduce((a,r)=>a+num(r.paid_amount)-num(r.refunded_amount),0),
    active_sales:ss.length,sale_seats:ss.reduce((a,s)=>a+num(s.seats),0),
    sale_total_sum:ss.reduce((a,s)=>a+num(s.sale_total),0),
    sale_paid_sum:ss.reduce((a,s)=>a+num(s.paid_amount)-num(s.refunded_amount),0),
    orphan_reservations:rs.filter(r=>!ss.some(s=>s.id===(r.sale_id||r.id))).map(r=>({
      id:r.id,seats:num(r.seats),paid:num(r.paid_amount),total:num(r.sale_total),status:r.payment_status||'',source:r.source||r.registration_source||''
    }))
  };
  console.log(JSON.stringify(out,null,2));
}
