/* Trilheiros Gestão Master V40 — controle executivo, DRE, segurança, espera, fechamento e relatórios */
(function(){
'use strict';
if(typeof state==='undefined')return;

const q=(s,r=document)=>r.querySelector(s);
const qa=(s,r=document)=>[...r.querySelectorAll(s)];
const n=v=>Math.max(0,Number(v||0)||0);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#039;'}[c]));
const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v||0));
const OWNER='trilheiros.roomt@gmail.com';
const GUIDE='Jonatas Marques de Arruda';
const TZ='America/Cuiaba';
const HOLD_MINUTES=60;
const WAIVER_VERSION='2026-09-v40';
const PAY={pix:'PIX',card:'Cartão',pix_installment:'PIX parcelado',cash:'Dinheiro',transfer:'Transferência',other:'Outro'};
const STATUS={paid:'Pago',partial:'Parcial',pending:'Pendente',refunded:'Reembolsado',cancelled:'Cancelada'};

function notify(msg,type=''){try{return typeof toast==='function'?toast(msg,type):alert(msg)}catch(_){alert(msg)}}
function role(){return state?.role||''}
function canManage(){return ['owner','admin'].includes(role())}
function canFinance(){return ['owner','admin','finance'].includes(role())}
function canOperate(){return ['owner','admin','support'].includes(role())}
function nowLocal(){return new Date()}
function today(){return new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(nowLocal())}
function monthNow(){return today().slice(0,7)}
function brDate(v){const s=iso(v);if(!s)return'—';const[y,m,d]=s.split('-');return`${d}/${m}/${y}`}
function iso(v){
  if(!v)return'';
  if(typeof v==='string'&&/^\d{4}-\d{2}-\d{2}/.test(v))return v.slice(0,10);
  try{const d=typeof v?.toDate==='function'?v.toDate():v?.seconds?new Date(v.seconds*1000):new Date(v);if(Number.isNaN(d.getTime()))return'';return new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(d)}catch{return''}
}
function millis(v){try{if(typeof v?.toMillis==='function')return v.toMillis();if(v?.seconds)return v.seconds*1000;const d=new Date(v);return Number.isNaN(d.getTime())?0:d.getTime()}catch{return 0}}
function monthOf(v){return iso(v).slice(0,7)}
function payKind(v){const s=String(v||'').toLowerCase();if(s.includes('parcel')||s.includes('install'))return'pix_installment';if(s.includes('card')||s.includes('cart'))return'card';if(s.includes('pix'))return'pix';if(s.includes('cash')||s.includes('dinheiro'))return'cash';if(s.includes('transfer'))return'transfer';return'other'}
function saleTotal(s){return n(s?.sale_total)>0?n(s.sale_total):n(s?.paid_amount)}
function netPaid(s){return Math.max(0,n(s?.paid_amount)-n(s?.refunded_amount))}
function saleBalance(s){if(s?.sale_status==='cancelled')return 0;const b=Number(s?.balance_due);return Number.isFinite(b)?Math.max(0,b):Math.max(0,saleTotal(s)-n(s?.paid_amount))}
function activeSale(s){return s?.sale_status!=='cancelled'}
function paymentEntries(s){
  if(Array.isArray(s?.payment_history)&&s.payment_history.length)return s.payment_history.map(p=>({date:iso(p.date),amount:n(p.amount),method:payKind(p.method||s.payment_method)})).filter(x=>x.amount>0&&x.date);
  const d=iso(s?.received_date||s?.payment_received_date||s?.updated_at||s?.created_at),amount=n(s?.paid_amount);
  return amount>0&&d?[{date:d,amount,method:payKind(s.payment_method)}]:[];
}
function activeSeats(tripId){return (state.reservations||[]).filter(r=>r.trip_id===tripId&&r.status!=='cancelled').reduce((s,r)=>s+n(r.seats),0)}
function tripCost(t,seats){
  let items=Array.isArray(t?.cost_items)?t.cost_items:[];
  if(!items.length){items=[
    {mode:'fixed',amount:n(t?.cost_bus_fixed)},{mode:'fixed',amount:n(t?.cost_guide_fixed)},{mode:'fixed',amount:n(t?.cost_other_fixed)},
    {mode:'per_person',amount:n(t?.cost_lodging_per_person)},{mode:'per_person',amount:n(t?.cost_activity_per_person)},
    {mode:'per_person',amount:n(t?.cost_food_per_person)},{mode:'per_person',amount:n(t?.cost_insurance_per_person)},{mode:'per_person',amount:n(t?.cost_other_per_person)}
  ].filter(x=>x.amount>0)}
  const fixed=items.filter(x=>x.mode!=='per_person').reduce((s,x)=>s+n(x.amount),0);
  const perPerson=items.filter(x=>x.mode==='per_person').reduce((s,x)=>s+n(x.amount),0);
  return{fixed,perPerson,total:fixed+perPerson*Math.max(0,seats)};
}
function expensePaid(e){return !['pending','open','unpaid','to_pay','payable'].includes(String(e?.payment_status||e?.status||'').toLowerCase())}
function expenseAmount(e,seatsByTrip={}){if(e?.cost_mode==='per_person'&&e?.dynamic_per_person!==false&&!expensePaid(e))return n(e?.unit_amount||e?.amount)*n(seatsByTrip[e.trip_id]);return n(e?.amount)>0?n(e.amount):n(e?.unit_amount)}
function saleOption(s,r){
  const raw=s?.category||s?.accommodation||r?.category||r?.accommodation||r?.participant_type||'';
  if(raw)return String(raw).replaceAll('_',' ');
  return n(s?.seats||r?.seats)===1?'Individual':`${n(s?.seats||r?.seats)} pessoas`;
}
function isCanva(s){return String(s?.source||'').includes('public_portal')||s?.channel==='canva_reserva_passeios'}
function protocol(){return`TV-${new Date().getFullYear()}-${Math.random().toString(36).slice(2,8).toUpperCase()}`}
function saleUrl(id){return `${location.origin}/cadastro-venda/${encodeURIComponent(id)}`}
function download(name,content,type='application/json'){const b=new Blob([content],{type}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000)}
async function audit(action,entity,id,summary){try{await window.auditV7?.(action,entity,id,summary)}catch(_){}}

