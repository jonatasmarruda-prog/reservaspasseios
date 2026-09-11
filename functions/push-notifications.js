import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { onRequest } from 'firebase-functions/v2/https';
import { onDocumentCreated, onDocumentWritten } from 'firebase-functions/v2/firestore';
import * as logger from 'firebase-functions/logger';
import { createHash } from 'node:crypto';

const db=getFirestore();
const REGION='southamerica-east1';
const OWNER_EMAIL='trilheiros.roomt@gmail.com';
const BASE_URL='https://trilheiros-reservas.web.app';
const PENDING_URL=`${BASE_URL}/admin?tab=pending`;
const PEOPLE_URL=`${BASE_URL}/admin?tab=people`;
const ICON='https://i.postimg.cc/JnF2F9Hw/LOGO-TRILHEIROS-Photoroom.png';
const BADGE=`${BASE_URL}/notification-badge.png?v=20260910-push5`;
const hash=v=>createHash('sha256').update(String(v||'')).digest('hex');
const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v||0));

function cors(res){
  res.set('Access-Control-Allow-Origin',BASE_URL);
  res.set('Access-Control-Allow-Headers','Authorization, Content-Type');
  res.set('Access-Control-Allow-Methods','POST, OPTIONS');
}

export const registerPushDevice=onRequest({region:REGION},async(req,res)=>{
  cors(res);
  if(req.method==='OPTIONS')return res.status(204).send('');
  if(req.method!=='POST')return res.status(405).json({ok:false,error:'Método não permitido.'});
  try{
    const bearer=String(req.headers.authorization||'');
    const idToken=bearer.startsWith('Bearer ')?bearer.slice(7):'';
    if(!idToken)return res.status(401).json({ok:false,error:'Autenticação necessária.'});
    const decoded=await getAuth().verifyIdToken(idToken);
    if(String(decoded.email||'').toLowerCase()!==OWNER_EMAIL)return res.status(403).json({ok:false,error:'Acesso não autorizado.'});
    const token=String(req.body?.token||'').trim();
    if(!token||token.length<50)return res.status(400).json({ok:false,error:'Token push inválido.'});
    const ref=db.collection('push_devices').doc(hash(token));
    const old=await ref.get();
    await ref.set({
      token,
      uid:decoded.uid,
      email:OWNER_EMAIL,
      platform:String(req.body?.platform||''),
      user_agent:String(req.headers['user-agent']||'').slice(0,500),
      active:true,
      updated_at:new Date().toISOString(),
      ...(old.exists?{}:{created_at:new Date().toISOString()})
    },{merge:true});
    return res.json({ok:true});
  }catch(err){
    logger.error('registerPushDevice',err);
    return res.status(500).json({ok:false,error:'Não foi possível registrar este celular.'});
  }
});

async function activeTokens(){
  const snap=await db.collection('push_devices').where('active','==',true).limit(100).get();
  return snap.docs.map(d=>({id:d.id,token:String(d.data()?.token||'')})).filter(x=>x.token);
}

async function sendAdminPush({title,body,url,type,tag,data={}}){
  const devices=await activeTokens();
  if(!devices.length){logger.info('Nenhum dispositivo push ativo.',{type});return{successCount:0,failureCount:0};}
  const payload={
    tokens:devices.map(x=>x.token),
    data:{url,type,title,body,...Object.fromEntries(Object.entries(data).map(([k,v])=>[k,String(v??'')]))},
    webpush:{
      headers:{Urgency:'high',TTL:'86400'},
      notification:{
        title,
        body,
        icon:ICON,
        badge:BADGE,
        requireInteraction:false,
        renotify:true,
        tag,
        vibrate:[180,80,180]
      },
      fcmOptions:{link:url}
    }
  };
  const result=await getMessaging().sendEachForMulticast(payload);
  const invalid=[];
  result.responses.forEach((r,i)=>{
    const code=String(r.error?.code||'');
    if(!r.success&&(code.includes('registration-token-not-registered')||code.includes('invalid-registration-token')))invalid.push(devices[i]?.id);
  });
  if(invalid.length)await Promise.all(invalid.filter(Boolean).map(id=>db.collection('push_devices').doc(id).set({active:false,updated_at:new Date().toISOString()},{merge:true})));
  logger.info('Push enviado',{type,success:result.successCount,failure:result.failureCount});
  return result;
}

export const notifyNewReservation=onDocumentCreated({document:'trips/{tripId}/reservations/{reservationId}',region:REGION},async event=>{
  const r=event.data?.data();
  if(!r||r.status==='cancelled')return;
  const tripSnap=await db.collection('trips').doc(event.params.tripId).get();
  const trip=String(r.trip_name||tripSnap.data()?.name||'Passeio');
  const customer=String(r.responsible_name||r.name||'Participante');
  const seats=Math.max(1,Number(r.seats||1));
  await sendAdminPush({
    title:'🥾 Novo cadastro',
    body:`${customer} cadastrou ${seats} vaga(s) em ${trip}.`,
    url:PEOPLE_URL,
    type:'registration',
    tag:`registration-${event.params.tripId}-${event.params.reservationId}`,
    data:{trip_id:event.params.tripId,reservation_id:event.params.reservationId}
  });
});

export const notifyReservationUpdate=onDocumentWritten({document:'trips/{tripId}/reservations/{reservationId}',region:REGION},async event=>{
  const before=event.data?.before?.exists?event.data.before.data():null;
  const after=event.data?.after?.exists?event.data.after.data():null;
  if(!before||!after)return;
  const beforeStatus=String(before.status||'');
  const afterStatus=String(after.status||'');
  if(beforeStatus==='cancel_requested'||afterStatus!=='cancel_requested')return;
  const tripSnap=await db.collection('trips').doc(event.params.tripId).get();
  const trip=String(after.trip_name||tripSnap.data()?.name||'Passeio');
  const customer=String(after.responsible_name||after.name||'Participante');
  await sendAdminPush({
    title:'⚠️ Pedido de cancelamento',
    body:`${customer} solicitou cancelamento em ${trip}.`,
    url:PENDING_URL,
    type:'cancel',
    tag:`cancel-${event.params.tripId}-${event.params.reservationId}`,
    data:{trip_id:event.params.tripId,reservation_id:event.params.reservationId}
  });
});

export const notifyPaymentUpdate=onDocumentWritten({document:'sales/{saleId}',region:REGION},async event=>{
  const before=event.data?.before?.exists?event.data.before.data():null;
  const after=event.data?.after?.exists?event.data.after.data():null;
  if(!after||after.sale_status==='cancelled')return;
  const oldPaid=Math.max(0,Number(before?.paid_amount||0));
  const newPaid=Math.max(0,Number(after.paid_amount||0));
  const delta=newPaid-oldPaid;
  if(delta<=0.009)return;
  const balance=Math.max(0,Number(after.balance_due||0));
  const customer=String(after.customer_name||'Cliente');
  const trip=String(after.trip_name||'Passeio');
  const method=String(after.payment_method||'Pagamento');
  await sendAdminPush({
    title:`💰 Pagamento confirmado — ${customer}`,
    body:`${trip} • ${method} • ${money(delta)}${balance>0.009?` • saldo ${money(balance)}`:' • quitado'}`,
    url:PENDING_URL,
    type:'payment',
    tag:`payment-${event.params.saleId}-${newPaid.toFixed(2)}`,
    data:{sale_id:event.params.saleId}
  });
});
