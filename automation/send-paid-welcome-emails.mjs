import admin from 'firebase-admin';

const rawService=process.env.FIREBASE_SERVICE_ACCOUNT||'';
const resendKey=process.env.RESEND_API_KEY||'';
const emailFrom=process.env.EMAIL_FROM||'';
const LOGO='https://i.postimg.cc/JnF2F9Hw/LOGO-TRILHEIROS-Photoroom.png';
const WHATSAPP='5566996926174';
const TZ='America/Cuiaba';

if(!rawService||!resendKey||!emailFrom){
  console.log('Boas-vindas não configuradas: faltam FIREBASE_SERVICE_ACCOUNT, RESEND_API_KEY ou EMAIL_FROM.');
  process.exit(0);
}

let service;
try{service=JSON.parse(rawService)}catch{
  console.error('FIREBASE_SERVICE_ACCOUNT não é JSON válido.');
  process.exit(1);
}

admin.initializeApp({credential:admin.credential.cert(service)});
const db=admin.firestore();
const FieldValue=admin.firestore.FieldValue;

const num=v=>Math.max(0,Number(v||0)||0);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const validEmail=v=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v||'').trim());
const firstName=v=>String(v||'Trilheiro').trim().split(/\s+/)[0]||'Trilheiro';
const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(num(v));

