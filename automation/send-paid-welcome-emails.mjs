import admin from 'firebase-admin';
import { createHash } from 'node:crypto';

const rawService=process.env.FIREBASE_SERVICE_ACCOUNT||'';
const resendKey=process.env.RESEND_API_KEY||'';
const emailFrom=process.env.EMAIL_FROM||'';
const LOGO='https://i.postimg.cc/JnF2F9Hw/LOGO-TRILHEIROS-Photoroom.png';
const WHATSAPP='5566996926174';
const TZ='America/Cuiaba';
const LOCK_MS=20*60*1000;
const MAX_ATTEMPTS=6;
const HOUR=60*60*1000;

if(!rawService||!resendKey||!emailFrom){
  console.error('Boas-vindas não configuradas: faltam FIREBASE_SERVICE_ACCOUNT, RESEND_API_KEY ou EMAIL_FROM.');
  process.exit(1);
}
let service;
try{service=JSON.parse(rawService)}catch{
  console.error('FIREBASE_SERVICE_ACCOUNT não é JSON válido.');
  process.exit(1);
}
if(!admin.apps.length)admin.initializeApp({credential:admin.credential.cert(service)});
const db=admin.firestore();
const FieldValue=admin.firestore.FieldValue;

const clean=v=>String(v??'').trim();
const norm=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const num=v=>Math.max(0,Number(v||0)||0);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const validEmail=v=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(v));
const firstName=v=>clean(v||'Trilheiro').split(/\s+/)[0]||'Trilheiro';
const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(num(v));
function stampMs(v){
  try{
    if(!v)return 0;
    if(typeof v.toMillis==='function')return v.toMillis();
    if(typeof v.toDate==='function')return v.toDate().getTime();
    if(v.seconds)return Number(v.seconds)*1000;
    const d=new Date(v);return Number.isNaN(d.getTime())?0:d.getTime();
  }catch{return 0}
}
function isCancelled(v){
  const bad=new Set(['cancelled','canceled','cancelado','cancelada','inactive','inativo','inativa']);
  return [v?.status,v?.sale_status,v?.trip_status,v?.registration_status].map(norm).filter(Boolean).some(s=>bad.has(s));
}
function saleFullyPaid(sale){
  if(!sale||isCancelled(sale))return false;
  const status=norm(sale.payment_status||'');
  const total=num(sale.sale_total||sale.total_amount||sale.amount);
  const received=num(sale.paid_amount||sale.amount_paid||sale.received_amount);
  const rawBalance=Number(sale.balance_due);
  const balance=Number.isFinite(rawBalance)?Math.max(0,rawBalance):Math.max(0,total-received);
  const explicit=['paid','confirmed','approved','completed','pago','quitado'].includes(status)||sale.payment_confirmed===true;
  return balance<=0.009&&(explicit||(total>0&&received>=total-0.009)||!!sale.payment_completed_at);
}
function iso(v){
  if(!v)return'';
  if(typeof v==='string'&&/^\d{4}-\d{2}-\d{2}/.test(v))return v.slice(0,10);
  const ms=stampMs(v);if(!ms)return'';
  return new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(ms));
}
function brDate(v){const s=iso(v);if(!s)return'Data a confirmar';const[y,m,d]=s.split('-');return`${d}/${m}/${y}`}
function dateRange(trip,sale){const start=trip?.trip_date||sale?.trip_date||'',end=trip?.trip_end_date||'';return end&&iso(end)!==iso(start)?`${brDate(start)} a ${brDate(end)}`:brDate(start)}
function participantNames(row){
  const participants=Array.isArray(row?.participants)?row.participants:[];
  const names=participants.map(x=>clean(x?.full_name||x?.name)).filter(Boolean);
  return names.length?names:(clean(row?.customer_name||row?.name)?[clean(row?.customer_name||row?.name)]:[]);
}
function whatsappUrl(row,trip){
  const msg=`Olá Jonatas! Estou falando sobre o passeio ${clean(trip?.name||row?.trip_name)||'dos Trilheiros'}. Protocolo: ${clean(row?.protocol)||'não informado'}.`;
  return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`;
}
function dispatchId(kind,sourceId,anchor='default'){return createHash('sha256').update(`${kind}|${sourceId}|${anchor}`).digest('hex')}
function backoffMs(attempt){return Math.min(12*HOUR,Math.max(15*60*1000,(2**Math.max(0,attempt-1))*15*60*1000))}

async function sendResend({to,subject,html,text,key}){
  let lastErr;
  for(let attempt=1;attempt<=3;attempt++){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),15000);
    try{
      const resp=await fetch('https://api.resend.com/emails',{
        method:'POST',signal:controller.signal,
        headers:{Authorization:`Bearer ${resendKey}`,'Content-Type':'application/json','Idempotency-Key':key},
        body:JSON.stringify({from:emailFrom,to:[to],reply_to:'trilheiros.roomt@gmail.com',subject,html,text})
      });
      const body=await resp.text();
      if(resp.ok){try{return JSON.parse(body||'{}')}catch{return{}}}
      const err=new Error(`Resend ${resp.status}: ${body.slice(0,700)}`);
      err.retryable=resp.status===408||resp.status===409||resp.status===429||resp.status>=500;
      throw err;
    }catch(err){
      lastErr=err;
      const retryable=err?.name==='AbortError'||err?.retryable===true;
      if(!retryable||attempt===3)break;
      await new Promise(r=>setTimeout(r,attempt*1200));
    }finally{clearTimeout(timer)}
  }
  throw lastErr||new Error('Falha desconhecida no Resend');
}

function welcomeTemplate(sale,trip){
  const name=clean(sale.customer_name)||participantNames(sale)[0]||'Trilheiro';
  const tripName=clean(trip?.name||sale.trip_name)||'seu próximo passeio';
  const destination=clean(trip?.destination)||'';
  const names=participantNames(sale);
  const paid=num(sale.paid_amount||sale.amount_paid||sale.received_amount);
  const wa=whatsappUrl(sale,trip);
  const subject=`🥾 Sua viagem está confirmada: ${tripName}`;
  const html=`<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head><body style="margin:0;background:#eef4f1;font-family:Arial,Helvetica,sans-serif;color:#17372d"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#eef4f1"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;background:#fff;border:1px solid #d9e5df;border-radius:20px"><tr><td align="center" bgcolor="#073226" style="background-color:#073226;padding:28px 24px"><img src="${LOGO}" alt="Trilheiros de Rondonópolis" width="150" height="150" border="0" style="display:block;width:150px;height:150px;object-fit:contain"><p style="font-size:12px;line-height:18px;color:#d9b44c;font-weight:800;margin:10px 0 0">PAGAMENTO CONFIRMADO</p><h1 style="font-size:28px;line-height:34px;color:#fff;margin:8px 0 0">Parabéns, ${esc(firstName(name))}! 🎉</h1></td></tr><tr><td style="padding:26px 24px"><h2 style="font-size:22px;line-height:28px;color:#073226;margin:0 0 6px">${esc(tripName)}</h2>${destination?`<p style="font-size:14px;line-height:21px;color:#657b72;margin:0 0 18px">📍 ${esc(destination)}</p>`:''}<p style="font-size:15px;line-height:24px;margin:0 0 8px"><b>Data:</b> ${esc(dateRange(trip,sale))}</p><p style="font-size:15px;line-height:24px;margin:0 0 8px"><b>Participante(s):</b> ${esc(names.length?names.join(' • '):name)}</p><p style="font-size:15px;line-height:24px;margin:0 0 8px"><b>Protocolo:</b> ${esc(sale.protocol||'—')}</p><p style="font-size:15px;line-height:24px;color:#13744e;margin:0 0 20px"><b>✅ Pagamento confirmado${paid>0?` • ${esc(money(paid))}`:''}</b></p><p style="font-size:15px;line-height:24px;color:#50685e;margin:0 0 20px">Sua vaga está confirmada. Mais perto da data você receberá as orientações pré-trilha com horário, ponto de encontro e o que levar.</p><table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td bgcolor="#0b684b" style="background-color:#0b684b;border-radius:12px"><a href="${esc(wa)}" style="display:inline-block;padding:14px 22px;color:#fff;text-decoration:none;font-size:15px;font-weight:800">Falar com Jonatas no WhatsApp</a></td></tr></table><p style="font-size:12px;line-height:19px;color:#71837c;text-align:center;margin:24px 0 0">Trilheiros de Rondonópolis • Aqui ninguém vai só. 🥾💚</p></td></tr></table></td></tr></table></body></html>`;
  const text=`Parabéns, ${firstName(name)}!\n\nSeu pagamento foi confirmado e sua vaga está garantida para ${tripName}.\nData: ${dateRange(trip,sale)}\nParticipante(s): ${names.length?names.join(', '):name}\nProtocolo: ${sale.protocol||'—'}\n${paid>0?`Pagamento confirmado: ${money(paid)}\n`:''}\nMais perto da data você receberá as orientações pré-trilha.\n\nDúvidas: Jonatas — (66) 99692-6174.\n\nTrilheiros de Rondonópolis — Aqui ninguém vai só.`;
  return {subject,html,text};
}
function registrationTemplate(reservation,trip){
  const name=clean(reservation.name||reservation.responsible_name)||participantNames(reservation)[0]||'Trilheiro';
  const tripName=clean(trip?.name||reservation.trip_name)||'seu próximo passeio';
  const names=participantNames(reservation);
  const wa=whatsappUrl(reservation,trip);
  const subject=`🥾 Cadastro confirmado: ${tripName}`;
  const html=`<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head><body style="margin:0;background:#eef4f1;font-family:Arial,Helvetica,sans-serif;color:#17372d"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;background:#fff;border:1px solid #d9e5df;border-radius:20px"><tr><td align="center" bgcolor="#073226" style="background-color:#073226;padding:28px 24px"><img src="${LOGO}" alt="Trilheiros de Rondonópolis" width="150" height="150" border="0" style="display:block;width:150px;height:150px;object-fit:contain"><p style="font-size:12px;line-height:18px;color:#d9b44c;font-weight:800;margin:10px 0 0">CADASTRO CONFIRMADO</p><h1 style="font-size:28px;line-height:34px;color:#fff;margin:8px 0 0">Tudo certo, ${esc(firstName(name))}! 🥾</h1></td></tr><tr><td style="padding:26px 24px"><h2 style="font-size:22px;line-height:28px;color:#073226;margin:0 0 14px">${esc(tripName)}</h2><p style="font-size:15px;line-height:24px;margin:0 0 8px"><b>Data:</b> ${esc(dateRange(trip,reservation))}</p><p style="font-size:15px;line-height:24px;margin:0 0 8px"><b>Participante(s):</b> ${esc(names.length?names.join(' • '):name)}</p><p style="font-size:15px;line-height:24px;margin:0 0 20px"><b>Protocolo:</b> ${esc(reservation.protocol||'—')}</p><p style="font-size:14px;line-height:22px;color:#50685e;margin:0 0 20px">Recebemos seus dados e seu cadastro foi concluído. Este e-mail confirma o cadastro; a situação financeira segue os registros do sistema.</p><table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td bgcolor="#0b684b" style="background-color:#0b684b;border-radius:12px"><a href="${esc(wa)}" style="display:inline-block;padding:14px 22px;color:#fff;text-decoration:none;font-size:15px;font-weight:800">Falar com Jonatas no WhatsApp</a></td></tr></table><p style="font-size:12px;line-height:19px;color:#71837c;text-align:center;margin:24px 0 0">Trilheiros de Rondonópolis • Aqui ninguém vai só. 🥾💚</p></td></tr></table></td></tr></table></body></html>`;
  const text=`Olá, ${firstName(name)}!\n\nRecebemos seu cadastro para ${tripName}.\nData: ${dateRange(trip,reservation)}\nParticipante(s): ${names.length?names.join(', '):name}\nProtocolo: ${reservation.protocol||'—'}\n\nEste e-mail confirma o cadastro; a situação financeira segue os registros do sistema.\n\nDúvidas: Jonatas — (66) 99692-6174.`;
  return {subject,html,text};
}

