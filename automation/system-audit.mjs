import admin from 'firebase-admin';
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const clean=v=>String(v??'').trim();
const norm=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9@._+-]+/g,' ').replace(/\s+/g,' ').trim();
const mail=v=>clean(v).toLowerCase();
const num=v=>Number(v||0)||0;
const active=v=>!['cancelled','canceled','cancelado','cancelada','deleted','refunded','inactive','inativo','inativa'].includes(norm(v));
const ident=(name,email)=>{const n=norm(name),e=mail(email);return n&&e?`${e}|${n}`:''};
const personKey=(p,fallback='')=>ident(p?.full_name||p?.name,p?.email)||clean(p?.cpf).replace(/\D/g,'')||fallback;
const issues=[];
const note=(severity,code,details={})=>issues.push({severity,code,...details});

function staticAudit(){
  const index=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
  const refs=[...index.matchAll(/(?:src|href)=["']([^"'?#]+)(?:[?#][^"']*)?["']/g)].map(x=>x[1]).filter(x=>x.startsWith('/'));
  for(const ref of refs){
    if(ref.startsWith('/__/'))continue;
    const file=path.join(root,'public',ref.replace(/^\//,''));
    if(!fs.existsSync(file))note('error','missing_public_asset',{ref});
  }
  const firebase=JSON.parse(fs.readFileSync(path.join(root,'firebase.json'),'utf8'));
  const rules=firebase?.firestore?.rules||'';
  if(!rules||!fs.existsSync(path.join(root,rules)))note('error','missing_configured_firestore_rules',{rules});
  const scripts=[...index.matchAll(/<script[^>]+src=["']([^"']+)["'][^>]*>/g)].map(x=>x[1].split('?')[0]);
  const duplicates=scripts.filter((v,i,a)=>a.indexOf(v)!==i);
  if(duplicates.length)note('warn','duplicate_script_reference',{count:new Set(duplicates).size});
  const legacy=scripts.filter(x=>/admin-v6|sales-flow-v21|registration-expiry-v23|premium-capacity-v24|admin-fix/.test(x));
  if(legacy.length)note('info','legacy_layers_loaded',{count:legacy.length,files:legacy});
}

staticAudit();

const raw=process.env.FIREBASE_SERVICE_ACCOUNT||'';
if(!raw){
  console.log(JSON.stringify({ok:false,reason:'FIREBASE_SERVICE_ACCOUNT ausente',static_issues:issues},null,2));
  process.exit(2);
}
const service=JSON.parse(raw);
if(!admin.apps.length)admin.initializeApp({credential:admin.credential.cert(service)});
const db=admin.firestore();

const [tripsSnap,salesSnap]=await Promise.all([
  db.collection('trips').limit(1000).get(),
  db.collection('sales').limit(5000).get()
]);
const trips=tripsSnap.docs.map(d=>({id:d.id,ref:d.ref,...d.data()}));
const sales=salesSnap.docs.map(d=>({id:d.id,ref:d.ref,...d.data()}));
const tripMap=new Map(trips.map(t=>[t.id,t]));
const reservations=[];
for(const t of trips){
  const rs=await t.ref.collection('reservations').limit(3000).get();
  for(const d of rs.docs)reservations.push({id:d.id,ref:d.ref,trip_id:t.id,...d.data()});
}

const resBySale=new Map();
for(const r of reservations){
  const sid=clean(r.sale_id)||r.id;
  if(!resBySale.has(sid))resBySale.set(sid,[]);
  resBySale.get(sid).push(r);
}

for(const s of sales){
  if(!active(s.sale_status))continue;
  if(!tripMap.has(s.trip_id))note('error','sale_missing_trip',{sale_id:s.id,trip_id:s.trip_id||''});
  const total=Math.max(0,num(s.sale_total)),paid=Math.max(0,num(s.paid_amount)),refunded=Math.max(0,num(s.refunded_amount));
  const balance=Number.isFinite(Number(s.balance_due))?Math.max(0,Number(s.balance_due)):Math.max(0,total-paid);
  const status=norm(s.payment_status);
  if(total>0&&paid-total>0.01)note('error','sale_paid_above_total',{sale_id:s.id,trip_id:s.trip_id||''});
  if(refunded-paid>0.01)note('warn','sale_refund_above_paid',{sale_id:s.id,trip_id:s.trip_id||''});
  if(status==='paid'&&balance>0.01)note('error','sale_paid_with_balance',{sale_id:s.id,trip_id:s.trip_id||''});
  if(status==='pending'&&paid>0.01)note('warn','sale_pending_with_paid_amount',{sale_id:s.id,trip_id:s.trip_id||''});
  if(!mail(s.customer_email)&&!(Array.isArray(s.participants)&&s.participants.some(p=>mail(p?.email))))note('warn','sale_missing_email',{sale_id:s.id,trip_id:s.trip_id||''});
  if(!resBySale.get(s.id)?.some(r=>active(r.status)))note('warn','active_sale_without_active_reservation',{sale_id:s.id,trip_id:s.trip_id||''});
}

for(const r of reservations){
  if(!active(r.status))continue;
  if(!tripMap.has(r.trip_id))note('error','reservation_missing_trip',{reservation_id:r.id,trip_id:r.trip_id||''});
  const ps=Array.isArray(r.participants)?r.participants:[];
  const seats=Math.max(1,Math.round(num(r.seats)||1));
  if(ps.length&&ps.length!==seats)note('error','reservation_seats_participants_mismatch',{reservation_id:r.id,trip_id:r.trip_id,seats,participants:ps.length});
  if(!mail(r.email)&&!ps.some(p=>mail(p?.email)))note('warn','reservation_missing_email',{reservation_id:r.id,trip_id:r.trip_id});
  const source=String(r.source||r.registration_source||'');
  if((source.includes('public_portal')||source.includes('direct_trip_link'))){
    const sid=clean(r.sale_id)||r.id;
    if(!sales.some(s=>s.id===sid&&active(s.sale_status)))note('error','active_registration_without_active_sale',{reservation_id:r.id,trip_id:r.trip_id,sale_id:sid});
  }
}

for(const t of trips){
  if(!active(t.status))continue;
  const rs=reservations.filter(r=>r.trip_id===t.id&&active(r.status));
  const seen=new Set();let unique=0;
  const duplicateKeys=[];
  for(const r of rs){
    const ps=Array.isArray(r.participants)&&r.participants.length?r.participants:[{full_name:r.responsible_name||r.name,email:r.email,cpf:r.responsible_cpf}];
    for(let i=0;i<ps.length;i++){
      const k=personKey(ps[i],`${r.id}:${i}`);
      if(seen.has(k)){duplicateKeys.push(k);continue}
      seen.add(k);unique++;
    }
  }
  if(duplicateKeys.length)note('error','duplicate_participant_same_trip',{trip_id:t.id,count:duplicateKeys.length});
  const guide=t.special_seat_counted===false?0:1;
  const expected=unique+guide,stored=Math.max(0,Math.round(num(t.used_spots)));
  if(expected!==stored)note('error','trip_used_spots_mismatch',{trip_id:t.id,stored,expected,unique_participants:unique,guide});
  const total=Math.max(0,Math.round(num(t.total_spots)));
  if(total&&stored>total)note('error','trip_over_capacity',{trip_id:t.id,total,used:stored});
  if(!clean(t.cancellation_policy))note('warn','trip_missing_cancellation_policy',{trip_id:t.id});
  if(!clean(t.name)||!clean(t.trip_date))note('error','trip_missing_core_data',{trip_id:t.id});
}

const salesIdentity=new Map();
for(const s of sales.filter(x=>active(x.sale_status))){
  const k=ident(s.customer_name,s.customer_email);
  if(!k||!s.trip_id)continue;
  const key=`${s.trip_id}|${k}`;
  if(!salesIdentity.has(key))salesIdentity.set(key,[]);
  salesIdentity.get(key).push(s.id);
}
for(const [key,ids] of salesIdentity.entries())if(ids.length>1)note('error','duplicate_active_sale_identity',{trip_id:key.split('|')[0],count:ids.length,sale_ids:ids});

const summary=issues.reduce((a,x)=>(a[x.severity]=(a[x.severity]||0)+1,a),{});
console.log(JSON.stringify({
  ok:!issues.some(x=>x.severity==='error'),
  counts:{trips:trips.length,sales:sales.length,reservations:reservations.length},
  summary,
  issues
},null,2));
if(issues.some(x=>x.severity==='error'))process.exitCode=3;
