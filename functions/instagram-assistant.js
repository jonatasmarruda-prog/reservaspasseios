import { createHash,createHmac,timingSafeEqual } from 'node:crypto';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue,getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as logger from 'firebase-functions/logger';
import { activeTrips,buildReply,normalizeText,resolveTrip } from './instagram-assistant-core.js';

const db=getFirestore();
const REGION='southamerica-east1';
const OWNER_EMAIL='trilheiros.roomt@gmail.com';
const ADMIN_URL='https://trilheiros-reservas.web.app/admin?tab=instagram';
const META_GRAPH_VERSION=process.env.META_GRAPH_VERSION||'v24.0';
const VERIFY_TOKEN=defineSecret('META_INSTAGRAM_VERIFY_TOKEN');
const ACCESS_TOKEN=defineSecret('META_INSTAGRAM_ACCESS_TOKEN');
const APP_SECRET=defineSecret('META_APP_SECRET');
const ACCOUNT_ID=defineSecret('INSTAGRAM_BUSINESS_ACCOUNT_ID');
const BOUND_SECRETS=[VERIFY_TOKEN,ACCESS_TOKEN,APP_SECRET,ACCOUNT_ID];

const nowIso=()=>new Date().toISOString();
const sha=value=>createHash('sha256').update(String(value??'')).digest('hex');
const clean=value=>String(value??'').trim();
const secretValue=secret=>{try{return clean(secret.value())}catch{return''}};
const settingsRef=()=>db.doc('settings/instagram_assistant');
const conversationRef=id=>db.doc(`instagram_conversations/${id}`);
const graphBase=()=>`https://graph.instagram.com/${META_GRAPH_VERSION}`;

function sendJson(res,data,status=200){return res.status(status).type('application/json').send(JSON.stringify(data))}
function rawBody(req){return Buffer.isBuffer(req.rawBody)?req.rawBody:Buffer.from(typeof req.body==='string'?req.body:JSON.stringify(req.body||{}))}
function signatureValid(req){
  const secret=secretValue(APP_SECRET),header=clean(req.get('x-hub-signature-256'));
  if(!secret||!header.startsWith('sha256='))return false;
  const expected=`sha256=${createHmac('sha256',secret).update(rawBody(req)).digest('hex')}`;
  const a=Buffer.from(header),b=Buffer.from(expected);
  return a.length===b.length&&timingSafeEqual(a,b);
}

async function loadSettings(){
  const snap=await settingsRef().get(),data=snap.exists?snap.data()||{}:{};
  return{
    enabled:data.enabled===true,
    mode:['automatic','suggestions'].includes(data.mode)?data.mode:'suggestions',
    reply_comments:data.reply_comments!==false,
    reply_messages:data.reply_messages!==false,
    comment_to_dm:data.comment_to_dm===true,
    reservation_url:clean(data.reservation_url)||'https://trilheirosderondonopolis.my.canva.site/',
    max_user_replies_hour:Math.min(20,Math.max(2,Number(data.max_user_replies_hour||8))),
    account_username:clean(data.account_username)||'trilheiros.roomt'
  };
}

async function loadTrips(){
  const snap=await db.collection('trips').get();
  return snap.docs.map(doc=>({id:doc.id,...doc.data()}));
}

async function graphRequest(path,{method='GET',body=null,token=secretValue(ACCESS_TOKEN)}={}){
  if(!token)throw new Error('Token do Instagram não configurado.');
  const url=new URL(`${graphBase()}${path.startsWith('/')?'':'/'}${path}`);
  const options={method,headers:{Authorization:`Bearer ${token}`}};
  if(body){options.headers['Content-Type']='application/json';options.body=JSON.stringify(body)}
  const response=await fetch(url,options),raw=await response.text();
  let payload={};try{payload=JSON.parse(raw||'{}')}catch{payload={raw}}
  if(!response.ok)throw new Error(`Meta ${response.status}: ${payload?.error?.message||raw.slice(0,500)}`);
  return payload;
}

