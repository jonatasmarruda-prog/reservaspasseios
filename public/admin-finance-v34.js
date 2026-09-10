/* Trilheiros Gestão V34 — despesas por passeio + fechamento financeiro mensal */
(function(){
'use strict';
if(typeof state==='undefined') return;

const q=(s,r=document)=>r.querySelector(s);
const qa=(s,r=document)=>[...r.querySelectorAll(s)];
const num=v=>Math.max(0,Number(v||0)||0);
const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v||0));
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'America/Cuiaba'});
const monthNow=()=>today().slice(0,7);
const LOGO='https://i.postimg.cc/JnF2F9Hw/LOGO-TRILHEIROS-Photoroom.png';

function iso(v){
  if(!v)return'';
  if(typeof v==='string'&&/^\d{4}-\d{2}-\d{2}/.test(v))return v.slice(0,10);
  try{
    const d=typeof v?.toDate==='function'?v.toDate():v?.seconds?new Date(v.seconds*1000):new Date(v);
    if(Number.isNaN(d.getTime()))return'';
    return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Cuiaba',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
  }catch{return''}
}
function monthOf(v){const s=iso(v);return s?s.slice(0,7):''}
function brDate(v){const s=iso(v);if(!s)return'—';const[y,m,d]=s.split('-');return`${d}/${m}/${y}`}
function monthLabel(m){
  if(!/^\d{4}-\d{2}$/.test(m))return m;
  const[y,mo]=m.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric',timeZone:'America/Cuiaba'}).format(new Date(Date.UTC(y,mo-1,2)));
}
function isPaid(e){return !['pending','open','unpaid','to_pay','payable'].includes(String(e?.payment_status||e?.status||'').toLowerCase())}
function payKind(v){v=String(v||'').toLowerCase();if(v.includes('parcel')||v.includes('install'))return'pix_installment';if(v.includes('card')||v.includes('cart'))return'card';if(v.includes('pix'))return'pix';if(v.includes('cash')||v.includes('dinheiro'))return'cash';return'other'}
const PAY_LABEL={pix:'PIX',card:'CARTÃO',pix_installment:'PIX PARCELADO',cash:'DINHEIRO',other:'OUTROS'};
function notify(msg,type=''){try{return typeof toast==='function'?toast(msg,type):alert(msg)}catch(_){alert(msg)}}
function close(id){q(id)?.remove()}
function activeSeats(tripId){return (state.reservations||[]).filter(r=>r.trip_id===tripId&&r.status!=='cancelled').reduce((s,r)=>s+num(r.seats),0)}
function reservationValue(r,t){
  if(num(r?.sale_total)>0)return num(r.sale_total);
  const total=num(r?.paid_amount)+num(r?.balance_due)-num(r?.refunded_amount);
  if(total>0)return total;
  return num(t?.default_price)*Math.max(1,num(r?.seats));
}
function tripCostItems(t){
  if(Array.isArray(t?.cost_items)&&t.cost_items.length)return t.cost_items.map(x=>({category:String(x.category||'Outros'),mode:x.mode==='per_person'?'per_person':'fixed',amount:num(x.amount)}));
  const out=[];const add=(category,mode,amount)=>{if(num(amount)>0)out.push({category,mode,amount:num(amount)})};
  add('Ônibus / Transporte','fixed',t?.cost_bus_fixed);add('Hospedagem','per_person',t?.cost_lodging_per_person);add('Custo do passeio / Entrada / Day Use','per_person',t?.cost_activity_per_person);add('Alimentação','per_person',t?.cost_food_per_person);add('Seguro','per_person',t?.cost_insurance_per_person);add('Guia / Condutor local','fixed',t?.cost_guide_fixed);add('Outros','fixed',t?.cost_other_fixed);add('Outros','per_person',t?.cost_other_per_person);return out;
}
function projectedTripCost(t,seats=activeSeats(t?.id)){
  const items=tripCostItems(t);const fixed=items.filter(x=>x.mode==='fixed').reduce((s,x)=>s+num(x.amount),0);const pp=items.filter(x=>x.mode==='per_person').reduce((s,x)=>s+num(x.amount),0);return{items,fixed,perPerson:pp,total:fixed+pp*seats};
}
function expenseAmount(e){
  const unit=num(e?.unit_amount||e?.amount);
  if(e?.cost_mode==='per_person'&&e?.dynamic_per_person!==false&&!isPaid(e))return unit*activeSeats(e.trip_id);
  return num(e?.amount)>0?num(e.amount):unit;
}
function tripExpenses(tripId){return (state.expenses||[]).filter(e=>e.trip_id===tripId)}
function expensePaidMonth(e){return monthOf(e.paid_date)||monthOf(e.expense_date)||monthOf(e.updated_at)||monthOf(e.created_at)}
function expenseDueMonth(e){return monthOf(e.due_date)||monthOf(e.expense_date)||monthOf(e.created_at)}
function reservationCreatedMonth(r){return monthOf(r.created_at)||monthOf(r.registered_at)||monthOf(r.trip_date)}

