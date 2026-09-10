/* V34 fix — mantém despesas por pessoa sincronizadas com a quantidade atual de clientes */
(function(){
'use strict';
if(typeof state==='undefined')return;
const n=v=>Math.max(0,Number(v||0)||0);
const paid=e=>!['pending','open','unpaid','to_pay','payable'].includes(String(e?.payment_status||e?.status||'').toLowerCase());
const seats=id=>(state.reservations||[]).filter(r=>r.trip_id===id&&r.status!=='cancelled').reduce((s,r)=>s+n(r.seats),0);
function sync(){(state.expenses||[]).forEach(e=>{if(e?.cost_mode==='per_person'&&e?.dynamic_per_person!==false&&!paid(e)){const qty=seats(e.trip_id);e.amount=n(e.unit_amount||e.amount)*qty;e.quantity_basis=qty;}})}
const old=window.renderAdmin;if(typeof old==='function'){window.renderAdmin=function(...args){sync();return old.apply(this,args)};try{renderAdmin=window.renderAdmin}catch(_){}}
setTimeout(sync,250);
})();