/* Compatibilidade entre V6 e V7: rede, notificações, financeiro central e saúde do painel. */
(function(){
  const num=v=>Math.max(0,Number(v||0)||0);
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v||0));
  const BUILD='20260911-financecore2';
  const ADMIN_SCOPE='business';

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
    const items=normalizedCostItems(trip),fixed=items.filter(x=>x.mode!=='per_person').reduce((sum,x)=>sum+num(x.amount),0),perPerson=items.filter(x=>x.mode==='per_person').reduce((sum,x)=>sum+num(x.amount),0);
    return{items,fixed,perPerson,total:fixed+(perPerson*num(seats))};
  }
  function expensePaid(expense){return !['pending','open','unpaid','to_pay','payable'].includes(String(expense?.payment_status||expense?.status||'').toLowerCase())}
  function expenseMode(expense){
    if(expense?.cost_mode==='per_person')return'per_person';
    if(expense?.cost_mode==='fixed')return'fixed';
    return /aliment|hosped|hotel|camping|seguro|ingresso|entrada|day use|atrativo|refeic|lanche/.test(norm(`${expense?.category||''} ${expense?.description||''}`))?'per_person':'fixed';
  }
  function expenseAmount(expense,seats){
    const unit=num(expense?.unit_amount||expense?.amount);
    if(expenseMode(expense)==='per_person'){
      const qty=expensePaid(expense)&&num(expense?.quantity_basis)>0?num(expense.quantity_basis):num(seats);
      return unit*qty;
    }
    return num(expense?.amount)>0?num(expense.amount):unit;
  }
  function isBusinessExpense(e){return e?.expense_scope===ADMIN_SCOPE||(!e?.trip_id&&String(e?.trip_name||'').toUpperCase()==='ADMINISTRATIVO')}
  function businessExpenses(){return (state.expenses||[]).filter(isBusinessExpense)}
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
    const total=reservationTotal(r,trip),paid=num(r?.paid_amount),refunded=num(r?.refunded_amount);
    return Math.max(0,total-paid+refunded);
  }
  function totalReceivable(){
    return (state.reservations||[]).reduce((sum,r)=>sum+reservationReceivable(r,(state.trips||[]).find(t=>t.id===r.trip_id)),0);
  }

  function revenueForTrip(trip){
    const rows=reservationsForTrip(trip.id),fromReservations=rows.reduce((sum,r)=>sum+reservationTotal(r,trip),0);
    return fromReservations>0?fromReservations:num(trip.net_revenue||trip.gross_revenue);
  }
  function tripFinance(trip){
    const seats=activeSeats(trip.id),planned=plannedCostDetails(trip,seats),rows=(state.expenses||[]).filter(e=>e.trip_id===trip.id),paidRows=rows.filter(expensePaid),openRows=rows.filter(e=>!expensePaid(e)),paid=paidRows.reduce((sum,e)=>sum+expenseAmount(e,seats),0),open=openRows.reduce((sum,e)=>sum+expenseAmount(e,seats),0),actual=paid+open,hasActual=rows.length>0,expense=hasActual?actual:planned.total,revenue=revenueForTrip(trip),receivable=reservationsForTrip(trip.id).reduce((sum,r)=>sum+reservationReceivable(r,trip),0);
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

  function currentFinanceMonth(){return state.financeMonthV42||state.financeMonthV41||new Date().toLocaleDateString('en-CA',{timeZone:'America/Cuiaba'}).slice(0,7)}
  function monthExpenseDate(month,day=1){const d=Math.max(1,Math.min(28,Number(day)||1));return `${month}-${String(d).padStart(2,'0')}`}
  function businessExpenseRowsForMonth(month){
    return businessExpenses().filter(e=>String(e.competence||e.expense_date||e.due_date||'').slice(0,7)===month).sort((a,b)=>String(a.due_date||a.expense_date||'').localeCompare(String(b.due_date||b.expense_date||'')));
  }
  async function reloadExpenses(){
    try{const snap=await db.collection('expenses').get();state.expenses=snap.docs.map(d=>({id:d.id,...d.data()}));return state.expenses}catch(e){console.warn('reload expenses',e);return state.expenses||[]}
  }
  function canFinance(){return ['owner','admin','finance'].includes(state?.role||'')}
  function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}

  window.openBusinessExpenseModal=async function(id=''){
    if(!canFinance())return alert('Seu perfil não pode alterar o financeiro.');
    let row=id?(state.expenses||[]).find(e=>e.id===id):null;
    const month=String(row?.competence||row?.expense_date||currentFinanceMonth()).slice(0,7)||currentFinanceMonth();
    const due=String(row?.due_date||row?.expense_date||monthExpenseDate(month,10)).slice(0,10);
    const paid=expensePaid(row||{payment_status:'pending'});
    document.querySelector('#businessExpenseModal')?.remove();
    const back=document.createElement('div');back.id='businessExpenseModal';back.className='modalBack';
    back.innerHTML=`<div class="modal" style="max-width:720px"><div class="modalHead"><div><span class="eyebrow">FINANCEIRO</span><h2>${id?'Editar':'Nova'} despesa fixa</h2><p>Contadora, seguro de vida, empréstimos, impostos e demais custos administrativos.</p></div><button class="iconClose" type="button" data-close>✕</button></div><form id="businessExpenseForm"><div class="modalBody"><div class="formGrid"><label><span>Descrição</span><input name="description" required value="${escapeHtml(row?.description||'') }" placeholder="Ex.: Contadora"></label><label><span>Categoria</span><select name="category"><option>Contabilidade</option><option>Seguro de vida</option><option>Empréstimo</option><option>Impostos</option><option>Taxas bancárias</option><option>Sistemas / Software</option><option>Marketing</option><option>Outros</option></select></label><label><span>Valor mensal</span><input name="amount" type="number" min="0.01" step="0.01" required value="${num(row?.amount||row?.unit_amount)||''}"></label><label><span>Competência</span><input name="competence" type="month" required value="${escapeHtml(month)}"></label><label><span>Vencimento</span><input name="due_date" type="date" required value="${escapeHtml(due)}"></label><label><span>Status</span><select name="payment_status"><option value="pending">A PAGAR</option><option value="paid">PAGA</option></select></label></div><p style="margin:14px 0 0;color:#667a72;font-size:12px">Esta despesa entra no fechamento mensal como <b>ADMINISTRATIVO</b> e não é misturada com o custo de nenhum passeio.</p></div><div class="modalFoot"><button class="btn ghost" type="button" data-close>Cancelar</button><button class="btn primary" type="submit">Salvar despesa</button></div></form></div>`;
    document.body.appendChild(back);
    const form=back.querySelector('#businessExpenseForm'),cat=form.category,status=form.payment_status;
    cat.value=row?.category||'Contabilidade';status.value=paid?'paid':'pending';
    back.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>back.remove());
    form.onsubmit=async e=>{
      e.preventDefault();const f=e.currentTarget,amount=num(f.amount.value),competence=f.competence.value,due=f.due_date.value,paymentStatus=f.payment_status.value;
      if(!amount||!competence||!due)return;
      const data={expense_scope:ADMIN_SCOPE,trip_id:'',trip_name:'ADMINISTRATIVO',description:f.description.value.trim(),category:f.category.value,cost_mode:'fixed',amount,unit_amount:amount,competence,expense_date:monthExpenseDate(competence,1),due_date:due,payment_status:paymentStatus,status:paymentStatus==='paid'?'paid':'pending',paid_date:paymentStatus==='paid'?(row?.paid_date||new Date().toLocaleDateString('en-CA',{timeZone:'America/Cuiaba'})):'',updated_at:firebase.firestore.FieldValue.serverTimestamp()};
      try{
        if(id)await db.collection('expenses').doc(id).update(data);else await db.collection('expenses').add({...data,created_at:firebase.firestore.FieldValue.serverTimestamp()});
        try{await window.auditV7?.(id?'business_expense_updated':'business_expense_created','expense',id||'',`${data.description} • ${money(amount)}`,{scope:ADMIN_SCOPE,competence})}catch(_){ }
        back.remove();await reloadExpenses();renderAdmin();scheduleApply();
      }catch(err){console.error(err);alert('Não foi possível salvar a despesa fixa. Verifique sua conexão e permissão.')}
    };
  };
  window.deleteBusinessExpense=async function(id){
    if(!canFinance())return;const e=(state.expenses||[]).find(x=>x.id===id);if(!e||!confirm(`Excluir a despesa “${e.description||e.category||'Despesa'}”?`))return;
    try{await db.collection('expenses').doc(id).delete();try{await window.auditV7?.('business_expense_deleted','expense',id,e.description||e.category||'Despesa',{scope:ADMIN_SCOPE})}catch(_){ }await reloadExpenses();renderAdmin();scheduleApply()}catch(err){console.error(err);alert('Não foi possível excluir a despesa.')}
  };
  function injectBusinessExpensePanel(){
    if(state?.tab!=='finance')return;const content=document.querySelector('#content');if(!content)return;
    const month=currentFinanceMonth(),rows=businessExpenseRowsForMonth(month);let box=document.querySelector('#businessExpensesPanel');
    if(!box){box=document.createElement('section');box.id='businessExpensesPanel';box.className='panel';const anchor=document.querySelector('#v42FinanceDash',content);anchor?.after?anchor.after(box):content.prepend(box)}
    const total=rows.reduce((s,e)=>s+expenseAmount(e,0),0),paid=rows.filter(expensePaid).reduce((s,e)=>s+expenseAmount(e,0),0),open=rows.filter(e=>!expensePaid(e)).reduce((s,e)=>s+expenseAmount(e,0),0);
    box.innerHTML=`<div class="panelHead"><div><span class="eyebrow">DESPESAS FIXAS</span><h2>Administrativo • ${escapeHtml(month)}</h2><p>Custos da empresa que não pertencem a um passeio específico e entram no relatório mensal.</p></div><button class="btn primary" onclick="openBusinessExpenseModal()">+ Nova despesa fixa</button></div><div class="dayStats"><div><span>Total do mês</span><strong>${money(total)}</strong></div><div><span>Pago</span><strong>${money(paid)}</strong></div><div><span>A pagar</span><strong>${money(open)}</strong></div></div><div class="tableWrap" style="margin-top:14px"><table class="table"><thead><tr><th>Descrição</th><th>Categoria</th><th>Vencimento</th><th>Status</th><th>Valor</th><th>Ações</th></tr></thead><tbody>${rows.length?rows.map(e=>`<tr><td><strong>${escapeHtml(e.description||'Despesa')}</strong></td><td>${escapeHtml(e.category||'Outros')}</td><td>${String(e.due_date||'').split('-').reverse().join('/')||'—'}</td><td><span class="pill ${expensePaid(e)?'active':'pending'}">${expensePaid(e)?'PAGA':'A PAGAR'}</span></td><td><strong>${money(expenseAmount(e,0))}</strong></td><td><div class="actions"><button onclick="openBusinessExpenseModal('${e.id}')" title="Editar">✎</button><button class="dangerMini" onclick="deleteBusinessExpense('${e.id}')" title="Excluir">⌫</button></div></td></tr>`).join(''):'<tr><td colspan="6">Nenhuma despesa fixa administrativa nesta competência.</td></tr>'}</tbody></table></div>`;
  }

  function financeSelfTest(){
    const planned=(items,seats)=>items.filter(x=>x.mode!=='per_person').reduce((s,x)=>s+num(x.amount),0)+items.filter(x=>x.mode==='per_person').reduce((s,x)=>s+num(x.amount),0)*seats;
    const cases=[planned([{mode:'per_person',amount:50}],13)===650,planned([{mode:'fixed',amount:1000},{mode:'per_person',amount:50}],10)===1500,planned([{mode:'fixed',amount:300}],0)===300,expenseAmount({cost_mode:'per_person',amount:40,status:'pending'},5)===200,expenseAmount({cost_mode:'fixed',amount:400,status:'paid'},5)===400,reservationReceivable({sale_total:500,paid_amount:200,status:'active'},{default_price:0})===300,reservationReceivable({sale_total:500,paid_amount:500,status:'active'},{default_price:0})===0];
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
  function applyFinancialPreview(){refreshTripFinancialPreview();requestAnimationFrame(()=>{patchDashboardMetrics();patchV42TripResults();injectHealthPanel();injectBusinessExpensePanel()})}
  function scheduleApply(){[80,350,900].forEach(ms=>setTimeout(applyFinancialPreview,ms))}
  function installFinalRenderWrapper(){
    const current=window.renderAdmin;if(typeof current!=='function'||current.__tripCostPreviewFixed)return;
    const wrapped=function(...args){refreshTripFinancialPreview();const out=current.apply(this,args);scheduleApply();return out};wrapped.__tripCostPreviewFixed=true;window.renderAdmin=wrapped;try{renderAdmin=wrapped}catch(_){ }
  }
  window.TrilheirosFinance={BUILD,activeSeats,plannedCostDetails,expenseAmount,expensePaid,expenseMode,reservationTotal,reservationReceivable,totalReceivable,revenueForTrip,tripFinance,totals:financeTotals,selfTest:financeSelfTest,health:systemHealth,refresh:applyFinancialPreview};
  window.setNetworkUI=function(){const online=navigator.onLine,b=document.querySelector('#networkBadge');if(b){b.textContent=online?'● Online':'● Offline';b.className='networkBadge '+(online?'online':'offline')}const s=document.querySelector('#sync');if(s&&!online){s.textContent='☁ Offline • dados locais';s.classList.add('offline')}};
  window.updateNotificationBadge=function(){const count=(state.notifications||[]).filter(n=>!n.read).length,b=document.querySelector('#notifyCount');if(b)b.textContent=count?String(count):'';const s=document.querySelector('#sideNotifyCount');if(s)s.textContent=count?`(${count})`:''};
  installFinalRenderWrapper();
  window.addEventListener('DOMContentLoaded',()=>{installFinalRenderWrapper();scheduleApply();setTimeout(()=>installFinalRenderWrapper(),1200)});
  document.addEventListener('click',scheduleApply,true);
  window.addEventListener('online',()=>{setNetworkUI();scheduleApply()});
  window.addEventListener('offline',()=>{setNetworkUI();scheduleApply()});
})();