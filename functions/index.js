import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';
import * as logger from 'firebase-functions/logger';
import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';

initializeApp();
const db = getFirestore();
const REGION = 'southamerica-east1';
const COOKIE = 'trilheiros_admin';
const OCCUPIED = new Set(['active','cancel_requested','transferred']);
const RESEND_API_KEY = defineSecret('RESEND_API_KEY');

const nowIso = () => new Date().toISOString();
const money = v => Math.round((Number(v ?? 0) + Number.EPSILON) * 100) / 100;
const num = v => Number(v ?? 0);
const cleanCpf = v => String(v ?? '').replace(/\D/g,'').slice(0,11);
const cleanEmail = v => String(v ?? '').trim().toLowerCase();
const sha = v => createHash('sha256').update(String(v)).digest('hex');
const randomCode = () => randomBytes(9).toString('base64url');
const publicToken = () => randomUUID().replaceAll('-','');
const policyVersion = (id,p) => `v-${sha(`${id}|${p}`).slice(0,12)}`;

function cuiabaDate(offsetDays=0){
  const d=new Date(Date.now()+offsetDays*86400000);
  return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Cuiaba',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
}
function pathOf(req){return String(req.path||'').replace(/^\/api(?=\/|$)/,'')||'/';}
function body(req){return req.body&&typeof req.body==='object'?req.body:{};}
function sendJson(res,data,status=200){res.status(status).type('application/json').send(JSON.stringify(data));}
function bad(res,message,status=400){sendJson(res,{ok:false,error:message},status);}
async function rows(name){const s=await db.collection(name).get();return s.docs.map(d=>({id:d.id,...d.data()}));}
function cookies(req){
  const out={}; for(const item of String(req.headers.cookie||'').split(';')){const [k,...v]=item.trim().split('=');if(k)out[k]=decodeURIComponent(v.join('='));}
  return out;
}

