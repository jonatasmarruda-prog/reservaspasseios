/* Trilheiros Gestão V42 — camada estável: financeiro premium, pendências automáticas e relatórios externos sem CPF */
(function(){
'use strict';
if(typeof state==='undefined')return;

const q=(s,r=document)=>r.querySelector(s);
const qa=(s,r=document)=>[...r.querySelectorAll(s)];
const n=v=>Math.max(0,Number(v||0)||0);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v||0));
const TZ='America/Cuiaba';
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const monthNow=()=>today().slice(0,7);
const PAY={pix:'PIX',card:'CARTÃO',pix_installment:'PIX PARCELADO',cash:'DINHEIRO',transfer:'TRANSFERÊNCIA',other:'OUTROS'};
const installmentFallback={salto_nuvens:2,nobres_bom_jardim:2,rio_cristalino:3,jaciara_canyon:3};
const GUIDE_NAME='Jonatas Marques de Arruda';
const GUIDE_ROLE='GUIA DE TURISMO';
const LOGO='https://i.postimg.cc/JnF2F9Hw/LOGO-TRILHEIROS-Photoroom.png';
let pendingLoading=false,financeLoading=false;
state.financeMonthV42=state.financeMonthV42||state.financeMonthV41||monthNow();

function norm(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()}
function iso(v){
  if(!v)return'';
  if(typeof v==='string'&&/^\d{4}-\d{2}-\d{2}/.test(v))return v.slice(0,10);
  try{
    const d=typeof v?.toDate==='function'?v.toDate():v?.seconds?new Date(v.seconds*1000):new Date(v);
    if(Number.isNaN(d.getTime()))return'';
    return new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
  }catch{return''}
}
function brDate(v){const s=iso(v);if(!s)return'—';const[y,m,d]=s.split('-');return`${d}/${m}/${y}`}
function monthLabel(m){if(!/^\d{4}-\d{2}$/.test(m))return m;const[y,mo]=m.split('-').map(Number);return new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric',timeZone:TZ}).format(new Date(Date.UTC(y,mo-1,2)))}
function payKind(v){const s=norm(v);if(s.includes('parcel')||s.includes('install'))return'pix_installment';if(s.includes('card')||s.includes('cart'))return'card';if(s.includes('pix'))return'pix';if(s.includes('cash')||s.includes('dinheiro'))return'cash';if(s.includes('transfer'))return'transfer';return'other'}
function optionLabel(v){
  const raw=String(v||'').trim();if(!raw)return'';
  const k=norm(raw).replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
  const map={individual:'Individual',adulto:'Individual',adult:'Individual',casal:'Casal',compartilhado:'Individual • Quarto compartilhado',quarto_compartilhado:'Individual • Quarto compartilhado',casal_sem_banheiro:'Casal • Sem banheiro',casal_com_banheiro:'Casal • Com banheiro',camping:'Camping',crianca:'Criança',child:'Criança',infantil:'Criança',with_transport:'Com transporte',withtransport:'Com transporte',without_transport:'Sem transporte',withouttransport:'Sem transporte'};
  return map[k]||raw.replaceAll('_',' ');
}
function optionOf(s,r){
  const a=r?.registration_answers||{};
  const values=[s?.category,s?.accommodation,s?.participant_type,r?.category,r?.accommodation,r?.participant_type,a?.opcao?.value,a?.tipo?.value,a?.categoria?.value,a?.participacao?.value];
  for(const v of values){const x=optionLabel(v);if(x)return x}
  const seats=Math.max(1,n(s?.seats||r?.seats));return seats===1?'Individual':`${seats} pessoas`;
}
function totalOf(s,r,t){
  for(const v of [s?.sale_total,r?.sale_total])if(n(v)>0)return n(v);
  const composed=n(s?.paid_amount||r?.paid_amount)+n(s?.balance_due||r?.balance_due)-n(s?.refunded_amount||r?.refunded_amount);
  if(composed>0)return composed;
  return n(t?.default_price)*Math.max(1,n(s?.seats||r?.seats));
}
function paidOf(s,r){return Math.max(n(s?.paid_amount),n(r?.paid_amount))}
function installmentCount(s,r){return Math.max(1,Math.round(n(s?.installment_total||r?.installment_total||installmentFallback[s?.trip_id||r?.trip_id]||1)))}
function nextAmount(s,r,t){
  const total=totalOf(s,r,t),paid=paidOf(s,r),bal=Math.max(0,total-paid);
  if(payKind(s?.payment_method||r?.payment_method)==='pix_installment'){
    const part=Math.round(total/installmentCount(s,r)*100)/100;
    return Math.min(bal,part||bal);
  }
  return bal;
}
function notify(msg,type=''){try{return typeof toast==='function'?toast(msg,type):alert(msg)}catch(_){alert(msg)}}
function activeSale(s){return s?.sale_status!=='cancelled'}
function saleTotal(s){return n(s?.sale_total)>0?n(s.sale_total):n(s?.paid_amount)}
function saleBalance(s){if(!activeSale(s))return 0;const b=Number(s?.balance_due);return Number.isFinite(b)?Math.max(0,b):Math.max(0,saleTotal(s)-n(s?.paid_amount))}
function paymentEntries(s){
  if(Array.isArray(s?.payment_history)&&s.payment_history.length){
    return s.payment_history.map(p=>({date:iso(p.date),amount:n(p.amount),method:payKind(p.method||s.payment_method)})).filter(x=>x.date&&x.amount>0);
  }
  const d=iso(s?.received_date||s?.payment_received_date),amount=n(s?.paid_amount);
  return d&&amount>0?[{date:d,amount,method:payKind(s.payment_method)}]:[];
}
function activeSeats(tripId){
  return (state.reservations||[]).filter(r=>r.trip_id===tripId&&r.status!=='cancelled').reduce((a,r)=>a+n(r.seats),0);
}
function expensePaid(e){return !['pending','open','unpaid','to_pay','payable'].includes(String(e?.payment_status||e?.status||'').toLowerCase())}
function expenseMode(e){
  if(e?.cost_mode==='per_person')return'per_person';
  if(e?.cost_mode==='fixed')return'fixed';
  return /aliment|hosped|hotel|camping|seguro|ingresso|entrada|day use|atrativo|refeic|lanche/.test(norm(`${e?.category||''} ${e?.description||''}`))?'per_person':'fixed';
}
function expenseAmount(e){
  const mode=expenseMode(e),unit=n(e?.unit_amount||e?.amount);
  if(mode==='per_person'){
    const qty=expensePaid(e)&&n(e?.quantity_basis)>0?n(e.quantity_basis):activeSeats(e.trip_id);
    return unit*qty;
  }
  return n(e?.amount)>0?n(e.amount):unit;
}
function plannedCost(t,seats){
  const items=Array.isArray(t?.cost_items)?t.cost_items.filter(x=>n(x.amount)>0):[];
  const fixed=items.filter(x=>x.mode!=='per_person').reduce((a,x)=>a+n(x.amount),0);
  const pp=items.filter(x=>x.mode==='per_person').reduce((a,x)=>a+n(x.amount),0);
  return{fixed,pp,total:fixed+pp*seats};
}
async function fetchSales(){
  try{const ss=await db.collection('sales').get();return ss.docs.map(d=>({id:d.id,...d.data()}))}catch(e){console.warn('V42 sales',e);return[]}
}
async function fetchExpenses(){
  try{const es=await db.collection('expenses').get();const rows=es.docs.map(d=>({id:d.id,...d.data()}));state.expenses=rows;return rows}catch(e){console.warn('V42 expenses',e);return state.expenses||[]}
}

function injectStyle(){
  if(q('#v42Style'))return;
  const s=document.createElement('style');s.id='v42Style';s.textContent=`
  .v42Pending{margin:0 0 18px;background:#fff;border:1px solid #dce8e3;border-radius:22px;overflow:hidden;box-shadow:0 12px 35px rgba(7,50,38,.06)}
  .v42Head{padding:19px 20px;border-bottom:1px solid #e5ece8}.v42Head h2{margin:4px 0;font-size:21px}.v42Head p{margin:0;color:#667a72}
  .v42PayList{display:grid}.v42PayRow{width:100%;border:0;border-bottom:1px solid #edf2ef;background:#fff;padding:14px 20px;display:grid;grid-template-columns:1.2fr 1.15fr .7fr .8fr .8fr auto;gap:12px;align-items:center;text-align:left;cursor:pointer}
  .v42PayRow:last-child{border-bottom:0}.v42PayRow:hover{background:#f7faf8}.v42PayRow small{display:block;color:#72827c;margin-top:3px}.v42PayRow b{color:#073226}
  .v42Tag{font-size:10px;font-weight:900;padding:6px 8px;border-radius:9px;background:#fff2d8;color:#7c5713;text-align:center}.v42Go{border:0;border-radius:10px;background:#073e2f;color:#fff;font-weight:900;padding:10px 12px}
  .v42Empty{padding:18px 20px;color:#63766e}.v42Hint{margin:12px 20px 18px;padding:11px 13px;border-radius:12px;background:#eef6f2;color:#37584c;font-size:12px}
  .v42Finance{display:grid;gap:16px;margin-bottom:18px}.v42FinanceHero{border-radius:24px;padding:21px;background:linear-gradient(135deg,#073226,#0a5a43);color:white;box-shadow:0 18px 44px rgba(7,50,38,.18)}
  .v42FinanceTop{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}.v42FinanceTop h2{font-size:25px;margin:5px 0 4px}.v42FinanceTop p{margin:0;opacity:.82}.v42MonthTools{display:flex;gap:8px;flex-wrap:wrap}
  .v42MonthTools input,.v42MonthTools button{min-height:42px;border-radius:12px;padding:0 12px;border:1px solid rgba(255,255,255,.25);font-weight:800}.v42MonthTools input{background:white;color:#073226}.v42MonthTools button{background:#d8ad42;color:#17352d;cursor:pointer}
  .v42Kpis{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:9px;margin-top:16px}.v42Kpi{padding:13px;border-radius:15px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.11)}
  .v42Kpi span{display:block;font-size:9px;font-weight:900;letter-spacing:.06em;opacity:.75}.v42Kpi strong{display:block;font-size:18px;margin-top:6px}.v42Kpi small{display:block;margin-top:4px;opacity:.7}
  .v42Charts{display:grid;grid-template-columns:.9fr 1.15fr 1.15fr;gap:14px}.v42Chart{background:white;border:1px solid #dbe7e2;border-radius:20px;padding:17px}.v42Chart h3{margin:3px 0 4px}.v42Chart>p{margin:0 0 14px;color:#6a7d75;font-size:12px}
  .v42DonutWrap{display:grid;grid-template-columns:135px 1fr;gap:15px;align-items:center}.v42Donut{width:128px;height:128px;border-radius:50%;position:relative}.v42Donut:after{content:'';position:absolute;inset:25px;border-radius:50%;background:white}.v42DonutCenter{position:absolute;inset:0;display:grid;place-items:center;z-index:1;text-align:center}.v42DonutCenter b{font-size:15px;color:#073226}.v42Legend{display:grid;gap:7px}.v42Legend div{display:flex;justify-content:space-between;gap:8px;font-size:11px}.v42Legend span{color:#687b73}.v42Legend b{color:#073226}
  .v42Bars{display:grid;gap:9px}.v42Bar{display:grid;grid-template-columns:115px 1fr 88px;gap:8px;align-items:center}.v42Bar span{font-size:11px;color:#60746b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.v42Bar>div{height:10px;border-radius:999px;background:#e8efec;overflow:hidden}.v42Bar i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#0b6a4d,#d8ad42)}.v42Bar b{text-align:right;font-size:11px;color:#073226}
  .v42TripPerf{display:grid;gap:9px}.v42Perf{border:1px solid #e3ece8;border-radius:13px;padding:11px}.v42PerfHead{display:flex;justify-content:space-between;gap:10px}.v42PerfHead strong{color:#073226}.v42PerfHead span{font-size:11px;color:#697d75}.v42PerfBar{height:8px;background:#edf2ef;border-radius:999px;overflow:hidden;margin:8px 0}.v42PerfBar i{display:block;height:100%;background:#0b6a4d}.v42PerfNums{display:flex;justify-content:space-between;gap:8px;font-size:10px;color:#6c7e77}
  .v42FinanceNote{background:#fffdf5;border:1px solid #ead9a6;border-radius:15px;padding:12px 14px;color:#66531a;font-size:12px}
  .v41Top{display:none!important}
  @media(max-width:1150px){.v42Kpis{grid-template-columns:repeat(4,1fr)}.v42Charts{grid-template-columns:1fr 1fr}.v42Chart:last-child{grid-column:1/-1}}
  @media(max-width:760px){.v42PayRow{grid-template-columns:1fr 1fr}.v42Go{grid-column:1/-1}.v42FinanceTop{flex-direction:column}.v42Kpis{grid-template-columns:1fr 1fr}.v42Charts{grid-template-columns:1fr}.v42Chart:last-child{grid-column:auto}.v42DonutWrap{grid-template-columns:1fr}.v42Donut{margin:auto}.v42Bar{grid-template-columns:90px 1fr 80px}}
  `;
  document.head.appendChild(s);
}
injectStyle();

function patchNewTrip(){
  const b=q('#newTrip');if(!b)return;
  b.onclick=e=>{
    e?.preventDefault();e?.stopPropagation();
    if(!['owner','admin'].includes(state?.role||''))return notify('Seu perfil não pode criar passeios.','error');
    if(typeof window.tripModalV36==='function')return window.tripModalV36();
    if(typeof window.tripModal==='function')return window.tripModal();
    notify('Cadastro de passeio indisponível. Recarregue a página.','error');
  };
  b.dataset.v42='1';
}
function patchFinanceNav(){
  const b=q('[data-tab="finance"]');if(!b)return;
  b.onclick=e=>{e?.preventDefault();state.tab='finance';if(typeof window.renderAdmin==='function')window.renderAdmin()};
  b.dataset.v42='1';
}

async function loadPendingSales(){
  try{
    const ss=await db.collection('sales').orderBy('created_at','desc').limit(500).get();
    return ss.docs.map(d=>({id:d.id,...d.data()})).filter(s=>activeSale(s)&&['pending','partial'].includes(String(s.payment_status||'pending')));
  }catch(e){console.warn('V42 pending sales',e);return[]}
}
async function reservationForSale(s){
  const local=(state.reservations||[]).find(r=>r.trip_id===s.trip_id&&(r.id===s.id||r.sale_id===s.id));if(local)return local;
  try{
    const rs=await db.collection('trips').doc(s.trip_id).collection('reservations').doc(s.id).get();
    if(!rs.exists)return null;
    const row={id:rs.id,trip_id:s.trip_id,...rs.data()};
    state.reservations=state.reservations||[];
    if(!state.reservations.some(r=>r.trip_id===row.trip_id&&r.id===row.id))state.reservations.push(row);
    return row;
  }catch(_){return null}
}
async function mountPending(){
  if(state.tab!=='pending'||pendingLoading)return;
  const content=q('#content');if(!content)return;
  pendingLoading=true;
  try{
    const sales=await loadPendingSales();if(state.tab!=='pending')return;
    q('#v42Pending')?.remove();
    const rows=[];
    for(const s of sales){
      const r=await reservationForSale(s),t=(state.trips||[]).find(x=>x.id===s.trip_id),method=payKind(s.payment_method||r?.payment_method),total=totalOf(s,r,t),paid=paidOf(s,r),next=nextAmount(s,r,t),option=optionOf(s,r),name=s.customer_name||r?.responsible_name||r?.participants?.[0]?.full_name||'Cliente',people=(r?.participants?.length?r.participants:s?.participants||[]).map(p=>p?.full_name).filter(Boolean);
      rows.push({s,r,t,method,total,paid,next,option,name,people});
    }
    const box=document.createElement('section');box.id='v42Pending';box.className='v42Pending';
    box.innerHTML=`<div class="v42Head"><span class="eyebrow">PAGAMENTOS DO SITE</span><h2>Conferir e confirmar</h2><p>Forma de pagamento, opção e valores já são puxados automaticamente da reserva. Você apenas confere o recebimento e confirma.</p></div>${rows.length?`<div class="v42PayList">${rows.map(x=>`<button class="v42PayRow" data-v42-sale="${esc(x.s.id)}" data-v42-trip="${esc(x.s.trip_id)}"><div><b>${esc(x.name)}</b><small>${esc(x.people.join(' • ')||x.option)}</small></div><div><b>${esc(x.t?.name||x.s.trip_name||'Passeio')}</b><small>${esc(x.option)} • ${Math.max(1,n(x.s.seats||x.r?.seats))} vaga(s)</small></div><div><span class="v42Tag">${esc(PAY[x.method]||'OUTROS')}</span></div><div><small>RESERVA</small><b>${money(x.total)}</b></div><div><small>${x.method==='pix_installment'?'PRÓX. PARCELA':'A CONFERIR'}</small><b>${money(x.next)}</b>${x.paid>0?`<small>já confirmado ${money(x.paid)}</small>`:''}</div><span class="v42Go">Conferir</span></button>`).join('')}</div><div class="v42Hint">Importante: o clique em PIX/cartão registra automaticamente a opção e o valor escolhido. Como o pagamento acontece fora do Gestão, o valor só vira “recebido” depois da sua confirmação ou de webhook bancário validado.</div>`:'<div class="v42Empty">Nenhum pagamento pendente no momento.</div>'}`;
    const first=content.firstElementChild;first?content.insertBefore(box,first):content.appendChild(box);
    qa('[data-v42-sale]',box).forEach(b=>b.onclick=async()=>{
      const saleId=b.dataset.v42Sale,tripId=b.dataset.v42Trip,s=rows.find(x=>x.s.id===saleId),r=s?.r||await reservationForSale(s?.s||{id:saleId,trip_id:tripId});
      if(r&&typeof window.openSyncedReservationV35==='function')return window.openSyncedReservationV35(tripId,r.id);
      if(typeof window.openPaymentV22==='function')return window.openPaymentV22(saleId);
      notify('Não foi possível abrir esta pendência.','error');
    });
    qa('.pendingList .pendingItem').forEach(el=>{
      const tag=norm(q('span',el)?.textContent||'');
      if(tag.includes('pagamento')||el.dataset.v32Payment==='1')el.style.display='none';
    });
  }finally{pendingLoading=false}
}

function monthFinance(sales,expenses,month){
  const active=sales.filter(activeSale);
  const monthSales=active.filter(s=>iso(s.created_at||s.trip_date).slice(0,7)===month);
  const billed=monthSales.reduce((a,s)=>a+saleTotal(s),0);
  const soldSeats=monthSales.reduce((a,s)=>a+n(s.seats),0);
  const payments=[];active.forEach(s=>paymentEntries(s).forEach(p=>{if(p.date.slice(0,7)===month)payments.push({...p,sale:s})}));
  const received=payments.reduce((a,p)=>a+p.amount,0);
  const payBreak={pix:0,card:0,pix_installment:0,cash:0,transfer:0,other:0};payments.forEach(p=>payBreak[p.method]=(payBreak[p.method]||0)+p.amount);
  const paidExpenses=expenses.filter(e=>expensePaid(e)&&iso(e.paid_date||e.expense_date||e.updated_at||e.created_at).slice(0,7)===month);
  const openExpenses=expenses.filter(e=>!expensePaid(e)&&iso(e.due_date||e.expense_date||e.created_at).slice(0,7)===month);
  const paidOut=paidExpenses.reduce((a,e)=>a+expenseAmount(e),0),toPay=openExpenses.reduce((a,e)=>a+expenseAmount(e),0);
  const receivable=active.reduce((a,s)=>a+saleBalance(s),0);
  const expenseCats={};paidExpenses.forEach(e=>{const k=e.category||'Outros';expenseCats[k]=(expenseCats[k]||0)+expenseAmount(e)});
  const soldByTrip={};monthSales.forEach(s=>{const k=s.trip_id||'sem';if(!soldByTrip[k])soldByTrip[k]={value:0,seats:0};soldByTrip[k].value+=saleTotal(s);soldByTrip[k].seats+=n(s.seats)});
  const trips=(state.trips||[]).filter(t=>String(t.trip_date||'').slice(0,7)===month&&t.status!=='cancelled').map(t=>{
    const ss=active.filter(s=>s.trip_id===t.id),seats=Math.max(activeSeats(t.id),ss.reduce((a,s)=>a+n(s.seats),0)),sold=ss.reduce((a,s)=>a+saleTotal(s),0),got=ss.reduce((a,s)=>a+n(s.paid_amount)-n(s.refunded_amount),0),ee=expenses.filter(e=>e.trip_id===t.id),paid=ee.filter(expensePaid).reduce((a,e)=>a+expenseAmount(e),0),open=ee.filter(e=>!expensePaid(e)).reduce((a,e)=>a+expenseAmount(e),0),planned=plannedCost(t,seats);
    return{t,seats,sold,got,paid,open,planned,result:sold-(paid+open)};
  }).sort((a,b)=>b.sold-a.sold);
  return{month,billed,soldSeats,received,paidOut,toPay,receivable,cash:received-paidOut,payBreak,expenseCats,soldByTrip,trips};
}
function bars(obj){
  const entries=Object.entries(obj).map(([k,v])=>[k,n(v)]).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).slice(0,7);
  const max=Math.max(1,...entries.map(([,v])=>v));
  return entries.length?entries.map(([k,v])=>`<div class="v42Bar"><span title="${esc(k)}">${esc(k)}</span><div><i style="width:${Math.max(3,v/max*100)}%"></i></div><b>${money(v)}</b></div>`).join(''):'<div class="v42Empty">Sem movimentação no período.</div>';
}
function donut(payBreak,total){
  const keys=['pix','card','pix_installment','cash','transfer','other'],colors=['#20a26f','#d8ad42','#6d59c5','#3994c4','#e68145','#9aa7a1'];
  let acc=0,parts=[];keys.forEach((k,i)=>{const v=n(payBreak[k]);if(!v||!total)return;const a=acc/total*360;acc+=v;const b=acc/total*360;parts.push(`${colors[i]} ${a}deg ${b}deg`)});
  const style=parts.length?`background:conic-gradient(${parts.join(',')})`:'background:#e7efeb';
  return `<div class="v42DonutWrap"><div class="v42Donut" style="${style}"><div class="v42DonutCenter"><b>${money(total)}</b></div></div><div class="v42Legend">${keys.filter(k=>n(payBreak[k])>0).map(k=>`<div><span>${PAY[k]}</span><b>${money(payBreak[k])}</b></div>`).join('')||'<span>Sem recebimentos</span>'}</div></div>`;
}
async function mountFinanceDashboard(){
  if(state.tab!=='finance'||financeLoading)return;
  const content=q('#content');if(!content)return;
  financeLoading=true;
  try{
    const [sales,expenses]=await Promise.all([fetchSales(),fetchExpenses()]);if(state.tab!=='finance')return;
    const month=state.financeMonthV42||monthNow(),d=monthFinance(sales,expenses,month);
    const root=q('#v41Finance',content)||content;
    q('#v42FinanceDash')?.remove();
    const box=document.createElement('section');box.id='v42FinanceDash';box.className='v42Finance';
    box.innerHTML=`<section class="v42FinanceHero"><div class="v42FinanceTop"><div><span class="eyebrow">FINANCEIRO • VISÃO EXECUTIVA</span><h2>${esc(monthLabel(month))}</h2><p>Entradas, despesas, lucro, vendas e desempenho dos passeios em uma visão única.</p></div><div class="v42MonthTools"><input id="v42Month" type="month" value="${esc(month)}"><button id="v42MonthlyReport">RELATÓRIO MENSAL</button></div></div><div class="v42Kpis"><article class="v42Kpi"><span>FATURADO</span><strong>${money(d.billed)}</strong><small>vendas registradas</small></article><article class="v42Kpi"><span>RECEBIDO</span><strong>${money(d.received)}</strong><small>dinheiro confirmado</small></article><article class="v42Kpi"><span>DESPESAS PAGAS</span><strong>${money(d.paidOut)}</strong><small>saídas do mês</small></article><article class="v42Kpi"><span>LUCRO / CAIXA</span><strong>${money(d.cash)}</strong><small>recebido - despesas</small></article><article class="v42Kpi"><span>CONTAS A PAGAR</span><strong>${money(d.toPay)}</strong><small>vencimentos do mês</small></article><article class="v42Kpi"><span>A RECEBER</span><strong>${money(d.receivable)}</strong><small>saldo de clientes</small></article><article class="v42Kpi"><span>VAGAS VENDIDAS</span><strong>${d.soldSeats}</strong><small>reservas criadas no mês</small></article></div></section><div class="v42Charts"><section class="v42Chart"><span class="eyebrow">RECEBIMENTOS</span><h3>Formas de pagamento</h3><p>Valores efetivamente confirmados no período.</p>${donut(d.payBreak,d.received)}</section><section class="v42Chart"><span class="eyebrow">DESPESAS</span><h3>Custos pagos por categoria</h3><p>Somente despesas efetivamente pagas no mês.</p><div class="v42Bars">${bars(d.expenseCats)}</div></section><section class="v42Chart"><span class="eyebrow">PASSEIOS</span><h3>Resultado por viagem</h3><p>Venda total do passeio versus despesas lançadas.</p><div class="v42TripPerf">${d.trips.length?d.trips.slice(0,7).map(x=>{const denom=Math.max(1,x.sold,x.paid+x.open),pct=Math.max(3,Math.min(100,x.sold/denom*100));return `<div class="v42Perf"><div class="v42PerfHead"><strong>${esc(x.t.name)}</strong><span>${x.seats} pessoa(s)</span></div><div class="v42PerfBar"><i style="width:${pct}%"></i></div><div class="v42PerfNums"><span>Vendido ${money(x.sold)}</span><span>Despesas ${money(x.paid+x.open)}</span><b>Resultado ${money(x.result)}</b></div></div>`}).join(''):'<div class="v42Empty">Nenhum passeio nesta competência.</div>'}</div></section></div><div class="v42FinanceNote"><b>Despesas organizadas por passeio:</b> para cadastrar ou consultar custos, use a lista “Passeios” logo abaixo e clique em <b>Abrir despesas</b>. Custos POR PESSOA multiplicam automaticamente a quantidade de clientes; VALOR TOTAL entra apenas uma vez.</div>`;
    const tripsSection=q('.v41Trips',root);
    tripsSection?root.insertBefore(box,tripsSection):root.insertBefore(box,root.firstChild);
    q('#v42Month',box).onchange=e=>{state.financeMonthV42=e.target.value||monthNow();state.financeMonthV41=state.financeMonthV42;mountFinanceDashboard()};
    q('#v42MonthlyReport',box).onclick=()=>typeof window.openMonthlyReportV34==='function'?window.openMonthlyReportV34(state.financeMonthV42):notify('Relatório mensal indisponível.','error');
  }finally{financeLoading=false}
}