function paymentEntriesForMonth(month){
  const rows=[];
  (state.reservations||[]).filter(r=>r.status!=='cancelled').forEach(r=>{
    const t=(state.trips||[]).find(x=>x.id===r.trip_id);
    if(Array.isArray(r.payment_history)&&r.payment_history.length){
      r.payment_history.forEach(p=>{if(monthOf(p.date)===month)rows.push({amount:num(p.amount),method:payKind(p.method||r.payment_method),date:iso(p.date),name:r.responsible_name||r.participants?.[0]?.full_name||'Cliente',trip:t?.name||r.trip_name||'Passeio'})});
    }else{
      const d=r.received_date||r.payment_received_date||r.updated_at||r.created_at;
      const amount=Math.max(0,num(r.paid_amount)-num(r.refunded_amount));
      if(amount>0&&monthOf(d)===month)rows.push({amount,method:payKind(r.payment_method),date:iso(d),name:r.responsible_name||r.participants?.[0]?.full_name||'Cliente',trip:t?.name||r.trip_name||'Passeio'});
    }
  });
  return rows;
}
function monthlyData(month){
  const payments=paymentEntriesForMonth(month);
  const income=payments.reduce((s,x)=>s+x.amount,0);
  const paymentBreak={pix:0,card:0,pix_installment:0,cash:0,other:0};payments.forEach(x=>paymentBreak[x.method]+=x.amount);
  const sales=(state.reservations||[]).filter(r=>r.status!=='cancelled'&&reservationCreatedMonth(r)===month);
  const booked=sales.reduce((s,r)=>s+reservationValue(r,(state.trips||[]).find(t=>t.id===r.trip_id)),0);
  const paidExpenses=(state.expenses||[]).filter(e=>isPaid(e)&&expensePaidMonth(e)===month);
  const paidOut=paidExpenses.reduce((s,e)=>s+expenseAmount(e),0);
  const payables=(state.expenses||[]).filter(e=>!isPaid(e)&&expenseDueMonth(e)===month);
  const openOut=payables.reduce((s,e)=>s+expenseAmount(e),0);
  const expenseByCategory={};paidExpenses.forEach(e=>{const k=e.category||'Outros';expenseByCategory[k]=(expenseByCategory[k]||0)+expenseAmount(e)});
  const trips=(state.trips||[]).filter(t=>String(t.trip_date||'').slice(0,7)===month&&t.status!=='cancelled').map(t=>{
    const rs=(state.reservations||[]).filter(r=>r.trip_id===t.id&&r.status!=='cancelled');
    const seats=rs.reduce((s,r)=>s+num(r.seats),0);const sold=rs.reduce((s,r)=>s+reservationValue(r,t),0);const received=rs.reduce((s,r)=>s+Math.max(0,num(r.paid_amount)-num(r.refunded_amount)),0);const pc=projectedTripCost(t,seats);const ex=tripExpenses(t.id);const paid=ex.filter(isPaid).reduce((s,e)=>s+expenseAmount(e),0);const payable=ex.filter(e=>!isPaid(e)).reduce((s,e)=>s+expenseAmount(e),0);return{t,seats,sold,received,projected:pc.total,paid,payable,projectedProfit:sold-pc.total,cashProfit:received-paid};
  }).sort((a,b)=>String(a.t.trip_date||'').localeCompare(String(b.t.trip_date||'')));
  return{month,payments,income,paymentBreak,sales,booked,paidExpenses,paidOut,payables,openOut,expenseByCategory,trips,cashProfit:income-paidOut};
}