async function getSales(){const s=await db.collection('sales').get();return s.docs.map(d=>({id:d.id,...d.data()}))}
async function getExpenses(){const s=await db.collection('expenses').get();return s.docs.map(d=>({id:d.id,...d.data()}))}
async function getOperations(kind){
  const trips=state.trips||[],out=[];
  for(const t of trips){try{const s=await db.collection('trips').doc(t.id).collection('operations').get();s.docs.forEach(d=>{const x=d.data();if(x.kind===kind)out.push({id:d.id,trip_id:t.id,...x})})}catch(_){ }}
  return out;
}
async function getWaitlist(){return getOperations('waitlist')}
async function getSafety(){return getOperations('safety_profile')}

function injectNav(){
  const nav=q('.admin .nav');if(!nav)return;
  if(!q('[data-tab="safetyV40"]',nav)){
    const anchor=q('[data-tab="reports"]',nav)||q('[data-tab="day"]',nav);
    const b=document.createElement('button');b.dataset.tab='safetyV40';b.innerHTML='🛡 Segurança';b.onclick=()=>{state.tab='safetyV40';renderAdmin()};anchor?anchor.after(b):nav.appendChild(b);
  }
  if(!q('[data-tab="waitlistV40"]',nav)){
    const anchor=q('[data-tab="safetyV40"]',nav)||q('[data-tab="reports"]',nav);
    const b=document.createElement('button');b.dataset.tab='waitlistV40';b.innerHTML='⏳ Lista de espera';b.onclick=()=>{state.tab='waitlistV40';renderAdmin()};anchor?anchor.after(b):nav.appendChild(b);
  }
}

function monthlyMetrics(sales,expenses,month=monthNow()){
  const active=sales.filter(activeSale),monthSales=active.filter(s=>monthOf(s.created_at||s.trip_date)===month);
  const booked=monthSales.reduce((a,s)=>a+saleTotal(s),0),payments=[];
  active.forEach(s=>paymentEntries(s).forEach(p=>{if(p.date.slice(0,7)===month)payments.push({...p,sale:s})}));
  let income=payments.reduce((a,p)=>a+p.amount,0),refunds=0;
  sales.forEach(s=>{const r=n(s.refunded_amount);if(r>0&&monthOf(s.cancelled_at||s.updated_at)===month)refunds+=r});income=Math.max(0,income-refunds);
  const seatsByTrip={};active.forEach(s=>{seatsByTrip[s.trip_id]=(seatsByTrip[s.trip_id]||0)+n(s.seats)});
  const paidExp=expenses.filter(e=>expensePaid(e)&&monthOf(e.paid_date||e.expense_date||e.updated_at||e.created_at)===month),openExp=expenses.filter(e=>!expensePaid(e)&&monthOf(e.due_date||e.expense_date||e.created_at)===month);
  const paidOut=paidExp.reduce((a,e)=>a+expenseAmount(e,seatsByTrip),0),toPay=openExp.reduce((a,e)=>a+expenseAmount(e,seatsByTrip),0),receivable=active.reduce((a,s)=>a+saleBalance(s),0);
  const payBreak={pix:0,card:0,pix_installment:0,cash:0,transfer:0,other:0};payments.forEach(p=>payBreak[p.method]=(payBreak[p.method]||0)+p.amount);
  return{booked,income,refunds,paidOut,toPay,receivable,cash:income-paidOut,payBreak,seatsByTrip};
}
function tripFinancial(t,sales,expenses){
  const ss=sales.filter(s=>s.trip_id===t.id&&activeSale(s)),seats=ss.reduce((a,s)=>a+n(s.seats),0),sold=ss.reduce((a,s)=>a+saleTotal(s),0),received=ss.reduce((a,s)=>a+netPaid(s),0),receivable=ss.reduce((a,s)=>a+saleBalance(s),0),refunds=sales.filter(s=>s.trip_id===t.id).reduce((a,s)=>a+n(s.refunded_amount),0),cost=tripCost(t,seats),ex=expenses.filter(e=>e.trip_id===t.id),paidExp=ex.filter(expensePaid).reduce((a,e)=>a+expenseAmount(e,{[t.id]:seats}),0),openExp=ex.filter(e=>!expensePaid(e)).reduce((a,e)=>a+expenseAmount(e,{[t.id]:seats}),0),actualCost=paidExp+openExp,profitProjected=sold-cost.total,profitActual=sold-actualCost,margin=sold>0?profitActual/sold*100:0,ticket=seats>0?sold/seats:n(t.default_price),contribution=ticket-cost.perPerson,breakEven=contribution>0?Math.ceil(cost.fixed/contribution):null;
  return{ss,seats,sold,received,receivable,refunds,cost,paidExp,openExp,actualCost,profitProjected,profitActual,margin,ticket,breakEven,cash:received-paidExp};
}

