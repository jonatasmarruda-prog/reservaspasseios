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
  console.error('Automação de lembrete/pós-trilha não configurada: faltam FIREBASE_SERVICE_ACCOUNT, RESEND_API_KEY ou EMAIL_FROM.');
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

function stampMs(v){
  try{
    if(!v)return 0;
    if(typeof v.toMillis==='function')return v.toMillis();
    if(typeof v.toDate==='function')return v.toDate().getTime();
    if(v.seconds)return Number(v.seconds)*1000;
    const d=new Date(v);
    return Number.isNaN(d.getTime())?0:d.getTime();
  }catch{return 0}
}
function anyStatus(v){
  return [v?.status,v?.sale_status,v?.trip_status,v?.registration_status].map(norm).filter(Boolean);
}
function isCancelled(v){
  const cancelled=new Set(['cancelled','canceled','cancelado','cancelada','inactive','inativo','inativa','encerrado','encerrada']);
  return anyStatus(v).some(s=>cancelled.has(s));
}
function paidInFull(s){
  if(!s||isCancelled(s))return false;
  const payment=norm(s.payment_status||'');
  const total=num(s.sale_total||s.total_amount||s.amount);
  const received=num(s.paid_amount||s.amount_paid||s.received_amount);
  const rawBalance=Number(s.balance_due);
  const balance=Number.isFinite(rawBalance)?Math.max(0,rawBalance):Math.max(0,total-received);
  const explicit=['paid','confirmed','approved','completed','pago','quitado'].includes(payment)||s.payment_confirmed===true;
  const settledByValue=total>0&&received>=total-0.009;
  return balance<=0.009&&(explicit||settledByValue||!!s.payment_completed_at);
}
function safeUrl(v){
  const raw=clean(v);
  if(!raw)return'';
  try{
    const u=new URL(raw);
    return u.protocol==='https:'?u.toString():'';
  }catch{return''}
}
function isoDate(v){
  if(!v)return'';
  if(typeof v==='string'&&/^\d{4}-\d{2}-\d{2}/.test(v))return v.slice(0,10);
  const ms=stampMs(v);
  if(!ms)return'';
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(ms));
  const get=t=>parts.find(p=>p.type===t)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