async function saleForReservation(r){
  const id=r?.sale_id||r?.id;if(!id)return null;
  try{const s=await db.collection('sales').doc(id).get();return s.exists?{id:s.id,...s.data()}:null}catch(_){return null}
}
async function reportPeople(tripId){
  const out=[{key:'guide',name:GUIDE_NAME,type:GUIDE_ROLE}];
  const rs=(state.reservations||[]).filter(r=>r.trip_id===tripId&&r.status!=='cancelled');
  for(const r of rs){
    const sale=await saleForReservation(r),type=optionOf(sale,r),ps=(r.participants||sale?.participants||[]).filter(p=>p?.full_name);
    if(ps.length)ps.forEach((p,i)=>out.push({key:String(p.cpf||`${r.id}-${i}`).replace(/\D/g,'')||`${r.id}-${i}`,name:p.full_name,type}));
    else if(r.responsible_name||sale?.customer_name)out.push({key:r.id,name:r.responsible_name||sale.customer_name,type});
  }
  return out;
}
async function waitPdf(){for(let i=0;i<60;i++){if(window.jspdf?.jsPDF)return true;try{if(typeof ensurePdfLibraries==='function')await ensurePdfLibraries()}catch(_){ }await new Promise(r=>setTimeout(r,100))}return false}
async function logoData(){try{const resp=await fetch(LOGO),blob=await resp.blob();return await new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>res(fr.result);fr.onerror=rej;fr.readAsDataURL(blob)})}catch{return null}}
function slug(v){return String(v||'passeio').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}
async function createPeoplePdf(tripId,title='LISTA DE PARTICIPANTES',extraColumns=[]){
  const t=(state.trips||[]).find(x=>x.id===tripId);if(!t)throw Error('Passeio não encontrado.');
  if(!await waitPdf())throw Error('Biblioteca PDF indisponível.');
  const people=await reportPeople(tripId),opsSnap=extraColumns.length?await db.collection('trips').doc(tripId).collection('operations').get().catch(()=>null):null,ops={};
  opsSnap?.docs?.forEach(d=>ops[d.id]=d.data());
  const {jsPDF}=window.jspdf,doc=new jsPDF({unit:'mm',format:'a4'}),logo=await logoData();
  doc.setFillColor(7,50,38);doc.rect(0,0,210,54,'F');doc.setFillColor(216,173,66);doc.rect(0,54,210,2,'F');
  if(logo)try{doc.addImage(logo,'PNG',14,8,30,30)}catch(_){}
  doc.setTextColor(255);doc.setFont('helvetica','bold');doc.setFontSize(10);doc.text('TRILHEIROS DE RONDONÓPOLIS',logo?51:14,16);doc.setFontSize(19);doc.text(title,logo?51:14,28);doc.setFontSize(9);doc.setFont('helvetica','normal');doc.text(`${String(t.name||'')} • ${brDate(t.trip_date)}`,logo?51:14,39);doc.text(`${people.length} pessoa(s) incluindo guia`,logo?51:14,46);
  const head=['Nº','NOME DO PARTICIPANTE','TIPO / OPÇÃO',...extraColumns.map(x=>x.label)];
  const body=people.map((p,i)=>{const op=ops[p.key]||{};return[String(i+1).padStart(2,'0'),p.name,p.type,...extraColumns.map(x=>op[x.key]||'—')]});
  const widths=extraColumns.length?{0:{cellWidth:12},1:{cellWidth:73},2:{cellWidth:48}}:{0:{cellWidth:14},1:{cellWidth:105},2:{cellWidth:63}};
  doc.autoTable({startY:66,head:[head],body,theme:'grid',styles:{font:'helvetica',fontSize:8.5,cellPadding:2.7,textColor:[25,48,40],lineColor:[220,231,226],lineWidth:.15},headStyles:{fillColor:[7,50,38],textColor:[255,255,255],fontStyle:'bold'},columnStyles:widths,margin:{left:14,right:14,bottom:16},didParseCell:data=>{if(data.section==='body'&&data.row.index===0){data.cell.styles.fillColor=[248,241,215];data.cell.styles.fontStyle='bold'}},didDrawPage:data=>{doc.setFontSize(7);doc.setTextColor(110);doc.text(`Trilheiros de Rondonópolis • sem CPF • ${t.name}`,14,291);doc.text(`Página ${data.pageNumber}`,194,291,{align:'right'})}});
  return{doc,t};
}
window.pdfTrip=async function(id){
  if(!id)return notify('Selecione um passeio.','error');
  try{const {doc,t}=await createPeoplePdf(id,'LISTA DE PARTICIPANTES');const filename=`lista-participantes-${slug(t.name)}-${iso(t.trip_date)}.pdf`;if(typeof window.openPdfPreviewV14==='function')window.openPdfPreviewV14(doc,{filename,title:'Lista de participantes',subtitle:`${t.name} • nome e tipo/opção • sem CPF`,shareText:`Lista de participantes — ${t.name}`});else doc.save(filename)}catch(e){console.error('V42 PDF',e);notify(e.message||'Não foi possível gerar o relatório.','error')}
};
try{pdfTrip=window.pdfTrip}catch(_){}