async function adminConfigured(){const s=await db.doc('settings/admin').get();return s.exists&&Boolean(s.data()?.password_hash);}
async function setupAdmin(password){
  if(String(password).length<8)throw new Error('Use no mínimo 8 caracteres.');
  return db.runTransaction(async tx=>{
    const ref=db.doc('settings/admin'),s=await tx.get(ref); if(s.exists&&s.data()?.password_hash)return false;
    const salt=randomBytes(16).toString('hex'); const hash=scryptSync(String(password),salt,64).toString('hex');
    tx.set(ref,{password_hash:hash,password_salt:salt,created_at:nowIso(),updated_at:nowIso()},{merge:true}); return true;
  });
}
async function verifyPassword(password){
  const s=await db.doc('settings/admin').get();if(!s.exists)return false;const d=s.data()||{};if(!d.password_hash||!d.password_salt)return false;
  const a=scryptSync(String(password),String(d.password_salt),64),b=Buffer.from(String(d.password_hash),'hex');return a.length===b.length&&timingSafeEqual(a,b);
}
async function createSession(){
  const token=randomBytes(32).toString('base64url'); const id=sha(token); const until=Date.now()+30*86400000;
  await db.doc(`adminSessions/${id}`).set({created_at:nowIso(),expires_at:new Date(until).toISOString()}); return token;
}
async function isAdmin(req){
  const token=cookies(req)[COOKIE];if(!token)return false;const ref=db.doc(`adminSessions/${sha(token)}`),s=await ref.get();if(!s.exists)return false;
  if(Date.parse(String(s.data()?.expires_at||''))<Date.now()){await ref.delete().catch(()=>{});return false;}return true;
}
function setCookie(res,token){res.setHeader('Set-Cookie',`${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${30*86400}`);}
function clearCookie(res){res.setHeader('Set-Cookie',`${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);}
async function destroySession(req){const token=cookies(req)[COOKIE];if(token)await db.doc(`adminSessions/${sha(token)}`).delete().catch(()=>{});}

async function publicTrips(res){
  const today=cuiabaDate();const all=await rows('trips');const trips=all.filter(t=>t.status==='open'&&String(t.trip_date||'')>=today)
    .map(t=>({...t,remaining_spots:Math.max(0,Number(t.total_spots||0)-Number(t.used_spots||0))}))
    .filter(t=>t.remaining_spots>0).sort((a,b)=>String(a.trip_date).localeCompare(String(b.trip_date)));
  sendJson(res,{ok:true,trips});
}
async function publicTrip(res,code){
  const s=await db.collection('trips').where('public_code','==',code).limit(1).get();if(s.empty)return bad(res,'Este link de cadastro não está disponível.',404);
  const d=s.docs[0],t={id:d.id,...d.data()},remaining=Math.max(0,Number(t.total_spots||0)-Number(t.used_spots||0));
  if(t.status!=='open'||String(t.trip_date||'')<cuiabaDate()||remaining<1)return bad(res,'Este link de cadastro não está disponível.',404);
  sendJson(res,{ok:true,trip:{...t,remaining_spots:remaining}});
}
async function createReservation(req,res){
  const b=body(req),tripId=String(b.tripId||''),name=String(b.responsibleName||'').trim(),cpf=cleanCpf(b.responsibleCpf),email=cleanEmail(b.email),seats=Math.floor(num(b.seats));
  const ps=Array.isArray(b.participants)?b.participants:[];
  if(!tripId||!name||cpf.length!==11||!email.includes('@'))return bad(res,'Preencha nome, CPF e e-mail corretamente.');
  if(seats<1||seats>20)return bad(res,'Quantidade de vagas inválida.');if(b.acceptedPolicy!==true)return bad(res,'É necessário aceitar a política de cancelamento.');
  if(ps.length!==seats)return bad(res,'Informe nome e CPF de todos os participantes.');
  const participants=ps.map(p=>({full_name:String(p.fullName||'').trim(),cpf:cleanCpf(p.cpf)}));if(participants.some(p=>!p.full_name||p.cpf.length!==11))return bad(res,'Confira nome e CPF de todos os participantes.');
  const cpfs=participants.map(p=>p.cpf);if(new Set(cpfs).size!==cpfs.length)return bad(res,'Há CPF repetido entre os participantes.');
  const tripRef=db.doc(`trips/${tripId}`),rRef=db.collection('reservations').doc(),token=publicToken();
  try{
    await db.runTransaction(async tx=>{
      const ts=await tx.get(tripRef);if(!ts.exists)throw new Error('PASSEIO_INDISPONIVEL');const t=ts.data();
      if(t.status!=='open'||String(t.trip_date||'')<cuiabaDate())throw new Error('PASSEIO_INDISPONIVEL');
      const used=Number(t.used_spots||0),remaining=Number(t.total_spots||0)-used;if(seats>remaining)throw new Error(`VAGAS:${remaining}`);
      const keys=cpfs.map(x=>db.doc(`tripParticipantKeys/${tripId}_${x}`));const snaps=[];for(const k of keys)snaps.push(await tx.get(k));if(snaps.some(s=>s.exists))throw new Error('CPF_DUP');
      const paid=t.assumes_payment!==false?money(Number(t.default_price||0)*seats):0;
      tx.set(rRef,{trip_id:tripId,responsible_name:name,responsible_cpf:cpf,email,seats,participants,paid_amount:paid,refunded_amount:0,payment_method:'a_confirmar',payment_status:t.assumes_payment!==false?'paid':'pending',status:'active',public_token:token,policy_version:policyVersion(tripId,String(t.cancellation_policy||'')),policy_text:String(t.cancellation_policy||''),policy_accepted_at:nowIso(),admin_notes:'',created_at:nowIso(),updated_at:nowIso()});
      tx.update(tripRef,{used_spots:used+seats,updated_at:nowIso()});keys.forEach((k,i)=>tx.set(k,{trip_id:tripId,cpf:cpfs[i],reservation_id:rRef.id,created_at:nowIso()}));
    });
  }catch(e){const m=String(e?.message||e);if(m==='PASSEIO_INDISPONIVEL')return bad(res,'Este passeio não está disponível.',409);if(m.startsWith('VAGAS:'))return bad(res,`Restam somente ${m.split(':')[1]} vaga(s).`,409);if(m==='CPF_DUP')return bad(res,'Um dos CPFs já está cadastrado neste passeio.',409);logger.error('reservation',e);return bad(res,'Não foi possível concluir o cadastro.',500);}
  sendJson(res,{ok:true,reservation:{id:rRef.id,token}},201);
}
async function reservationByToken(token){const s=await db.collection('reservations').where('public_token','==',token).limit(1).get();return s.empty?null:{id:s.docs[0].id,...s.docs[0].data()};}
async function publicReservation(res,token){
  const r=await reservationByToken(token);if(!r)return bad(res,'Reserva não encontrada.',404);const ts=await db.doc(`trips/${r.trip_id}`).get();if(!ts.exists)return bad(res,'Passeio não encontrado.',404);const t=ts.data();
  sendJson(res,{ok:true,reservation:{...r,trip_name:t.name,destination:t.destination,trip_date:t.trip_date,departure_time:t.departure_time,departure_point:t.departure_point,return_info:t.return_info,what_to_bring:t.what_to_bring,whatsapp_group_url:t.whatsapp_group_url,cancellation_policy:t.cancellation_policy}});
}
async function cancelRequest(req,res,token){
  const r=await reservationByToken(token);if(!r)return bad(res,'Reserva não encontrada.',404);if(r.status==='cancelled')return bad(res,'Esta reserva já está cancelada.',409);if(r.status==='cancel_requested')return bad(res,'Já existe uma solicitação.',409);
  await db.collection('cancellationRequests').add({reservation_id:r.id,reason:String(body(req).reason||'').trim().slice(0,1000),status:'pending',created_at:nowIso()});await db.doc(`reservations/${r.id}`).update({status:'cancel_requested',updated_at:nowIso()});sendJson(res,{ok:true});
}

async function allTripsWithMetrics(){
  const [trips,rs,es]=await Promise.all([rows('trips'),rows('reservations'),rows('expenses')]);
  return trips.map(t=>{const rr=rs.filter(r=>r.trip_id===t.id),ee=es.filter(e=>e.trip_id===t.id),revenue=rr.reduce((s,r)=>s+Number(r.paid_amount||0)-Number(r.refunded_amount||0),0),expenses=ee.reduce((s,e)=>s+Number(e.amount||0),0),used=Number(t.used_spots||0);return {...t,used_spots:used,remaining_spots:Math.max(0,Number(t.total_spots||0)-used),net_revenue:money(revenue),expenses:money(expenses),profit:money(revenue-expenses)}}).sort((a,b)=>String(b.trip_date).localeCompare(String(a.trip_date)));
}
async function adminTrips(req,res,id){
  if(req.method==='GET')return sendJson(res,{ok:true,trips:await allTripsWithMetrics()});
  const b=body(req),f={name:String(b.name||'').trim(),destination:String(b.destination||'').trim(),trip_date:String(b.tripDate||'').slice(0,10),departure_time:String(b.departureTime||''),departure_point:String(b.departurePoint||''),return_info:String(b.returnInfo||''),total_spots:Math.max(1,Math.floor(num(b.totalSpots))),default_price:money(b.defaultPrice),status:String(b.status||'draft'),cancellation_policy:String(b.cancellationPolicy||'').trim(),what_to_bring:String(b.whatToBring||''),whatsapp_group_url:String(b.whatsappGroupUrl||''),assumes_payment:b.assumesPayment!==false,updated_at:nowIso()};
  if(!f.name||!/^\d{4}-\d{2}-\d{2}$/.test(f.trip_date)||!f.cancellation_policy)return bad(res,'Preencha nome, data e política de cancelamento.');
  if(id){const ref=db.doc(`trips/${id}`),s=await ref.get();if(!s.exists)return bad(res,'Passeio não encontrado.',404);const used=Number(s.data()?.used_spots||0);if(f.total_spots<used)return bad(res,`Já existem ${used} vaga(s) ocupada(s).`,409);await ref.update(f);return sendJson(res,{ok:true});}
  const ref=db.collection('trips').doc();await ref.set({...f,public_code:randomCode(),used_spots:0,created_at:nowIso()});sendJson(res,{ok:true,id:ref.id},201);
}
async function adminReservations(req,res,id){
  if(req.method==='GET'){
    const [rs,ts]=await Promise.all([rows('reservations'),rows('trips')]);const map=new Map(ts.map(t=>[t.id,t]));rs.sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));return sendJson(res,{ok:true,reservations:rs.map(r=>({...r,trip_name:map.get(r.trip_id)?.name||'Passeio'}))});
  }
  if(!id)return bad(res,'Reserva não encontrada.',404);const b=body(req),ref=db.doc(`reservations/${id}`);
  try{await db.runTransaction(async tx=>{
    const s=await tx.get(ref);if(!s.exists)throw new Error('NORES');const r=s.data(),newStatus=String(b.status||r.status),oldOcc=OCCUPIED.has(r.status),newOcc=OCCUPIED.has(newStatus),tripRef=db.doc(`trips/${r.trip_id}`),ts=await tx.get(tripRef);if(!ts.exists)throw new Error('NOTRIP');const t=ts.data(),seats=Number(r.seats||0),cpfs=(r.participants||[]).map(p=>cleanCpf(p.cpf)),keys=cpfs.map(x=>db.doc(`tripParticipantKeys/${r.trip_id}_${x}`));
    if(!oldOcc&&newOcc){const rem=Number(t.total_spots||0)-Number(t.used_spots||0);if(seats>rem)throw new Error(`VAGAS:${rem}`);const ss=[];for(const k of keys)ss.push(await tx.get(k));if(ss.some(x=>x.exists))throw new Error('CPF_DUP');tx.update(tripRef,{used_spots:Number(t.used_spots||0)+seats,updated_at:nowIso()});keys.forEach((k,i)=>tx.set(k,{trip_id:r.trip_id,cpf:cpfs[i],reservation_id:id,created_at:nowIso()}));}
    if(oldOcc&&!newOcc){tx.update(tripRef,{used_spots:Math.max(0,Number(t.used_spots||0)-seats),updated_at:nowIso()});keys.forEach(k=>tx.delete(k));}
    tx.update(ref,{paid_amount:money(b.paidAmount),refunded_amount:money(b.refundedAmount),payment_method:String(b.paymentMethod||'a_confirmar'),payment_status:String(b.paymentStatus||'pending'),status:newStatus,admin_notes:String(b.adminNotes||''),updated_at:nowIso()});
  });}catch(e){const m=String(e?.message||e);if(m==='NORES')return bad(res,'Reserva não encontrada.',404);if(m.startsWith('VAGAS:'))return bad(res,`Restam somente ${m.split(':')[1]} vaga(s).`,409);if(m==='CPF_DUP')return bad(res,'Um CPF desta reserva já está ativo.',409);throw e;}
  sendJson(res,{ok:true});
}
async function adminExpenses(req,res,id){
  if(req.method==='GET'){const x=await rows('expenses');x.sort((a,b)=>String(b.expense_date).localeCompare(String(a.expense_date)));return sendJson(res,{ok:true,expenses:x});}
  if(req.method==='DELETE'&&id){await db.doc(`expenses/${id}`).delete();return sendJson(res,{ok:true});}
  const b=body(req),tripId=String(b.tripId||''),amount=money(b.amount);if(!tripId||amount<0)return bad(res,'Informe passeio e valor.');if(!(await db.doc(`trips/${tripId}`).get()).exists)return bad(res,'Passeio não encontrado.',404);
  const ref=await db.collection('expenses').add({trip_id:tripId,category:String(b.category||'Outros'),description:String(b.description||''),amount,expense_date:String(b.expenseDate||cuiabaDate()),created_at:nowIso()});sendJson(res,{ok:true,id:ref.id},201);
}
async function dashboard(res){
  const [ts,rs,es]=await Promise.all([rows('trips'),rows('reservations'),rows('expenses')]),map=new Map(ts.map(t=>[t.id,t])),today=cuiabaDate(),revenue=rs.reduce((s,r)=>s+Number(r.paid_amount||0)-Number(r.refunded_amount||0),0),expenses=es.reduce((s,e)=>s+Number(e.amount||0),0);
  const recent=[...rs].sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))).slice(0,6).map(r=>({...r,trip_name:map.get(r.trip_id)?.name||'Passeio'}));
  sendJson(res,{ok:true,summary:{upcoming_trips:ts.filter(t=>['open','closed'].includes(t.status)&&String(t.trip_date)>=today).length,active_seats:ts.reduce((s,t)=>s+Number(t.used_spots||0),0),revenue:money(revenue),expenses:money(expenses),profit:money(revenue-expenses),cancellation_requests:rs.filter(r=>r.status==='cancel_requested').length},recent});
}

async function apiHandler(req,res){
  const p=pathOf(req);try{
    if(req.method==='GET'&&p==='/public/trips')return publicTrips(res);let m=p.match(/^\/public\/trip\/([^/]+)$/);if(req.method==='GET'&&m)return publicTrip(res,decodeURIComponent(m[1]));
    if(req.method==='POST'&&p==='/public/reservations')return createReservation(req,res);m=p.match(/^\/public\/reservation\/([^/]+)$/);if(req.method==='GET'&&m)return publicReservation(res,decodeURIComponent(m[1]));m=p.match(/^\/public\/cancel\/([^/]+)$/);if(req.method==='POST'&&m)return cancelRequest(req,res,decodeURIComponent(m[1]));
    if(req.method==='GET'&&p==='/admin/session')return sendJson(res,{ok:true,authenticated:await isAdmin(req),configured:await adminConfigured()});
    if(req.method==='POST'&&p==='/admin/setup'){if(await adminConfigured())return bad(res,'Painel já configurado.',409);const b=body(req);if(String(b.password||'')!==String(b.confirm||''))return bad(res,'As senhas não conferem.');if(!(await setupAdmin(String(b.password||''))))return bad(res,'Painel já configurado.',409);const token=await createSession();setCookie(res,token);return sendJson(res,{ok:true},201);}
    if(req.method==='POST'&&p==='/admin/login'){if(!(await adminConfigured()))return bad(res,'Painel ainda não configurado.',428);if(!(await verifyPassword(String(body(req).password||''))))return bad(res,'Senha incorreta.',401);const token=await createSession();setCookie(res,token);return sendJson(res,{ok:true});}
    if(req.method==='POST'&&p==='/admin/logout'){await destroySession(req);clearCookie(res);return sendJson(res,{ok:true});}
    if(!(await isAdmin(req)))return bad(res,'Não autorizado.',401);
    if(req.method==='GET'&&p==='/admin/dashboard')return dashboard(res);if(p==='/admin/trips')return adminTrips(req,res);m=p.match(/^\/admin\/trips\/([^/]+)$/);if(m&&['PUT','PATCH'].includes(req.method))return adminTrips(req,res,m[1]);
    if(req.method==='GET'&&p==='/admin/reservations')return adminReservations(req,res);m=p.match(/^\/admin\/reservations\/([^/]+)$/);if(m&&['PUT','PATCH'].includes(req.method))return adminReservations(req,res,m[1]);
    if(p==='/admin/expenses')return adminExpenses(req,res);m=p.match(/^\/admin\/expenses\/([^/]+)$/);if(m&&req.method==='DELETE')return adminExpenses(req,res,m[1]);return bad(res,'Rota não encontrada.',404);
  }catch(e){logger.error('api-error',{path:p,method:req.method,error:e});return bad(res,'Erro interno do sistema.',500);}
}
export const api=onRequest({region:REGION,memory:'256MiB',timeoutSeconds:60,maxInstances:10},apiHandler);

const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
async function sendReminder(id){
  const rs=await db.doc(`reservations/${id}`).get();if(!rs.exists)return {skipped:true};const r=rs.data(),ts=await db.doc(`trips/${r.trip_id}`).get();if(!ts.exists)return {skipped:true};const t=ts.data(),key=RESEND_API_KEY.value(),from=process.env.EMAIL_FROM;if(!key||!from||!r.email)return {skipped:true,error:'E-mail não configurado'};
  const html=`<div style="font-family:Arial;max-width:650px;margin:auto;color:#17352d"><div style="background:#0f3d30;color:white;padding:26px;border-radius:18px 18px 0 0"><b>TRILHEIROS DE RONDONÓPOLIS</b><h1>Seu passeio é amanhã 🥾</h1></div><div style="padding:28px;border:1px solid #dfe9e4;border-radius:0 0 18px 18px"><p>Olá, <b>${esc(r.responsible_name)}</b>!</p><p><b>Passeio:</b> ${esc(t.name)}<br><b>Data:</b> ${esc(t.trip_date)}${t.departure_time?`<br><b>Saída:</b> ${esc(t.departure_time)}`:''}${t.departure_point?`<br><b>Ponto:</b> ${esc(t.departure_point)}`:''}</p>${t.what_to_bring?`<div style="background:#edf7f1;padding:16px;border-radius:12px"><b>🎒 O que levar</b><br>${esc(t.what_to_bring).replaceAll('\n','<br>')}</div>`:''}<div style="background:#fff8e8;padding:16px;border-radius:12px;margin-top:16px"><b>Política de cancelamento</b><br>${esc(t.cancellation_policy).replaceAll('\n','<br>')}</div><p>Qualquer mudança de última hora será comunicada nos canais oficiais.</p></div></div>`;
  const resp=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({from,to:[r.email],subject:`É amanhã! ${t.name}`,html})});const data=await resp.json().catch(()=>({}));return resp.ok?{ok:true,id:data.id}:{ok:false,error:data.message||`HTTP ${resp.status}`};
}
export const reminders=onSchedule({region:REGION,schedule:'0 9 * * *',timeZone:'America/Cuiaba',memory:'256MiB',timeoutSeconds:120,secrets:[RESEND_API_KEY]},async()=>{
  const tomorrow=cuiabaDate(1),ts=(await rows('trips')).filter(t=>String(t.trip_date)===tomorrow&&['open','closed'].includes(t.status));
  for(const t of ts){const snap=await db.collection('reservations').where('trip_id','==',t.id).get();for(const d of snap.docs){const r=d.data();if(!['active','transferred'].includes(r.status))continue;const log=db.doc(`emailLogs/${d.id}_reminder_1d`),ls=await log.get();if(ls.exists&&ls.data()?.status==='sent')continue;try{const result=await sendReminder(d.id);await log.set({reservation_id:d.id,email_type:'reminder_1d',status:result.ok?'sent':result.skipped?'skipped':'error',provider_id:result.id||null,error_message:result.error||null,created_at:nowIso()},{merge:true});}catch(e){logger.error('reminder',e);}}
  }
});