function brDate(v){
  const s=isoDate(v);
  if(!s)return'Data a confirmar';
  const [y,m,d]=s.split('-');
  return `${d}/${m}/${y}`;
}
function dateRange(trip){
  const start=trip?.trip_date||'';
  const end=trip?.trip_end_date||'';
  return end&&isoDate(end)!==isoDate(start)?`${brDate(start)} a ${brDate(end)}`:brDate(start);
}
function parseClock(v){
  const s=clean(v);
  if(!s)return null;
  const m=s.match(/(?:^|\D)([01]?\d|2[0-3])(?:[:hH.]([0-5]\d))?(?:\D|$)/);
  return m?{hour:Number(m[1]),minute:Number(m[2]||0)}:null;
}
function zonedLocalToUtc(dateIso,clock){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)||!clock)return null;
  const [y,m,d]=dateIso.split('-').map(Number);
  let guess=Date.UTC(y,m-1,d,clock.hour,clock.minute,0,0);
  for(let i=0;i<3;i++){
    const parts=new Intl.DateTimeFormat('en-US',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(guess));
    const get=t=>Number(parts.find(p=>p.type===t)?.value);
    const represented=Date.UTC(get('year'),get('month')-1,get('day'),get('hour'),get('minute'),get('second'));
    const wanted=Date.UTC(y,m-1,d,clock.hour,clock.minute,0);
    guess+=wanted-represented;
  }
  return new Date(guess);
}
function directDate(v){const ms=stampMs(v);return ms?new Date(ms):null}
function eventStart(trip){
  const direct=directDate(trip.event_start_at||trip.start_at);
  if(direct)return direct;
  const date=isoDate(trip.trip_date);
  const clock=parseClock(trip.departure_time||trip.start_time||trip.event_time);
  return date&&clock?zonedLocalToUtc(date,clock):null;
}
function eventEnd(trip){
  const direct=directDate(trip.event_end_at||trip.end_at);
  if(direct)return direct;
  const date=isoDate(trip.trip_end_date||trip.trip_date);
  const clock=parseClock(trip.return_time||trip.event_end_time||trip.return_info);
  return date&&clock?zonedLocalToUtc(date,clock):null;
}
function participantNames(sale){
  const rows=Array.isArray(sale?.participants)?sale.participants:[];
  const names=rows.map(x=>clean(x?.full_name||x?.name)).filter(Boolean);
  return names.length?names:(clean(sale?.customer_name)?[clean(sale.customer_name)]:[]);
}
function whatsappUrl(sale,trip){
  const msg=`Olá Jonatas! Estou falando sobre o passeio ${clean(trip?.name||sale?.trip_name)||'dos Trilheiros'}. Protocolo: ${clean(sale?.protocol)||'não informado'}.`;
  return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`;
}
function dispatchId(kind,saleId,tripId,anchor){return createHash('sha256').update(`${kind}|${saleId}|${tripId}|${anchor}`).digest('hex')}
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

function preTemplate(sale,trip){
  const customer=clean(sale.customer_name)||participantNames(sale)[0]||'Trilheiro';
  const tripName=clean(trip.name||sale.trip_name)||'seu passeio';
  const destination=clean(trip.destination)||'Destino a confirmar';
  const departure=clean(trip.departure_time)||'A confirmar';
  const point=clean(trip.departure_point)||'A confirmar';
  const returnInfo=clean(trip.return_info||trip.return_time)||'A confirmar';
  const bring=clean(trip.what_to_bring||trip.reminder_notes)||'Confira no grupo do passeio as orientações finais.';
  const participants=participantNames(sale).join(' • ')||customer;
  const group=safeUrl(trip.whatsapp_group_url||trip.group_url||trip.whatsapp_url);
  const wa=whatsappUrl(sale,trip);
  const subject=`🥾 Orientações pré-trilha: ${tripName}`;
  const html=`<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head><body style="margin:0;background:#eef4f1;font-family:Arial,Helvetica,sans-serif;color:#17372d"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#eef4f1"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:660px;background:#fff;border:1px solid #d9e5df;border-radius:20px"><tr><td align="center" bgcolor="#073226" style="background-color:#073226;padding:28px 24px"><img src="${LOGO}" alt="Trilheiros de Rondonópolis" width="150" height="150" border="0" style="display:block;width:150px;height:150px;object-fit:contain"><p style="font-size:12px;line-height:18px;color:#d9b44c;font-weight:700;margin:10px 0 0">ORIENTAÇÕES PRÉ-TRILHA</p><h1 style="font-size:28px;line-height:34px;color:#fff;margin:8px 0 0">Falta pouco, ${esc(firstName(customer))}! 🥾</h1></td></tr><tr><td style="padding:26px 24px"><h2 style="font-size:22px;line-height:28px;color:#073226;margin:0 0 6px">${esc(tripName)}</h2><p style="font-size:14px;line-height:21px;color:#657b72;margin:0 0 18px">📍 ${esc(destination)}</p><p style="font-size:15px;line-height:24px;margin:0 0 8px"><b>Data:</b> ${esc(dateRange(trip))}</p><p style="font-size:15px;line-height:24px;margin:0 0 8px"><b>Saída:</b> ${esc(departure)}</p><p style="font-size:15px;line-height:24px;margin:0 0 8px"><b>Ponto de encontro:</b> ${esc(point)}</p><p style="font-size:15px;line-height:24px;margin:0 0 8px"><b>Retorno:</b> ${esc(returnInfo)}</p><p style="font-size:15px;line-height:24px;margin:0 0 18px"><b>Participante(s):</b> ${esc(participants)}</p><p style="font-size:15px;line-height:24px;margin:0 0 8px"><b>O que levar / orientações:</b></p><p style="font-size:14px;line-height:22px;color:#50685e;margin:0 0 22px">${esc(bring).replace(/\r?\n/g,'<br>')}</p>${group?`<p style="font-size:14px;line-height:22px;margin:0 0 14px"><a href="${esc(group)}" style="color:#0b684b;font-weight:700">Abrir grupo do passeio</a></p>`:''}<p style="font-size:14px;line-height:22px;margin:0"><a href="${esc(wa)}" style="color:#0b684b;font-weight:700">Falar com Jonatas no WhatsApp</a></p></td></tr></table></td></tr></table></body></html>`;
  const text=`Olá, ${firstName(customer)}!\n\nOrientações pré-trilha — ${tripName}\nData: ${dateRange(trip)}\nDestino: ${destination}\nSaída: ${departure}\nPonto de encontro: ${point}\nRetorno: ${returnInfo}\nParticipante(s): ${participants}\n\nO que levar / orientações:\n${bring}${group?`\n\nGrupo do passeio: ${group}`:''}\n\nDúvidas: Jonatas — (66) 99692-6174.`;
  return {subject,html,text};
}
function postTemplate(sale,trip){
  const customer=clean(sale.customer_name)||participantNames(sale)[0]||'Trilheiro';
  const tripName=clean(trip.name||sale.trip_name)||'seu passeio';
  const photos=safeUrl(trip.photos_url||trip.photo_drive_url||trip.drive_photos_url||trip.google_drive_photos_url);
  const subject=`⭐ Avalie sua experiência com os Trilheiros — ${tripName}`;
  const html=`<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head><body style="margin:0;background:#eef4f1;font-family:Arial,Helvetica,sans-serif;color:#17372d"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#eef4f1"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:660px;background:#fff;border:1px solid #d9e5df;border-radius:20px"><tr><td align="center" bgcolor="#073226" style="background-color:#073226;padding:28px 24px"><img src="${LOGO}" alt="Trilheiros de Rondonópolis" width="150" height="150" border="0" style="display:block;width:150px;height:150px;object-fit:contain"><p style="font-size:12px;line-height:18px;color:#d9b44c;font-weight:700;margin:10px 0 0">PÓS-TRILHA</p><h1 style="font-size:28px;line-height:34px;color:#fff;margin:8px 0 0">Obrigado por caminhar com a gente, ${esc(firstName(customer))}! 💚</h1></td></tr><tr><td style="padding:26px 24px"><h2 style="font-size:22px;line-height:28px;color:#073226;margin:0 0 10px">${esc(tripName)}</h2><p style="font-size:15px;line-height:24px;color:#17372d;margin:0 0 18px">Esperamos que essa experiência tenha rendido boas histórias, superação e lembranças especiais.</p><p style="font-size:15px;line-height:24px;color:#17372d;margin:0 0 18px">Sua avaliação é muito importante para nós e ajuda outras pessoas a conhecerem o trabalho dos Trilheiros de Rondonópolis.</p><table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td bgcolor="#0b684b" style="background-color:#0b684b;border-radius:12px"><a href="${GOOGLE_REVIEW_URL}" style="display:inline-block;padding:14px 22px;color:#fff;text-decoration:none;font-size:15px;font-weight:800">⭐ Avaliar os Trilheiros no Google</a></td></tr></table>${photos?`<p style="font-size:15px;line-height:24px;text-align:center;margin:22px 0 0"><a href="${esc(photos)}" style="color:#0b684b;font-weight:700">📸 Ver fotos do passeio</a></p>`:''}<p style="font-size:13px;line-height:20px;color:#657b72;text-align:center;margin:24px 0 0">Aqui ninguém vai só. 🥾💚</p></td></tr></table></td></tr></table></body></html>`;
  const text=`Olá, ${firstName(customer)}!\n\nObrigado por participar de ${tripName}.\nEsperamos que tenha sido uma experiência incrível.\n\nAvalie os Trilheiros de Rondonópolis no Google:\n${GOOGLE_REVIEW_URL}${photos?`\n\nFotos do passeio:\n${photos}`:''}\n\nSua opinião ajuda outras pessoas a conhecerem nosso trabalho.\n\nTrilheiros de Rondonópolis — Aqui ninguém vai só.`;
  return {subject,html,text};
}

