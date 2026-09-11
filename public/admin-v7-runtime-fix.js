/* Compatibilidade entre V6 e V7: estado de rede, notificações e resumo financeiro dos passeios. */
(function(){
  const num=v=>Math.max(0,Number(v||0)||0);
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

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

  function refreshTripFinancialPreview(){
    (state.trips||[]).forEach(trip=>{
      const seats=activeSeats(trip.id);
      const rows=(state.expenses||[]).filter(e=>e.trip_id===trip.id);
      const planned=plannedCost(trip,seats);
      const actual=rows.reduce((sum,e)=>sum+expenseAmount(e,seats),0);
      const displayExpenses=rows.length?actual:planned;
      const revenue=num(trip.net_revenue);
      trip.expenses=displayExpenses;
      trip.profit=revenue-displayExpenses;
      trip.display_expenses_source=rows.length?'actual':'planned';
      trip.display_planned_cost=planned;
    });
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

  const baseRenderAdmin=window.renderAdmin;
  if(typeof baseRenderAdmin==='function'&&!baseRenderAdmin.__tripCostPreviewFixed){
    const wrapped=function(...args){
      refreshTripFinancialPreview();
      return baseRenderAdmin.apply(this,args);
    };
    wrapped.__tripCostPreviewFixed=true;
    window.renderAdmin=wrapped;
    try{renderAdmin=wrapped}catch(_){ }
  }

  window.addEventListener('online',()=>{setNetworkUI();});
  window.addEventListener('offline',()=>{setNetworkUI();});
})();
