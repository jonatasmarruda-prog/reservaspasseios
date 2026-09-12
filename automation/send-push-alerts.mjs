import admin from 'firebase-admin';
import {createHash} from 'node:crypto';

const raw=process.env.FIREBASE_SERVICE_ACCOUNT||'';
if(!raw){console.error('FIREBASE_SERVICE_ACCOUNT ausente.');process.exit(1)}
let service;try{service=JSON.parse(raw)}catch{console.error('FIREBASE_SERVICE_ACCOUNT inválido.');process.exit(1)}
if(!admin.apps.length)admin.initializeApp({credential:admin.credential.cert(service)});
const db=admin.firestore();
const messaging=admin.messaging();
const FV=admin.firestore.FieldValue;
const now=Date.now();
const LOOKBACK_MS=20*60*1000;
const BASE_URL='https://trilheiros-reservas.web.app';
const TZ='America/Cuiaba';
const hash=v=>createHash('sha256').update(String(v||'')).digest('hex');
const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v||0));
const stampMs=v=>{try{if(!v)return 0;if(typeof v.toMillis==='function')return v.toMillis();if(v.seconds)return Number(v.seconds)*1000;const d=new Date(v);return Number.isNaN(d.getTime())?0:d.getTime()}catch{return 0}};
const recent=v=>{const ms=stampMs(v);return ms>0&&now-ms<=LOOKBACK_MS};
const todayStr=new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const dayMs=s=>/^\d{4}-\d{2}-\d{2}$/.test(String(s||'').slice(0,10))?Date.parse(`${String(s).slice(0,10)}T12:00:00-04:00`):0;
const daysUntil=date=>{const a=dayMs(todayStr),b=dayMs(date);return a&&b?Math.round((b-a)/86400000):null};
const debtReminderDays=new Set([7,3,1,0]);

async function activeDevices(){
  const map=new Map();
  try{
    const snap=await db.collection('push_devices').where('active','==',true).limit(100).get();
    snap.docs.forEach(d=>{const token=String(d.data()?.token||'');if(token)map.set(token,{id:d.id,token,source:'push_devices'})});
  }catch(err){console.warn('push_devices:',err.message)}
  try{
    const owner=await db.collection('settings').doc('push_device_owner').get();
    const tokens=owner.exists&&Array.isArray(owner.data()?.tokens)?owner.data().tokens:[];
    tokens.map(String).filter(t=>t.length>50).forEach(token=>{if(!map.has(token))map.set(token,{id:hash(token),token,source:'settings'})});
  }catch(err){console.warn('settings push:',err.message)}
  return[...map.values()];
}

const deviceCache=await activeDevices();
console.log(`Dispositivos push ativos: ${deviceCache.length}`);

async function claim(key,payload){
  const ref=db.collection('push_dispatches').doc(hash(key));
  let claimed=false;
  await db.runTransaction(async tx=>{
    const s=await tx.get(ref);
    if(s.exists&&['sending','sent'].includes(String(s.data()?.status||'')))return;
    tx.set(ref,{key,status:'sending',payload,attempted_at:FV.serverTimestamp(),updated_at:FV.serverTimestamp(),created_at:s.exists?(s.data()?.created_at||FV.serverTimestamp()):FV.serverTimestamp()},{merge:true});
    claimed=true;
  });
  return{claimed,ref};
}

async function sendPush({key,title,body,url,type='system'}){
  const {claimed,ref}=await claim(key,{title,body,url,type});
  if(!claimed)return{skipped:true};
  const devices=deviceCache;
  if(!devices.length){await ref.set({status:'no_devices',updated_at:FV.serverTimestamp()},{merge:true});return{skipped:true,noDevices:true}}
  const message={
    tokens:devices.map(x=>x.token),
    data:{title,body,url,tag:key,type,timestamp:String(Date.now()),renotify:'true'},
    webpush:{
      headers:{Urgency:'high',TTL:'86400'},
      notification:{title,body,icon:'https://i.postimg.cc/JnF2F9Hw/LOGO-TRILHEIROS-Photoroom.png',tag:key,renotify:true,requireInteraction:false},
      fcmOptions:{link:url}
    }
  };
  const result=await messaging.sendEachForMulticast(message);
  const invalid=[];
  result.responses.forEach((r,i)=>{const code=String(r.error?.code||'');if(!r.success&&(code.includes('registration-token-not-registered')||code.includes('invalid-registration-token')))invalid.push(devices[i])});
  for(const item of invalid){
    if(item.source==='push_devices')await db.collection('push_devices').doc(item.id).set({active:false,updated_at:FV.serverTimestamp()},{merge:true}).catch(()=>{});
    else await db.collection('settings').doc('push_device_owner').set({tokens:FV.arrayRemove(item.token),updated_at:FV.serverTimestamp()},{merge:true}).catch(()=>{});
  }
  await ref.set({status:result.successCount>0?'sent':'error',success_count:result.successCount,failure_count:result.failureCount,sent_at:FV.serverTimestamp(),updated_at:FV.serverTimestamp()},{merge:true});
  console.log(`${type}: ${title} | sucesso ${result.successCount} | falha ${result.failureCount}`);
  return result;
}