async function mountExecutive(){
  if(state.tab!=='dashboard')return;const content=q('#content');if(!content||q('#v40Executive'))return;
  const host=document.createElement('section');host.id='v40Executive';host.className='v40Block';host.innerHTML='<div class="v40Loading">Calculando indicadores financeiros...</div>';content.appendChild(host);
  try{
    const [sales,expenses,waitlist]=await Promise.all([getSales(),getExpenses(),getWaitlist()]),m=monthlyMetrics(sales,expenses),now=Date.now();
    const stale=sales.filter(s=>activeSale(s)&&isCanva(s)&&n(s.paid_amount)<=0&&String(s.payment_status||'pending')==='pending'&&millis(s.created_at)>0&&now-millis(s.created_at)>HOLD_MINUTES*60000).sort((a,b)=>millis(a.created_at)-millis(b.created_at));
    const installments=sales.filter(s=>activeSale(s)&&payKind(s.payment_method)==='pix_installment'&&saleBalance(s)>0).sort((a,b)=>String(a.next_due_date||'9999').localeCompare(String(b.next_due_date||'9999')));
    const openWait=waitlist.filter(w=>w.status==='waiting');
    const monthTrips=(state.trips||[]).filter(t=>String(t.trip_date||'').slice(0,7)===monthNow()&&t.status!=='cancelled').map(t=>({t,f:tripFinancial(t,sales,expenses)})).sort((a,b)=>b.f.profitActual-a.f.profitActual);
    const best=monthTrips[0];
    host.innerHTML=`<div class="v40Head"><div><span class="eyebrow">GESTÃO EXECUTIVA 2.0</span><h2>Resumo financeiro e operacional do mês</h2><p>Receita, caixa, despesas, cobranças e alertas em uma visão única.</p></div><span class="v40Badge">${esc(monthNow())}</span></div>
    <div class="v40Kpis"><div><span>FATURADO</span><strong>${money(m.booked)}</strong></div><div><span>ENTROU NO CAIXA</span><strong>${money(m.income)}</strong></div><div><span>DESPESAS PAGAS</span><strong>${money(m.paidOut)}</strong></div><div><span>CONTAS A PAGAR</span><strong>${money(m.toPay)}</strong></div><div><span>A RECEBER</span><strong>${money(m.receivable)}</strong></div><div><span>RESULTADO DE CAIXA</span><strong>${money(m.cash)}</strong></div></div>
    <div class="v40Grid"><section><h3>Entradas por pagamento</h3>${Object.entries(m.payBreak).map(([k,v])=>`<div class="v40Line"><span>${PAY[k]||k}</span><b>${money(v)}</b></div>`).join('')}</section><section><h3>Desempenho</h3>${best?`<div class="v40Highlight"><span>PASSEIO COM MELHOR RESULTADO</span><strong>${esc(best.t.name)}</strong><small>Lucro atual ${money(best.f.profitActual)} • margem ${best.f.margin.toFixed(1)}%</small></div>`:'<p>Sem passeio no mês.</p>'}<div class="v40Line"><span>Reservas PIX parcelado em aberto</span><b>${installments.length}</b></div><div class="v40Line"><span>Lista de espera</span><b>${openWait.length}</b></div></section></div>
    ${stale.length?`<section class="v40Alert"><div><span class="eyebrow">PAGAMENTOS NÃO CONFIRMADOS</span><h3>${stale.length} reserva(s) iniciada(s) há mais de ${HOLD_MINUTES} minutos</h3><p>Como o PIX copiado não permite confirmação bancária automática, confira antes de liberar a vaga.</p></div><div class="v40AlertRows">${stale.slice(0,8).map(s=>`<div><span><b>${esc(s.customer_name||'Cliente')}</b> • ${esc(s.trip_name||'Passeio')} • ${money(saleTotal(s))}</span>${canManage()?`<button data-v40-release="${esc(s.id)}">Liberar vaga</button>`:''}</div>`).join('')}</div></section>`:''}`;
    qa('[data-v40-release]',host).forEach(b=>b.onclick=()=>releasePendingSale(b.dataset.v40Release));
  }catch(e){host.innerHTML=`<div class="msg error">${esc(e.message||'Não foi possível montar o painel executivo.')}</div>`}
}

async function releasePendingSale(id){
  if(!canManage())return notify('Somente proprietário ou administrador pode liberar vagas.','error');
  if(!confirm('Confirme somente se o pagamento NÃO caiu. Liberar esta vaga e cancelar a pendência?'))return;
  try{
    const saleRef=db.collection('sales').doc(id);let tripId='',seats=0;
    await db.runTransaction(async tx=>{
      const ss=await tx.get(saleRef);if(!ss.exists)throw Error('Venda não encontrada.');const s=ss.data();if(!activeSale(s))throw Error('Venda já encerrada.');if(n(s.paid_amount)>0||!['pending',''].includes(String(s.payment_status||'pending')))throw Error('Esta venda já possui pagamento confirmado.');tripId=s.trip_id;seats=n(s.seats);const tripRef=db.collection('trips').doc(tripId),resRef=tripRef.collection('reservations').doc(id),[ts,rs]=await Promise.all([tx.get(tripRef),tx.get(resRef)]);if(!ts.exists)throw Error('Passeio não encontrado.');const t=ts.data(),stamp=firebase.firestore.FieldValue.serverTimestamp(),used=Math.max(t.special_seat_counted?1:0,n(t.used_spots)-seats),rem=Math.max(0,n(t.total_spots)-used);
      tx.update(saleRef,{sale_status:'cancelled',payment_status:'cancelled',balance_due:0,cancel_reason:'Pagamento não confirmado — vaga liberada manualmente',cancelled_at:stamp,updated_at:stamp});
      if(rs.exists)tx.update(resRef,{status:'cancelled',payment_status:'cancelled',balance_due:0,cancel_reason:'Pagamento não confirmado — vaga liberada manualmente',updated_at:stamp});
      tx.update(tripRef,{used_spots:used,remaining_spots:rem,updated_at:stamp});
    });
    await audit('cancel','sale',id,'Pendência sem pagamento confirmada como não paga; vaga liberada.');notify('Vaga liberada e pendência cancelada.','success');renderAdmin();
  }catch(e){notify(e.message||'Não foi possível liberar a vaga.','error')}
}

