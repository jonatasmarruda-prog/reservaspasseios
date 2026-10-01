import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { onRequest } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { createHash, randomBytes } from 'node:crypto';

if(!getApps().length)initializeApp();
const db=getFirestore();
const REGION='southamerica-east1';
const ALLOWED_ORIGINS=new Set([
  'https://trilheiros-reservas.web.app',
  'https://trilheiros-reservas.firebaseapp.com',
  'https://trilheirosderondonopolis.my.canva.site'
]);

const clean=v=>String(v??'').trim();
const email=v=>clean(v).toLowerCase();
const cpf=v=>clean(v).replace(/\D/g,'').slice(0,11);
const num=v=>Math.max(0,Number(v||0)||0);
const round=v=>Math.round((Number(v||0)+Number.EPSILON)*100)/100;
const sha=v=>createHash('sha256').update(String(v||'')).digest('hex');
const token=()=>randomBytes(24).toString('base64url');
const protocol=()=>`TR-${new Date().getFullYear()}-${randomBytes(4).toString('hex').toUpperCase()}`;
const active=v=>!['cancelled','canceled','cancelado','cancelada','expired','deleted'].includes(clean(v).toLowerCase());
const validEmail=v=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email(v));
function validCpf(v){
  const n=cpf(v);if(n.length!==11||/^(\d)\1{10}$/.test(n))return false;
  let s=0;for(let i=0;i<9;i++)s+=Number(n[i])*(10-i);let d=(s*10)%11;if(d===10)d=0;if(d!==Number(n[9]))return false;
  s=0;for(let i=0;i<10;i++)s+=Number(n[i])*(11-i);d=(s*10)%11;if(d===10)d=0;return d===Number(n[10]);
}
function cors(req,res){
  const origin=clean(req.headers.origin);
  if(ALLOWED_ORIGINS.has(origin))res.set('Access-Control-Allow-Origin',origin);
  res.set('Vary','Origin');
  res.set('Access-Control-Allow-Headers','Authorization, Content-Type');
  res.set('Access-Control-Allow-Methods','POST, OPTIONS');
}
function send(res,data,status=200){res.status(status).json(data)}
async function requireUser(req){
  const h=clean(req.headers.authorization);
  if(!h.startsWith('Bearer '))throw Object.assign(new Error('AUTH_REQUIRED'),{status:401});
  const decoded=await getAuth().verifyIdToken(h.slice(7));
  if(!decoded?.uid)throw Object.assign(new Error('AUTH_REQUIRED'),{status:401});
  return decoded;
}
function profileRef(c){return db.collection('participant_profiles').doc(sha(cpf(c)))}
function identity(name,emailValue){const n=clean(name).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();const e=email(emailValue);return e&&n?`${e}|${n}`:''}
function participantKeyRef(tripId,key){return db.collection('trip_participant_keys_v2').doc(sha(`${tripId}|${key}`))}
function rowIdentities(row){
  const out=[identity(row?.customer_name||row?.responsible_name,row?.customer_email||row?.email)];
  for(const p of (Array.isArray(row?.participants)?row.participants:[]))out.push(identity(p?.full_name||p?.name,p?.email));
  return [...new Set(out.filter(Boolean))];
}
function mergeParticipants(existing,incoming){
  const map=new Map();
  for(const p of (Array.isArray(existing)?existing:[])){
    const key=identity(p?.full_name||p?.name,p?.email)||cpf(p?.cpf)||sha(clean(p?.full_name||p?.name).toLowerCase());
    if(key)map.set(key,{...p,full_name:clean(p?.full_name||p?.name),cpf:cpf(p?.cpf),email:email(p?.email)});
  }
  for(const p of incoming){
    const key=identity(p.full_name,p.email)||cpf(p.cpf);
    const old=map.get(key)||{};
    map.set(key,{...old,full_name:clean(p.full_name)||old.full_name||'',cpf:key,email:email(p.email)||old.email||''});
  }
  return [...map.values()];
}
async function existingMatch(tripId,identities){
  const keys=await Promise.all(identities.map(k=>participantKeyRef(tripId,k).get()));
  const keyHits=keys.filter(s=>s.exists).map(s=>s.data()).filter(Boolean);
  const ids=[...new Set(keyHits.map(x=>x.sale_id||x.reservation_id).filter(Boolean))];
  if(ids.length>1)throw Object.assign(new Error('AMBIGUOUS_MATCH'),{status:409});
  if(ids.length===1)return {id:ids[0],saleId:keyHits[0].sale_id||ids[0],reservationId:keyHits[0].reservation_id||ids[0]};

  const salesSnap=await db.collection('sales').where('trip_id','==',tripId).limit(500).get();
  const saleCandidates=salesSnap.docs.map(d=>({id:d.id,...d.data()})).filter(s=>active(s.sale_status));
  const scored=saleCandidates.map(s=>({s,score:rowIdentities(s).filter(k=>identities.includes(k)).length})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
  if(scored.length>1&&scored[0].score===scored[1].score&&scored[0].s.id!==scored[1].s.id)throw Object.assign(new Error('AMBIGUOUS_MATCH'),{status:409});
  if(scored.length)return {id:scored[0].s.id,saleId:scored[0].s.id,reservationId:scored[0].s.id};

  const tripRef=db.collection('trips').doc(tripId);
  const resSnap=await tripRef.collection('reservations').limit(500).get();
  const resCandidates=resSnap.docs.map(d=>({id:d.id,...d.data()})).filter(r=>active(r.status));
  const rscored=resCandidates.map(r=>({r,score:rowIdentities(r).filter(k=>identities.includes(k)).length})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
  if(rscored.length>1&&rscored[0].score===rscored[1].score&&rscored[0].r.id!==rscored[1].r.id)throw Object.assign(new Error('AMBIGUOUS_MATCH'),{status:409});
  if(rscored.length){
    const r=rscored[0].r;
    return {id:r.id,saleId:r.sale_id||r.id,reservationId:r.id};
  }
  return null;
}
async function reservationRefForMatch(tripId,match){
  const tripRef=db.collection('trips').doc(tripId);
  const direct=tripRef.collection('reservations').doc(match.reservationId||match.id);
  const ds=await direct.get();
  if(ds.exists)return {ref:direct,id:direct.id};
  if(match.saleId){
    const q=await tripRef.collection('reservations').where('sale_id','==',match.saleId).limit(2).get();
    if(q.size>1)throw Object.assign(new Error('AMBIGUOUS_RESERVATION'),{status:409});
    if(!q.empty)return {ref:q.docs[0].ref,id:q.docs[0].id};
  }
  return {ref:direct,id:direct.id};
}
function maskEmail(v){
  const x=email(v);const [a,b]=x.split('@');if(!a||!b)return'';
  return `${a.slice(0,2)}***@${b}`;
}
async function upsertProfilesTx(tx,participants,tripId){
  const issued={};
  const refs=participants.map(p=>profileRef(p.cpf));
  const snaps=[];for(const r of refs)snaps.push(await tx.get(r));
  for(let i=0;i<participants.length;i++){
    const p=participants[i],ref=refs[i],snap=snaps[i],now=FieldValue.serverTimestamp(),mail=email(p.email);
    const access=token(),accessHash=sha(access);
    if(!snap.exists){
      tx.set(ref,{cpf:cpf(p.cpf),full_name:clean(p.full_name),email:mail,access_token_hashes:[accessHash],trip_ids:[tripId],created_at:now,updated_at:now,last_seen_at:now});
      issued[cpf(p.cpf)]=access;
      continue;
    }
    const d=snap.data()||{},sameEmail=!d.email||!mail||email(d.email)===mail;
    if(!sameEmail){
      tx.set(ref,{last_seen_at:now,updated_at:now,trip_ids:FieldValue.arrayUnion(tripId)},{merge:true});
      continue;
    }
    const hashes=Array.isArray(d.access_token_hashes)?d.access_token_hashes.slice(-4):[];
    if(!hashes.includes(accessHash))hashes.push(accessHash);
    tx.set(ref,{full_name:clean(p.full_name)||d.full_name||'',email:mail||d.email||'',access_token_hashes:hashes.slice(-5),trip_ids:FieldValue.arrayUnion(tripId),last_seen_at:now,updated_at:now},{merge:true});
    issued[cpf(p.cpf)]=access;
  }
  return issued;
}

export const participantProfileApi=onRequest({region:REGION,memory:'256MiB',timeoutSeconds:30,maxInstances:20},async(req,res)=>{
  cors(req,res);if(req.method==='OPTIONS')return res.status(204).send('');if(req.method!=='POST')return send(res,{ok:false,error:'METHOD'},405);
  try{
    await requireUser(req);
    const b=req.body||{},c=cpf(b.cpf);if(!validCpf(c))return send(res,{ok:false,error:'CPF_INVALIDO'},400);
    const ref=profileRef(c),snap=await ref.get();if(!snap.exists)return send(res,{ok:true,found:false});
    const d=snap.data()||{},providedToken=clean(b.access_token),providedEmail=email(b.email);
    const hashes=Array.isArray(d.access_token_hashes)?d.access_token_hashes:[];
    const tokenOk=providedToken&&hashes.includes(sha(providedToken));
    const emailOk=providedEmail&&validEmail(providedEmail)&&providedEmail===email(d.email);
    if(!tokenOk&&!emailOk)return send(res,{ok:true,found:true,verification_required:true,email_hint:maskEmail(d.email)});
    let accessToken=providedToken;
    if(!tokenOk){
      accessToken=token();const next=[...hashes.slice(-4),sha(accessToken)];
      await ref.set({access_token_hashes:next.slice(-5),last_seen_at:FieldValue.serverTimestamp(),updated_at:FieldValue.serverTimestamp()},{merge:true});
    }
    return send(res,{ok:true,found:true,verified:true,profile:{full_name:d.full_name||'',cpf:c,email:d.email||'',phone:d.phone||''},access_token:accessToken});
  }catch(e){logger.error('participantProfileApi',e);return send(res,{ok:false,error:e.message==='AUTH_REQUIRED'?'AUTH_REQUIRED':'PROFILE_ERROR'},e.status||500)}
});

export const unifiedRegistrationApi=onRequest({region:REGION,memory:'256MiB',timeoutSeconds:60,maxInstances:20},async(req,res)=>{
  cors(req,res);if(req.method==='OPTIONS')return res.status(204).send('');if(req.method!=='POST')return send(res,{ok:false,error:'METHOD'},405);
  try{
    const user=await requireUser(req),b=req.body||{},tripId=clean(b.trip_id),source=clean(b.source||'direct_trip_link');
    if(!tripId||!['direct_trip_link','public_portal_v27'].includes(source))return send(res,{ok:false,error:'DADOS_INVALIDOS'},400);
    const raw=Array.isArray(b.participants)?b.participants:[];
    if(raw.length<1||raw.length>10)return send(res,{ok:false,error:'PARTICIPANTES_INVALIDOS'},400);
    const participants=raw.map(p=>({full_name:clean(p.full_name||p.name),cpf:cpf(p.cpf),email:email(p.email)}));
    if(participants.some(p=>p.full_name.length<3||!validCpf(p.cpf)||!validEmail(p.email)))return send(res,{ok:false,error:'Confira nome, CPF e e-mail de todos os participantes.'},400);
    const identities=participants.map(p=>identity(p.full_name,p.email));if(new Set(identities).size!==identities.length)return send(res,{ok:false,error:'Há participante repetido com o mesmo nome e e-mail.'},400);
    const responsible=participants[0],match=await existingMatch(tripId,identities),tripRef=db.collection('trips').doc(tripId);
    const matchedReservation=match?await reservationRefForMatch(tripId,match):null;
    const saleId=match?.saleId||`u_${sha(`${tripId}|${identity(responsible.full_name,responsible.email)}`).slice(0,28)}`;
    const reservationId=matchedReservation?.id||match?.reservationId||saleId;
    const saleRef=db.collection('sales').doc(saleId),resRef=tripRef.collection('reservations').doc(reservationId);
    const keyRefs=identities.map(k=>participantKeyRef(tripId,k));
    const profileRefs=participants.map(p=>profileRef(p.cpf));
    let result=null;

    await db.runTransaction(async tx=>{
      const tripSnap=await tx.get(tripRef);if(!tripSnap.exists)throw Object.assign(new Error('PASSEIO_NAO_ENCONTRADO'),{status:404});
      const t=tripSnap.data()||{};if(t.status!=='open')throw Object.assign(new Error('PASSEIO_FECHADO'),{status:409});
      const saleSnap=await tx.get(saleRef),resSnap=await tx.get(resRef);
      const keySnaps=[];for(const r of keyRefs)keySnaps.push(await tx.get(r));if(!match&&keySnaps.some(s=>s.exists)&&!saleSnap.exists&&!resSnap.exists)throw Object.assign(new Error('REGISTRATION_CONFLICT'),{status:409});
      const profileSnaps=[];for(const r of profileRefs)profileSnaps.push(await tx.get(r));
      const sd=saleSnap.exists?saleSnap.data()||{}:{},rd=resSnap.exists?resSnap.data()||{}:{};
      const exists=saleSnap.exists||resSnap.exists||!!match;
      const baseParticipants=mergeParticipants(sd.participants||rd.participants||[],participants);
      const oldSeats=Math.max(num(sd.seats),num(rd.seats),exists?baseParticipants.length:0);
      const newSeats=Math.max(oldSeats,baseParticipants.length,participants.length);
      const diff=exists?Math.max(0,newSeats-oldSeats):newSeats;
      const totalSpots=Math.max(0,num(t.total_spots)),used=Math.max(0,num(t.used_spots)),rawRemaining=Math.max(0,num(t.remaining_spots));
      const remaining=totalSpots>0?Math.max(0,totalSpots-used):rawRemaining;
      if(diff>remaining)throw Object.assign(new Error(`Restam somente ${remaining} vaga(s).`),{status:409});
      const now=FieldValue.serverTimestamp(),code=clean(sd.protocol||rd.protocol)||protocol(),incomingTotal=round(b.sale_total),incomingMethod=clean(b.payment_method||'a_confirmar'),reportedMethod=clean(b.reported_payment_method||incomingMethod||'a_confirmar'),incomingInstallments=Math.max(1,Math.floor(num(b.installment_total)||1));
      const paid=Math.max(num(sd.paid_amount),num(rd.paid_amount)),currentTotal=Math.max(num(sd.sale_total),num(rd.sale_total));
      const targetTotal=source==='public_portal_v27'?Math.max(paid,incomingTotal||currentTotal):Math.max(paid,currentTotal||round(num(t.default_price)*newSeats));
      const balance=round(Math.max(0,targetTotal-paid));
      const paymentStatus=paid>0?(balance<=0.009?'paid':'partial'):(clean(sd.payment_status||rd.payment_status)==='paid'?'paid':'pending');
      const existingMethod=clean(sd.payment_method||rd.payment_method||'');const method=source==='public_portal_v27'?(incomingMethod||existingMethod||'a_confirmar'):(existingMethod&&existingMethod!=='a_confirmar'?existingMethod:(incomingMethod||reportedMethod||'a_confirmar'));
      const common={trip_id:tripId,trip_name:t.name||clean(b.trip_name),trip_date:t.trip_date||'',responsible_name:responsible.full_name,responsible_cpf:responsible.cpf,email:responsible.email,seats:newSeats,participants:baseParticipants,protocol:code,registration_status:'completed',registration_completed_at:rd.registration_completed_at||sd.registered_at||now,registration_email_status:'pending',registration_email_requested_at:now,status:'active',sale_total:targetTotal,paid_amount:paid,balance_due:balance,refunded_amount:Math.max(num(sd.refunded_amount),num(rd.refunded_amount)),payment_status:paymentStatus,payment_method:method,reported_payment_method:reportedMethod,registration_answers:{...(rd.registration_answers||{}),origem:{label:'Origem',value:source==='direct_trip_link'?'Link do passeio':'Reserva de Passeios'},pagamento_informado:{label:'Pagamento informado no cadastro',value:reportedMethod}},policy_text:t.cancellation_policy||'',policy_accepted:true,policy_accepted_at:rd.policy_accepted_at||now,updated_at:now};
      const salePatch={trip_id:tripId,trip_name:t.name||clean(b.trip_name),trip_date:t.trip_date||'',customer_name:responsible.full_name,customer_cpf:responsible.cpf,customer_email:responsible.email,seats:newSeats,participants:baseParticipants,protocol:code,registration_status:'completed',sale_status:active(sd.sale_status)?(sd.sale_status||'active'):'active',sale_total:targetTotal,paid_amount:paid,balance_due:balance,refunded_amount:Math.max(num(sd.refunded_amount),num(rd.refunded_amount)),payment_status:paymentStatus,payment_method:method,installment_total:source==='public_portal_v27'?incomingInstallments:(sd.installment_total||rd.installment_total||(method==='pix_installment'?incomingInstallments:1)),reported_payment_method:reportedMethod,category:source==='public_portal_v27'?clean(b.category||sd.category||rd.category):clean(sd.category||rd.category),claimed_uid:sd.claimed_uid||user.uid,registration_sources:FieldValue.arrayUnion(source),updated_at:now};
      if(source==='public_portal_v27'){salePatch.payment_trigger=clean(b.payment_trigger);salePatch.payment_started_at=sd.payment_started_at||now}
      if(!saleSnap.exists){salePatch.created_at=now;salePatch.payment_history=[];salePatch.received_date='';salePatch.notes=source==='public_portal_v27'?'Reserva iniciada pelo portal de passeios.':'Cadastro pelo link do passeio; pagamento aguardando conferência.';tx.set(saleRef,salePatch)}
      else tx.set(saleRef,salePatch,{merge:true});
      const resPatch={...common,sale_id:saleId,registration_source:source==='direct_trip_link'?'direct_trip_link':(rd.registration_source||'public_portal_v27'),source:rd.source||source,registration_sources:FieldValue.arrayUnion(source)};
      if(!resSnap.exists){resPatch.created_at=now;tx.set(resRef,resPatch)}else tx.set(resRef,resPatch,{merge:true});
      if(diff>0)tx.update(tripRef,{used_spots:used+diff,remaining_spots:totalSpots>0?Math.max(0,totalSpots-(used+diff)):Math.max(0,rawRemaining-diff),updated_at:now});
      for(let i=0;i<keyRefs.length;i++)tx.set(keyRefs[i],{trip_id:tripId,participant_identity:identities[i],reservation_id:reservationId,sale_id:saleId,updated_at:now,created_at:keySnaps[i].exists?(keySnaps[i].data()?.created_at||now):now},{merge:true});

      const issued={};
      for(let i=0;i<participants.length;i++){
        const p=participants[i],pref=profileRefs[i],ps=profileSnaps[i],access=token(),accessHash=sha(access);
        if(!ps.exists){
          tx.set(pref,{cpf:p.cpf,full_name:p.full_name,email:p.email,access_token_hashes:[accessHash],trip_ids:[tripId],created_at:now,updated_at:now,last_seen_at:now});
          issued[p.cpf]=access;
        }else{
          const pd=ps.data()||{},sameEmail=!pd.email||email(pd.email)===p.email;
          if(sameEmail){
            const hashes=Array.isArray(pd.access_token_hashes)?pd.access_token_hashes.slice(-4):[];hashes.push(accessHash);
            tx.set(pref,{full_name:p.full_name,email:p.email,access_token_hashes:hashes.slice(-5),trip_ids:FieldValue.arrayUnion(tripId),updated_at:now,last_seen_at:now},{merge:true});
            issued[p.cpf]=access;
          }else tx.set(pref,{trip_ids:FieldValue.arrayUnion(tripId),updated_at:now,last_seen_at:now},{merge:true});
        }
      }
      result={ok:true,created:!exists,merged:exists,protocol:code,trip_id:tripId,sale_id:saleId,reservation_id:reservationId,seats:newSeats,payment_status:paymentStatus,balance_due:balance,profile_tokens:issued};
    });
    return send(res,result,201);
  }catch(e){
    logger.error('unifiedRegistrationApi',e);
    const msg=String(e?.message||'UNIFIED_ERROR');
    if(msg==='AMBIGUOUS_MATCH'||msg==='AMBIGUOUS_RESERVATION'||msg==='REGISTRATION_CONFLICT')return send(res,{ok:false,error:'Este nome e e-mail já estão ligados a outro cadastro neste passeio. Fale com o Jonatas para conferência.'},409);
    if(msg==='AUTH_REQUIRED')return send(res,{ok:false,error:'AUTH_REQUIRED'},401);
    if(msg==='PASSEIO_NAO_ENCONTRADO')return send(res,{ok:false,error:'Passeio não encontrado.'},404);
    if(msg==='PASSEIO_FECHADO')return send(res,{ok:false,error:'Este passeio não está aberto para cadastro.'},409);
    return send(res,{ok:false,error:msg},e.status||500);
  }
});
