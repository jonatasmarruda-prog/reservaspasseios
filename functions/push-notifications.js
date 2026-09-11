import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { onRequest } from 'firebase-functions/v2/https';
import { onDocumentCreated, onDocumentWritten } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import * as logger from 'firebase-functions/logger';
import { createHash } from 'node:crypto';

const db=getFirestore();
const REGION='southamerica-east1';
const OWNER_EMAIL='trilheiros.roomt@gmail.com';
const BASE_URL='https://trilheiros-reservas.web.app';
const PENDING_URL=`${BASE_URL}/admin?tab=pending`;
const PEOPLE_URL=`${BASE_URL}/admin?tab=people`;
const ICON='https://i.postimg.cc/JnF2F9Hw/LOGO-TRILHEIROS-Photoroom.png?v=20260911-push8';
const EMAIL_LOGO='https://i.postimg.cc/JnF2F9Hw/LOGO-TRILHEIROS-Photoroom.png';
const EMAIL_FROM='Trilheiros de Rondonópolis <reservas@trilheirosderondonopolis.com.br>';
const EMAIL_REPLY_TO='trilheiros.roomt@gmail.com';
const WHATSAPP='5566996926174';
const RESEND_API_KEY=defineSecret('RESEND_API_KEY');
const hash=v=>createHash('sha256').update(String(v||'')).digest('hex');
const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v||0));
const clean=v=>String(v??'').trim();
const norm=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const validEmail=v=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(v));
const firstName=v=>clean(v||'Trilheiro').split(/\s+/)[0]||'Trilheiro';

function cors(res){
  res.set('Access-Control-Allow-Origin',BASE_URL);
  res.set('Access-Control-Allow-Headers','Authorization, Content-Type');
  res.set('Access-Control-Allow-Methods','POST, OPTIONS');
}

function paymentLabel(v){
  const s=String(v||'').toLowerCase();
  if(s.includes('parcel')||s.includes('install'))return'PIX parcelado';
  if(s.includes('card')||s.includes('cart'))return'Cartão';
  if(s.includes('pix'))return'PIX';
  if(s.includes('cash')||s.includes('dinheiro'))return'Dinheiro';
  if(s.includes('transfer'))return'Transferência';
  return String(v||'Pagamento');
}

function isPendingPayment(s){
  if(!s)return false;
  const status=String(s.payment_status||'pending').toLowerCase();
  const saleStatus=String(s.sale_status||'').toLowerCase();
  const paid=Math.max(0,Number(s.paid_amount||0));
  const total=Math.max(0,Number(s.sale_total||0));
  const balance=Math.max(0,Number(s.balance_due ?? Math.max(0,total-paid)));
  if(saleStatus==='cancelled'||saleStatus==='canceled')return false;
  if(['paid','confirmed','confirmado','quitado','completed'].includes(status))return false;
  return balance>0.009;
}

function isCancelled(v){
  const bad=new Set(['cancelled','canceled','cancelado','cancelada','inactive','inativo','inativa']);
  return [v?.status,v?.sale_status,v?.trip_status,v?.registration_status].map(norm).filter(Boolean).some(s=>bad.has(s));
}

function fullyPaid(sale){
  if(!sale||isCancelled(sale))return false;
  const status=norm(sale.payment_status||'');
  const total=Math.max(0,Number(sale.sale_total||sale.total_amount||sale.amount||0));
  const received=Math.max(0,Number(sale.paid_amount||sale.amount_paid||sale.received_amount||0));
  const rawBalance=Number(sale.balance_due);
  const balance=Number.isFinite(rawBalance)?Math.max(0,rawBalance):Math.max(0,total-received);
  const explicit=['paid','confirmed','approved','completed','pago','quitado'].includes(status)||sale.payment_confirmed===true;
  return balance<=0.009&&(explicit||(total>0&&received>=total-0.009)||!!sale.payment_completed_at);
}

function stampMs(v){
  try{
    if(!v)return 0;
    if(typeof v.toMillis==='function')return v.toMillis();
    if(typeof v.toDate==='function')return v.toDate().getTime();
    if(v.seconds)return Number(v.seconds)*1000;
    const d=new Date(v);return Number.isNaN(d.getTime())?0:d.getTime();
  }catch{return 0}
}

