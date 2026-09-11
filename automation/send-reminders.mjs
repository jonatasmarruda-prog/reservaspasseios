import admin from 'firebase-admin';
import { createHash } from 'node:crypto';

const rawService=process.env.FIREBASE_SERVICE_ACCOUNT||'';
const resendKey=process.env.RESEND_API_KEY||'';
const emailFrom=process.env.EMAIL_FROM||'';
const LOGO='https://i.postimg.cc/JnF2F9Hw/LOGO-TRILHEIROS-Photoroom.png';
const WHATSAPP='5566996926174';
const GOOGLE_REVIEW_URL='https://g.page/r/CcB9GU8M5QY6EAE/review';
const TZ='America/Cuiaba';
const HOUR=60*60*1000;
const LOCK_MS=20*60*1000;
const MAX_ATTEMPTS=6;

if(!rawService||!resendKey||!emailFrom){
  console.error('Automação de e-mails não configurada: faltam FIREBASE_SERVICE_ACCOUNT, RESEND_API_KEY ou EMAIL_FROM.');
  process.exit(1);
}
let service;
try{service=JSON.parse(rawService)}catch{console.error('FIREBASE_SERVICE_ACCOUNT não é JSON válido.');process.exit(1)}
if(!admin.apps.length)admin.initializeApp({credential:admin.credential.cert(service)});
const db=admin.firestore();
const FieldValue=admin.firestore.FieldValue;

const clean=v=>String(v??'').trim();
const norm=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const num=v=>Math.max(0,Number(v||0)||0);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const validEmail=v=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(v));
const firstName=v=>clean(v||'Trilheiro').split(/\s+/)[0]||'Trilheiro';

