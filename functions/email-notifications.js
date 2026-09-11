import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import * as logger from 'firebase-functions/logger';
import { createHash } from 'node:crypto';

const db=getFirestore();
const REGION='southamerica-east1';
const RESEND_API_KEY=defineSecret('RESEND_API_KEY');
const EMAIL_FROM='Trilheiros de Rondonópolis <reservas@trilheirosderondonopolis.com.br>';
const EMAIL_REPLY_TO='trilheiros.roomt@gmail.com';
const LOGO='https://i.postimg.cc/JnF2F9Hw/LOGO-TRILHEIROS-Photoroom.png';
const WHATSAPP='5566996926174';

const clean=v=>String(v??'').trim();
const norm=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const validEmail=v=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(v));
const firstName=v=>clean(v||'Trilheiro').split(/\s+/)[0]||'Trilheiro';
const hash=v=>createHash('sha256').update(String(v||'')).digest('hex');

function isCancelled(v){
  const bad=new Set(['cancelled','canceled','cancelado','cancelada','inactive','inativo','inativa']);
  return [v?.status,v?.sale_status,v?.trip_status,v?.registration_status].map(norm).filter(Boolean).some(s=>bad.has(s));
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
  const name=clean(row?.responsible_name||row?.customer_name||row?.name);
  return name?[name]:[];
}

function registrationTemplate(reservation,trip){
  const name=clean(reservation.name||reservation.responsible_name)||participantNames(reservation)[0]||'Trilheiro';
  const tripName=clean(trip?.name||reservation.trip_name)||'seu próximo passeio';
  const names=participantNames(reservation);
  const date=brDate(trip?.trip_date||reservation.trip_date);
  const msg=`Olá Jonatas! Estou falando sobre o passeio ${tripName}. Protocolo: ${clean(reservation.protocol)||'não informado'}.`;
  const wa=`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`;
  const subject=`🥾 Cadastro confirmado: ${tripName}`;
  const html=`<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head><body style="margin:0;background:#eef4f1;font-family:Arial,Helvetica,sans-serif;color:#17372d"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;background:#fff;border:1px solid #d9e5df;border-radius:20px"><tr><td align="center" bgcolor="#073226" style="background-color:#073226;padding:28px 24px"><img src="${LOGO}" alt="Trilheiros de Rondonópolis" width="150" height="150" border="0" style="display:block;width:150px;height:150px;object-fit:contain"><p style="font-size:12px;line-height:18px;color:#d9b44c;font-weight:800;margin:10px 0 0">CADASTRO CONFIRMADO</p><h1 style="font-size:28px;line-height:34px;color:#fff;margin:8px 0 0">Tudo certo, ${esc(firstName(name))}! 🥾</h1></td></tr><tr><td style="padding:26px 24px"><h2 style="font-size:22px;line-height:28px;color:#073226;margin:0 0 14px">${esc(tripName)}</h2><p style="font-size:15px;line-height:24px;margin:0 0 8px"><b>Data:</b> ${esc(date)}</p><p style="font-size:15px;line-height:24px;margin:0 0 8px"><b>Participante(s):</b> ${esc(names.length?names.join(' • '):name)}</p><p style="font-size:15px;line-height:24px;margin:0 0 20px"><b>Protocolo:</b> ${esc(reservation.protocol||'—')}</p><p style="font-size:14px;line-height:22px;color:#50685e;margin:0 0 20px">Recebemos seus dados e seu cadastro foi concluído. Este e-mail confirma o cadastro; a situação financeira segue os registros do sistema.</p><table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td bgcolor="#0b684b" style="background-color:#0b684b;border-radius:12px"><a href="${esc(wa)}" style="display:inline-block;padding:14px 22px;color:#fff;text-decoration:none;font-size:15px;font-weight:800">Falar com Jonatas no WhatsApp</a></td></tr></table><p style="font-size:12px;line-height:19px;color:#71837c;text-align:center;margin:24px 0 0">Trilheiros de Rondonópolis • Aqui ninguém vai só. 🥾💚</p></td></tr></table></td></tr></table></body></html>`;
  const text=`Olá, ${firstName(name)}!\n\nRecebemos seu cadastro para ${tripName}.\nData: ${date}\nParticipante(s): ${names.length?names.join(', '):name}\nProtocolo: ${reservation.protocol||'—'}\n\nEste e-mail confirma o cadastro; a situação financeira segue os registros do sistema.\n\nDúvidas: Jonatas — (66) 99692-6174.`;
  return{subject,html,text};
}