async function mountFinanceControl(){
  if(state.tab!=='finance')return;const content=q('#content');if(!content||q('#v40FinanceControl'))return;
  const box=document.createElement('section');box.id='v40FinanceControl';box.className='v40Block';box.innerHTML='<div class="v40Loading">Preparando DRE dos passeios...</div>';content.insertAdjacentElement('afterbegin',box);
  try{
    const [sales,expenses]=await Promise.all([getSales(),getExpenses()]),trips=(state.trips||[]).filter(t=>t.status!=='cancelled').sort((a,b)=>String(a.trip_date||'').localeCompare(String(b.trip_date||'')));
    box.innerHTML=`<div class="v40Head"><div><span class="eyebrow">DRE POR PASSEIO</span><h2>Receita, despesas, margem e fechamento</h2><p>O fechamento congela um retrato financeiro do passeio para evitar alterações acidentais.</p></div></div><div class="v40TripDre">${trips.map(t=>{const f=tripFinancial(t,sales,expenses),locked=!!t.financial_locked;return`<article class="v40DreCard ${locked?'locked':''}"><div class="v40DreTitle"><div><strong>${esc(t.name)}</strong><small>${brDate(t.trip_date)} • ${f.seats} cliente(s)</small></div><span>${locked?'FECHADO':'ABERTO'}</span></div><div class="v40DreNums"><div><span>Vendido</span><b>${money(f.sold)}</b></div><div><span>Recebido</span><b>${money(f.received)}</b></div><div><span>Despesas</span><b>${money(f.actualCost)}</b></div><div><span>Lucro</span><b>${money(f.profitActual)}</b></div><div><span>Margem</span><b>${f.margin.toFixed(1)}%</b></div><div><span>Equilíbrio</span><b>${f.breakEven??'—'}</b></div></div><div class="v40DreActions"><button data-v40-dre="${esc(t.id)}">Ver DRE</button>${canManage()?`<button data-v40-close="${esc(t.id)}">${locked?'Reabrir fechamento':'Fechar passeio'}</button>`:''}</div></article>`}).join('')}</div>`;
    qa('[data-v40-dre]',box).forEach(b=>b.onclick=()=>openDreModal(b.dataset.v40Dre));qa('[data-v40-close]',box).forEach(b=>b.onclick=()=>toggleCloseTrip(b.dataset.v40Close));
  }catch(e){box.innerHTML=`<div class="msg error">${esc(e.message||e)}</div>`}
}
async function openDreModal(tripId){
  const t=(state.trips||[]).find(x=>x.id===tripId);if(!t)return;const [sales,expenses]=await Promise.all([getSales(),getExpenses()]),f=tripFinancial(t,sales,expenses);q('#v40DreModal')?.remove();const back=document.createElement('div');back.id='v40DreModal';back.className='modalBack';back.innerHTML=`<div class="modal v40Modal"><div class="modalHead"><div><span class="eyebrow">DEMONSTRATIVO DO PASSEIO</span><h2>${esc(t.name)}</h2><p>${brDate(t.trip_date)} • ${f.seats} cliente(s)</p></div><button class="iconClose" id="v40DreClose">✕</button></div><div class="modalBody"><div class="v40Kpis"><div><span>VENDIDO</span><strong>${money(f.sold)}</strong></div><div><span>RECEBIDO</span><strong>${money(f.received)}</strong></div><div><span>A RECEBER</span><strong>${money(f.receivable)}</strong></div><div><span>REEMBOLSOS</span><strong>${money(f.refunds)}</strong></div><div><span>CUSTO PREVISTO</span><strong>${money(f.cost.total)}</strong></div><div><span>DESPESAS LANÇADAS</span><strong>${money(f.actualCost)}</strong></div><div><span>LUCRO ATUAL</span><strong>${money(f.profitActual)}</strong></div><div><span>MARGEM</span><strong>${f.margin.toFixed(1)}%</strong></div></div><div class="v40Grid"><section><h3>Composição de custo</h3><div class="v40Line"><span>Custos fixos</span><b>${money(f.cost.fixed)}</b></div><div class="v40Line"><span>Custo por pessoa</span><b>${money(f.cost.perPerson)}</b></div><div class="v40Line"><span>Despesas pagas</span><b>${money(f.paidExp)}</b></div><div class="v40Line"><span>Contas a pagar</span><b>${money(f.openExp)}</b></div></section><section><h3>Indicadores</h3><div class="v40Line"><span>Ticket médio</span><b>${money(f.ticket)}</b></div><div class="v40Line"><span>Ponto de equilíbrio</span><b>${f.breakEven??'—'} cliente(s)</b></div><div class="v40Line"><span>Resultado de caixa</span><b>${money(f.cash)}</b></div><div class="v40Line"><span>Lucro projetado</span><b>${money(f.profitProjected)}</b></div></section></div>${t.financial_closure?`<div class="v40Notice">Fechamento registrado em ${esc(brDate(t.financial_closure.closed_at||t.financial_closed_at))}. O retrato financeiro está preservado no passeio.</div>`:''}</div><div class="modalFoot"><button class="btn ghost" id="v40DreClose2">Fechar</button>${canManage()?`<button class="btn primary" id="v40DreToggle">${t.financial_locked?'Reabrir financeiro':'Fechar passeio'}</button>`:''}</div></div>`;document.body.appendChild(back);q('#v40DreClose',back).onclick=q('#v40DreClose2',back).onclick=()=>back.remove();if(q('#v40DreToggle',back))q('#v40DreToggle',back).onclick=()=>{back.remove();toggleCloseTrip(tripId)};
}
async function toggleCloseTrip(tripId){
  if(!canManage())return notify('Somente proprietário ou administrador pode fechar passeios.','error');const t=(state.trips||[]).find(x=>x.id===tripId);if(!t)return;
  if(t.financial_locked){if(!confirm('Reabrir o financeiro deste passeio? Despesas e custos poderão ser alterados novamente.'))return;try{const stamp=firebase.firestore.FieldValue.serverTimestamp();await db.collection('trips').doc(tripId).update({financial_locked:false,status:t.trip_date<today()?'completed':'open',financial_reopened_at:stamp,updated_at:stamp});t.financial_locked=false;await audit('update','trip',tripId,'Fechamento financeiro reaberto.');notify('Financeiro reaberto.','success');renderAdmin()}catch(e){notify(e.message||e,'error')}return}
  const [sales,expenses]=await Promise.all([getSales(),getExpenses()]),f=tripFinancial(t,sales,expenses);if(f.receivable>0.009&&!confirm(`Ainda há ${money(f.receivable)} a receber. Deseja fechar mesmo assim?`))return;if(f.openExp>0.009&&!confirm(`Ainda há ${money(f.openExp)} em contas a pagar. Fechar mesmo assim?`))return;if(!confirm(`Fechar ${t.name}? O sistema salvará o resultado final e bloqueará alterações financeiras até você reabrir.`))return;
  try{const stamp=firebase.firestore.FieldValue.serverTimestamp(),snapshot={version:'v40',closed_at:today(),clients:f.seats,sold:f.sold,received:f.received,receivable:f.receivable,refunds:f.refunds,cost_projected:f.cost.total,cost_actual:f.actualCost,expenses_paid:f.paidExp,expenses_open:f.openExp,profit_actual:f.profitActual,profit_projected:f.profitProjected,margin_percent:Number(f.margin.toFixed(2)),ticket_average:f.ticket,break_even_clients:f.breakEven,cash_result:f.cash};await db.collection('trips').doc(tripId).update({financial_locked:true,financial_closure:snapshot,financial_closed_at:stamp,status:'completed',updated_at:stamp});Object.assign(t,{financial_locked:true,financial_closure:snapshot,status:'completed'});await audit('close','trip',tripId,`Passeio fechado financeiramente. Lucro ${money(f.profitActual)}.`);notify('Passeio fechado e resultado financeiro preservado.','success');renderAdmin()}catch(e){notify(e.message||'Erro ao fechar passeio.','error')}
}

