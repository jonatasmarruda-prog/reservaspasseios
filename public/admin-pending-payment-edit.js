/* Trilheiros Gestão — edição e exclusão de pagamentos diretamente nas pendências */
(function(){
'use strict';
if(typeof state==='undefined'||!location.pathname.startsWith('/admin'))return;

const q=(s,r=document)=>r.querySelector(s);
const n=v=>Math.max(0,Number(v||0)||0);
const round=v=>Math.round(n(v)*100)/100;
const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v||0));
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const day=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Cuiaba',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const methodKind=v=>{const s=String(v||'').toLowerCase();if(s.includes('parcel')||s.includes('install'))return'pix_installment';if(s.includes('card')||s.includes('cart'))return'card';if(s.includes('pix'))return'pix';return'pix'};
const methodLabel=v=>({pix:'PIX',card:'Cartão de crédito',pix_installment:'PIX parcelado'})[methodKind(v)]||'PIX';
const validAmount=(v,max)=>Number.isFinite(Number(v))&&Number(v)>0&&Number(v)<=max+0.009;
function notify(msg,type=''){try{return typeof toast==='function'?toast(msg,type):alert(msg)}catch(_){alert(msg)}}
function close(){q('#pendingPaymentEditor')?.remove()}
function participantsOf(r,s){const rows=(r?.participants?.length?r.participants:s?.participants||[]).map(x=>String(x?.full_name||x?.name||'').trim()).filter(Boolean);const fallback=String(r?.responsible_name||s?.customer_name||'').trim();return rows.length?rows:(fallback?[fallback]:[])}
function totalOf(r,s,t){for(const v of [s?.sale_total,r?.sale_total])if(n(v)>0)return n(v);const composed=n(s?.paid_amount||r?.paid_amount)+n(s?.balance_due||r?.balance_due)-n(s?.refunded_amount||r?.refunded_amount);if(composed>0)return composed;return n(t?.default_price)*Math.max(1,n(r?.seats||s?.seats)||1)}
function paidOf(r,s){return Math.max(n(r?.paid_amount),n(s?.paid_amount))}
async function readData(tripId,id){const r=(state.reservations||[]).find(x=>x.trip_id===tripId&&x.id===id);if(!r)return null;const saleId=r.sale_id||r.id;let sale=null;try{const ss=await db.collection('sales').doc(saleId).get();if(ss.exists)sale={id:ss.id,...ss.data()}}catch(_){ }const t=(state.trips||[]).find(x=>x.id===tripId);return{r,sale,t,saleId}}

function injectStyle(){
 if(q('#pendingPaymentEditStyle'))return;
 const s=document.createElement('style');s.id='pendingPaymentEditStyle';s.textContent=`
 .ppeModal{max-width:820px}.ppeGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.ppeCard{padding:14px;border:1px solid rgba(7,50,38,.14);border-radius:16px;background:#f7faf8}.ppeCard span,.ppeField label{display:block;font-size:10px;font-weight:900;letter-spacing:.07em;color:#647b72;margin-bottom:6px}.ppeCard strong{font-size:17px;color:#073226}.ppeField{padding:14px;border:1px solid #cfe0d8;border-radius:16px;background:#fff}.ppeField select,.ppeField input{width:100%;box-sizing:border-box;border:1px solid #bdd2c8;border-radius:11px;padding:11px 12px;background:#fff;color:#123a2e;font:inherit;font-weight:800}.ppeSummary{grid-column:1/-1;display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:12px;border-radius:16px;background:#edf7f2;border:1px solid #c8e1d5}.ppeSummary div{padding:8px}.ppeSummary span{display:block;font-size:9px;font-weight:900;color:#6a8178;letter-spacing:.06em}.ppeSummary strong{display:block;margin-top:4px;color:#073226}.ppeRemain strong{color:#9a6500}.ppePaid strong{color:#137a50}.ppeNote{grid-column:1/-1;padding:12px 14px;border-radius:14px;background:#fff8df;border:1px solid #ead49a;color:#5f4d13;font-size:12px;line-height:1.5}.ppeNames{grid-column:1/-1}.ppeDebtBanner{margin:0 0 12px;padding:13px 15px;border:1px solid #efd69d;border-radius:14px;background:#fff8df;color:#684d0b}.ppeDebtBanner b{display:block;color:#674708}.ppeDebtBanner small{display:block;margin-top:4px;color:#7b682f}.ppeDanger{border:1px solid #e8b7b2!important;background:#fff5f4!important;color:#a02d25!important}.ppeDanger:hover{background:#ffe8e5!important}.ppeSave{border-color:#9fcbb8!important}.ppeFootLeft{display:flex;gap:8px;flex-wrap:wrap;margin-right:auto}.ppeCardActions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.ppeCardAction{border:1px solid #b7cfc5;background:#fff;color:#0b523d;border-radius:10px;padding:8px 12px;font-size:11px;font-weight:900;cursor:pointer}.ppeCardDelete{border-color:#e7b9b4;color:#9d3129;background:#fff7f6}.ppeCardAction:hover{filter:brightness(.98)}@media(max-width:650px){.ppeGrid{grid-template-columns:1fr}.ppeSummary{grid-template-columns:1fr 1fr}.ppeNames,.ppeSummary,.ppeNote{grid-column:auto}.ppeModal .modalFoot{position:sticky;bottom:0;background:var(--card,#fff);gap:8px}.ppeFootLeft{width:100%}.ppeFootLeft .btn,.ppeModal .modalFoot>.btn{flex:1}.ppeCardActions{width:100%}.ppeCardAction{flex:1;min-width:120px}}
 `;document.head.appendChild(s);
}
injectStyle();

