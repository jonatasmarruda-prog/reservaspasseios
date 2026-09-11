/* Compatibilidade entre V6 e V7: rede, notificações, financeiro central, despesas recorrentes e saúde do painel. */
(function(){
  'use strict';
  const num=v=>Math.max(0,Number(v||0)||0);
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v||0));
  const TZ='America/Cuiaba';
  const BUILD='20260911-financecore4';
  const ADMIN_SCOPE='business';
  const RECURRING_SETTINGS='finance_recurring_expenses';
  let recurringItems=[];
  let recurringLoaded=false;
  let recurringEnsuring='';

  function localToday(){return new Date().toLocaleDateString('en-CA',{timeZone:TZ})}
  function currentFinanceMonth(){return state.financeMonthV42||state.financeMonthV41||localToday().slice(0,7)}
  function monthExpenseDate(month,day=1){const d=Math.max(1,Math.min(28,Number(day)||1));return `${month}-${String(d).padStart(2,'0')}`}
  function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
  function canFinance(){return ['owner','admin','finance'].includes(state?.role||'')}
  function canManageRecurring(){return ['owner','admin'].includes(state?.role||'')}
  function brDate(v){const s=String(v||'').slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return'—';const[y,m,d]=s.split('-');return`${d}/${m}/${y}`}

  function reservationsForTrip(tripId){return (state.reservations||[]).filter(r=>r.trip_id===tripId&&r.status!=='cancelled')}
  function activeSeats(tripId){return reservationsForTrip(tripId).reduce((sum,r)=>sum+num(r.seats),0)}
  function normalizedCostItems(trip){
    let items=Array.isArray(trip?.cost_items)?trip.cost_items.filter(x=>num(x?.amount)>0):[];
    if(items.length)return items.map(x=>({mode:x?.mode==='per_person'?'per_person':'fixed',amount:num(x?.amount),description:x?.description||x?.category||''}));
    return [
      {mode:'fixed',amount:num(trip?.cost_bus_fixed),description:'Transporte'},
      {mode:'fixed',amount:num(trip?.cost_guide_fixed),description:'Guia'},
      {mode:'fixed',amount:num(trip?.cost_other_fixed),description:'Outros'},
      {mode:'per_person',amount:num(trip?.cost_lodging_per_person),description:'Hospedagem'},
      {mode:'per_person',amount:num(trip?.cost_activity_per_person),description:'Atrativo'},
      {mode:'per_person',amount:num(trip?.cost_food_per_person),description:'Alimentação'},
      {mode:'per_person',amount:num(trip?.cost_insurance_per_person),description:'Seguro'},
      {mode:'per_person',amount:num(trip?.cost_other_per_person),description:'Outros por pessoa'}
    ].filter(x=>x.amount>0);
  }
  function plannedCostDetails(trip,seats){
    const items=normalizedCostItems(trip),fixed=items.filter(x=>x.mode!=='per_person').reduce((s,x)=>s+num(x.amount),0),perPerson=items.filter(x=>x.mode==='per_person').reduce((s,x)=>s+num(x.amount),0);
    return{items,fixed,perPerson,total:fixed+(perPerson*num(seats))};
  }
  function expensePaid(e){return !['pending','open','unpaid','to_pay','payable'].includes(String(e?.payment_status||e?.status||'').toLowerCase())}
  function expenseMode(e){
    if(e?.cost_mode==='per_person')return'per_person';
    if(e?.cost_mode==='fixed')return'fixed';
    return /aliment|hosped|hotel|camping|seguro|ingresso|entrada|day use|atrativo|refeic|lanche/.test(norm(`${e?.category||''} ${e?.description||''}`))?'per_person':'fixed';
  }
  function expenseAmount(e,seats){
    const unit=num(e?.unit_amount||e?.amount);
    if(expenseMode(e)==='per_person'){
      const qty=expensePaid(e)&&num(e?.quantity_basis)>0?num(e.quantity_basis):num(seats);
      return unit*qty;
    }
    return num(e?.amount)>0?num(e.amount):unit;
  }
  function isBusinessExpense(e){return e?.expense_scope===ADMIN_SCOPE||(!e?.trip_id&&String(e?.trip_name||'').toUpperCase()==='ADMINISTRATIVO')}
  function businessExpenses(){return (state.expenses||[]).filter(isBusinessExpense)}
  function businessExpenseRowsForMonth(month){return businessExpenses().filter(e=>String(e.competence||e.expense_date||e.due_date||'').slice(0,7)===month).sort((a,b)=>String(a.due_date||a.expense_date||'').localeCompare(String(b.due_date||b.expense_date||'')))}
  function businessExpenseTotal(){return businessExpenses().reduce((s,e)=>s+expenseAmount(e,0),0)}

  function reservationTotal(r,trip){
    if(num(r?.sale_total)>0)return num(r.sale_total);
    const composed=num(r?.paid_amount)+num(r?.balance_due)-num(r?.refunded_amount);
    if(composed>0)return composed;
    return num(trip?.default_price)*Math.max(1,num(r?.seats));
  }
  function reservationReceivable(r,trip){
    if(r?.status==='cancelled'||r?.sale_status==='cancelled')return 0;
    const raw=Number(r?.balance_due);
    if(Number.isFinite(raw)&&raw>=0)return raw;
    return Math.max(0,reservationTotal(r,trip)-num(r?.paid_amount)+num(r?.refunded_amount));
  }
  function totalReceivable(){return (state.reservations||[]).reduce((sum,r)=>sum+reservationReceivable(r,(state.trips||[]).find(t=>t.id===r.trip_id)),0)}
  function revenueForTrip(trip){
    const fromReservations=reservationsForTrip(trip.id).reduce((sum,r)=>sum+reservationTotal(r,trip),0);
    return fromReservations>0?fromReservations:num(trip.net_revenue||trip.gross_revenue);
  }
  function tripFinance(trip){
    const seats=activeSeats(trip.id),planned=plannedCostDetails(trip,seats),rows=(state.expenses||[]).filter(e=>e.trip_id===trip.id),paidRows=rows.filter(expensePaid),openRows=rows.filter(e=>!expensePaid(e)),paid=paidRows.reduce((s,e)=>s+expenseAmount(e,seats),0),open=openRows.reduce((s,e)=>s+expenseAmount(e,seats),0),actual=paid+open,hasActual=rows.length>0,expense=hasActual?actual:planned.total,revenue=revenueForTrip(trip),receivable=reservationsForTrip(trip.id).reduce((s,r)=>s+reservationReceivable(r,trip),0);
    return{tripId:trip.id,seats,planned,paid,open,actual,hasActual,expense,revenue,receivable,result:revenue-expense,source:hasActual?'actual':'planned'};
  }
  function refreshTripFinancialPreview(){
    if(typeof state==='undefined')return[];
    return (state.trips||[]).map(trip=>{
      const f=tripFinance(trip);
      trip.net_revenue=f.revenue;trip.expenses=f.expense;trip.profit=f.result;trip.receivable=f.receivable;trip.estimated_cost=f.planned.total;trip.display_expenses_source=f.source;trip.display_planned_cost=f.planned.total;trip.display_paid_expenses=f.paid;trip.display_open_expenses=f.open;
      return f;
    });
  }
  function financeTotals(){
    const trips=refreshTripFinancialPreview(),revenue=trips.reduce((s,x)=>s+x.revenue,0),tripExpenses=trips.reduce((s,x)=>s+x.expense,0),adminExpenses=businessExpenseTotal(),expenses=tripExpenses+adminExpenses,receivable=totalReceivable(),result=revenue-expenses;
    return{trips,revenue,tripExpenses,adminExpenses,expenses,receivable,result,margin:revenue?result/revenue*100:0};
  }
  function patchDashboardMetrics(){
    if(typeof state==='undefined')return;const total=financeTotals();
    document.querySelectorAll('.metric').forEach(card=>{
      const label=norm(card.querySelector('span')?.textContent||''),strong=card.querySelector('strong'),small=card.querySelector('small');if(!strong)return;
      if(label==='despesas'){strong.textContent=money(total.expenses);if(small)small.textContent='passeios + despesas administrativas'}
      if(label==='resultado'){strong.textContent=money(total.result);if(small)small.textContent=`margem ${total.margin.toFixed(1)}%`}
      if(label==='a receber'){strong.textContent=money(total.receivable);if(small)small.textContent='saldo de clientes'}
    });
  }
  function patchV42TripResults(){
    const byName=new Map((state.trips||[]).map(t=>[norm(t.name),tripFinance(t)]));
    document.querySelectorAll('.v42Perf').forEach(card=>{
      const name=norm(card.querySelector('.v42PerfHead strong')?.textContent||''),f=byName.get(name);if(!f)return;
      const spans=[...card.querySelectorAll('.v42PerfNums span')],expenseSpan=spans.find(x=>/^despesas|^previsto|^custos/.test(norm(x.textContent))),resultEl=card.querySelector('.v42PerfNums b');
      if(expenseSpan)expenseSpan.textContent=`${f.source==='planned'?'Previsto':'Despesas'} ${money(f.expense)}`;
      if(resultEl)resultEl.textContent=`Resultado ${money(f.result)}`;
    });
  }

  async function reloadExpenses(){
    try{const snap=await db.collection('expenses').get();state.expenses=snap.docs.map(d=>({id:d.id,...d.data()}));return state.expenses}catch(e){console.warn('reload expenses',e);return state.expenses||[]}
  }
  async function loadRecurringBusinessExpenses(force=false){
    if(recurringLoaded&&!force)return recurringItems;
    if(!canManageRecurring()){recurringLoaded=true;recurringItems=[];return recurringItems}
    try{
      const snap=await db.collection('settings').doc(RECURRING_SETTINGS).get();
      recurringItems=snap.exists&&Array.isArray(snap.data()?.items)?snap.data().items:[];
    }catch(e){console.warn('recurring expenses',e);recurringItems=[]}
    recurringLoaded=true;return recurringItems;
  }
  async function saveRecurringBusinessExpenses(items){
    recurringItems=items;recurringLoaded=true;
    await db.collection('settings').doc(RECURRING_SETTINGS).set({items,updated_at:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});
  }
  function recurringApplies(item,month){
    if(item?.active===false)return false;
    const start=String(item?.start_month||'').slice(0,7),end=String(item?.end_month||'').slice(0,7);
    return !!start&&month>=start&&(!end||month<=end);
  }
  function occurrenceId(seriesId,month){return `business_recurring_${String(seriesId).replace(/[^a-zA-Z0-9_-]/g,'')}_${month.replace('-','')}`}
  async function ensureRecurringBusinessExpenses(month=currentFinanceMonth(),forcePendingUpdate=false){
    if(!canManageRecurring()||typeof db==='undefined')return;
    const key=`${month}|${forcePendingUpdate?'1':'0'}`;if(recurringEnsuring===key)return;
    recurringEnsuring=key;
    try{
      const items=await loadRecurringBusinessExpenses(forcePendingUpdate),existing=businessExpenseRowsForMonth(month),byParent=new Map(existing.filter(e=>e.recurring_parent_id).map(e=>[e.recurring_parent_id,e])),batch=db.batch();let changed=false;
      for(const item of items.filter(x=>recurringApplies(x,month))){
        const id=occurrenceId(item.id,month),old=byParent.get(item.id),due=monthExpenseDate(month,item.due_day||10);
        const payload={expense_scope:ADMIN_SCOPE,trip_id:'',trip_name:'ADMINISTRATIVO',description:item.description||'Despesa fixa',category:item.category||'Outros',cost_mode:'fixed',amount:num(item.amount),unit_amount:num(item.amount),competence:month,expense_date:monthExpenseDate(month,1),due_date:due,recurring_parent_id:item.id,recurring_monthly:true,updated_at:firebase.firestore.FieldValue.serverTimestamp()};
        if(!old){batch.set(db.collection('expenses').doc(id),{...payload,payment_status:'pending',status:'pending',paid_date:'',created_at:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});changed=true}
        else if(forcePendingUpdate&&!expensePaid(old)){batch.set(db.collection('expenses').doc(old.id),payload,{merge:true});changed=true}
      }
      if(changed){await batch.commit();await reloadExpenses()}
    }catch(e){console.warn('ensure recurring expenses',e)}finally{recurringEnsuring=''}
  }
  window.ensureRecurringBusinessExpenses=ensureRecurringBusinessExpenses;

  window.openBusinessExpenseModal=async function(id='',seriesId=''){
    if(!canFinance())return alert('Seu perfil não pode alterar o financeiro.');
    await loadRecurringBusinessExpenses();
    let row=id?(state.expenses||[]).find(e=>e.id===id):null;
    let series=seriesId?recurringItems.find(x=>x.id===seriesId):row?.recurring_parent_id?recurringItems.find(x=>x.id===row.recurring_parent_id):null;
    const recurring=!!series||(!id&&canManageRecurring());
    const month=String(series?.start_month||row?.competence||row?.expense_date||currentFinanceMonth()).slice(0,7)||currentFinanceMonth();
    const dueDay=Number(series?.due_day||String(row?.due_date||'').slice(8,10)||10)||10;
    const due=String(row?.due_date||monthExpenseDate(month,dueDay)).slice(0,10);
    const paid=expensePaid(row||{payment_status:'pending'});
    document.querySelector('#businessExpenseModal')?.remove();
    const back=document.createElement('div');back.id='businessExpenseModal';back.className='modalBack';
    back.innerHTML=`<div class="modal" style="max-width:760px"><div class="modalHead"><div><span class="eyebrow">FINANCEIRO</span><h2>${series?'Editar despesa recorrente':id?'Editar despesa':'Nova despesa fixa'}</h2><p>Use mensal para contadora, empréstimo, seguro, impostos e outros pagamentos que se repetem.</p></div><button class="iconClose" type="button" data-close>✕</button></div><form id="businessExpenseForm"><div class="modalBody"><div class="formGrid"><label><span>Descrição</span><input name="description" required value="${escapeHtml(series?.description||row?.description||'')}" placeholder="Ex.: Contadora"></label><label><span>Categoria</span><select name="category"><option>Contabilidade</option><option>Seguro de vida</option><option>Empréstimo</option><option>Impostos</option><option>Taxas bancárias</option><option>Sistemas / Software</option><option>Marketing</option><option>Outros</option></select></label><label><span>Valor mensal</span><input name="amount" type="number" min="0.01" step="0.01" required value="${num(series?.amount||row?.amount||row?.unit_amount)||''}"></label><label><span>Repetição</span><select name="recurrence" ${!canManageRecurring()?'disabled':''}><option value="monthly">TODO MÊS</option><option value="once">SOMENTE ESTE MÊS</option></select></label><label><span>Mês inicial</span><input name="start_month" type="month" required value="${escapeHtml(month)}"></label><label class="endMonthField"><span>Mês final (opcional)</span><input name="end_month" type="month" value="${escapeHtml(series?.end_month||'')}"></label><label class="dueDayField"><span>Dia do vencimento</span><input name="due_day" type="number" min="1" max="28" value="${Math.max(1,Math.min(28,dueDay))}"></label><label class="onceDueField"><span>Vencimento</span><input name="due_date" type="date" value="${escapeHtml(due)}"></label><label class="onceStatusField"><span>Status</span><select name="payment_status"><option value="pending">A PAGAR</option><option value="paid">PAGA</option></select></label></div><p style="margin:14px 0 0;color:#667a72;font-size:12px">Em <b>TODO MÊS</b>, o sistema gera automaticamente a conta daquele mês como <b>A PAGAR</b>. Para empréstimos, você pode informar um mês final. Histórico pago não é alterado.</p></div><div class="modalFoot"><button class="btn ghost" type="button" data-close>Cancelar</button><button class="btn primary" type="submit">Salvar</button></div></form></div>`;
    document.body.appendChild(back);
    const form=back.querySelector('#businessExpenseForm');
    form.category.value=series?.category||row?.category||'Contabilidade';
    form.payment_status.value=paid?'paid':'pending';
    form.recurrence.value=recurring?'monthly':'once';
    const syncFields=()=>{const monthly=form.recurrence.value==='monthly';back.querySelector('.endMonthField').style.display=monthly?'':'none';back.querySelector('.dueDayField').style.display=monthly?'':'none';back.querySelector('.onceDueField').style.display=monthly?'none':'';back.querySelector('.onceStatusField').style.display=monthly?'none':''};
    form.recurrence.onchange=syncFields;syncFields();
    back.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>back.remove());
    form.onsubmit=async e=>{
      e.preventDefault();const f=e.currentTarget,amount=num(f.amount.value),monthly=f.recurrence.value==='monthly',start=f.start_month.value;if(!amount||!start)return;
      try{
        if(monthly){
          if(!canManageRecurring())throw Error('Somente proprietário/administrador pode criar recorrência.');
          const seriesId=series?.id||`rec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`;
          const item={id:seriesId,description:f.description.value.trim(),category:f.category.value,amount,due_day:Math.max(1,Math.min(28,Number(f.due_day.value)||10)),start_month:start,end_month:f.end_month.value||'',active:true};
          const next=recurringItems.filter(x=>x.id!==seriesId);next.push(item);await saveRecurringBusinessExpenses(next);await ensureRecurringBusinessExpenses(currentFinanceMonth(),true);
          try{await window.auditV7?.(series?'recurring_expense_updated':'recurring_expense_created','expense',seriesId,`${item.description} • ${money(amount)}/mês`,{scope:ADMIN_SCOPE,start_month:start,end_month:item.end_month})}catch(_){ }
        }else{
          const due=f.due_date.value||monthExpenseDate(start,10),paymentStatus=f.payment_status.value,data={expense_scope:ADMIN_SCOPE,trip_id:'',trip_name:'ADMINISTRATIVO',description:f.description.value.trim(),category:f.category.value,cost_mode:'fixed',amount,unit_amount:amount,competence:start,expense_date:monthExpenseDate(start,1),due_date:due,payment_status:paymentStatus,status:paymentStatus==='paid'?'paid':'pending',paid_date:paymentStatus==='paid'?(row?.paid_date||localToday()):'',recurring_monthly:false,updated_at:firebase.firestore.FieldValue.serverTimestamp()};
          if(id&&!row?.recurring_parent_id)await db.collection('expenses').doc(id).update(data);else await db.collection('expenses').add({...data,created_at:firebase.firestore.FieldValue.serverTimestamp()});
          try{await window.auditV7?.(id?'business_expense_updated':'business_expense_created','expense',id||'',`${data.description} • ${money(amount)}`,{scope:ADMIN_SCOPE,competence:start})}catch(_){ }
        }
        back.remove();await reloadExpenses();renderAdmin();scheduleApply();
      }catch(err){console.error(err);alert(err?.message||'Não foi possível salvar a despesa fixa.')}
    };
  };
  window.toggleBusinessExpensePaid=async function(id){
    if(!canFinance())return;const e=(state.expenses||[]).find(x=>x.id===id);if(!e)return;
    const paid=!expensePaid(e);try{await db.collection('expenses').doc(id).update({payment_status:paid?'paid':'pending',status:paid?'paid':'pending',paid_date:paid?localToday():'',updated_at:firebase.firestore.FieldValue.serverTimestamp()});await reloadExpenses();renderAdmin();scheduleApply()}catch(err){console.error(err);alert('Não foi possível atualizar o pagamento.')}
  };
  window.deleteBusinessExpense=async function(id){
    if(!canFinance())return;const e=(state.expenses||[]).find(x=>x.id===id);if(!e)return;
    if(e.recurring_parent_id)return window.disableRecurringBusinessExpense(e.recurring_parent_id);
    if(!confirm(`Excluir a despesa “${e.description||e.category||'Despesa'}”?`))return;
    try{await db.collection('expenses').doc(id).delete();await reloadExpenses();renderAdmin();scheduleApply()}catch(err){console.error(err);alert('Não foi possível excluir a despesa.')}
  };
  window.disableRecurringBusinessExpense=async function(seriesId){
    if(!canManageRecurring())return alert('Somente proprietário/administrador pode encerrar uma despesa recorrente.');
    await loadRecurringBusinessExpenses();const item=recurringItems.find(x=>x.id===seriesId);if(!item||!confirm(`Encerrar a recorrência de “${item.description}”? Os meses já registrados serão preservados.`))return;
    const next=recurringItems.map(x=>x.id===seriesId?{...x,active:false,end_month:currentFinanceMonth()}:x);try{await saveRecurringBusinessExpenses(next);renderAdmin();scheduleApply()}catch(err){console.error(err);alert('Não foi possível encerrar a recorrência.')}
  };

  async function injectBusinessExpensePanel(){
    if(state?.tab!=='finance')return;const content=document.querySelector('#content');if(!content)return;const month=currentFinanceMonth();
    await ensureRecurringBusinessExpenses(month);if(state?.tab!=='finance'||currentFinanceMonth()!==month)return;
    const rows=businessExpenseRowsForMonth(month);let box=document.querySelector('#businessExpensesPanel');
    if(!box){box=document.createElement('section');box.id='businessExpensesPanel';box.className='panel';const anchor=document.querySelector('#v42FinanceDash',content);anchor?.after?anchor.after(box):content.prepend(box)}
    const total=rows.reduce((s,e)=>s+expenseAmount(e,0),0),paid=rows.filter(expensePaid).reduce((s,e)=>s+expenseAmount(e,0),0),open=rows.filter(e=>!expensePaid(e)).reduce((s,e)=>s+expenseAmount(e,0),0);
    box.innerHTML=`<div class="panelHead"><div><span class="eyebrow">DESPESAS FIXAS</span><h2>Administrativo • ${escapeHtml(month)}</h2><p>Contadora, empréstimos, seguros, impostos e outros custos mensais da empresa.</p></div><button class="btn primary" onclick="openBusinessExpenseModal()">+ Nova despesa fixa</button></div><div class="dayStats"><div><span>Total do mês</span><strong>${money(total)}</strong></div><div><span>Pago</span><strong>${money(paid)}</strong></div><div><span>A pagar</span><strong>${money(open)}</strong></div></div><div class="tableWrap" style="margin-top:14px"><table class="table"><thead><tr><th>Descrição</th><th>Categoria</th><th>Vencimento</th><th>Repetição</th><th>Status</th><th>Valor</th><th>Ações</th></tr></thead><tbody>${rows.length?rows.map(e=>`<tr><td><strong>${escapeHtml(e.description||'Despesa')}</strong></td><td>${escapeHtml(e.category||'Outros')}</td><td>${String(e.due_date||'').split('-').reverse().join('/')||'—'}</td><td>${e.recurring_parent_id?'<span class="pill active">TODO MÊS</span>':'ÚNICA'}</td><td><button class="pill ${expensePaid(e)?'active':'pending'}" style="border:0;cursor:pointer" onclick="toggleBusinessExpensePaid('${e.id}')">${expensePaid(e)?'PAGA':'A PAGAR'}</button></td><td><strong>${money(expenseAmount(e,0))}</strong></td><td><div class="actions"><button onclick="openBusinessExpenseModal('${e.id}','${e.recurring_parent_id||''}')" title="Editar">✎</button><button class="dangerMini" onclick="deleteBusinessExpense('${e.id}')" title="${e.recurring_parent_id?'Encerrar recorrência':'Excluir'}">⌫</button></div></td></tr>`).join(''):'<tr><td colspan="7">Nenhuma despesa fixa administrativa nesta competência.</td></tr>'}</tbody></table></div>`;
  }

  function paidExpenseMonth(e){return String(e?.paid_date||e?.expense_date||e?.updated_at||e?.created_at||'').slice(0,7)}
  function monthlyPaidClosure(month=currentFinanceMonth()){
    const rows=(state.expenses||[]).filter(e=>expensePaid(e)&&paidExpenseMonth(e)===month).map(e=>{
      const admin=isBusinessExpense(e),trip=(state.trips||[]).find(t=>t.id===e.trip_id),seats=trip?activeSeats(trip.id):0;
      return{...e,total:expenseAmount(e,seats),admin,origin:admin?'ADMINISTRATIVO':(trip?.name||e.trip_name||'Passeio'),paidDate:String(e.paid_date||e.expense_date||'').slice(0,10)};
    }).sort((a,b)=>String(a.paidDate).localeCompare(String(b.paidDate)));
    const tripPaid=rows.filter(x=>!x.admin).reduce((s,x)=>s+x.total,0),adminPaid=rows.filter(x=>x.admin).reduce((s,x)=>s+x.total,0),totalPaid=tripPaid+adminPaid;
    return{month,rows,tripPaid,adminPaid,totalPaid};
  }
  function patchMonthlyExpenseClosure(){
    const modal=document.querySelector('#v42MonthlyModal');if(!modal)return;
    const section=[...modal.querySelectorAll('section')].find(s=>norm(s.querySelector('h3')?.textContent||'')==='despesas pagas no mes');if(!section)return;
    const c=monthlyPaidClosure(currentFinanceMonth());
    section.innerHTML=`<h3>Fechamento das despesas pagas no mês</h3><p style="margin:4px 0 12px;color:#667a72;font-size:12px">Somente valores realmente marcados como <b>PAGA</b>. Soma despesas dos passeios + despesas fixas/administrativas pagas dentro deste mês.</p><div class="dayStats" style="margin-bottom:14px"><div><span>Passeios pagos</span><strong>${money(c.tripPaid)}</strong></div><div><span>Fixas / administrativo</span><strong>${money(c.adminPaid)}</strong></div><div><span>TOTAL PAGO NO MÊS</span><strong>${money(c.totalPaid)}</strong></div></div><div class="tableWrap"><table class="table"><thead><tr><th>Data do pagamento</th><th>Origem</th><th>Despesa</th><th>Categoria</th><th>Valor pago</th></tr></thead><tbody>${c.rows.length?c.rows.map(e=>`<tr><td>${brDate(e.paidDate)}</td><td><strong>${escapeHtml(e.origin)}</strong></td><td>${escapeHtml(e.description||e.category||'Despesa')}</td><td>${escapeHtml(e.category||'Outros')}</td><td><strong>${money(e.total)}</strong></td></tr>`).join(''):`<tr><td colspan="5">Nenhuma despesa foi marcada como paga nesta competência. Custos apenas previstos não entram como pagamento.</td></tr>`}</tbody><tfoot><tr><td colspan="4"><strong>TOTAL PAGO NO MÊS</strong></td><td><strong>${money(c.totalPaid)}</strong></td></tr></tfoot></table></div>`;
  }
  function scheduleMonthlyClosure(){[180,500,1000].forEach(ms=>setTimeout(patchMonthlyExpenseClosure,ms))}

  function financeSelfTest(){
    const planned=(items,seats)=>items.filter(x=>x.mode!=='per_person').reduce((s,x)=>s+num(x.amount),0)+items.filter(x=>x.mode==='per_person').reduce((s,x)=>s+num(x.amount),0)*seats;
    const cases=[planned([{mode:'per_person',amount:50}],13)===650,planned([{mode:'fixed',amount:1000},{mode:'per_person',amount:50}],10)===1500,planned([{mode:'fixed',amount:300}],0)===300,expenseAmount({cost_mode:'per_person',amount:40,status:'pending'},5)===200,expenseAmount({cost_mode:'fixed',amount:400,status:'paid'},5)===400,reservationReceivable({sale_total:500,paid_amount:200,status:'active'},{default_price:0})===300,recurringApplies({active:true,start_month:'2026-01',end_month:''},'2026-09')===true,recurringApplies({active:true,start_month:'2026-01',end_month:'2026-08'},'2026-09')===false];
    return{ok:cases.every(Boolean),passed:cases.filter(Boolean).length,total:cases.length};
  }
  function systemHealth(){
    const self=financeSelfTest(),orphanExpenses=(state.expenses||[]).filter(e=>e.trip_id&&!(state.trips||[]).some(t=>t.id===e.trip_id)).length,duplicateKeys=new Map();
    (state.trips||[]).forEach(t=>{const k=`${norm(t.name)}|${String(t.trip_date||'').slice(0,10)}`;duplicateKeys.set(k,(duplicateKeys.get(k)||0)+1)});
    return{finance:self.ok,firestore:typeof db!=='undefined',auth:typeof auth!=='undefined'&&!!auth.currentUser,online:navigator.onLine,push:typeof Notification==='undefined'?'unsupported':Notification.permission,orphanExpenses,duplicateTrips:[...duplicateKeys.values()].filter(v=>v>1).length};
  }
  function healthDot(ok){return `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${ok?'#168a62':'#d19a23'};margin-right:6px"></span>`}
  function injectHealthPanel(){
    if(state?.tab!=='dashboard')return;const content=document.querySelector('#content');if(!content)return;let box=document.querySelector('#systemHealthCard');
    if(!box){box=document.createElement('section');box.id='systemHealthCard';box.className='panel';box.style.marginTop='16px';content.appendChild(box)}
    const h=systemHealth(),sync=state.sync instanceof Date?state.sync.toLocaleTimeString('pt-BR'):'aguardando';
    box.innerHTML=`<div class="panelHead"><div><span class="eyebrow">SAÚDE DO SISTEMA</span><h2>Verificação automática</h2><p>Checagens locais do financeiro, Firebase, sincronização e integridade dos passeios.</p></div><small>Build ${BUILD}</small></div><div class="dayStats"><div><span>${healthDot(h.finance)}Financeiro</span><strong>${h.finance?'OK':'ATENÇÃO'}</strong></div><div><span>${healthDot(h.firestore&&h.auth)}Firebase</span><strong>${h.firestore&&h.auth?'OK':'VERIFICAR'}</strong></div><div><span>${healthDot(h.online)}Conexão</span><strong>${h.online?'Online':'Offline'}</strong></div><div><span>${healthDot(h.orphanExpenses===0&&h.duplicateTrips===0)}Integridade</span><strong>${h.orphanExpenses===0&&h.duplicateTrips===0?'OK':'REVISAR'}</strong></div></div><p style="margin:12px 0 0;color:#667a72;font-size:12px">Sincronização: ${sync} • Push: ${h.push==='granted'?'permitido':h.push==='denied'?'bloqueado':h.push==='default'?'aguardando permissão':h.push} • Despesas sem passeio: ${h.orphanExpenses} • Possíveis duplicidades: ${h.duplicateTrips}</p>`;
  }
  function applyFinancialPreview(){refreshTripFinancialPreview();requestAnimationFrame(()=>{patchDashboardMetrics();patchV42TripResults();injectHealthPanel();injectBusinessExpensePanel();patchMonthlyExpenseClosure()})}
  function scheduleApply(){[80,350,900].forEach(ms=>setTimeout(applyFinancialPreview,ms))}
  function installFinalRenderWrapper(){
    const current=window.renderAdmin;if(typeof current!=='function'||current.__tripCostPreviewFixed)return;
    const wrapped=function(...args){refreshTripFinancialPreview();const out=current.apply(this,args);scheduleApply();return out};wrapped.__tripCostPreviewFixed=true;window.renderAdmin=wrapped;try{renderAdmin=wrapped}catch(_){ }
  }
  window.TrilheirosFinance={BUILD,activeSeats,plannedCostDetails,expenseAmount,expensePaid,expenseMode,reservationTotal,reservationReceivable,totalReceivable,revenueForTrip,tripFinance,totals:financeTotals,monthlyPaidClosure,selfTest:financeSelfTest,health:systemHealth,refresh:applyFinancialPreview,ensureRecurringBusinessExpenses};
  window.setNetworkUI=function(){const online=navigator.onLine,b=document.querySelector('#networkBadge');if(b){b.textContent=online?'● Online':'● Offline';b.className='networkBadge '+(online?'online':'offline')}const s=document.querySelector('#sync');if(s&&!online){s.textContent='☁ Offline • dados locais';s.classList.add('offline')}};
  window.updateNotificationBadge=function(){const count=(state.notifications||[]).filter(n=>!n.read).length,b=document.querySelector('#notifyCount');if(b)b.textContent=count?String(count):'';const s=document.querySelector('#sideNotifyCount');if(s)s.textContent=count?`(${count})`:''};

  installFinalRenderWrapper();
  window.addEventListener('DOMContentLoaded',()=>{installFinalRenderWrapper();scheduleApply();setTimeout(()=>installFinalRenderWrapper(),1200)});
  document.addEventListener('click',e=>{
    const report=e.target?.closest?.('#v42MonthlyReport,#v36Monthly');
    if(report){e.preventDefault();e.stopImmediatePropagation();(async()=>{const month=currentFinanceMonth();await ensureRecurringBusinessExpenses(month);await reloadExpenses();if(typeof window.openMonthlyReportV34==='function')window.openMonthlyReportV34(month);scheduleMonthlyClosure()})()}
    else if(['dashboard','finance'].includes(state?.tab))scheduleApply();
  },true);
  window.addEventListener('online',()=>{setNetworkUI();scheduleApply()});
  window.addEventListener('offline',()=>{setNetworkUI();scheduleApply()});
})();
