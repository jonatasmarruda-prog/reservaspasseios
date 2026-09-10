import admin from 'firebase-admin';

const rawService=process.env.FIREBASE_SERVICE_ACCOUNT||'';
const resendKey=process.env.RESEND_API_KEY||'';
const emailFrom=process.env.EMAIL_FROM||'';
const LOGO='https://i.postimg.cc/JnF2F9Hw/LOGO-TRILHEIROS-Photoroom.png';
const WHATSAPP='5566996926174';
const TZ='America/Cuiaba';

if(!rawService||!resendKey||!emailFrom){
  console.log('Lembrete de passeio não configurado: faltam FIREBASE_SERVICE_ACCOUNT, RESEND_API_KEY ou EMAIL_FROM.');
  process.exit(0);
}
let service;
try{service=JSON.parse(rawService)}catch{console.error('FIREBASE_SERVICE_ACCOUNT não é JSON válido.');process.exit(1)}
admin.initializeApp({credential:admin.credential.cert(service)});
const db=admin.firestore();
const FieldValue=admin.firestore.FieldValue;

const num=v=>Math.max(0,Number(v||0)||0);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const validEmail=v=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v||'').trim());
const firstName=v=>String(v||'Trilheiro').trim().split(/\s+/)[0]||'Trilheiro';
function iso(v){
  if(!v)return'';
  if(typeof v==='string'&&/^\d{4}-\d{2}-\d{2}/.test(v))return v.slice(0,10);
  try{const d=typeof v?.toDate==='function'?v.toDate():v?.seconds?new Date(v.seconds*1000):new Date(v);if(Number.isNaN(d.getTime()))return'';return new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(d)}catch{return''}
}
function addDays(date,days){const[y,m,d]=date.split('-').map(Number);return new Date(Date.UTC(y,m-1,d+days,12)).toISOString().slice(0,10)}
const today=()=>iso(new Date());
function brDate(v){const s=iso(v);if(!s)return'Data a confirmar';const[y,m,d]=s.split('-');return`${d}/${m}/${y}`}
function dateRange(t){const start=t?.trip_date||'',end=t?.trip_end_date||'';return end&&iso(end)!==iso(start)?`${brDate(start)} a ${brDate(end)}`:brDate(start)}
function nl2br(v){return esc(v).replace(/\r?\n/g,'<br>')}
function participantNames(sale){return (Array.isArray(sale?.participants)?sale.participants:[]).map(x=>String(x?.full_name||'').trim()).filter(Boolean)}
function whatsappUrl(sale,trip){const text=`Olá Jonatas! Recebi o lembrete do passeio ${trip?.name||sale?.trip_name||''}. Meu protocolo é ${sale?.protocol||'não informado'}.`;return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(text)}`}
function paidInFull(s){const total=num(s?.sale_total),paid=num(s?.paid_amount),bal=num(s?.balance_due);return s?.sale_status!=='cancelled'&&s?.payment_status==='paid'&&bal<=0.009&&(!total||paid>=total-0.009)}

function emailHtml(sale,trip){
  const customer=sale.customer_name||participantNames(sale)[0]||'Trilheiro',tripName=trip?.name||sale.trip_name||'seu passeio',destination=trip?.destination||'',names=participantNames(sale),wa=whatsappUrl(sale,trip),group=String(trip?.whatsapp_group_url||'').trim(),bring=String(trip?.what_to_bring||'').trim(),departure=String(trip?.departure_time||'').trim(),point=String(trip?.departure_point||'').trim(),returnInfo=String(trip?.return_info||trip?.return_time||'').trim();
  return `<!doctype html><html><body style="margin:0;background:#eef4f1;font-family:Arial,Helvetica,sans-serif;color:#17372d"><div style="padding:28px 14px"><div style="max-width:660px;margin:auto;background:#fff;border:1px solid #d9e5df;border-radius:24px;overflow:hidden;box-shadow:0 16px 40px rgba(7,50,38,.08)"><div style="background:#073226;padding:28px 26px;text-align:center"><img src="${LOGO}" alt="Trilheiros de Rondonópolis" width="150" style="display:block;max-width:150px;height:auto;margin:0 auto 14px"><div style="font-size:12px;font-weight:800;letter-spacing:.13em;color:#d9b44c">SEU PASSEIO É AMANHÃ</div><h1 style="margin:10px 0 4px;color:#fff;font-size:29px;line-height:1.15">É amanhã, ${esc(firstName(customer))}! 🥾🌿</h1><p style="margin:0;color:#cfe2da;font-size:15px;line-height:1.5">Prepare a mochila: sua próxima experiência com os Trilheiros está chegando.</p></div><div style="padding:28px 26px"><h2 style="margin:0 0 6px;font-size:23px;color:#073226">${esc(tripName)}</h2>${destination?`<p style="margin:0 0 20px;color:#657b72">📍 ${esc(destination)}</p>`:''}<div style="background:#f2f8f5;border:1px solid #dceae3;border-radius:18px;padding:18px"><div style="margin-bottom:12px"><span style="display:block;font-size:10px;font-weight:800;color:#71857d;letter-spacing:.08em">DATA</span><b style="display:block;margin-top:4px;font-size:17px;color:#073226">📅 ${esc(dateRange(trip))}</b></div>${departure?`<div style="margin-bottom:12px"><span style="display:block;font-size:10px;font-weight:800;color:#71857d;letter-spacing:.08em">HORÁRIO DE SAÍDA</span><b style="display:block;margin-top:4px;font-size:16px;color:#17372d">⏰ ${esc(departure)}</b></div>`:''}${point?`<div style="margin-bottom:12px"><span style="display:block;font-size:10px;font-weight:800;color:#71857d;letter-spacing:.08em">PONTO DE SAÍDA</span><b style="display:block;margin-top:4px;font-size:15px;color:#17372d">📍 ${esc(point)}</b></div>`:''}${returnInfo?`<div style="margin-bottom:12px"><span style="display:block;font-size:10px;font-weight:800;color:#71857d;letter-spacing:.08em">RETORNO</span><b style="display:block;margin-top:4px;font-size:15px;color:#17372d">↩️ ${esc(returnInfo)}</b></div>`:''}<div><span style="display:block;font-size:10px;font-weight:800;color:#71857d;letter-spacing:.08em">PARTICIPANTE(S)</span><b style="display:block;margin-top:4px;font-size:15px;color:#17372d">${esc(names.length?names.join(' • '):customer)}</b></div></div>${bring?`<div style="margin-top:20px;padding:18px;border-radius:18px;background:#fffaf0;border:1px solid #ecdcae"><div style="font-size:11px;font-weight:900;color:#765b16;letter-spacing:.06em;margin-bottom:8px">🎒 O QUE LEVAR / ORIENTAÇÕES</div><div style="font-size:14px;line-height:1.65;color:#554a2e">${nl2br(bring)}</div></div>`:''}<p style="font-size:15px;line-height:1.65;margin:24px 0 8px">Confira seus pertences e chegue ao ponto de saída com antecedência. Qualquer dúvida sobre o passeio, fale diretamente com o <b>Jonatas</b>.</p><div style="text-align:center;margin:26px 0"><a href="${wa}" style="display:inline-block;background:#0b684b;color:#fff;text-decoration:none;font-weight:800;padding:14px 22px;border-radius:13px">Falar com o Jonatas no WhatsApp</a>${group?`<br><a href="${esc(group)}" style="display:inline-block;margin-top:10px;color:#0b684b;font-weight:800;text-decoration:none">Abrir grupo do passeio</a>`:''}</div><div style="border-top:1px solid #e5ece8;margin-top:28px;padding-top:20px;text-align:center;color:#71837c;font-size:12px;line-height:1.6"><b style="color:#073226">Trilheiros de Rondonópolis</b><br>Aqui ninguém vai só. 🥾💚<br>WhatsApp: (66) 99692-6174</div></div></div></div></body></html>`;
}
function emailText(sale,trip){const customer=sale.customer_name||participantNames(sale)[0]||'Trilheiro',tripName=trip?.name||sale.trip_name||'seu passeio';return `É amanhã, ${firstName(customer)}!\n\n${tripName}\nData: ${dateRange(trip)}${trip?.departure_time?`\nSaída: ${trip.departure_time}`:''}${trip?.departure_point?`\nPonto: ${trip.departure_point}`:''}${trip?.what_to_bring?`\n\nO que levar / orientações:\n${trip.what_to_bring}`:''}\n\nQualquer dúvida, fale com o Jonatas: (66) 99692-6174.\n\nTrilheiros de Rondonópolis — Aqui ninguém vai só.`}

const tomorrow=addDays(today(),1);
const [salesSnap,tripsSnap]=await Promise.all([db.collection('sales').where('payment_status','==','paid').limit(500).get(),db.collection('trips').get()]);
const trips=new Map(tripsSnap.docs.map(d=>[d.id,{id:d.id,...d.data()}]));
const eligible=[];
for(const doc of salesSnap.docs){
  const sale={id:doc.id,...doc.data()},trip=trips.get(sale.trip_id);
  if(!trip||trip.status==='cancelled'||trip.email_reminder_enabled===false)continue;
  if(iso(trip.trip_date)!==tomorrow||!paidInFull(sale))continue;
  if(sale.trip_reminder_status==='sent'&&sale.trip_reminder_for===tomorrow)continue;
  const email=String(sale.customer_email||sale.email||'').trim().toLowerCase();
  if(!validEmail(email)){await doc.ref.set({trip_reminder_status:'skipped_no_email',trip_reminder_for:tomorrow,trip_reminder_checked_at:FieldValue.serverTimestamp()},{merge:true});continue}
  eligible.push({doc,sale,trip,email});
}
if(!eligible.length){console.log(`Nenhuma reserva quitada para lembrar em ${tomorrow}.`);process.exit(0)}

let sent=0,failed=0;
for(const {doc,sale,trip,email} of eligible){
  try{
    await doc.ref.set({trip_reminder_status:'sending',trip_reminder_for:tomorrow,trip_reminder_last_attempt_at:FieldValue.serverTimestamp()},{merge:true});
    const resp=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${resendKey}`,'Content-Type':'application/json'},body:JSON.stringify({from:emailFrom,to:[email],reply_to:'trilheiros.roomt@gmail.com',subject:`🥾 É amanhã: ${trip.name||sale.trip_name||'seu passeio'}`,html:emailHtml(sale,trip),text:emailText(sale,trip)})});
    if(!resp.ok)throw new Error(`Resend ${resp.status}: ${await resp.text()}`);
    const payload=await resp.json().catch(()=>({}));
    await doc.ref.set({trip_reminder_status:'sent',trip_reminder_for:tomorrow,trip_reminder_sent_at:FieldValue.serverTimestamp(),trip_reminder_resend_id:payload.id||'',trip_reminder_to:email,trip_reminder_error:FieldValue.delete()},{merge:true});
    sent++;console.log(`Lembrete enviado: ${sale.customer_name||email} • ${trip.name}`);
  }catch(err){failed++;const message=String(err?.message||err).slice(0,900);await doc.ref.set({trip_reminder_status:'error',trip_reminder_for:tomorrow,trip_reminder_error:message,trip_reminder_last_attempt_at:FieldValue.serverTimestamp()},{merge:true}).catch(()=>{});console.error(`Falha no lembrete ${sale.id}:`,message)}
}
console.log(`Lembretes de ${tomorrow}: ${sent} enviado(s), ${failed} falha(s).`);
if(failed&&sent===0)process.exitCode=1;
