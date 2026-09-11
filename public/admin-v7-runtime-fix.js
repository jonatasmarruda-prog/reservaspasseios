/* Compatibilidade entre V6 e V7: estado de rede, notificações e resumo financeiro dos passeios. */
(function(){
  const num=v=>Math.max(0,Number(v||0)||0);
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v||0));

  function activeSeats(tripId){
    return (state.reservations||[])
      .filter(r=>r.trip_id===tripId&&r.status!=='cancelled')
      .reduce((sum,r)=>sum+num(r.seats),0);
  }

  function plannedCost(trip,seats){
    let items=Array.isArray(trip?.cost_items)?trip.cost_items.filter(x=>num(x?.amount)>0):[];
    if(!items.length){
      items=[
        {mode:'fixed',amount:num(trip?.cost_bus_fixed)},
        {mode:'fixed',amount:num(trip?.cost_guide_fixed)},
        {mode:'fixed',amount:num(trip?.cost_other_fixed)},
        {mode:'per_person',amount:num(trip?.cost_lodging_per_person)},
        {mode:'per_person',amount:num(trip?.cost_activity_per_person)},
        {mode:'per_person',amount:num(trip?.cost_food_per_person)},
        {mode:'per_person',amount:num(trip?.cost_insurance_per_person)},
        {mode:'per_person',amount:num(trip?.cost_other_per_person)}
      ].filter(x=>x.amount>0);
    }
    const fixed=items.filter(x=>x.mode!=='per_person').reduce((sum,x)=>sum+num(x.amount),0);
    const perPerson=items.filter(x=>x.mode==='per_person').reduce((sum,x)=>sum+num(x.amount),0);
    return fixed+(perPerson*seats);
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
      const qty=expensePaid(expense)&&num(expense?.quantity_basis)>0?num(expense.quantity_basis):seats;
      return unit*qty;
    }
    return num(expense?.amount)>0?num(expense.amount):unit;
  }

  function revenueForTrip(trip){
    const rows=(state.reservations||[]).filter(r=>r.trip_id===trip.id&&r.status!=='cancelled');
    const total=rows.reduce((sum,r)=>{
      if(num(r.sale_total)>0)return sum+num(r.sale_total);
      const composed=num(r.paid_amount)+num(r.balance_due)-num(r.refunded_amount);
      if(composed>0)return sum+composed;
      return sum+(num(trip.default_price)*Math.max(1,num(r.seats)));
    },0);
    return total>0?total:num(trip.net_revenue||trip.gross_revenue);
  }

  function refreshTripFinancialPreview(){
    if(typeof state==='undefined')return;
    (state.trips||[]).forEach(trip=>{
      const seats=activeSeats(trip.id);
      const actualRows=(state.expenses||[]).filter(e=>e.trip_id===trip.id);
      const planned=plannedCost(trip,seats);
      const actual=actualRows.reduce((sum,e)=>sum+expenseAmount(e,seats),0);
      const displayExpenses=actualRows.length?actual:planned;
      const revenue=revenueForTrip(trip);
      trip.net_revenue=revenue;
      trip.expenses=displayExpenses;
      trip.profit=revenue-displayExpenses;
      trip.display_expenses_source=actualRows.length?'actual':'planned';
      trip.display_planned_cost=planned;
    });
  }

  function patchDashboardMetrics(){
    if(typeof state==='undefined')return;
    const totalExpenses=(state.trips||[]).reduce((sum,t)=>sum+num(t.expenses),0);
    const totalRevenue=(state.trips||[]).reduce((sum,t)=>sum+num(t.net_revenue),0);
    const totalProfit=totalRevenue-totalExpenses;
    document.querySelectorAll('.metric').forEach(card=>{
      const label=norm(card.querySelector('span')?.textContent||'');
      const strong=card.querySelector('strong');
      const small=card.querySelector('small');
      if(!strong)return;
      if(label==='despesas'){
        strong.textContent=money(totalExpenses);
        if(small)small.textContent='custos previstos/realizados';
      }
      if(label==='resultado'){
        strong.textContent=money(totalProfit);
        if(small&&totalRevenue>0)small.textContent=`margem ${(totalProfit/totalRevenue*100).toFixed(1)}%`;
      }
    });
  }

  function applyFinancialPreview(){
    refreshTripFinancialPreview();
    requestAnimationFrame(()=>patchDashboardMetrics());
  }

  function installFinalRenderWrapper(){
    const current=window.renderAdmin;
    if(typeof current!=='function'||current.__tripCostPreviewFixed)return;
    const wrapped=function(...args){
      refreshTripFinancialPreview();
      const out=current.apply(this,args);
      requestAnimationFrame(()=>patchDashboardMetrics());
      return out;
    };
    wrapped.__tripCostPreviewFixed=true;
    window.renderAdmin=wrapped;
    try{renderAdmin=wrapped}catch(_){ }
  }

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
  });
  document.addEventListener('click',()=>setTimeout(applyFinancialPreview,80),true);
  window.addEventListener('online',()=>{setNetworkUI();});
  window.addEventListener('offline',()=>{setNetworkUI();});
})();