function stampMs(v){try{if(!v)return 0;if(typeof v.toMillis==='function')return v.toMillis();if(typeof v.toDate==='function')return v.toDate().getTime();if(v.seconds)return Number(v.seconds)*1000;const d=new Date(v);return Number.isNaN(d.getTime())?0:d.getTime()}catch{return 0}}
function anyStatus(v){return[v?.status,v?.sale_status,v?.trip_status,v?.registration_status].map(norm).filter(Boolean)}
function isCancelled(v){const bad=new Set(['cancelled','canceled','cancelado','cancelada','inactive','inativo','inativa']);return anyStatus(v).some(s=>bad.has(s))}
function paidInFull(s){
  if(!s||isCancelled(s))return false;
  const status=norm(s.payment_status||''),total=num(s.sale_total||s.total_amount||s.amount),received=num(s.paid_amount||s.amount_paid||s.received_amount);
  const raw=Number(s.balance_due),balance=Number.isFinite(raw)?Math.max(0,raw):Math.max(0,total-received);
  const explicit=['paid','confirmed','approved','completed','pago','quitado'].includes(status)||s.payment_confirmed===true;
  return balance<=0.009&&(explicit||(total>0&&received>=total-0.009)||!!s.payment_completed_at);
}
function safeUrl(v){try{const u=new URL(clean(v));return u.protocol==='https:'?u.toString():''}catch{return''}}
function isoDate(v){
  if(!v)return'';
  if(typeof v==='string'&&/^\d{4}-\d{2}-\d{2}/.test(v))return v.slice(0,10);
  const ms=stampMs(v);if(!ms)return'';
  const p=new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(ms));
  const get=t=>p.find(x=>x.type===t)?.value;return`${get('year')}-${get('month')}-${get('day')}`;
}
function localToday(){return new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
function dayNumber(iso){if(!/^\d{4}-\d{2}-\d{2}$/.test(iso))return NaN;const[y,m,d]=iso.split('-').map(Number);return Math.floor(Date.UTC(y,m-1,d)/86400000)}
function daysBetween(a,b){return dayNumber(b)-dayNumber(a)}
function brDate(v){const s=isoDate(v);if(!s)return'Data a confirmar';const[y,m,d]=s.split('-');return`${d}/${m}/${y}`}
function dateRange(trip){const start=isoDate(trip?.trip_date),end=isoDate(trip?.trip_end_date);return end&&end!==start?`${brDate(start)} a ${brDate(end)}`:brDate(start)}
function participantNames(sale){const rows=Array.isArray(sale?.participants)?sale.participants:[];const names=rows.map(x=>clean(x?.full_name||x?.name)).filter(Boolean);return names.length?names:(clean(sale?.customer_name)?[clean(sale.customer_name)]:[])}
function whatsappUrl(sale,trip){const msg=`Olá Jonatas! Estou falando sobre o passeio ${clean(trip?.name||sale?.trip_name)||'dos Trilheiros'}. Protocolo: ${clean(sale?.protocol)||'não informado'}.`;return`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`}
function dispatchId(kind,saleId,tripId,anchor){return createHash('sha256').update(`${kind}|${saleId}|${tripId}|${anchor}`).digest('hex')}
function backoffMs(attempt){return Math.min(12*HOUR,Math.max(15*60*1000,(2**Math.max(0,attempt-1))*15*60*1000))}

async function sendResend({to,subject,html,text,key}){
  let lastErr;
  for(let attempt=1;attempt<=3;attempt++){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
    try{
      const resp=await fetch('https://api.resend.com/emails',{method:'POST',signal:controller.signal,headers:{Authorization:`Bearer ${resendKey}`,'Content-Type':'application/json','Idempotency-Key':key},body:JSON.stringify({from:emailFrom,to:[to],reply_to:'trilheiros.roomt@gmail.com',subject,html,text})});
      const body=await resp.text();if(resp.ok){try{return JSON.parse(body||'{}')}catch{return{}}}
      const err=new Error(`Resend ${resp.status}: ${body.slice(0,700)}`);err.retryable=resp.status===408||resp.status===409||resp.status===429||resp.status>=500;throw err;
    }catch(err){lastErr=err;const retryable=err?.name==='AbortError'||err?.retryable===true;if(!retryable||attempt===3)break;await new Promise(r=>setTimeout(r,attempt*1200))}finally{clearTimeout(timer)}
  }
  throw lastErr||new Error('Falha desconhecida no Resend');
}

function preTemplate(sale,trip,days){
  const customer=clean(sale.customer_name)||participantNames(sale)[0]||'Trilheiro',tripName=clean(trip.name||sale.trip_name)||'seu passeio';
  const destination=clean(trip.destination)||'Destino a confirmar',departure=clean(trip.departure_time)||'A confirmar',point=clean(trip.departure_point)||'A confirmar',returnInfo=clean(trip.return_info||trip.return_time)||'A confirmar';
  const bring=clean(trip.what_to_bring||trip.reminder_notes)||'Confira no grupo do passeio as orientações finais.',participants=participantNames(sale).join(' • ')||customer,group=safeUrl(trip.whatsapp_group_url||trip.group_url||trip.whatsapp_url),wa=whatsappUrl(sale,trip);
  const headline=days===1?'É amanhã! 🥾':'Faltam 3 dias! 🥾';
  const subject=days===1?`🥾 É amanhã: ${tripName}`:`🥾 Faltam 3 dias: ${tripName}`;
  const html=`<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head><body style="margin:0;background:#eef4f1;font-family:Arial,Helvetica,sans-serif;color:#17372d"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:660px;background:#fff;border:1px solid #d9e5df;border-radius:20px"><tr><td align="center" bgcolor="#073226" style="background-color:#073226;padding:28px 24px"><img src="${LOGO}" alt="Trilheiros de Rondonópolis" width="150" height="150" border="0" style="display:block;width:150px;height:150px"><p style="font-size:12px;line-height:18px;color:#d9b44c;font-weight:700;margin:10px 0 0">ORIENTAÇÕES PRÉ-TRILHA</p><h1 style="font-size:28px;line-height:34px;color:#fff;margin:8px 0 0">${headline}</h1></td></tr><tr><td style="padding:26px 24px"><p style="font-size:15px;line-height:24px">Olá, <b>${esc(firstName(customer))}</b>!</p><h2 style="font-size:22px;line-height:28px;color:#073226">${esc(tripName)}</h2><p style="font-size:14px;line-height:21px;color:#657b72">📍 ${esc(destination)}</p><p style="font-size:15px;line-height:24px"><b>Data:</b> ${esc(dateRange(trip))}<br><b>Saída:</b> ${esc(departure)}<br><b>Ponto de encontro:</b> ${esc(point)}<br><b>Retorno:</b> ${esc(returnInfo)}<br><b>Participante(s):</b> ${esc(participants)}</p><p style="font-size:15px;line-height:24px"><b>O que levar / orientações:</b><br>${esc(bring).replace(/\r?\n/g,'<br>')}</p>${group?`<p style="font-size:14px;line-height:22px"><a href="${esc(group)}" style="color:#0b684b;font-weight:700">Abrir grupo do passeio</a></p>`:''}<p style="font-size:14px;line-height:22px"><a href="${esc(wa)}" style="color:#0b684b;font-weight:700">Falar com Jonatas no WhatsApp</a></p></td></tr></table></td></tr></table></body></html>`;
  const text=`Olá, ${firstName(customer)}!\n\n${days===1?'É amanhã!':'Faltam 3 dias!'}\n${tripName}\nData: ${dateRange(trip)}\nDestino: ${destination}\nSaída: ${departure}\nPonto de encontro: ${point}\nRetorno: ${returnInfo}\nParticipante(s): ${participants}\n\nO que levar / orientações:\n${bring}${group?`\n\nGrupo do passeio: ${group}`:''}\n\nDúvidas: Jonatas — (66) 99692-6174.`;
  return{subject,html,text};
}
function postTemplate(sale,trip){
  const customer=clean(sale.customer_name)||participantNames(sale)[0]||'Trilheiro',tripName=clean(trip.name||sale.trip_name)||'seu passeio',photos=safeUrl(trip.photos_url||trip.photo_drive_url||trip.drive_photos_url||trip.google_drive_photos_url);
  const subject=`⭐ Como foi sua experiência? — ${tripName}`;
  const html=`<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head><body style="margin:0;background:#eef4f1;font-family:Arial,Helvetica,sans-serif;color:#17372d"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:660px;background:#fff;border:1px solid #d9e5df;border-radius:20px"><tr><td align="center" bgcolor="#073226" style="background-color:#073226;padding:28px 24px"><img src="${LOGO}" alt="Trilheiros de Rondonópolis" width="150" height="150" border="0" style="display:block;width:150px;height:150px"><p style="font-size:12px;line-height:18px;color:#d9b44c;font-weight:700;margin:10px 0 0">PÓS-PASSEIO</p><h1 style="font-size:28px;line-height:34px;color:#fff;margin:8px 0 0">Obrigado, ${esc(firstName(customer))}! 💚</h1></td></tr><tr><td style="padding:26px 24px"><h2 style="font-size:22px;line-height:28px;color:#073226">${esc(tripName)}</h2><p style="font-size:15px;line-height:24px">Esperamos que essa experiência tenha rendido boas histórias e lembranças especiais. Sua avaliação ajuda outras pessoas a conhecerem nosso trabalho.</p><table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td bgcolor="#0b684b" style="background-color:#0b684b;border-radius:12px"><a href="${GOOGLE_REVIEW_URL}" style="display:inline-block;padding:14px 22px;color:#fff;text-decoration:none;font-size:15px;font-weight:800">⭐ Avaliar no Google</a></td></tr></table>${photos?`<p style="font-size:15px;line-height:24px;text-align:center"><a href="${esc(photos)}" style="color:#0b684b;font-weight:700">📸 Ver fotos do passeio</a></p>`:''}<p style="font-size:13px;line-height:20px;color:#657b72;text-align:center">Trilheiros de Rondonópolis • Aqui ninguém vai só. 🥾💚</p></td></tr></table></td></tr></table></body></html>`;
  const text=`Olá, ${firstName(customer)}!\n\nObrigado por participar de ${tripName}.\n\nAvalie os Trilheiros de Rondonópolis no Google:\n${GOOGLE_REVIEW_URL}${photos?`\n\nFotos do passeio:\n${photos}`:''}\n\nTrilheiros de Rondonópolis — Aqui ninguém vai só.`;
  return{subject,html,text};
}

async function claimDispatch({kind,saleRef,tripRef,anchor,email}){
  const id=dispatchId(kind,saleRef.id,tripRef.id,anchor),ref=db.collection('email_dispatches').doc(id);let claimed=false,attempt=0;
  await db.runTransaction(async tx=>{
    const saleSnap=await tx.get(saleRef),tripSnap=await tx.get(tripRef),dispatchSnap=await tx.get(ref);if(!saleSnap.exists||!tripSnap.exists)return;
    const sale={id:saleSnap.id,...saleSnap.data()},trip={id:tripSnap.id,...tripSnap.data()};if(isCancelled(sale)||isCancelled(trip)||!paidInFull(sale))return;
    const d=dispatchSnap.exists?dispatchSnap.data()||{}:{};if(d.status==='sent')return;const attempts=Number(d.attempts||0);if(attempts>=MAX_ATTEMPTS)return;
    const last=stampMs(d.last_attempt_at),next=stampMs(d.next_retry_at);if(d.status==='sending'&&last&&Date.now()-last<LOCK_MS)return;if(next&&Date.now()<next)return;
    attempt=attempts+1;tx.set(ref,{kind,status:'sending',sale_id:saleRef.id,trip_id:tripRef.id,event_anchor:anchor,email,attempts:attempt,last_attempt_at:FieldValue.serverTimestamp(),updated_at:FieldValue.serverTimestamp(),created_at:d.created_at||FieldValue.serverTimestamp(),error:FieldValue.delete()},{merge:true});claimed=true;
  });return{claimed,ref,id,attempt};
}
async function markFailure(ref,err,attempt){const message=String(err?.message||err).slice(0,900);await ref.set({status:'error',error:message,failed_at:FieldValue.serverTimestamp(),next_retry_at:admin.firestore.Timestamp.fromDate(new Date(Date.now()+backoffMs(attempt))),updated_at:FieldValue.serverTimestamp()},{merge:true}).catch(()=>{});return message}
async function markSent(ref,payload,email){await ref.set({status:'sent',sent_at:FieldValue.serverTimestamp(),resend_id:payload?.id||'',email,updated_at:FieldValue.serverTimestamp(),next_retry_at:FieldValue.delete(),error:FieldValue.delete()},{merge:true})}

const today=localToday();
const [salesSnap,tripsSnap]=await Promise.all([db.collection('sales').limit(1500).get(),db.collection('trips').limit(500).get()]);
const trips=new Map(tripsSnap.docs.map(d=>[d.id,{ref:d.ref,data:{id:d.id,...d.data()}}]));
let pre3Sent=0,pre1Sent=0,postSent=0,failed=0,skipped=0,missingDate=0;

for(const saleDoc of salesSnap.docs){
  const sale={id:saleDoc.id,...saleDoc.data()},tripEntry=trips.get(sale.trip_id);if(!tripEntry){skipped++;continue}
  const {ref:tripRef,data:trip}=tripEntry;if(isCancelled(sale)||isCancelled(trip)||!paidInFull(sale)){skipped++;continue}
  const email=clean(sale.customer_email||sale.email).toLowerCase();if(!validEmail(email)){skipped++;continue}
  const start=isoDate(trip.trip_date),end=isoDate(trip.trip_end_date||trip.trip_date);if(!start){missingDate++;continue}
  const daysUntil=daysBetween(today,start),daysAfter=end?daysBetween(end,today):NaN;

  if(trip.email_reminder_enabled!==false&&daysUntil===3){
    const c=await claimDispatch({kind:'pre_trip_3d',saleRef:saleDoc.ref,tripRef,anchor:start,email});
    if(c.claimed)try{const payload=await sendResend({to:email,...preTemplate(sale,trip,3),key:`pre3-${c.id}`});await markSent(c.ref,payload,email);await saleDoc.ref.set({trip_reminder_3d_status:'sent',trip_reminder_3d_sent_at:FieldValue.serverTimestamp(),trip_reminder_3d_resend_id:payload.id||'',trip_reminder_3d_to:email,trip_reminder_3d_error:FieldValue.delete()},{merge:true});pre3Sent++}catch(err){failed++;const msg=await markFailure(c.ref,err,c.attempt);await saleDoc.ref.set({trip_reminder_3d_status:'error',trip_reminder_3d_error:msg,trip_reminder_3d_last_attempt_at:FieldValue.serverTimestamp()},{merge:true}).catch(()=>{})}
  }
  if(trip.email_reminder_enabled!==false&&daysUntil===1){
    const c=await claimDispatch({kind:'pre_trip_1d',saleRef:saleDoc.ref,tripRef,anchor:start,email});
    if(c.claimed)try{const payload=await sendResend({to:email,...preTemplate(sale,trip,1),key:`pre1-${c.id}`});await markSent(c.ref,payload,email);await saleDoc.ref.set({trip_reminder_status:'sent',trip_reminder_for:start,trip_reminder_sent_at:FieldValue.serverTimestamp(),trip_reminder_resend_id:payload.id||'',trip_reminder_to:email,trip_reminder_error:FieldValue.delete()},{merge:true});pre1Sent++}catch(err){failed++;const msg=await markFailure(c.ref,err,c.attempt);await saleDoc.ref.set({trip_reminder_status:'error',trip_reminder_error:msg,trip_reminder_last_attempt_at:FieldValue.serverTimestamp()},{merge:true}).catch(()=>{})}
  }
  if(trip.post_trip_enabled!==false&&daysAfter===1){
    const c=await claimDispatch({kind:'post_trip_1d',saleRef:saleDoc.ref,tripRef,anchor:end,email});
    if(c.claimed)try{const payload=await sendResend({to:email,...postTemplate(sale,trip),key:`post1-${c.id}`});await markSent(c.ref,payload,email);await saleDoc.ref.set({post_trip_email_status:'sent',post_trip_email_sent_at:FieldValue.serverTimestamp(),post_trip_email_resend_id:payload.id||'',post_trip_email_to:email,post_trip_email_error:FieldValue.delete()},{merge:true});postSent++}catch(err){failed++;const msg=await markFailure(c.ref,err,c.attempt);await saleDoc.ref.set({post_trip_email_status:'error',post_trip_email_error:msg,post_trip_email_last_attempt_at:FieldValue.serverTimestamp()},{merge:true}).catch(()=>{})}
  }
}

console.log(`Automação concluída. Pré 3 dias=${pre3Sent} | Pré 1 dia=${pre1Sent} | Pós 1 dia=${postSent} | Falhas=${failed} | Ignorados=${skipped} | Sem data=${missingDate}`);
if(failed)process.exitCode=1;
