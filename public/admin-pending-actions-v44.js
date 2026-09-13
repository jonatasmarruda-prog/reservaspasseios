/* Trilheiros Gestão V44 — ações visíveis nas pendências */
(function(){
'use strict';
if(!location.pathname.startsWith('/admin'))return;

const n=v=>Math.max(0,Number(v||0)||0);
const pendingReservations=()=>{
  try{return (state.reservations||[]).filter(r=>['pending','partial'].includes(String(r.payment_status||'').toLowerCase())&&!['cancelled','canceled'].includes(String(r.status||'').toLowerCase()))}catch(_){return[]}
};

function ensureStyle(){
  if(document.getElementById('pendingActionsV44Style'))return;
  const s=document.createElement('style');s.id='pendingActionsV44Style';s.textContent=`
  .pendingActionsV44{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;padding-top:10px;border-top:1px solid rgba(7,50,38,.10)}
  .pendingActionsV44 button{appearance:none;border:1px solid #b8d0c5;background:#fff;color:#0b523d;border-radius:10px;padding:9px 13px;font-weight:900;font-size:12px;cursor:pointer;min-height:38px}
  .pendingActionsV44 .editV44{background:#eef8f3;border-color:#9bcab5;color:#07563e}
  .pendingActionsV44 .deleteV44{background:#fff5f4;border-color:#e5aaa4;color:#a12f27}
  .pendingActionsV44 .deleteV44[disabled]{opacity:.45;cursor:not-allowed}
  @media(max-width:650px){.pendingActionsV44{display:grid;grid-template-columns:1fr 1fr}.pendingActionsV44 button{width:100%}}
  `;document.head.appendChild(s);
}

function paymentItems(){
  return [...document.querySelectorAll('.pendingList .pendingItem')].filter(el=>{
    const tag=String(el.querySelector('span')?.textContent||'').toLowerCase();
    return tag.includes('pagamento')||tag.includes('pix')||el.dataset.v32Payment==='1';
  });
}

function enhance(){
  if(typeof state==='undefined'||state.tab!=='pending')return;
  ensureStyle();
  const rs=pendingReservations(),items=paymentItems();
  for(let i=0;i<Math.min(rs.length,items.length);i++){
    const r=rs[i],el=items[i];if(!r||!el)continue;
    el.dataset.pendingTripId=r.trip_id||'';el.dataset.pendingReservationId=r.id||'';
    let box=el.querySelector('.pendingActionsV44');
    if(!box){box=document.createElement('div');box.className='pendingActionsV44';el.appendChild(box)}
    const paid=n(r.paid_amount);
    box.innerHTML=`<button type="button" class="editV44">✏️ Editar pagamento</button><button type="button" class="deleteV44" ${paid>0.009?'disabled title="Há pagamento recebido. Edite em vez de excluir."':''}>🗑️ Excluir</button>`;
    const edit=box.querySelector('.editV44'),del=box.querySelector('.deleteV44');
    edit.onclick=e=>{e.preventDefault();e.stopPropagation();if(typeof window.openSyncedReservationV35==='function')window.openSyncedReservationV35(r.trip_id,r.id)};
    del.onclick=e=>{e.preventDefault();e.stopPropagation();if(del.disabled)return;if(typeof window.deleteUnpaidPendingV35==='function')window.deleteUnpaidPendingV35(r.trip_id,r.id,r.sale_id||r.id)};
  }
}

function schedule(){setTimeout(enhance,0);setTimeout(enhance,180);setTimeout(enhance,600)}
window.addEventListener('DOMContentLoaded',schedule,{once:true});
window.addEventListener('load',schedule,{once:true});
document.addEventListener('click',e=>{const t=e.target?.closest?.('[data-tab="pending"],button,a');if(t&&String(t.textContent||'').toLowerCase().includes('pend'))setTimeout(enhance,120)},true);

setTimeout(()=>{
  const current=window.renderAdmin;
  if(typeof current==='function'&&!current.__pendingActionsV44){
    const wrapped=function(...args){const out=current.apply(this,args);schedule();return out};
    wrapped.__pendingActionsV44=true;window.renderAdmin=wrapped;try{globalThis.renderAdmin=wrapped}catch(_){ }
  }
  schedule();
},1000);
})();
