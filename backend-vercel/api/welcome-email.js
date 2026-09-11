import {createHash} from 'node:crypto';
import {getAdmin,getDb,verifyFirebaseBearer} from './_lib/firebase.js';

const OWNER_EMAIL='trilheiros.roomt@gmail.com';
const EMAIL_FROM='Trilheiros de Rondonópolis <reservas@trilheirosderondonopolis.com.br>';
const EMAIL_REPLY_TO='trilheiros.roomt@gmail.com';
const LOGO='https://i.postimg.cc/JnF2F9Hw/LOGO-TRILHEIROS-Photoroom.png';
const WHATSAPP='5566996926174';
const allowedOrigins=new Set(['https://trilheiros-reservas.web.app','https://trilheiros-reservas.firebaseapp.com']);
const clean=v=>String(v??'').trim();
const num=v=>Math.max(0,Number(v||0)||0);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const validEmail=v=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(v));
const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(num(v));
const hash=v=>createHash('sha256').update(String(v||'')).digest('hex');
const json=(res,status,data)=>res.status(status).setHeader('Content-Type','application/json').end(JSON.stringify(data));

function cors(req,res){
  const origin=String(req.headers.origin||'');
  if(allowedOrigins.has(origin))res.setHeader('Access-Control-Allow-Origin',origin);
  res.setHeader('Vary','Origin');
  res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');
}
function fullyPaid(s){
  if(!s||String(s.sale_status||'').toLowerCase()==='cancelled')return false;
  const total=num(s.sale_total||s.total_amount||s.amount),paid=num(s.paid_amount||s.amount_paid||s.received_amount),raw=Number(s.balance_due),balance=Number.isFinite(raw)?Math.max(0,raw):Math.max(0,total-paid),status=String(s.payment_status||'').toLowerCase();
  const explicit=['paid','confirmed','approved','completed','pago','quitado'].includes(status)||s.payment_confirmed===true;
  return balance<=0.009&&(explicit||(total>0&&paid>=total-0.009)||!!s.payment_completed_at);
}
function brDate(v){
  const s=clean(v).slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return'Data a confirmar';
  const[y,m,d]=s.split('-');return`${d}/${m}/${y}`;
}
function participants(row){
  const list=Array.isArray(row?.participants)?row.participants:[];
  const names=list.map(x=>clean(x?.full_name||x?.name)).filter(Boolean);
  const fallback=clean(row?.customer_name||row?.responsible_name||row?.name);
  return names.length?names:(fallback?[fallback]:[]);
}
function template(sale,trip){
  const name=clean(sale.customer_name||sale.responsible_name)||participants(sale)[0]||'Trilheiro';
  const first=name.split(/\s+/)[0]||'Trilheiro';
  const tripName=clean(trip?.name||sale.trip_name)||'seu próximo passeio';
  const destination=clean(trip?.destination||sale.destination);
  const names=participants(sale);
  const paid=num(sale.paid_amount||sale.amount_paid||sale.received_amount);
  const date=brDate(trip?.trip_date||sale.trip_date);
  const msg=`Olá Jonatas! Estou falando sobre o passeio ${tripName}. Protocolo: ${clean(sale.protocol)||'não informado'}.`;
  const wa=`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`;
  const subject=`🥾 Sua viagem está confirmada: ${tripName}`;
  const html=`<!doctype html><html><body style="margin:0;background:#eef4f1;font-family:Arial,Helvetica,sans-serif;color:#17372d"><table role="presentation" width="100%"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="100%" style="max-width:640px;background:#fff;border:1px solid #d9e5df;border-radius:20px"><tr><td align="center" bgcolor="#073226" style="padding:28px 24px"><img src="${LOGO}" alt="Trilheiros de Rondonópolis" width="150" height="150" style="display:block;object-fit:contain"><p style="font-size:12px;color:#d9b44c;font-weight:800">PAGAMENTO CONFIRMADO</p><h1 style="font-size:28px;color:#fff;margin:8px 0 0">Parabéns, ${esc(first)}! 🎉</h1></td></tr><tr><td style="padding:26px 24px"><h2 style="font-size:22px;color:#073226">${esc(tripName)}</h2>${destination?`<p style="color:#657b72">📍 ${esc(destination)}</p>`:''}<p><b>Data:</b> ${esc(date)}</p><p><b>Participante(s):</b> ${esc(names.length?names.join(' • '):name)}</p><p><b>Protocolo:</b> ${esc(sale.protocol||'—')}</p><p style="color:#13744e"><b>✅ Pagamento confirmado${paid>0?` • ${esc(money(paid))}`:''}</b></p><p style="color:#50685e">Sua vaga está confirmada. Mais perto da data você receberá as orientações pré-trilha.</p><p style="text-align:center"><a href="${esc(wa)}" style="display:inline-block;padding:14px 22px;background:#0b684b;color:#fff;text-decoration:none;border-radius:12px;font-weight:800">Falar com Jonatas no WhatsApp</a></p><p style="font-size:12px;color:#71837c;text-align:center">Trilheiros de Rondonópolis • Aqui ninguém vai só. 🥾💚</p></td></tr></table></td></tr></table></body></html>`;
  const text=`Parabéns, ${first}!\n\nSeu pagamento foi confirmado e sua vaga está garantida para ${tripName}.\nData: ${date}\nParticipante(s): ${names.length?names.join(', '):name}\nProtocolo: ${sale.protocol||'—'}\n${paid>0?`Pagamento confirmado: ${money(paid)}\n`:''}\nMais perto da data você receberá as orientações pré-trilha.\n\nDúvidas: Jonatas — (66) 99692-6174.`;
  return{subject,html,text};
}

