/* Trilheiros de Rondonópolis — recursos administrativos e cadastro v2 */

function closeTripModal(){
  const el=document.getElementById('modal');
  if(el) el.remove();
}

function splitOptions(value){
  return String(value||'').split('|').map(x=>x.trim()).filter(Boolean);
}

function joinOptions(value){
  return Array.isArray(value)?value.join(' | '):'';
}

function defaultCancellationPolicy(name='este passeio'){
  const trip=String(name||'este passeio').trim()||'este passeio';
  return `POLÍTICA DE CANCELAMENTO — ${trip.toUpperCase()}\n\nAo concluir o cadastro, o participante declara que leu e concorda com esta política. Esta regra é operacional e será aplicada sem prejuízo dos direitos assegurados pela legislação vigente.\n\n1. DESISTÊNCIA DO PARTICIPANTE\n• Quando houver direito de arrependimento previsto em lei, ele será integralmente respeitado.\n• Fora das hipóteses legais obrigatórias, pedidos feitos com 7 dias ou mais de antecedência poderão receber 90% de reembolso ou 100% de crédito para outro passeio, conforme disponibilidade.\n• Entre 6 e 3 dias antes do passeio: poderá ser oferecido 50% de reembolso ou 70% de crédito.\n• Com menos de 72 horas de antecedência: não há garantia de reembolso, pois transporte, hospedagem, alimentação, seguro, ingressos e demais serviços podem já estar contratados.\n\n2. TRANSFERÊNCIA DA VAGA\nA vaga poderá ser transferida para outra pessoa, quando operacionalmente possível, desde que a alteração seja solicitada antes do fechamento da lista e sejam enviados os dados completos do novo participante.\n\n3. NÃO COMPARECIMENTO\nA ausência no horário e ponto de saída informados será considerada não comparecimento e, ressalvados os direitos previstos em lei, não gera reembolso automático.\n\n4. ALTERAÇÃO OU CANCELAMENTO PELO ORGANIZADOR\nEm caso de condição climática severa, risco à segurança, interdição, força maior ou cancelamento do serviço, os participantes serão informados e será apresentada a solução aplicável ao caso, como remarcação, crédito ou reembolso, conforme a situação e a legislação.\n\n5. DESPESAS DE TERCEIROS\nValores já repassados a fornecedores e que sejam comprovadamente não reembolsáveis serão analisados de acordo com as regras do fornecedor e a legislação aplicável.\n\nAo marcar a opção de aceite no cadastro, o participante confirma ciência destas condições.`;
}

function tripRegistrationFields(t){
  const c=t?.registration_options||{};
  const extraLabel=String(c.extra_label||'Opção adicional').trim()||'Opção adicional';
  return [
    {key:'accommodation',label:'Hospedagem',options:Array.isArray(c.accommodation)?c.accommodation:[]},
    {key:'transport',label:'Transporte',options:Array.isArray(c.transport)?c.transport:[]},
    {key:'category',label:'Categoria',options:Array.isArray(c.category)?c.category:[]},
    {key:'boarding',label:'Ponto de embarque',options:Array.isArray(c.boarding)?c.boarding:[]},
    {key:'extra',label:extraLabel,options:Array.isArray(c.extra)?c.extra:[]}
  ].filter(x=>x.options.length);
}

function tripPublicDetails(t){
  const items=[];
  if(t.difficulty) items.push(['Nível',t.difficulty]);
  if(t.minimum_age) items.push(['Idade mínima',`${t.minimum_age} anos`]);
  if(t.distance_km) items.push(['Distância',`${t.distance_km} km`]);
  if(t.departure_time) items.push(['Saída',t.departure_time]);
  if(t.departure_point) items.push(['Embarque',t.departure_point]);
  if(t.return_info) items.push(['Retorno',t.return_info]);
  if(!items.length&&!t.included_items) return '';
  return `<div class="tourDetails">${items.map(x=>`<div><small>${esc(x[0])}</small><strong>${esc(x[1])}</strong></div>`).join('')}${t.included_items?`<div class="tourIncluded"><small>Incluso</small><strong>${esc(t.included_items)}</strong></div>`:''}</div>`;
}