async function fetchMedia(mediaId){
  if(!mediaId)return{};
  try{return await graphRequest(`/${encodeURIComponent(mediaId)}?fields=id,caption,permalink`)}catch(error){logger.warn('Não foi possível consultar a publicação.',{mediaId,error:String(error)});return{}}
}

async function replyToComment(commentId,text){
  return graphRequest(`/${encodeURIComponent(commentId)}/replies`,{method:'POST',body:{message:text}});
}

async function sendDirect(recipientId,text){
  const accountId=secretValue(ACCOUNT_ID);
  if(!accountId)throw new Error('ID da conta profissional não configurado.');
  return graphRequest(`/${encodeURIComponent(accountId)}/messages`,{method:'POST',body:{recipient:{id:recipientId},message:{text}}});
}

async function privateReply(commentId,text){
  const accountId=secretValue(ACCOUNT_ID);
  if(!accountId)throw new Error('ID da conta profissional não configurado.');
  return graphRequest(`/${encodeURIComponent(accountId)}/messages`,{method:'POST',body:{recipient:{comment_id:commentId},message:{text}}});
}

async function notifyOwner(title,body,conversationId){
  try{
    const snap=await db.collection('push_devices').where('active','==',true).limit(100).get();
    const docs=snap.docs.map(doc=>({id:doc.id,token:clean(doc.data()?.token)})).filter(x=>x.token);
    if(!docs.length)return;
    const result=await getMessaging().sendEachForMulticast({tokens:docs.map(x=>x.token),data:{title,body,url:ADMIN_URL,type:'instagram_handoff',tag:`instagram:${conversationId}`,conversation_id:conversationId}});
    const invalid=[];result.responses.forEach((item,index)=>{if(!item.success&&['messaging/registration-token-not-registered','messaging/invalid-registration-token'].includes(item.error?.code))invalid.push(docs[index].id)});
    await Promise.all(invalid.map(id=>db.doc(`push_devices/${id}`).set({active:false,disabled_at:nowIso()},{merge:true})));
  }catch(error){logger.warn('Falha ao enviar alerta do Instagram.',{error:String(error)})}
}

async function claimEvent(id,payload){
  const ref=db.doc(`instagram_events/${id}`);let claimed=false;
  await db.runTransaction(async tx=>{const snap=await tx.get(ref);if(snap.exists)return;tx.create(ref,{...payload,status:'processing',created_at:FieldValue.serverTimestamp()});claimed=true});
  return{claimed,ref};
}

function eventId(item){return sha([item.kind,item.event_id,item.actor_id,item.text,item.timestamp].join('|'))}
function conversationId(item){return sha(`${item.actor_id}|${item.kind==='message'?'dm':'comment'}`).slice(0,40)}

async function normalizeWebhook(payload){
  const events=[];
  for(const entry of Array.isArray(payload?.entry)?payload.entry:[]){
    for(const message of Array.isArray(entry?.messaging)?entry.messaging:[]){
      if(!message?.message?.text||message.message.is_echo||String(message.sender?.id||'')===String(entry.id||''))continue;
      events.push({kind:'message',event_id:message.message.mid||`${message.timestamp||entry.time}`,actor_id:clean(message.sender?.id),actor_name:'',text:clean(message.message.text),timestamp:Number(message.timestamp||entry.time||Date.now()),account_id:clean(entry.id),reply_target:clean(message.sender?.id),reply_kind:'dm'});
    }
    for(const change of Array.isArray(entry?.changes)?entry.changes:[]){
      if(change?.field!=='comments'&&change?.field!=='live_comments')continue;
      const value=change.value||{};
      if(!value.id||!value.text)continue;
      if(String(value.from?.id||value.user_id||'')===String(entry.id||''))continue;
      events.push({kind:'comment',event_id:clean(value.id),actor_id:clean(value.from?.id||value.user_id),actor_name:clean(value.from?.username||value.username),text:clean(value.text),timestamp:Number(value.created_time||entry.time||Date.now()),account_id:clean(entry.id),media_id:clean(value.media?.id||value.media_id),reply_target:clean(value.id),reply_kind:'comment'});
    }
  }
  return events.filter(x=>x.actor_id&&x.text);
}

