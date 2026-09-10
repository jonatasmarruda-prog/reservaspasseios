/* Trilheiros Gestão V41 — Financeiro por passeio sem mistura + custo por pessoa explícito */
(function(){
'use strict';
if(typeof state==='undefined') return;

const q=(s,r=document)=>r.querySelector(s);
const qa=(s,r=document)=>[...r.querySelectorAll(s)];
const n=v=>Math.max(0,Number(v||0)||0);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v||0));
const TZ='America/Cuiaba';
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const monthNow=()=>today().slice(0,7);
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const brDate=v=>{const s=String(v||'').slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return s||'—';const[y,m,d]=s.split('-');return `${d}/${m}/${y}`};
const monthLabel=m=>{if(!/^\d{4}-\d{2}$/.test(m))return m;const[y,mo]=m.split('-').map(Number);return new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric',timeZone:TZ}).format(new Date(Date.UTC(y,mo-1,2)))};
const payKind=v=>{const s=norm(v);if(s.includes('parcel')||s.includes('install'))return'pix_installment';if(s.includes('card')||s.includes('cart'))return'card';if(s.includes('pix'))return'pix';if(s.includes('cash')||s.includes('dinheiro'))return'cash';if(s.includes('transfer'))return'transfer';return'other'};
const PAY={pix:'PIX',card:'Cartão',pix_installment:'PIX parcelado',cash:'Dinheiro',transfer:'Transferência',other:'Outros'};

state.financeMonthV41=state.financeMonthV41||monthNow();

function notify(msg,type=''){
  try{return typeof toast==='function'?toast(msg,type):alert(msg)}catch(_){alert(msg)}
}
function activeSale(s){return s?.sale_status!=='cancelled'}
function saleTotal(s){return n(s?.sale_total)>0?n(s.sale_total):n(s?.paid_amount)}
function paidNet(s){return Math.max(0,n(s?.paid_amount)-n(s?.refunded_amount))}
function saleBalance(s){
  if(s?.sale_status==='cancelled')return 0;
  const b=Number(s?.balance_due);
  return Number.isFinite(b)?Math.max(0,b):Math.max(0,saleTotal(s)-n(s?.paid_amount));
}
function paymentEntries(s){
  if(Array.isArray(s?.payment_history)&&s.payment_history.length){
    return s.payment_history.map(p=>({date:String(p.date||'').slice(0,10),amount:n(p.amount),method:payKind(p.method||s.payment_method)})).filter(x=>x.amount>0&&x.date);
  }
  const d=String(s?.received_date||s?.payment_received_date||'').slice(0,10);
  const amount=n(s?.paid_amount);
  return amount>0&&d?[{date:d,amount,method:payKind(s.payment_method)}]:[];
}
function activeSeats(tripId){
  return (state.reservations||[]).filter(r=>r.trip_id===tripId&&r.status!=='cancelled').reduce((s,r)=>s+n(r.seats),0);
}
function inferMode(e){
  if(e?.cost_mode==='per_person')return'per_person';
  if(e?.cost_mode==='fixed')return'fixed';
  const s=norm(`${e?.category||''} ${e?.description||''}`);
  if(/aliment|hosped|hotel|camping|seguro|ingresso|entrada|day use|atrativo|taxa por pessoa|refeic|lanche/.test(s))return'per_person';
  return'fixed';
}
function expensePaid(e){
  const raw=String(e?.payment_status||e?.status||'').toLowerCase();
  if(!raw)return true;
  return !['pending','open','unpaid','to_pay','payable'].includes(raw);
}
function unitAmount(e){
  if(n(e?.unit_amount)>0)return n(e.unit_amount);
  return n(e?.amount);
}
function expenseCalc(e,seats){
  const mode=inferMode(e),unit=unitAmount(e),legacy=!['per_person','fixed'].includes(e?.cost_mode);
  if(mode==='per_person'){
    let qty=seats;
    if(!legacy && expensePaid(e) && n(e?.quantity_basis)>0)qty=n(e.quantity_basis);
    const total=unit*Math.max(0,qty);
    return{mode,unit,qty,total,legacy};
  }
  return{mode,unit,qty:1,total:n(e?.amount)>0?n(e.amount):unit,legacy};
}
function plannedItems(t){
  if(Array.isArray(t?.cost_items)&&t.cost_items.length){
    return t.cost_items.filter(x=>n(x.amount)>0).map(x=>({
      category:String(x.category||'Despesa'),
      mode:x.mode==='per_person'?'per_person':'fixed',
      amount:n(x.amount)
    }));
  }
  return [
    ['Ônibus / Transporte','fixed',t?.cost_bus_fixed],
    ['Guia / Condutor','fixed',t?.cost_guide_fixed],
    ['Outros custos fixos','fixed',t?.cost_other_fixed],
    ['Hospedagem','per_person',t?.cost_lodging_per_person],
    ['Atrativo / Day Use','per_person',t?.cost_activity_per_person],
    ['Alimentação','per_person',t?.cost_food_per_person],
    ['Seguro','per_person',t?.cost_insurance_per_person],
    ['Outros por pessoa','per_person',t?.cost_other_per_person]
  ].filter(x=>n(x[2])>0).map(([category,mode,amount])=>({category,mode,amount:n(amount)}));
}
function plannedCost(t,seats){
  const items=plannedItems(t),fixed=items.filter(x=>x.mode==='fixed').reduce((s,x)=>s+n(x.amount),0),pp=items.filter(x=>x.mode==='per_person').reduce((s,x)=>s+n(x.amount),0);
  return{items,fixed,pp,total:fixed+pp*seats};
}
async function fetchSales(){
  try{const s=await db.collection('sales').get();return s.docs.map(d=>({id:d.id,...d.data()}))}catch(_){return[]}
}
async function fetchExpenses(){
  try{const s=await db.collection('expenses').get();const arr=s.docs.map(d=>({id:d.id,...d.data()}));state.expenses=arr;return arr}catch(_){return state.expenses||[]}
}
function tripFinance(t,sales,expenses){
  const ss=sales.filter(s=>s.trip_id===t.id&&activeSale(s));
  const seats=Math.max(activeSeats(t.id),ss.reduce((a,s)=>a+n(s.seats),0));
  const sold=ss.reduce((a,s)=>a+saleTotal(s),0);
  const received=ss.reduce((a,s)=>a+paidNet(s),0);
  const receivable=ss.reduce((a,s)=>a+saleBalance(s),0);
  const planned=plannedCost(t,seats);
  const ee=expenses.filter(e=>e.trip_id===t.id);
  const paid=ee.filter(expensePaid).reduce((a,e)=>a+expenseCalc(e,seats).total,0);
  const open=ee.filter(e=>!expensePaid(e)).reduce((a,e)=>a+expenseCalc(e,seats).total,0);
  const actual=paid+open;
  const result=sold-actual;
  return{ss,seats,sold,received,receivable,planned,expenses:ee,paid,open,actual,result};
}
function selectedMonthSales(sales,month){
  return sales.filter(activeSale).filter(s=>{
    const d=String(s.created_at?.toDate?new Intl.DateTimeFormat('en-CA',{timeZone:TZ}).format(s.created_at.toDate()):(s.created_at||s.trip_date||'')).slice(0,7);
    return d===month;
  });
}
function monthlySummary(sales,expenses,month){
  const ms=selectedMonthSales(sales,month);
  const billed=ms.reduce((a,s)=>a+saleTotal(s),0);
  let income=0;const pay={pix:0,card:0,pix_installment:0,cash:0,transfer:0,other:0};
  sales.filter(activeSale).forEach(s=>paymentEntries(s).forEach(p=>{if(String(p.date).slice(0,7)===month){income+=p.amount;pay[p.method]=(pay[p.method]||0)+p.amount}}));
  const trips=(state.trips||[]).filter(t=>String(t.trip_date||'').slice(0,7)===month&&t.status!=='cancelled');
  let paidOut=0,toPay=0,projected=0;
  trips.forEach(t=>{const f=tripFinance(t,sales,expenses);paidOut+=f.paid;toPay+=f.open;projected+=f.planned.total});
  const receivable=sales.filter(activeSale).reduce((a,s)=>a+saleBalance(s),0);
  return{billed,income,paidOut,toPay,projected,receivable,cash:income-paidOut,pay};
}

function injectStyle(){
  if(q('#v41Style'))return;
  const s=document.createElement('style');s.id='v41Style';s.textContent=`
  .v41Page{display:grid;gap:18px}.v41Top{background:#fff;border:1px solid #dbe7e2;border-radius:22px;padding:20px}.v41Head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}.v41Head h2{margin:5px 0 5px;font-size:24px}.v41Head p{margin:0;color:#62766e}.v41Month{min-height:44px;border:1px solid #cadad3;border-radius:12px;padding:0 12px;background:#fff;font-weight:800}
  .v41Kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;margin-top:16px}.v41Kpis article{border-radius:15px;background:#f1f7f4;padding:13px}.v41Kpis span{display:block;font-size:10px;font-weight:900;color:#697d75;letter-spacing:.05em}.v41Kpis strong{display:block;margin-top:6px;font-size:18px;color:#073226}.v41Kpis small{display:block;margin-top:4px;color:#73847d}
  .v41Pay{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:9px;margin-top:12px}.v41Pay div{padding:11px;border:1px solid #dfebe6;border-radius:13px}.v41Pay span{font-size:10px;font-weight:900;color:#6d7e77}.v41Pay b{display:block;margin-top:4px}
  .v41Trips{background:#fff;border:1px solid #dbe7e2;border-radius:22px;padding:20px}.v41TripsHead{display:flex;justify-content:space-between;gap:16px;align-items:center;margin-bottom:12px}.v41TripsHead h2{margin:4px 0}.v41TripsHead p{margin:0;color:#62766e}.v41TripList{display:grid;gap:10px}.v41Trip{border:1px solid #dce8e3;border-radius:16px;padding:15px;display:grid;grid-template-columns:1.2fr 1.8fr auto;gap:14px;align-items:center;background:#fff;cursor:pointer;text-align:left}.v41Trip:hover{border-color:#95c4ae;box-shadow:0 8px 22px rgba(7,50,38,.08)}.v41Trip h3{margin:0 0 4px}.v41Trip small{color:#71817b}.v41TripNums{display:grid;grid-template-columns:repeat(5,minmax(90px,1fr));gap:8px}.v41TripNums span{font-size:9px;font-weight:900;color:#6b7d76}.v41TripNums b{display:block;margin-top:3px;font-size:13px;color:#073226}.v41Open{border:0;border-radius:11px;padding:10px 12px;background:#073e2f;color:white;font-weight:900}
  .v41Modal{max-width:980px}.v41Stats{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:9px;margin-bottom:18px}.v41Stats div{padding:12px;border-radius:14px;background:#f1f7f4}.v41Stats span{display:block;font-size:9px;font-weight:900;color:#6a7d75}.v41Stats strong{display:block;margin-top:5px;font-size:15px}.v41Section{margin-top:20px}.v41SectionHead{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:10px}.v41SectionHead h3{margin:0}.v41Rows{display:grid;gap:8px}.v41Row{border:1px solid #dce8e3;border-radius:14px;padding:12px;display:grid;grid-template-columns:1fr 160px 150px auto;gap:12px;align-items:center}.v41Row h4{margin:0 0 4px}.v41Mode{display:inline-block;padding:4px 7px;border-radius:8px;background:#eaf4ef;font-size:10px;font-weight:900;color:#315c4c}.v41Mode.pp{background:#fff3d6;color:#745411}.v41Formula{display:block;margin-top:5px;color:#687a73;font-size:12px}.v41Amount{font-weight:900;text-align:right}.v41Status{font-size:10px;font-weight:900;padding:6px 8px;border-radius:9px;text-align:center;background:#edf6f2}.v41Status.open{background:#fff2dc;color:#815912}.v41Actions{display:flex;gap:6px}.v41Actions button{border:0;border-radius:9px;padding:8px 9px;cursor:pointer}.v41Actions .ok{background:#def3e7;color:#145f3e}.v41Actions .danger{background:#ffefed;color:#9d3027}
  .v41FormGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.v41FormGrid label span{display:block;font-size:11px;font-weight:900;color:#526b61;margin-bottom:6px}.v41FormGrid input,.v41FormGrid select{width:100%;min-height:45px;border:1px solid #cadad3;border-radius:12px;padding:0 11px;background:#fff}.v41FormGrid .wide{grid-column:1/-1}.v41Calc{margin-top:12px;padding:14px;border-radius:13px;background:#eef6f2}.v41Empty{padding:16px;border-radius:14px;background:#f5f8f6;color:#657871}
  #v30FinanceDash,#v36ExpenseHub,#v34ExpenseHub{display:none!important}
  @media(max-width:1050px){.v41Kpis{grid-template-columns:repeat(3,1fr)}.v41Trip{grid-template-columns:1fr}.v41TripNums{grid-template-columns:repeat(3,1fr)}.v41Stats{grid-template-columns:repeat(3,1fr)}}
  @media(max-width:700px){.v41Head,.v41TripsHead,.v41SectionHead{flex-direction:column;align-items:stretch}.v41Kpis{grid-template-columns:1fr 1fr}.v41Pay{grid-template-columns:1fr 1fr}.v41TripNums{grid-template-columns:1fr 1fr}.v41Stats{grid-template-columns:1fr 1fr}.v41Row{grid-template-columns:1fr}.v41Amount{text-align:left}.v41FormGrid{grid-template-columns:1fr}.v41FormGrid .wide{grid-column:auto}}
  `;
  document.head.appendChild(s);
}
injectStyle();

let rendering=false;
async function renderFinanceV41(){
  if(state.tab!=='finance'||rendering)return;
  const content=q('#content');if(!content)return;
  rendering=true;
  try{
    const [sales,expenses]=await Promise.all([fetchSales(),fetchExpenses()]);
    if(state.tab!=='finance')return;
    const month=state.financeMonthV41||monthNow(),m=monthlySummary(sales,expenses,month);
    const trips=(state.trips||[]).filter(t=>t.status!=='cancelled').sort((a,b)=>String(a.trip_date||'').localeCompare(String(b.trip_date||'')));
    content.innerHTML=`<div id="v30FinanceDash" hidden></div><div id="v36ExpenseHub" hidden></div><div id="v34ExpenseHub" hidden></div>
      <section id="v41Finance" class="v41Page">
        <section class="v41Top">
          <div class="v41Head"><div><span class="eyebrow">FINANCEIRO</span><h2>Controle financeiro por passeio</h2><p>As despesas não ficam mais misturadas. Abra o passeio para ver, cadastrar e editar somente os custos dele.</p></div><label><span class="eyebrow">MÊS DO RESUMO</span><input id="v41Month" class="v41Month" type="month" value="${esc(month)}"></label></div>
          <div class="v41Kpis">
            <article><span>FATURADO NO MÊS</span><strong>${money(m.billed)}</strong><small>vendas registradas</small></article>
            <article><span>DINHEIRO QUE ENTROU</span><strong>${money(m.income)}</strong><small>recebido confirmado</small></article>
            <article><span>DESPESAS PAGAS</span><strong>${money(m.paidOut)}</strong><small>saídas dos passeios do mês</small></article>
            <article><span>CONTAS A PAGAR</span><strong>${money(m.toPay)}</strong><small>despesas ainda abertas</small></article>
            <article><span>A RECEBER</span><strong>${money(m.receivable)}</strong><small>saldo de clientes</small></article>
            <article><span>RESULTADO DE CAIXA</span><strong>${money(m.cash)}</strong><small>entradas - despesas pagas</small></article>
          </div>
          <div class="v41Pay">${Object.entries(PAY).filter(([k])=>k!=='other'||m.pay.other).map(([k,label])=>`<div><span>${esc(label.toUpperCase())}</span><b>${money(m.pay[k]||0)}</b></div>`).join('')}</div>
        </section>
        <section class="v41Trips">
          <div class="v41TripsHead"><div><span class="eyebrow">DESPESAS POR PASSEIO</span><h2>Passeios</h2><p>Clique em um passeio. As despesas detalhadas aparecem somente dentro dele.</p></div>${typeof window.openMonthlyReportV34==='function'?'<button class="btn primary" id="v41Report">Relatório mensal</button>':''}</div>
          <div class="v41TripList">${trips.length?trips.map(t=>{const f=tripFinance(t,sales,expenses);return `<button class="v41Trip" data-v41-trip="${esc(t.id)}"><div><h3>${esc(t.name||'Passeio')}</h3><small>${brDate(t.trip_date)} • ${f.seats} cliente(s)</small></div><div class="v41TripNums"><div><span>RECEBIDO</span><b>${money(f.received)}</b></div><div><span>CUSTO PREVISTO</span><b>${money(f.planned.total)}</b></div><div><span>DESP. PAGAS</span><b>${money(f.paid)}</b></div><div><span>A PAGAR</span><b>${money(f.open)}</b></div><div><span>RESULTADO</span><b>${money(f.sold-f.actual)}</b></div></div><span class="v41Open">Abrir despesas</span></button>`}).join(''):'<div class="v41Empty">Nenhum passeio cadastrado.</div>'}</div>
        </section>
      </section>`;
    q('#v41Month')?.addEventListener('change',e=>{state.financeMonthV41=e.target.value||monthNow();rendering=false;renderFinanceV41()});
    qa('[data-v41-trip]',content).forEach(b=>b.onclick=()=>openTripV41(b.dataset.v41Trip));
    q('#v41Report')?.addEventListener('click',()=>window.openMonthlyReportV34?.(state.financeMonthV41||monthNow()));
  }catch(e){
    content.innerHTML=`<div class="msg error">Não foi possível carregar o financeiro: ${esc(e.message||e)}</div>`;
  }finally{rendering=false}
}

async function openTripV41(tripId){
  const t=(state.trips||[]).find(x=>x.id===tripId);if(!t)return notify('Passeio não encontrado.','error');
  const [sales,expenses]=await Promise.all([fetchSales(),fetchExpenses()]);
  const f=tripFinance(t,sales,expenses);
  q('#v41TripModal')?.remove();
  const back=document.createElement('div');back.id='v41TripModal';back.className='modalBack';
  const plannedRows=f.planned.items.length?f.planned.items.map(x=>{
    const total=x.mode==='per_person'?n(x.amount)*f.seats:n(x.amount);
    return `<div class="v41Row"><div><h4>${esc(x.category)}</h4><span class="v41Mode ${x.mode==='per_person'?'pp':''}">${x.mode==='per_person'?'POR PESSOA':'VALOR TOTAL'}</span><small class="v41Formula">${x.mode==='per_person'?`${money(x.amount)} por pessoa × ${f.seats} cliente(s) = ${money(total)}`:`${money(x.amount)} total do passeio`}</small></div><div class="v41Amount">${money(x.amount)}${x.mode==='per_person'?'<small> / pessoa</small>':''}</div><div class="v41Amount">${money(total)}</div><div></div></div>`;
  }).join(''):'<div class="v41Empty">Nenhum custo previsto cadastrado no passeio.</div>';
  const actualRows=f.expenses.length?f.expenses.map(e=>{
    const c=expenseCalc(e,f.seats),paid=expensePaid(e);
    return `<div class="v41Row"><div><h4>${esc(e.description||e.category||'Despesa')}</h4><span class="v41Mode ${c.mode==='per_person'?'pp':''}">${c.mode==='per_person'?'POR PESSOA':'VALOR TOTAL'}${c.legacy?' • IDENTIFICADO PELO SISTEMA':''}</span><small class="v41Formula">${c.mode==='per_person'?`${money(c.unit)} por pessoa × ${c.qty} pessoa(s) = ${money(c.total)}`:`${money(c.total)} total do passeio`}${e.due_date?` • ${paid?'paga/lançada':'vence'} ${brDate(e.due_date)}`:''}</small></div><div class="v41Amount">${c.mode==='per_person'?`${money(c.unit)} / pessoa`:money(c.total)}</div><div><span class="v41Status ${paid?'':'open'}">${paid?'PAGA':'A PAGAR'}</span><div class="v41Amount" style="margin-top:6px">${money(c.total)}</div></div><div class="v41Actions"><button data-v41-edit="${esc(e.id)}">Editar</button>${!paid?`<button class="ok" data-v41-paid="${esc(e.id)}">Marcar paga</button>`:''}<button class="danger" data-v41-del="${esc(e.id)}">Excluir</button></div></div>`;
  }).join(''):'<div class="v41Empty">Nenhuma despesa lançada neste passeio.</div>';
  back.innerHTML=`<div class="modal v41Modal"><div class="modalHead"><div><span class="eyebrow">FINANCEIRO DO PASSEIO</span><h2>${esc(t.name)}</h2><p>${f.seats} cliente(s) • despesas isoladas deste passeio</p></div><button class="iconClose" id="v41Close">✕</button></div><div class="modalBody">
    <div class="v41Stats"><div><span>VENDIDO</span><strong>${money(f.sold)}</strong></div><div><span>RECEBIDO</span><strong>${money(f.received)}</strong></div><div><span>CUSTO PREVISTO</span><strong>${money(f.planned.total)}</strong></div><div><span>DESPESAS PAGAS</span><strong>${money(f.paid)}</strong></div><div><span>A PAGAR</span><strong>${money(f.open)}</strong></div><div><span>RESULTADO</span><strong>${money(f.sold-f.actual)}</strong></div></div>
    <section class="v41Section"><div class="v41SectionHead"><div><h3>Custos previstos</h3><small>Definidos no cadastro do passeio.</small></div><button class="btn ghost" id="v41EditPlanned">Editar custos previstos</button></div><div class="v41Rows"><div class="v41Row" style="font-size:10px;font-weight:900;color:#6a7d75"><div>DESPESA / CÁLCULO</div><div>VALOR UNITÁRIO</div><div>TOTAL CALCULADO</div><div></div></div>${plannedRows}</div></section>
    <section class="v41Section"><div class="v41SectionHead"><div><h3>Despesas lançadas</h3><small>Somente despesas de ${esc(t.name)}.</small></div><button class="btn primary" id="v41New">+ Nova despesa</button></div><div class="v41Rows"><div class="v41Row" style="font-size:10px;font-weight:900;color:#6a7d75"><div>DESPESA / CÁLCULO</div><div>VALOR</div><div>STATUS / TOTAL</div><div>AÇÕES</div></div>${actualRows}</div></section>
  </div><div class="modalFoot"><button class="btn ghost" id="v41Done">Fechar</button></div></div>`;
  document.body.appendChild(back);
  q('#v41Close',back).onclick=q('#v41Done',back).onclick=()=>back.remove();back.onclick=e=>{if(e.target===back)back.remove()};
  q('#v41New',back).onclick=()=>expenseModalV41(tripId);
  q('#v41EditPlanned',back).onclick=()=>{back.remove();if(typeof window.tripModalV36==='function')window.tripModalV36(tripId);else window.tripModal?.(tripId)};
  qa('[data-v41-edit]',back).forEach(b=>b.onclick=()=>expenseModalV41(tripId,b.dataset.v41Edit));
  qa('[data-v41-paid]',back).forEach(b=>b.onclick=()=>markPaidV41(tripId,b.dataset.v41Paid));
  qa('[data-v41-del]',back).forEach(b=>b.onclick=()=>deleteExpenseV41(tripId,b.dataset.v41Del));
}

function expenseModalV41(tripId,id=''){
  const t=(state.trips||[]).find(x=>x.id===tripId),e=id?(state.expenses||[]).find(x=>x.id===id):null;if(!t)return;
  const seats=activeSeats(tripId),mode=e?inferMode(e):'fixed',unit=e?unitAmount(e):0,paid=e?expensePaid(e):false;
  q('#v41ExpenseModal')?.remove();
  const back=document.createElement('div');back.id='v41ExpenseModal';back.className='modalBack';
  back.innerHTML=`<div class="modal" style="max-width:760px"><form id="v41Form"><div class="modalHead"><div><span class="eyebrow">${e?'EDITAR':'NOVA'} DESPESA</span><h2>${esc(t.name)}</h2><p>Escolha se o valor é total do passeio ou por pessoa.</p></div><button type="button" class="iconClose" id="v41EClose">✕</button></div><div class="modalBody">
    <div class="v41FormGrid">
      <label><span>CATEGORIA</span><input name="category" required value="${esc(e?.category||'')}" placeholder="Ex.: Alimentação, Transporte"></label>
      <label><span>TIPO DO CUSTO</span><select name="mode"><option value="fixed" ${mode==='fixed'?'selected':''}>VALOR TOTAL DO PASSEIO</option><option value="per_person" ${mode==='per_person'?'selected':''}>POR PESSOA</option></select></label>
      <label class="wide"><span>DESCRIÇÃO</span><input name="description" required value="${esc(e?.description||'')}" placeholder="Ex.: Almoço / Ônibus"></label>
      <label><span id="v41UnitLabel">${mode==='per_person'?'VALOR POR PESSOA':'VALOR TOTAL'}</span><input name="unit" type="number" min="0.01" step="0.01" required value="${unit||''}" placeholder="0,00"></label>
      <label><span>VENCIMENTO / DATA</span><input name="due" type="date" required value="${String(e?.due_date||e?.expense_date||today()).slice(0,10)}"></label>
      <label><span>STATUS</span><select name="status"><option value="pending" ${!paid?'selected':''}>A PAGAR</option><option value="paid" ${paid?'selected':''}>JÁ PAGA</option></select></label>
    </div><div id="v41Calc" class="v41Calc"></div><div id="v41Msg"></div>
  </div><div class="modalFoot"><button type="button" class="btn ghost" id="v41ECancel">Cancelar</button><button class="btn primary">Salvar despesa</button></div></form></div>`;
  document.body.appendChild(back);
  const form=q('#v41Form',back);
  const calc=()=>{const pp=form.mode.value==='per_person',u=n(form.unit.value),qty=pp?seats:1,total=u*qty;q('#v41UnitLabel',back).textContent=pp?'VALOR POR PESSOA':'VALOR TOTAL';q('#v41Calc',back).innerHTML=pp?`<b>POR PESSOA:</b> ${money(u)} × ${seats} cliente(s) = <strong>${money(total)}</strong>`:`<b>VALOR TOTAL:</b> ${money(total)} contabilizado uma única vez.`};
  q('#v41EClose',back).onclick=q('#v41ECancel',back).onclick=()=>back.remove();form.mode.onchange=calc;form.unit.oninput=calc;calc();
  form.onsubmit=async ev=>{
    ev.preventDefault();const msg=q('#v41Msg',back);
    try{
      const pp=form.mode.value==='per_person',u=n(form.unit.value),qty=pp?seats:1,isPaid=form.status.value==='paid',amount=u*qty,stamp=firebase.firestore.FieldValue.serverTimestamp();
      const data={trip_id:tripId,trip_name:t.name,category:form.category.value.trim(),description:form.description.value.trim(),cost_mode:pp?'per_person':'fixed',unit_amount:u,quantity_basis:qty,amount,dynamic_per_person:pp&&!isPaid,due_date:form.due.value,expense_date:form.due.value,payment_status:isPaid?'paid':'pending',status:isPaid?'paid':'pending',paid_date:isPaid?today():'',updated_at:stamp};
      if(e){await db.collection('expenses').doc(e.id).update(data)}else{data.created_at=stamp;await db.collection('expenses').add(data)}
      notify('Despesa salva no passeio.','success');back.remove();q('#v41TripModal')?.remove();await fetchExpenses();openTripV41(tripId);renderFinanceV41();
    }catch(err){if(msg)msg.innerHTML=`<div class="msg error">${esc(err.message||err)}</div>`}
  };
}
async function markPaidV41(tripId,id){
  const e=(state.expenses||[]).find(x=>x.id===id);if(!e)return;
  try{
    const seats=activeSeats(tripId),mode=inferMode(e),unit=unitAmount(e),qty=mode==='per_person'?seats:1,amount=unit*qty;
    const patch={cost_mode:mode,unit_amount:unit,quantity_basis:qty,amount,dynamic_per_person:false,payment_status:'paid',status:'paid',paid_date:today(),updated_at:firebase.firestore.FieldValue.serverTimestamp()};
    await db.collection('expenses').doc(id).update(patch);notify('Despesa marcada como paga.','success');q('#v41TripModal')?.remove();await fetchExpenses();openTripV41(tripId);renderFinanceV41();
  }catch(e){notify(e.message||'Erro ao marcar despesa.','error')}
}
async function deleteExpenseV41(tripId,id){
  if(!confirm('Excluir esta despesa deste passeio?'))return;
  try{await db.collection('expenses').doc(id).delete();notify('Despesa excluída.','success');q('#v41TripModal')?.remove();await fetchExpenses();openTripV41(tripId);renderFinanceV41()}catch(e){notify(e.message||'Erro ao excluir despesa.','error')}
}
window.openTripExpensesV41=openTripV41;
window.expenseModalV41=expenseModalV41;

const oldRender=window.renderAdmin;
if(typeof oldRender==='function'){
  window.renderAdmin=function(...args){
    const out=oldRender.apply(this,args);
    if(state.tab==='finance')setTimeout(()=>renderFinanceV41(),90);
    return out;
  };
  try{renderAdmin=window.renderAdmin}catch(_){}
}
const observer=new MutationObserver(()=>{
  if(state.tab==='finance'&&!q('#v41Finance')&&!rendering)setTimeout(()=>renderFinanceV41(),60);
});
observer.observe(document.body,{childList:true,subtree:true});
window.addEventListener('load',()=>{if(state.tab==='finance')setTimeout(renderFinanceV41,160)});
setTimeout(()=>{if(state.tab==='finance')renderFinanceV41()},350);
})();