async function sendRegistrationEmail(tripId,reservationId){
  const sourceRef=db.collection('trips').doc(tripId).collection('reservations').doc(reservationId);
  const sourceSnap=await sourceRef.get();
  if(!sourceSnap.exists)return{skipped:true,reason:'reservation_missing'};
  const reservation={id:sourceSnap.id,...sourceSnap.data()};
  if(norm(reservation.registration_source)!=='direct_trip_link'||norm(reservation.registration_status)!=='completed'||isCancelled(reservation))return{skipped:true,reason:'not_direct_completed'};

  const email=clean(reservation.email).toLowerCase();
  if(!validEmail(email)){
    await sourceRef.set({registration_email_status:'skipped_no_email',registration_email_checked_at:FieldValue.serverTimestamp()},{merge:true});
    return{skipped:true,reason:'no_email'};
  }

  const tripRef=db.collection('trips').doc(tripId);
  const tripSnap=await tripRef.get();
  if(!tripSnap.exists||isCancelled(tripSnap.data()||{}))return{skipped:true,reason:'trip_missing_or_cancelled'};
  const trip={id:tripSnap.id,...tripSnap.data()};

  const anchor=String(stampMs(reservation.registration_completed_at)||'first');
  const dispatchId=hash(`registration_confirmed|${sourceRef.path}|${anchor}`);
  const dispatchRef=db.collection('email_dispatches').doc(dispatchId);
  let claimed=false;
  await db.runTransaction(async tx=>{
    const [freshSource,freshDispatch]=await Promise.all([tx.get(sourceRef),tx.get(dispatchRef)]);
    if(!freshSource.exists)return;
    const row=freshSource.data()||{};
    if(norm(row.registration_source)!=='direct_trip_link'||norm(row.registration_status)!=='completed'||isCancelled(row))return;
    if(row.registration_email_sent_at||row.registration_email_status==='sent')return;
    const d=freshDispatch.exists?freshDispatch.data()||{}:{};
    if(d.status==='sent'||d.status==='sending')return;
    tx.set(dispatchRef,{kind:'registration_confirmed',source_type:'reservation',source_path:sourceRef.path,email,status:'sending',attempts:Number(d.attempts||0)+1,last_attempt_at:FieldValue.serverTimestamp(),updated_at:FieldValue.serverTimestamp(),created_at:d.created_at||FieldValue.serverTimestamp()},{merge:true});
    tx.set(sourceRef,{registration_email_status:'sending',registration_email_last_attempt_at:FieldValue.serverTimestamp()},{merge:true});
    claimed=true;
  });
  if(!claimed)return{skipped:true,reason:'already_claimed'};

  try{
    const key=RESEND_API_KEY.value();
    if(!key)throw new Error('RESEND_API_KEY não configurada.');
    const response=await fetch('https://api.resend.com/emails',{
      method:'POST',
      headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json','Idempotency-Key':`registration-${dispatchId}`},
      body:JSON.stringify({from:EMAIL_FROM,to:[email],reply_to:EMAIL_REPLY_TO,...registrationTemplate(reservation,trip)})
    });
    const raw=await response.text();
    if(!response.ok)throw new Error(`Resend ${response.status}: ${raw.slice(0,700)}`);
    let payload={};try{payload=JSON.parse(raw||'{}')}catch{}
    await Promise.all([
      dispatchRef.set({status:'sent',sent_at:FieldValue.serverTimestamp(),resend_id:payload.id||'',email,error:FieldValue.delete(),updated_at:FieldValue.serverTimestamp()},{merge:true}),
      sourceRef.set({registration_email_status:'sent',registration_email_sent_at:FieldValue.serverTimestamp(),registration_email_resend_id:payload.id||'',registration_email_to:email,registration_email_version:3,registration_email_error:FieldValue.delete()},{merge:true})
    ]);
    logger.info('Cadastro confirmado por e-mail imediatamente',{tripId,reservationId,email,resendId:payload.id||''});
    return{ok:true,id:payload.id||''};
  }catch(err){
    const message=String(err?.message||err).slice(0,900);
    await Promise.all([
      dispatchRef.set({status:'error',error:message,failed_at:FieldValue.serverTimestamp(),updated_at:FieldValue.serverTimestamp()},{merge:true}).catch(()=>{}),
      sourceRef.set({registration_email_status:'error',registration_email_error:message,registration_email_last_attempt_at:FieldValue.serverTimestamp()},{merge:true}).catch(()=>{})
    ]);
    logger.error('Falha no envio imediato de cadastro',{tripId,reservationId,error:message});
    throw err;
  }
}

export const sendDirectRegistrationEmail=onDocumentCreated({document:'trips/{tripId}/reservations/{reservationId}',region:REGION,secrets:[RESEND_API_KEY]},async event=>{
  try{
    await sendRegistrationEmail(event.params.tripId,event.params.reservationId);
  }catch(err){
    logger.error('DIRECT_REGISTRATION_EMAIL_TRIGGER',{tripId:event.params.tripId,reservationId:event.params.reservationId,error:String(err?.message||err)});
  }
});