window.openSyncedReservationV35=async function(tripId,id){
 const data=await readData(tripId,id);if(!data)return notify('Reserva não encontrada.','error');
 const {r,sale,t,saleId}=data,name=r.responsible_name||sale?.customer_name||participantsOf(r,sale)[0]||'Cliente',trip=t?.name||sale?.trip_name||r.trip_name||'Passeio';
 const total=round(totalOf(r,sale,t)),paid=round(paidOf(r,sale)),balance=round(Math.max(0,total-paid)),method=methodKind(sale?.payment_method||r.payment_method||'pix');
 const installments=Math.max(2,Math.round(n(sale?.installment_total||r?.installment_total||2)));
 const currentSuggested=method==='pix_installment'?round(Math.min(balance,n(sale?.next_installment_amount||r?.next_installment_amount)||(total/installments)||balance)):balance;
 close();
 const back=document.createElement('div');back.id='pendingPaymentEditor';back.className='modalBack';
 back.innerHTML=`<div class="modal ppeModal"><div class="modalHead"><div><span class="eyebrow">EDITAR / CONFIRMAR PENDÊNCIA</span><h2>${esc(name)}</h2><p>${esc(trip)} • ${esc(String(t?.trip_date||sale?.trip_date||'').slice(0,10))}</p></div><button type="button" class="iconClose" id="ppeClose">✕</button></div><div class="modalBody"><div class="ppeGrid"><div class="ppeField"><label for="ppeTotal">VALOR TOTAL DA RESERVA</label><input id="ppeTotal" type="number" min="${Math.max(0.01,paid).toFixed(2)}" step="0.01" value="${total.toFixed(2)}" inputmode="decimal"></div><div class="ppeCard"><span>JÁ RECEBIDO</span><strong class="ppePaidValue">${money(paid)}</strong></div><div class="ppeField"><label for="ppeMethod">FORMA DE PAGAMENTO</label><select id="ppeMethod"><option value="pix"${method==='pix'?' selected':''}>PIX</option><option value="card"${method==='card'?' selected':''}>Cartão de crédito</option><option value="pix_installment"${method==='pix_installment'?' selected':''}>PIX parcelado</option></select></div><div class="ppeField" id="ppeInstallmentsWrap" style="${method==='pix_installment'?'':'display:none'}"><label for="ppeInstallments">QUANTIDADE DE PARCELAS PIX</label><input id="ppeInstallments" type="number" min="2" max="24" step="1" value="${installments}" inputmode="numeric"></div><div class="ppeField"><label for="ppeAmount">VALOR RECEBIDO AGORA</label><input id="ppeAmount" type="number" min="0.01" step="0.01" max="${balance.toFixed(2)}" value="${Math.min(balance,currentSuggested).toFixed(2)}" inputmode="decimal"></div><div class="ppeSummary"><div><span>TOTAL</span><strong id="ppeTotalPreview">${money(total)}</strong></div><div class="ppePaid"><span>JÁ PAGO</span><strong id="ppeAlready">${money(paid)}</strong></div><div><span>CONFIRMANDO AGORA</span><strong id="ppeNow">${money(currentSuggested)}</strong></div><div class="ppeRemain"><span>RESTANTE</span><strong id="ppeRemaining">${money(Math.max(0,balance-currentSuggested))}</strong></div></div><div class="ppeNote" id="ppeNote">Você pode corrigir o valor total e a forma de pagamento sem confirmar nenhum recebimento. Use “Salvar edição”. Se a pessoa não pagou nada, use “Excluir pendência”.</div><div class="ppeCard ppeNames"><span>PARTICIPANTE(S)</span><strong>${esc(participantsOf(r,sale).join(' • ')||name)}</strong></div></div><div id="v35Msg"></div></div><div class="modalFoot"><div class="ppeFootLeft">${paid<=0.009?'<button type="button" class="btn ghost ppeDanger" id="ppeDelete">Excluir pendência</button>':''}<button type="button" class="btn ghost ppeSave" id="ppeSave">Salvar edição</button></div><button type="button" class="btn ghost" id="ppeCancel">Fechar</button>${balance>0.009?'<button type="button" class="btn primary" id="v35Confirm">Confirmar valor recebido</button>':'<button type="button" class="btn primary" disabled>Pagamento quitado</button>'}</div></div>`;
 document.body.appendChild(back);
 q('#ppeClose',back).onclick=q('#ppeCancel',back).onclick=close;back.onclick=e=>{if(e.target===back)close()};
 const amount=q('#ppeAmount',back),methodEl=q('#ppeMethod',back),totalEl=q('#ppeTotal',back),installmentsEl=q('#ppeInstallments',back),installmentsWrap=q('#ppeInstallmentsWrap',back),totalPreview=q('#ppeTotalPreview',back),nowEl=q('#ppeNow',back),remainEl=q('#ppeRemaining',back),note=q('#ppeNote',back),btn=q('#v35Confirm',back),saveBtn=q('#ppeSave',back),deleteBtn=q('#ppeDelete',back);
 const refresh=()=>{const editedTotal=round(Number(totalEl?.value||0)),editedBalance=Math.max(0,round(editedTotal-paid)),v=Math.min(editedBalance,n(amount?.value));if(amount){amount.max=editedBalance.toFixed(2);if(n(amount.value)>editedBalance)amount.value=editedBalance.toFixed(2)}if(totalPreview)totalPreview.textContent=money(editedTotal);if(nowEl)nowEl.textContent=money(v);if(remainEl)remainEl.textContent=money(Math.max(0,editedBalance-v));if(installmentsWrap)installmentsWrap.style.display=methodEl?.value==='pix_installment'?'':'none';if(note)note.textContent=methodEl?.value==='pix_installment'?'PIX parcelado: você pode ajustar o total e a quantidade de parcelas. Salvar edição não confirma pagamento.':'Você pode corrigir o valor total e a forma de pagamento sem confirmar nenhum recebimento. Salvar edição não registra dinheiro recebido.';if(btn)btn.textContent=v+0.009>=editedBalance?'Confirmar e quitar':'Confirmar entrada '+money(v)};
 amount?.addEventListener('input',refresh);methodEl?.addEventListener('change',refresh);totalEl?.addEventListener('input',refresh);installmentsEl?.addEventListener('input',refresh);refresh();
 if(saveBtn)saveBtn.onclick=()=>window.savePendingPaymentEdit(tripId,id,saleId);
 if(deleteBtn)deleteBtn.onclick=()=>window.deleteUnpaidPendingV35(tripId,id,saleId);
 if(btn)btn.onclick=()=>window.confirmSyncedPaymentV35(tripId,id,saleId);
};