function safetyKey(tripId,resId){return `safety_${resId}`}
async function renderSafety(){
  if(state.tab!=='safetyV40')return;const content=q('#content');if(!content)return;q('#pageTitle').textContent='Segurança';
  content.innerHTML='<div class="v40Loading">Carregando fichas de segurança...</div>';
  try{const profiles=await getSafety(),map=new Map(profiles.map(x=>[x.id,x])),rows=(state.reservations||[]).filter(r=>r.status!=='cancelled').sort((a,b)=>String(a.trip_id).localeCompare(String(b.trip_id)));content.innerHTML=`<section class="v40Block"><div class="v40Head"><div><span class="eyebrow">SEGURANÇA OPERACIONAL</span><h2>Contato de emergência e termo</h2><p>Dados sensíveis ficam em coleção separada do financeiro e nunca entram nos PDFs de fornecedores.</p></div></div><div class="v40SafetyList">${rows.length?rows.map(r=>{const t=(state.trips||[]).find(x=>x.id===r.trip_id),p=map.get(safetyKey(r.trip_id,r.id)),name=r.responsible_name||r.participants?.[0]?.full_name||'Participante';return`<button class="v40SafetyRow" data-v40-safety="${esc(r.trip_id)}|${esc(r.id)}"><div><strong>${esc(name)}</strong><small>${esc(t?.name||r.trip_name||'Passeio')} • ${(r.participants||[]).map(x=>x.full_name).filter(Boolean).join(' • ')||'1 participante'}</small></div><div><span class="${p?.waiver_confirmed?'ok':'warn'}">${p?.waiver_confirmed?'TERMO REGISTRADO':'TERMO PENDENTE'}</span><small>${p?.emergency_contact_name?'Emergência cadastrada':'Sem contato de emergência'}</small></div></button>`}).join(''):'<div class="v40Empty">Nenhuma reserva ativa.</div>'}</div></section>`;qa('[data-v40-safety]',content).forEach(b=>b.onclick=()=>{const [tripId,resId]=b.dataset.v40Safety.split('|');openSafety(tripId,resId)})}catch(e){content.innerHTML=`<div class="msg error">${esc(e.message||e)}</div>`}
}
async function openSafety(tripId,resId){
  if(!canOperate())return notify('Seu perfil não possui acesso às fichas de segurança.','error');const r=(state.reservations||[]).find(x=>x.trip_id===tripId&&x.id===resId),t=(state.trips||[]).find(x=>x.id===tripId);if(!r)return;const ref=db.collection('trips').doc(tripId).collection('operations').doc(safetyKey(tripId,resId)),snap=await ref.get(),p=snap.exists?snap.data():{};q('#v40SafetyModal')?.remove();const back=document.createElement('div');back.id='v40SafetyModal';back.className='modalBack';back.innerHTML=`<div class="modal v40Modal"><form id="v40SafetyForm"><div class="modalHead"><div><span class="eyebrow">FICHA DE SEGURANÇA</span><h2>${esc(r.responsible_name||r.participants?.[0]?.full_name||'Participante')}</h2><p>${esc(t?.name||'Passeio')}</p></div><button type="button" class="iconClose" id="v40SafetyClose">✕</button></div><div class="modalBody"><div class="v40Sensitive">🔒 Uso interno. Não exportar para ônibus, hospedagem ou atrativos.</div><div class="grid two"><label><span>Contato de emergência</span><input name="emergencyName" value="${esc(p.emergency_contact_name||'')}"></label><label><span>Telefone de emergência</span><input name="emergencyPhone" value="${esc(p.emergency_contact_phone||'')}"></label><label class="span2"><span>Restrição relevante declarada</span><textarea name="restriction" rows="2" placeholder="Registre somente o necessário para segurança">${esc(p.restriction_notes||'')}</textarea></label><label class="span2"><span>Alergia relevante declarada</span><textarea name="allergy" rows="2">${esc(p.allergy_notes||'')}</textarea></label><label class="span2"><span>Medicamento de emergência informado</span><textarea name="medication" rows="2">${esc(p.emergency_medication_notes||'')}</textarea></label></div><label class="v40Check"><input name="waiver" type="checkbox" ${p.waiver_confirmed?'checked':''}><span>Registrar que o termo de responsabilidade foi conferido/aceito.</span></label><div class="v40Notice">Este registro administrativo não substitui uma assinatura eletrônica do participante. Versão do termo: ${WAIVER_VERSION}.</div><div id="v40SafetyMsg"></div></div><div class="modalFoot"><button type="button" class="btn ghost" id="v40SafetyCancel">Cancelar</button><button class="btn primary">Salvar ficha</button></div></form></div>`;document.body.appendChild(back);q('#v40SafetyClose',back).onclick=q('#v40SafetyCancel',back).onclick=()=>back.remove();q('#v40SafetyForm',back).onsubmit=async e=>{e.preventDefault();const f=e.target,stamp=firebase.firestore.FieldValue.serverTimestamp(),waiver=!!f.waiver.checked;try{await ref.set({kind:'safety_profile',trip_id:tripId,reservation_id:resId,responsible_name:r.responsible_name||'',emergency_contact_name:f.emergencyName.value.trim(),emergency_contact_phone:f.emergencyPhone.value.trim(),restriction_notes:f.restriction.value.trim(),allergy_notes:f.allergy.value.trim(),emergency_medication_notes:f.medication.value.trim(),waiver_confirmed:waiver,waiver_version:WAIVER_VERSION,waiver_confirmed_at:waiver?(p.waiver_confirmed_at||stamp):null,updated_at:stamp,updated_by:auth?.currentUser?.email||''},{merge:true});await audit('update','safety_profile',safetyKey(tripId,resId),'Ficha de segurança atualizada.');back.remove();notify('Ficha de segurança salva.','success');renderSafety()}catch(err){q('#v40SafetyMsg',back).innerHTML=`<div class="msg error">${esc(err.message||err)}</div>`}};
}

