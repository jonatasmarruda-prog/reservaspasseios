/* Trilheiros Gestão V22.1 — guardas de segurança e cancelamento robusto */
(function(){
  const ownerOrAdmin=()=>{try{return['owner','admin'].includes(state?.role)}catch{return false}};
  const deny=()=>{try{if(typeof toast==='function')toast('Somente proprietário ou administrador pode alterar vendas.','error');else alert('Somente proprietário ou administrador pode alterar vendas.')}catch(_){ }};
  const q=(s,r=document)=>r.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v||0));
  const n=v=>Math.max(0,Number(v||0)||0);
  const notify=(msg,type='')=>{try{if(typeof toast==='function')return toast(msg,type)}catch(_){ }alert(msg)};

  ['openSaleModalV21','openPaymentV22','openEditSaleV22','cancelSaleV22','openAccommodationInventoryV22'].forEach(name=>{
    const fn=window[name];if(typeof fn!=='function')return;
    window[name]=function(...args){if(!ownerOrAdmin()){deny();return}return fn.apply(this,args)};
    try{globalThis[name]=window[name]}catch(_){ }
  });

  function patchAdminButtons(){
    if(!location.pathname.startsWith('/admin'))return;
    const allowed=ownerOrAdmin();
    const b=document.querySelector('#newSaleV21');if(b){b.disabled=!allowed;b.onclick=window.openSaleModalV21}
    document.querySelectorAll('[data-pay-v22],[data-edit-v22],[data-cancel-v22],#accInventoryV22,#salesNewV21').forEach(x=>{if(!allowed)x.disabled=true});
  }

  async function saleById(id){
    const snap=await db.collection('sales').doc(id).get();
    if(!snap.exists)throw Error('Venda não encontrada.');
    return{id:snap.id,...snap.data()};
  }

  async function reservationRefForSale(s){
    try{
      const local=(state?.reservations||[]).find(r=>(r.id===s.id)||(r.sale_id===s.id));
      if(local?.id&&local?.trip_id)return db.collection('trips').doc(local.trip_id).collection('reservations').doc(local.id);
    }catch(_){ }
    if(s.trip_id){
      const exact=db.collection('trips').doc(s.trip_id).collection('reservations').doc(s.id);
      try{const snap=await exact.get();if(snap.exists)return exact}catch(_){ }
      try{
        const qs=await db.collection('trips').doc(s.trip_id).collection('reservations').where('sale_id','==',s.id).limit(1).get();
        if(!qs.empty)return qs.docs[0].ref;
      }catch(_){ }
    }
    try{
      const qs=await db.collectionGroup('reservations').where('sale_id','==',s.id).limit(1).get();
      if(!qs.empty)return qs.docs[0].ref;
    }catch(_){ }
    return s.trip_id?db.collection('trips').doc(s.trip_id).collection('reservations').doc(s.id):null;
  }

  function showCancelModal(s,maxRefund){
    document.querySelector('#saleModalV22')?.remove();
    const back=document.createElement('div');back.id='saleModalV22';back.className='saleModalBackV21 saleModalBackV22';
    back.innerHTML=`<section class="saleModalV21 saleModalV22"><form id="cancelSaleFormV221"><header class="saleModalHeadV21"><div><span>CANCELAR VENDA</span><h2>${esc(s.customer_name||'Cliente')}</h2><p>${esc(s.trip_name||'Passeio')} • ${n(s.seats)} vaga(s)</p></div><button type="button" class="v221Close">✕</button></header><div class="saleModalBodyV21"><div class="saleGridV21"><label class="saleFieldV21"><span>Recebido confirmado</span><input value="${money(n(s.paid_amount))}" disabled></label><label class="saleFieldV21"><span>Valor a reembolsar / estornar</span><input name="refund" type="number" min="0" max="${maxRefund}" step="0.01" value="0" required><small>Máximo disponível: ${money(maxRefund)}</small></label><label class="saleFieldV21 saleFullV21"><span>Motivo / observação</span><textarea name="reason" rows="3" placeholder="Motivo do cancelamento"></textarea></label></div><div class="v22Warning">Ao confirmar, a venda será cancelada. Quando o passeio vinculado for localizado, as vagas voltarão automaticamente. Se preferir remover o registro por completo, use Excluir na lista de vendas.</div><div id="cancelSaleMsgV221"></div></div><footer class="saleModalFootV21"><button type="button" class="saleBtnGhostV21 v221Back">Voltar</button><button class="saleBtnDangerV22">Confirmar cancelamento</button></footer></form></section>`;
    document.body.appendChild(back);
    const close=()=>back.remove();q('.v221Close',back).onclick=close;q('.v221Back',back).onclick=close;back.addEventListener('click',e=>{if(e.target===back)close()});
    return{back,close,form:q('#cancelSaleFormV221',back)};
  }

  /*
   * V37 chama window.cancelSaleV22. A rotina antiga supunha que
   * reservations/{reservationId} tivesse sempre o mesmo ID da venda e
   * também bloqueava tudo quando o trip_id antigo já não existia.
   * Esta implementação localiza a reserva pelo sale_id/collectionGroup,
   * cancela a venda mesmo sem o documento antigo do passeio e só ajusta
   * vagas quando encontra com segurança o passeio realmente vinculado.
   */
  window.cancelSaleV22=async function(id){
    if(!ownerOrAdmin())return deny();
    try{
      const s=await saleById(id);
      if(s.sale_status==='cancelled')return notify('Esta venda já está cancelada.','error');
      const maxRefund=Math.max(0,n(s.paid_amount)-n(s.refunded_amount));
      const ui=showCancelModal(s,maxRefund);
      ui.form.onsubmit=async e=>{
        e.preventDefault();
        const f=e.target,refund=n(f.refund.value),msg=q('#cancelSaleMsgV221',ui.back),btn=q('.saleBtnDangerV22',f);
        if(refund>maxRefund+0.009)return notify('O reembolso não pode ser maior que o valor recebido ainda não estornado.','error');
        btn.disabled=true;btn.textContent='Cancelando...';if(msg)msg.innerHTML='';
        try{
          const current=await saleById(id),saleRef=db.collection('sales').doc(id),resRef=await reservationRefForSale(current);
          const linkedTripId=resRef?.parent?.parent?.id||current.trip_id||'';
          const tripRef=linkedTripId?db.collection('trips').doc(linkedTripId):null;
          let newUsed=null,newRemaining=null,tripAdjusted=false;
          await db.runTransaction(async tx=>{
            const ss=await tx.get(saleRef);if(!ss.exists)throw Error('Venda não encontrada.');
            const ts=tripRef?await tx.get(tripRef):null;
            const rs=resRef?await tx.get(resRef):null;
            const sd=ss.data();
            if(sd.sale_status==='cancelled')throw Error('Esta venda já está cancelada.');
            const paidAmount=n(sd.paid_amount),alreadyRefunded=n(sd.refunded_amount),availableRefund=Math.max(0,paidAmount-alreadyRefunded);
            if(refund>availableRefund+0.009)throw Error(`O máximo disponível para reembolso é ${money(availableRefund)}.`);
            const totalRefund=alreadyRefunded+refund,now=firebase.firestore.FieldValue.serverTimestamp(),pstat=paidAmount>0&&totalRefund+0.009>=paidAmount?'refunded':'cancelled',reason=f.reason.value.trim();
            tx.update(saleRef,{sale_status:'cancelled',payment_status:pstat,refunded_amount:totalRefund,balance_due:0,cancel_reason:reason,cancelled_at:now,updated_at:now});
            if(rs?.exists)tx.update(resRef,{status:'cancelled',payment_status:pstat,refunded_amount:totalRefund,balance_due:0,cancel_reason:reason,cancelled_at:now,updated_at:now});
            if(ts?.exists){
              const td=ts.data(),seats=n(sd.seats),minUsed=(td.special_seat_reserved===true||td.special_seat_counted===true)?1:0,totalSpots=n(td.total_spots),used=n(td.used_spots),remaining=n(td.remaining_spots);
              newUsed=Math.max(minUsed,used-seats);
              newRemaining=totalSpots>0?Math.max(0,totalSpots-newUsed):remaining+seats;
              const inv=td.accommodation_inventory||{},uAcc={...(td.accommodation_used||{})};
              if(sd.accommodation&&Object.prototype.hasOwnProperty.call(inv,sd.accommodation))uAcc[sd.accommodation]=Math.max(0,n(uAcc[sd.accommodation])-seats);
              const tu={used_spots:newUsed,remaining_spots:newRemaining,updated_at:now};if(Object.keys(inv).length)tu.accommodation_used=uAcc;
              tx.update(tripRef,tu);tripAdjusted=true;
            }
          });
          try{
            if(tripAdjusted){const t=(state?.trips||[]).find(x=>x.id===linkedTripId);if(t){t.used_spots=newUsed;t.remaining_spots=newRemaining}}
            (state?.reservations||[]).filter(r=>r.id===resRef?.id||r.sale_id===id).forEach(r=>{r.status='cancelled';r.payment_status=refund+0.009>=maxRefund&&maxRefund>0?'refunded':'cancelled'});
          }catch(_){ }
          ui.close();notify(tripAdjusted?'Venda cancelada e vagas devolvidas ao passeio.':'Venda cancelada com sucesso. O vínculo antigo do passeio não impediu a operação.','success');
          if(typeof window.renderSalesPageV37==='function')await window.renderSalesPageV37();else if(typeof window.renderSalesPageV21==='function')await window.renderSalesPageV21();
        }catch(err){console.error('V221_CANCEL_SALE',err);if(msg)msg.innerHTML=`<div class="saleErrorV21">${esc(err.message||'Não foi possível cancelar a venda.')}</div>`;btn.disabled=false;btn.textContent='Confirmar cancelamento'}
      };
    }catch(e){console.error('V221_OPEN_CANCEL',e);notify(e.message||'Não foi possível abrir o cancelamento.','error')}
  };
  try{globalThis.cancelSaleV22=window.cancelSaleV22}catch(_){ }

  let cancelledSale=null;
  function renderCancelled(){
    if(!cancelledSale)return;
    const app=document.getElementById('app');if(!app)return;
    if(app.querySelector('[data-cancelled-sale-v221="1"]'))return;
    app.innerHTML=`<main class="salePublicPageV21"><header class="salePublicTopV21"><img src="https://i.postimg.cc/JnF2F9Hw/LOGO-TRILHEIROS-Photoroom.png" alt="Trilheiros de Rondonópolis"><div><strong>TRILHEIROS DE RONDONÓPOLIS</strong><span>Cadastro do passeio</span></div></header><section class="salePublicMessageV21" data-cancelled-sale-v221="1"><h1>Este link foi encerrado</h1><p>A venda foi cancelada e as vagas já foram devolvidas ao passeio. Se precisar de atendimento, fale com os Trilheiros.</p></section></main>`;
  }

  function guardCancelledSale(){
    const m=location.pathname.match(/^\/cadastro-venda\/([^/]+)/);if(!m)return;
    let tries=0;const timer=setInterval(async()=>{
      tries++;try{
        if(typeof db!=='undefined'&&db){clearInterval(timer);const s=await db.collection('sales').doc(m[1]).get();if(s.exists&&s.data().sale_status==='cancelled'){cancelledSale=s.data();renderCancelled()}}
      }catch(_){ }
      if(tries>100)clearInterval(timer);
    },80);
  }

  window.addEventListener('load',()=>{patchAdminButtons();guardCancelledSale()});
  setTimeout(()=>{patchAdminButtons();guardCancelledSale()},300);
})();
