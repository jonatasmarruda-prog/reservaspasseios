import admin from 'firebase-admin';

const rawService=process.env.FIREBASE_SERVICE_ACCOUNT||'';
const resendKey=process.env.RESEND_API_KEY||'';
const emailFrom=process.env.EMAIL_FROM||'';

if(!rawService||!resendKey||!emailFrom){
  console.log('Automação de e-mail não configurada: faltam FIREBASE_SERVICE_ACCOUNT, RESEND_API_KEY ou EMAIL_FROM. Encerrando sem erro.');
  process.exit(0);
}

let service;
try{service=JSON.parse(rawService)}catch{console.log('FIREBASE_SERVICE_ACCOUNT não é um JSON válido.');process.exit(1)}

admin.initializeApp({credential:admin.credential.cert(service)});
const db=admin.firestore();
const FieldValue=admin.firestore.FieldValue;
const TZ='America/Cuiaba';

function isoInTZ(date){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
  const get=t=>parts.find(p=>p.type===t)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
function brDate(iso){if(!iso)return'';const [y,m,d]=String(iso).slice(0,10).split('-');return `${d}/${m}/${y}`}
function escHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
function renderTemplate(text,vars){let out=String(text||'');for(const [k,v] of Object.entries(vars))out=out.replaceAll(`{{${k}}}`,String(v??''));return out}
function textToHtml(text){return `<div style="font-family:Arial,Helvetica,sans-serif;line-height:1.65;color:#173a2f;max-width:680px;margin:auto"><div style="padding:18px 22px;background:#082f24;color:#fff;border-radius:18px 18px 0 0"><strong>TRILHEIROS DE RONDONÓPOLIS</strong></div><div style="padding:24px;border:1px solid #dce8e2;border-top:0;border-radius:0 0 18px 18px;background:#fff">${escHtml(text).replaceAll('\n','<br>')}</div></div>`}

const defaults={
  enabled:true,
  reminder_subject:'Amanhã é dia de {{passeio}} 🌿',
  reminder_body:'Olá, {{nome}}!\n\nPassando para lembrar que amanhã é o passeio {{passeio}}.\n\n📅 Data: {{data}}\n📍 Destino: {{destino}}\n🕒 Saída: {{saida}}\n🚌 Embarque: {{embarque}}\n👥 Participantes: {{participantes}}\n🎒 O que levar: {{levar}}\n📝 Orientação extra: {{lembrete_extra}}\n🔖 Protocolo: {{protocolo}}\n\nPolítica de cancelamento:\n{{politica}}\n\nAqui ninguém vai só.\nTrilheiros de Rondonópolis'
};

const settingsSnap=await db.collection('settings').doc('communications').get();
const settings=settingsSnap.exists?{...defaults,...settingsSnap.data()}:{...defaults};
if(settings.enabled===false){console.log('Lembretes automáticos desativados no painel.');process.exit(0)}

const tomorrow=isoInTZ(new Date(Date.now()+24*60*60*1000));
console.log(`Procurando passeios para ${tomorrow} (${TZ})`);
const tripsSnap=await db.collection('trips').where('trip_date','==',tomorrow).get();
if(tripsSnap.empty){console.log('Nenhum passeio amanhã.');process.exit(0)}

let sent=0,skipped=0,failed=0;
for(const tripDoc of tripsSnap.docs){
  const trip=tripDoc.data();
  if(trip.status==='cancelled'||trip.email_reminder_enabled===false){console.log(`Pulando ${trip.name}: cancelado ou lembrete desativado.`);continue}
  const reservations=await tripDoc.ref.collection('reservations').get();
  for(const rDoc of reservations.docs){
    const r=rDoc.data();
    if(!r.email||['cancelled'].includes(r.status)||r.reminder_1d_sent_at){skipped++;continue}
    const participants=(r.participants||[]).map(p=>p.full_name).filter(Boolean).join(', ');
    const vars={
      nome:r.responsible_name||'',
      passeio:trip.name||'',
      data:brDate(trip.trip_date),
      destino:trip.destination||'',
      saida:trip.departure_time||'',
      embarque:trip.departure_point||'',
      participantes,
      levar:trip.what_to_bring||'',
      lembrete_extra:trip.reminder_notes||'',
      protocolo:r.protocol||'',
      politica:r.policy_text||trip.cancellation_policy||''
    };
    const subject=renderTemplate(settings.reminder_subject,vars);
    const text=renderTemplate(settings.reminder_body,vars);
    try{
      const resp=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${resendKey}`,'Content-Type':'application/json'},body:JSON.stringify({from:emailFrom,to:[r.email],subject,html:textToHtml(text)})});
      if(!resp.ok)throw new Error(`${resp.status} ${await resp.text()}`);
      await rDoc.ref.update({reminder_1d_sent_at:FieldValue.serverTimestamp(),reminder_1d_email_to:r.email});
      sent++;console.log(`Enviado: ${r.email} • ${trip.name}`);
    }catch(err){failed++;console.error(`Falha: ${r.email} • ${trip.name}:`,err.message)}
  }
}
console.log(`Concluído. Enviados=${sent} | Ignorados=${skipped} | Falhas=${failed}`);
if(failed)process.exitCode=1;