function rateState(data={},limit=8){
  const start=Date.parse(clean(data.rate_window_started_at));
  if(!Number.isFinite(start)||Date.now()-start>=3600000)return{allowed:true,count:1,started_at:nowIso()};
  const count=Number(data.rate_window_count||0)+1;
  return{allowed:count<=limit,count,started_at:data.rate_window_started_at};
}

async function processEvent(item,settings,trips){
  const id=eventId(item),claim=await claimEvent(id,{event_id:item.event_id,channel:item.kind,actor_id:item.actor_id});
  if(!claim.claimed)return;
  const convId=conversationId(item),convRef=conversationRef(convId);
  try{
    const [convSnap,media]=await Promise.all([convRef.get(),item.media_id?fetchMedia(item.media_id):Promise.resolve({})]);
    const conv=convSnap.exists?convSnap.data()||{}:{},takeover=conv.human_takeover===true||(Date.parse(clean(conv.human_takeover_until))||0)>Date.now();
    const rate=rateState(conv,settings.max_user_replies_hour),trip=resolveTrip({text:item.text,mediaCaption:media.caption||'',trips,preferredTripId:conv.trip_id||''});
    const answer=buildReply({text:item.text,trip,trips,channel:item.kind==='comment'?'comment':'dm',actorName:item.actor_name,seed:item.event_id,reservationUrl:settings.reservation_url});
    const base={channel:item.kind,actor_id:item.actor_id,actor_name:item.actor_name||conv.actor_name||'',last_incoming_text:item.text,last_incoming_at:FieldValue.serverTimestamp(),last_event_id:item.event_id,media_id:item.media_id||conv.media_id||'',media_permalink:media.permalink||conv.media_permalink||'',trip_id:trip?.id||conv.trip_id||'',trip_name:trip?.name||conv.trip_name||'',reply_target:item.reply_target,reply_kind:item.reply_kind,rate_window_count:rate.count,rate_window_started_at:rate.started_at,updated_at:FieldValue.serverTimestamp(),created_at:conv.created_at||FieldValue.serverTimestamp()};
    if(!settings.enabled||settings.mode==='suggestions'||takeover||!rate.allowed||(item.kind==='comment'&&!settings.reply_comments)||(item.kind==='message'&&!settings.reply_messages)){
      const reason=!settings.enabled?'assistant_disabled':settings.mode==='suggestions'?'suggestion_mode':takeover?'human_takeover':!rate.allowed?'rate_limit':'channel_disabled';
      await convRef.set({...base,status:takeover?'human':'suggested',suggested_reply:answer.reply,pending_reason:reason,needs_human:answer.needsHuman||takeover||!rate.allowed},{merge:true});
      await claim.ref.set({status:'stored',reason,conversation_id:convId,finished_at:FieldValue.serverTimestamp()},{merge:true});
      if(answer.needsHuman||!rate.allowed)await notifyOwner('Instagram precisa de você',`${item.actor_name||'Uma pessoa'}: ${item.text.slice(0,120)}`,convId);
      return;
    }
    let result;
    if(item.kind==='comment')result=await replyToComment(item.reply_target,answer.reply);
    else result=await sendDirect(item.reply_target,answer.reply);
    let privateResult=null;
    if(item.kind==='comment'&&settings.comment_to_dm&&!answer.needsHuman){
      const dm=`Oi! 🥾💚 Vi seu comentário sobre ${trip?.name||'nosso passeio'}. ${answer.reply.replace(/^.*?[.!?]\s*/, '')}`.slice(0,950);
      try{privateResult=await privateReply(item.reply_target,dm)}catch(error){logger.warn('Resposta privada não enviada.',{eventId:id,error:String(error)})}
    }
    await convRef.set({...base,status:answer.needsHuman?'needs_human':'answered',last_outgoing_text:answer.reply,last_outgoing_at:FieldValue.serverTimestamp(),last_meta_message_id:result?.id||result?.message_id||'',private_meta_message_id:privateResult?.message_id||'',suggested_reply:FieldValue.delete(),pending_reason:FieldValue.delete(),needs_human:answer.needsHuman},{merge:true});
    await claim.ref.set({status:'answered',conversation_id:convId,trip_id:trip?.id||'',intent:answer.intent,finished_at:FieldValue.serverTimestamp()},{merge:true});
    if(answer.needsHuman)await notifyOwner('Atendimento do Instagram',`${item.actor_name||'Uma pessoa'} precisa do Jonatas: ${item.text.slice(0,110)}`,convId);
  }catch(error){
    const message=String(error?.message||error).slice(0,900);
    await Promise.all([claim.ref.set({status:'error',error:message,finished_at:FieldValue.serverTimestamp()},{merge:true}),convRef.set({status:'error',last_error:message,updated_at:FieldValue.serverTimestamp()},{merge:true})]);
    logger.error('Erro no atendente Instagram.',{eventId:id,error:message});
  }
}

