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
const hash=v=>createHash('sha256').update(String(v||'')).digest('hex');
const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v||0));
const stampMs=v=>{try{if(!v)return 0;if(typeof v.toMillis==='function')return v.toMillis();if(v.seconds)return Number(v.seconds)*1000;const d=new Date(v);return Number.isNaN(d.getTime())?0:d.getTime()}catch{return 0}};
const recent=v=>{const ms=stampMs(v);return ms>0&&now-ms<=LOOKBACK_MS};
const payLabel=v=>{const s=String(v||'').toLowerCase();if(s.includes('parcel'))return'PIX parcelado';if(s.includes('card')||s.includes('cart'))return'Cartão';if(s.includes('pix'))return'PIX';return String(v||'Pagamento')};

async function activeDevices(){
  const snap=await db.collection('push_devices').where('active','==',true).limit(100).get();
  return snap.docs.map(d=>({id:d.id,token:String(d.data()?.token||'')})).filter(x=>x.token);
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
    data:{title,body,url,tag:key,type,timestamp:String(Date.now())},
    webpush:{
      headers:{Urgency:'high'},
      notification:{title,body,icon:'https://i.postimg.cc/JnF2F9Hw/LOGO-TRILHEIROS-Photoroom.png',tag:key,renotify:true,requireInteraction:false},
      fcmOptions:{link:url}
    }
  };
  const result=await messaging.sendEachForMulticast(message);
  const invalid=[];
  result.responses.forEach((r,i)=>{const code=String(r.error?.code||'');if(!r.success&&(code.includes('registration-token-not-registered')||code.includes('invalid-registration-token')))invalid.push(devices[i]?.id)});
  if(invalid.length)await Promise.all(invalid.filter(Boolean).map(id=>db.collection('push_devices').doc(id).set({active:false,updated_at:FV.serverTimestamp()},{merge:true})));
  await ref.set({status:result.successCount>0?'sent':'error',success_count:result.successCount,failure_count:result.failureCount,sent_at:FV.serverTimestamp(),updated_at:FV.serverTimestamp()},{merge:true});
  console.log(`${type}: ${title} | sucesso ${result.successCount} | falha ${result.failureCount}`);
  return result;
}

const salesSnap=await db.collection('sales').get();
let checked=0,sent=0;
for(const doc of salesSnap.docs){
  const s={id:doc.id,...doc.data()};
  const eventRecent=recent(s.updated_at)||recent(s.created_at)||recent(s.payment_completed_at);
  if(!eventRecent)continue;
  checked++;
  const cancelled=['cancelled','canceled'].includes(String(s.sale_status||'').toLowerCase());
  const status=String(s.payment_status||'pending').toLowerCase();
  const paid=Math.max(0,Number(s.paid_amount||0));
  const total=Math.max(0,Number(s.sale_total||0));
  const balance=Math.max(0,Number.isFinite(Number(s.balance_due))?Number(s.balance_due):total-paid);
  const name=s.customer_name||s.responsible_name||'Cliente';
  const trip=s.trip_name||'Passeio';
  const source=String(s.source||'');
  const isPortal=source.startsWith('public_portal_')||s.channel==='canva_reserva_passeios';

  if(!cancelled&&isPortal&&['pending','partial',''].includes(status)&&balance>0.009){
    const r=await sendPush({key:`pending:${s.id}`,title:`💰 Novo pagamento — ${name}`,body:`${trip} • ${payLabel(s.payment_method)} • ${money(total||balance)} • aguardando conferência`,url:`${BASE_URL}/admin?tab=pending`,type:'pending_payment'});
    if(!r?.skipped)sent++;
  }

  if(!cancelled&&['paid','confirmed','approved','completed','pago','quitado'].includes(status)&&paid>0){
    const anchor=stampMs(s.payment_completed_at)||Math.round(paid*100);
    const r=await sendPush({key:`paid:${s.id}:${anchor}`,title:`✅ Pagamento confirmado — ${name}`,body:`${trip} • ${payLabel(s.payment_method)} • ${money(paid)}${balance>0.009?` • saldo ${money(balance)}`:' • quitado'}`,url:`${BASE_URL}/admin?tab=pending`,type:'payment_confirmed'});
    if(!r?.skipped)sent++;
  }
}

console.log(`Push background concluído: ${checked} venda(s) recente(s), ${sent} envio(s) novo(s).`);