function renderRegistration(trips,fixed){
  if(!trips.length){$('.card').innerHTML=`<div class="empty"><h3>Nenhum passeio disponível</h3><p>O link pode estar encerrado ou as vagas podem ter acabado.</p></div>`;return}
  $('.card').innerHTML=`<div class="sectionTitle"><span class="step">01</span><div><h2>Dados da reserva</h2><p>Informe o responsável e a quantidade de vagas.</p></div></div><form id="reg"><div class="grid two"><label><span>Nome completo do responsável</span><input name="name" required></label><label><span>CPF do responsável</span><input name="cpf" inputmode="numeric" required placeholder="000.000.000-00"></label><label><span>E-mail</span><input name="email" type="email" required></label><label><span>Passeio</span><select name="trip" ${fixed?'disabled':''}>${trips.map(t=>`<option value="${t.id}">${esc(t.name)} — ${date(t.trip_date)}</option>`).join('')}</select></label></div><div id="tripbox"></div><div style="max-width:220px"><label><span>Quantidade de vagas</span><select name="seats"></select></label></div><div id="customQuestions"></div><div class="divider"></div><div class="sectionTitle"><span class="step">02</span><div><h2>Participantes</h2><p>Nome e CPF de cada pessoa.</p></div></div><div id="participants"></div><div class="divider"></div><div class="sectionTitle"><span class="step">03</span><div><h2>Política de cancelamento</h2><p>Leia antes de concluir.</p></div></div><div class="policy" id="policy"></div><label class="check"><input type="checkbox" name="accepted" required><span>Li e estou de acordo com a política de cancelamento e as condições do passeio.</span></label><div id="regmsg"></div><button class="btn primary wide">Confirmar cadastro</button></form>`;
  const f=$('#reg'),sel=f.trip;let current=trips[0];
  function customQuestions(){
    const fields=tripRegistrationFields(current);
    $('#customQuestions').innerHTML=fields.length?`<div class="divider"></div><div class="sectionTitle compact"><span class="step">+</span><div><h2>Informações do passeio</h2><p>Escolha as opções que correspondem à sua reserva.</p></div></div>${tripPublicDetails(current)}<div class="grid two regOptions">${fields.map(q=>`<label><span>${esc(q.label)}</span><select data-regopt="${esc(q.key)}" data-reglabel="${esc(q.label)}" required><option value="">Selecione</option>${q.options.map(o=>`<option value="${esc(o)}">${esc(o)}</option>`).join('')}</select></label>`).join('')}</div><label class="regObservation"><span>Observações para a organização (opcional)</span><textarea id="regObservation" rows="3" placeholder="Ex.: restrição alimentar, informação importante, necessidade específica..."></textarea></label>`:tripPublicDetails(current);
  }
  function update(){
    current=trips.find(t=>t.id===sel.value)||trips[0];
    const rem=Number(current.remaining_spots||0);
    f.seats.innerHTML=Array.from({length:Math.min(10,rem)},(_,i)=>`<option>${i+1}</option>`).join('');
    $('#tripbox').innerHTML=`<div class="tripSummary"><div><small>Você escolheu</small><b>${esc(current.name)}</b><small>${date(current.trip_date)} ${current.destination?'• '+esc(current.destination):''}</small></div><div class="availability"><small>Vagas disponíveis</small><strong>${rem}</strong></div></div>`;
    $('#policy').textContent=current.cancellation_policy||defaultCancellationPolicy(current.name);
    customQuestions();people();
  }
  function people(){
    const n=Number(f.seats.value||1);
    $('#participants').innerHTML=Array.from({length:n},(_,i)=>`<div class="participant"><div class="participantHead">Participante ${i+1}${i===0?' • Responsável':''}</div><div class="grid two"><label><span>Nome completo</span><input data-pname="${i}" ${i===0?'readonly':''} value="${i===0?esc(f.name.value):''}" required></label><label><span>CPF</span><input data-pcpf="${i}" ${i===0?'readonly':''} value="${i===0?esc(f.cpf.value):''}" required></label></div></div>`).join('');
    $$('[data-pcpf]').forEach(x=>x.oninput=()=>x.value=cpf(x.value));
  }
  sel.onchange=update;f.seats.onchange=people;
  f.name.oninput=()=>{const x=$('[data-pname="0"]');if(x)x.value=f.name.value};
  f.cpf.oninput=()=>{f.cpf.value=cpf(f.cpf.value);const x=$('[data-pcpf="0"]');if(x)x.value=f.cpf.value};
  update();
  f.onsubmit=async e=>{
    e.preventDefault();const msg=$('#regmsg');msg.innerHTML='';
    try{
      const participants=$$('[data-pname]').map((x,i)=>({full_name:x.value.trim(),cpf:String($(`[data-pcpf="${i}"]`).value).replace(/\D/g,'')}));
      if(participants.some(p=>p.cpf.length!==11))throw Error('Confira os CPFs dos participantes.');
      if(new Set(participants.map(p=>p.cpf)).size!==participants.length)throw Error('Há CPF repetido neste cadastro.');
      const answers={};
      $$('[data-regopt]').forEach(x=>{answers[x.dataset.regopt]={label:x.dataset.reglabel,value:x.value}});
      const obs=$('#regObservation')?.value?.trim()||'';
      if(obs) answers.observations={label:'Observações',value:obs};
      const seats=Number(f.seats.value),u=await ensureAnon(),tripRef=db.collection('trips').doc(current.id),resRef=tripRef.collection('reservations').doc(u.uid);
      await db.runTransaction(async tx=>{
        const [ts,rs]=await Promise.all([tx.get(tripRef),tx.get(resRef)]);
        if(!ts.exists)throw Error('Passeio não encontrado.');
        if(rs.exists)throw Error('Este aparelho já possui um cadastro para este passeio.');
        const t=ts.data(),rem=Number(t.remaining_spots||0),used=Number(t.used_spots||0);
        if(t.status!=='open')throw Error('As inscrições deste passeio estão encerradas.');
        if(rem<seats)throw Error(`Restam somente ${rem} vaga(s).`);
        const now=firebase.firestore.FieldValue.serverTimestamp();
        tx.set(resRef,{responsible_name:f.name.value.trim(),responsible_cpf:f.cpf.value.replace(/\D/g,''),email:f.email.value.trim().toLowerCase(),seats,participants,registration_answers:answers,status:'active',payment_status:t.assumes_payment===false?'pending':'paid',payment_method:'a_confirmar',paid_amount:t.assumes_payment===false?0:Number(t.default_price||0)*seats,refunded_amount:0,policy_text:t.cancellation_policy||defaultCancellationPolicy(t.name),policy_accepted:true,created_at:now,updated_at:now});
        tx.update(tripRef,{remaining_spots:rem-seats,used_spots:used+seats,updated_at:now});
      });
      app.innerHTML=`<div class="top">${brand()}</div><section class="success"><div class="big">✅</div><span class="eyebrow">CADASTRO CONCLUÍDO</span><h1>Participação registrada.</h1><p>As vagas e a lista do passeio já foram atualizadas no sistema.</p><a class="btn primary wide" href="/minha-reserva/${current.id}">Ver minha viagem</a></section>`;
    }catch(err){msg.innerHTML=`<div class="msg error">${esc(err.message)}</div>`}
  };
}

