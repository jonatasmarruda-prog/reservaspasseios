/* Trilheiros Gestão — integridade final das ações do painel */
(function(){
'use strict';
if(!location.pathname.startsWith('/admin'))return;
const q=(s,r=document)=>r.querySelector(s),n=v=>Math.max(0,Number(v||0)||0),round=v=>Math.round(n(v)*100)/100;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v||0));
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Cuiaba',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const payLabels={pix:'PIX',card:'Cartão de crédito',pix_installment:'PIX parcelado',cash:'Dinheiro',transfer:'Transferência',other:'Outro'};
function notify(msg,type=''){try{return typeof toast==='function'?toast(msg,type):alert(msg)}catch(_){alert(msg)}}
function canFinance(){return['owner','admin','finance'].includes(String(state?.role||''))}
function balance(total,paid){return Math.max(0,round(n(total)-n(paid)))}
function status(total,paid){return n(paid)<=0?'pending':n(paid)+0.009>=n(total)?'paid':'partial'}
function close(){q('#actionIntegrityModal')?.remove()}
async function getSale(id){const s=await db.collection('sales').doc(id).get();if(!s.exists)throw Error('Venda não encontrada.');return{id:s.id,...s.data()}}
async function reservationRefForSale(s){
  const local=(state.reservations||[]).find(r=>r.sale_id===s.id||(r.id===s.id&&r.trip_id===s.trip_id));
  if(local?.trip_id&&local?.id)return db.collection('trips').doc(local.trip_id).collection('reservations').doc(local.id);
  if(s.trip_id){
    const exact=db.collection('trips').doc(s.trip_id).collection('reservations').doc(s.id);
    try{const snap=await exact.get();if(snap.exists)return exact}catch(_){ }
    try{const qs=await db.collection('trips').doc(s.trip_id).collection('reservations').where('sale_id','==',s.id).limit(1).get();if(!qs.empty)return qs.docs[0].ref}catch(_){ }
  }
  try{const qs=await db.collectionGroup('reservations').where('sale_id','==',s.id).limit(1).get();if(!qs.empty)return qs.docs[0].ref}catch(_){ }
  return null;
}
function modal(html){close();const back=document.createElement('div');back.id='actionIntegrityModal';back.className='modalBack';back.innerHTML=`<div class="modal" style="max-width:760px">${html}</div>`;document.body.appendChild(back);back.onclick=e=>{if(e.target===back)close()};return back}
function paymentOptions(selected='pix'){return Object.entries(payLabels).map(([v,l])=>`<option value="${v}" ${v===selected?'selected':''}>${l}</option>`).join('')}
async function refreshSales(){try{if(typeof window.renderSalesPageV37==='function')await window.renderSalesPageV37();else if(typeof window.renderSalesPageV21==='function')await window.renderSalesPageV21();else if(typeof window.renderAdmin==='function')window.renderAdmin()}catch(_){}}

window.openPaymentV22=async function(id){
  if(!canFinance())return notify('Seu perfil não pode registrar pagamentos.','error');
  try{
    const s=await getSale(id);if(s.sale_status==='cancelled')throw Error('Esta venda está cancelada.');
    const total=n(s.sale_total||s.paid_amount),oldPaid=n(s.paid_amount),remaining=balance(total,oldPaid);if(remaining<=0.009)return notify('Esta venda já está totalmente paga.','success');
    const back=modal(`<form id="integrityPayForm"><div class="modalHead"><div><span class="eyebrow">RECEBER PAGAMENTO</span><h2>${esc(s.customer_name||'Cliente')}</h2><p>${esc(s.trip_name||'Passeio')} • saldo ${money(remaining)}</p></div><button type="button" class="iconClose" id="integrityClose">✕</button></div><div class="modalBody"><div class="grid two"><label><span>Valor recebido agora</span><input name="amount" type="number" min="0.01" max="${remaining.toFixed(2)}" step="0.01" required value="${remaining.toFixed(2)}"></label><label><span>Forma de pagamento</span><select name="method">${paymentOptions(s.payment_method||'pix')}</select></label><label><span>Data do recebimento</span><input name="payDate" type="date" value="${today()}" required></label><label><span>Próximo vencimento</span><input name="nextDue" type="date" value="${esc(s.next_due_date||'')}"></label></div><div id="integrityMsg"></div></div><div class="modalFoot"><button type="button" class="btn ghost" id="integrityCancel">Cancelar</button><button class="btn primary" id="integrityConfirm">Confirmar recebimento</button></div></form>`);
    q('#integrityClose',back).onclick=q('#integrityCancel',back).onclick=close;
    q('#integrityPayForm',back).onsubmit=async e=>{
      e.preventDefault();const f=e.target,btn=q('#integrityConfirm',back),msg=q('#integrityMsg',back),amount=round(Number(f.amount.value));if(amount<=0||amount>remaining+0.009)return notify('Confira o valor recebido.','error');btn.disabled=true;btn.textContent='Confirmando...';
      try{
        const saleRef=db.collection('sales').doc(id),resRef=await reservationRefForSale(s),stamp=firebase.firestore.FieldValue.serverTimestamp();
        await db.runTransaction(async tx=>{
          const ss=await tx.get(saleRef),rs=resRef?await tx.get(resRef):null;if(!ss.exists)throw Error('Venda não encontrada.');
          const sd=ss.data()||{},saleTotal=n(sd.sale_total||sd.paid_amount),before=n(sd.paid_amount),newPaid=round(before+amount);if(newPaid>saleTotal+0.009)throw Error('O valor informado ultrapassa o total da venda.');
          const newBalance=balance(saleTotal,newPaid),newStatus=status(saleTotal,newPaid),entry={amount,date:f.payDate.value||today(),method:f.method.value,source:'admin_action_integrity',confirmed_at:new Date().toISOString()},patch={paid_amount:newPaid,balance_due:newBalance,payment_status:newStatus,payment_method:f.method.value,last_payment_amount:amount,last_payment_method:f.method.value,last_payment_confirmed_at:stamp,received_date:f.payDate.value||today(),next_due_date:newBalance>0?(f.nextDue.value||sd.next_due_date||''):'',payment_history:[...(sd.payment_history||[]),entry],updated_at:stamp};
          tx.update(saleRef,patch);if(rs?.exists)tx.update(resRef,{...patch,payment_history:[...((rs.data()||{}).payment_history||[]),entry]});
        });
        close();notify('Pagamento confirmado e salvo.','success');await refreshSales();void window.dispatchPaymentImmediate?.(id,{silent:false}).catch(()=>{});
      }catch(err){msg.innerHTML=`<div class="msg error">${esc(err.message||err)}</div>`;btn.disabled=false;btn.textContent='Confirmar recebimento'}
    };
  }catch(e){notify(e.message||'Não foi possível abrir o pagamento.','error')}
};

