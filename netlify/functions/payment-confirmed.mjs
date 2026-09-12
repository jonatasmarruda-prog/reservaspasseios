import {createRemoteJWKSet,jwtVerify} from 'jose';
import webpush from 'web-push';

const PROJECT_ID='trilheiros-reservas';
const OWNER_EMAIL='trilheiros.roomt@gmail.com';
const EMAIL_FROM='Trilheiros de Rondonópolis <reservas@trilheirosderondonopolis.com.br>';
const REPLY_TO='trilheiros.roomt@gmail.com';
const LOGO='https://i.postimg.cc/JnF2F9Hw/LOGO-TRILHEIROS-Photoroom.png';
const WHATSAPP='5566996926174';
const ALLOWED_ORIGINS=new Set(['https://trilheiros-reservas.web.app','https://trilheiros-reservas.firebaseapp.com']);
const JWKS=createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));
const clean=v=>String(v??'').trim();
const num=v=>Math.max(0,Number(v||0)||0);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(num(v));
const validEmail=v=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(v));
const fullyPaid=s=>{
  const total=num(s?.sale_total||s?.total_amount||s?.amount),paid=num(s?.paid_amount||s?.amount_paid||s?.received_amount),raw=Number(s?.balance_due),balance=Number.isFinite(raw)?Math.max(0,raw):Math.max(0,total-paid),status=clean(s?.payment_status||s?.status).toLowerCase();
  return clean(s?.sale_status).toLowerCase()!=='cancelled'&&balance<=0.009&&(['paid','confirmed','approved','completed','pago','quitado'].includes(status)||s?.payment_confirmed===true||(total>0&&paid>=total-0.009));
};
const brDate=v=>{const s=clean(v).slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return'Data a confirmar';const[y,m,d]=s.split('-');return`${d}/${m}/${y}`};
const response=(statusCode,body,origin='')=>({statusCode,headers:{'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':ALLOWED_ORIGINS.has(origin)?origin:'https://trilheiros-reservas.web.app','Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'},body:JSON.stringify(body)});

async function verifyOwner(event){
  const auth=clean(event.headers?.authorization||event.headers?.Authorization);
  if(!auth.startsWith('Bearer '))throw Object.assign(new Error('Não autenticado'),{status:401});
  const token=auth.slice(7);
  const {payload}=await jwtVerify(token,JWKS,{issuer:`https://securetoken.google.com/${PROJECT_ID}`,audience:PROJECT_ID});
  if(clean(payload.email).toLowerCase()!==OWNER_EMAIL||payload.email_verified===false)throw Object.assign(new Error('Acesso não autorizado'),{status:403});
  return payload;
}

function participants(s){
  const list=Array.isArray(s?.participants)?s.participants:[];
  const names=list.map(x=>clean(x?.full_name||x?.name)).filter(Boolean);
  const fallback=clean(s?.customer_name||s?.responsible_name);
  return names.length?names:(fallback?[fallback]:[]);
}

function welcomeTemplate(s){
  const name=clean(s.customer_name||s.responsible_name)||participants(s)[0]||'Trilheiro';
  const first=name.split(/\s+/)[0]||'Trilheiro';
  const trip=clean(s.trip_name)||'seu próximo passeio';
  const destination=clean(s.destination),names=participants(s),date=brDate(s.trip_date),paid=num(s.paid_amount),protocol=clean(s.protocol)||'—';
  const wa=`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(`Olá Jonatas! Estou falando sobre o passeio ${trip}. Protocolo: ${protocol}.`)}`;
  const subject=`🥾 Sua viagem está confirmada: ${trip}`;
  const html=`<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head><body style="margin:0;background:#eef4f1;font-family:Arial,Helvetica,sans-serif;color:#17372d"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;background:#fff;border:1px solid #d9e5df;border-radius:20px"><tr><td align="center" bgcolor="#073226" style="padding:28px 24px;background-color:#073226"><img src="${LOGO}" alt="Trilheiros de Rondonópolis" width="150" height="150" border="0" style="display:block;object-fit:contain"><p style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#d9b44c;font-weight:800">PAGAMENTO CONFIRMADO</p><h1 style="font-family:Arial,Helvetica,sans-serif;font-size:28px;line-height:34px;color:#fff;margin:8px 0 0">Parabéns, ${esc(first)}! 🎉</h1></td></tr><tr><td style="padding:26px 24px"><h2 style="font-family:Arial,Helvetica,sans-serif;font-size:22px;line-height:28px;color:#073226">${esc(trip)}</h2>${destination?`<p style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:21px;color:#657b72">📍 ${esc(destination)}</p>`:''}<p style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:21px;color:#17372d"><b>Data:</b> ${esc(date)}</p><p style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:21px;color:#17372d"><b>Participante(s):</b> ${esc(names.length?names.join(' • '):name)}</p><p style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:21px;color:#17372d"><b>Protocolo:</b> ${esc(protocol)}</p><p style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:21px;color:#13744e"><b>✅ Pagamento confirmado${paid>0?` • ${esc(money(paid))}`:''}</b></p><p style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:21px;color:#50685e">Sua vaga está confirmada. Mais perto da data você receberá as orientações pré-trilha.</p><table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td bgcolor="#0b684b" style="background-color:#0b684b;border-radius:12px"><a href="${esc(wa)}" style="display:inline-block;padding:14px 22px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px;color:#fff;text-decoration:none;font-weight:800">Falar com Jonatas no WhatsApp</a></td></tr></table><p style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#71837c;text-align:center">Trilheiros de Rondonópolis • Aqui ninguém vai só. 🥾💚</p></td></tr></table></td></tr></table></body></html>`;
  const text=`Parabéns, ${first}!\n\nSeu pagamento foi confirmado e sua vaga está garantida para ${trip}.\nData: ${date}\nParticipante(s): ${names.length?names.join(', '):name}\nProtocolo: ${protocol}\n${paid>0?`Pagamento confirmado: ${money(paid)}\n`:''}\nMais perto da data você receberá as orientações pré-trilha.\n\nDúvidas: Jonatas — (66) 99692-6174.`;
  return{subject,html,text};
}