function tripModal(id=''){
  const t=id?state.trips.find(x=>x.id===id):null,c=t?.registration_options||{};
  modal(`<form id="tripform"><div class="modalHead"><div><span class="eyebrow">${t?'EDITAR':'NOVO'} PASSEIO</span><h2 style="margin:4px 0">${t?'Atualizar informações':'Cadastrar passeio'}</h2></div><button type="button" class="iconClose" id="closeTripModal">✕</button></div><div class="modalBody">
  <div class="formBlock"><h3>Informações principais</h3><div class="grid two"><label><span>Nome</span><input name="name" required value="${esc(t?.name||'')}"></label><label><span>Destino</span><input name="destination" value="${esc(t?.destination||'')}"></label><label><span>Data</span><input name="tripDate" type="date" required value="${String(t?.trip_date||'').slice(0,10)}"></label><label><span>Status</span><select name="status">${['draft','open','closed','completed','cancelled'].map(x=>`<option value="${x}" ${t?.status===x?'selected':''}>${status[x]}</option>`).join('')}</select></label><label><span>Total de vagas</span><input name="totalSpots" type="number" min="1" required value="${t?.total_spots||45}"></label><label><span>Valor padrão por pessoa</span><input name="defaultPrice" type="number" step=".01" value="${t?.default_price||''}"></label></div></div>
  <div class="formBlock"><h3>Operação do passeio</h3><div class="grid two"><label><span>Horário de saída</span><input name="departureTime" type="time" value="${esc(t?.departure_time||'')}"></label><label><span>Ponto de embarque principal</span><input name="departurePoint" value="${esc(t?.departure_point||'')}"></label><label><span>Retorno previsto</span><input name="returnInfo" value="${esc(t?.return_info||'')}"></label><label><span>Link do grupo WhatsApp</span><input name="whatsappGroupUrl" value="${esc(t?.whatsapp_group_url||'')}"></label><label><span>Nível de dificuldade</span><select name="difficulty"><option value="">Não informar</option>${['Fácil','Moderado','Moderado a difícil','Difícil'].map(x=>`<option ${t?.difficulty===x?'selected':''}>${x}</option>`).join('')}</select></label><label><span>Idade mínima</span><input name="minimumAge" type="number" min="0" value="${esc(t?.minimum_age||'')}"></label><label><span>Distância aproximada (km)</span><input name="distanceKm" type="number" step=".1" min="0" value="${esc(t?.distance_km||'')}"></label><label><span>Itens inclusos</span><input name="includedItems" value="${esc(t?.included_items||'')}" placeholder="Transporte, almoço, seguro..."></label></div><label style="display:block;margin-top:14px"><span>O que levar / orientações</span><textarea name="whatToBring" rows="4">${esc(t?.what_to_bring||'')}</textarea></label></div>
  <div class="formBlock"><div class="blockTitle"><div><h3>Opções que aparecerão no link de cadastro</h3><p>Separe cada opção com |. Deixe em branco para não perguntar.</p></div></div><div class="grid two"><label><span>Hospedagem</span><input name="accommodationOptions" value="${esc(joinOptions(c.accommodation))}" placeholder="Quarto compartilhado | Quarto casal | Camping"></label><label><span>Transporte</span><input name="transportOptions" value="${esc(joinOptions(c.transport))}" placeholder="Ônibus | Carro próprio"></label><label><span>Categoria</span><input name="categoryOptions" value="${esc(joinOptions(c.category))}" placeholder="Adulto | Criança até 10 anos"></label><label><span>Pontos de embarque</span><input name="boardingOptions" value="${esc(joinOptions(c.boarding))}" placeholder="SESI | André Maggi | Outro ponto"></label><label><span>Nome da opção extra</span><input name="extraLabel" value="${esc(c.extra_label||'')}" placeholder="Ex.: Tipo de quarto, atividade opcional"></label><label><span>Opções extras</span><input name="extraOptions" value="${esc(joinOptions(c.extra))}" placeholder="Opção A | Opção B | Não quero"></label></div></div>
  <div class="formBlock"><div class="blockTitle"><div><h3>Política de cancelamento</h3><p>Existe um texto padrão. Você pode editar para um passeio específico.</p></div><button type="button" class="btn ghost" id="applyDefaultPolicy">Aplicar padrão</button></div><textarea name="cancellationPolicy" rows="15" required>${esc(t?.cancellation_policy||defaultCancellationPolicy(t?.name||'este passeio'))}</textarea></div>
  <label class="check"><input name="assumesPayment" type="checkbox" ${t?.assumes_payment===false?'':'checked'}><span>Quem recebe o link já realizou o pagamento; calcular receita automaticamente.</span></label><div id="fm"></div></div><div class="modalFoot"><button type="button" class="btn ghost" id="cancelTripModal">Cancelar</button><button class="btn primary" id="saveTripBtn">Salvar passeio</button></div></form>`);
  $('#closeTripModal').onclick=closeTripModal;$('#cancelTripModal').onclick=closeTripModal;
  const f=$('#tripform');
  $('#applyDefaultPolicy').onclick=()=>{f.cancellationPolicy.value=defaultCancellationPolicy(f.name.value||'este passeio');toast('Política padrão aplicada.')};
  f.onsubmit=async e=>{
    e.preventDefault();const save=$('#saveTripBtn');save.disabled=true;save.textContent='Salvando...';
    try{
      const data={name:f.name.value.trim(),destination:f.destination.value.trim(),trip_date:f.tripDate.value,status:f.status.value,total_spots:Number(f.totalSpots.value),default_price:Number(f.defaultPrice.value||0),departure_time:f.departureTime.value,departure_point:f.departurePoint.value.trim(),return_info:f.returnInfo.value.trim(),whatsapp_group_url:f.whatsappGroupUrl.value.trim(),difficulty:f.difficulty.value,minimum_age:f.minimumAge.value?Number(f.minimumAge.value):null,distance_km:f.distanceKm.value?Number(f.distanceKm.value):null,included_items:f.includedItems.value.trim(),what_to_bring:f.whatToBring.value.trim(),registration_options:{accommodation:splitOptions(f.accommodationOptions.value),transport:splitOptions(f.transportOptions.value),category:splitOptions(f.categoryOptions.value),boarding:splitOptions(f.boardingOptions.value),extra_label:f.extraLabel.value.trim(),extra:splitOptions(f.extraOptions.value)},cancellation_policy:f.cancellationPolicy.value.trim()||defaultCancellationPolicy(f.name.value),assumes_payment:f.assumesPayment.checked,updated_at:firebase.firestore.FieldValue.serverTimestamp()};
      if(t){if(data.total_spots<Number(t.used_spots||0))throw Error('O total de vagas não pode ser menor que as vagas já ocupadas.');data.used_spots=Number(t.used_spots||0);data.remaining_spots=data.total_spots-data.used_spots;await db.collection('trips').doc(t.id).update(data)}else{data.used_spots=0;data.remaining_spots=data.total_spots;data.created_at=firebase.firestore.FieldValue.serverTimestamp();await db.collection('trips').add(data)}
      closeTripModal();toast('Passeio salvo com sucesso.');
    }catch(x){$('#fm').innerHTML=`<div class="msg error">${esc(x.message)}</div>`;save.disabled=false;save.textContent='Salvar passeio'}
  };
}

