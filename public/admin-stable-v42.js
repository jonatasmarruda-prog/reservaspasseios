/* Trilheiros Gestão V42 — amarrações estáveis dos módulos novos + pendências enriquecidas */
(function(){
'use strict';
if(typeof state==='undefined')return;

const q=(s,r=document)=>r.querySelector(s);
const qa=(s,r=document)=>[...r.querySelectorAll(s)];
const n=v=>Math.max(0,Number(v||0)||0);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v||0));
const PAY={pix:'PIX',card:'CARTÃO',pix_installment:'PIX PARCELADO',cash:'DINHEIRO',transfer:'TRANSFERÊNCIA',other:'OUTRO'};
const installmentFallback={salto_nuvens:2,nobres_bom_jardim:2,rio_cristalino:3,jaciara_canyon:3};
let pendingLoading=false;

function norm(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()}
function payKind(v){const s=norm(v);if(s.includes('parcel')||s.includes('install'))return'pix_installment';if(s.includes('card')||s.includes('cart'))return'card';if(s.includes('pix'))return'pix';if(s.includes('cash')||s.includes('dinheiro'))return'cash';if(s.includes('transfer'))return'transfer';return'other'}
function optionLabel(v){
  const raw=String(v||'').trim();if(!raw)return'';
  const k=norm(raw).replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
  const map={individual:'Individual',adulto:'Individual',adult:'Individual',casal:'Casal',compartilhado:'Individual • Quarto compartilhado',quarto_compartilhado:'Individual • Quarto compartilhado',casal_sem_banheiro:'Casal • Sem banheiro',casal_com_banheiro:'Casal • Com banheiro',camping:'Camping',crianca:'Criança',child:'Criança',infantil:'Criança',with_transport:'Com transporte',withtransport:'Com transporte',without_transport:'Sem transporte',withouttransport:'Sem transporte'};
  return map[k]||raw.replaceAll('_',' ');
}
function optionOf(s,r){
  const a=r?.registration_answers||{};
  const values=[s?.category,s?.accommodation,s?.participant_type,r?.category,r?.accommodation,r?.participant_type,a?.opcao?.value,a?.tipo?.value,a?.categoria?.value,a?.participacao?.value];
  for(const v of values){const x=optionLabel(v);if(x)return x}
  const seats=Math.max(1,n(s?.seats||r?.seats));return seats===1?'Individual':`${seats} pessoas`;
}
function totalOf(s,r,t){
  for(const v of [s?.sale_total,r?.sale_total])if(n(v)>0)return n(v);
  const composed=n(s?.paid_amount||r?.paid_amount)+n(s?.balance_due||r?.balance_due)-n(s?.refunded_amount||r?.refunded_amount);if(composed>0)return composed;
  return n(t?.default_price)*Math.max(1,n(s?.seats||r?.seats));
}
function paidOf(s,r){return Math.max(n(s?.paid_amount),n(r?.paid_amount))}
function installmentCount(s,r){return Math.max(1,Math.round(n(s?.installment_total||r?.installment_total||installmentFallback[s?.trip_id||r?.trip_id]||1)))}
function nextAmount(s,r,t){const total=totalOf(s,r,t),paid=paidOf(s,r),bal=Math.max(0,total-paid);if(payKind(s?.payment_method||r?.payment_method)==='pix_installment'){const part=Math.round(total/installmentCount(s,r)*100)/100;return Math.min(bal,part||bal)}return bal}
function notify(msg,type=''){try{return typeof toast==='function'?toast(msg,type):alert(msg)}catch(_){alert(msg)}}

function injectStyle(){if(q('#v42Style'))return;const s=document.createElement('style');s.id='v42Style';s.textContent=`
.v42Pending{margin:0 0 18px;background:#fff;border:1px solid #dce8e3;border-radius:20px;overflow:hidden}.v42Head{padding:18px 20px;border-bottom:1px solid #e5ece8}.v42Head h2{margin:4px 0 4px;font-size:20px}.v42Head p{margin:0;color:#667a72}.v42PayList{display:grid}.v42PayRow{width:100%;border:0;border-bottom:1px solid #edf2ef;background:#fff;padding:14px 20px;display:grid;grid-template-columns:1.1fr 1.1fr .8fr .8fr .8fr auto;gap:12px;align-items:center;text-align:left;cursor:pointer}.v42PayRow:last-child{border-bottom:0}.v42PayRow:hover{background:#f7faf8}.v42PayRow small{display:block;color:#72827c;margin-top:3px}.v42PayRow b{color:#073226}.v42Tag{font-size:10px;font-weight:900;padding:6px 8px;border-radius:9px;background:#fff2d8;color:#7c5713;text-align:center}.v42Go{border:0;border-radius:10px;background:#073e2f;color:#fff;font-weight:900;padding:10px 12px}.v42Empty{padding:18px 20px;color:#63766e}.v42Hint{margin:12px 20px 18px;padding:11px 13px;border-radius:12px;background:#eef6f2;color:#37584c;font-size:12px}
@media(max-width:900px){.v42PayRow{grid-template-columns:1fr 1fr}.v42Go{grid-column:1/-1}}
`;
document.head.appendChild(s)}
injectStyle();

