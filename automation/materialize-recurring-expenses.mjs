import admin from 'firebase-admin';

const rawService=process.env.FIREBASE_SERVICE_ACCOUNT||'';
const TZ='America/Cuiaba';
const SETTINGS_DOC='finance_recurring_expenses';

if(!rawService){
  console.log('Despesas recorrentes: FIREBASE_SERVICE_ACCOUNT não configurado.');
  process.exit(0);
}

let service;
try{service=JSON.parse(rawService)}catch{
  console.error('Despesas recorrentes: FIREBASE_SERVICE_ACCOUNT não é JSON válido.');
  process.exit(1);
}

admin.initializeApp({credential:admin.credential.cert(service)});
const db=admin.firestore();
const FieldValue=admin.firestore.FieldValue;
const month=new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit'}).format(new Date());
const num=v=>Math.max(0,Number(v||0)||0);
const applies=(item,m)=>item?.active!==false&&String(item?.start_month||'').slice(0,7)<=m&&(!item?.end_month||String(item.end_month).slice(0,7)>=m);
const occurrenceId=(seriesId,m)=>`business_recurring_${String(seriesId).replace(/[^a-zA-Z0-9_-]/g,'')}_${m.replace('-','')}`;
const monthDate=(m,day=1)=>`${m}-${String(Math.max(1,Math.min(28,Number(day)||1))).padStart(2,'0')}`;

const settings=await db.collection('settings').doc(SETTINGS_DOC).get();
const items=settings.exists&&Array.isArray(settings.data()?.items)?settings.data().items:[];
const active=items.filter(item=>applies(item,month)&&num(item.amount)>0);

if(!active.length){
  console.log(`Despesas recorrentes: nenhuma recorrência aplicável em ${month}.`);
  process.exit(0);
}

const refs=active.map(item=>({item,ref:db.collection('expenses').doc(occurrenceId(item.id,month))}));
const snaps=await db.getAll(...refs.map(x=>x.ref));
const batch=db.batch();
let created=0;

snaps.forEach((snap,index)=>{
  if(snap.exists)return;
  const {item,ref}=refs[index];
  batch.set(ref,{
    expense_scope:'business',
    trip_id:'',
    trip_name:'ADMINISTRATIVO',
    description:item.description||'Despesa fixa',
    category:item.category||'Outros',
    cost_mode:'fixed',
    amount:num(item.amount),
    unit_amount:num(item.amount),
    competence:month,
    expense_date:monthDate(month,1),
    due_date:monthDate(month,item.due_day||10),
    payment_status:'pending',
    status:'pending',
    paid_date:'',
    recurring_parent_id:item.id,
    recurring_monthly:true,
    created_at:FieldValue.serverTimestamp(),
    updated_at:FieldValue.serverTimestamp()
  });
  created++;
});

if(created)await batch.commit();
console.log(`Despesas recorrentes ${month}: ${created} criada(s), ${active.length-created} já existente(s).`);
