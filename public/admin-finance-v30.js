/* Trilheiros Gestão V30 — dashboard financeiro mensal + contas a pagar */
(function(){
  'use strict';
  if(typeof state==='undefined') return;

  const q=(s,r=document)=>r.querySelector(s);
  const qa=(s,r=document)=>[...r.querySelectorAll(s)];
  const num=v=>Math.max(0,Number(v||0)||0);
  const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v||0));
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const currentMonth=()=>new Date().toLocaleDateString('en-CA',{timeZone:'America/Cuiaba'}).slice(0,7);
  const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'America/Cuiaba'});

  state.financeMonthV30=state.financeMonthV30||currentMonth();

  function jsDate(v){
    if(!v) return null;
    try{
      if(typeof v.toDate==='function') return v.toDate();
      if(v.seconds) return new Date(v.seconds*1000);
      if(v instanceof Date) return v;
      const d=new Date(v);return Number.isNaN(d.getTime())?null:d;
    }catch{return null}
  }
  function iso(v){
    if(!v) return '';
    if(typeof v==='string'&&/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0,10);
    const d=jsDate(v);if(!d)return'';
    return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Cuiaba',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
  }
  function monthOf(v){const s=iso(v);return s?s.slice(0,7):''}
  function brDate(v){const s=iso(v);if(!s)return'—';const[y,m,d]=s.split('-');return`${d}/${m}/${y}`}
  function monthLabel(m){
    if(!/^\d{4}-\d{2}$/.test(m))return m;
    const [y,mo]=m.split('-').map(Number);
    return new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric',timeZone:'America/Cuiaba'}).format(new Date(Date.UTC(y,mo-1,2)));
  }
  function payKind(v){v=String(v||'').toLowerCase();if(v.includes('parcel')||v.includes('install'))return'pix_installment';if(v.includes('card')||v.includes('cart'))return'card';if(v.includes('pix'))return'pix';if(v.includes('cash')||v.includes('dinheiro'))return'cash';return'other'}
  const payLabel={pix:'PIX',card:'CARTÃO',pix_installment:'PIX PARCELADO',cash:'DINHEIRO',other:'OUTROS'};

  function reservationValue(r,t){
    if(num(r?.sale_total)>0)return num(r.sale_total);
    if(num(r?.balance_due)+num(r?.paid_amount)-num(r?.refunded_amount)>0)return Math.max(0,num(r.balance_due)+num(r.paid_amount)-num(r.refunded_amount));
    return num(t?.default_price)*num(r?.seats);
  }
  function tripCost(t,seats){
    if(Array.isArray(t?.cost_items)&&t.cost_items.length){
      const fixed=t.cost_items.filter(x=>x.mode!=='per_person').reduce((s,x)=>s+num(x.amount),0);
      const pp=t.cost_items.filter(x=>x.mode==='per_person').reduce((s,x)=>s+num(x.amount),0);
      return {fixed,perPerson:pp,total:fixed+pp*Math.max(0,seats)};
    }
    const fixed=num(t?.cost_bus_fixed)+num(t?.cost_guide_fixed)+num(t?.cost_other_fixed);
    const pp=num(t?.cost_lodging_per_person)+num(t?.cost_activity_per_person)+num(t?.cost_food_per_person)+num(t?.cost_insurance_per_person)+num(t?.cost_other_per_person);
    return {fixed,perPerson:pp,total:fixed+pp*Math.max(0,seats)};
  }
  function reservationMonth(r){return monthOf(r.created_at)||monthOf(r.registered_at)||monthOf(r.trip_date)}
  function expenseStatus(e){return String(e?.payment_status||e?.status||'').toLowerCase()||'paid'}
  function expenseDueMonth(e){return monthOf(e.due_date)||monthOf(e.expense_date)||monthOf(e.created_at)}
  function expensePaidMonth(e){return monthOf(e.paid_date)||monthOf(e.expense_date)||monthOf(e.updated_at)||monthOf(e.created_at)}
  function isExpensePaid(e){const s=expenseStatus(e);return !['pending','open','unpaid','to_pay','payable'].includes(s)}
  function tripInMonth(t,m){return String(t?.trip_date||'').slice(0,7)===m}

  function salesForMonth(month){
    return (state.reservations||[]).filter(r=>r.status!=='cancelled'&&reservationMonth(r)===month);
  }
  function bookedForMonth(month){
    return salesForMonth(month).reduce((sum,r)=>sum+reservationValue(r,(state.trips||[]).find(t=>t.id===r.trip_id)),0);
  }
  function cashInForMonth(month){
    let total=0;
    (state.reservations||[]).filter(r=>r.status!=='cancelled').forEach(r=>{
      if(Array.isArray(r.payment_history)&&r.payment_history.length){
        const entries=r.payment_history.filter(p=>monthOf(p.date)===month);
        if(entries.length){total+=entries.reduce((s,p)=>s+num(p.amount),0);return}
      }
      const receivedDate=r.received_date||r.payment_received_date||r.updated_at||r.created_at;
      if(monthOf(receivedDate)===month) total+=Math.max(0,num(r.paid_amount)-num(r.refunded_amount));
    });
    return total;
  }
  function paidExpensesForMonth(month){return (state.expenses||[]).filter(e=>isExpensePaid(e)&&expensePaidMonth(e)===month).reduce((s,e)=>s+num(e.amount),0)}
  function payablesForMonth(month){return (state.expenses||[]).filter(e=>!isExpensePaid(e)&&expenseDueMonth(e)===month)}
  function tripProjectedForMonth(month){
    return (state.trips||[]).filter(t=>tripInMonth(t,month)&&t.status!=='cancelled').reduce((sum,t)=>{
      const seats=(state.reservations||[]).filter(r=>r.trip_id===t.id&&r.status!=='cancelled').reduce((s,r)=>s+num(r.seats),0);
      return sum+tripCost(t,seats).total;
    },0);
  }
  function paymentBreakdown(month){
    const x={pix:0,card:0,pix_installment:0,cash:0,other:0};
    salesForMonth(month).forEach(r=>{x[payKind(r.payment_method)]+=reservationValue(r,(state.trips||[]).find(t=>t.id===r.trip_id))});
    return x;
  }
  function tripRows(month){
    return (state.trips||[]).filter(t=>tripInMonth(t,month)&&t.status!=='cancelled').map(t=>{
      const rs=(state.reservations||[]).filter(r=>r.trip_id===t.id&&r.status!=='cancelled');
      const seats=rs.reduce((s,r)=>s+num(r.seats),0);
      const booked=rs.reduce((s,r)=>s+reservationValue(r,t),0);
      const received=rs.reduce((s,r)=>s+Math.max(0,num(r.paid_amount)-num(r.refunded_amount)),0);
      const projected=tripCost(t,seats).total;
      const exp=(state.expenses||[]).filter(e=>e.trip_id===t.id);
      const paid=exp.filter(isExpensePaid).reduce((s,e)=>s+num(e.amount),0);
      const payable=exp.filter(e=>!isExpensePaid(e)).reduce((s,e)=>s+num(e.amount),0);
      return {t,seats,booked,received,projected,paid,payable,projectedProfit:booked-projected,realCash:received-paid};
    }).sort((a,b)=>String(a.t.trip_date||'').localeCompare(String(b.t.trip_date||'')));
  }

  function dashboardHTML(month){
    const booked=bookedForMonth(month),cash=cashInForMonth(month),paidExp=paidExpensesForMonth(month),payables=payablesForMonth(month),toPay=payables.reduce((s,e)=>s+num(e.amount),0),projected=tripProjectedForMonth(month),payment=paymentBreakdown(month),rows=tripRows(month),realResult=cash-paidExp,projectedResult=booked-projected;
    const overdue=payables.filter(e=>iso(e.due_date)&&iso(e.due_date)<today());
    return `<section class="v30Dash" id="v30FinanceDash">
      <div class="v30Head"><div><span class="eyebrow">DASHBOARD FINANCEIRO MENSAL</span><h2>Controle de ${esc(monthLabel(month))}</h2><p>Faturamento, dinheiro que entrou, contas a pagar, despesas e resultado dos passeios.</p></div><div class="v30Actions"><input id="v30Month" type="month" value="${esc(month)}"><button class="btn primary" id="v30AddPayable">+ Conta a pagar</button></div></div>
      <div class="v30Metrics">
        <article><span>FATURADO NO MÊS</span><strong>${money(booked)}</strong><small>reservas/vendas registradas</small></article>
        <article><span>DINHEIRO QUE ENTROU</span><strong>${money(cash)}</strong><small>recebimentos confirmados</small></article>
        <article><span>DESPESAS PAGAS</span><strong>${money(paidExp)}</strong><small>saídas realizadas no mês</small></article>
        <article class="${toPay?'warn':''}"><span>CONTAS A PAGAR</span><strong>${money(toPay)}</strong><small>${payables.length} conta(s) em aberto${overdue.length?` • ${overdue.length} vencida(s)`:''}</small></article>
        <article><span>CUSTO PREVISTO</span><strong>${money(projected)}</strong><small>custos dos passeios do mês</small></article>
        <article class="ok"><span>LUCRO PREVISTO</span><strong>${money(projectedResult)}</strong><small>faturado - custo previsto</small></article>
        <article class="${realResult<0?'warn':'ok'}"><span>RESULTADO DE CAIXA</span><strong>${money(realResult)}</strong><small>dinheiro entrou - despesas pagas</small></article>
      </div>
      <div class="v30Grid2">
        <section class="v30Card"><div class="v30CardHead"><div><span class="eyebrow">FORMAS DE PAGAMENTO</span><h3>Faturamento do mês</h3></div></div><div class="v30Methods">${[['pix','PIX'],['card','CARTÃO'],['pix_installment','PIX PARCELADO'],['cash','DINHEIRO'],['other','OUTROS']].map(([k,l])=>`<div><span>${l}</span><strong>${money(payment[k])}</strong></div>`).join('')}</div></section>
        <section class="v30Card"><div class="v30CardHead"><div><span class="eyebrow">CONTAS A PAGAR</span><h3>Despesas do mês</h3></div><button class="btn ghost" id="v30AddPayable2">+ Adicionar</button></div>${payables.length?`<div class="v30Payables">${payables.sort((a,b)=>String(a.due_date||'').localeCompare(String(b.due_date||''))).map(e=>{const t=(state.trips||[]).find(x=>x.id===e.trip_id),late=iso(e.due_date)&&iso(e.due_date)<today();return`<div class="v30Payable ${late?'late':''}"><div><small>${late?'VENCIDA':'VENCE'} ${brDate(e.due_date||e.expense_date)}</small><strong>${esc(e.description||e.category||'Despesa')}</strong><span>${esc(t?.name||'Despesa geral')} • ${esc(e.category||'')}</span></div><b>${money(e.amount)}</b><button class="v30PaidBtn" data-pay-id="${esc(e.id)}">Marcar paga</button></div>`}).join('')}</div>`:'<div class="v30Empty">Nenhuma conta a pagar cadastrada neste mês.</div>'}</section>
      </div>
      <section class="v30Card"><div class="v30CardHead"><div><span class="eyebrow">PASSEIOS DO MÊS</span><h3>Receita, gastos e lucro por passeio</h3></div></div><div class="tableWrap"><table class="table"><thead><tr><th>Passeio</th><th>Vagas clientes</th><th>Vendido</th><th>Recebido</th><th>Custo previsto</th><th>Desp. pagas</th><th>A pagar</th><th>Lucro previsto</th><th>Caixa real</th></tr></thead><tbody>${rows.length?rows.map(x=>`<tr><td><strong>${esc(x.t.name)}</strong><small>${brDate(x.t.trip_date)}</small></td><td>${x.seats}</td><td>${money(x.booked)}</td><td>${money(x.received)}</td><td>${money(x.projected)}</td><td>${money(x.paid)}</td><td>${money(x.payable)}</td><td><strong>${money(x.projectedProfit)}</strong></td><td><strong>${money(x.realCash)}</strong></td></tr>`).join(''):'<tr><td colspan="9">Nenhum passeio cadastrado para este mês.</td></tr>'}</tbody></table></div></section>
    </section>`;
  }

  function bindDashboard(){
    q('#v30Month')?.addEventListener('change',e=>{state.financeMonthV30=e.target.value||currentMonth();renderMonthly()});
    q('#v30AddPayable')?.addEventListener('click',()=>window.payableModalV30());
    q('#v30AddPayable2')?.addEventListener('click',()=>window.payableModalV30());
    qa('[data-pay-id]').forEach(b=>b.onclick=()=>window.markPayablePaidV30(b.dataset.payId));
  }

  function renderMonthly(){
    const content=q('#content');if(!content||!['dashboard','finance'].includes(state.tab))return;
    q('#v30FinanceDash')?.remove();
    content.insertAdjacentHTML('afterbegin',dashboardHTML(state.financeMonthV30||currentMonth()));
    bindDashboard();
  }

  window.payableModalV30=function(prefillTrip=''){
    const wrap=document.createElement('div');wrap.id='v30PayableModal';wrap.className='modalBack';
    const options=(state.trips||[]).map(t=>`<option value="${esc(t.id)}" ${prefillTrip===t.id?'selected':''}>${esc(t.name)}</option>`).join('');
    wrap.innerHTML=`<div class="modal v30Modal"><form id="v30PayableForm"><div class="modalHead"><div><span class="eyebrow">CONTAS A PAGAR</span><h2>Nova despesa</h2><p>Controle vencimento e pagamento sem misturar com o custo previsto do passeio.</p></div><button type="button" class="iconClose" id="v30Close">✕</button></div><div class="modalBody"><div class="grid two"><label><span>Passeio (opcional)</span><select name="trip"><option value="">Despesa geral / sem passeio</option>${options}</select></label><label><span>Categoria</span><input name="category" required placeholder="Ex.: Transporte, hospedagem, fornecedor"></label><label class="span2"><span>Descrição</span><input name="description" required placeholder="Ex.: Sinal do ônibus - Chapada"></label><label><span>Valor</span><input name="amount" type="number" min="0.01" step="0.01" required></label><label><span>Vencimento</span><input name="due" type="date" required value="${today()}"></label><label><span>Status</span><select name="paymentStatus"><option value="pending">A pagar</option><option value="paid">Já paga</option></select></label><label><span>Data do pagamento</span><input name="paidDate" type="date"></label></div><div id="v30PayableMsg"></div></div><div class="modalFoot"><button type="button" class="btn ghost" id="v30Cancel">Cancelar</button><button class="btn primary">Salvar despesa</button></div></form></div>`;
    document.body.appendChild(wrap);
    q('#v30Close',wrap).onclick=q('#v30Cancel',wrap).onclick=()=>wrap.remove();
    q('[name="paymentStatus"]',wrap).onchange=e=>{const pd=q('[name="paidDate"]',wrap);if(e.target.value==='paid'&&!pd.value)pd.value=today()};
    q('#v30PayableForm',wrap).onsubmit=async e=>{
      e.preventDefault();const f=e.target,msg=q('#v30PayableMsg',wrap),btn=q('button[type="submit"]',f);btn.disabled=true;
      try{
        const st=f.paymentStatus.value,now=firebase.firestore.FieldValue.serverTimestamp();
        await db.collection('expenses').add({trip_id:f.trip.value||'',category:f.category.value.trim(),description:f.description.value.trim(),amount:num(f.amount.value),expense_date:f.due.value,due_date:f.due.value,payment_status:st,status:st,paid_date:st==='paid'?(f.paidDate.value||today()):'',source:'finance_dashboard_v30',created_at:now,updated_at:now});
        wrap.remove();if(typeof toast==='function')toast('Despesa salva.');
      }catch(err){msg.innerHTML=`<div class="msg error">${esc(err.message||err)}</div>`;btn.disabled=false}
    };
  };

  window.markPayablePaidV30=async function(id){
    if(!id)return;
    try{
      await db.collection('expenses').doc(id).update({payment_status:'paid',status:'paid',paid_date:today(),updated_at:firebase.firestore.FieldValue.serverTimestamp()});
      if(typeof toast==='function')toast('Conta marcada como paga.');
    }catch(err){if(typeof toast==='function')toast(err.message||'Não foi possível atualizar a conta.','error')}
  };

  const oldRender=window.renderAdmin;
  if(typeof oldRender==='function'){
    window.renderAdmin=function(...args){const out=oldRender.apply(this,args);setTimeout(renderMonthly,0);return out};
    try{globalThis.renderAdmin=window.renderAdmin}catch(_){ }
  }
  const observer=new MutationObserver(()=>{if(['dashboard','finance'].includes(state.tab))setTimeout(renderMonthly,25)});
  observer.observe(document.documentElement,{childList:true,subtree:true});

  const style=document.createElement('style');
  style.textContent=`
    .v30Dash{display:grid;gap:18px;margin-bottom:20px}.v30Head,.v30CardHead{display:flex;align-items:center;justify-content:space-between;gap:14px}.v30Head{padding:20px 22px;border:1px solid var(--line,#dfe7e3);border-radius:20px;background:var(--card,#fff)}.v30Head h2,.v30CardHead h3{margin:4px 0}.v30Head p{margin:0;color:var(--muted,#71867e)}.v30Actions{display:flex;gap:10px;align-items:center}.v30Actions input{min-height:42px;border:1px solid var(--line,#dfe7e3);border-radius:12px;padding:0 12px;background:var(--card,#fff);color:inherit}
    .v30Metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.v30Metrics article{padding:18px;border:1px solid var(--line,#dfe7e3);border-radius:18px;background:var(--card,#fff);box-shadow:0 8px 24px rgba(8,47,36,.04)}.v30Metrics span,.v30Methods span{display:block;font-size:10px;font-weight:900;letter-spacing:.07em;color:var(--muted,#71867e)}.v30Metrics strong{display:block;font-size:23px;margin:7px 0 3px;color:var(--green,#0b4d3b)}.v30Metrics small{color:var(--muted,#71867e)}.v30Metrics .warn{border-color:#efc661;background:#fffaf0}.v30Metrics .ok{border-color:#a8d8c4}
    .v30Grid2{display:grid;grid-template-columns:1fr 1.35fr;gap:16px}.v30Card{border:1px solid var(--line,#dfe7e3);border-radius:20px;background:var(--card,#fff);overflow:hidden}.v30CardHead{padding:18px 20px;border-bottom:1px solid var(--line,#dfe7e3)}.v30Methods{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;padding:18px}.v30Methods div{padding:14px;border-radius:14px;background:#f6faf8;border:1px solid #e0ebe5}.v30Methods strong{display:block;margin-top:5px;font-size:18px;color:#0b4d3b}
    .v30Payables{padding:10px 16px 16px;display:grid;gap:8px}.v30Payable{display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:12px;padding:12px;border:1px solid #e3ebe7;border-radius:14px}.v30Payable.late{border-color:#e6a8a8;background:#fff7f7}.v30Payable small,.v30Payable span{display:block;color:#708279;font-size:11px}.v30Payable strong{display:block;margin:2px 0}.v30PaidBtn{border:0;border-radius:10px;padding:9px 11px;background:#0b4d3b;color:white;font-weight:800;cursor:pointer}.v30Empty{padding:24px;color:#708279;text-align:center}.v30Modal .span2{grid-column:1/-1}
    @media(max-width:1100px){.v30Metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.v30Grid2{grid-template-columns:1fr}}@media(max-width:650px){.v30Head,.v30CardHead{align-items:flex-start;flex-direction:column}.v30Actions{width:100%;flex-wrap:wrap}.v30Metrics{grid-template-columns:1fr}.v30Methods{grid-template-columns:1fr}.v30Payable{grid-template-columns:1fr}.v30PaidBtn{width:100%}.v30Modal .grid.two{grid-template-columns:1fr}.v30Modal .span2{grid-column:auto}}
  `;
  document.head.appendChild(style);
})();