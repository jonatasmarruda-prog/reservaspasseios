/* Compatibilidade entre V6 e V7: rede, notificações, financeiro central e saúde do painel. */
(function(){
  const num=v=>Math.max(0,Number(v||0)||0);
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v||0));
  const BUILD='20260911-financecore1';

  function reservationsForTrip(tripId){
    return (state.reservations||[]).filter(r=>r.trip_id===tripId&&r.status!=='cancelled');
  }

  function activeSeats(tripId){
    return reservationsForTrip(tripId).reduce((sum,r)=>sum+num(r.seats),0);
  }

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
    const items=normalizedCostItems(trip);
    const fixed=items.filter(x=>x.mode!=='per_person').reduce((sum,x)=>sum+num(x.amount),0);
    const perPerson=items.filter(x=>x.mode==='per_person').reduce((sum,x)=>sum+num(x.amount),0);
    return{items,fixed,perPerson,total:fixed+(perPerson*num(seats))};
  }

  function expensePaid(expense){
    return !['pending','open','unpaid','to_pay','payable'].includes(String(expense?.payment_status||expense?.status||'').toLowerCase());
  }

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

  function revenueForTrip(trip){
    const rows=reservationsForTrip(trip.id);
    const fromReservations=rows.reduce((sum,r)=>{
      if(num(r.sale_total)>0)return sum+num(r.sale_total);
      const composed=num(r.paid_amount)+num(r.balance_due)-num(r.refunded_amount);
      if(composed>0)return sum+composed;
      return sum+(num(trip.default_price)*Math.max(1,num(r.seats)));
    },0);
    return fromReservations>0?fromReservations:num(trip.net_revenue||trip.gross_revenue);
  }

  function tripFinance(trip){
    const seats=activeSeats(trip.id);
    const planned=plannedCostDetails(trip,seats);
    const rows=(state.expenses||[]).filter(e=>e.trip_id===trip.id);
    const paidRows=rows.filter(expensePaid),openRows=rows.filter(e=>!expensePaid(e));
    const paid=paidRows.reduce((sum,e)=>sum+expenseAmount(e,seats),0);
    const open=openRows.reduce((sum,e)=>sum+expenseAmount(e,seats),0);
    const actual=paid+open;
    const hasActual=rows.length>0;
    const expense=hasActual?actual:planned.total;
    const revenue=revenueForTrip(trip);
    return{tripId:trip.id,seats,planned,paid,open,actual,hasActual,expense,revenue,result:revenue-expense,source:hasActual?'actual':'planned'};
  }

  function refreshTripFinancialPreview(){
    if(typeof state==='undefined')return[];
    return (state.trips||[]).map(trip=>{
      const f=tripFinance(trip);
      trip.net_revenue=f.revenue;
      trip.expenses=f.expense;
      trip.profit=f.result;
      trip.estimated_cost=f.planned.total;
      trip.display_expenses_source=f.source;
      trip.display_planned_cost=f.planned.total;
      trip.display_paid_expenses=f.paid;
      trip.display_open_expenses=f.open;
      return f;
    });
  }

  function financeTotals(){
    const trips=refreshTripFinancialPreview();
    const revenue=trips.reduce((s,x)=>s+x.revenue,0);
    const expenses=trips.reduce((s,x)=>s+x.expense,0);
    const result=revenue-expenses;
    return{trips,revenue,expenses,result,margin:revenue?result/revenue*100:0};
  }

  function patchDashboardMetrics(){
    if(typeof state==='undefined')return;
    const total=financeTotals();
    document.querySelectorAll('.metric').forEach(card=>{
      const label=norm(card.querySelector('span')?.textContent||'');
      const strong=card.querySelector('strong');
      const small=card.querySelector('small');
      if(!strong)return;
      if(label==='despesas'){
        strong.textContent=money(total.expenses);
        if(small)small.textContent='custos previstos/realizados';
      }
      if(label==='resultado'){
        strong.textContent=money(total.result);
        if(small)small.textContent=`margem ${total.margin.toFixed(1)}%`;
      }
    });
  }

  function patchV42TripResults(){
    const byName=new Map((state.trips||[]).map(t=>[norm(t.name),tripFinance(t)]));
    document.querySelectorAll('.v42Perf').forEach(card=>{
      const name=norm(card.querySelector('.v42PerfHead strong')?.textContent||'');
      const f=byName.get(name);if(!f)return;
      const spans=[...card.querySelectorAll('.v42PerfNums span')];
      const expenseSpan=spans.find(x=>/^despesas|^previsto|^custos/.test(norm(x.textContent)));
      const resultEl=card.querySelector('.v42PerfNums b');
      if(expenseSpan)expenseSpan.textContent=`${f.source==='planned'?'Previsto':'Despesas'} ${money(f.expense)}`;
      if(resultEl)resultEl.textContent=`Resultado ${money(f.result)}`;
    });
  }

  function financeSelfTest(){
    const planned=(items,seats)=>{
      const fixed=items.filter(x=>x.mode!=='per_person').reduce((s,x)=>s+num(x.amount),0);
      const pp=items.filter(x=>x.mode==='per_person').reduce((s,x)=>s+num(x.amount),0);
      return fixed+pp*seats;
    };
    const cases=[
      planned([{mode:'per_person',amount:50}],13)===650,
      planned([{mode:'fixed',amount:1000},{mode:'per_person',amount:50}],10)===1500,
      planned([{mode:'fixed',amount:300}],0)===300,
      expenseAmount({cost_mode:'per_person',amount:40,status:'pending'},5)===200,
      expenseAmount({cost_mode:'fixed',amount:400,status:'paid'},5)===400
    ];
    return{ok:cases.every(Boolean),passed:cases.filter(Boolean).length,total:cases.length};
  }

  function systemHealth(){
    const self=financeSelfTest();
    const orphanExpenses=(state.expenses||[]).filter(e=>e.trip_id&&!(state.trips||[]).some(t=>t.id===e.trip_id)).length;
    const duplicateKeys=new Map();
    (state.trips||[]).forEach(t=>{const k=`${norm(t.name)}|${String(t.trip_date||'').slice(0,10)}`;duplicateKeys.set(k,(duplicateKeys.get(k)||0)+1)});
    const duplicateTrips=[...duplicateKeys.values()].filter(v=>v>1).length;
    return{
      finance:self.ok,
      firestore:typeof db!=='undefined',
      auth:typeof auth!=='undefined'&&!!auth.currentUser,
      online:navigator.onLine,
      push:typeof Notification==='undefined'?'unsupported':Notification.permission,
      orphanExpenses,duplicateTrips
    };
  }

  function healthDot(ok){return `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${ok?'#168a62':'#d19a23'};margin-right:6px"></span>`}

  function injectHealthPanel(){
    if(state?.tab!=='dashboard')return;
    const content=document.querySelector('#content');if(!content)return;
    let box=document.querySelector('#systemHealthCard');
    if(!box){
      box=document.createElement('section');box.id='systemHealthCard';box.className='panel';box.style.marginTop='16px';
      content.appendChild(box);
    }
    const h=systemHealth();
    const sync=state.sync instanceof Date?state.sync.toLocaleTimeString('pt-BR'):'aguardando';
    box.innerHTML=`<div class="panelHead"><div><span class="eyebrow">SAÚDE DO SISTEMA</span><h2>Verificação automática</h2><p>Checagens locais do financeiro, Firebase, sincronização e integridade dos passeios.</p></div><small>Build ${BUILD}</small></div><div class="dayStats"><div><span>${healthDot(h.finance)}Financeiro</span><strong>${h.finance?'OK':'ATENÇÃO'}</strong></div><div><span>${healthDot(h.firestore&&h.auth)}Firebase</span><strong>${h.firestore&&h.auth?'OK':'VERIFICAR'}</strong></div><div><span>${healthDot(h.online)}Conexão</span><strong>${h.online?'Online':'Offline'}</strong></div><div><span>${healthDot(h.orphanExpenses===0&&h.duplicateTrips===0)}Integridade</span><strong>${h.orphanExpenses===0&&h.duplicateTrips===0?'OK':'REVISAR'}</strong></div></div><p style="margin:12px 0 0;color:#667a72;font-size:12px">Sincronização: ${sync} • Push: ${h.push==='granted'?'permitido':h.push==='denied'?'bloqueado':h.push==='default'?'aguardando permissão':h.push} • Despesas sem passeio: ${h.orphanExpenses} • Possíveis duplicidades: ${h.duplicateTrips}</p>`;
  }

  function applyFinancialPreview(){
    refreshTripFinancialPreview();
    requestAnimationFrame(()=>{
      patchDashboardMetrics();
      patchV42TripResults();
      injectHealthPanel();
    });
  }

  function installFinalRenderWrapper(){
    const current=window.renderAdmin;
    if(typeof current!=='function'||current.__tripCostPreviewFixed)return;
    const wrapped=function(...args){
      refreshTripFinancialPreview();
      const out=current.apply(this,args);
      requestAnimationFrame(()=>{patchDashboardMetrics();patchV42TripResults();injectHealthPanel()});
      return out;
    };
    wrapped.__tripCostPreviewFixed=true;
    window.renderAdmin=wrapped;
    try{renderAdmin=wrapped}catch(_){ }
  }

  window.TrilheirosFinance={BUILD,activeSeats,plannedCostDetails,expenseAmount,expensePaid,expenseMode,revenueForTrip,tripFinance,totals:financeTotals,selfTest:financeSelfTest,health:systemHealth,refresh:applyFinancialPreview};

  window.setNetworkUI=function(){
    const online=navigator.onLine;
    const b=document.querySelector('#networkBadge');
    if(b){b.textContent=online?'● Online':'● Offline';b.className='networkBadge '+(online?'online':'offline')}
    const s=document.querySelector('#sync');
    if(s&&!online){s.textContent='☁ Offline • dados locais';s.classList.add('offline')}
  };

  window.updateNotificationBadge=function(){
    const count=(state.notifications||[]).filter(n=>!n.read).length;
    const b=document.querySelector('#notifyCount');if(b)b.textContent=count?String(count):'';
    const s=document.querySelector('#sideNotifyCount');if(s)s.textContent=count?`(${count})`:'';
  };

  installFinalRenderWrapper();
  window.addEventListener('DOMContentLoaded',()=>{
    installFinalRenderWrapper();
    applyFinancialPreview();
    setTimeout(()=>{installFinalRenderWrapper();applyFinancialPreview()},400);
    setTimeout(()=>{installFinalRenderWrapper();applyFinancialPreview()},1400);
  });
  document.addEventListener('click',()=>setTimeout(applyFinancialPreview,100),true);
  window.addEventListener('online',()=>{setNetworkUI();applyFinancialPreview()});
  window.addEventListener('offline',()=>{setNetworkUI();applyFinancialPreview()});
})();