async function claim({kind,sourceRef,sourceType,anchor,email,validator}){
  const id=dispatchId(kind,sourceRef.path,anchor);
  const ref=db.collection('email_dispatches').doc(id);
  let claimed=false,attempt=0;
  await db.runTransaction(async tx=>{
    const sourceSnap=await tx.get(sourceRef);
    const dispatchSnap=await tx.get(ref);
    if(!sourceSnap.exists)return;
    const row={id:sourceSnap.id,...sourceSnap.data()};
    if(!validator(row))return;
    const d=dispatchSnap.exists?dispatchSnap.data()||{}:{};
    if(d.status==='sent')return;
    const attempts=Number(d.attempts||0);
    if(attempts>=MAX_ATTEMPTS)return;
    const last=stampMs(d.last_attempt_at),next=stampMs(d.next_retry_at);
    if(d.status==='sending'&&last&&Date.now()-last<LOCK_MS)return;
    if(next&&Date.now()<next)return;
    attempt=attempts+1;
    tx.set(ref,{kind,source_type:sourceType,source_path:sourceRef.path,email,status:'sending',attempts:attempt,last_attempt_at:FieldValue.serverTimestamp(),updated_at:FieldValue.serverTimestamp(),created_at:d.created_at||FieldValue.serverTimestamp(),error:FieldValue.delete()},{merge:true});
    claimed=true;
  });
  return {claimed,ref,id,attempt};
}
async function markFailure(dispatchRef,err,attempt){
  const message=String(err?.message||err).slice(0,900);
  await dispatchRef.set({status:'error',error:message,failed_at:FieldValue.serverTimestamp(),next_retry_at:admin.firestore.Timestamp.fromDate(new Date(Date.now()+backoffMs(attempt))),updated_at:FieldValue.serverTimestamp()},{merge:true}).catch(()=>{});
  return message;
}
async function markSent(dispatchRef,payload,email){
  await dispatchRef.set({status:'sent',sent_at:FieldValue.serverTimestamp(),resend_id:payload?.id||'',email,error:FieldValue.delete(),next_retry_at:FieldValue.delete(),updated_at:FieldValue.serverTimestamp()},{merge:true});
}