export default async function handler(req,res){
  cors(req,res);
  if(req.method==='OPTIONS')return res.status(204).end();
  if(req.method!=='POST')return json(res,405,{ok:false,error:'Método não permitido'});
  try{
    const user=await verifyFirebaseBearer(req);
    if(String(user.email||'').toLowerCase()!==OWNER_EMAIL)throw Object.assign(new Error('Acesso não autorizado'),{status:403});
    const saleId=clean(req.body?.saleId);if(!saleId)throw Object.assign(new Error('Venda não informada'),{status:400});
    const resendKey=process.env.RESEND_API_KEY||'';if(!resendKey)throw Object.assign(new Error('RESEND_API_KEY não configurada no Vercel'),{status:503});
    const db=getDb(),admin=getAdmin(),FV=admin.firestore.FieldValue,saleRef=db.collection('sales').doc(saleId),saleSnap=await saleRef.get();
    if(!saleSnap.exists)throw Object.assign(new Error('Venda não encontrada'),{status:404});
    const sale={id:saleSnap.id,...saleSnap.data()};
    if(!fullyPaid(sale))throw Object.assign(new Error('O pagamento ainda não está quitado'),{status:409});
    const email=clean(sale.customer_email||sale.email).toLowerCase();if(!validEmail(email))throw Object.assign(new Error('Venda sem e-mail válido'),{status:409});
    if(sale.welcome_email_sent_at||sale.welcome_email_status==='sent')return json(res,200,{ok:true,alreadySent:true,to:email});

    const dispatchId=hash(`welcome_paid|sales/${saleId}|first`),dispatchRef=db.collection('email_dispatches').doc(dispatchId);let claimed=false;
    await db.runTransaction(async tx=>{
      const [ss,ds]=await Promise.all([tx.get(saleRef),tx.get(dispatchRef)]);if(!ss.exists)return;
      const current=ss.data()||{};if(!fullyPaid(current)||current.welcome_email_sent_at||current.welcome_email_status==='sent')return;
      const d=ds.exists?ds.data()||{}:{};if(d.status==='sent')return;
      const updatedMs=Date.parse(String(d.updated_at||''))||0;if(d.status==='sending'&&updatedMs&&Date.now()-updatedMs<120000)return;
      const now=new Date().toISOString();
      tx.set(dispatchRef,{kind:'welcome_paid',source_type:'sale',source_path:`sales/${saleId}`,email,status:'sending',attempts:Number(d.attempts||0)+1,last_attempt_at:now,updated_at:now,created_at:d.created_at||now},{merge:true});
      tx.set(saleRef,{welcome_email_status:'sending',welcome_email_last_attempt_at:now},{merge:true});claimed=true;
    });
    if(!claimed){const fresh=(await saleRef.get()).data()||{};if(fresh.welcome_email_sent_at||fresh.welcome_email_status==='sent')return json(res,200,{ok:true,alreadySent:true,to:email});return json(res,202,{ok:true,processing:true,to:email});}

    const tripSnap=sale.trip_id?await db.collection('trips').doc(String(sale.trip_id)).get():null,trip=tripSnap?.exists?tripSnap.data():null,t=template(sale,trip);
    const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${resendKey}`,'Content-Type':'application/json','Idempotency-Key':`welcome-${dispatchId}`},body:JSON.stringify({from:EMAIL_FROM,to:[email],reply_to:EMAIL_REPLY_TO,...t})});
    const raw=await response.text();if(!response.ok)throw new Error(`Resend ${response.status}: ${raw.slice(0,500)}`);
    let payload={};try{payload=JSON.parse(raw||'{}')}catch{}
    const sentAt=new Date().toISOString();
    await Promise.all([dispatchRef.set({status:'sent',sent_at:sentAt,resend_id:payload.id||'',email,error:FV.delete(),updated_at:sentAt},{merge:true}),saleRef.set({welcome_email_status:'sent',welcome_email_sent_at:sentAt,welcome_email_resend_id:payload.id||'',welcome_email_to:email,welcome_email_version:6,welcome_email_error:FV.delete()},{merge:true})]);
    return json(res,200,{ok:true,sent:true,to:email,id:payload.id||''});
  }catch(e){
    console.error('welcome-email',e);
    try{const saleId=clean(req.body?.saleId);if(saleId){const db=getDb();await db.collection('sales').doc(saleId).set({welcome_email_status:'error',welcome_email_error:String(e?.message||e).slice(0,700),welcome_email_last_attempt_at:new Date().toISOString()},{merge:true});}}catch(_){ }
    return json(res,e.status||500,{ok:false,error:e.message||'Falha ao enviar e-mail'});
  }
}