function expenseTripCard(t){
  const seats=activeSeats(t.id),pc=projectedTripCost(t,seats),ex=tripExpenses(t.id),paid=ex.filter(isPaid).reduce((s,e)=>s+expenseAmount(e),0),open=ex.filter(e=>!isPaid(e)).reduce((s,e)=>s+expenseAmount(e),0);
  return `<button class="v34TripExpenseCard" data-v34-trip="${esc(t.id)}"><div><span>${brDate(t.trip_date)}</span><strong>${esc(t.name)}</strong><small>${esc(t.destination||'')} • ${seats} cliente(s)</small></div><div class="v34TripExpenseNums"><span>Previsto <b>${money(pc.total)}</b></span><span>Pago <b>${money(paid)}</b></span><span>A pagar <b>${money(open)}</b></span></div><b class="v34Arrow">→</b></button>`;
}
function mountFinanceHub(){
  if(state.tab!=='finance')return;
  const content=q('#content');if(!content)return;
  q('#v34ExpenseHub')?.remove();
  const globalAdd=q('#v30AddPayable');if(globalAdd)globalAdd.style.display='none';
  const mixedCard=q('#v30AddPayable2')?.closest('.v30Card');if(mixedCard)mixedCard.style.display='none';
  const trips=(state.trips||[]).filter(t=>t.status!=='cancelled').sort((a,b)=>String(a.trip_date||'').localeCompare(String(b.trip_date||'')));
  const month=state.financeMonthV30||monthNow();
  const html=`<section id="v34ExpenseHub" class="v34Hub"><div class="v34HubHead"><div><span class="eyebrow">DESPESAS POR PASSEIO</span><h2>Custos organizados sem misturar os passeios</h2><p>Abra um passeio para cadastrar, editar, pagar e acompanhar todas as despesas dele.</p></div><button class="btn primary" id="v34MonthlyReport">Relatório de ${esc(monthLabel(month))}</button></div><div class="v34TripList">${trips.length?trips.map(expenseTripCard).join(''):'<div class="v34Empty">Nenhum passeio cadastrado.</div>'}</div></section>`;
  const dash=q('#v30FinanceDash');if(dash)dash.insertAdjacentHTML('afterend',html);else content.insertAdjacentHTML('afterbegin',html);
  qa('[data-v34-trip]').forEach(b=>b.onclick=()=>window.openTripExpensesV34(b.dataset.v34Trip));q('#v34MonthlyReport')?.addEventListener('click',()=>window.openMonthlyReportV34(month));
}