async function deleteTrip(id){
  const t=state.trips.find(x=>x.id===id);if(!t)return;
  const typed=prompt(`Excluir definitivamente o passeio "${t.name}"?\n\nIsso também excluirá os cadastros e despesas vinculadas.\nDigite EXCLUIR para confirmar:`);
  if(typed!=='EXCLUIR')return;
  try{
    const tripRef=db.collection('trips').doc(id),[rs,es]=await Promise.all([tripRef.collection('reservations').get(),db.collection('expenses').where('trip_id','==',id).get()]);
    const refs=[...rs.docs.map(d=>d.ref),...es.docs.map(d=>d.ref)];
    for(let i=0;i<refs.length;i+=400){const b=db.batch();refs.slice(i,i+400).forEach(r=>b.delete(r));await b.commit()}
    await tripRef.delete();toast('Passeio excluído.');
  }catch(e){toast('Não foi possível excluir: '+e.message,'error')}
}

function tripTable(list,actions=true){
  return `<div class="tableWrap"><table class="table"><thead><tr><th>Passeio</th><th>Data</th><th>Vagas</th><th>Receita</th><th>Despesas</th><th>Resultado</th><th>Status</th>${actions?'<th>Ações</th>':''}</tr></thead><tbody>${list.map(t=>`<tr><td><strong>${esc(t.name)}</strong><small>${esc(t.destination||'')}</small></td><td>${date(t.trip_date)}</td><td><strong>${t.used_spots||0}/${t.total_spots||0}</strong><small>${t.remaining_spots||0} restantes</small></td><td>${brl(t.net_revenue)}</td><td>${brl(t.expenses)}</td><td><strong>${brl(t.profit)}</strong></td><td><span class="pill ${t.status}">${status[t.status]||t.status}</span></td>${actions?`<td><div class="actions"><button title="Copiar link" onclick="copyLink('${t.id}')">🔗</button><button title="PDF" onclick="pdfTrip('${t.id}')">PDF</button><button title="Editar" onclick="tripModal('${t.id}')">✎</button><button title="Participantes" onclick="openPeople('${t.id}')">👥</button><button title="Despesa" onclick="expenseModal('${t.id}')">R$</button><button class="actionDanger" title="Excluir passeio" onclick="deleteTrip('${t.id}')">🗑</button></div></td>`:''}</tr>`).join('')}</tbody></table></div>`;
}