async function webhookHandler(req,res){
  if(req.method==='GET'){
    const mode=clean(req.query['hub.mode']),token=clean(req.query['hub.verify_token']),challenge=clean(req.query['hub.challenge']);
    if(mode==='subscribe'&&token&&token===secretValue(VERIFY_TOKEN))return res.status(200).type('text/plain').send(challenge);
    return res.status(403).type('text/plain').send('Verificação recusada.');
  }
  if(req.method!=='POST')return res.status(405).send('Method not allowed');
  if(!signatureValid(req))return res.status(401).send('Invalid signature');
  const payload=req.body&&typeof req.body==='object'?req.body:{};
  if(payload.object!=='instagram')return res.status(200).send('IGNORED');
  try{
    const [settings,trips,events]=await Promise.all([loadSettings(),loadTrips(),normalizeWebhook(payload)]);
    for(const event of events)await processEvent(event,settings,trips);
    return res.status(200).send('EVENT_RECEIVED');
  }catch(error){logger.error('Falha no webhook do Instagram.',{error:String(error)});return res.status(500).send('ERROR')}
}

async function requireAdmin(req){
  const auth=clean(req.get('authorization'));
  if(!auth.startsWith('Bearer '))throw Object.assign(new Error('Autenticação necessária.'),{status:401});
  const decoded=await getAuth().verifyIdToken(auth.slice(7));
  if(clean(decoded.email).toLowerCase()===OWNER_EMAIL)return decoded;
  const snap=await db.doc(`admin_users/${decoded.uid}`).get(),data=snap.exists?snap.data()||{}:{};
  if(data.active===true&&['owner','admin'].includes(data.role))return decoded;
  throw Object.assign(new Error('Acesso não autorizado.'),{status:403});
}

async function metaConnection(){
  try{
    const configured=Boolean(secretValue(ACCESS_TOKEN)&&secretValue(ACCOUNT_ID)&&secretValue(APP_SECRET)&&secretValue(VERIFY_TOKEN));
    if(!configured)return{configured:false,connected:false};
    const profile=await graphRequest(`/${encodeURIComponent(secretValue(ACCOUNT_ID))}?fields=id,username`);
    return{configured:true,connected:true,username:profile.username||'',account_id:profile.id||''};
  }catch(error){return{configured:true,connected:false,error:String(error?.message||error).slice(0,500)}}
}