async function renderWaitlist(){
  if(state.tab!=='waitlistV40')return;const content=q('#content');if(!content)return;q('#pageTitle').textContent='Lista de espera';content.innerHTML='<div class="v40Loading">Carregando lista de espera...</div>';
  try{const rows=await getWaitlist(),trips=(state.trips||[]).filter(t=>t.status==='open').sort((a,b)=>String(a.trip_date||'').localeCompare(String(b.trip_date||'')));content.innerHTML=`<section class="v40Block"><div class="v40Head"><div><span class="eyebrow">LISTA DE ESPERA</span><h2>Fila por passeio</h2><p>Quando surgir vaga, você pode promover a pessoa e o sistema reserva as vagas no passeio.</p></div>${canOperate()?'<button class="btn primary" id="v40WaitAdd">+ Adicionar pessoa</button>':''}</div><div class="v40WaitList">${rows.length?rows.sort((a,b)=>millis(a.created_at)-millis(b.created_at)).map(w=>{const t=(state.trips||[]).find(x=>x.id===w.trip_id);return`<article class="v40WaitRow"><div><strong>${esc(w.name||'Sem nome')}</strong><small>${esc(t?.name||w.trip_name||'Passeio')} • ${n(w.seats)||1} vaga(s) • ${esc(w.phone||w.email||'')}</small></div><span class="v40WaitStatus ${esc(w.status||'waiting')}">${esc(String(w.status||'waiting').toUpperCase())}</span><div class="v40Actions">${w.status==='waiting'&&canManage()?`<button data-v40-promote="${esc(w.id)}">Promover</button>`:''}${w.status==='waiting'&&canOperate()?`<button data-v40-wcancel="${esc(w.id)}">Remover</button>`:''}${w.sale_id?`<button data-v40-wlink="${esc(w.sale_id)}">Link</button>`:''}</div></article>`}).join(''):'<div class="v40Empty">Nenhuma pessoa na lista de espera.</div>'}</div></section>`;q('#v40WaitAdd')?.addEventListener('click',()=>openWaitAdd(trips));qa('[data-v40-promote]',content).forEach(b=>b.onclick=()=>promoteWait(b.dataset.v40Promote));qa('[data-v40-wcancel]',content).forEach(b=>b.onclick=()=>cancelWait(b.dataset.v40Wcancel));qa('[data-v40-wlink]',content).forEach(b=>b.onclick=()=>navigator.clipboard?.writeText(saleUrl(b.dataset.v40Wlink)).then(()=>notify('Link copiado.','success')).catch(()=>window.prompt('Copie o link:',saleUrl(b.dataset.v40Wlink))))}catch(e){content.innerHTML=`<div class="msg error">${esc(e.message||e)}</div>`}
}
function openWaitAdd(trips){if(!canOperate())return;q('#v40WaitModal')?.remove();const back=document.createElement('div');back.id='v40WaitModal';back.className='modalBack';back.innerHTML=`<div class="modal"><form id="v40WaitForm"><div class="modalHead"><div><span class="eyebrow">LISTA DE ESPERA</span><h2>Adicionar pessoa</h2></div><button type="button" class="iconClose" id="v40WaitClose">✕</button></div><div class="modalBody"><div class="grid two"><label class="span2"><span>Passeio</span><select name="trip" required>${trips.map(t=>`<option value="${esc(t.id)}">${esc(t.name)} — ${brDate(t.trip_date)} — ${n(t.remaining_spots)} vaga(s)</option>`).join('')}</select></label><label><span>Nome</span><input name="name" required></label><label><span>Quantidade de vagas</span><input name="seats" type="number" min="1" max="10" value="1" required></label><label><span>WhatsApp</span><input name="phone"></label><label><span>E-mail</span><input name="email" type="email"></label><label class="span2"><span>Observação</span><textarea name="notes" rows="2"></textarea></label></div><div id="v40WaitMsg"></div></div><div class="modalFoot"><button type="button" class="btn ghost" id="v40WaitCancel">Cancelar</button><button class="btn primary">Adicionar à fila</button></div></form></div>`;document.body.appendChild(back);q('#v40WaitClose',back).onclick=q('#v40WaitCancel',back).onclick=()=>back.remove();q('#v40WaitForm',back).onsubmit=async e=>{e.preventDefault();const f=e.target,t=trips.find(x=>x.id===f.trip.value);try{const ref=await db.collection('trips').doc(t.id).collection('operations').add({kind:'waitlist',trip_id:t.id,trip_name:t.name,name:f.name.value.trim(),seats:Math.max(1,Math.min(10,n(f.seats.value))),phone:f.phone.value.trim(),email:f.email.value.trim().toLowerCase(),notes:f.notes.value.trim(),status:'waiting',created_at:firebase.firestore.FieldValue.serverTimestamp(),updated_at:firebase.firestore.FieldValue.serverTimestamp()});await audit('create','waitlist',ref.id,`Adicionado à lista de espera de ${t.name}.`);back.remove();notify('Pessoa adicionada à lista de espera.','success');renderWaitlist()}catch(err){q('#v40WaitMsg',back).innerHTML=`<div class="msg error">${esc(err.message||err)}</div>`}}}
async function cancelWait(id){if(!canOperate())return;try{const w=(await getWaitlist()).find(x=>x.id===id);if(!w)throw Error('Registro não encontrado.');await db.collection('trips').doc(w.trip_id).collection('operations').doc(id).update({status:'cancelled',updated_at:firebase.firestore.FieldValue.serverTimestamp()});await audit('update','waitlist',id,'Pessoa removida da lista de espera.');notify('Removido da fila.','success');renderWaitlist()}catch(e){notify(e.message||e,'error')}}
async function promoteWait(id){
  if(!canManage())return notify('Somente proprietário ou administrador pode reservar vaga da lista de espera.','error');const found=(await getWaitlist()).find(x=>x.id===id);if(!found)return notify('Registro não encontrado.','error');const wref=db.collection('trips').doc(found.trip_id).collection('operations').doc(id),ws=await wref.get();if(!ws.exists)return notify('Registro não encontrado.','error');const w=ws.data(),saleRef=db.collection('sales').doc(),tripRef=db.collection('trips').doc(w.trip_id),resRef=tripRef.collection('reservations').doc(saleRef.id),seats=Math.max(1,n(w.seats));
  try{await db.runTransaction(async tx=>{const ts=await tx.get(tripRef),ws2=await tx.get(wref);if(!ts.exists||!ws2.exists)throw Error('Passeio ou espera não encontrado.');const t=ts.data(),wd=ws2.data();if(wd.status!=='waiting')throw Error('Esta pessoa não está mais aguardando.');if(t.status!=='open')throw Error('Passeio não está aberto.');if(n(t.remaining_spots)<seats)throw Error(`Restam somente ${n(t.remaining_spots)} vaga(s).`);const stamp=firebase.firestore.FieldValue.serverTimestamp(),total=n(t.default_price)*seats,code=protocol(),base={trip_id:w.trip_id,trip_name:t.name,trip_date:t.trip_date,customer_name:w.name,customer_email:w.email||'',seats,sale_total:total,paid_amount:0,balance_due:total,refunded_amount:0,payment_method:'pix',payment_status:'pending',sale_status:'active',registration_status:'pending',claimed_uid:'',protocol:code,source:'waitlist_v40',created_at:stamp,updated_at:stamp};tx.set(saleRef,base);tx.set(resRef,{sale_id:saleRef.id,protocol:code,responsible_name:w.name,email:w.email||'',seats,participants:[],status:'active',registration_status:'pending',payment_status:'pending',payment_method:'pix',sale_total:total,paid_amount:0,balance_due:total,refunded_amount:0,policy_text:t.cancellation_policy||'',policy_version:'2026-09-waitlist-v40',policy_accepted:false,source:'waitlist_v40',created_at:stamp,updated_at:stamp});tx.update(tripRef,{used_spots:n(t.used_spots)+seats,remaining_spots:n(t.remaining_spots)-seats,updated_at:stamp});tx.update(wref,{status:'promoted',sale_id:saleRef.id,promoted_at:stamp,updated_at:stamp})});await audit('promote','waitlist',id,`Lista de espera promovida para venda ${saleRef.id}.`);const link=saleUrl(saleRef.id);try{await navigator.clipboard.writeText(link)}catch(_){ }notify('Vaga reservada. O link de cadastro foi copiado.','success');renderWaitlist()}catch(e){notify(e.message||'Não foi possível promover.','error')}
}