const tripCache=new Map();
async function loadTrip(tripId){
  if(!tripId)return null;
  if(tripCache.has(tripId))return tripCache.get(tripId);
  const snap=await db.collection('trips').doc(tripId).get();
  const trip=snap.exists?{id:snap.id,...snap.data()}:null;
  tripCache.set(tripId,trip);
  return trip;
}

let salesSent=0,salesFailed=0,directSent=0,directFailed=0;
let salesSnap;
try{salesSnap=await db.collection('sales').orderBy('created_at','desc').limit(1000).get()}
catch{salesSnap=await db.collection('sales').limit(1000).get()}

for(const saleDoc of salesSnap.docs){
  const sale={id:saleDoc.id,...saleDoc.data()};
  if(!saleFullyPaid(sale)||sale.welcome_email_sent_at||sale.welcome_email_status==='sent')continue;
  const email=clean(sale.customer_email||sale.email).toLowerCase();
  if(!validEmail(email)){
    await saleDoc.ref.set({welcome_email_status:'skipped_no_email',welcome_email_checked_at:FieldValue.serverTimestamp()},{merge:true});
    continue;
  }
  const trip=await loadTrip(sale.trip_id);
  if(trip&&isCancelled(trip))continue;
  const resendAnchor=stampMs(sale.welcome_email_resend_requested_at);
  const paidAnchor=stampMs(sale.payment_completed_at);
  const anchor=String(resendAnchor||paidAnchor||'first');
  const c=await claim({kind:'welcome_paid',sourceRef:saleDoc.ref,sourceType:'sale',anchor,email,validator:r=>saleFullyPaid(r)&&!(r.welcome_email_sent_at||r.welcome_email_status==='sent')});
  if(!c.claimed)continue;
  try{
    const payload=await sendResend({to:email,...welcomeTemplate(sale,trip),key:`welcome-${c.id}`});
    await markSent(c.ref,payload,email);
    await saleDoc.ref.set({welcome_email_status:'sent',welcome_email_sent_at:FieldValue.serverTimestamp(),welcome_email_resend_id:payload.id||'',welcome_email_to:email,welcome_email_version:4,welcome_email_error:FieldValue.delete()},{merge:true});
    salesSent++;
    console.log(`Boas-vindas enviado: ${sale.customer_name||email} • ${trip?.name||sale.trip_name||'passeio'}`);
  }catch(err){
    salesFailed++;
    const msg=await markFailure(c.ref,err,c.attempt);
    await saleDoc.ref.set({welcome_email_status:'error',welcome_email_error:msg,welcome_email_last_attempt_at:FieldValue.serverTimestamp()},{merge:true}).catch(()=>{});
    console.error(`Falha boas-vindas ${sale.id}: ${msg}`);
  }
}

