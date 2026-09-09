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
const APP_URL='https://trilheiros-reservas.web.app';

function isoInTZ(date){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
  const get=t=>parts.find(p=>p.type===t)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
function brDate(iso){if(!iso)return'';const [y,m,d]=String(iso).slice(0,10).split('-');return `${d}/${m}/${y}`}
function escHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
function renderTemplate(text,vars){let out=String(text||'');for(const [k,v] of Object.entries(vars))out=out.replaceAll(`{{${k}}}`,String(v??''));return out}
function htmlLayout(text,title='Trilheiros de Rondonópolis'){
  const body=escHtml(text).replaceAll('\n','<br>');
  return `<div style="margin:0;padding:24px;background:#f2f7f4;font-family:Arial,Helvetica,sans-serif;color:#173a2f"><div style="max-width:680px;margin:auto;background:#fff;border-radius:22px;overflow:hidden;border:1px solid #dce8e2;box-shadow:0 14px 40px rgba(8,47,36,.08)"><div style="padding:24px;background:linear-gradient(135deg,#06291f,#0f523e);color:#fff"><div style="font-size:12px;font-weight:800;letter-spacing:.08em">TRILHEIROS DE RONDONÓPOLIS</div><div style="font-size:24px;font-weight:800;margin-top:8px">${escHtml(title)}</div></div><div style="padding:28px;font-size:15px;line-height:1.7">${body}</div><div style="padding:16px 28px;background:#f7faf8;color:#71867e;font-size:11px">Aqui ninguém vai só. 💚 • Trilheiros de Rondonópolis</div></div></div>`;
}

const defaults={
  enabled:true,
  reminder_3d_subject:'🌿 {{passeio}} é esta semana! Tudo certo por aí?',
  reminder_3d_body:'Oi, {{nome}}! 😄\n\nOs Trilheiros passando para dar aquele toque: faltam só 3 dias para {{passeio}}! 🥾🌿\n\nJá está entrando no clima? Dá uma conferida rapidinha:\n✅ Data: {{data}}\n✅ Destino: {{destino}}\n✅ Horário de saída: {{saida}}\n✅ Participantes: {{participantes}}\n🎒 O que levar: {{levar}}\n📝 Recado do passeio: {{lembrete_extra}}\n\nSe estiver tudo certo, agora é só começar a contagem regressiva. 😄\n\nAqui ninguém vai só. 💚\nTrilheiros de Rondonópolis',
  reminder_1d_subject:'⛰️ É AMANHÃ! {{passeio}} te espera 🥾',
  reminder_1d_body:'Oi, {{nome}}! 😄\n\nÉ AMANHÃ! 🥾⛰️\nChegou a hora de separar a roupa, carregar o celular e preparar a animação porque {{passeio}} está logo ali!\n\n📅 Data: {{data}}\n📍 Destino: {{destino}}\n🕒 Saída: {{saida}}\n👥 Participantes: {{participantes}}\n🎒 O que levar: {{levar}}\n📝 Último recado: {{lembrete_extra}}\n🔖 Protocolo: {{protocolo}}\n\nConfira tudo hoje para amanhã ser só colocar o tênis e ir. 😄\n\nDinheiro volta, tempo não. Viva essa experiência! 💚\nTrilheiros de Rondonópolis',
  post_trip_enabled:false,
  post_trip_subject:'💚 E aí, como foi {{passeio}}?',
  post_trip_body:'Oi, {{nome}}! 😄\n\nEsperamos que {{passeio}} tenha rendido boas histórias e fotos incríveis.\n\nConta pra gente como foi sua experiência. Sua opinião ajuda muito a melhorar os próximos passeios:\n{{avaliacao_link}}\n\nObrigado por caminhar com a gente! 🌿\nTrilheiros de Rondonópolis'
};

const settingsSnap=await db.collection('settings').doc('communications').get();
const settings=settingsSnap.exists?{...defaults,...settingsSnap.data()}:{...defaults};
if(settings.enabled===false){console.log('Lembretes automáticos desativados no painel.');process.exit(0)}

const targets=[
  {days:3,field:'reminder_3d_sent_at',subject:settings.reminder_3d_subject,body:settings.reminder_3d_body,label:'3 dias antes'},
  {days:1,field:'reminder_1d_sent_at',subject:settings.reminder_1d_subject,body:settings.reminder_1d_body,label:'1 dia antes'}
];
if(settings.post_trip_enabled)targets.push({days:-1,field:'post_trip_sent_at',subject:settings.post_trip_subject,body:settings.post_trip_body,label:'pós-passeio'});

let sent=0,skipped=0,failed=0;
for(const target of targets){
  const targetDate=isoInTZ(new Date(Date.now()+target.days*24*60*60*1000));
  console.log(`Procurando passeios para ${targetDate} (${target.label})`);
  const tripsSnap=await db.collection('trips').where('trip_date','==',targetDate).get();
  for(const tripDoc of tripsSnap.docs){
    const trip=tripDoc.data();
    if(trip.status==='cancelled'||trip.email_reminder_enabled===false){console.log(`Pulando ${trip.name}: cancelado ou lembretes desativados.`);continue}
    const reservations=await tripDoc.ref.collection('reservations').get();
    for(const rDoc of reservations.docs){
      const r=rDoc.data();
      if(!r.email||r.status==='cancelled'||r[target.field]){skipped++;continue}
      const participants=(r.participants||[]).map(p=>p.full_name).filter(Boolean).join(', ');
      const vars={
        nome:r.responsible_name||'',passeio:trip.name||'',data:brDate(trip.trip_date),destino:trip.destination||'',
        saida:trip.departure_time||'',participantes,levar:trip.what_to_bring||'',lembrete_extra:trip.reminder_notes||'',
        protocolo:r.protocol||'',politica:r.policy_text||trip.cancellation_policy||'',avaliacao_link:`${APP_URL}/avaliacao/${tripDoc.id}`
      };
      const subject=renderTemplate(target.subject,vars);
      const text=renderTemplate(target.body,vars);
      try{
        const resp=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${resendKey}`,'Content-Type':'application/json'},body:JSON.stringify({from:emailFrom,to:[r.email],subject,html:htmlLayout(text,subject)})});
        if(!resp.ok)throw new Error(`${resp.status} ${await resp.text()}`);
        await rDoc.ref.update({[target.field]:FieldValue.serverTimestamp(),[`${target.field}_email_to`]:r.email});
        sent++;console.log(`Enviado (${target.label}): ${r.email} • ${trip.name}`);
      }catch(err){failed++;console.error(`Falha (${target.label}): ${r.email} • ${trip.name}:`,err.message)}
    }
  }
}
console.log(`Concluído. Enviados=${sent} | Ignorados=${skipped} | Falhas=${failed}`);
if(failed)process.exitCode=1;
