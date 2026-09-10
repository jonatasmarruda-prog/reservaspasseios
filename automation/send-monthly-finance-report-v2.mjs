import admin from 'firebase-admin';

const rawService=process.env.FIREBASE_SERVICE_ACCOUNT||'';
const resendKey=process.env.RESEND_API_KEY||'';
const emailFrom=process.env.EMAIL_FROM||'';
const reportTo=process.env.MONTHLY_REPORT_TO||'trilheiros.roomt@gmail.com';
const force=process.env.FORCE_MONTHLY_REPORT==='1';
const TZ='America/Cuiaba';

if(!rawService||!resendKey||!emailFrom){
  console.log('Relatório mensal não configurado: faltam FIREBASE_SERVICE_ACCOUNT, RESEND_API_KEY ou EMAIL_FROM.');
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
function iso(v){
  if(!v)return'';
  if(typeof v==='string'&&/^\d{4}-\d{2}-\d{2}/.test(v))return v.slice(0,10);
  try{
    const d=typeof v?.toDate==='function'?v.toDate():v?.seconds?new Date(v.seconds*1000):new Date(v);
    if(Number.isNaN(d.getTime()))return'';
    return new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
  }catch{return''}
}
const monthOf=v=>iso(v).slice(0,7);
const localToday=()=>iso(new Date());
function isLastLocalDay(){
  const now=new Date(),tomorrow=new Date(now.getTime()+86400000);
  return localToday().slice(0,7)!==iso(tomorrow).slice(0,7);
}
function monthLabel(m){
  const[y,mo]=m.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric',timeZone:TZ}).format(new Date(Date.UTC(y,mo-1,2)));
}
function payKind(v){
  const s=String(v||'').toLowerCase();
  if(s.includes('parcel')||s.includes('install'))return'pix_installment';
  if(s.includes('card')||s.includes('cart'))return'card';
  if(s.includes('pix'))return'pix';
  if(s.includes('cash')||s.includes('dinheiro'))return'cash';
  if(s.includes('transfer'))return'transfer';
  return'other';
}
const PAY={pix:'PIX',card:'Cartão',pix_installment:'PIX parcelado',cash:'Dinheiro',transfer:'Transferência',other:'Outros'};
const activeSale=s=>s?.sale_status!=='cancelled';
const saleTotal=s=>num(s?.sale_total)>0?num(s.sale_total):num(s?.paid_amount);
const saleBalance=s=>s?.sale_status==='cancelled'?0:Math.max(0,Number.isFinite(Number(s?.balance_due))?Number(s.balance_due):saleTotal(s)-num(s?.paid_amount));
function receiptEntries(s){
  if(Array.isArray(s.payment_history)&&s.payment_history.length){
    return s.payment_history.map(p=>({date:iso(p.date),amount:num(p.amount),method:payKind(p.method||s.payment_method),sale:s})).filter(p=>p.date&&p.amount>0);
  }
  const date=iso(s.received_date||s.payment_received_date||s.updated_at||s.created_at),amount=num(s.paid_amount);
  return date&&amount>0?[{date,amount,method:payKind(s.payment_method),sale:s}]:[];
}
function tripCost(t,seats){
  let items=Array.isArray(t?.cost_items)&&t.cost_items.length?t.cost_items:[];
  if(!items.length){
    items=[
      {mode:'fixed',amount:num(t?.cost_bus_fixed)},
      {mode:'fixed',amount:num(t?.cost_guide_fixed)},
      {mode:'fixed',amount:num(t?.cost_other_fixed)},
      {mode:'per_person',amount:num(t?.cost_lodging_per_person)},
      {mode:'per_person',amount:num(t?.cost_activity_per_person)},
      {mode:'per_person',amount:num(t?.cost_food_per_person)},
      {mode:'per_person',amount:num(t?.cost_insurance_per_person)},
      {mode:'per_person',amount:num(t?.cost_other_per_person)}
    ].filter(x=>x.amount>0);
  }
  const fixed=items.filter(x=>x.mode!=='per_person').reduce((s,x)=>s+num(x.amount),0);
  const perPerson=items.filter(x=>x.mode==='per_person').reduce((s,x)=>s+num(x.amount),0);
  return{fixed,perPerson,total:fixed+perPerson*Math.max(0,seats)};
}
function expensePaid(e){return !['pending','open','unpaid','to_pay','payable'].includes(String(e?.payment_status||e?.status||'').toLowerCase())}
function expenseAmount(e,seatMap){
  if(e?.cost_mode==='per_person'){
    if(expensePaid(e)&&num(e.amount)>0)return num(e.amount);
    return num(e.unit_amount||e.amount)*num(seatMap[e.trip_id]);
  }
  return num(e?.amount||e?.unit_amount);
}
function bar(label,value,max){
  const pct=max>0?Math.max(2,Math.round(value/max*100)):0;
  return `<div style="display:grid;grid-template-columns:130px 1fr 110px;gap:10px;align-items:center;margin:8px 0"><span style="font-size:12px;color:#52675e">${esc(label)}</span><div style="height:12px;border-radius:999px;background:#e8f0ec;overflow:hidden"><i style="display:block;height:100%;width:${pct}%;background:#0f684b"></i></div><b style="text-align:right;font-size:12px">${money(value)}</b></div>`;
}
function csv(v){const s=String(v??'');return /[;"\n]/.test(s)?`"${s.replaceAll('"','""')}"`:s}

if(!force&&!isLastLocalDay()){
  console.log(`Hoje (${localToday()}) não é o último dia do mês. Nada enviado.`);
  process.exit(0);
}
const month=localToday().slice(0,7);
const marker=db.collection('automation_reports').doc(`finance-${month}`);
if((await marker.get()).exists&&!force){console.log(`Relatório ${month} já enviado.`);process.exit(0)}

const [salesSnap,tripsSnap,expensesSnap]=await Promise.all([
  db.collection('sales').get(),db.collection('trips').get(),db.collection('expenses').get()
]);
const sales=salesSnap.docs.map(d=>({id:d.id,...d.data()}));
const trips=tripsSnap.docs.map(d=>({id:d.id,...d.data()}));
const expenses=expensesSnap.docs.map(d=>({id:d.id,...d.data()}));
const active=sales.filter(activeSale);
const seatsByTrip={};active.forEach(s=>{seatsByTrip[s.trip_id]=(seatsByTrip[s.trip_id]||0)+num(s.seats)});

const monthSales=active.filter(s=>monthOf(s.created_at||s.trip_date)===month);
const booked=monthSales.reduce((a,s)=>a+saleTotal(s),0);
const receivable=monthSales.reduce((a,s)=>a+saleBalance(s),0);

/* Caixa histórico: inclui recebimentos mesmo que a venda tenha sido cancelada depois. */
const receipts=sales.flatMap(receiptEntries).filter(p=>p.date.slice(0,7)===month);
const grossIncome=receipts.reduce((a,p)=>a+p.amount,0);
const paymentBreak={pix:0,card:0,pix_installment:0,cash:0,transfer:0,other:0};
receipts.forEach(p=>paymentBreak[p.method]+=p.amount);

/* Reembolso é uma saída separada; não deve ser jogado como pagamento negativo em “Outros”. */
const monthRefunds=sales.filter(s=>num(s.refunded_amount)>0&&monthOf(s.cancelled_at||s.refunded_at||s.updated_at)===month);
const refunds=monthRefunds.reduce((a,s)=>a+num(s.refunded_amount),0);
const netIncome=grossIncome-refunds;

const paidExpenses=expenses.filter(e=>expensePaid(e)&&monthOf(e.paid_date||e.expense_date||e.updated_at||e.created_at)===month);
const openExpenses=expenses.filter(e=>!expensePaid(e)&&monthOf(e.due_date||e.expense_date||e.created_at)===month);
const paidOut=paidExpenses.reduce((a,e)=>a+expenseAmount(e,seatsByTrip),0);
const toPay=openExpenses.reduce((a,e)=>a+expenseAmount(e,seatsByTrip),0);
const cashResult=netIncome-paidOut;

const expenseByCategory={};
paidExpenses.forEach(e=>{const k=e.category||'Outros';expenseByCategory[k]=(expenseByCategory[k]||0)+expenseAmount(e,seatsByTrip)});

const tripsMonth=trips.filter(t=>String(t.trip_date||'').slice(0,7)===month&&t.status!=='cancelled').map(t=>{
  const ss=active.filter(s=>s.trip_id===t.id),seats=ss.reduce((a,s)=>a+num(s.seats),0),sold=ss.reduce((a,s)=>a+saleTotal(s),0),received=ss.reduce((a,s)=>a+Math.max(0,num(s.paid_amount)-num(s.refunded_amount)),0),cost=tripCost(t,seats),ex=expenses.filter(e=>e.trip_id===t.id),actualPaid=ex.filter(expensePaid).reduce((a,e)=>a+expenseAmount(e,seatsByTrip),0),actualOpen=ex.filter(e=>!expensePaid(e)).reduce((a,e)=>a+expenseAmount(e,seatsByTrip),0);
  const avgPrice=seats>0?sold/seats:num(t.default_price),contribution=avgPrice-cost.perPerson,breakEven=contribution>0?Math.ceil(cost.fixed/contribution):null;
  return{t,seats,sold,received,cost,actualPaid,actualOpen,profit:sold-cost.total,cash:received-actualPaid,breakEven};
}).sort((a,b)=>String(a.t.trip_date||'').localeCompare(String(b.t.trip_date||'')));

const maxPay=Math.max(1,...Object.values(paymentBreak));
const maxCat=Math.max(1,...Object.values(expenseByCategory));
const tripRows=tripsMonth.map(x=>`<tr><td style="padding:10px;border-bottom:1px solid #e6ece9"><b>${esc(x.t.name||'Passeio')}</b><br><small>${esc(iso(x.t.trip_date))}</small></td><td style="padding:10px;text-align:center;border-bottom:1px solid #e6ece9">${x.seats}</td><td style="padding:10px;text-align:right;border-bottom:1px solid #e6ece9">${money(x.sold)}</td><td style="padding:10px;text-align:right;border-bottom:1px solid #e6ece9">${money(x.received)}</td><td style="padding:10px;text-align:right;border-bottom:1px solid #e6ece9">${money(x.cost.total)}</td><td style="padding:10px;text-align:right;border-bottom:1px solid #e6ece9">${money(x.actualPaid)}</td><td style="padding:10px;text-align:right;border-bottom:1px solid #e6ece9">${money(x.actualOpen)}</td><td style="padding:10px;text-align:right;border-bottom:1px solid #e6ece9"><b>${money(x.profit)}</b></td><td style="padding:10px;text-align:center;border-bottom:1px solid #e6ece9">${x.breakEven??'—'}</td></tr>`).join('');

const cards=[
  ['FATURADO ATIVO NO MÊS',booked,'#eef6f2'],['RECEBIMENTOS BRUTOS',grossIncome,'#eef6f2'],['REEMBOLSOS',refunds,'#fff1ef'],['DINHEIRO LÍQUIDO QUE ENTROU',netIncome,'#edf8f2'],
  ['DESPESAS PAGAS',paidOut,'#fff6df'],['CONTAS A PAGAR',toPay,'#fff6df'],['A RECEBER DE CLIENTES',receivable,'#f4f1ff'],['RESULTADO DE CAIXA',cashResult,cashResult>=0?'#edf8f2':'#fff1ef']
].map(([label,value,bg])=>`<div style="padding:16px;border-radius:14px;background:${bg}"><small>${label}</small><b style="display:block;font-size:21px;margin-top:5px">${money(value)}</b></div>`).join('');

const html=`<div style="margin:0;padding:24px;background:#f1f6f3;font-family:Arial,Helvetica,sans-serif;color:#173a2f"><div style="max-width:1000px;margin:auto;background:#fff;border-radius:22px;overflow:hidden;border:1px solid #dae7e1"><div style="padding:26px;background:#073226;color:#fff"><div style="font-size:12px;font-weight:800;letter-spacing:.08em">TRILHEIROS DE RONDONÓPOLIS</div><div style="font-size:27px;font-weight:900;margin-top:8px">Relatório financeiro mensal</div><div style="margin-top:5px;opacity:.85">${esc(monthLabel(month))}</div></div><div style="padding:24px"><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px">${cards}</div><h3 style="margin:28px 0 10px">Recebimentos por forma de pagamento</h3>${Object.entries(paymentBreak).filter(([,v])=>v>0.009).map(([k,v])=>bar(PAY[k],v,maxPay)).join('')||'<p>Sem recebimentos confirmados no período.</p>'}<h3 style="margin:28px 0 10px">Despesas pagas por categoria</h3>${Object.entries(expenseByCategory).map(([k,v])=>bar(k,v,maxCat)).join('')||'<p>Sem despesas pagas no período.</p>'}<h3 style="margin:28px 0 10px">Resultado por passeio</h3><div style="overflow:auto"><table style="border-collapse:collapse;width:100%;font-size:12px"><thead><tr style="background:#073226;color:#fff"><th style="padding:10px;text-align:left">Passeio</th><th>Clientes</th><th>Vendido</th><th>Recebido</th><th>Custo previsto</th><th>Desp. pagas</th><th>A pagar</th><th>Lucro previsto</th><th>Equilíbrio</th></tr></thead><tbody>${tripRows||'<tr><td colspan="9" style="padding:16px">Nenhum passeio no mês.</td></tr>'}</tbody></table></div><p style="margin-top:22px;font-size:11px;color:#6b7d75">Critérios: recebimentos são contabilizados pela data efetiva de pagamento; reembolsos são apresentados separadamente e descontados do caixa líquido; custos “por pessoa” multiplicam a quantidade de clientes; custos “valor total” entram uma única vez. O ponto de equilíbrio usa o preço médio real por cliente quando houver vendas.</p></div></div></div>`;

const csvLines=[
  ['Passeio','Data','Clientes','Vendido','Recebido','Custo previsto','Despesas pagas','Contas a pagar','Lucro previsto','Resultado caixa','Ponto equilíbrio'],
  ...tripsMonth.map(x=>[x.t.name,iso(x.t.trip_date),x.seats,x.sold.toFixed(2),x.received.toFixed(2),x.cost.total.toFixed(2),x.actualPaid.toFixed(2),x.actualOpen.toFixed(2),x.profit.toFixed(2),x.cash.toFixed(2),x.breakEven??''])
].map(r=>r.map(csv).join(';')).join('\n');

const resp=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${resendKey}`,'Content-Type':'application/json'},body:JSON.stringify({from:emailFrom,to:[reportTo],subject:`Relatório financeiro — ${monthLabel(month)}`,html,attachments:[{filename:`relatorio-financeiro-${month}.csv`,content:Buffer.from(csvLines,'utf8').toString('base64')} ]})});
if(!resp.ok)throw new Error(`Resend ${resp.status}: ${await resp.text()}`);
await marker.set({month,to:reportTo,sent_at:FieldValue.serverTimestamp(),summary:{booked,gross_income:grossIncome,refunds,net_income:netIncome,paid_out:paidOut,to_pay:toPay,receivable,cash_result:cashResult},forced:force,version:2},{merge:true});
console.log(`Relatório financeiro ${month} enviado para ${reportTo}.`);