window.savePendingPaymentEdit=async function(tripId,id,saleId){
 const saveBtn=q('#ppeSave'),msg=q('#v35Msg'),totalEl=q('#ppeTotal'),methodEl=q('#ppeMethod'),installmentsEl=q('#ppeInstallments');
 if(saveBtn){saveBtn.disabled=true;saveBtn.textContent='Salvando...'}
 try{
  const editedTotal=round(Number(totalEl?.value||0)),selectedMethod=methodKind(methodEl?.value||'pix'),installmentTotal=selectedMethod==='pix_installment'?Math.max(2,Math.min(24,Math.round(n(installmentsEl?.value||2)))):null,resRef=db.collection('trips').doc(tripId).collection('reservations').doc(id),saleRef=db.collection('sales').doc(saleId||id),stamp=firebase.firestore.FieldValue.serverTimestamp();
  let paid=0,balance=0,status='pending';
  await db.runTransaction(async tx=>{
   const rs=await tx.get(resRef);if(!rs.exists)throw Error('Reserva não encontrada.');
   const ss=await tx.get(saleRef),rd=rs.data()||{},sd=ss.exists?ss.data():null;
   paid=round(Math.max(n(rd.paid_amount),n(sd?.paid_amount)));if(!Number.isFinite(editedTotal)||editedTotal<=0)throw Error('Informe um valor total válido.');if(editedTotal+0.009<paid)throw Error(`O valor total não pode ser menor que o já recebido (${money(paid)}).`);
   balance=round(Math.max(0,editedTotal-paid));status=balance<=0.009?'paid':paid>0?'partial':'pending';
   const common={sale_total:editedTotal,balance_due:balance,payment_status:status,payment_method:selectedMethod,installment_total:installmentTotal,next_installment_amount:selectedMethod==='pix_installment'&&balance>0?round(Math.min(balance,editedTotal/installmentTotal)):null,updated_at:stamp};
   tx.update(resRef,common);if(ss.exists)tx.update(saleRef,common);
  });
  const local=(state.reservations||[]).find(x=>x.trip_id===tripId&&x.id===id);if(local)Object.assign(local,{sale_total:editedTotal,balance_due:balance,payment_status:status,payment_method:selectedMethod,installment_total:installmentTotal,next_installment_amount:selectedMethod==='pix_installment'&&balance>0?round(Math.min(balance,editedTotal/installmentTotal)):null});
  notify(`Pendência atualizada: ${methodLabel(selectedMethod)} • ${money(editedTotal)}.`,'success');close();if(typeof renderAdmin==='function')renderAdmin();return true;
 }catch(e){if(msg)msg.innerHTML=`<div class="msg error">${esc(e.message||e)}</div>`;if(saveBtn){saveBtn.disabled=false;saveBtn.textContent='Salvar edição'}return false}
};