const [salesSnap,tripsSnap]=await Promise.all([db.collection('sales').get(),db.collection('trips').get()]);
const trips=new Map(tripsSnap.docs.map(d=>[d.id,{id:d.id,...d.data()}]));
let checked=0,sent=0,debtAlerts=0;
for(const doc of salesSnap.docs){
  const s={id:doc.id,...doc.data()};
  const cancelled=['cancelled','canceled'].includes(String(s.sale_status||'').toLowerCase());
  const status=String(s.payment_status||'pending').toLowerCase();
  const paid=Math.max(0,Number(s.paid_amount||0));
  const total=Math.max(0,Number(s.sale_total||0));
  const balance=Math.max(0,Number.isFinite(Number(s.balance_due))?Number(s.balance_due):total-paid);
  const name=s.customer_name||s.responsible_name||'Cliente';
  const tripObj=trips.get(String(s.trip_id||''))||{};
  const trip=s.trip_name||tripObj.name||'Passeio';
  const tripDate=String(s.trip_date||tripObj.trip_date||'').slice(0,10);
  const source=String(s.source||'');
  const isPortal=source.startsWith('public_portal_')||s.channel==='canva_reserva_passeios';

  if(!cancelled&&balance>0.009&&!['paid','completed','refunded'].includes(status)){
    const left=daysUntil(tripDate);
    if(left!==null&&debtReminderDays.has(left)){
      const when=left===0?'é hoje':left===1?'é amanhã':`é em ${left} dias`;
      const r=await sendPush({
        key:`balance_due:${s.id}:${tripDate}:${left}`,
        title:`⚠️ Saldo pendente — ${name}`,
        body:`${trip} ${when} • total ${money(total||paid+balance)} • recebido ${money(paid)} • falta ${money(balance)}`,
        url:`${BASE_URL}/admin?tab=pending`,
        type:'balance_due_trip'
      });
      if(!r?.skipped){sent++;debtAlerts++}
    }
  }

  const eventRecent=recent(s.updated_at)||recent(s.created_at)||recent(s.payment_completed_at)||recent(s.last_payment_confirmed_at);
  if(!eventRecent)continue;
  checked++;

  if(!cancelled&&isPortal&&['pending','partial',''].includes(status)&&balance>0.009&&paid<=0.009){
    const r=await sendPush({key:`pending:${s.id}`,title:'💰 Novo pagamento',body:String(name),url:`${BASE_URL}/admin?tab=pending`,type:'pending_payment'});
    if(!r?.skipped)sent++;
  }
  if(!cancelled&&status==='partial'&&paid>0&&balance>0.009){
    const anchor=Math.round(paid*100);
    const r=await sendPush({key:`partial:${s.id}:${anchor}`,title:'💰 Novo pagamento',body:String(name),url:`${BASE_URL}/admin?tab=pending`,type:'partial_payment'});
    if(!r?.skipped)sent++;
  }
  if(!cancelled&&['paid','confirmed','approved','completed','pago','quitado'].includes(status)&&paid>0){
    const anchor=stampMs(s.payment_completed_at)||Math.round(paid*100);
    const r=await sendPush({key:`paid:${s.id}:${anchor}`,title:'💰 Novo pagamento',body:String(name),url:`${BASE_URL}/admin?tab=pending`,type:'payment_confirmed'});
    if(!r?.skipped)sent++;
  }
}
console.log(`Push background concluído: ${checked} venda(s) recente(s), ${sent} envio(s) novo(s), ${debtAlerts} alerta(s) de saldo antes do passeio.`);