window.openEditSaleV22=async function(id){
  if(!canFinance())return notify('Seu perfil não pode editar vendas.','error');
  try{
    const s=await getSale(id);if(s.sale_status==='cancelled')throw Error('Venda cancelada não pode ser editada.');const paid=n(s.paid_amount),total=n(s.sale_total||s.paid_amount),installments=Math.max(1,Math.round(n(s.installment_total)||1));
    const back=modal(`<form id="integrityEditForm"><div class="modalHead"><div><span class="eyebrow">EDITAR VENDA</span><h2>${esc(s.customer_name||'Cliente')}</h2><p>${esc(s.trip_name||'Passeio')}</p></div><button type="button" class="iconClose" id="integrityClose">✕</button></div><div class="modalBody"><div class="grid two"><label><span>Cliente / pagador</span><input name="buyer" required value="${esc(s.customer_name||'')}"></label><label><span>Valor total</span><input name="total" type="number" min="${Math.max(.01,paid).toFixed(2)}" step="0.01" required value="${total.toFixed(2)}"></label><label><span>Parcelas previstas</span><input name="installments" type="number" min="1" max="24" step="1" value="${installments}"></label><label><span>Próximo vencimento</span><input name="nextDue" type="date" value="${esc(s.next_due_date||'')}"></label><label class="wide"><span>Observação</span><textarea name="notes" rows="3">${esc(s.notes||'')}</textarea></label></div><div id="integrityMsg"></div></div><div class="modalFoot"><button type="button" class="btn ghost" id="integrityCancel">Cancelar</button><button class="btn primary" id="integritySave">Salvar alterações</button></div></form>`);
    q('#integrityClose',back).onclick=q('#integrityCancel',back).onclick=close;
    q('#integrityEditForm',back).onsubmit=async e=>{e.preventDefault();const f=e.target,btn=q('#integritySave',back),msg=q('#integrityMsg',back),newTotal=round(Number(f.total.value));if(newTotal+0.009<paid)return notify(`O total não pode ser menor que o já recebido (${money(paid)}).`,'error');btn.disabled=true;btn.textContent='Salvando...';try{const saleRef=db.collection('sales').doc(id),resRef=await reservationRefForSale(s),stamp=firebase.firestore.FieldValue.serverTimestamp(),bal=balance(newTotal,paid),st=status(newTotal,paid),patch={customer_name:f.buyer.value.trim(),sale_total:newTotal,balance_due:bal,payment_status:st,installment_total:Math.max(1,Math.min(24,Math.round(n(f.installments.value)||1))),next_due_date:bal>0?(f.nextDue.value||''):'',notes:f.notes.value.trim(),updated_at:stamp};await db.runTransaction(async tx=>{const ss=await tx.get(saleRef),rs=resRef?await tx.get(resRef):null;if(!ss.exists)throw Error('Venda não encontrada.');tx.update(saleRef,patch);if(rs?.exists)tx.update(resRef,{responsible_name:patch.customer_name,sale_total:newTotal,balance_due:bal,payment_status:st,installment_total:patch.installment_total,next_due_date:patch.next_due_date,updated_at:stamp})});close();notify('Venda atualizada.','success');await refreshSales()}catch(err){msg.innerHTML=`<div class="msg error">${esc(err.message||err)}</div>`;btn.disabled=false;btn.textContent='Salvar alterações'}};
  }catch(e){notify(e.message||'Não foi possível editar a venda.','error')}
};

