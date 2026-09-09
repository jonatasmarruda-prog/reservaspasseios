/* Trilheiros Gestão V10 — resumo público, Minha Viagem Premium, WhatsApp e parcelas */
(function(){
  const LOGO='https://i.postimg.cc/JnF2F9Hw/LOGO-TRILHEIROS-Photoroom.png';
  const $q=s=>document.querySelector(s);
  const $qa=s=>[...document.querySelectorAll(s)];
  const digits=v=>String(v||'').replace(/\D/g,'');
  const maskCpf=v=>{const n=digits(v);return n.length===11?`${n.slice(0,3)}.***.***-${n.slice(-2)}`:'—'};
  const safe=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const money=v=>typeof brl==='function'?brl(v):new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v||0));
  const fmtDate=v=>typeof date==='function'?date(v):String(v||'—');
  const closeModal=()=>{if(typeof closeModalV7==='function')closeModalV7();else document.getElementById('modal')?.remove()};
  const roleCanPay=()=>!state?.role||['owner','admin','finance'].includes(state.role);
  const roleCanManageStatus=()=>!state?.role||['owner','admin'].includes(state.role);

  function normalizeWhatsApp(v){
    let n=digits(v);
    if(!n)return'';
    if((n.length===10||n.length===11)&&!n.startsWith('55'))n='55'+n;
    return n.length>=12?n:'';
  }
  async function publicSettings(){
    try{
      const s=await db.collection('settings').doc('public').get();
      return s.exists?s.data():{};
    }catch(_){return{}}
  }
  function waLink(number,text){const n=normalizeWhatsApp(number);return n?`https://wa.me/${n}?text=${encodeURIComponent(text)}`:''}

  /* ---------- Cadastro público: resumo sem criar nova etapa ---------- */
  function attachSimpleSummary(){
    const form=$q('#simpleReg');
    if(!form||form.dataset.v10Summary==='1')return;
    form.dataset.v10Summary='1';
    const policy=form.querySelector('.simplePolicySection');
    if(!policy)return;
    const box=document.createElement('section');
    box.className='simpleReviewV10';
    policy.before(box);

    const update=()=>{
      const hero=$q('.simpleTripHero h1')?.textContent?.trim()||'Passeio';
      const names=[];
      const main=$q('#simpleName')?.value?.trim();
      if(main)names.push(main);
      $qa('[data-companion-name]').forEach(x=>{const n=x.value.trim();if(n)names.push(n)});
      const qty=1+$qa('[data-companion-name]').length;
      const email=$q('#simpleEmail')?.value?.trim()||'';
      box.innerHTML=`<div class="simpleReviewHead"><div><span>CONFIRA ANTES DE ENVIAR</span><h3>Resumo do cadastro</h3></div><strong>${qty} vaga${qty===1?'':'s'}</strong></div><div class="simpleReviewGrid"><div><small>PASSEIO</small><b>${safe(hero)}</b></div><div><small>PARTICIPANTES</small><b>${names.length?safe(names.join(', ')):'Preencha os nomes acima'}</b></div>${email?`<div class="simpleReviewFull"><small>E-MAIL</small><b>${safe(email)}</b></div>`:''}</div>`;
    };
    form.addEventListener('input',update);
    form.addEventListener('change',()=>setTimeout(update,0));
    update();
  }

  async function enhanceSuccess(){
    const page=$q('.simpleSuccess');
    if(!page||page.dataset.v10==='1')return;
    page.dataset.v10='1';
    const code=$q('.simpleProtocol strong')?.textContent?.trim()||'';
    const tripName=$q('.simpleSuccess>p b')?.textContent?.trim()||'meu passeio';
    const names=$qa('.simpleSuccessPeople>div span').map(x=>x.textContent.replace(/^\d+\.\s*/, '').trim()).filter(Boolean);
    const tripHref=$q('.simpleSuccessActions a[href^="/minha-reserva/"]')?.getAttribute('href')||'';
    const tripId=tripHref.split('/')[2]||'';
    const settings=await publicSettings();
    const msg=`Olá! Meu cadastro para ${tripName} foi concluído ✅\nProtocolo: ${code}\nParticipantes: ${names.join(', ')||'conforme cadastro'}.`;
    const direct=waLink(settings.whatsapp,msg);
    let fallback='';
    if(!direct&&tripId){
      try{const t=await db.collection('trips').doc(tripId).get();fallback=t.exists?(t.data().whatsapp_group_url||''):''}catch(_){ }
    }
    const url=direct||fallback;
    if(!url)return;
    const actions=$q('.simpleSuccessActions');
    if(!actions)return;
    const a=document.createElement('a');
    a.className='simpleWhatsAppBtn';
    a.href=url;a.target='_blank';a.rel='noopener';
    a.textContent=direct?'Enviar protocolo no WhatsApp':'Abrir WhatsApp do passeio';
    actions.append(a);
  }

  const publicObserver=new MutationObserver(()=>{
    attachSimpleSummary();
    enhanceSuccess();
  });
  publicObserver.observe(document.documentElement,{subtree:true,childList:true});
  window.addEventListener('load',()=>{attachSimpleSummary();enhanceSuccess()});

  /* ---------- Minha Viagem Premium ---------- */
  window.myReservation=async function(tripId){
    app.innerHTML=`<main class="myTripPage"><header class="myTripTop"><div class="myTripBrand"><img src="${LOGO}" alt="Trilheiros de Rondonópolis"><div><strong>TRILHEIROS DE RONDONÓPOLIS</strong><span>Minha viagem</span></div></div></header><div class="myTripLoading"><div></div><h2>Carregando sua viagem...</h2></div></main>`;
    try{
      const u=await ensureAnon();
      const [ts,rs,ps]=await Promise.all([
        db.collection('trips').doc(tripId).get(),
        db.collection('trips').doc(tripId).collection('reservations').doc(u.uid).get(),
        publicSettings()
      ]);
      if(!ts.exists||!rs.exists)throw Error('Reserva não localizada neste aparelho.');
      const t={id:ts.id,...ts.data()},r={id:rs.id,...rs.data()};
      const net=Math.max(0,Number(r.paid_amount||0)-Number(r.refunded_amount||0));
      const installments=Array.isArray(r.installments)?r.installments:[];
      const pendingInstallments=installments.filter(x=>x.status!=='paid');
      const statusText=(typeof status!=='undefined'&&status[r.status])||r.status||'Ativa';
      const payText=(typeof status!=='undefined'&&status[r.payment_status])||r.payment_status||'—';
      const support=waLink(ps.whatsapp,`Olá! Preciso de ajuda com minha reserva de ${t.name}. Protocolo: ${r.protocol||'sem protocolo'}.`);
      const correction=waLink(ps.whatsapp,`Olá! Preciso solicitar uma correção nos dados da minha reserva de ${t.name}. Protocolo: ${r.protocol||'sem protocolo'}.`);
      const answers=Object.values(r.registration_answers||{}).filter(x=>x?.value);
      const people=(r.participants||[]);
      app.innerHTML=`<main class="myTripPage"><header class="myTripTop"><div class="myTripBrand"><img src="${LOGO}" alt="Trilheiros de Rondonópolis"><div><strong>TRILHEIROS DE RONDONÓPOLIS</strong><span>Minha viagem</span></div></div></header><section class="myTripHero"><span>MINHA VIAGEM</span><h1>${safe(t.name)}</h1><p>${safe(t.destination||'Trilheiros de Rondonópolis')}${t.trip_date?` • ${fmtDate(t.trip_date)}`:''}</p><div class="myTripStatus"><b>${safe(statusText)}</b><small>Protocolo ${safe(r.protocol||'—')}</small></div></section><div class="myTripContent"><section class="myTripMetrics"><div><small>DATA</small><strong>${fmtDate(t.trip_date)}</strong></div><div><small>PARTICIPANTES</small><strong>${people.length||r.seats||0}</strong></div><div><small>PAGAMENTO</small><strong>${safe(payText)}</strong></div><div><small>VALOR REGISTRADO</small><strong>${money(net)}</strong></div></section><section class="myTripCard"><div class="myTripCardHead"><div><span>PARTICIPANTES</span><h2>Quem está cadastrado</h2></div></div><div class="myTripPeople">${people.map((p,i)=>`<div><span><b>${i+1}</b>${safe(p.full_name)}</span><small>${maskCpf(p.cpf)}</small></div>`).join('')}</div></section>${answers.length?`<section class="myTripCard"><div class="myTripCardHead"><div><span>RESERVA</span><h2>Opções escolhidas</h2></div></div><div class="myTripAnswers">${answers.map(x=>`<div><small>${safe(x.label||'Opção')}</small><strong>${safe(x.value)}</strong></div>`).join('')}</div></section>`:''}${installments.length?`<section class="myTripCard"><div class="myTripCardHead"><div><span>FINANCEIRO</span><h2>Parcelas</h2></div><b>${pendingInstallments.length?`${pendingInstallments.length} pendente${pendingInstallments.length===1?'':'s'}`:'Tudo pago ✓'}</b></div><div class="myTripInstallments">${installments.map((x,i)=>`<div class="${x.status==='paid'?'paid':''}"><span><b>${i+1}ª parcela</b><small>${x.due_date?fmtDate(x.due_date):'Sem vencimento'}</small></span><strong>${money(x.amount)}</strong><em>${x.status==='paid'?'Pago':'Pendente'}</em></div>`).join('')}</div></section>`:''}${t.what_to_bring||t.reminder_notes?`<section class="myTripCard myTripHighlight"><div class="myTripCardHead"><div><span>PREPARE-SE</span><h2>Informações importantes</h2></div></div>${t.what_to_bring?`<div class="myTripInfo"><b>🎒 O que levar</b><p>${safe(t.what_to_bring)}</p></div>`:''}${t.reminder_notes?`<div class="myTripInfo"><b>📝 Recado do passeio</b><p>${safe(t.reminder_notes)}</p></div>`:''}</section>`:''}<section class="myTripCard"><details class="myTripPolicy"><summary>Política de cancelamento <b>Toque para ler</b></summary><div>${safe(r.policy_text||t.cancellation_policy||'')}</div></details></section>${r.status==='cancel_requested'?`<div class="myTripNotice">Seu pedido de cancelamento já foi enviado e está aguardando análise.</div>`:''}<div class="myTripActions">${support?`<a class="myTripPrimary" target="_blank" rel="noopener" href="${safe(support)}">Falar com os Trilheiros</a>`:''}${correction?`<a class="myTripGhost" target="_blank" rel="noopener" href="${safe(correction)}">Solicitar correção dos dados</a>`:''}${t.whatsapp_group_url?`<a class="myTripGhost" target="_blank" rel="noopener" href="${safe(t.whatsapp_group_url)}">Abrir grupo do passeio</a>`:''}</div>${r.status==='active'?`<section class="myTripCancel"><h3>Precisa cancelar?</h3><p>Envie a solicitação para análise conforme a política aceita no cadastro.</p><textarea id="myCancelReason" placeholder="Motivo (opcional)"></textarea><button id="myCancelBtn">Solicitar cancelamento</button></section>`:''}<a class="myTripBack" href="/">← Voltar</a></div></main>`;
      const cancel=$q('#myCancelBtn');
      if(cancel)cancel.onclick=async()=>{
        if(!confirm('Deseja registrar o pedido de cancelamento?'))return;
        cancel.disabled=true;cancel.textContent='Enviando...';
        try{
          await rs.ref.update({status:'cancel_requested',cancel_reason:$q('#myCancelReason')?.value||'',cancel_requested_at:firebase.firestore.FieldValue.serverTimestamp(),updated_at:firebase.firestore.FieldValue.serverTimestamp()});
          toast('Solicitação registrada.');setTimeout(()=>window.myReservation(tripId),500);
        }catch(e){cancel.disabled=false;cancel.textContent='Solicitar cancelamento';toast(e.message||'Não foi possível enviar.','error')}
      };
    }catch(e){app.innerHTML=`<main class="myTripPage"><header class="myTripTop"><div class="myTripBrand"><img src="${LOGO}" alt="Trilheiros"><div><strong>TRILHEIROS DE RONDONÓPOLIS</strong><span>Minha viagem</span></div></div></header><section class="myTripNotFound"><h1>Não encontramos sua reserva</h1><p>${safe(e.message||'Tente novamente neste mesmo aparelho.')}</p><a href="/">Voltar ao cadastro</a></section></main>`}
  };
  try{myReservation=window.myReservation}catch(_){ }

  /* ---------- Admin: parcelas e vencimentos ---------- */
  function addMonths(iso,months){
    const d=iso?new Date(`${iso}T12:00:00`):new Date();
    const day=d.getDate();d.setDate(1);d.setMonth(d.getMonth()+months);const last=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();d.setDate(Math.min(day,last));return d.toISOString().slice(0,10);
  }
  function installmentStatus(list,total,manualPaid=0){
    const paid=list.length?list.filter(x=>x.status==='paid').reduce((s,x)=>s+Number(x.amount||0),0):Number(manualPaid||0);
    if(total>0&&paid>=total-0.009)return{paid,status:'paid'};
    if(paid>0)return{paid,status:'partial'};
    return{paid,status:'pending'};
  }

  window.reservationModal=function(tripId,id){
    const r=state.reservations.find(x=>x.trip_id===tripId&&x.id===id),t=state.trips.find(x=>x.id===tripId);
    if(!r||!t)return toast('Reserva não encontrada.','error');
    const canPay=roleCanPay(),canStatus=roleCanManageStatus();
    let rows=(Array.isArray(r.installments)?r.installments:[]).map((x,i)=>({id:x.id||`p${i+1}`,due_date:x.due_date||'',amount:Number(x.amount||0),status:x.status==='paid'?'paid':'pending',paid_at:x.paid_at||''}));
    const defaultTotal=Number(r.installment_total||0)||Number(t.default_price||0)*Number(r.seats||0)||Number(r.paid_amount||0);
    modal(`<form id="paymentV10"><div class="modalHead"><div><span class="eyebrow">RESERVA • FINANCEIRO</span><h2 style="margin:4px 0">${safe(r.responsible_name)}</h2><small>${safe(t.name)} • ${r.seats||0} vaga(s) • ${safe(r.protocol||'sem protocolo')}</small></div><button type="button" class="iconClose" id="payCloseV10">✕</button></div><div class="modalBody"><div class="payOverviewV10"><div><small>VALOR PADRÃO DO PASSEIO</small><strong>${money(Number(t.default_price||0)*Number(r.seats||0))}</strong></div><div><small>JÁ REGISTRADO</small><strong>${money(r.paid_amount||0)}</strong></div><div><small>STATUS</small><strong>${safe((typeof status!=='undefined'&&status[r.payment_status])||r.payment_status||'—')}</strong></div></div><div class="grid two"><label><span>Valor total combinado</span><input name="total" type="number" min="0" step=".01" value="${defaultTotal}" ${canPay?'':'disabled'}></label><label><span>Reembolso</span><input name="refund" type="number" min="0" step=".01" value="${Number(r.refunded_amount||0)}" ${canPay?'':'disabled'}></label><label><span>Forma de pagamento</span><select name="method" ${canPay?'':'disabled'}>${[['pix','PIX'],['cartao','Cartão'],['pix_parcelado','PIX parcelado'],['dinheiro','Dinheiro'],['a_confirmar','A confirmar']].map(x=>`<option value="${x[0]}" ${r.payment_method===x[0]?'selected':''}>${x[1]}</option>`).join('')}</select></label>${rows.length?'<label><span>Valor pago</span><input id="paidComputedV10" disabled value=""></label>':`<label><span>Valor já recebido</span><input name="manualPaid" type="number" min="0" step=".01" value="${Number(r.paid_amount||0)}" ${canPay?'':'disabled'}></label>`}${canStatus?`<label><span>Status da reserva</span><select name="reservationStatus">${['active','cancel_requested','cancelled','transferred'].map(x=>`<option value="${x}" ${r.status===x?'selected':''}>${(typeof status!=='undefined'&&status[x])||x}</option>`).join('')}</select></label>`:`<label><span>Status da reserva</span><input disabled value="${safe((typeof status!=='undefined'&&status[r.status])||r.status)}"></label>`}</div><section class="installmentBoxV10"><div class="installmentHeadV10"><div><span>PARCELAMENTO</span><h3>Parcelas e vencimentos</h3><p>Use somente quando houver pagamento parcelado. O valor recebido é calculado pelas parcelas marcadas como pagas.</p></div>${canPay?`<div class="toolbar"><button type="button" class="btn ghost" id="gen2V10">Gerar 2x</button><button type="button" class="btn ghost" id="gen3V10">Gerar 3x</button><button type="button" class="btn primary" id="addV10">+ Parcela</button></div>`:''}</div><div id="installmentRowsV10"></div><div class="installmentTotalsV10" id="installmentTotalsV10"></div></section><label style="display:block;margin-top:16px"><span>Observações internas</span><textarea name="notes" rows="4" ${canPay?'':'disabled'}>${safe(r.admin_notes||'')}</textarea></label><div id="paymentMsgV10"></div></div><div class="modalFoot"><button type="button" class="btn ghost" id="payCancelV10">Fechar</button>${canPay?'<button class="btn primary" id="paySaveV10">Salvar financeiro</button>':''}</div></form>`);
    $q('#payCloseV10').onclick=closeModal;$q('#payCancelV10').onclick=closeModal;
    const form=$q('#paymentV10');
    const renderRows=()=>{
      const box=$q('#installmentRowsV10');
      box.innerHTML=rows.length?rows.map((x,i)=>`<div class="installmentRowV10 ${x.status==='paid'?'paid':''}"><span class="installmentNumberV10">${i+1}</span><label><small>Vencimento</small><input type="date" data-due-v10="${i}" value="${safe(x.due_date)}" ${canPay?'':'disabled'}></label><label><small>Valor</small><input type="number" min="0" step=".01" data-amount-v10="${i}" value="${Number(x.amount||0).toFixed(2)}" ${canPay?'':'disabled'}></label><label><small>Status</small><select data-status-v10="${i}" ${canPay?'':'disabled'}><option value="pending" ${x.status!=='paid'?'selected':''}>Pendente</option><option value="paid" ${x.status==='paid'?'selected':''}>Pago</option></select></label>${canPay?`<button type="button" class="removeInstallmentV10" data-remove-v10="${i}">Remover</button>`:''}</div>`).join(''):'<div class="installmentEmptyV10">Sem parcelamento cadastrado. Você pode informar apenas o valor já recebido acima.</div>';
      box.querySelectorAll('[data-due-v10]').forEach(el=>el.onchange=e=>{rows[Number(e.target.dataset.dueV10)].due_date=e.target.value;updateTotals()});
      box.querySelectorAll('[data-amount-v10]').forEach(el=>el.oninput=e=>{rows[Number(e.target.dataset.amountV10)].amount=Number(e.target.value||0);updateTotals()});
      box.querySelectorAll('[data-status-v10]').forEach(el=>el.onchange=e=>{const i=Number(e.target.dataset.statusV10);rows[i].status=e.target.value;rows[i].paid_at=e.target.value==='paid'?(rows[i].paid_at||new Date().toISOString().slice(0,10)):'';renderRows()});
      box.querySelectorAll('[data-remove-v10]').forEach(el=>el.onclick=()=>{rows.splice(Number(el.dataset.removeV10),1);renderRows()});
      updateTotals();
    };
    const updateTotals=()=>{
      const total=Number(form.total.value||0),manual=Number(form.manualPaid?.value||0),calc=installmentStatus(rows,total,manual),sum=rows.reduce((s,x)=>s+Number(x.amount||0),0),pending=rows.filter(x=>x.status!=='paid').sort((a,b)=>String(a.due_date).localeCompare(String(b.due_date))),balance=Math.max(0,total-calc.paid);
      if($q('#paidComputedV10'))$q('#paidComputedV10').value=money(calc.paid);
      $q('#installmentTotalsV10').innerHTML=`<div><small>TOTAL DAS PARCELAS</small><strong>${money(sum)}</strong></div><div><small>RECEBIDO</small><strong>${money(calc.paid)}</strong></div><div><small>SALDO</small><strong>${money(balance)}</strong></div><div><small>PRÓXIMO VENCIMENTO</small><strong>${pending[0]?.due_date?fmtDate(pending[0].due_date):'—'}</strong></div>`;
    };
    if(form.total)form.total.oninput=updateTotals;if(form.manualPaid)form.manualPaid.oninput=updateTotals;
    if($q('#addV10'))$q('#addV10').onclick=()=>{rows.push({id:`p${Date.now()}`,due_date:new Date().toISOString().slice(0,10),amount:0,status:'pending',paid_at:''});renderRows()};
    const generate=n=>{const total=Number(form.total.value||0);if(total<=0)return toast('Informe o valor total combinado primeiro.','error');const base=Math.floor((total/n)*100)/100,values=Array.from({length:n},()=>base),diff=Math.round((total-values.reduce((a,b)=>a+b,0))*100)/100;values[n-1]+=diff;const start=new Date().toISOString().slice(0,10);rows=values.map((v,i)=>({id:`p${i+1}-${Date.now()}`,due_date:addMonths(start,i),amount:v,status:'pending',paid_at:''}));renderRows()};
    if($q('#gen2V10'))$q('#gen2V10').onclick=()=>generate(2);if($q('#gen3V10'))$q('#gen3V10').onclick=()=>generate(3);
    renderRows();
    if(canPay)form.onsubmit=async e=>{
      e.preventDefault();const save=$q('#paySaveV10');save.disabled=true;save.textContent='Salvando...';
      try{
        const total=Number(form.total.value||0),manual=Number(form.manualPaid?.value||0),calc=installmentStatus(rows,total,manual),refund=Number(form.refund.value||0),nextDue=rows.filter(x=>x.status!=='paid'&&x.due_date).sort((a,b)=>a.due_date.localeCompare(b.due_date))[0]?.due_date||'';
        let paymentStatus=calc.status;if(refund>0&&calc.paid>0&&refund>=calc.paid)paymentStatus='refunded';
        const ref=db.collection('trips').doc(tripId).collection('reservations').doc(id),tripRef=db.collection('trips').doc(tripId);
        await db.runTransaction(async tx=>{
          const [rs,ts]=await Promise.all([tx.get(ref),tx.get(tripRef)]);if(!rs.exists||!ts.exists)throw Error('Registro não encontrado.');
          const old=rs.data(),trip=ts.data();let rem=Number(trip.remaining_spots||0),used=Number(trip.used_spots||0),next=old.status;
          if(canStatus)next=form.reservationStatus.value;
          if(canStatus&&old.status!=='cancelled'&&next==='cancelled'){rem+=Number(old.seats||0);used=Math.max(0,used-Number(old.seats||0))}
          if(canStatus&&old.status==='cancelled'&&next!=='cancelled'){if(rem<Number(old.seats||0))throw Error('Não há vagas suficientes para reativar esta reserva.');rem-=Number(old.seats||0);used+=Number(old.seats||0)}
          const cleanRows=rows.map((x,i)=>({id:x.id||`p${i+1}`,due_date:x.due_date||'',amount:Number(x.amount||0),status:x.status==='paid'?'paid':'pending',paid_at:x.status==='paid'?(x.paid_at||new Date().toISOString().slice(0,10)):''}));
          const data={paid_amount:calc.paid,refunded_amount:refund,payment_method:form.method.value,payment_status:paymentStatus,installment_total:total,installments:cleanRows,next_due_date:nextDue,admin_notes:form.notes.value,updated_at:firebase.firestore.FieldValue.serverTimestamp()};
          if(canStatus)data.status=next;
          tx.update(ref,data);
          if(canStatus&&(rem!==Number(trip.remaining_spots||0)||used!==Number(trip.used_spots||0)))tx.update(tripRef,{remaining_spots:rem,used_spots:used,updated_at:firebase.firestore.FieldValue.serverTimestamp()});
        });
        try{if(typeof auditV7==='function')await auditV7('finance','reservation',id,`Financeiro atualizado • ${r.responsible_name}`)}catch(_){ }
        closeModal();toast('Financeiro e parcelas atualizados.');
      }catch(ex){$q('#paymentMsgV10').innerHTML=`<div class="msg error">${safe(ex.message||'Não foi possível salvar.')}</div>`;save.disabled=false;save.textContent='Salvar financeiro'}
    };
  };
  try{reservationModal=window.reservationModal}catch(_){ }

  /* Recebíveis passam a considerar o valor total combinado quando existir. */
  window.enrich=function(){
    state.trips=state.trips.map(t=>{
      const rs=state.reservations.filter(r=>r.trip_id===t.id);
      const gross=rs.reduce((s,r)=>s+Number(r.paid_amount||0),0);
      const refunds=rs.reduce((s,r)=>s+Number(r.refunded_amount||0),0);
      const net=gross-refunds;
      const expenses=state.expenses.filter(e=>e.trip_id===t.id).reduce((s,e)=>s+Number(e.amount||0),0);
      const profit=net-expenses;
      const receivable=rs.filter(r=>!['refunded','cancelled'].includes(r.payment_status)).reduce((s,r)=>{
        const expected=Number(r.installment_total||0)||Number(t.default_price||0)*Number(r.seats||0);
        return s+Math.max(0,expected-Number(r.paid_amount||0));
      },0);
      return {...t,gross_revenue:gross,refunds,net_revenue:net,expenses,profit,receivable,estimated_cost:Number(t.estimated_cost||0)};
    });
  };
  try{enrich=window.enrich}catch(_){ }

  /* Espelha somente informações públicas do WhatsApp; nunca expõe configurações internas. */
  async function syncPublicSettings(){
    if(!location.pathname.startsWith('/admin')||!auth?.currentUser)return;
    try{
      const s=await db.collection('settings').doc('general').get();
      if(!s.exists)return;const g=s.data();
      await db.collection('settings').doc('public').set({business_name:g.business_name||'Trilheiros de Rondonópolis',whatsapp:g.whatsapp||'',updated_at:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});
    }catch(_){ }
  }
  try{auth?.onAuthStateChanged?.(u=>{if(u)setTimeout(syncPublicSettings,1200)})}catch(_){ }
  document.addEventListener('submit',e=>{if(e.target?.id==='generalSettings')setTimeout(syncPublicSettings,900)},true);
})();