function plannedRowsHtml(t){
  const seats=activeSeats(t.id),items=tripCostItems(t);
  return items.length?items.map(x=>`<div class="v34PlannedRow"><div><strong>${esc(x.category)}</strong><span>${x.mode==='per_person'?'POR PESSOA':'VALOR TOTAL'}</span></div><b>${money(x.amount)}${x.mode==='per_person'?` × ${seats} = ${money(x.amount*seats)}`:''}</b></div>`).join(''):'<div class="v34Empty">Nenhum custo previsto cadastrado. Use “Editar custos previstos”.</div>';
}
function actualRowsHtml(t){
  const ex=tripExpenses(t.id).sort((a,b)=>String(a.due_date||a.expense_date||'').localeCompare(String(b.due_date||b.expense_date||'')));
  return ex.length?ex.map(e=>{const amount=expenseAmount(e),pp=e.cost_mode==='per_person',status=isPaid(e)?'PAGA':'A PAGAR';return `<div class="v34ActualRow ${isPaid(e)?'paid':'open'}"><div class="v34ActualMain"><span>${status}${e.due_date?` • ${brDate(e.due_date)}`:''}</span><strong>${esc(e.description||e.category||'Despesa')}</strong><small>${esc(e.category||'')} • ${pp?`POR PESSOA: ${money(e.unit_amount||e.amount)} × ${activeSeats(t.id)} cliente(s)`:'VALOR TOTAL'}</small></div><b>${money(amount)}</b><div class="v34ActualActions"><button data-v34-edit="${esc(e.id)}">Editar</button>${!isPaid(e)?`<button class="ok" data-v34-paid="${esc(e.id)}">Marcar paga</button>`:''}<button class="danger" data-v34-del="${esc(e.id)}">Excluir</button></div></div>`}).join(''):'<div class="v34Empty">Nenhuma despesa lançada para este passeio.</div>';
}
function breakEven(t){
  const pc=projectedTripCost(t,0),price=num(t.default_price),margin=price-pc.perPerson;if(price<=0||margin<=0)return null;return Math.ceil(pc.fixed/margin);
}
window.openTripExpensesV34=function(tripId){
  const t=(state.trips||[]).find(x=>x.id===tripId);if(!t)return notify('Passeio não encontrado.','error');close('#v34TripModal');
  const seats=activeSeats(t.id),pc=projectedTripCost(t,seats),ex=tripExpenses(t.id),paid=ex.filter(isPaid).reduce((s,e)=>s+expenseAmount(e),0),open=ex.filter(e=>!isPaid(e)).reduce((s,e)=>s+expenseAmount(e),0),be=breakEven(t);
  const back=document.createElement('div');back.id='v34TripModal';back.className='modalBack';back.innerHTML=`<div class="modal v34TripModal"><div class="modalHead"><div><span class="eyebrow">DESPESAS DO PASSEIO</span><h2>${esc(t.name)}</h2><p>${brDate(t.trip_date)} • ${esc(t.destination||'')} • ${seats} cliente(s) reservado(s)</p></div><button class="iconClose" id="v34TripClose">✕</button></div><div class="modalBody"><div class="v34Metrics"><div><span>CUSTO FIXO PREVISTO</span><strong>${money(pc.fixed)}</strong></div><div><span>CUSTO POR PESSOA</span><strong>${money(pc.perPerson)}</strong></div><div><span>CUSTO PREVISTO ATUAL</span><strong>${money(pc.total)}</strong></div><div><span>DESPESAS PAGAS</span><strong>${money(paid)}</strong></div><div><span>CONTAS A PAGAR</span><strong>${money(open)}</strong></div><div><span>PONTO DE EQUILÍBRIO</span><strong>${be===null?'—':`${be} cliente(s)`}</strong></div></div><div class="v34SectionHead"><div><h3>Custos previstos</h3><p>Base usada para projeção conforme entram reservas.</p></div><button class="btn ghost" id="v34EditPlanned">Editar custos previstos</button></div><div class="v34Planned">${plannedRowsHtml(t)}</div><div class="v34SectionHead"><div><h3>Despesas lançadas</h3><p>Contas reais do passeio, pagas ou a pagar.</p></div><button class="btn primary" id="v34AddExpense">+ Adicionar despesa</button></div><div class="v34Actual">${actualRowsHtml(t)}</div></div><div class="modalFoot"><button class="btn ghost" id="v34TripClose2">Fechar</button></div></div>`;
  document.body.appendChild(back);q('#v34TripClose',back).onclick=q('#v34TripClose2',back).onclick=()=>close('#v34TripModal');back.onclick=e=>{if(e.target===back)close('#v34TripModal')};q('#v34EditPlanned',back).onclick=()=>{close('#v34TripModal');if(typeof window.tripModal==='function')window.tripModal(t.id)};q('#v34AddExpense',back).onclick=()=>window.openExpenseEditorV34(t.id);
  qa('[data-v34-edit]',back).forEach(b=>b.onclick=()=>window.openExpenseEditorV34(t.id,b.dataset.v34Edit));qa('[data-v34-paid]',back).forEach(b=>b.onclick=()=>window.markExpensePaidV34(b.dataset.v34Paid,t.id));qa('[data-v34-del]',back).forEach(b=>b.onclick=()=>window.deleteExpenseV34(b.dataset.v34Del,t.id));
};