function brDate(v){
  const s=clean(v).slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return'Data a confirmar';
  const[y,m,d]=s.split('-');return`${d}/${m}/${y}`;
}

function participantNames(row){
  const participants=Array.isArray(row?.participants)?row.participants:[];
  const names=participants.map(x=>clean(x?.full_name||x?.name)).filter(Boolean);
  if(names.length)return names;
  const name=clean(row?.customer_name||row?.responsible_name||row?.name);
  return name?[name]:[];
}

function welcomeTemplate(sale,trip){
  const name=clean(sale.customer_name||sale.responsible_name)||participantNames(sale)[0]||'Trilheiro';
  const tripName=clean(trip?.name||sale.trip_name)||'seu próximo passeio';
  const destination=clean(trip?.destination||sale.destination);
  const names=participantNames(sale);
  const paid=Math.max(0,Number(sale.paid_amount||sale.amount_paid||sale.received_amount||0));
  const date=brDate(trip?.trip_date||sale.trip_date);
  const msg=`Olá Jonatas! Estou falando sobre o passeio ${tripName}. Protocolo: ${clean(sale.protocol)||'não informado'}.`;
  const wa=`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`;
  const subject=`🥾 Sua viagem está confirmada: ${tripName}`;
  const html=`<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head><body style="margin:0;background:#eef4f1;font-family:Arial,Helvetica,sans-serif;color:#17372d"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#eef4f1"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;background:#fff;border:1px solid #d9e5df;border-radius:20px"><tr><td align="center" bgcolor="#073226" style="background-color:#073226;padding:28px 24px"><img src="${EMAIL_LOGO}" alt="Trilheiros de Rondonópolis" width="150" height="150" border="0" style="display:block;width:150px;height:150px;object-fit:contain"><p style="font-size:12px;line-height:18px;color:#d9b44c;font-weight:800;margin:10px 0 0">PAGAMENTO CONFIRMADO</p><h1 style="font-size:28px;line-height:34px;color:#fff;margin:8px 0 0">Parabéns, ${esc(firstName(name))}! 🎉</h1></td></tr><tr><td style="padding:26px 24px"><h2 style="font-size:22px;line-height:28px;color:#073226;margin:0 0 6px">${esc(tripName)}</h2>${destination?`<p style="font-size:14px;line-height:21px;color:#657b72;margin:0 0 18px">📍 ${esc(destination)}</p>`:''}<p style="font-size:15px;line-height:24px;margin:0 0 8px"><b>Data:</b> ${esc(date)}</p><p style="font-size:15px;line-height:24px;margin:0 0 8px"><b>Participante(s):</b> ${esc(names.length?names.join(' • '):name)}</p><p style="font-size:15px;line-height:24px;margin:0 0 8px"><b>Protocolo:</b> ${esc(sale.protocol||'—')}</p><p style="font-size:15px;line-height:24px;color:#13744e;margin:0 0 20px"><b>✅ Pagamento confirmado${paid>0?` • ${esc(money(paid))}`:''}</b></p><p style="font-size:15px;line-height:24px;color:#50685e;margin:0 0 20px">Sua vaga está confirmada. Mais perto da data você receberá as orientações pré-trilha com horário, ponto de encontro e o que levar.</p><table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td bgcolor="#0b684b" style="background-color:#0b684b;border-radius:12px"><a href="${esc(wa)}" style="display:inline-block;padding:14px 22px;color:#fff;text-decoration:none;font-size:15px;font-weight:800">Falar com Jonatas no WhatsApp</a></td></tr></table><p style="font-size:12px;line-height:19px;color:#71837c;text-align:center;margin:24px 0 0">Trilheiros de Rondonópolis • Aqui ninguém vai só. 🥾💚</p></td></tr></table></td></tr></table></body></html>`;
  const text=`Parabéns, ${firstName(name)}!\n\nSeu pagamento foi confirmado e sua vaga está garantida para ${tripName}.\nData: ${date}\nParticipante(s): ${names.length?names.join(', '):name}\nProtocolo: ${sale.protocol||'—'}\n${paid>0?`Pagamento confirmado: ${money(paid)}\n`:''}\nMais perto da data você receberá as orientações pré-trilha.\n\nDúvidas: Jonatas — (66) 99692-6174.\n\nTrilheiros de Rondonópolis — Aqui ninguém vai só.`;
  return{subject,html,text};
}

