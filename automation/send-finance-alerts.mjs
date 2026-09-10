import admin from 'firebase-admin';

const rawService=process.env.FIREBASE_SERVICE_ACCOUNT||'';
const resendKey=process.env.RESEND_API_KEY||'';
const emailFrom=process.env.EMAIL_FROM||'';
const alertTo=process.env.FINANCE_ALERT_TO||'trilheiros.roomt@gmail.com';
const TZ='America/Cuiaba';
const HOLD_MINUTES=60;

if(!rawService||!resendKey||!emailFrom){
  console.log('Alertas financeiros não configurados: faltam FIREBASE_SERVICE_ACCOUNT, RESEND_API_KEY ou EMAIL_FROM.');
  process.exit(0);
}
let service;
try{service=JSON.parse(rawService)}catch{console.error('FIREBASE_SERVICE_ACCOUNT não é JSON válido.');process.exit(1)}
admin.initializeApp({credential:admin.credential.cert(service)});
const db=admin.firestore();
const FieldValue=admin.firestore.FieldValue;
const num=v=>Math.max(0,Number(v||0)||0);
const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v||0));
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
function iso(v){if(!v)return'';if(typeof v==='string'&&/^\d{4}-\d{2}-\d{2}/.test(v))return v.slice(0,10);try{const d=typeof v?.toDate==='function'?v.toDate():v?.seconds?new Date(v.seconds*1000):new Date(v);if(Number.isNaN(d.getTime()))return'';return new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(d)}catch{return''}}
function millis(v){try{if(typeof v?.toMillis==='function')return v.toMillis();if(v?.seconds)return v.seconds*1000;const d=new Date(v);return Number.isNaN(d.getTime())?0:d.getTime()}catch{return 0}}
function today(){return iso(new Date())}
function addDays(isoDate,days){const [y,m,d]=isoDate.split('-').map(Number);return iso(new Date(Date.UTC(y,m-1,d+days,12)))}
function active(s){return s?.sale_status!=='cancelled'}
function balance(s){const b=Number(s?.balance_due);return Number.isFinite(b)?Math.max(0,b):Math.max(0,num(s?.sale_total)-num(s?.paid_amount))}
function isInstallment(s){const x=String(s?.payment_method||'').toLowerCase();return x.includes('parcel')||x.includes('install')}
function isCanva(s){return String(s?.source||'').includes('public_portal')||s?.channel==='canva_reserva_passeios'}

const day=today(),soon=addDays(day,2),marker=db.collection('automation_reports').doc(`finance-alert-${day}`),already=await marker.get();
if(already.exists){console.log(`Alertas de ${day} já processados.`);process.exit(0)}
const snap=await db.collection('sales').get(),sales=snap.docs.map(d=>({id:d.id,...d.data()}));
const installments=sales.filter(s=>active(s)&&isInstallment(s)&&balance(s)>0&&s.next_due_date&&iso(s.next_due_date)<=soon).sort((a,b)=>String(a.next_due_date).localeCompare(String(b.next_due_date)));
const stale=sales.filter(s=>active(s)&&isCanva(s)&&num(s.paid_amount)<=0&&String(s.payment_status||'pending')==='pending'&&millis(s.created_at)>0&&Date.now()-millis(s.created_at)>HOLD_MINUTES*60000).sort((a,b)=>millis(a.created_at)-millis(b.created_at));
if(!installments.length&&!stale.length){await marker.set({date:day,empty:true,processed_at:FieldValue.serverTimestamp()});console.log('Sem alertas financeiros hoje.');process.exit(0)}

const instRows=installments.map(s=>`<tr><td>${esc(s.customer_name||'Cliente')}</td><td>${esc(s.trip_name||'Passeio')}</td><td>${esc(iso(s.next_due_date))}</td><td style="text-align:right"><b>${money(balance(s))}</b></td><td>${iso(s.next_due_date)<day?'<b style="color:#a52e25">ATRASADO</b>':'Próximo'}</td></tr>`).join('');
const staleRows=stale.map(s=>`<tr><td>${esc(s.customer_name||'Cliente')}</td><td>${esc(s.trip_name||'Passeio')}</td><td style="text-align:right">${money(num(s.sale_total))}</td><td>${Math.floor((Date.now()-millis(s.created_at))/60000)} min</td></tr>`).join('');
const html=`<div style="font-family:Arial,Helvetica,sans-serif;background:#f2f6f4;padding:24px;color:#173a2f"><div style="max-width:850px;margin:auto;background:#fff;border:1px solid #dce7e2;border-radius:18px;overflow:hidden"><div style="padding:22px;background:#073226;color:#fff"><b>TRILHEIROS DE RONDONÓPOLIS</b><h2 style="margin:7px 0 0">Alertas financeiros</h2><div>${esc(day)}</div></div><div style="padding:22px">${installments.length?`<h3>PIX parcelado a cobrar</h3><p>Parcelas com vencimento até ${esc(soon)}.</p><table style="border-collapse:collapse;width:100%;font-size:13px"><thead><tr><th style="text-align:left">Cliente</th><th style="text-align:left">Passeio</th><th>Vencimento</th><th>Saldo</th><th>Status</th></tr></thead><tbody>${instRows}</tbody></table>`:''}${stale.length?`<h3 style="margin-top:28px">Reservas iniciadas sem pagamento confirmado</h3><p>Confira no banco/Mercado Pago antes de liberar qualquer vaga.</p><table style="border-collapse:collapse;width:100%;font-size:13px"><thead><tr><th style="text-align:left">Cliente</th><th style="text-align:left">Passeio</th><th>Valor</th><th>Tempo</th></tr></thead><tbody>${staleRows}</tbody></table>`:''}<p style="margin-top:22px;color:#6b7d75;font-size:12px">Este e-mail é apenas um lembrete operacional. O sistema não considera clique em PIX/cartão como confirmação bancária.</p></div></div></div>`;
const resp=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${resendKey}`,'Content-Type':'application/json'},body:JSON.stringify({from:emailFrom,to:[alertTo],subject:`Alertas financeiros Trilheiros — ${day}`,html})});
if(!resp.ok)throw new Error(`Resend ${resp.status}: ${await resp.text()}`);
await marker.set({date:day,to:alertTo,installments:installments.length,stale_pending:stale.length,sent_at:FieldValue.serverTimestamp()});
console.log(`Alertas enviados: parcelado=${installments.length} pendencias_antigas=${stale.length}`);