window.openExpenseEditorV34=function(tripId,expenseId=''){
  const t=(state.trips||[]).find(x=>x.id===tripId);if(!t)return;const e=expenseId?(state.expenses||[]).find(x=>x.id===expenseId):null;close('#v34ExpenseEditor');
  const back=document.createElement('div');back.id='v34ExpenseEditor';back.className='modalBack';back.innerHTML=`<div class="modal v34ExpenseEditor"><form id="v34ExpenseForm"><div class="modalHead"><div><span class="eyebrow">${e?'EDITAR':'NOVA'} DESPESA</span><h2>${esc(t.name)}</h2><p>Informe se o custo é total do passeio ou calculado por pessoa.</p></div><button type="button" class="iconClose" id="v34ExpenseClose">✕</button></div><div class="modalBody"><div class="grid two"><label><span>Categoria</span><input name="category" required value="${esc(e?.category||'')}" placeholder="Ex.: Alimentação"></label><label><span>Como calcular?</span><select name="mode"><option value="fixed" ${e?.cost_mode!=='per_person'?'selected':''}>VALOR TOTAL DO PASSEIO</option><option value="per_person" ${e?.cost_mode==='per_person'?'selected':''}>POR PESSOA</option></select></label><label class="span2"><span>Descrição</span><input name="description" required value="${esc(e?.description||'')}" placeholder="Ex.: Almoço de domingo"></label><label><span>Valor</span><input name="unit" type="number" min="0.01" step="0.01" required value="${num(e?.unit_amount||e?.amount)||''}"></label><label><span>Status</span><select name="status"><option value="pending" ${!e||!isPaid(e)?'selected':''}>A pagar</option><option value="paid" ${e&&isPaid(e)?'selected':''}>Já paga</option></select></label><label><span>Vencimento</span><input name="due" type="date" value="${iso(e?.due_date)||today()}"></label><div class="v34CalcPreview" id="v34CalcPreview"></div></div><div id="v34ExpenseMsg"></div></div><div class="modalFoot"><button type="button" class="btn ghost" id="v34ExpenseCancel">Cancelar</button><button class="btn primary">Salvar despesa</button></div></form></div>`;
  document.body.appendChild(back);const form=q('#v34ExpenseForm',back),preview=()=>{const unit=num(form.unit.value),seats=activeSeats(tripId),per=form.mode.value==='per_person',total=per?unit*seats:unit;q('#v34CalcPreview',back).innerHTML=`<span>${per?'CÁLCULO POR PESSOA':'VALOR TOTAL'}</span><strong>${per?`${money(unit)} × ${seats} = ${money(total)}`:money(total)}</strong>`};form.mode.onchange=form.unit.oninput=preview;preview();q('#v34ExpenseClose',back).onclick=q('#v34ExpenseCancel',back).onclick=()=>close('#v34ExpenseEditor');back.onclick=x=>{if(x.target===back)close('#v34ExpenseEditor')};
  form.onsubmit=async ev=>{ev.preventDefault();const msg=q('#v34ExpenseMsg',back);try{const unit=num(form.unit.value);if(unit<=0)throw Error('Informe um valor maior que zero.');const per=form.mode.value==='per_person',paid=form.status.value==='paid',seats=activeSeats(tripId),amount=per?unit*seats:unit,now=firebase.firestore.FieldValue.serverTimestamp(),data={trip_id:tripId,category:form.category.value.trim(),description:form.description.value.trim(),cost_mode:per?'per_person':'fixed',unit_amount:unit,amount,quantity_basis:per?seats:1,dynamic_per_person:per&&!paid,payment_status:paid?'paid':'pending',status:paid?'paid':'pending',due_date:form.due.value||today(),expense_date:paid?today():'',paid_date:paid?today():'',updated_at:now};if(e){await db.collection('expenses').doc(e.id).update(data);Object.assign(e,data)}else{data.created_at=now;const ref=await db.collection('expenses').add(data);(state.expenses||[]).push({id:ref.id,...data})}close('#v34ExpenseEditor');notify('Despesa salva.','success');window.openTripExpensesV34(tripId);setTimeout(mountFinanceHub,50)}catch(err){if(msg)msg.innerHTML=`<div class="msg error">${esc(err.message||err)}</div>`}};
};
window.markExpensePaidV34=async function(id,tripId){const e=(state.expenses||[]).find(x=>x.id===id);if(!e)return;try{const amount=expenseAmount(e),day=today();await db.collection('expenses').doc(id).update({amount,quantity_basis:e.cost_mode==='per_person'?activeSeats(tripId):1,dynamic_per_person:false,payment_status:'paid',status:'paid',expense_date:day,paid_date:day,updated_at:firebase.firestore.FieldValue.serverTimestamp()});Object.assign(e,{amount,dynamic_per_person:false,payment_status:'paid',status:'paid',expense_date:day,paid_date:day});notify(`Despesa de ${money(amount)} marcada como paga.`,'success');window.openTripExpensesV34(tripId);setTimeout(mountFinanceHub,50)}catch(err){notify(err.message||'Erro ao atualizar despesa.','error')}};
window.deleteExpenseV34=async function(id,tripId){if(!confirm('Excluir esta despesa?'))return;try{await db.collection('expenses').doc(id).delete();state.expenses=(state.expenses||[]).filter(x=>x.id!==id);notify('Despesa excluída.');window.openTripExpensesV34(tripId);setTimeout(mountFinanceHub,50)}catch(err){notify(err.message||'Erro ao excluir despesa.','error')}};

