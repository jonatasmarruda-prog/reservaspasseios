/* Trilheiros Gestão V29 — custos, datas/horários, financeiro por forma, PIX parcelado e PDF sem CPF */
(function(){
  if(typeof state==='undefined') return;

  const GUIDE_NAME='Jonatas Marques de Arruda';
  const GUIDE_ROLE='GUIA DE TURISMO';
  const LOGO='https://i.postimg.cc/JnF2F9Hw/LOGO-TRILHEIROS-Photoroom.png';

  const q=s=>document.querySelector(s);
  const qa=s=>[...document.querySelectorAll(s)];
  const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const money=v=>{try{return typeof brl==='function'?brl(Number(v||0)):new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v||0))}catch{return `R$ ${Number(v||0).toFixed(2)}`}};
  const dateBR=v=>{try{return typeof date==='function'?date(v):String(v||'')}catch{return String(v||'')}};
  const notify=(m,t='')=>{try{return typeof toast==='function'?toast(m,t):alert(m)}catch{alert(m)}};
  const n=v=>Number(v||0)||0;

  function dateRangeLabel(t){
    const start=String(t?.trip_date||'').slice(0,10);
    const end=String(t?.trip_end_date||'').slice(0,10);
    if(!start) return '—';
    if(!end||end===start) return dateBR(start);
    return `${dateBR(start)} a ${dateBR(end)}`;
  }

  function paymentKind(v){
    const s=String(v||'').toLowerCase();
    if(s.includes('parcel')||s.includes('install')) return 'pix_parcelado';
    if(s.includes('card')||s.includes('cart')) return 'cartao';
    if(s.includes('pix')) return 'pix';
    return 'outro';
  }

  function paymentLabel(v){
    const k=paymentKind(v);
    return k==='pix'?'PIX':k==='cartao'?'CARTÃO':k==='pix_parcelado'?'PIX PARCELADO':'OUTRO';
  }

  function reservationValue(r,t){
    const sale=n(r?.sale_total);
    if(sale>0) return sale;
    const balance=n(r?.balance_due),paid=n(r?.paid_amount),refund=n(r?.refunded_amount);
    if(balance+paid-refund>0) return Math.max(0,balance+paid-refund);
    return n(t?.default_price)*n(r?.seats);
  }

  function costModel(t,seats){
    const fixed=n(t?.cost_bus_fixed)+n(t?.cost_guide_fixed)+n(t?.cost_other_fixed);
    const perPerson=n(t?.cost_lodging_per_person)+n(t?.cost_activity_per_person)+n(t?.cost_food_per_person)+n(t?.cost_insurance_per_person)+n(t?.cost_other_per_person);
    return {fixed,perPerson,total:fixed+(perPerson*Math.max(0,n(seats)))};
  }

  function activeReservations(ids){
    return (state.reservations||[]).filter(r=>ids.has(r.trip_id)&&r.status!=='cancelled');
  }

  function financeSummary(trips){
    const ids=new Set(trips.map(t=>t.id));
    const rs=activeReservations(ids);
    const es=(state.expenses||[]).filter(e=>ids.has(e.trip_id));
    const booked=rs.reduce((s,r)=>s+reservationValue(r,trips.find(t=>t.id===r.trip_id)),0);
    const received=rs.reduce((s,r)=>s+n(r.paid_amount)-n(r.refunded_amount),0);
    const manualExpenses=es.reduce((s,e)=>s+n(e.amount),0);
    const projectedCosts=trips.reduce((s,t)=>{
      const seats=rs.filter(r=>r.trip_id===t.id).reduce((a,r)=>a+n(r.seats),0);
      return s+costModel(t,seats).total;
    },0);
    const byMethod={pix:0,cartao:0,pix_parcelado:0,outro:0};
    rs.forEach(r=>{byMethod[paymentKind(r.payment_method)]+=reservationValue(r,trips.find(t=>t.id===r.trip_id))});
    const receivable=Math.max(0,booked-received);
    return {rs,es,booked,received,manualExpenses,projectedCosts,receivable,byMethod,projectedProfit:booked-projectedCosts,realProfit:received-manualExpenses};
  }

  /* Cadastro/edição do passeio */
  window.tripModal=function(id=''){
    const t=id?(state.trips||[]).find(x=>x.id===id):null;
    if(typeof modal!=='function') return notify('Não foi possível abrir o cadastro.','error');
    const oldReturn=String(t?.return_time||t?.return_info||'');
    const returnValue=/^\d{2}:\d{2}$/.test(oldReturn)?oldReturn:'';
    modal(`<form id="tripformV29">
      <div class="modalHead"><div><span class="eyebrow">${t?'EDITAR':'NOVO'} PASSEIO</span><h2 style="margin:4px 0">${t?'Atualizar informações':'Cadastrar passeio'}</h2></div><button type="button" class="iconClose" onclick="document.getElementById('modal')?.remove()">✕</button></div>
      <div class="modalBody">
        <div class="grid two">
          <label><span>Nome do passeio</span><input name="name" required value="${safe(t?.name||'')}"></label>
          <label><span>Destino</span><input name="destination" value="${safe(t?.destination||'')}"></label>
          <label><span>Data inicial</span><input name="tripDate" type="date" required value="${String(t?.trip_date||'').slice(0,10)}"></label>
          <label><span>Data final (somente se tiver 2 ou mais dias)</span><input name="tripEndDate" type="date" value="${String(t?.trip_end_date||'').slice(0,10)}"></label>
          <label><span>Saída</span><input name="departureTime" type="time" value="${safe(t?.departure_time||'')}"></label>
          <label><span>Retorno</span><input name="returnTime" type="time" value="${safe(returnValue)}"></label>
          <label><span>Ponto de saída</span><input name="departurePoint" value="${safe(t?.departure_point||'')}"></label>
          <label><span>Status</span><select name="status">${['draft','open','closed','completed','cancelled'].map(x=>`<option value="${x}" ${t?.status===x?'selected':''}>${typeof status!=='undefined'&&status[x]?status[x]:x}</option>`).join('')}</select></label>
          <label><span>Total de vagas</span><input name="totalSpots" type="number" min="1" required value="${t?.total_spots||45}"></label>
          <label><span>Valor cobrado por pessoa</span><input name="defaultPrice" type="number" min="0" step=".01" value="${t?.default_price||''}"></label>
          <label><span>Link do grupo WhatsApp</span><input name="whatsappGroupUrl" value="${safe(t?.whatsapp_group_url||'')}"></label>
        </div>

        <div class="v29CostBox">
          <div class="sectionTitle"><div><span class="eyebrow">CUSTOS DO PASSEIO</span><h3>Despesas previstas</h3><p>Custos fixos entram uma vez. Custos por pessoa aumentam automaticamente conforme entram reservas.</p></div></div>
          <div class="grid two">
            <label><span>Ônibus / transporte — valor fixo</span><input name="costBus" type="number" min="0" step=".01" value="${t?.cost_bus_fixed||''}"></label>
            <label><span>Hospedagem — por pessoa</span><input name="costLodging" type="number" min="0" step=".01" value="${t?.cost_lodging_per_person||''}"></label>
            <label><span>Custo do passeio / Day Use — por pessoa</span><input name="costActivity" type="number" min="0" step=".01" value="${t?.cost_activity_per_person||''}"></label>
            <label><span>Alimentação — por pessoa</span><input name="costFood" type="number" min="0" step=".01" value="${t?.cost_food_per_person||''}"></label>
            <label><span>Seguro — por pessoa</span><input name="costInsurance" type="number" min="0" step=".01" value="${t?.cost_insurance_per_person||''}"></label>
            <label><span>Guia / condutor — valor fixo</span><input name="costGuide" type="number" min="0" step=".01" value="${t?.cost_guide_fixed||''}"></label>
            <label><span>Outros custos — valor fixo</span><input name="costOtherFixed" type="number" min="0" step=".01" value="${t?.cost_other_fixed||''}"></label>
            <label><span>Outros custos — por pessoa</span><input name="costOtherPerson" type="number" min="0" step=".01" value="${t?.cost_other_per_person||''}"></label>
          </div>
          <div id="v29CostPreview" class="v29CostPreview"></div>
        </div>

        <label style="display:block;margin-top:14px"><span>O que levar / orientação</span><textarea name="whatToBring" rows="4">${safe(t?.what_to_bring||'')}</textarea></label>
        <label style="display:block;margin-top:14px"><span>Política de cancelamento</span><textarea name="cancellationPolicy" rows="6" required>${safe(t?.cancellation_policy||'')}</textarea></label>
        <div id="fmV29"></div>
      </div>
      <div class="modalFoot"><button type="button" class="btn ghost" onclick="document.getElementById('modal')?.remove()">Cancelar</button><button class="btn primary">Salvar passeio</button></div>
    </form>`);

    const f=q('#tripformV29');
    const preview=()=>{
      if(!f) return;
      const fixed=n(f.costBus.value)+n(f.costGuide.value)+n(f.costOtherFixed.value);
      const pp=n(f.costLodging.value)+n(f.costActivity.value)+n(f.costFood.value)+n(f.costInsurance.value)+n(f.costOtherPerson.value);
      const full=fixed+pp*n(f.totalSpots.value);
      const box=q('#v29CostPreview');
      if(box) box.innerHTML=`<b>Custo fixo:</b> ${money(fixed)} &nbsp; • &nbsp; <b>Custo por pessoa:</b> ${money(pp)} &nbsp; • &nbsp; <b>Custo estimado com lotação:</b> ${money(full)}`;
    };
    ['costBus','costGuide','costOtherFixed','costLodging','costActivity','costFood','costInsurance','costOtherPerson','totalSpots'].forEach(k=>f?.[k]?.addEventListener('input',preview));
    preview();

    f.onsubmit=async e=>{
      e.preventDefault();
      const x=e.target,start=x.tripDate.value,end=x.tripEndDate.value,msg=q('#fmV29');
      try{
        if(end&&end<start) throw Error('A data final não pode ser anterior à data inicial.');
        const totalSpots=n(x.totalSpots.value);
        const fixed=n(x.costBus.value)+n(x.costGuide.value)+n(x.costOtherFixed.value);
        const pp=n(x.costLodging.value)+n(x.costActivity.value)+n(x.costFood.value)+n(x.costInsurance.value)+n(x.costOtherPerson.value);
        const data={
          name:x.name.value.trim(),destination:x.destination.value.trim(),trip_date:start,trip_end_date:end&&end!==start?end:'',
          departure_time:x.departureTime.value,return_time:x.returnTime.value,return_info:x.returnTime.value,
          departure_point:x.departurePoint.value.trim(),status:x.status.value,total_spots:totalSpots,default_price:n(x.defaultPrice.value),
          whatsapp_group_url:x.whatsappGroupUrl.value.trim(),what_to_bring:x.whatToBring.value.trim(),cancellation_policy:x.cancellationPolicy.value.trim(),
          cost_bus_fixed:n(x.costBus.value),cost_lodging_per_person:n(x.costLodging.value),cost_activity_per_person:n(x.costActivity.value),
          cost_food_per_person:n(x.costFood.value),cost_insurance_per_person:n(x.costInsurance.value),cost_guide_fixed:n(x.costGuide.value),
          cost_other_fixed:n(x.costOtherFixed.value),cost_other_per_person:n(x.costOtherPerson.value),estimated_cost:fixed+(pp*totalSpots),
          email_reminder_enabled:t?.email_reminder_enabled===false?false:true,
          updated_at:firebase.firestore.FieldValue.serverTimestamp()
        };
        if(t){
          const used=n(t.used_spots);
          if(totalSpots<used) throw Error('O total de vagas não pode ser menor que as vagas já ocupadas.');
          data.used_spots=used;data.remaining_spots=totalSpots-used;
          await db.collection('trips').doc(t.id).update(data);
        }else{
          data.used_spots=1;data.remaining_spots=Math.max(0,totalSpots-1);data.assumes_payment=false;
          data.special_seat_reserved=true;data.special_seat_counted=true;data.special_seat_count=1;
          data.special_passenger_name=GUIDE_NAME;data.special_passenger_role=GUIDE_ROLE;
          data.created_at=firebase.firestore.FieldValue.serverTimestamp();
          await db.collection('trips').add(data);
        }
        document.getElementById('modal')?.remove();notify('Passeio salvo.');
      }catch(err){if(msg)msg.innerHTML=`<div class="msg error">${safe(err.message)}</div>`}
    };
  };
  try{tripModal=window.tripModal}catch(_){ }

  /* Financeiro */
  function renderFinanceV29(){
    const content=q('#content');if(!content) return;
    if(!['owner','admin','finance'].includes(state.role||'owner')){content.innerHTML='<div class="empty"><h3>Acesso restrito</h3><p>Seu perfil não possui acesso ao financeiro.</p></div>';return}
    const filter=state.financeTripFilter||'';
    const trips=filter?(state.trips||[]).filter(t=>t.id===filter):(state.trips||[]);
    const F=financeSummary(trips);
    const pixInstallments=F.rs.filter(r=>paymentKind(r.payment_method)==='pix_parcelado'&&r.payment_status!=='paid');
    content.innerHTML=`
      <div class="financeTop"><select id="finTripV29"><option value="">Todos os passeios</option>${(state.trips||[]).map(t=>`<option value="${t.id}" ${filter===t.id?'selected':''}>${safe(t.name)}</option>`).join('')}</select><button class="btn primary" onclick="expenseModal('${filter}')">+ Despesa real</button></div>
      <div class="metrics premiumMetrics">
        <div class="metric"><span>VENDAS / RESERVAS</span><strong>${money(F.booked)}</strong><small>valor registrado</small></div>
        <div class="metric"><span>RECEBIDO</span><strong>${money(F.received)}</strong><small>pagamentos confirmados</small></div>
        <div class="metric"><span>A RECEBER</span><strong>${money(F.receivable)}</strong><small>saldo das reservas</small></div>
        <div class="metric"><span>CUSTO PREVISTO</span><strong>${money(F.projectedCosts)}</strong><small>fixos + por pessoa reservada</small></div>
        <div class="metric"><span>DESPESAS REAIS</span><strong>${money(F.manualExpenses)}</strong><small>lançamentos realizados</small></div>
        <div class="metric metricProfit"><span>LUCRO PREVISTO</span><strong>${money(F.projectedProfit)}</strong><small>vendas - custo previsto</small></div>
      </div>
      <section class="panel"><div class="panelHead"><div><span class="eyebrow">FORMA DE PAGAMENTO</span><h2>Vendas registradas</h2></div></div><div class="v29PayGrid">
        <div><span>PIX</span><strong>${money(F.byMethod.pix)}</strong></div>
        <div><span>CARTÃO</span><strong>${money(F.byMethod.cartao)}</strong></div>
        <div><span>PIX PARCELADO</span><strong>${money(F.byMethod.pix_parcelado)}</strong></div>
        <div><span>OUTROS</span><strong>${money(F.byMethod.outro)}</strong></div>
      </div></section>
      ${pixInstallments.length?`<section class="panel v29InstallmentAlert"><div class="panelHead"><div><span class="eyebrow">LEMBRETE DE COBRANÇA</span><h2>PIX parcelado a acompanhar</h2><p>Essas reservas precisam de conferência das próximas parcelas.</p></div></div><div class="pendingList">${pixInstallments.map(r=>{const t=(state.trips||[]).find(x=>x.id===r.trip_id);return `<button class="pendingItem medium" onclick="reservationModal('${r.trip_id}','${r.id}')"><span>PIX PARCELADO</span><strong>${safe(r.responsible_name)} • ${safe(t?.name||r.trip_name||'Passeio')} • ${money(Math.max(0,reservationValue(r,t)-n(r.paid_amount)))}</strong><b>→</b></button>`}).join('')}</div></section>`:''}
      <section class="panel"><div class="panelHead"><div><span class="eyebrow">RESULTADO POR PASSEIO</span><h2>Receita, custos e lucro</h2></div></div><div class="tableWrap"><table class="table"><thead><tr><th>Passeio</th><th>Reservado</th><th>PIX</th><th>Cartão</th><th>PIX parc.</th><th>Custo atual</th><th>Lucro previsto</th></tr></thead><tbody>${trips.map(t=>{const trs=F.rs.filter(r=>r.trip_id===t.id),seats=trs.reduce((s,r)=>s+n(r.seats),0),booked=trs.reduce((s,r)=>s+reservationValue(r,t),0),cost=costModel(t,seats).total;const pm={pix:0,cartao:0,pix_parcelado:0};trs.forEach(r=>{const k=paymentKind(r.payment_method);if(k in pm)pm[k]+=reservationValue(r,t)});return `<tr><td><strong>${safe(t.name)}</strong><small>${dateRangeLabel(t)} • ${seats} vaga(s) de clientes</small></td><td>${money(booked)}</td><td>${money(pm.pix)}</td><td>${money(pm.cartao)}</td><td>${money(pm.pix_parcelado)}</td><td>${money(cost)}</td><td><strong>${money(booked-cost)}</strong></td></tr>`}).join('')}</tbody></table></div></section>`;
    q('#finTripV29')?.addEventListener('change',e=>{state.financeTripFilter=e.target.value;renderFinanceV29()});
  }
  window.renderFinanceV29=renderFinanceV29;

  function enhanceDashboard(){
    const content=q('#content');if(!content||q('#v29DashboardFinance'))return;
    const F=financeSummary(state.trips||[]);
    const section=document.createElement('section');section.className='panel';section.id='v29DashboardFinance';
    section.innerHTML=`<div class="panelHead"><div><span class="eyebrow">FINANCEIRO EM TEMPO REAL</span><h2>Resumo das reservas</h2><p>Atualiza conforme entram novas reservas.</p></div></div><div class="v29PayGrid"><div><span>VENDAS</span><strong>${money(F.booked)}</strong></div><div><span>CUSTO PREVISTO</span><strong>${money(F.projectedCosts)}</strong></div><div><span>LUCRO PREVISTO</span><strong>${money(F.projectedProfit)}</strong></div><div><span>PIX</span><strong>${money(F.byMethod.pix)}</strong></div><div><span>CARTÃO</span><strong>${money(F.byMethod.cartao)}</strong></div><div><span>PIX PARCELADO</span><strong>${money(F.byMethod.pix_parcelado)}</strong></div></div>`;
    content.appendChild(section);
  }

  function enhancePending(){
    if(state.tab!=='pending')return;
    const list=q('.pendingList');if(!list)return;
    qa('.pendingItem').forEach(item=>{
      const span=item.querySelector('span');if(String(span?.textContent||'').trim().toLowerCase()!=='pagamento')return;
      const strong=item.querySelector('strong');if(!strong)return;
      const txt=strong.textContent||'';
      const r=(state.reservations||[]).find(x=>txt.includes(x.responsible_name||'')&&txt.includes((state.trips||[]).find(t=>t.id===x.trip_id)?.name||''));
      if(r){
        const trip=(state.trips||[]).find(t=>t.id===r.trip_id);
        const method=paymentLabel(r.payment_method);
        strong.textContent=`${r.responsible_name||(r.participants?.[0]?.full_name)||'Sem nome'} • ${trip?.name||r.trip_name||'Passeio'} • ${method}`;
        if(paymentKind(r.payment_method)==='pix_parcelado'){span.textContent='PIX PARCELADO';item.classList.add('v29PixParcelado')}
      }
    });
  }

  function patchTripDates(){
    (state.trips||[]).forEach(t=>{
      const row=q(`[data-trip-row="${CSS.escape(String(t.id))}"]`);
      if(row&&row.children[2]) row.children[2].textContent=dateRangeLabel(t);
    });
  }

  /* PDF oficial sem CPF */
  window.pdfTrip=async function(id){
    if(!id)return notify('Selecione um passeio.','error');
    const t=(state.trips||[]).find(x=>x.id===id);if(!t)return notify('Passeio não encontrado.','error');
    const btn=document.activeElement,old=btn?.textContent;if(btn?.tagName==='BUTTON'){btn.disabled=true;btn.textContent='Gerando PDF...'}
    try{
      if(typeof ensurePdfLibraries==='function') await ensurePdfLibraries();
      if(!window.jspdf?.jsPDF) throw Error('Biblioteca de PDF indisponível.');
      const {jsPDF}=window.jspdf,doc=new jsPDF({unit:'mm',format:'a4'});
      const people=[{name:GUIDE_NAME,responsible:GUIDE_ROLE,special:true}];
      (state.reservations||[]).filter(r=>r.trip_id===id&&r.status!=='cancelled').forEach(r=>(r.participants||[]).forEach(p=>people.push({name:p.full_name||'',responsible:r.responsible_name||'',special:false})));
      let logo=null;try{const resp=await fetch(LOGO),blob=await resp.blob();logo=await new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>res(fr.result);fr.onerror=rej;fr.readAsDataURL(blob)})}catch(_){ }
      doc.setFillColor(7,50,38);doc.rect(0,0,210,58,'F');doc.setFillColor(216,173,66);doc.rect(0,58,210,2,'F');if(logo)try{doc.addImage(logo,'PNG',14,9,30,30)}catch(_){ }
      doc.setTextColor(255);doc.setFont('helvetica','bold');doc.setFontSize(10);doc.text('TRILHEIROS DE RONDONÓPOLIS',logo?51:14,17);doc.setFontSize(22);doc.text('LISTA OFICIAL DE PARTICIPANTES',logo?51:14,29);doc.setFontSize(10);doc.setFont('helvetica','normal');doc.text(String(t.name||''),logo?51:14,39);doc.text(`${dateRangeLabel(t)} • ${t.destination||''}`,logo?51:14,46);
      doc.setTextColor(20,45,35);doc.setFont('helvetica','bold');doc.setFontSize(14);doc.text('Participantes',14,74);doc.setFontSize(8.5);doc.setFont('helvetica','normal');doc.setTextColor(80);doc.text('Nº 01 reservado ao Guia de Turismo. Demais participantes seguem a numeração.',14,82);
      const body=people.map((p,i)=>[String(i+1).padStart(2,'0'),p.name,p.special?GUIDE_ROLE:(p.responsible||'')]);
      doc.autoTable({startY:90,head:[['Nº','NOME DO PARTICIPANTE','RESPONSÁVEL / FUNÇÃO']],body,theme:'grid',styles:{font:'helvetica',fontSize:8.5,cellPadding:2.8,textColor:[25,48,40],lineColor:[220,231,226],lineWidth:.15},headStyles:{fillColor:[7,50,38],textColor:[255,255,255],fontStyle:'bold'},columnStyles:{0:{cellWidth:14,halign:'center'},1:{cellWidth:100},2:{cellWidth:68}},margin:{left:14,right:14,bottom:16},didParseCell:data=>{if(data.section==='body'&&data.row.index===0){data.cell.styles.fillColor=[248,241,215];data.cell.styles.fontStyle='bold';data.cell.styles.lineColor=[216,173,66]}}});
      const filename=`lista-oficial-${String(t.name||'passeio').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}.pdf`;
      if(typeof window.openPdfPreviewV14==='function') window.openPdfPreviewV14(doc,{filename,title:'Lista oficial de participantes',subtitle:`${t.name} • ${dateRangeLabel(t)}`,shareText:`Lista oficial de participantes — ${t.name}`});
      else doc.save(filename);
    }catch(err){console.error(err);notify('Não foi possível gerar o PDF agora.','error')}finally{if(btn?.tagName==='BUTTON'){btn.disabled=false;btn.textContent=old||'PDF'}}
  };
  try{pdfTrip=window.pdfTrip}catch(_){ }

  /* Integração com renderização existente */
  const originalRenderAdmin=window.renderAdmin;
  if(typeof originalRenderAdmin==='function'){
    window.renderAdmin=function(...args){
      const out=originalRenderAdmin.apply(this,args);
      queueMicrotask(()=>{
        try{
          patchTripDates();
          if(state.tab==='finance') renderFinanceV29();
          else if(state.tab==='dashboard') enhanceDashboard();
          else if(state.tab==='pending') enhancePending();
          const nt=q('#newTrip');if(nt)nt.onclick=()=>window.tripModal();
        }catch(e){console.warn('V29 render:',e)}
      });
      return out;
    };
    try{renderAdmin=window.renderAdmin}catch(_){ }
  }

  const style=document.createElement('style');
  style.textContent=`
    .v29CostBox{margin-top:18px;padding:18px;border:1px solid #d9e6e0;border-radius:18px;background:#f8fbf9}
    .v29CostBox h3{margin:4px 0 4px}.v29CostBox p{margin:0;color:#708279;font-size:12px}
    .v29CostPreview{margin-top:14px;padding:12px 14px;border-radius:12px;background:#edf6f1;color:#173d31;font-size:12px}
    .v29PayGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;padding:20px}
    .v29PayGrid>div{border:1px solid var(--line,#dfe7e3);border-radius:16px;padding:16px;background:var(--card,#fff)}
    .v29PayGrid span{display:block;font-size:10px;font-weight:800;letter-spacing:.06em;color:var(--muted,#71867e);margin-bottom:7px}
    .v29PayGrid strong{font-size:20px;color:var(--green,#0b4d3b)}
    .v29InstallmentAlert{border-color:#e7bd58}.v29PixParcelado{box-shadow:inset 4px 0 0 #d5a625}
    @media(max-width:900px){.v29PayGrid{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @media(max-width:560px){.v29PayGrid{grid-template-columns:1fr}.v29CostBox .grid.two{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);
})();
