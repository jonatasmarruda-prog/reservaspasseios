import admin from 'firebase-admin';

const rawService=process.env.FIREBASE_SERVICE_ACCOUNT||'';
const resendKey=process.env.RESEND_API_KEY||'';
const emailFrom=process.env.EMAIL_FROM||'';
const LOGO='https://i.postimg.cc/JnF2F9Hw/LOGO-TRILHEIROS-Photoroom.png';
const WHATSAPP='5566996926174';
const TZ='America/Cuiaba';
const DIRECT_LOOKBACK_MS=24*60*60*1000;

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
function timestampMs(v){
  try{
    if(!v)return 0;
    if(typeof v?.toMillis==='function')return v.toMillis();
    if(typeof v?.toDate==='function')return v.toDate().getTime();
    if(v?.seconds)return Number(v.seconds)*1000;
    const d=new Date(v);return Number.isNaN(d.getTime())?0:d.getTime();
  }catch{return 0}
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
function saleFullyPaid(sale){
  if(!sale||sale.sale_status==='cancelled')return false;
  const status=String(sale.payment_status||sale.status||'').trim().toLowerCase();
  const total=num(sale.sale_total||sale.total_amount||sale.amount);
  const received=num(sale.paid_amount||sale.amount_paid||sale.received_amount);
  const rawBalance=Number(sale.balance_due);
  const balance=Number.isFinite(rawBalance)?Math.max(0,rawBalance):Math.max(0,total-received);
  const explicit=['paid','confirmed','approved','completed'].includes(status)||sale.payment_confirmed===true;
  const settledByValue=total>0&&received>=total-0.009;
  return balance<=0.009&&(explicit||settledByValue||!!sale.payment_completed_at);
}
function whatsappUrl(sale,trip){
  const text=`Olá Jonatas! Meu pagamento do passeio ${trip?.name||sale?.trip_name||'dos Trilheiros'} foi confirmado. Protocolo: ${sale?.protocol||'não informado'}.`;
  return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(text)}`;
}
function directWhatsappUrl(reservation,trip){
  const text=`Olá Jonatas! Concluí meu cadastro para o passeio ${trip?.name||'dos Trilheiros'}. Meu nome é ${reservation?.name||'participante'}.`;
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
        <div style="text-align:center;margin:26px 0"><a href="${wa}" style="display:inline-block;background:#0b684b;color:#ffffff;text-decoration:none;font-weight:800;padding:14px 22px;border-radius:13px">Falar com o Jonatas no WhatsApp</a></div>
        <div style="border-top:1px solid #e5ece8;margin-top:28px;padding-top:20px;text-align:center;color:#71837c;font-size:12px;line-height:1.6"><b style="color:#073226">Trilheiros de Rondonópolis</b><br>Aqui ninguém vai só. 🥾💚<br>WhatsApp: (66) 99692-6174</div>
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
function directSeatText(reservation){
  const seats=Array.isArray(reservation?.seat_numbers)?reservation.seat_numbers.map(v=>String(v||'').trim()).filter(Boolean):[];
  return seats.length?seats.join(' • '):'Conforme a reserva';
}
function directEmailHtml(reservation,trip){
  const name=reservation?.name||'Trilheiro';
  const tripName=trip?.name||'seu próximo passeio';
  const destination=trip?.destination||'';
  const wa=directWhatsappUrl(reservation,trip);
  return `<!doctype html><html><body style="margin:0;background:#eef4f1;font-family:Arial,Helvetica,sans-serif;color:#17372d">
  <div style="padding:28px 14px">
    <div style="max-width:640px;margin:auto;background:#ffffff;border:1px solid #d9e5df;border-radius:24px;overflow:hidden;box-shadow:0 16px 40px rgba(7,50,38,.08)">
      <div style="background:#073226;padding:28px 26px;text-align:center">
        <img src="${LOGO}" alt="Trilheiros de Rondonópolis" width="150" style="display:block;max-width:150px;height:auto;margin:0 auto 14px">
        <div style="font-size:12px;font-weight:800;letter-spacing:.13em;color:#d9b44c">CADASTRO CONFIRMADO</div>
        <h1 style="margin:10px 0 4px;color:#ffffff;font-size:29px;line-height:1.15">Tudo certo, ${esc(firstName(name))}! 🥾</h1>
        <p style="margin:0;color:#cfe2da;font-size:15px;line-height:1.5">Recebemos seus dados e seu cadastro no passeio foi concluído com sucesso.</p>
      </div>
      <div style="padding:28px 26px">
        <h2 style="margin:0 0 6px;font-size:23px;color:#073226">${esc(tripName)}</h2>
        ${destination?`<p style="margin:0 0 20px;color:#657b72">📍 ${esc(destination)}</p>`:'<div style="height:10px"></div>'}
        <div style="background:#f2f8f5;border:1px solid #dceae3;border-radius:18px;padding:18px">
          <div style="margin-bottom:12px"><span style="display:block;font-size:10px;font-weight:800;color:#71857d;letter-spacing:.08em">DATA DO PASSEIO</span><b style="display:block;margin-top:4px;font-size:17px;color:#073226">📅 ${esc(dateRange(trip,reservation))}</b></div>
          <div style="margin-bottom:12px"><span style="display:block;font-size:10px;font-weight:800;color:#71857d;letter-spacing:.08em">PARTICIPANTE</span><b style="display:block;margin-top:4px;font-size:15px;color:#17372d">${esc(name)}</b></div>
          <div><span style="display:block;font-size:10px;font-weight:800;color:#71857d;letter-spacing:.08em">ASSENTO / VAGA</span><b style="display:block;margin-top:4px;font-size:15px;color:#17372d">${esc(directSeatText(reservation))}</b></div>
        </div>
        <p style="font-size:15px;line-height:1.65;margin:24px 0;color:#50685e">Este e-mail confirma o preenchimento do seu cadastro. Ele não altera a situação financeira da reserva. Para dúvidas sobre pagamento, saída ou o passeio, fale com o Jonatas.</p>
        <div style="text-align:center;margin:26px 0"><a href="${wa}" style="display:inline-block;background:#0b684b;color:#ffffff;text-decoration:none;font-weight:800;padding:14px 22px;border-radius:13px">Falar com o Jonatas no WhatsApp</a></div>
        <div style="border-top:1px solid #e5ece8;margin-top:28px;padding-top:20px;text-align:center;color:#71837c;font-size:12px;line-height:1.6"><b style="color:#073226">Trilheiros de Rondonópolis</b><br>Aqui ninguém vai só. 🥾💚<br>WhatsApp: (66) 99692-6174</div>
      </div>
    </div>
  </div></body></html>`;
}
function directEmailText(reservation,trip){
  const name=reservation?.name||'Trilheiro';
  const tripName=trip?.name||'seu próximo passeio';
  return `Olá, ${firstName(name)}!\n\nRecebemos seus dados e seu cadastro foi concluído com sucesso para ${tripName}.\nData: ${dateRange(trip,reservation)}\nParticipante: ${name}\nAssento/vaga: ${directSeatText(reservation)}\n\nEste e-mail confirma o cadastro e não altera a situação financeira da reserva.\n\nDúvidas: Jonatas — WhatsApp (66) 99692-6174.\n\nTrilheiros de Rondonópolis — Aqui ninguém vai só.`;
}
async function sendResend({to,subject,html,text}){
  const resp=await fetch('https://api.resend.com/emails',{
    method:'POST',
    headers:{Authorization:`Bearer ${resendKey}`,'Content-Type':'application/json'},
    body:JSON.stringify({from:emailFrom,to:[to],reply_to:'trilheiros.roomt@gmail.com',subject,html,text})
  });
  if(!resp.ok)throw new Error(`Resend ${resp.status}: ${await resp.text()}`);
  return await resp.json().catch(()=>({}));
}

let salesSnap;
try{salesSnap=await db.collection('sales').orderBy('created_at','desc').limit(500).get()}
catch{salesSnap=await db.collection('sales').limit(500).get()}
const eligible=[];
for(const doc of salesSnap.docs){
  const sale={id:doc.id,...doc.data()};
  const email=String(sale.customer_email||sale.email||'').trim().toLowerCase();
  if(sale.sale_status==='cancelled'||sale.welcome_email_sent_at||sale.welcome_email_status==='sent')continue;
  if(!saleFullyPaid(sale))continue;
  if(!validEmail(email)){
    await doc.ref.set({welcome_email_status:'skipped_no_email',welcome_email_checked_at:FieldValue.serverTimestamp()},{merge:true});
    continue;
  }
  eligible.push({doc,sale,email});
}

const tripCache=new Map();
let sent=0,failed=0;
for(const item of eligible.slice(0,50)){
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
    const payload=await sendResend({to:email,subject:`🥾 Sua viagem está confirmada: ${tripName}`,html:emailHtml(sale,trip),text:emailText(sale,trip)});
    await doc.ref.set({welcome_email_status:'sent',welcome_email_sent_at:FieldValue.serverTimestamp(),welcome_email_resend_id:payload.id||'',welcome_email_to:email,welcome_email_version:3,welcome_email_error:FieldValue.delete()},{merge:true});
    sent++;
    console.log(`Boas-vindas enviado: ${sale.customer_name||email} • ${tripName}`);
  }catch(err){
    failed++;
    const message=String(err?.message||err).slice(0,900);
    await doc.ref.set({welcome_email_status:'error',welcome_email_error:message,welcome_email_last_attempt_at:FieldValue.serverTimestamp()},{merge:true}).catch(()=>{});
    console.error(`Falha no e-mail ${sale.id}:`,message);
  }
}

let directSent=0,directFailed=0,directFound=0;
try{
  const tripsSnap=await db.collection('trips').limit(120).get();
  const now=Date.now();
  for(const tripDoc of tripsSnap.docs){
    const trip={id:tripDoc.id,...tripDoc.data()};
    let directSnap;
    try{
      directSnap=await tripDoc.ref.collection('reservations').where('registration_source','==','direct_trip_link').limit(120).get();
    }catch(err){
      console.warn(`Não foi possível consultar cadastros internos de ${trip.name||trip.id}:`,String(err?.message||err));
      continue;
    }
    for(const resDoc of directSnap.docs){
      const reservation={id:resDoc.id,...resDoc.data()};
      if(reservation.registration_status!=='completed')continue;
      if(reservation.registration_email_sent_at||reservation.registration_email_status==='sent')continue;
      const completedAt=timestampMs(reservation.registration_completed_at);
      if(!completedAt||now-completedAt>DIRECT_LOOKBACK_MS||completedAt>now+5*60*1000)continue;
      const email=String(reservation.email||'').trim().toLowerCase();
      if(!validEmail(email)){
        await resDoc.ref.set({registration_email_status:'skipped_no_email',registration_email_checked_at:FieldValue.serverTimestamp()},{merge:true});
        continue;
      }
      directFound++;
      const dispatchId=`${trip.id}__${reservation.id}`.replace(/[^A-Za-z0-9_.-]/g,'_').slice(0,1400);
      const dispatchRef=db.collection('email_dispatch_registration').doc(dispatchId);
      let claimed=false;
      await db.runTransaction(async tx=>{
        const current=await tx.get(resDoc.ref);if(!current.exists)return;
        const rd=current.data()||{};
        if(rd.registration_email_sent_at||rd.registration_email_status==='sent')return;
        const dispatch=await tx.get(dispatchRef);
        const dd=dispatch.exists?dispatch.data()||{}:{};
        if(dd.status==='sent'){
          tx.set(resDoc.ref,{registration_email_status:'sent',registration_email_sent_at:dd.sent_at||FieldValue.serverTimestamp()},{merge:true});
          return;
        }
        const last=timestampMs(dd.last_attempt_at);
        if(dd.status==='sending'&&last&&Date.now()-last<15*60*1000)return;
        tx.set(dispatchRef,{status:'sending',trip_id:trip.id,reservation_id:reservation.id,email,last_attempt_at:FieldValue.serverTimestamp(),attempts:FieldValue.increment(1)},{merge:true});
        tx.set(resDoc.ref,{registration_email_status:'sending',registration_email_last_attempt_at:FieldValue.serverTimestamp()},{merge:true});
        claimed=true;
      });
      if(!claimed)continue;
      try{
        const tripName=trip.name||'seu passeio';
        const payload=await sendResend({to:email,subject:`🥾 Cadastro confirmado: ${tripName}`,html:directEmailHtml(reservation,trip),text:directEmailText(reservation,trip)});
        const stamp=FieldValue.serverTimestamp();
        await Promise.all([
          resDoc.ref.set({registration_email_status:'sent',registration_email_sent_at:stamp,registration_email_resend_id:payload.id||'',registration_email_to:email,registration_email_version:1,registration_email_error:FieldValue.delete()},{merge:true}),
          dispatchRef.set({status:'sent',sent_at:stamp,resend_id:payload.id||'',email,error:FieldValue.delete()},{merge:true})
        ]);
        directSent++;
        console.log(`Cadastro interno confirmado por e-mail: ${reservation.name||email} • ${tripName}`);
      }catch(err){
        directFailed++;
        const message=String(err?.message||err).slice(0,900);
        const stamp=FieldValue.serverTimestamp();
        await Promise.all([
          resDoc.ref.set({registration_email_status:'error',registration_email_error:message,registration_email_last_attempt_at:stamp},{merge:true}).catch(()=>{}),
          dispatchRef.set({status:'error',error:message,last_attempt_at:stamp},{merge:true}).catch(()=>{})
        ]);
        console.error(`Falha no e-mail de cadastro interno ${trip.id}/${reservation.id}:`,message);
      }
    }
  }
}catch(err){
  directFailed++;
  console.error('Falha ao processar cadastros internos:',String(err?.message||err));
}

if(!eligible.length&&!directFound)console.log('Nenhum e-mail automático aguardando envio.');
console.log(`Processamento concluído: vendas ${sent} enviada(s), ${failed} falha(s); cadastros internos ${directSent} enviado(s), ${directFailed} falha(s).`);
if((failed&&sent===0)||(directFailed&&directSent===0))process.exitCode=1;