const tripsSnap=await db.collection('trips').limit(300).get();
for(const tripDoc of tripsSnap.docs){
  const trip={id:tripDoc.id,...tripDoc.data()};
  if(isCancelled(trip))continue;
  let reservations;
  try{reservations=await tripDoc.ref.collection('reservations').where('registration_source','==','direct_trip_link').limit(500).get()}
  catch(err){console.error(`Falha ao consultar cadastros de ${trip.name||trip.id}: ${String(err?.message||err)}`);directFailed++;continue}
  for(const resDoc of reservations.docs){
    const reservation={id:resDoc.id,...resDoc.data()};
    if(norm(reservation.registration_status)!=='completed'||isCancelled(reservation))continue;
    if(reservation.registration_email_sent_at||reservation.registration_email_status==='sent')continue;
    const email=clean(reservation.email).toLowerCase();
    if(!validEmail(email)){
      await resDoc.ref.set({registration_email_status:'skipped_no_email',registration_email_checked_at:FieldValue.serverTimestamp()},{merge:true});
      continue;
    }
    const anchor=String(stampMs(reservation.registration_completed_at)||'first');
    const c=await claim({kind:'registration_confirmed',sourceRef:resDoc.ref,sourceType:'reservation',anchor,email,validator:r=>norm(r.registration_status)==='completed'&&!isCancelled(r)&&!(r.registration_email_sent_at||r.registration_email_status==='sent')});
    if(!c.claimed)continue;
    try{
      const payload=await sendResend({to:email,...registrationTemplate(reservation,trip),key:`registration-${c.id}`});
      await markSent(c.ref,payload,email);
      await resDoc.ref.set({registration_email_status:'sent',registration_email_sent_at:FieldValue.serverTimestamp(),registration_email_resend_id:payload.id||'',registration_email_to:email,registration_email_version:2,registration_email_error:FieldValue.delete()},{merge:true});
      directSent++;
      console.log(`Cadastro confirmado por e-mail: ${reservation.name||email} • ${trip.name||trip.id}`);
    }catch(err){
      directFailed++;
      const msg=await markFailure(c.ref,err,c.attempt);
      await resDoc.ref.set({registration_email_status:'error',registration_email_error:msg,registration_email_last_attempt_at:FieldValue.serverTimestamp()},{merge:true}).catch(()=>{});
      console.error(`Falha cadastro ${trip.id}/${reservation.id}: ${msg}`);
    }
  }
}

console.log(`Processamento concluído: boas-vindas ${salesSent} enviada(s), ${salesFailed} falha(s); cadastros ${directSent} enviado(s), ${directFailed} falha(s).`);
if(salesFailed||directFailed)process.exitCode=1;