async function claimDispatch({kind,saleRef,tripRef,anchor,email}){
  const id=dispatchId(kind,saleRef.id,tripRef.id,anchor);
  const ref=db.collection('email_dispatches').doc(id);
  let claimed=false,attempt=0;
  await db.runTransaction(async tx=>{
    const saleSnap=await tx.get(saleRef);
    const tripSnap=await tx.get(tripRef);
    const dispatchSnap=await tx.get(ref);
    if(!saleSnap.exists||!tripSnap.exists)return;
    const sale={id:saleSnap.id,...saleSnap.data()};
    const trip={id:tripSnap.id,...tripSnap.data()};
    if(isCancelled(sale)||isCancelled(trip)||!paidInFull(sale))return;
    const d=dispatchSnap.exists?dispatchSnap.data()||{}:{};
    if(d.status==='sent')return;
    const attempts=Number(d.attempts||0);
    if(attempts>=MAX_ATTEMPTS)return;
    const last=stampMs(d.last_attempt_at),next=stampMs(d.next_retry_at);
    if(d.status==='sending'&&last&&Date.now()-last<LOCK_MS)return;
    if(next&&Date.now()<next)return;
    attempt=attempts+1;
    tx.set(ref,{kind,status:'sending',sale_id:saleRef.id,trip_id:tripRef.id,event_anchor:anchor,email,attempts:attempt,last_attempt_at:FieldValue.serverTimestamp(),updated_at:FieldValue.serverTimestamp(),created_at:d.created_at||FieldValue.serverTimestamp(),error:FieldValue.delete()},{merge:true});
    claimed=true;
  });
  return {claimed,ref,id,attempt};
}
async function markFailure(ref,err,attempt){
  const message=String(err?.message||err).slice(0,900);
  const next=new Date(Date.now()+backoffMs(attempt));
  await ref.set({status:'error',error:message,failed_at:FieldValue.serverTimestamp(),next_retry_at:admin.firestore.Timestamp.fromDate(next),updated_at:FieldValue.serverTimestamp()},{merge:true}).catch(()=>{});
  return message;
}
async function markSent(ref,payload,email){
  await ref.set({status:'sent',sent_at:FieldValue.serverTimestamp(),resend_id:payload?.id||'',email,updated_at:FieldValue.serverTimestamp(),next_retry_at:FieldValue.delete(),error:FieldValue.delete()},{merge:true});
}