async function mountReports(){
  if(state.tab!=='reports')return;
  const content=q('#content');if(!content||q('#v40OpsReports'))return;
  const trips=(state.trips||[]).filter(t=>t.status!=='cancelled').sort((a,b)=>String(b.trip_date||'').localeCompare(String(a.trip_date||'')));
  const selected=trips.some(t=>t.id===state.reportTripV40)?state.reportTripV40:(trips[0]?.id||'');
  const box=document.createElement('section');box.id='v40OpsReports';box.className='v40Block';
  box.innerHTML=`<div class="v40Head"><div><span class="eyebrow">RELATÓRIOS OPERACIONAIS</span><h2>PDFs específicos para fornecedores</h2><p>Sem CPF, sem e-mail e sem dados de segurança.</p></div></div><div class="v40ReportBar"><select id="v40ReportTrip">${trips.map(t=>`<option value="${esc(t.id)}" ${t.id===selected?'selected':''}>${esc(t.name)} — ${brDate(t.trip_date)}</option>`).join('')}</select><button data-v40-report="bus">Ônibus</button><button data-v40-report="attraction">Atrativo</button><button data-v40-report="hotel">Hospedagem</button><button data-v40-report="internal">Interno</button></div>`;
  content.appendChild(box);
  const select=q('#v40ReportTrip',box);if(select)select.onchange=()=>{state.reportTripV40=select.value};
  qa('[data-v40-report]',box).forEach(b=>b.onclick=()=>generateOperationalPdf(b.dataset.v40Report,select?.value||''));
}
async function reportRows(tripId,type){
  const t=(state.trips||[]).find(x=>x.id===tripId);if(!t)return{t:null,rows:[]};const ss=await db.collection('sales').where('trip_id','==',tripId).get(),sales=new Map(ss.docs.map(d=>[d.id,{id:d.id,...d.data()}])),rows=[{name:GUIDE,type:'GUIA DE TURISMO',method:'',status:''}];
  (state.reservations||[]).filter(r=>r.trip_id===tripId&&r.status!=='cancelled').forEach(r=>{const s=sales.get(r.sale_id||r.id)||{},people=(r.participants||[]).length?r.participants:[{full_name:r.responsible_name||s.customer_name||'Participante'}],option=saleOption(s,r),specific=type==='hotel'?(s.accommodation||r.accommodation||option):type==='attraction'?(s.category||r.category||option):option;people.forEach(p=>rows.push({name:p.full_name||'Participante',type:specific||'Individual',method:PAY[payKind(s.payment_method||r.payment_method)]||'',status:STATUS[s.payment_status||r.payment_status]||s.payment_status||r.payment_status||''}))});return{t,rows};
}
async function generateOperationalPdf(type,tripId){
  try{const {t,rows}=await reportRows(tripId,type);if(!t)return notify('Passeio não encontrado.','error');if(!window.jspdf?.jsPDF)return notify('Gerador de PDF ainda carregando. Tente novamente.','error');const {jsPDF}=window.jspdf,doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'}),titles={bus:'Lista para transporte',attraction:'Lista para atrativo',hotel:'Lista para hospedagem',internal:'Lista interna'};doc.setFont('helvetica','bold');doc.setFontSize(16);doc.text('TRILHEIROS DE RONDONÓPOLIS',14,16);doc.setFontSize(13);doc.text(titles[type]||'Lista de participantes',14,24);doc.setFont('helvetica','normal');doc.setFontSize(10);doc.text(`${t.name} • ${brDate(t.trip_date)} • ${t.destination||''}`,14,31);doc.text(`Total: ${rows.length} pessoa(s) incluindo guia`,14,37);const body=rows.map((r,i)=>type==='internal'?[i+1,r.name,r.type,r.method,r.status]:[i+1,r.name,r.type]);doc.autoTable({startY:43,head:[type==='internal'?['Nº','NOME DO PARTICIPANTE','TIPO / OPÇÃO','PAGAMENTO','STATUS']:['Nº','NOME DO PARTICIPANTE','TIPO / OPÇÃO']],body,styles:{fontSize:9,cellPadding:2.5},headStyles:{fillColor:[7,50,38]},columnStyles:{0:{cellWidth:12}}});doc.save(`trilheiros-${type}-${String(t.name||'passeio').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/gi,'-').toLowerCase()}.pdf`);await audit('export','report',tripId,`PDF operacional ${type} gerado.`)}catch(e){notify(e.message||'Erro ao gerar PDF.','error')}
}

async function mountBackup(){
  if(state.tab!=='settings')return;const content=q('#content');if(!content||q('#v40Backup'))return;const box=document.createElement('section');box.id='v40Backup';box.className='v40Block';box.innerHTML=`<div class="v40Head"><div><span class="eyebrow">BACKUP OPERACIONAL</span><h2>Exportação local segura</h2><p>Baixa uma cópia JSON de passeios, reservas, vendas, despesas e lista de espera. Dados médicos/segurança não são incluídos.</p></div>${canManage()?'<button class="btn primary" id="v40BackupBtn">Exportar backup</button>':''}</div>`;content.appendChild(box);q('#v40BackupBtn')?.addEventListener('click',exportBackup)
}
function stripSensitive(obj){if(Array.isArray(obj))return obj.map(stripSensitive);if(!obj||typeof obj!=='object')return obj;const out={};for(const[k,v]of Object.entries(obj)){if(/cpf|safety|allergy|medication|restriction/i.test(k))continue;out[k]=stripSensitive(v)}return out}
async function exportBackup(){if(!canManage())return;try{const [sales,expenses,waitlist]=await Promise.all([getSales(),getExpenses(),getWaitlist()]),payload={version:'v40',generated_at:new Date().toISOString(),trips:stripSensitive(state.trips||[]),reservations:stripSensitive(state.reservations||[]),sales:stripSensitive(sales),expenses:stripSensitive(expenses),waitlist:stripSensitive(waitlist)};download(`trilheiros-backup-${today()}.json`,JSON.stringify(payload,null,2));await audit('export','backup',today(),'Backup operacional local gerado.');notify('Backup gerado no seu dispositivo.','success')}catch(e){notify(e.message||'Erro ao exportar backup.','error')}}

function guardLockedFinance(){
  const wrap=(name,tripIndex=0)=>{const old=window[name];if(typeof old!=='function'||old.__v40guard)return;const fn=function(...args){const tripId=args[tripIndex],t=(state.trips||[]).find(x=>x.id===tripId);if(t?.financial_locked){notify('Este passeio está com financeiro fechado. Reabra o fechamento antes de alterar custos ou despesas.','error');return}return old.apply(this,args)};fn.__v40guard=true;window[name]=fn;try{globalThis[name]=fn}catch(_){}};
  wrap('expenseModalV36',0);wrap('markExpensePaidV36',0);wrap('deleteExpenseV36',0);
  const oldTrip=window.tripModalV36||window.tripModal;if(typeof oldTrip==='function'&&!oldTrip.__v40guard){const fn=function(id='',...rest){const t=id?(state.trips||[]).find(x=>x.id===id):null;if(t?.financial_locked){notify('Passeio fechado financeiramente. Reabra o fechamento para editar o cadastro/custos.','error');return}return oldTrip.call(this,id,...rest)};fn.__v40guard=true;window.tripModalV36=fn;window.tripModal=fn;try{tripModal=fn}catch(_){}}
}

function renderCustomTab(){if(state.tab==='safetyV40')renderSafety();else if(state.tab==='waitlistV40')renderWaitlist()}
function mount(){injectNav();guardLockedFinance();renderCustomTab();mountExecutive();mountFinanceControl();mountReports();mountBackup()}
const oldRender=window.renderAdmin;
if(typeof oldRender==='function'&&!oldRender.__v40){const wrapped=function(...args){const out=oldRender.apply(this,args);setTimeout(mount,40);return out};wrapped.__v40=true;window.renderAdmin=wrapped;try{renderAdmin=wrapped}catch(_){}}
window.addEventListener('load',()=>setTimeout(mount,120));setTimeout(mount,500);
})();
