import admin from 'firebase-admin';

const rawService=process.env.FIREBASE_SERVICE_ACCOUNT||'';
const resendKey=process.env.RESEND_API_KEY||'';
const emailFrom=process.env.EMAIL_FROM||'';
const GOOGLE_REVIEW_URL='https://g.page/r/CcB9GU8M5QY6EAE/review';

if(!rawService||!resendKey||!emailFrom){
  console.error('TESTE NÃO EXECUTADO: faltam FIREBASE_SERVICE_ACCOUNT, RESEND_API_KEY ou EMAIL_FROM.');
  process.exit(1);
}

let service;
try{service=JSON.parse(rawService)}catch{console.error('FIREBASE_SERVICE_ACCOUNT inválido.');process.exit(1)}
admin.initializeApp({credential:admin.credential.cert(service)});
const db=admin.firestore();

function brDate(iso){if(!iso)return'';const [y,m,d]=String(iso).slice(0,10).split('-');return `${d}/${m}/${y}`}
function escHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
function renderTemplate(text,vars){let out=String(text||'');for(const [k,v] of Object.entries(vars))out=out.replaceAll(`{{${k}}}`,String(v??''));return out}
function htmlLayout(text,title){
  let body=escHtml(text).replaceAll('\n','<br>');
  body=body.replace(/https:\/\/g\.page\/r\/CcB9GU8M5QY6EAE\/review/g,`<a href="${GOOGLE_REVIEW_URL}" target="_blank" style="display:inline-block;margin:16px 0 6px;padding:14px 20px;border-radius:12px;background:#0d513d;color:#fff;text-decoration:none;font-weight:800">⭐ Avaliar os Trilheiros no Google</a>`);
  return `<div style="margin:0;padding:24px;background:#f2f7f4;font-family:Arial,Helvetica,sans-serif;color:#173a2f"><div style="max-width:680px;margin:auto;background:#fff;border-radius:22px;overflow:hidden;border:1px solid #dce8e2"><div style="padding:24px;background:#0d513d;color:#fff"><div style="font-size:12px;font-weight:800">TRILHEIROS DE RONDONÓPOLIS</div><div style="font-size:24px;font-weight:800;margin-top:8px">${escHtml(title)}</div><div style="margin-top:8px;font-size:12px;opacity:.85">MODO DE TESTE — nenhum lembrete real será marcado como enviado.</div></div><div style="padding:28px;font-size:15px;line-height:1.7">${body}</div><div style="padding:16px 28px;background:#f7faf8;color:#71867e;font-size:11px">Aqui ninguém vai só. 💚 • Trilheiros de Rondonópolis</div></div></div>`;
}

const defaults={
  reminder_3d_subject:'🌿 {{passeio}} é esta semana! Tudo certo por aí?',
  reminder_3d_body:'Oi, {{nome}}! 😄\n\nOs Trilheiros passando para dar aquele toque: faltam só 3 dias para {{passeio}}! 🥾🌿\n\n✅ Data: {{data}}\n✅ Destino: {{destino}}\n✅ Horário de saída: {{saida}}\n✅ Participantes: {{participantes}}\n🎒 O que levar: {{levar}}\n📝 Recado do passeio: {{lembrete_extra}}\n\nAqui ninguém vai só. 💚\nTrilheiros de Rondonópolis',
  reminder_1d_subject:'⛰️ É AMANHÃ! {{passeio}} te espera 🥾',
  reminder_1d_body:'Oi, {{nome}}! 😄\n\nÉ AMANHÃ! 🥾⛰️\nChegou a hora de separar a roupa, carregar o celular e preparar a animação porque {{passeio}} está logo ali!\n\n📅 Data: {{data}}\n📍 Destino: {{destino}}\n🕒 Saída: {{saida}}\n👥 Participantes: {{participantes}}\n🎒 O que levar: {{levar}}\n📝 Último recado: {{lembrete_extra}}\n🔖 Protocolo: {{protocolo}}\n\nDinheiro volta, tempo não. Viva essa experiência! 💚\nTrilheiros de Rondonópolis',
  post_trip_subject:'⭐ Como foi {{passeio}}? Conta pra gente no Google!',
  post_trip_body:'Oi, {{nome}}! 😄\n\nEsperamos que {{passeio}} tenha rendido boas histórias e fotos incríveis. 🌿🥾\n\nSe você curtiu a experiência, deixa uma avaliação para os Trilheiros no Google. É rapidinho e ajuda outras pessoas a conhecerem nosso trabalho. 💚\n\n{{avaliacao_link}}\n\nObrigado por caminhar com a gente!\nTrilheiros de Rondonópolis'
};

const settingsSnap=await db.collection('settings').doc('communications').get();
const settings=settingsSnap.exists?{...defaults,...settingsSnap.data()}:{...defaults};

let latest=null;
const tripsSnap=await db.collection('trips').get();
for(const tripDoc of tripsSnap.docs){
  const rs=await tripDoc.ref.collection('reservations').get();
  for(const rDoc of rs.docs){
    const r=rDoc.data();
    if(!r.email||r.status==='cancelled')continue;
    const ms=r.created_at?.toMillis?.()||r.updated_at?.toMillis?.()||0;
    if(!latest||ms>latest.ms)latest={ms,tripId:tripDoc.id,trip:tripDoc.data(),reservationId:rDoc.id,reservation:r};
  }
}

if(!latest){console.error('Nenhuma reserva com e-mail encontrada para testar.');process.exit(1)}
const {trip,reservation:r}=latest;
const participantes=(r.participants||[]).map(p=>p.full_name).filter(Boolean).join(', ');
const vars={
  nome:r.responsible_name||'',passeio:trip.name||'',data:brDate(trip.trip_date),destino:trip.destination||'',
  saida:trip.departure_time||'',participantes,levar:trip.what_to_bring||'',lembrete_extra:trip.reminder_notes||'',
  protocolo:r.protocol||'',politica:r.policy_text||trip.cancellation_policy||'',avaliacao_link:GOOGLE_REVIEW_URL
};

const tests=[
  ['3 dias antes',settings.reminder_3d_subject||defaults.reminder_3d_subject,settings.reminder_3d_body||defaults.reminder_3d_body],
  ['1 dia antes',settings.reminder_1d_subject||defaults.reminder_1d_subject,settings.reminder_1d_body||defaults.reminder_1d_body],
  ['pós-passeio Google',settings.post_trip_subject||defaults.post_trip_subject,settings.post_trip_body||defaults.post_trip_body]
];

console.log(`Reserva de teste: ${r.responsible_name||'sem nome'} • ${trip.name||'sem passeio'} • ${r.email}`);
let sent=0;
for(const [label,subjectTpl,bodyTpl] of tests){
  const subject=`[TESTE] ${renderTemplate(subjectTpl,vars)}`;
  const text=renderTemplate(bodyTpl,vars);
  const resp=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${resendKey}`,'Content-Type':'application/json'},body:JSON.stringify({from:emailFrom,to:[r.email],subject,html:htmlLayout(text,subject)})});
  if(!resp.ok){console.error(`Falha em ${label}: ${resp.status} ${await resp.text()}`);process.exit(1)}
  sent++;
  console.log(`OK: ${label} enviado para ${r.email}`);
}
console.log(`TESTE CONCLUÍDO: ${sent} e-mails enviados. Nenhum campo de lembrete foi alterado no Firestore.`);