window.cancelSaleV22=async function(id){
  if(!canFinance())return notify('Seu perfil não pode cancelar vendas.','error');
  try{
    const s=await getSale(id);if(s.sale_status==='cancelled')return notify('Esta venda já está cancelada.');const maxRefund=Math.max(0,n(s.paid_amount)-n(s.refunded_amount));
    const back=modal(`<form id="integrityCancelForm"><div class="modalHead"><div><span class="eyebrow">CANCELAR VENDA</span><h2>${esc(s.customer_name||'Cliente')}</h2><p>${esc(s.trip_name||'Passeio')} • ${n(s.seats)} vaga(s)</p></div><button type="button" class="iconClose" id="integrityClose">✕</button></div><div class="modalBody"><div class="grid two"><label><span>Valor a reembolsar</span><input name="refund" type="number" min="0" max="${maxRefund.toFixed(2)}" step="0.01" value="0"></label><label class="wide"><span>Motivo</span><textarea name="reason" rows="3"></textarea></label></div><div id="integrityMsg"></div></div><div class="modalFoot"><button type="button" class="btn ghost" id="integrityBack">Voltar</button><button class="btn danger" id="integrityDoCancel">Confirmar cancelamento</button></div></form>`);
    q('#integrityClose',back).onclick=q('#integrityBack',back).onclick=close;
    q('#integrityCancelForm',back).onsubmit=async e=>{e.preventDefault();const f=e.target,btn=q('#integrityDoCancel',back),msg=q('#integrityMsg',back),refund=round(Number(f.refund.value||0));if(refund<0||refund>maxRefund+0.009)return notify('Confira o valor do reembolso.','error');btn.disabled=true;btn.textContent='Cancelando...';try{const saleRef=db.collection('sales').doc(id),resRef=await reservationRefForSale(s),tripRef=s.trip_id?db.collection('trips').doc(s.trip_id):null,stamp=firebase.firestore.FieldValue.serverTimestamp();await db.runTransaction(async tx=>{const ss=await tx.get(saleRef),ts=tripRef?await tx.get(tripRef):null,rs=resRef?await tx.get(resRef):null;if(!ss.exists)throw Error('Venda não encontrada.');const sd=ss.data()||{};if(sd.sale_status==='cancelled')throw Error('Venda já cancelada.');const seats=n(sd.seats),totalRefund=n(sd.refunded_amount)+refund,pstat=totalRefund+0.009>=n(sd.paid_amount)&&n(sd.paid_amount)>0?'refunded':'cancelled';tx.update(saleRef,{sale_status:'cancelled',payment_status:pstat,refunded_amount:totalRefund,balance_due:0,cancel_reason:f.reason.value.trim(),cancelled_at:stamp,updated_at:stamp});if(rs?.exists)tx.update(resRef,{status:'cancelled',payment_status:pstat,refunded_amount:totalRefund,balance_due:0,cancel_reason:f.reason.value.trim(),updated_at:stamp});if(ts?.exists){const td=ts.data()||{},totalSpots=n(td.total_spots),minUsed=(td.special_seat_reserved===true||td.special_seat_counted===true)?1:0,newUsed=Math.max(minUsed,n(td.used_spots)-seats),patch={used_spots:newUsed,remaining_spots:totalSpots>0?Math.max(0,totalSpots-newUsed):n(td.remaining_spots)+seats,updated_at:stamp};const inv=td.accommodation_inventory||{},uAcc={...(td.accommodation_used||{})};if(sd.accommodation&&Object.prototype.hasOwnProperty.call(inv,sd.accommodation)){uAcc[sd.accommodation]=Math.max(0,n(uAcc[sd.accommodation])-seats);patch.accommodation_used=uAcc}tx.update(tripRef,patch)}});close();notify('Venda cancelada e vagas liberadas.','success');await refreshSales()}catch(err){msg.innerHTML=`<div class="msg error">${esc(err.message||err)}</div>`;btn.disabled=false;btn.textContent='Confirmar cancelamento'}};
  }catch(e){notify(e.message||'Não foi possível cancelar a venda.','error')}
};

document.addEventListener('click',e=>{const b=e.target?.closest?.('button');if(!b||b.disabled)return;const known=[['data-v37-pay','openPaymentV22'],['data-v37-edit','openEditSaleV22'],['data-v37-cancel','cancelSaleV22'],['data-v37-delete','deleteSaleV37'],['data-v37-open','openSaleDetailsV37']];for(const[attr,fn]of known){if(b.hasAttribute(attr)&&typeof window[fn]!=='function'){e.preventDefault();e.stopImmediatePropagation();notify(`Ação indisponível (${fn}). Atualize a página e tente novamente.`,'error');return}}},true);
window.__trilheirosActionIntegrity=true;
})();
