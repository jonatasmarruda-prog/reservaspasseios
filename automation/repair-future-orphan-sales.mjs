import admin from 'firebase-admin';

const raw=process.env.FIREBASE_SERVICE_ACCOUNT||'';
if(!raw)throw new Error('FIREBASE_SERVICE_ACCOUNT ausente');
const service=JSON.parse(raw);
if(!admin.apps.length)admin.initializeApp({credential:admin.credential.cert(service)});
const db=admin.firestore(),FV=admin.firestore.FieldValue;
const TZ='America/Cuiaba';
const clean=v=>String(v??'').trim(),norm=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9@._+-]+/g,' ').replace(/\s+/g,' ').trim(),mail=v=>clean(v).toLowerCase();
const num=v=>Math.max(0,Number(v||0)||0),active=v=>!['cancelled','canceled','cancelado','cancelada','deleted','refunded','inactive','inativo','inativa'].includes(norm(v));
const identity=(name,email)=>{const n=norm(name),e=mail(email);return n&&e?e+'|'+n:''};
const today=new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());

const allSales=(await db.collection('sales').limit(5000).get()).docs.map(d=>({id:d.id,...d.data()}));
const trips=(await db.collection('trips').limit(1000).get()).docs.map(d=>({id:d.id,ref:d.ref,...d.data()}));
let checked=0,repaired=0,identityConflicts=0;

for(const t of trips){
  if(!active(t.status)||String(t.trip_date||'').slice(0,10)<today)continue;
  const rs=await t.ref.collection('reservations').limit(3000).get();
  for(const d of rs.docs){
    const r={id:d.id,...d.data()};if(!active(r.status)||norm(r.registration_status)!=='completed')continue;
    checked++;
    const saleId=clean(r.sale_id)||d.id,saleRef=db.collection('sales').doc(saleId);
    if((await saleRef.get()).exists)continue;

    const key=identity(r.responsible_name||r.name||r.participants?.[0]?.full_name,r.email||r.participants?.[0]?.email);
    const sameIdentity=allSales.filter(s=>s.trip_id===t.id&&active(s.sale_status)&&identity(s.customer_name,s.customer_email)===key);
    if(sameIdentity.length){identityConflicts++;continue}

    const participants=Array.isArray(r.participants)&&r.participants.length?r.participants:[{full_name:r.responsible_name||r.name||'',cpf:r.responsible_cpf||'',email:r.email||''}];
    const seats=Math.max(1,Math.round(num(r.seats)||participants.length||1));
    const paid=num(r.paid_amount),refunded=num(r.refunded_amount);
    const total=num(r.sale_total)>0?num(r.sale_total):Math.max(paid,num(t.default_price)*seats);
    const balance=Number.isFinite(Number(r.balance_due))?Math.max(0,Number(r.balance_due)):Math.max(0,total-paid);
    const pstatus=clean(r.payment_status)||((balance<=0.009&&paid>0)?'paid':paid>0?'partial':'pending');
    const source=clean(r.source||r.registration_source)||'direct_trip_link';
    await saleRef.set({
      trip_id:t.id,trip_name:t.name||r.trip_name||'',trip_date:t.trip_date||r.trip_date||'',
      customer_name:r.responsible_name||r.name||participants[0]?.full_name||'',
      customer_cpf:r.responsible_cpf||participants[0]?.cpf||'',
      customer_email:r.email||participants[0]?.email||'',
      seats,participants,sale_total:total,paid_amount:paid,balance_due:balance,refunded_amount:refunded,
      payment_method:r.payment_method||'a_confirmar',payment_status:pstatus,
      installment_total:Math.max(1,Math.round(num(r.installment_total)||1)),next_due_date:r.next_due_date||'',
      payment_history:Array.isArray(r.payment_history)?r.payment_history:[],received_date:r.received_date||'',
      registration_status:'completed',sale_status:'active',claimed_uid:r.claimed_uid||saleId,
      protocol:r.protocol||'',category:r.category||'',accommodation:r.accommodation||'',
      registration_sources:[source],notes:'Venda reconstruída automaticamente a partir de cadastro ativo que estava sem vínculo financeiro.',
      source:source.includes('public_portal')?'public_portal_v27':source,channel:r.channel||source,
      payment_trigger:r.payment_trigger||'repair_future_orphan',
      welcome_email_status:paid>0?'suppressed_recovered_legacy':'pending',
      recovered_from_orphan_reservation:true,recovered_from_reservation_id:d.id,recovered_at:FV.serverTimestamp(),
      created_at:r.created_at||FV.serverTimestamp(),updated_at:FV.serverTimestamp()
    },{merge:false});
    await d.ref.set({sale_id:saleId,orphan_sale_repaired_at:FV.serverTimestamp(),updated_at:FV.serverTimestamp()},{merge:true});
    repaired++;
  }
}
console.log(`Reparo futuro: cadastros conferidos=${checked}, vendas reconstruídas=${repaired}, conflitos de identidade ignorados=${identityConflicts}`);