async function sendPaidWelcomeEmail(saleId){
  const saleRef=db.collection('sales').doc(saleId);
  const initial=await saleRef.get();
  if(!initial.exists)return{skipped:true,reason:'sale_missing'};
  const initialSale=initial.data()||{};
  if(!fullyPaid(initialSale))return{skipped:true,reason:'not_paid'};
  const email=clean(initialSale.customer_email||initialSale.email).toLowerCase();
  if(!validEmail(email)){
    await saleRef.set({welcome_email_status:'skipped_no_email',welcome_email_checked_at:FieldValue.serverTimestamp()},{merge:true});
    return{skipped:true,reason:'no_email'};
  }
  const resendAnchor=stampMs(initialSale.welcome_email_resend_requested_at);
  const anchor=String(resendAnchor||'first');
  const dispatchId=hash(`welcome_paid|sales/${saleId}|${anchor}`);
  const dispatchRef=db.collection('email_dispatches').doc(dispatchId);
  let claimed=false;
  await db.runTransaction(async tx=>{
    const [saleSnap,dispatchSnap]=await Promise.all([tx.get(saleRef),tx.get(dispatchRef)]);
    if(!saleSnap.exists)return;
    const sale=saleSnap.data()||{};
    if(!fullyPaid(sale))return;
    const currentEmail=clean(sale.customer_email||sale.email).toLowerCase();
    if(!validEmail(currentEmail))return;
    if((sale.welcome_email_sent_at||sale.welcome_email_status==='sent')&&!resendAnchor)return;
    const d=dispatchSnap.exists?dispatchSnap.data()||{}:{};
    if(d.status==='sent'||d.status==='sending')return;
    tx.set(dispatchRef,{kind:'welcome_paid',source_type:'sale',source_path:`sales/${saleId}`,email:currentEmail,status:'sending',attempts:Number(d.attempts||0)+1,last_attempt_at:FieldValue.serverTimestamp(),updated_at:FieldValue.serverTimestamp(),created_at:d.created_at||FieldValue.serverTimestamp()},{merge:true});
    tx.set(saleRef,{welcome_email_status:'sending',welcome_email_last_attempt_at:FieldValue.serverTimestamp()},{merge:true});
    claimed=true;
  });
  if(!claimed)return{skipped:true,reason:'already_claimed'};

  try{
    const fresh=await saleRef.get();
    const sale={id:fresh.id,...fresh.data()};
    const tripSnap=sale.trip_id?await db.collection('trips').doc(String(sale.trip_id)).get():null;
    const trip=tripSnap?.exists?{id:tripSnap.id,...tripSnap.data()}:null;
    if(trip&&isCancelled(trip))throw new Error('Passeio cancelado; e-mail não enviado.');
    const template=welcomeTemplate(sale,trip);
    const key=RESEND_API_KEY.value();
    if(!key)throw new Error('RESEND_API_KEY não configurada.');
    const response=await fetch('https://api.resend.com/emails',{
      method:'POST',
      headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json','Idempotency-Key':`welcome-${dispatchId}`},
      body:JSON.stringify({from:EMAIL_FROM,to:[email],reply_to:EMAIL_REPLY_TO,...template})
    });
    const raw=await response.text();
    if(!response.ok)throw new Error(`Resend ${response.status}: ${raw.slice(0,700)}`);
    let payload={};try{payload=JSON.parse(raw||'{}')}catch{}
    await Promise.all([
      dispatchRef.set({status:'sent',sent_at:FieldValue.serverTimestamp(),resend_id:payload.id||'',email,error:FieldValue.delete(),updated_at:FieldValue.serverTimestamp()},{merge:true}),
      saleRef.set({welcome_email_status:'sent',welcome_email_sent_at:FieldValue.serverTimestamp(),welcome_email_resend_id:payload.id||'',welcome_email_to:email,welcome_email_version:5,welcome_email_error:FieldValue.delete()},{merge:true})
    ]);
    logger.info('Boas-vindas enviado imediatamente',{saleId,email,resendId:payload.id||''});
    return{ok:true,id:payload.id||''};
  }catch(err){
    const message=String(err?.message||err).slice(0,900);
    await Promise.all([
      dispatchRef.set({status:'error',error:message,failed_at:FieldValue.serverTimestamp(),updated_at:FieldValue.serverTimestamp()},{merge:true}).catch(()=>{}),
      saleRef.set({welcome_email_status:'error',welcome_email_error:message,welcome_email_last_attempt_at:FieldValue.serverTimestamp()},{merge:true}).catch(()=>{})
    ]);
    logger.error('Falha no envio imediato de boas-vindas',{saleId,error:message});
    throw err;
  }
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
    data:{url,type,title,body,tag,...Object.fromEntries(Object.entries(data).map(([k,v])=>[k,String(v??'')]))},
    webpush:{
      headers:{Urgency:'high',TTL:'86400'},
      notification:{
        title,
        body,
        icon:ICON,
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

export const notifyPaymentUpdate=onDocumentWritten({document:'sales/{saleId}',region:REGION,secrets:[RESEND_API_KEY]},async event=>{
  const before=event.data?.before?.exists?event.data.before.data():null;
  const after=event.data?.after?.exists?event.data.after.data():null;
  if(!after||String(after.sale_status||'').toLowerCase()==='cancelled')return;

  const oldPaid=Math.max(0,Number(before?.paid_amount||0));
  const newPaid=Math.max(0,Number(after.paid_amount||0));
  const delta=newPaid-oldPaid;
  const customer=String(after.customer_name||after.responsible_name||after.name||'Cliente');
  const trip=String(after.trip_name||'Passeio');
  const method=paymentLabel(after.payment_method);
  const total=Math.max(0,Number(after.sale_total||0));
  const balance=Math.max(0,Number(after.balance_due ?? Math.max(0,total-newPaid)));

  const becameFullyPaid=!fullyPaid(before)&&fullyPaid(after);
  const queuedForWelcome=fullyPaid(after)&&String(after.welcome_email_status||'')==='pending'&&String(before?.welcome_email_status||'')!=='pending';
  const resendChanged=fullyPaid(after)&&stampMs(after.welcome_email_resend_requested_at)>0&&stampMs(after.welcome_email_resend_requested_at)!==stampMs(before?.welcome_email_resend_requested_at);
  if(becameFullyPaid||queuedForWelcome||resendChanged){
    try{await sendPaidWelcomeEmail(event.params.saleId)}catch(err){logger.error('WELCOME_EMAIL_TRIGGER',{saleId:event.params.saleId,error:String(err?.message||err)})}
  }

  if(delta>0.009){
    await sendAdminPush({
      title:`✅ Pagamento confirmado — ${customer}`,
      body:`${trip} • ${method} • ${money(delta)}${balance>0.009?` • saldo ${money(balance)}`:' • quitado'}`,
      url:PENDING_URL,
      type:'payment_confirmed',
      tag:`payment-confirmed-${event.params.saleId}-${newPaid.toFixed(2)}`,
      data:{sale_id:event.params.saleId}
    });
    return;
  }

  const newlyCreated=!before;
  const becamePending=Boolean(before)&&!isPendingPayment(before)&&isPendingPayment(after);
  const methodChanged=Boolean(before)&&isPendingPayment(after)&&String(before.payment_method||'')!==String(after.payment_method||'')&&Boolean(after.payment_method);
  const pendingSignalChanged=Boolean(before)&&isPendingPayment(after)&&[
    'requested_amount','amount_to_confirm','installment_amount','payment_reference','payment_intent','payment_origin'
  ].some(key=>String(before?.[key]??'')!==String(after?.[key]??''));
  if(!(isPendingPayment(after)&&(newlyCreated||becamePending||methodChanged||pendingSignalChanged)))return;

  const requested=Math.max(0,Number(after.requested_amount||after.amount_to_confirm||after.installment_amount||0));
  const value=requested>0?requested:(balance>0?balance:total);
  await sendAdminPush({
    title:`💰 ${customer} informou pagamento`,
    body:`${trip} • ${method}${value>0?` • ${money(value)}`:''} • conferir e confirmar no Gestão`,
    url:PENDING_URL,
    type:'payment_pending',
    tag:`payment-pending-${event.params.saleId}-${String(after.updated_at?.seconds||after.updated_at||Date.now())}`,
    data:{sale_id:event.params.saleId}
  });
});