function patchNewTrip(){
  const b=q('#newTrip');if(!b)return;
  b.onclick=e=>{
    e?.preventDefault();e?.stopPropagation();
    if(!['owner','admin'].includes(state?.role||''))return notify('Seu perfil não pode criar passeios.','error');
    if(typeof window.tripModalV36==='function')return window.tripModalV36();
    if(typeof window.tripModal==='function')return window.tripModal();
    notify('Cadastro de passeio indisponível. Recarregue a página.','error');
  };
  b.dataset.v42='1';
}

function patchFinanceNav(){
  const b=q('[data-tab="finance"]');if(!b)return;
  b.onclick=e=>{
    e?.preventDefault();
    state.tab='finance';
    if(typeof window.renderAdmin==='function')window.renderAdmin();
  };
  b.dataset.v42='1';
}

async function loadPendingSales(){
  try{const ss=await db.collection('sales').orderBy('created_at','desc').limit(500).get();return ss.docs.map(d=>({id:d.id,...d.data()})).filter(s=>s.sale_status!=='cancelled'&&['pending','partial'].includes(String(s.payment_status||'pending')))}catch(e){console.warn('V42 pending sales',e);return[]}
}
async function reservationForSale(s){
  const local=(state.reservations||[]).find(r=>r.trip_id===s.trip_id&&(r.id===s.id||r.sale_id===s.id));if(local)return local;
  try{const rs=await db.collection('trips').doc(s.trip_id).collection('reservations').doc(s.id).get();return rs.exists?{id:rs.id,trip_id:s.trip_id,...rs.data()}:null}catch(_){return null}
}
async function mountPending(){
  if(state.tab!=='pending'||pendingLoading)return;const content=q('#content');if(!content||q('#v42Pending'))return;
  pendingLoading=true;
  try{
    const sales=await loadPendingSales();if(state.tab!=='pending')return;
    const rows=[];
    for(const s of sales){
      const r=await reservationForSale(s),t=(state.trips||[]).find(x=>x.id===s.trip_id),method=payKind(s.payment_method||r?.payment_method),total=totalOf(s,r,t),paid=paidOf(s,r),next=nextAmount(s,r,t),option=optionOf(s,r),name=s.customer_name||r?.responsible_name||r?.participants?.[0]?.full_name||'Cliente';
      rows.push({s,r,t,method,total,paid,next,option,name});
    }
    const box=document.createElement('section');box.id='v42Pending';box.className='v42Pending';box.innerHTML=`<div class="v42Head"><span class="eyebrow">PAGAMENTOS DO SITE</span><h2>Conferir e confirmar</h2><p>Nome, passeio, opção, forma de pagamento e valor já vêm da reserva. Você não precisa redigitar valor.</p></div>${rows.length?`<div class="v42PayList">${rows.map(x=>`<button class="v42PayRow" data-v42-sale="${esc(x.s.id)}" data-v42-trip="${esc(x.s.trip_id)}"><div><b>${esc(x.name)}</b><small>${esc(x.option)}</small></div><div><b>${esc(x.t?.name||x.s.trip_name||'Passeio')}</b><small>${Math.max(1,n(x.s.seats||x.r?.seats))} vaga(s)</small></div><div><span class="v42Tag">${esc(PAY[x.method]||'OUTRO')}</span></div><div><small>VALOR</small><b>${money(x.total)}</b></div><div><small>${x.method==='pix_installment'?'PRÓXIMA PARCELA':'A CONFIRMAR'}</small><b>${money(x.next)}</b></div><span class="v42Go">Conferir</span></button>`).join('')}</div><div class="v42Hint">O valor acima é o valor escolhido no sistema de reservas. Ele entra como recebido somente depois da sua confirmação ou de uma integração bancária validada.</div>`:'<div class="v42Empty">Nenhum pagamento pendente no momento.</div>'}`;
    const first=content.firstElementChild;first?content.insertBefore(box,first):content.appendChild(box);
    qa('[data-v42-sale]',box).forEach(b=>b.onclick=async()=>{
      const saleId=b.dataset.v42Sale,tripId=b.dataset.v42Trip,r=(state.reservations||[]).find(x=>x.trip_id===tripId&&(x.id===saleId||x.sale_id===saleId));
      if(r&&typeof window.openSyncedReservationV35==='function')return window.openSyncedReservationV35(tripId,r.id);
      if(typeof window.openPaymentV22==='function')return window.openPaymentV22(saleId);
      notify('Não foi possível abrir esta pendência.','error');
    });
  }finally{pendingLoading=false}
}

function patch(){
  if(!location.pathname.startsWith('/admin'))return;
  patchNewTrip();patchFinanceNav();
  if(state.tab==='pending'&&!q('#v42Pending'))setTimeout(()=>mountPending().catch(()=>{}),40);
}

const oldRender=window.renderAdmin;
if(typeof oldRender==='function'){
  window.renderAdmin=function(...args){const out=oldRender.apply(this,args);setTimeout(patch,0);setTimeout(patch,100);return out};
  try{renderAdmin=window.renderAdmin}catch(_){ }
}
const obs=new MutationObserver(()=>patch());obs.observe(document.body,{childList:true,subtree:true});
window.addEventListener('load',patch);setInterval(patch,700);setTimeout(patch,250);
})();