window.driverPdfV7=async function(id){
  if(!id)return notify('Selecione um passeio.','error');
  try{const {doc,t}=await createPeoplePdf(id,'LISTA PARA TRANSPORTE',[{label:'VEÍCULO',key:'vehicle'},{label:'ASSENTO',key:'seat'}]);const filename=`transporte-${slug(t.name)}-${iso(t.trip_date)}.pdf`;if(typeof window.openPdfPreviewV14==='function')window.openPdfPreviewV14(doc,{filename,title:'Lista para transporte',subtitle:`${t.name} • sem CPF`,shareText:`Lista para transporte — ${t.name}`});else doc.save(filename)}catch(e){notify(e.message||'Não foi possível gerar a lista.','error')}
};
try{driverPdfV7=window.driverPdfV7}catch(_){}

window.roomsPdfV7=async function(id){
  if(!id)return notify('Selecione um passeio.','error');
  try{const {doc,t}=await createPeoplePdf(id,'MAPA DE HOSPEDAGEM',[{label:'QUARTO',key:'room'}]);const filename=`hospedagem-${slug(t.name)}-${iso(t.trip_date)}.pdf`;if(typeof window.openPdfPreviewV14==='function')window.openPdfPreviewV14(doc,{filename,title:'Mapa de hospedagem',subtitle:`${t.name} • nome e tipo/opção • sem CPF`,shareText:`Mapa de hospedagem — ${t.name}`});else doc.save(filename)}catch(e){notify(e.message||'Não foi possível gerar o mapa.','error')}
};
try{roomsPdfV7=window.roomsPdfV7}catch(_){}