function registrationSummary(r){
  const a=r.registration_answers||{};return Object.values(a).filter(x=>x?.value).map(x=>`${x.label}: ${x.value}`).join(' • ');
}

function renderPeopleAdmin(){
  const rs=filteredReservations();
  $('#content').innerHTML=`<section class="panel"><div class="panelHead"><div><span class="eyebrow">BANCO DE DADOS</span><h2>Participantes e reservas</h2></div><div class="toolbar"><button class="btn ghost" ${state.selectedTrip?'':'disabled'} onclick="pdfTrip('${state.selectedTrip}')">Gerar PDF</button><button class="btn ghost" onclick="csv()">Exportar CSV</button></div></div><div class="filters"><input id="search" placeholder="Buscar nome, CPF ou e-mail" value="${esc(state.search)}"><select id="filter"><option value="">Todos os passeios</option>${state.trips.map(t=>`<option value="${t.id}" ${t.id===state.selectedTrip?'selected':''}>${esc(t.name)}</option>`).join('')}</select></div><div class="tableWrap"><table class="table"><thead><tr><th>Responsável</th><th>Passeio</th><th>Vagas</th><th>Opções</th><th>Pagamento</th><th>Reserva</th><th>Cadastro</th><th>Ações</th></tr></thead><tbody>${rs.map(r=>`<tr><td><strong>${esc(r.responsible_name)}</strong><small>${esc(r.email)}<br>${cpf(r.responsible_cpf)}</small></td><td>${esc(state.trips.find(t=>t.id===r.trip_id)?.name||'')}</td><td><strong>${r.seats}</strong><small>${(r.participants||[]).map(p=>esc(p.full_name)).join(', ')}</small></td><td><small>${esc(registrationSummary(r)||'—')}</small></td><td><strong>${brl(Number(r.paid_amount)-Number(r.refunded_amount))}</strong><small>${status[r.payment_status]||r.payment_status}</small></td><td><span class="pill ${r.status}">${status[r.status]||r.status}</span></td><td><small>${r.created_at?.toDate?r.created_at.toDate().toLocaleDateString('pt-BR'):'—'}</small></td><td><div class="actions"><button class="btn ghost" onclick="reservationModal('${r.trip_id}','${r.id}')">Editar</button><button class="btn danger" onclick="deleteReservation('${r.trip_id}','${r.id}')">Excluir</button></div></td></tr>`).join('')}</tbody></table></div></section>`;
  $('#search').oninput=e=>{state.search=e.target.value;renderPeopleAdmin()};$('#filter').onchange=e=>{state.selectedTrip=e.target.value;renderPeopleAdmin()};
}