function barsHtml(obj){const entries=Object.entries(obj).filter(([,v])=>num(v)>0);const max=Math.max(1,...entries.map(([,v])=>num(v)));return entries.length?entries.map(([k,v])=>`<div class="v34Bar"><span>${esc(k)}</span><div><i style="width:${Math.max(3,(num(v)/max)*100)}%"></i></div><b>${money(v)}</b></div>`).join(''):'<div class="v34Empty">Sem movimentação no período.</div>'}
function monthlyModalHtml(d){const payObj={};Object.entries(d.paymentBreak).forEach(([k,v])=>payObj[PAY_LABEL[k]]=v);return `<div class="modal v34ReportModal"><div class="modalHead"><div><span class="eyebrow">FECHAMENTO FINANCEIRO MENSAL</span><h2>${esc(monthLabel(d.month))}</h2><p>Entradas confirmadas, despesas pagas, contas a pagar e desempenho dos passeios.</p></div><button class="iconClose" id="v34ReportClose">✕</button></div><div class="modalBody"><div class="v34Metrics report"><div><span>VENDAS REGISTRADAS</span><strong>${money(d.booked)}</strong></div><div><span>DINHEIRO QUE ENTROU</span><strong>${money(d.income)}</strong></div><div><span>DESPESAS PAGAS</span><strong>${money(d.paidOut)}</strong></div><div><span>CONTAS A PAGAR</span><strong>${money(d.openOut)}</strong></div><div><span>LUCRO / CAIXA DO MÊS</span><strong>${money(d.cashProfit)}</strong></div></div><div class="v34ReportGrid"><section><h3>Entradas por forma de pagamento</h3>${barsHtml(payObj)}</section><section><h3>Despesas pagas por categoria</h3>${barsHtml(d.expenseByCategory)}</section></div><section class="v34ReportTable"><h3>Resultado por passeio do mês</h3><div class="tableWrap"><table class="table"><thead><tr><th>Passeio</th><th>Clientes</th><th>Vendido</th><th>Recebido</th><th>Custo previsto</th><th>Pago despesas</th><th>A pagar</th><th>Lucro previsto</th></tr></thead><tbody>${d.trips.length?d.trips.map(x=>`<tr><td><strong>${esc(x.t.name)}</strong><small>${brDate(x.t.trip_date)}</small></td><td>${x.seats}</td><td>${money(x.sold)}</td><td>${money(x.received)}</td><td>${money(x.projected)}</td><td>${money(x.paid)}</td><td>${money(x.payable)}</td><td><strong>${money(x.projectedProfit)}</strong></td></tr>`).join(''):'<tr><td colspan="8">Nenhum passeio neste mês.</td></tr>'}</tbody></table></div></section></div><div class="modalFoot"><button class="btn ghost" id="v34ReportClose2">Fechar</button><button class="btn primary" id="v34ReportPdf">Gerar PDF profissional</button></div></div>`}
window.openMonthlyReportV34=function(month=state.financeMonthV30||monthNow()){close('#v34ReportModal');const d=monthlyData(month),back=document.createElement('div');back.id='v34ReportModal';back.className='modalBack';back.innerHTML=monthlyModalHtml(d);document.body.appendChild(back);q('#v34ReportClose',back).onclick=q('#v34ReportClose2',back).onclick=()=>close('#v34ReportModal');back.onclick=e=>{if(e.target===back)close('#v34ReportModal')};q('#v34ReportPdf',back).onclick=()=>window.generateMonthlyFinancePdfV34(month)};

