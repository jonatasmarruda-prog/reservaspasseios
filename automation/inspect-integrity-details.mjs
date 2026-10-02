import admin from 'firebase-admin';
const raw=process.env.FIREBASE_SERVICE_ACCOUNT||'';if(!raw)throw new Error('FIREBASE_SERVICE_ACCOUNT ausente');
const service=JSON.parse(raw);if(!admin.apps.length)admin.initializeApp({credential:admin.credential.cert(service)});
const db=admin.firestore();
const clean=v=>String(v??'').trim(),norm=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9@._+-]+/g,' ').replace(/\s+/g,' ').trim(),mail=v=>clean(v).toLowerCase();
const active=v=>!['cancelled','canceled','cancelado','cancelada','deleted','refunded','inactive','inativo','inativa'].includes(norm(v));
const identity=(name,email)=>{const n=norm(name),e=mail(email);return n&&e?e+'|'+n:''};

const tripIds=['chapada_guimaraes','salto_nuvens','jaciara_canyon','nobres_bom_jardim','rio_cristalino'];
const allSales=(await db.collection('sales').limit(5000).get()).docs.map(d=>({id:d.id,...d.data()}));
const out=[];
for(const tripId of tripIds){
  const tr=await db.collection('trips').doc(tripId).get();if(!tr.exists)continue;
  const t=tr.data()||{},rs=await tr.ref.collection('reservations').get();
  for(const d of rs.docs){
    const r={id:d.id,...d.data()};if(!active(r.status))continue;
    const sid=clean(r.sale_id)||d.id;
    const byId=allSales.find(s=>s.id===sid&&active(s.sale_status));
    if(byId)continue;
    const key=identity(r.responsible_name||r.name||r.participants?.[0]?.full_name,r.email||r.participants?.[0]?.email);
    const matches=allSales.filter(s=>s.trip_id===tripId&&active(s.sale_status)&&identity(s.customer_name,s.customer_email)===key);
    out.push({
      trip_id:tripId,trip_status:t.status||'',trip_date:t.trip_date||'',
      reservation_id:d.id,sale_id:sid,source:r.source||'',registration_source:r.registration_source||'',channel:r.channel||'',
      registration_status:r.registration_status||'',payment_status:r.payment_status||'',payment_method:r.payment_method||'',
      seats:Number(r.seats||0),sale_total:Number(r.sale_total||0),paid_amount:Number(r.paid_amount||0),balance_due:Number(r.balance_due||0),
      created_at:r.created_at?.toDate?.()?.toISOString?.()||String(r.created_at||''),
      has_identity_match_sale:matches.length>0,identity_match_sale_ids:matches.map(x=>x.id)
    });
  }
}
console.log(JSON.stringify(out,null,2));