async function deleteReservation(tripId,id){
  const r=state.reservations.find(x=>x.trip_id===tripId&&x.id===id);if(!r)return;
  if(!confirm(`Excluir o cadastro de ${r.responsible_name}? As ${r.seats} vaga(s) serão devolvidas ao passeio.`))return;
  const ref=db.collection('trips').doc(tripId).collection('reservations').doc(id),tripRef=db.collection('trips').doc(tripId);
  try{await db.runTransaction(async tx=>{const [rs,ts]=await Promise.all([tx.get(ref),tx.get(tripRef)]);if(!rs.exists||!ts.exists)return;const old=rs.data(),t=ts.data();tx.delete(ref);if(old.status!=='cancelled')tx.update(tripRef,{remaining_spots:Number(t.remaining_spots||0)+Number(old.seats||0),used_spots:Math.max(0,Number(t.used_spots||0)-Number(old.seats||0)),updated_at:firebase.firestore.FieldValue.serverTimestamp()})});toast('Cadastro excluído e vagas devolvidas.')}catch(e){toast(e.message,'error')}
}

async function removeParticipant(tripId,id,index){
  if(!confirm('Remover este participante do cadastro?'))return;
  const ref=db.collection('trips').doc(tripId).collection('reservations').doc(id),tripRef=db.collection('trips').doc(tripId);
  try{await db.runTransaction(async tx=>{const [rs,ts]=await Promise.all([tx.get(ref),tx.get(tripRef)]);if(!rs.exists||!ts.exists)throw Error('Registro não encontrado.');const r=rs.data(),t=ts.data(),people=[...(r.participants||[])];if(index<0||index>=people.length)throw Error('Participante não encontrado.');people.splice(index,1);if(!people.length){tx.delete(ref)}else{const patch={participants:people,seats:people.length,updated_at:firebase.firestore.FieldValue.serverTimestamp()};if(index===0){patch.responsible_name=people[0].full_name;patch.responsible_cpf=people[0].cpf}tx.update(ref,patch)}if(r.status!=='cancelled')tx.update(tripRef,{remaining_spots:Number(t.remaining_spots||0)+1,used_spots:Math.max(0,Number(t.used_spots||0)-1),updated_at:firebase.firestore.FieldValue.serverTimestamp()})});closeTripModal();toast('Participante removido. Ajuste o financeiro da reserva, se necessário.')}catch(e){toast(e.message,'error')}
}