async function waitPdf(){for(let i=0;i<50;i++){if(window.jspdf?.jsPDF)return true;try{if(typeof ensurePdfLibraries==='function')await ensurePdfLibraries()}catch(_){ }await new Promise(r=>setTimeout(r,100))}return !!window.jspdf?.jsPDF}
async function logoData(){try{const resp=await fetch(LOGO),blob=await resp.blob();return await new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>res(fr.result);fr.onerror=rej;fr.readAsDataURL(blob)})}catch{return null}}
function slug(v){return String(v||'relatorio').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}
function drawBars(doc,title,obj,y){const entries=Object.entries(obj).filter(([,v])=>num(v)>0).sort((a,b)=>b[1]-a[1]).slice(0,6);doc.setTextColor(20,45,35);doc.setFont('helvetica','bold');doc.setFontSize(11);doc.text(title,14,y);y+=7;if(!entries.length){doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(100);doc.text('Sem movimentação no período.',14,y);return y+8}const max=Math.max(...entries.map(([,v])=>num(v)));entries.forEach(([k,v])=>{doc.setFont('helvetica','normal');doc.setFontSize(7.5);doc.setTextColor(60);doc.text(String(k).slice(0,28),14,y+3);doc.setFillColor(228,235,232);doc.roundedRect(62,y-1,78,5,1,1,'F');doc.setFillColor(7,50,38);doc.roundedRect(62,y-1,78*(num(v)/max),5,1,1,'F');doc.setFont('helvetica','bold');doc.setTextColor(20,45,35);doc.text(money(v),194,y+3,{align:'right'});y+=8});return y+4}
window.generateMonthlyFinancePdfV34=async function(month=state.financeMonthV30||monthNow()){
  try{if(!await waitPdf())throw Error('Biblioteca de PDF indisponível.');const d=monthlyData(month),{jsPDF}=window.jspdf,doc=new jsPDF({unit:'mm',format:'a4'}),logo=await logoData();doc.setFillColor(7,50,38);doc.rect(0,0,210,50,'F');doc.setFillColor(216,173,66);doc.rect(0,50,210,2,'F');if(logo)try{doc.addImage(logo,'PNG',14,8,28,28)}catch(_){ }doc.setTextColor(255);doc.setFont('helvetica','bold');doc.setFontSize(10);doc.text('TRILHEIROS DE RONDONÓPOLIS',logo?49:14,15);doc.setFontSize(20);doc.text('RELATÓRIO FINANCEIRO MENSAL',logo?49:14,27);doc.setFontSize(10);doc.setFont('helvetica','normal');doc.text(monthLabel(month),logo?49:14,37);const cards=[['Vendas',d.booked],['Entradas',d.income],['Despesas pagas',d.paidOut],['A pagar',d.openOut],['Lucro caixa',d.cashProfit]];cards.forEach((x,i)=>{const x0=14+(i%3)*62,y0=61+Math.floor(i/3)*24;doc.setFillColor(244,248,246);doc.roundedRect(x0,y0,58,19,2,2,'F');doc.setTextColor(100);doc.setFontSize(6.7);doc.text(x[0].toUpperCase(),x0+3,y0+6);doc.setTextColor(10,55,42);doc.setFont('helvetica','bold');doc.setFontSize(10.5);doc.text(money(x[1]),x0+3,y0+14);doc.setFont('helvetica','normal')});let y=113;const payObj={};Object.entries(d.paymentBreak).forEach(([k,v])=>payObj[PAY_LABEL[k]]=v);y=drawBars(doc,'Entradas por forma de pagamento',payObj,y);y=drawBars(doc,'Despesas pagas por categoria',d.expenseByCategory,y);if(y>220){doc.addPage();y=20}doc.setFont('helvetica','bold');doc.setFontSize(11);doc.setTextColor(20,45,35);doc.text('Resultado por passeio',14,y);const body=d.trips.map(x=>[x.t.name,String(x.seats),money(x.sold),money(x.received),money(x.projected),money(x.paid),money(x.projectedProfit)]);doc.autoTable({startY:y+6,head:[['Passeio','Clientes','Vendido','Recebido','Custo prev.','Desp. pagas','Lucro prev.']],body:body.length?body:[['Nenhum passeio','—','—','—','—','—','—']],styles:{fontSize:7.2,cellPadding:2.2,textColor:[25,48,40]},headStyles:{fillColor:[7,50,38],textColor:[255,255,255]},margin:{left:14,right:14,bottom:16}});let end=doc.lastAutoTable.finalY+10;if(end>245){doc.addPage();end=20}doc.setFont('helvetica','bold');doc.setFontSize(11);doc.text('Movimentações recebidas',14,end);doc.autoTable({startY:end+6,head:[['Data','Cliente','Passeio','Forma','Valor']],body:d.payments.length?d.payments.map(x=>[brDate(x.date),x.name,x.trip,PAY_LABEL[x.method],money(x.amount)]):[['—','Sem recebimentos','—','—','R$ 0,00']],styles:{fontSize:7.2,cellPadding:2.1},headStyles:{fillColor:[7,50,38],textColor:[255,255,255]},margin:{left:14,right:14,bottom:16}});const pages=doc.internal.getNumberOfPages();for(let i=1;i<=pages;i++){doc.setPage(i);doc.setFontSize(7);doc.setTextColor(120);doc.text(`Fechamento ${monthLabel(month)} • Gerado em ${new Date().toLocaleString('pt-BR')}`,14,288);doc.text(`Página ${i}/${pages}`,196,288,{align:'right'})}const filename=`relatorio-financeiro-${slug(monthLabel(month))}.pdf`;if(typeof window.openPdfPreviewV14==='function')window.openPdfPreviewV14(doc,{filename,title:'Relatório financeiro mensal',subtitle:monthLabel(month),shareText:`Relatório financeiro — ${monthLabel(month)}`});else doc.save(filename)}catch(e){console.error(e);notify(e.message||'Não foi possível gerar o relatório.','error')}};

