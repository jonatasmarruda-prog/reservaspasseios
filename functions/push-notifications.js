import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { onRequest } from 'firebase-functions/v2/https';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import * as logger from 'firebase-functions/logger';
import { createHash } from 'node:crypto';

const db=getFirestore();
const REGION='southamerica-east1';
const OWNER_EMAIL='trilheiros.roomt@gmail.com';
const APP_URL='https://trilheiros-reservas.web.app/admin?tab=pending';
const SYMBOL='https://trilheiros-reservas.web.app/notification-symbol-v3.svg?v=20260910-symbol3';
const hash=v=>createHash('sha256').update(String(v||'')).digest('hex');
const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v||0));

function cors(res){
  res.set('Access-Control-Allow-Origin','https://trilheiros-reservas.web.app');
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
    await ref.set({token,uid:decoded.uid,email:OWNER_EMAIL,platform:String(req.body?.platform||''),user_agent:String(req.headers['user-agent']||'').slice(0,500),active:true,updated_at:new Date().toISOString(),created_at:new Date().toISOString()},{merge:true});
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

export const notifyPaymentUpdate=onDocumentWritten({document:'sales/{saleId}',region:REGION},async event=>{
  const before=event.data?.before?.exists?event.data.before.data():null;
  const after=event.data?.after?.exists?event.data.after.data():null;
  if(!after||after.sale_status==='cancelled')return;
  const oldPaid=Math.max(0,Number(before?.paid_amount||0));
  const newPaid=Math.max(0,Number(after.paid_amount||0));
  const delta=newPaid-oldPaid;
  if(delta<=0.009)return;

  const devices=await activeTokens();
  if(!devices.length){logger.info('Nenhum dispositivo push ativo.');return;}

  const balance=Math.max(0,Number(after.balance_due||0));
  const customer=String(after.customer_name||'Cliente');
  const trip=String(after.trip_name||'Passeio');
  const method=String(after.payment_method||'Pagamento');
  const title=`💰 Pagamento confirmado — ${customer}`;
  const body=`${trip} • ${method} • ${money(delta)}${balance>0.009?` • saldo ${money(balance)}`:' • quitado'}`;
  const payload={
    tokens:devices.map(x=>x.token),
    data:{url:APP_URL,sale_id:String(event.params.saleId),type:'payment',title,body},
    webpush:{
      headers:{Urgency:'high'},
      notification:{title,body,icon:SYMBOL,badge:SYMBOL,requireInteraction:false,renotify:true,tag:`payment-${event.params.saleId}-${newPaid.toFixed(2)}`,vibrate:[180,80,180]},
      fcmOptions:{link:APP_URL}
    }
  };
  const result=await getMessaging().sendEachForMulticast(payload);
  const invalid=[];
  result.responses.forEach((r,i)=>{
    const code=String(r.error?.code||'');
    if(!r.success&&(code.includes('registration-token-not-registered')||code.includes('invalid-registration-token')))invalid.push(devices[i]?.id);
  });
  if(invalid.length)await Promise.all(invalid.filter(Boolean).map(id=>db.collection('push_devices').doc(id).set({active:false,updated_at:new Date().toISOString()},{merge:true})));
  logger.info('Push pagamento',{success:result.successCount,failure:result.failureCount,saleId:event.params.saleId});
});