function reservationModal(tripId,id){
  const r=state.reservations.find(x=>x.trip_id===tripId&&x.id===id);if(!r)return;
  modal(`<form id="resform"><div class="modalHead"><div><span class="eyebrow">RESERVA</span><h2 style="margin:4px 0">${esc(r.responsible_name)}</h2><small>${esc(state.trips.find(t=>t.id===tripId)?.name||'')} • ${r.seats} vaga(s)</small></div><button type="button" class="iconClose" id="closeResModal">✕</button></div><div class="modalBody"><div class="grid two"><label><span>Valor pago</span><input name="paid" type="number" step=".01" value="${r.paid_amount||0}"></label><label><span>Reembolso</span><input name="refund" type="number" step=".01" value="${r.refunded_amount||0}"></label><label><span>Forma de pagamento</span><select name="method">${[['pix','PIX'],['cartao','Cartão'],['pix_parcelado','PIX parcelado'],['dinheiro','Dinheiro'],['a_confirmar','A confirmar']].map(x=>`<option value="${x[0]}" ${r.payment_method===x[0]?'selected':''}>${x[1]}</option>`).join('')}</select></label><label><span>Status pagamento</span><select name="paymentStatus">${['paid','pending','partial','refunded','cancelled'].map(x=>`<option value="${x}" ${r.payment_status===x?'selected':''}>${status[x]||x}</option>`).join('')}</select></label><label><span>Status reserva</span><select name="status">${['active','cancel_requested','cancelled','transferred'].map(x=>`<option value="${x}" ${r.status===x?'selected':''}>${status[x]||x}</option>`).join('')}</select></label></div>${registrationSummary(r)?`<div class="answerBox"><b>Opções escolhidas</b><p>${esc(registrationSummary(r))}</p></div>`:''}<div class="participantAdminList"><h3>Participantes</h3>${(r.participants||[]).map((p,i)=>`<div><span><b>${esc(p.full_name)}</b><small>${cpf(p.cpf)}</small></span><button type="button" class="btn danger" onclick="removeParticipant('${tripId}','${id}',${i})">Remover</button></div>`).join('')}</div><label style="display:block;margin-top:14px"><span>Observações internas</span><textarea name="notes" rows="4">${esc(r.admin_notes||'')}</textarea></label><div id="fm"></div></div><div class="modalFoot"><button type="button" class="btn danger" id="deleteWholeReservation">Excluir cadastro</button><span style="flex:1"></span><button type="button" class="btn ghost" id="cancelResModal">Cancelar</button><button class="btn primary">Salvar</button></div></form>`);
  $('#closeResModal').onclick=closeTripModal;$('#cancelResModal').onclick=closeTripModal;$('#deleteWholeReservation').onclick=()=>{closeTripModal();deleteReservation(tripId,id)};
  $('#resform').onsubmit=async e=>{e.preventDefault();const f=e.target,ref=db.collection('trips').doc(tripId).collection('reservations').doc(id),tripRef=db.collection('trips').doc(tripId);try{await db.runTransaction(async tx=>{const [rs,ts]=await Promise.all([tx.get(ref),tx.get(tripRef)]);if(!rs.exists||!ts.exists)throw Error('Registro não encontrado.');const old=rs.data(),t=ts.data(),next=f.status.value;let rem=Number(t.remaining_spots||0),used=Number(t.used_spots||0);if(old.status!=='cancelled'&&next==='cancelled'){rem+=Number(old.seats);used-=Number(old.seats)}if(old.status==='cancelled'&&next!=='cancelled'){if(rem<Number(old.seats))throw Error('Não há vagas suficientes para reativar esta reserva.');rem-=Number(old.seats);used+=Number(old.seats)}tx.update(ref,{paid_amount:Number(f.paid.value||0),refunded_amount:Number(f.refund.value||0),payment_method:f.method.value,payment_status:f.paymentStatus.value,status:next,admin_notes:f.notes.value,updated_at:firebase.firestore.FieldValue.serverTimestamp()});if(rem!==Number(t.remaining_spots)||used!==Number(t.used_spots))tx.update(tripRef,{remaining_spots:rem,used_spots:used,updated_at:firebase.firestore.FieldValue.serverTimestamp()})});closeTripModal();toast('Reserva atualizada.')}catch(x){$('#fm').innerHTML=`<div class="msg error">${esc(x.message)}</div>`}};
}

