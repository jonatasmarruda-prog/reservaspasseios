import admin from 'firebase-admin';
const raw=process.env.FIREBASE_SERVICE_ACCOUNT||'',resendKey=process.env.RESEND_API_KEY||'',emailFrom=process.env.EMAIL_FROM||'',to=process.env.INSTALLMENT_REPORT_TO||'trilheiros.roomt@gmail.com';
if(!raw||!resendKey||!emailFrom){console.log('Automação de parcelas não configurada.');process.exit(0)}
let service;try{service=JSON.parse(raw)}catch{console.error('FIREBASE_SERVICE_ACCOUNT inválido.');process.exit(1)}
admin.initializeApp({credential:admin.credential.cert(service)});const db=admin.firestore();
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Cuiaba',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v||0));
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const snap=await db.collection('sales').get();
const due=snap.docs.map(d=>({id:d.id,...d.data()})).filter(s=>s.sale_status!=='cancelled'&&String(s.payment_method||'').includes('pix_installment')&&Number(s.balance_due||0)>0&&String(s.next_due_date||'').slice(0,10)&&String(s.next_due_date).slice(0,10)<=today);
if(!due.length){console.log('Nenhuma parcela PIX vencida ou vencendo hoje.');process.exit(0)}
const rows=due.map(s=>`<tr><td style="padding:10px;border-bottom:1px solid #e7ece9"><b>${esc(s.customer_name||'Cliente')}</b><br><small>${esc(s.trip_name||'Passeio')}</small></td><td style="padding:10px;border-bottom:1px solid #e7ece9">${esc(String(s.next_due_date).slice(0,10))}</td><td style="padding:10px;text-align:right;border-bottom:1px solid #e7ece9"><b>${money(s.balance_due)}</b></td></tr>`).join('');
const html=`<div style="font-family:Arial,sans-serif;background:#f1f6f3;padding:24px"><div style="max-width:760px;margin:auto;background:#fff;border-radius:18px;overflow:hidden"><div style="background:#073226;color:#fff;padding:22px"><b>TRILHEIROS DE RONDONÓPOLIS</b><h2 style="margin:8px 0 0">PIX parcelado a cobrar</h2></div><div style="padding:22px"><p>${due.length} cobrança(s) com vencimento hoje ou em atraso.</p><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left;padding:10px">Cliente / passeio</th><th style="text-align:left">Vencimento</th><th style="text-align:right">Saldo</th></tr></thead><tbody>${rows}</tbody></table></div></div></div>`;
const resp=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${resendKey}`,'Content-Type':'application/json'},body:JSON.stringify({from:emailFrom,to:[to],subject:`PIX parcelado a cobrar — ${today}`,html})});
if(!resp.ok)throw new Error(`${resp.status} ${await resp.text()}`);
console.log(`Lembrete enviado com ${due.length} cobrança(s).`);