function iso(v){
  if(!v)return'';
  if(typeof v==='string'&&/^\d{4}-\d{2}-\d{2}/.test(v))return v.slice(0,10);
  try{
    const d=typeof v?.toDate==='function'?v.toDate():v?.seconds?new Date(v.seconds*1000):new Date(v);
    if(Number.isNaN(d.getTime()))return'';
    return new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
  }catch{return''}
}
function brDate(v){
  const s=iso(v);if(!s)return'Data a confirmar';
  const[y,m,d]=s.split('-');return`${d}/${m}/${y}`;
}
function dateRange(trip,sale){
  const start=trip?.trip_date||sale?.trip_date||'';
  const end=trip?.trip_end_date||'';
  return end&&iso(end)!==iso(start)?`${brDate(start)} a ${brDate(end)}`:brDate(start);
}
function participantNames(sale){
  const rows=Array.isArray(sale?.participants)?sale.participants:[];
  return rows.map(x=>String(x?.full_name||'').trim()).filter(Boolean);
}
function whatsappUrl(sale,trip){
  const text=`Olá Jonatas! Meu pagamento do passeio ${trip?.name||sale?.trip_name||'dos Trilheiros'} foi confirmado. Protocolo: ${sale?.protocol||'não informado'}.`;
  return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(text)}`;
}
function emailHtml(sale,trip){
  const name=sale.customer_name||participantNames(sale)[0]||'Trilheiro';
  const tripName=trip?.name||sale.trip_name||'seu próximo passeio';
  const destination=trip?.destination||'';
  const names=participantNames(sale);
  const date=dateRange(trip,sale);
  const wa=whatsappUrl(sale,trip);
  const paid=num(sale.paid_amount);
  return `<!doctype html><html><body style="margin:0;background:#eef4f1;font-family:Arial,Helvetica,sans-serif;color:#17372d">
  <div style="padding:28px 14px">
    <div style="max-width:640px;margin:auto;background:#ffffff;border:1px solid #d9e5df;border-radius:24px;overflow:hidden;box-shadow:0 16px 40px rgba(7,50,38,.08)">
      <div style="background:#073226;padding:28px 26px;text-align:center">
        <img src="${LOGO}" alt="Trilheiros de Rondonópolis" width="150" style="display:block;max-width:150px;height:auto;margin:0 auto 14px">
        <div style="font-size:12px;font-weight:800;letter-spacing:.13em;color:#d9b44c">PAGAMENTO CONFIRMADO</div>
        <h1 style="margin:10px 0 4px;color:#ffffff;font-size:29px;line-height:1.15">Parabéns, ${esc(firstName(name))}! 🎉</h1>
        <p style="margin:0;color:#cfe2da;font-size:15px;line-height:1.5">Sua vaga está confirmada. Agora é só preparar a mochila e vir viver essa experiência com a gente.</p>
      </div>
      <div style="padding:28px 26px">
        <h2 style="margin:0 0 6px;font-size:23px;color:#073226">${esc(tripName)}</h2>
        ${destination?`<p style="margin:0 0 20px;color:#657b72">📍 ${esc(destination)}</p>`:'<div style="height:10px"></div>'}
        <div style="background:#f2f8f5;border:1px solid #dceae3;border-radius:18px;padding:18px">
          <div style="margin-bottom:12px"><span style="display:block;font-size:10px;font-weight:800;color:#71857d;letter-spacing:.08em">DATA DO PASSEIO</span><b style="display:block;margin-top:4px;font-size:17px;color:#073226">📅 ${esc(date)}</b></div>
          <div style="margin-bottom:12px"><span style="display:block;font-size:10px;font-weight:800;color:#71857d;letter-spacing:.08em">PARTICIPANTE(S)</span><b style="display:block;margin-top:4px;font-size:15px;color:#17372d">${esc(names.length?names.join(' • '):name)}</b></div>
          <div style="margin-bottom:12px"><span style="display:block;font-size:10px;font-weight:800;color:#71857d;letter-spacing:.08em">PROTOCOLO</span><b style="display:block;margin-top:4px;font-size:15px;color:#17372d">${esc(sale.protocol||'—')}</b></div>
          <div><span style="display:block;font-size:10px;font-weight:800;color:#71857d;letter-spacing:.08em">PAGAMENTO</span><b style="display:block;margin-top:4px;font-size:15px;color:#13744e">✅ Confirmado${paid>0?` • ${esc(money(paid))}`:''}</b></div>
        </div>
        <p style="font-size:16px;line-height:1.65;margin:24px 0 8px">Vai ser incrível ter você com a gente! Nosso objetivo é proporcionar uma experiência segura, organizada e cheia de boas lembranças.</p>
        <p style="font-size:15px;line-height:1.6;margin:0 0 24px;color:#50685e">Se surgir qualquer dúvida sobre horário, ponto de saída, o que levar ou qualquer detalhe do passeio, fale diretamente com o <b>Jonatas</b>. Estamos à disposição.</p>
        <div style="text-align:center;margin:26px 0">
          <a href="${wa}" style="display:inline-block;background:#0b684b;color:#ffffff;text-decoration:none;font-weight:800;padding:14px 22px;border-radius:13px">Falar com o Jonatas no WhatsApp</a>
        </div>
        <div style="border-top:1px solid #e5ece8;margin-top:28px;padding-top:20px;text-align:center;color:#71837c;font-size:12px;line-height:1.6">
          <b style="color:#073226">Trilheiros de Rondonópolis</b><br>
          Aqui ninguém vai só. 🥾💚<br>
          WhatsApp: (66) 99692-6174
        </div>
      </div>
    </div>
  </div></body></html>`;
}
function emailText(sale,trip){
  const name=sale.customer_name||participantNames(sale)[0]||'Trilheiro';
  const tripName=trip?.name||sale.trip_name||'seu próximo passeio';
  const names=participantNames(sale);
  return `Parabéns, ${firstName(name)}!\n\nSeu pagamento foi confirmado e sua vaga está garantida para ${tripName}.\nData: ${dateRange(trip,sale)}\nParticipante(s): ${names.length?names.join(', '):name}\nProtocolo: ${sale.protocol||'—'}\n\nVai ser incrível ter você com a gente! Se tiver qualquer dúvida, fale com o Jonatas pelo WhatsApp (66) 99692-6174.\n\nTrilheiros de Rondonópolis — Aqui ninguém vai só.`;
}

const salesSnap=await db.collection('sales').where('payment_status','==','paid').limit(100).get();
const eligible=[];
for(const doc of salesSnap.docs){
  const sale={id:doc.id,...doc.data()};
  const email=String(sale.customer_email||sale.email||'').trim().toLowerCase();
  if(sale.sale_status==='cancelled'||sale.welcome_email_sent_at||sale.welcome_email_status==='sent')continue;
  if(!sale.payment_completed_at)continue;
  if(num(sale.balance_due)>0.009)continue;
  if(!validEmail(email)){
    await doc.ref.set({welcome_email_status:'skipped_no_email',welcome_email_checked_at:FieldValue.serverTimestamp()},{merge:true});
    continue;
  }
  eligible.push({doc,sale,email});
}

if(!eligible.length){
  console.log('Nenhum pagamento quitado aguardando e-mail de boas-vindas.');
  process.exit(0);
}

const tripCache=new Map();
let sent=0,failed=0;
for(const item of eligible.slice(0,30)){
  const {doc,sale,email}=item;
  try{
    let trip=null;
    if(sale.trip_id){
      if(tripCache.has(sale.trip_id))trip=tripCache.get(sale.trip_id);
      else{
        const snap=await db.collection('trips').doc(sale.trip_id).get();
        trip=snap.exists?{id:snap.id,...snap.data()}:null;
        tripCache.set(sale.trip_id,trip);
      }
    }
    const tripName=trip?.name||sale.trip_name||'seu passeio';
    await doc.ref.set({welcome_email_status:'sending',welcome_email_last_attempt_at:FieldValue.serverTimestamp()},{merge:true});
    const resp=await fetch('https://api.resend.com/emails',{
      method:'POST',
      headers:{Authorization:`Bearer ${resendKey}`,'Content-Type':'application/json'},
      body:JSON.stringify({
        from:emailFrom,
        to:[email],
        reply_to:'trilheiros.roomt@gmail.com',
        subject:`🥾 Sua viagem está confirmada: ${tripName}`,
        html:emailHtml(sale,trip),
        text:emailText(sale,trip)
      })
    });
    if(!resp.ok)throw new Error(`Resend ${resp.status}: ${await resp.text()}`);
    const payload=await resp.json().catch(()=>({}));
    await doc.ref.set({
      welcome_email_status:'sent',
      welcome_email_sent_at:FieldValue.serverTimestamp(),
      welcome_email_resend_id:payload.id||'',
      welcome_email_to:email,
      welcome_email_version:1,
      welcome_email_error:FieldValue.delete()
    },{merge:true});
    sent++;
    console.log(`Boas-vindas enviado: ${sale.customer_name||email} • ${tripName}`);
  }catch(err){
    failed++;
    const message=String(err?.message||err).slice(0,900);
    await doc.ref.set({welcome_email_status:'error',welcome_email_error:message,welcome_email_last_attempt_at:FieldValue.serverTimestamp()},{merge:true}).catch(()=>{});
    console.error(`Falha no e-mail ${sale.id}:`,message);
  }
}

console.log(`Processamento concluído: ${sent} enviado(s), ${failed} falha(s).`);
if(failed&&sent===0)process.exitCode=1;