function loadExternalScript(src,test){
  return new Promise((resolve,reject)=>{if(test())return resolve();const s=document.createElement('script');s.src=src;s.async=true;s.onload=()=>test()?resolve():reject(new Error('Biblioteca não inicializou'));s.onerror=()=>reject(new Error('Falha ao carregar biblioteca'));document.head.appendChild(s)})
}

async function ensurePdfLibraries(){
  if(!window.jspdf?.jsPDF) await loadExternalScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js',()=>!!window.jspdf?.jsPDF);
  const probe=new window.jspdf.jsPDF();
  if(typeof probe.autoTable!=='function') await loadExternalScript('https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.4/dist/jspdf.plugin.autotable.min.js',()=>{try{return typeof new window.jspdf.jsPDF().autoTable==='function'}catch{return false}});
}

async function pdfTrip(id){
  if(!id)return toast('Selecione um passeio.','error');const t=state.trips.find(x=>x.id===id);if(!t)return toast('Passeio não encontrado.','error');
  const btn=document.activeElement;if(btn?.tagName==='BUTTON'){btn.disabled=true;var oldText=btn.textContent;btn.textContent='Gerando...'}
  try{
    await ensurePdfLibraries();
    const rs=state.reservations.filter(r=>r.trip_id===id&&r.status!=='cancelled'),{jsPDF}=window.jspdf,doc=new jsPDF();
    doc.setFillColor(11,53,41);doc.rect(0,0,210,42,'F');doc.setTextColor(255);doc.setFontSize(11);doc.text('TRILHEIROS DE RONDONÓPOLIS',14,16);doc.setFontSize(21);doc.text('Relatório de Participantes',14,29);doc.setTextColor(20,40,33);doc.setFontSize(12);doc.text(`${t.name} • ${date(t.trip_date)}`,14,54);doc.setFontSize(9);doc.text(`${t.destination||''}   |   Vagas: ${t.used_spots||0}/${t.total_spots||0}`,14,61);
    const people=[];rs.forEach(r=>(r.participants||[]).forEach(p=>people.push([people.length+1,p.full_name,cpf(p.cpf),r.responsible_name,r.email,registrationSummary(r)])));
    doc.autoTable({startY:68,head:[['Nº','Participante','CPF','Responsável','E-mail','Opções']],body:people,styles:{fontSize:7,cellPadding:1.8},headStyles:{fillColor:[11,53,41]},columnStyles:{5:{cellWidth:45}},margin:{left:8,right:8}});
    const pages=doc.internal.getNumberOfPages();for(let p=1;p<=pages;p++){doc.setPage(p);doc.setFontSize(7.5);doc.setTextColor(90);doc.text(`Página ${p}/${pages} • Gerado em ${new Date().toLocaleString('pt-BR')} • Total: ${people.length}`,14,doc.internal.pageSize.height-8)}
    doc.save(`participantes-${String(t.name).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-')}.pdf`);
  }catch(e){toast('Não foi possível gerar o PDF. Verifique sua internet e tente novamente.','error');console.error(e)}finally{if(btn?.tagName==='BUTTON'){btn.disabled=false;btn.textContent=oldText||'PDF'}}
}