async function sendEmail(sale,saleId){
  if(!fullyPaid(sale))return{sent:false,skipped:true,reason:'not_fully_paid'};
  const email=clean(sale.customer_email||sale.email).toLowerCase();
  if(!validEmail(email))return{sent:false,skipped:true,reason:'invalid_email'};
  const key=process.env.RESEND_API_KEY;
  if(!key)throw new Error('RESEND_API_KEY ausente');
  const t=welcomeTemplate(sale);
  const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json','Idempotency-Key':`welcome-${saleId}-${Math.round(num(sale.paid_amount)*100)}`},body:JSON.stringify({from:EMAIL_FROM,to:[email],reply_to:REPLY_TO,subject:t.subject,html:t.html,text:t.text})});
  const raw=await r.text();
  if(!r.ok)throw new Error(`Resend ${r.status}: ${raw.slice(0,300)}`);
  let data={};try{data=JSON.parse(raw)}catch{}
  return{sent:true,to:email,id:data.id||''};
}

async function sendPush(sale,subscription,saleId){
  if(!subscription?.endpoint||!subscription?.keys?.p256dh||!subscription?.keys?.auth)return{sent:false,skipped:true,reason:'no_subscription'};
  const pub=process.env.WEB_PUSH_PUBLIC_KEY,priv=process.env.WEB_PUSH_PRIVATE_KEY;
  if(!pub||!priv)throw new Error('Chaves Web Push ausentes');
  webpush.setVapidDetails(`mailto:${OWNER_EMAIL}`,pub,priv);
  const total=num(sale.sale_total),paid=num(sale.paid_amount),balance=Math.max(0,Number.isFinite(Number(sale.balance_due))?Number(sale.balance_due):Math.max(0,total-paid));
  const delta=num(sale.last_payment_amount)||paid;
  const name=clean(sale.customer_name||sale.responsible_name)||'Cliente',trip=clean(sale.trip_name)||'Passeio';
  const title=balance<=0.009?`✅ Pagamento confirmado — ${name}`:`💳 Pagamento parcial — ${name}`;
  const body=balance<=0.009?`${trip} • recebido ${money(delta)} • quitado`:`${trip} • recebido ${money(delta)} • falta ${money(balance)}`;
  const payload=JSON.stringify({title,body,url:'/admin?tab=pending',tag:`payment-${saleId}-${Math.round(paid*100)}`,type:'payment_confirmed',timestamp:Date.now()});
  try{
    await webpush.sendNotification(subscription,payload,{TTL:120,urgency:'high'});
    return{sent:true};
  }catch(e){
    const code=Number(e?.statusCode||0);if(code===404||code===410)return{sent:false,expired:true};
    throw e;
  }
}

export const handler=async event=>{
  const origin=clean(event.headers?.origin);
  if(event.httpMethod==='OPTIONS')return response(204,{},origin);
  if(event.httpMethod!=='POST')return response(405,{ok:false,error:'Método não permitido'},origin);
  if(origin&&!ALLOWED_ORIGINS.has(origin))return response(403,{ok:false,error:'Origem não autorizada'},origin);
  try{
    await verifyOwner(event);
    const body=JSON.parse(event.body||'{}'),sale=body.sale||{},saleId=clean(body.saleId);
    if(!saleId)throw Object.assign(new Error('Venda não informada'),{status:400});
    const [email,push]=await Promise.allSettled([sendEmail(sale,saleId),sendPush(sale,body.subscription,saleId)]);
    const emailResult=email.status==='fulfilled'?email.value:{sent:false,error:String(email.reason?.message||email.reason||'Falha no e-mail')};
    const pushResult=push.status==='fulfilled'?push.value:{sent:false,error:String(push.reason?.message||push.reason||'Falha na notificação')};
    if(!emailResult.sent&&!emailResult.skipped&&!pushResult.sent&&!pushResult.skipped&&!pushResult.expired){
      return response(502,{ok:false,error:`E-mail: ${emailResult.error||'falhou'}; Push: ${pushResult.error||'falhou'}`,email:emailResult,push:pushResult},origin);
    }
    return response(200,{ok:true,email:emailResult,push:pushResult},origin);
  }catch(e){
    console.error('payment-confirmed',e);
    return response(e.status||500,{ok:false,error:e.message||'Falha no disparo imediato'},origin);
  }
};