async function adminHandler(req,res){
  res.set('Access-Control-Allow-Origin','https://trilheiros-reservas.web.app');
  res.set('Access-Control-Allow-Headers','Authorization, Content-Type');
  res.set('Access-Control-Allow-Methods','GET, POST, OPTIONS');
  if(req.method==='OPTIONS')return res.status(204).send('');
  try{
    const user=await requireAdmin(req),action=clean(req.query.action||req.body?.action||'status');
    if(req.method==='GET'&&action==='status'){
      const [settings,connection,conversations,events]=await Promise.all([loadSettings(),metaConnection(),db.collection('instagram_conversations').count().get(),db.collection('instagram_events').where('status','==','error').count().get()]);
      return sendJson(res,{ok:true,settings,connection,counts:{conversations:conversations.data().count,errors:events.data().count},webhook_url:'https://trilheiros-reservas.web.app/instagram/webhook'});
    }
    if(req.method==='GET'&&action==='conversations'){
      const limit=Math.min(100,Math.max(10,Number(req.query.limit||50))),snap=await db.collection('instagram_conversations').orderBy('updated_at','desc').limit(limit).get();
      return sendJson(res,{ok:true,conversations:snap.docs.map(doc=>({id:doc.id,...doc.data()}))});
    }
    if(req.method==='POST'&&action==='settings'){
      const b=req.body||{},connection=await metaConnection();
      if(b.enabled===true&&!connection.connected)return sendJson(res,{ok:false,error:'Conecte e valide a conta oficial da Meta antes de ativar.'},409);
      const patch={enabled:b.enabled===true,mode:b.mode==='automatic'?'automatic':'suggestions',reply_comments:b.reply_comments!==false,reply_messages:b.reply_messages!==false,comment_to_dm:b.comment_to_dm===true,reservation_url:clean(b.reservation_url)||'https://trilheirosderondonopolis.my.canva.site/',max_user_replies_hour:Math.min(20,Math.max(2,Number(b.max_user_replies_hour||8))),account_username:clean(b.account_username)||'trilheiros.roomt',updated_at:FieldValue.serverTimestamp(),updated_by:user.email||user.uid};
      await settingsRef().set(patch,{merge:true});return sendJson(res,{ok:true,settings:{...await loadSettings(),...patch}});
    }
    if(req.method==='POST'&&action==='takeover'){
      const id=clean(req.body?.conversation_id),enabled=req.body?.enabled===true;if(!id)return sendJson(res,{ok:false,error:'Conversa inválida.'},400);
      await conversationRef(id).set({human_takeover:enabled,human_takeover_at:enabled?FieldValue.serverTimestamp():FieldValue.delete(),human_takeover_by:enabled?(user.email||user.uid):FieldValue.delete(),updated_at:FieldValue.serverTimestamp()},{merge:true});return sendJson(res,{ok:true});
    }
    if(req.method==='POST'&&action==='reply'){
      const id=clean(req.body?.conversation_id),text=clean(req.body?.text).slice(0,1000);if(!id||!text)return sendJson(res,{ok:false,error:'Informe a conversa e a resposta.'},400);
      const ref=conversationRef(id),snap=await ref.get();if(!snap.exists)return sendJson(res,{ok:false,error:'Conversa não encontrada.'},404);const conversation=snap.data()||{};
      const result=conversation.reply_kind==='comment'?await replyToComment(conversation.reply_target,text):await sendDirect(conversation.reply_target,text);
      await ref.set({human_takeover:true,human_takeover_at:FieldValue.serverTimestamp(),human_takeover_by:user.email||user.uid,status:'human',last_outgoing_text:text,last_outgoing_at:FieldValue.serverTimestamp(),last_meta_message_id:result?.id||result?.message_id||'',suggested_reply:FieldValue.delete(),updated_at:FieldValue.serverTimestamp()},{merge:true});return sendJson(res,{ok:true});
    }
    if(req.method==='POST'&&action==='simulate'){
      const trips=await loadTrips(),text=clean(req.body?.text),trip=resolveTrip({text,trips,preferredTripId:clean(req.body?.trip_id)}),answer=buildReply({text,trip,trips,channel:req.body?.channel==='comment'?'comment':'dm',actorName:clean(req.body?.actor_name)||'Visitante',seed:`simulation:${text}`,reservationUrl:(await loadSettings()).reservation_url});
      return sendJson(res,{ok:true,trip:trip?{id:trip.id,name:trip.name}:null,...answer});
    }
    return sendJson(res,{ok:false,error:'Ação não encontrada.'},404);
  }catch(error){logger.error('Instagram Admin API.',{error:String(error)});return sendJson(res,{ok:false,error:error?.message||'Erro interno.'},error?.status||500)}
}

export const instagramWebhook=onRequest({region:REGION,memory:'256MiB',timeoutSeconds:60,maxInstances:3,secrets:BOUND_SECRETS},webhookHandler);
export const instagramAdminApi=onRequest({region:REGION,memory:'256MiB',timeoutSeconds:60,maxInstances:2,secrets:BOUND_SECRETS},adminHandler);