function patchReports(){
  if(state.tab!=='reports')return;
  const cards=q('.reportCards');if(!cards)return;
  const buttons=qa('button',cards);
  buttons.forEach(b=>{
    const title=norm(q('strong',b)?.textContent||'');
    const small=q('small',b);
    if(title.includes('lista oficial de participantes')){
      q('strong',b).textContent='Lista para ônibus / atrativos';
      if(small)small.textContent='Somente Nº, nome do participante e tipo/opção escolhida. Sem CPF e sem “responsável”.';
    }else if(title.includes('mapa de hospedagem')){
      if(small)small.textContent='Nome, tipo/opção e quarto. Sem CPF.';
    }else if(title.includes('lista de transporte')){
      if(small)small.textContent='Nome, tipo/opção, veículo e assento. Sem CPF.';
    }else if(title.includes('lista para seguro')){
      if(small)small.textContent='Lista separada com CPF somente quando a seguradora exigir.';
    }
  });
}

function patch(){
  if(!location.pathname.startsWith('/admin'))return;
  patchNewTrip();patchFinanceNav();patchReports();
  if(state.tab==='pending')setTimeout(()=>mountPending().catch(()=>{}),50);
  if(state.tab==='finance')setTimeout(()=>mountFinanceDashboard().catch(()=>{}),150);
}

const oldRender=window.renderAdmin;
if(typeof oldRender==='function'){
  window.renderAdmin=function(...args){const out=oldRender.apply(this,args);setTimeout(patch,20);setTimeout(patch,180);return out};
  try{renderAdmin=window.renderAdmin}catch(_){}
}
const obs=new MutationObserver(()=>{if(location.pathname.startsWith('/admin'))patch()});
obs.observe(document.body,{childList:true,subtree:true});
window.addEventListener('load',patch);
setInterval(()=>{if(state.tab==='pending'&&!q('#v42Pending'))patch();if(state.tab==='finance'&&!q('#v42FinanceDash'))patch()},900);
setTimeout(patch,300);
})();