const nowMs=Date.now();
const [salesSnap,tripsSnap]=await Promise.all([db.collection('sales').limit(1000).get(),db.collection('trips').limit(300).get()]);
const trips=new Map(tripsSnap.docs.map(d=>[d.id,{ref:d.ref,data:{id:d.id,...d.data()}}]));
let preSent=0,postSent=0,failed=0,skipped=0,missingSchedule=0;

for(const saleDoc of salesSnap.docs){
  const sale={id:saleDoc.id,...saleDoc.data()};
  const tripEntry=trips.get(sale.trip_id);
  if(!tripEntry){skipped++;continue}
  const {ref:tripRef,data:trip}=tripEntry;
  if(isCancelled(sale)||isCancelled(trip)||!paidInFull(sale)){skipped++;continue}
  const email=clean(sale.customer_email||sale.email).toLowerCase();
  if(!validEmail(email)){skipped++;continue}

  const start=eventStart(trip);
  if(start){
    const untilStart=start.getTime()-nowMs;
    if(untilStart>=24*HOUR&&untilStart<=48*HOUR&&trip.email_reminder_enabled!==false){
      const claim=await claimDispatch({kind:'pre_trip',saleRef:saleDoc.ref,tripRef,anchor:start.toISOString(),email});
      if(claim.claimed){
        try{
          const payload=await sendResend({to:email,...preTemplate(sale,trip),key:`pre-${claim.id}`});
          await markSent(claim.ref,payload,email);
          await saleDoc.ref.set({trip_reminder_status:'sent',trip_reminder_for:isoDate(trip.trip_date),trip_reminder_sent_at:FieldValue.serverTimestamp(),trip_reminder_resend_id:payload.id||'',trip_reminder_to:email,trip_reminder_error:FieldValue.delete()},{merge:true});
          preSent++;
        }catch(err){
          failed++;
          const msg=await markFailure(claim.ref,err,claim.attempt);
          await saleDoc.ref.set({trip_reminder_status:'error',trip_reminder_error:msg,trip_reminder_last_attempt_at:FieldValue.serverTimestamp()},{merge:true}).catch(()=>{});
        }
      }
    }
  }else if(trip.email_reminder_enabled!==false){
    missingSchedule++;
    console.warn(`Pré-trilha sem horário estruturado: ${trip.name||trip.id}.`);
  }

  if(trip.post_trip_enabled===false)continue;
  const end=eventEnd(trip);
  if(end){
    const sinceEnd=nowMs-end.getTime();
    if(sinceEnd>=24*HOUR&&sinceEnd<=72*HOUR){
      const claim=await claimDispatch({kind:'post_trip',saleRef:saleDoc.ref,tripRef,anchor:end.toISOString(),email});
      if(claim.claimed){
        try{
          const payload=await sendResend({to:email,...postTemplate(sale,trip),key:`post-${claim.id}`});
          await markSent(claim.ref,payload,email);
          await saleDoc.ref.set({post_trip_email_status:'sent',post_trip_email_sent_at:FieldValue.serverTimestamp(),post_trip_email_resend_id:payload.id||'',post_trip_email_to:email,post_trip_email_error:FieldValue.delete()},{merge:true});
          postSent++;
        }catch(err){
          failed++;
          const msg=await markFailure(claim.ref,err,claim.attempt);
          await saleDoc.ref.set({post_trip_email_status:'error',post_trip_email_error:msg,post_trip_email_last_attempt_at:FieldValue.serverTimestamp()},{merge:true}).catch(()=>{});
        }
      }
    }
  }else{
    missingSchedule++;
    console.warn(`Pós-trilha sem horário de conclusão estruturado: ${trip.name||trip.id}.`);
  }
}

console.log(`Automação concluída. Pré-trilha=${preSent} | Pós-trilha=${postSent} | Falhas=${failed} | Ignorados=${skipped} | Agenda incompleta=${missingSchedule}`);
if(failed)process.exitCode=1;
