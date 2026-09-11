import admin from 'firebase-admin';
import { createHash } from 'node:crypto';

const rawService=process.env.FIREBASE_SERVICE_ACCOUNT||'';
const resendKey=process.env.RESEND_API_KEY||'';
const emailFrom=process.env.EMAIL_FROM||'';
const DESTINATION='trilheiros.roomt@gmail.com';
const LOGO='https://i.postimg.cc/JnF2F9Hw/LOGO-TRILHEIROS-Photoroom.png';
const TZ='America/Cuiaba';

if(!rawService||!resendKey||!emailFrom){console.error('Relatório final não configurado: faltam credenciais.');process.exit(1)}
let service;try{service=JSON.parse(rawService)}catch{console.error('FIREBASE_SERVICE_ACCOUNT inválido.');process.exit(1)}
if(!admin.apps.length)admin.initializeApp({credential:admin.credential.cert(service)});
const db=admin.firestore();
const FieldValue=admin.firestore.FieldValue;

const clean=v=>String(v??'').trim();
const num=v=>Math.max(0,Number(v||0)||0);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v||0));
function stampMs(v){try{if(!v)return 0;if(typeof v.toMillis==='function')return v.toMillis();if(v.seconds)return Number(v.seconds)*1000;const d=new Date(v);return Number.isNaN(d.getTime())?0:d.getTime()}catch{return 0}}
function brDate(v){const ms=stampMs(v);if(ms){return new Intl.DateTimeFormat('pt-BR',{timeZone:TZ,day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(ms))}const s=String(v||'').slice(0,10);if(/^\d{4}-\d{2}-\d{2}$/.test(s)){const[y,m,d]=s.split('-');return`${d}/${m}/${y}`}return'—'}
function expensePaid(e){return !['pending','open','unpaid','to_pay','payable'].includes(String(e?.payment_status||e?.status||'').toLowerCase())}
function expenseMode(e){if(e?.cost_mode==='per_person')return'per_person';if(e?.cost_mode==='fixed')return'fixed';return /aliment|hosped|hotel|camping|seguro|ingresso|entrada|day use|atrativo|refeic|lanche/i.test(`${e?.category||''} ${e?.description||''}`)?'per_person':'fixed'}
function expenseTotal(e,clients){const unit=num(e?.unit_amount||e?.amount);if(expenseMode(e)==='per_person'){const qty=num(e?.quantity_basis)>0?num(e.quantity_basis):num(clients);return unit*qty}return num(e?.amount)>0?num(e.amount):unit}
function dispatchId(tripId,closedAt){return createHash('sha256').update(`trip_closure|${tripId}|${stampMs(closedAt)||clean(closedAt)}`).digest('hex')}

async function sendResend({subject,html,text,key}){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{
    const resp=await fetch('https://api.resend.com/emails',{method:'POST',signal:controller.signal,headers:{Authorization:`Bearer ${resendKey}`,'Content-Type':'application/json','Idempotency-Key':key},body:JSON.stringify({from:emailFrom,to:[DESTINATION],reply_to:'trilheiros.roomt@gmail.com',subject,html,text})});
    const body=await resp.text();if(!resp.ok)throw new Error(`Resend ${resp.status}: ${body.slice(0,500)}`);try{return JSON.parse(body||'{}')}catch{return{}}
  }finally{clearTimeout(timer)}
}

function template(trip,expenses){
  const c=trip.financial_closure||{},name=clean(trip.name)||'Passeio',clients=num(c.clients),rows=expenses.map(e=>({category:clean(e.category)||'Outros',description:clean(e.description)||'Despesa',mode:expenseMode(e),status:expensePaid(e)?'Paga':'Em aberto',total:expenseTotal(e,clients)}));
  const expenseRows=rows.length?rows.map(r=>`<tr><td style="padding:9px;border-bottom:1px solid #e5ece8">${esc(r.category)}</td><td style="padding:9px;border-bottom:1px solid #e5ece8">${esc(r.description)}</td><td style="padding:9px;border-bottom:1px solid #e5ece8">${r.mode==='per_person'?'Por pessoa':'Valor total'}</td><td style="padding:9px;border-bottom:1px solid #e5ece8">${esc(r.status)}</td><td style="padding:9px;border-bottom:1px solid #e5ece8;text-align:right;font-weight:700">${money(r.total)}</td></tr>`).join(''):`<tr><td colspan="5" style="padding:12px">Nenhuma despesa detalhada lançada.</td></tr>`;
  const subject=`💰 Resultado final — ${name}`;
  const html=`<!doctype html><html><body style="margin:0;background:#eef4f1;font-family:Arial,Helvetica,sans-serif;color:#17372d"><table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:760px;background:#fff;border:1px solid #d9e5df;border-radius:20px;overflow:hidden"><tr><td align="center" style="background:#073226;padding:24px"><img src="${LOGO}" width="110" height="110" style="object-fit:contain"><p style="color:#d9b44c;font-size:12px;font-weight:800;margin:8px 0">RESULTADO FINAL DO PASSEIO</p><h1 style="color:#fff;margin:4px 0;font-size:26px">${esc(name)}</h1><p style="color:#d7e4df;margin:6px 0">${esc(brDate(trip.trip_date))} • ${esc(trip.destination||'')}</p></td></tr><tr><td style="padding:24px"><table width="100%" cellpadding="8" cellspacing="0" style="background:#f5f8f6;border-radius:14px"><tr><td><b>Clientes</b><br>${clients}</td><td><b>Vendido</b><br>${money(c.sold)}</td><td><b>Recebido</b><br>${money(c.received)}</td></tr><tr><td><b>A receber</b><br>${money(c.receivable)}</td><td><b>Reembolsos</b><br>${money(c.refunds)}</td><td><b>Resultado de caixa</b><br>${money(c.cash_result)}</td></tr><tr><td><b>Custo previsto</b><br>${money(c.cost_projected)}</td><td><b>Despesas reais</b><br>${money(c.cost_actual)}</td><td><b>Despesas em aberto</b><br>${money(c.expenses_open)}</td></tr><tr><td colspan="2"><b>LUCRO FINAL</b><br><span style="font-size:22px;color:#0b684b;font-weight:900">${money(c.profit_actual)}</span></td><td><b>Margem</b><br><span style="font-size:20px;font-weight:900">${Number(c.margin_percent||0).toFixed(1)}%</span></td></tr></table><h2 style="margin:24px 0 8px;color:#073226">Despesas do passeio</h2><table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e1e9e5;border-radius:12px;border-collapse:collapse"><thead><tr style="background:#073226;color:#fff"><th align="left" style="padding:9px">Categoria</th><th align="left" style="padding:9px">Descrição</th><th align="left" style="padding:9px">Tipo</th><th align="left" style="padding:9px">Status</th><th align="right" style="padding:9px">Valor</th></tr></thead><tbody>${expenseRows}</tbody></table><p style="margin:22px 0 0;color:#6c7e77;font-size:12px">Fechamento registrado em ${esc(brDate(trip.financial_closed_at||c.closed_at))}. Relatório automático do Trilheiros Gestão.</p></td></tr></table></td></tr></table></body></html>`;
  const lines=rows.map(r=>`- ${r.category} | ${r.description} | ${r.status}: ${money(r.total)}`).join('\n')||'- Nenhuma despesa detalhada lançada.';
  const text=`RESULTADO FINAL — ${name}\nData: ${brDate(trip.trip_date)}\nClientes: ${clients}\nVendido: ${money(c.sold)}\nRecebido: ${money(c.received)}\nA receber: ${money(c.receivable)}\nReembolsos: ${money(c.refunds)}\nCusto previsto: ${money(c.cost_projected)}\nDespesas reais: ${money(c.cost_actual)}\nDespesas em aberto: ${money(c.expenses_open)}\nLucro final: ${money(c.profit_actual)}\nMargem: ${Number(c.margin_percent||0).toFixed(1)}%\nResultado de caixa: ${money(c.cash_result)}\n\nDESPESAS\n${lines}`;
  return{subject,html,text};
}

async function processTrip(doc){
  const ref=doc.ref,trip={id:doc.id,...doc.data()};if(!trip.financial_locked||!trip.financial_closure)return;
  const id=dispatchId(doc.id,trip.financial_closed_at||trip.financial_closure?.closed_at),dispatchRef=db.collection('email_dispatches').doc(id);
  let claimed=false;
  await db.runTransaction(async tx=>{const snap=await tx.get(dispatchRef),d=snap.exists?snap.data()||{}:{};if(d.status==='sent'||d.status==='sending')return;tx.set(dispatchRef,{kind:'trip_financial_closure',trip_id:doc.id,source_ref:ref.path,status:'sending',attempts:Number(d.attempts||0)+1,last_attempt_at:FieldValue.serverTimestamp(),updated_at:FieldValue.serverTimestamp(),created_at:d.created_at||FieldValue.serverTimestamp()},{merge:true});claimed=true});
  if(!claimed)return;
  try{
    const expSnap=await db.collection('expenses').where('trip_id','==',doc.id).get(),expenses=expSnap.docs.map(d=>({id:d.id,...d.data()})),mail=template(trip,expenses),sent=await sendResend({...mail,key:`trip-closure-${id}`});
    await Promise.all([dispatchRef.set({status:'sent',resend_id:sent?.id||'',sent_at:FieldValue.serverTimestamp(),updated_at:FieldValue.serverTimestamp()},{merge:true}),ref.update({financial_closure_email_status:'sent',financial_closure_email_sent_at:FieldValue.serverTimestamp(),financial_closure_email_resend_id:sent?.id||'',financial_closure_email_error:FieldValue.delete(),updated_at:FieldValue.serverTimestamp()})]);
    console.log(`Resultado final enviado: ${trip.name} (${doc.id})`);
  }catch(e){
    await Promise.all([dispatchRef.set({status:'failed',last_error:String(e?.message||e).slice(0,1000),updated_at:FieldValue.serverTimestamp()},{merge:true}),ref.update({financial_closure_email_status:'pending',financial_closure_email_error:String(e?.message||e).slice(0,1000),financial_closure_email_last_attempt_at:FieldValue.serverTimestamp(),updated_at:FieldValue.serverTimestamp()})]);
    throw e;
  }
}

const snap=await db.collection('trips').where('financial_closure_email_status','==','pending').limit(20).get();
let failures=0;for(const doc of snap.docs){try{await processTrip(doc)}catch(e){failures++;console.error(`Falha ${doc.id}:`,e?.message||e)}}
console.log(`Fechamentos processados: ${snap.size}; falhas: ${failures}`);if(failures)process.exitCode=1;