window.deleteUnpaidPendingV35=async function(tripId,id,saleId){
 const data=await readData(tripId,id);if(!data)return notify('Pendência não encontrada.','error');
 const {r,sale,t}=data,name=r.responsible_name||sale?.customer_name||participantsOf(r,sale)[0]||'Cliente',trip=t?.name||sale?.trip_name||r.trip_name||'Passeio',paid=round(paidOf(r,sale));
 if(paid>0.009)return notify('Esta pendência já possui valor recebido e não pode ser excluída por aqui.','error');
 if(!confirm(`Excluir a pendência de ${name} em ${trip}?\n\nEla será removida de Reservas e Vendas e as vagas serão liberadas. Use somente quando a pessoa não pagou.`))return;
 const deleteBtn=q('#ppeDelete'),msg=q('#v35Msg');if(deleteBtn){deleteBtn.disabled=true;deleteBtn.textContent='Excluindo...'}
 try{
  const resRef=db.collection('trips').doc(tripId).collection('reservations').doc(id),saleRef=db.collection('sales').doc(saleId||id),tripRef=db.collection('trips').doc(tripId),stamp=firebase.firestore.FieldValue.serverTimestamp();
  let seats=1;
  await db.runTransaction(async tx=>{
   const [rs,ss,ts]=await Promise.all([tx.get(resRef),tx.get(saleRef),tx.get(tripRef)]);if(!rs.exists&&!ss.exists)throw Error('Pendência já foi excluída.');
   const rd=rs.exists?rs.data()||{}:{},sd=ss.exists?ss.data()||{}:{},received=round(Math.max(n(rd.paid_amount),n(sd.paid_amount)));if(received>0.009)throw Error('Existe pagamento confirmado nesta reserva. A exclusão foi bloqueada para proteger o financeiro.');
   seats=Math.max(1,Math.round(n(rd.seats||sd.seats)||1));
   if(ts.exists){const td=ts.data()||{},totalSpots=Math.max(0,Math.round(n(td.total_spots))),used=Math.max(0,Math.round(n(td.used_spots))),special=Math.max(0,Math.round(n(td.special_seat_count||(td.special_seat_reserved?1:0))),newUsed=Math.max(special,used-seats),newRemaining=totalSpots>0?Math.max(0,totalSpots-newUsed):Math.max(0,Math.round(n(td.remaining_spots))+seats);tx.update(tripRef,{used_spots:newUsed,remaining_spots:newRemaining,updated_at:stamp});}
   if(rs.exists)tx.delete(resRef);if(ss.exists)tx.delete(saleRef);
  });
  if(Array.isArray(state.reservations))state.reservations=state.reservations.filter(x=>!(x.trip_id===tripId&&x.id===id));
  if(Array.isArray(state.sales))state.sales=state.sales.filter(x=>x.id!==(saleId||id));
  close();notify(`Pendência de ${name} excluída. ${seats} vaga(s) liberada(s).`,'success');if(typeof renderAdmin==='function')renderAdmin();return true;
 }catch(e){if(msg)msg.innerHTML=`<div class="msg error">${esc(e.message||e)}</div>`;if(deleteBtn){deleteBtn.disabled=false;deleteBtn.textContent='Excluir pendência'}return false}
};

window.confirmSyncedPaymentV35=async function(tripId,id,saleId){
 const btn=q('#v35Confirm'),msg=q('#v35Msg'),amountInput=q('#ppeAmount'),methodInput=q('#ppeMethod'),totalInput=q('#ppeTotal'),installmentsInput=q('#ppeInstallments');
 if(btn){btn.disabled=true;btn.textContent='Confirmando...'}
 try{
  const requested=round(Number(amountInput?.value||0)),selectedMethod=methodKind(methodInput?.value||'pix'),editedTotal=round(Number(totalInput?.value||0)),selectedInstallments=selectedMethod==='pix_installment'?Math.max(2,Math.min(24,Math.round(n(installmentsInput?.value||2)))):null,resRef=db.collection('trips').doc(tripId).collection('reservations').doc(id),saleRef=db.collection('sales').doc(saleId||id),stamp=firebase.firestore.FieldValue.serverTimestamp(),date=day();
  let confirmed=0,newPaid=0,newBalance=0,newStatus='pending',total=0,name='Cliente',tripName='Passeio';
  await db.runTransaction(async tx=>{
   const rs=await tx.get(resRef);if(!rs.exists)throw Error('Reserva não encontrada.');
   const ss=await tx.get(saleRef),rd=rs.data()||{},sd=ss.exists?ss.data():null,t=(state.trips||[]).find(x=>x.id===tripId);
   const oldPaid=round(Math.max(n(rd.paid_amount),n(sd?.paid_amount)));total=editedTotal>0?editedTotal:round(totalOf(rd,sd,t));if(total+0.009<oldPaid)throw Error(`O valor total não pode ser menor que o já recebido (${money(oldPaid)}).`);const remaining=round(Math.max(0,total-oldPaid));if(remaining<=0.009)throw Error('Pagamento já está quitado.');
   if(!validAmount(requested,remaining))throw Error(`Informe um valor entre R$ 0,01 e ${money(remaining)}.`);
   confirmed=round(Math.min(requested,remaining));newPaid=round(Math.min(total,oldPaid+confirmed));newBalance=round(Math.max(0,total-newPaid));newStatus=newBalance<=0.009?'paid':'partial';name=rd.responsible_name||sd?.customer_name||'Cliente';tripName=t?.name||sd?.trip_name||rd.trip_name||'Passeio';
   const entry={amount:confirmed,date,method:selectedMethod,source:'admin_pending_editor',confirmed_at:new Date().toISOString()};
   const common={sale_total:total,paid_amount:newPaid,balance_due:newBalance,payment_status:newStatus,payment_method:selectedMethod,received_date:date,last_payment_amount:confirmed,last_payment_method:selectedMethod,last_payment_confirmed_at:stamp,payment_alert_pending:newBalance>0.009,installment_total:selectedInstallments,next_installment_amount:selectedMethod==='pix_installment'&&newBalance>0?round(Math.min(newBalance,total/selectedInstallments)):null,updated_at:stamp};
   tx.update(resRef,{...common,payment_history:[...(rd.payment_history||[]),entry]});
   if(ss.exists)tx.update(saleRef,{...common,payment_history:[...(sd.payment_history||[]),entry]});
  });
  const local=(state.reservations||[]).find(x=>x.trip_id===tripId&&x.id===id);if(local){Object.assign(local,{sale_total:total,paid_amount:newPaid,balance_due:newBalance,payment_status:newStatus,payment_method:selectedMethod,received_date:date,last_payment_amount:confirmed,installment_total:selectedInstallments,next_installment_amount:selectedMethod==='pix_installment'&&newBalance>0?round(Math.min(newBalance,total/selectedInstallments)):null});}
  close();
  notify(newStatus==='paid'?`${methodLabel(selectedMethod)} de ${money(confirmed)} confirmado. ${name} quitou ${tripName}.`:`${methodLabel(selectedMethod)} de ${money(confirmed)} confirmado. ${name} ainda tem ${money(newBalance)} para pagar em ${tripName}.`,'success');if(typeof renderAdmin==='function')renderAdmin();return{confirmed,newPaid,newBalance,newStatus,method:selectedMethod};
 }catch(e){if(msg)msg.innerHTML=`<div class="msg error">${esc(e.message||e)}</div>`;if(btn){btn.disabled=false;btn.textContent='Tentar novamente'}throw e}
};

async function enhancePendingBalances(){
 if(state.tab!=='pending')return;
 const rs=(state.reservations||[]).filter(r=>['pending','partial'].includes(String(r.payment_status||'').toLowerCase())&&r.status!=='cancelled');
 const items=[...document.querySelectorAll('.pendingList .pendingItem')].filter(el=>String(el.querySelector('span')?.textContent||'').toLowerCase().includes('pagamento')||el.dataset.v32Payment==='1');
 let totalOpen=0,partialCount=0;
 for(let i=0;i<Math.min(rs.length,items.length);i++){
  const r=rs[i],saleId=r.sale_id||r.id;let s=null;try{const ss=await db.collection('sales').doc(saleId).get();if(ss.exists)s=ss.data()}catch(_){ }
  const t=(state.trips||[]).find(x=>x.id===r.trip_id),total=round(totalOf(r,s,t)),paid=round(paidOf(r,s)),balance=round(Math.max(0,total-paid)),name=r.responsible_name||s?.customer_name||r.participants?.[0]?.full_name||'Sem nome',trip=t?.name||s?.trip_name||r.trip_name||'Passeio',method=s?.payment_method||r.payment_method||'pix';
  totalOpen+=balance;if(paid>0)partialCount++;
  const el=items[i],tag=el.querySelector('span'),strong=el.querySelector('strong');if(tag)tag.textContent=paid>0?(methodKind(method)==='pix_installment'?'PIX PARCELADO • PARCIAL':'PAGAMENTO PARCIAL'):'PAGAMENTO PENDENTE';if(strong)strong.textContent=`${name} • ${trip} • ${methodLabel(method)} • total ${money(total)} • recebido ${money(paid)} • falta ${money(balance)}`;el.title=paid>0?'Clique para editar e confirmar novos valores':'Clique para editar, confirmar ou excluir a pendência';el.onclick=e=>{if(e.target.closest('.ppeCardActions'))return;e.preventDefault();window.openSyncedReservationV35(r.trip_id,r.id)};
  let actions=el.querySelector('.ppeCardActions');if(!actions){actions=document.createElement('div');actions.className='ppeCardActions';el.appendChild(actions)}
  actions.innerHTML=`<button type="button" class="ppeCardAction ppeEditDirect">✏️ Editar</button>${paid<=0.009?'<button type="button" class="ppeCardAction ppeCardDelete ppeDeleteDirect">🗑️ Excluir</button>':''}`;
  actions.querySelector('.ppeEditDirect')?.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();window.openSyncedReservationV35(r.trip_id,r.id)});
  actions.querySelector('.ppeDeleteDirect')?.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();window.deleteUnpaidPendingV35(r.trip_id,r.id,saleId)});
 }
 const list=q('.pendingList');if(list&&rs.length&&!q('#ppeDebtBanner')){const box=document.createElement('div');box.id='ppeDebtBanner';box.className='ppeDebtBanner';box.innerHTML=`<b>💰 ${rs.length} pagamento(s) com saldo em aberto • ${money(totalOpen)}</b><small>${partialCount} já possuem entrada/parcela confirmada. Use Editar para trocar PIX, PIX parcelado, cartão e valores. Pendências sem pagamento exibem também Excluir.</small>`;list.parentElement?.insertBefore(box,list)}
}

const previousRender=window.renderAdmin;
if(typeof previousRender==='function'&&!previousRender.__pendingPaymentEdit){const wrapped=function(...args){const out=previousRender.apply(this,args);setTimeout(()=>enhancePendingBalances().catch(()=>{}),240);return out};wrapped.__pendingPaymentEdit=true;window.renderAdmin=wrapped;try{renderAdmin=wrapped}catch(_){ }}
setTimeout(()=>enhancePendingBalances().catch(()=>{}),650);
})();