function injectReportCard(){
  if(state.tab!=='reports')return;const cards=q('.reportCards');if(!cards||q('#v34MonthlyReportCard'))return;const month=state.financeMonthV30||monthNow();cards.insertAdjacentHTML('afterbegin',`<button id="v34MonthlyReportCard"><span>PDF</span><strong>Relatório financeiro mensal</strong><small>Entradas, despesas, lucro, formas de pagamento, passeios e gráficos.</small></button>`);q('#v34MonthlyReportCard').onclick=()=>window.openMonthlyReportV34(month);
}
function lastDayNotice(){
  if(!['dashboard','finance'].includes(state.tab))return;const d=new Date(),tomorrow=new Date(d.getFullYear(),d.getMonth(),d.getDate()+1);if(tomorrow.getMonth()===d.getMonth())return;const content=q('#content');if(!content||q('#v34ClosingNotice'))return;content.insertAdjacentHTML('afterbegin',`<button id="v34ClosingNotice" class="v34ClosingNotice"><span>FECHAMENTO DO MÊS</span><strong>O relatório financeiro de ${esc(monthLabel(monthNow()))} está pronto para conferência.</strong><b>Gerar relatório →</b></button>`);q('#v34ClosingNotice').onclick=()=>window.openMonthlyReportV34(monthNow());
}
function postRender(){setTimeout(()=>{mountFinanceHub();injectReportCard();lastDayNotice()},80)}
const oldRender=window.renderAdmin;if(typeof oldRender==='function'){window.renderAdmin=function(...args){const out=oldRender.apply(this,args);postRender();return out};try{renderAdmin=window.renderAdmin}catch(_){ }}
const obs=new MutationObserver(()=>{if(state.tab==='finance'&&!q('#v34ExpenseHub'))mountFinanceHub();if(state.tab==='reports')injectReportCard()});obs.observe(document.documentElement,{childList:true,subtree:true});document.addEventListener('DOMContentLoaded',postRender);setTimeout(postRender,400);
})();