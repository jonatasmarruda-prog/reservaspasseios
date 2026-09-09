/* Admin V6 — PWA, offline, financeiro, notificações e comunicações */
(function(){
  if(typeof state==='undefined') return;

  const COMM_DEFAULT={
    enabled:true,
    reminder_subject:'Amanhã é dia de {{passeio}} 🌿',
    reminder_body:'Olá, {{nome}}!\n\nPassando para lembrar que amanhã é o passeio {{passeio}}.\n\n📅 Data: {{data}}\n📍 Destino: {{destino}}\n🕒 Saída: {{saida}}\n🚌 Embarque: {{embarque}}\n👥 Participantes: {{participantes}}\n🎒 O que levar: {{levar}}\n📝 Orientação extra: {{lembrete_extra}}\n🔖 Protocolo: {{protocolo}}\n\nPolítica de cancelamento:\n{{politica}}\n\nAqui ninguém vai só.\nTrilheiros de Rondonópolis',
    updated_at:null
  };

  const NOTIF_KEY='trilheiros_admin_notifications_v6';
  const LAST_SEEN_KEY='trilheiros_admin_last_seen_v6';
  let previousReservationStatus=new Map();
  let reservationBaseline=false;

  state.commSettings={...COMM_DEFAULT};
  state.notifications=loadNotifications();
  state.financeTripFilter='';

  function loadNotifications(){try{return JSON.parse(localStorage.getItem(NOTIF_KEY)||'[]').slice(0,100)}catch{return[]}}
  function saveNotifications(){try{localStorage.setItem(NOTIF_KEY,JSON.stringify((state.notifications||[]).slice(0,100)))}catch{}}
  function unreadCount(){return (state.notifications||[]).filter(n=>!n.read).length}
  function nowISO(){return new Date().toISOString()}
  function timestampMs(v){try{return v?.toMillis?v.toMillis():v?.toDate?v.toDate().getTime():new Date(v||0).getTime()}catch{return 0}}
  function humanTime(iso){try{return new Date(iso).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}catch{return''}}
  function friendlyError(err){const raw=String(err?.message||err||'Erro inesperado.');const l=raw.toLowerCase();if(l.includes('permission'))return'Você não tem permissão para concluir esta ação.';if(l.includes('network')||l.includes('unavailable'))return'Sem conexão. Tente novamente quando a internet voltar.';if(l.includes('not found'))return'Registro não encontrado.';return raw}

  async function showSystemNotification(title,body,url='/admin'){
    if(!('Notification' in window)||Notification.permission!=='granted')return;
    try{
      if(navigator.serviceWorker){const reg=await navigator.serviceWorker.ready;await reg.showNotification(title,{body,icon:'/app-icon-192.svg',badge:'/app-icon-192.svg',data:{url},tag:'trilheiros-'+Date.now()});return}
      new Notification(title,{body});
    }catch(_){ }
  }

  function pushNotification(title,body,type='info',data={},system=true){
    const key=data.key||`${type}:${data.trip_id||''}:${data.reservation_id||''}:${title}`;
    if((state.notifications||[]).some(n=>n.key===key))return;
    state.notifications=[{id:crypto?.randomUUID?.()||String(Date.now()+Math.random()),key,title,body,type,data,read:false,created_at:nowISO()},...(state.notifications||[])].slice(0,100);
    saveNotifications();updateNotificationBadge();
    if(system)showSystemNotification(title,body,'/admin');
  }

  function updateNotificationBadge(){const el=document.querySelector('#notifyCount');if(el)el.textContent=unreadCount()?String(unreadCount()):''}
  function setNetworkUI(){const online=navigator.onLine;const b=document.querySelector('#networkBadge');if(b){b.textContent=online?'● Online':'● Offline';b.className='networkBadge '+(online?'online':'offline')}const s=document.querySelector('#sync');if(s){s.classList.toggle('offline',!online);s.classList.toggle('online',online);if(!online)s.textContent='☁ Offline • dados locais'}}

  window.toggleAdminSide=function(open){const s=document.querySelector('#side');if(!s)return;s.classList.toggle('open',open===undefined?!s.classList.contains('open'):!!open)};
  window.openNotifications=function(){state.tab='notifications';renderAdmin();};
  window.requestAdminNotifications=async function(){if(!('Notification' in window))return toast('Este navegador não oferece notificações do sistema.','error');const p=await Notification.requestPermission();if(p==='granted'){toast('Notificações ativadas.');pushNotification('Notificações ativadas','Novos cadastros serão avisados enquanto o aplicativo estiver aberto ou em segundo plano.','system',{key:'notifications-enabled'},false)}else toast('Permissão de notificações não concedida.','error');renderNotifications()};
  window.markAllNotificationsRead=function(){(state.notifications||[]).forEach(n=>n.read=true);saveNotifications();localStorage.setItem(LAST_SEEN_KEY,String(Date.now()));updateNotificationBadge();renderNotifications()};
  window.clearAdminNotifications=function(){if(!confirm('Limpar o histórico de notificações deste aparelho?'))return;state.notifications=[];saveNotifications();updateNotificationBadge();renderNotifications()};

  window.openInstallGuide=async function(){
    if(window.isTrilheirosInstalled?.()){toast('O aplicativo já está instalado neste aparelho.');return}
    const result=await window.installTrilheirosApp?.();
    if(result&&result!=='manual')return;
    modal(`<div class="modalHead"><div><span class="eyebrow">APLICATIVO</span><h2 style="margin:4px 0">Instalar Trilheiros Gestão</h2></div><button type="button" class="iconClose" id="pwaClose">✕</button></div><div class="modalBody"><div class="pwaGuide"><div class="pwaGuideStep"><span>1</span><p><b>Android / Chrome:</b> abra o menu ⋮ e toque em <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>.</p></div><div class="pwaGuideStep"><span>2</span><p><b>iPhone / Safari:</b> toque em Compartilhar e depois em <b>Adicionar à Tela de Início</b>.</p></div><div class="pwaGuideStep"><span>3</span><p>Abra o painel pelo ícone. Depois do primeiro carregamento, as telas e os dados já consultados podem ficar disponíveis offline.</p></div></div><div class="offlineHint">Alterações simples podem ficar na fila e sincronizar quando a internet voltar. Exclusões complexas e transações exigem conexão.</div></div><div class="modalFoot"><button class="btn primary" id="pwaDone">Entendi</button></div>`);document.querySelector('#pwaClose').onclick=safeCloseModal;document.querySelector('#pwaDone').onclick=safeCloseModal;
  };

  function safeCloseModal(){const el=document.getElementById('modal');if(el)el.remove()}
  window.safeCloseModal=safeCloseModal;
  try{modal.remove=safeCloseModal}catch(_){ }
  window.closeTripModal=safeCloseModal;

  document.addEventListener('keydown',e=>{if(e.key==='Escape')safeCloseModal()});
  document.addEventListener('click',e=>{if(e.target?.classList?.contains('modalBack'))safeCloseModal()});
  window.addEventListener('online',()=>{setNetworkUI();toast('Internet restabelecida. Sincronizando com a nuvem.');});
  window.addEventListener('offline',()=>{setNetworkUI();toast('Você está offline. O painel usará os dados disponíveis neste aparelho.','error')});

  window.adminShell=function(){return`<main class="admin"><aside class="side" id="side">${brand()}<button class="mobileClose iconClose" onclick="toggleAdminSide(false)">✕</button><nav class="nav"><button data-tab="dashboard">▦ Visão geral</button><button data-tab="trips">◫ Passeios</button><button data-tab="people">♟ Participantes</button><button data-tab="finance">R$ Financeiro</button><button data-tab="communications">✉ Comunicações</button><button data-tab="notifications">🔔 Notificações <span id="sideNotifyCount"></span></button></nav><div class="sideBottom"><div class="sync online" id="sync">☁ Sincronizando...</div><div class="sideInstall"><button class="btn ghost wide" onclick="openInstallGuide()">⬇ Instalar aplicativo</button></div><button class="btn ghost wide" id="logout">Sair</button></div></aside><section class="adminMain"><header class="adminHead"><div style="display:flex;gap:12px;align-items:center"><button class="btn ghost mobileMenu" onclick="toggleAdminSide(true)">☰</button><div><span class="eyebrow">TRILHEIROS • GESTÃO</span><h1 id="pageTitle">Visão geral</h1></div></div><div class="adminV6HeadActions"><span class="networkBadge online" id="networkBadge">● Online</span><button class="installBtn" onclick="openInstallGuide()">⬇ Instalar</button><button class="notifyBell" onclick="openNotifications()">🔔<span class="notifyCount" id="notifyCount"></span></button><a class="btn ghost desktopOnly" target="_blank" href="/">Abrir cadastro</a><button class="btn primary" id="newTrip">+ Novo passeio</button></div></header><div class="adminContent" id="content"><div class="empty">Sincronizando dados...</div></div></section></main>`};
  try{adminShell=window.adminShell}catch(_){ }

  window.enrich=function(){
    state.trips=state.trips.map(t=>{
      const rs=state.reservations.filter(r=>r.trip_id===t.id);
      const gross=rs.reduce((s,r)=>s+Number(r.paid_amount||0),0);
      const refunds=rs.reduce((s,r)=>s+Number(r.refunded_amount||0),0);
      const net=gross-refunds;
      const expenses=state.expenses.filter(e=>e.trip_id===t.id).reduce((s,e)=>s+Number(e.amount||0),0);
      const profit=net-expenses;
      const receivable=rs.filter(r=>!['paid','refunded','cancelled'].includes(r.payment_status)).reduce((s,r)=>s+Math.max(0,(Number(t.default_price||0)*Number(r.seats||0))-Number(r.paid_amount||0)),0);
      return {...t,gross_revenue:gross,refunds,net_revenue:net,expenses,profit,receivable,estimated_cost:Number(t.estimated_cost||0)};
    });
  };
  try{enrich=window.enrich}catch(_){ }

  function handleReservationSnapshot(snapshot){
    const next=snapshot.docs.map(d=>({id:d.id,trip_id:d.ref.parent.parent.id,...d.data()}));
    const lastSeen=Number(localStorage.getItem(LAST_SEEN_KEY)||0);
    if(!reservationBaseline){
      next.forEach(r=>previousReservationStatus.set(`${r.trip_id}/${r.id}`,r.status));
      if(lastSeen){next.filter(r=>timestampMs(r.created_at)>lastSeen).forEach(r=>{const trip=state.trips.find(t=>t.id===r.trip_id);pushNotification('Novo cadastro',`${r.responsible_name} • ${r.seats} vaga(s) • ${trip?.name||'Passeio'}`,'registration',{trip_id:r.trip_id,reservation_id:r.id,key:`registration:${r.trip_id}:${r.id}`},false)})}
      reservationBaseline=true;
    }else{
      snapshot.docChanges().forEach(ch=>{
        const d=ch.doc,data={id:d.id,trip_id:d.ref.parent.parent.id,...d.data()},key=`${data.trip_id}/${data.id}`,old=previousReservationStatus.get(key),trip=state.trips.find(t=>t.id===data.trip_id);
        if(ch.type==='added')pushNotification('Novo cadastro',`${data.responsible_name} cadastrou ${data.seats} vaga(s) em ${trip?.name||'um passeio'}.`,'registration',{trip_id:data.trip_id,reservation_id:data.id,key:`registration:${data.trip_id}:${data.id}`},true);
        if(ch.type==='modified'&&old!=='cancel_requested'&&data.status==='cancel_requested')pushNotification('Pedido de cancelamento',`${data.responsible_name} solicitou cancelamento em ${trip?.name||'um passeio'}.`,'cancel',{trip_id:data.trip_id,reservation_id:data.id,key:`cancel:${data.trip_id}:${data.id}`},true);
        previousReservationStatus.set(key,data.status);
      });
    }
    state.reservations=next;
    localStorage.setItem(LAST_SEEN_KEY,String(Date.now()));
  }

  window.startSync=function(){
    clearListeners();let tLoaded=false,rLoaded=false,eLoaded=false,cLoaded=false;
    const done=()=>{if(tLoaded&&rLoaded&&eLoaded&&cLoaded){state.sync=new Date();enrich();renderAdmin()}};
    unsubs.push(db.collection('trips').onSnapshot(s=>{state.trips=s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>String(a.trip_date).localeCompare(String(b.trip_date)));tLoaded=true;done()},e=>toast(friendlyError(e),'error')));
    unsubs.push(db.collectionGroup('reservations').onSnapshot(s=>{handleReservationSnapshot(s);rLoaded=true;done()},e=>toast(friendlyError(e),'error')));
    unsubs.push(db.collection('expenses').onSnapshot(s=>{state.expenses=s.docs.map(d=>({id:d.id,...d.data()}));eLoaded=true;done()},e=>toast(friendlyError(e),'error')));
    unsubs.push(db.collection('settings').doc('communications').onSnapshot(s=>{state.commSettings=s.exists?{...COMM_DEFAULT,...s.data()}:{...COMM_DEFAULT};cLoaded=true;done()},e=>{state.commSettings={...COMM_DEFAULT};cLoaded=true;done();console.warn(e)}));
  };
  try{startSync=window.startSync}catch(_){ }

  window.renderAdmin=function(){
    if(!document.querySelector('.admin'))app.innerHTML=adminShell();
    document.querySelectorAll('[data-tab]').forEach(b=>{b.classList.toggle('active',b.dataset.tab===state.tab);b.onclick=()=>{state.tab=b.dataset.tab;toggleAdminSide(false);renderAdmin()}});
    const newTrip=document.querySelector('#newTrip');if(newTrip)newTrip.onclick=()=>tripModal();
    const logout=document.querySelector('#logout');if(logout)logout.onclick=async()=>{clearListeners();await auth.signOut();loginLayout()};
    const sync=document.querySelector('#sync');if(sync&&navigator.onLine)sync.textContent=`☁ Sincronizado ${state.sync?state.sync.toLocaleTimeString('pt-BR'):''}`;
    const titles={dashboard:'Visão geral',trips:'Passeios',people:'Participantes',finance:'Financeiro',communications:'Comunicações',notifications:'Notificações'};
    document.querySelector('#pageTitle').textContent=titles[state.tab]||'Gestão';setNetworkUI();updateNotificationBadge();const sideCount=document.querySelector('#sideNotifyCount');if(sideCount)sideCount.textContent=unreadCount()?`(${unreadCount()})`:'';
    if(state.tab==='dashboard')renderDashboard();else if(state.tab==='trips')renderTrips();else if(state.tab==='people')renderPeopleAdmin();else if(state.tab==='finance')renderFinance();else if(state.tab==='communications')renderCommunications();else if(state.tab==='notifications')renderNotifications();
  };
  try{renderAdmin=window.renderAdmin}catch(_){ }

  function totals(trips=state.trips){
    const ids=new Set(trips.map(t=>t.id)),rs=state.reservations.filter(r=>ids.has(r.trip_id)),es=state.expenses.filter(e=>ids.has(e.trip_id));
    const gross=rs.reduce((s,r)=>s+Number(r.paid_amount||0),0),refunds=rs.reduce((s,r)=>s+Number(r.refunded_amount||0),0),net=gross-refunds,expenses=es.reduce((s,e)=>s+Number(e.amount||0),0),profit=net-expenses,receivable=trips.reduce((s,t)=>s+Number(t.receivable||0),0),margin=net?profit/net*100:0;
    return{gross,refunds,net,expenses,profit,receivable,margin};
  }

  window.renderDashboard=function(){
    const T=totals(),upcoming=state.trips.filter(t=>t.status==='open').length,activeSeats=state.reservations.filter(r=>r.status!=='cancelled').reduce((s,r)=>s+Number(r.seats||0),0),canc=state.reservations.filter(r=>r.status==='cancel_requested').length,low=state.trips.filter(t=>t.status==='open'&&Number(t.remaining_spots||0)<=5),pending=state.reservations.filter(r=>['pending','partial'].includes(r.payment_status)).length;
    document.querySelector('#content').innerHTML=`<div class="adminMetricsV6"><div class="metric"><span>RECEBIDO BRUTO</span><strong>${brl(T.gross)}</strong><small>antes de reembolsos</small></div><div class="metric"><span>REEMBOLSOS</span><strong>${brl(T.refunds)}</strong><small>devoluções registradas</small></div><div class="metric"><span>RECEITA LÍQUIDA</span><strong>${brl(T.net)}</strong><small>bruto - reembolsos</small></div><div class="metric"><span>DESPESAS</span><strong>${brl(T.expenses)}</strong><small>custos lançados</small></div><div class="metric good"><span>RESULTADO</span><strong>${brl(T.profit)}</strong><small>margem ${T.margin.toFixed(1)}%</small></div><div class="metric warn"><span>A RECEBER</span><strong>${brl(T.receivable)}</strong><small>${pending} pagamento(s) pendente(s)</small></div></div><div class="adminGrid2"><section class="panel"><div class="panelHead"><div><span class="eyebrow">OPERAÇÃO</span><h2>Próximos passeios</h2></div><small>${upcoming} aberto(s) • ${activeSeats} vaga(s) cadastrada(s)</small></div>${tripTable(state.trips.slice(0,7),false)}</section><section class="panel"><div class="panelHead"><div><span class="eyebrow">ATENÇÃO</span><h2>Alertas</h2></div></div><div class="attentionList">${canc?`<div class="attentionItem"><div><strong>Pedidos de cancelamento</strong><small>Existem reservas aguardando análise.</small></div><span class="attentionPill">${canc}</span></div>`:''}${low.length?`<div class="attentionItem"><div><strong>Últimas vagas</strong><small>${low.map(t=>`${esc(t.name)}: ${t.remaining_spots}`).join('<br>')}</small></div><span class="attentionPill">${low.length}</span></div>`:''}${pending?`<div class="attentionItem"><div><strong>Pagamentos pendentes</strong><small>Confira reservas que ainda precisam de ajuste financeiro.</small></div><span class="attentionPill">${pending}</span></div>`:''}${!canc&&!low.length&&!pending?`<div class="attentionItem"><div><strong>Tudo em ordem</strong><small>Nenhuma pendência operacional importante neste momento.</small></div><span class="attentionPill">✓</span></div>`:''}</div></section></div>`;
  };
  try{renderDashboard=window.renderDashboard}catch(_){ }

  function tripFinanceRows(list){return `<div class="tableWrap"><table class="table tripFinanceTable"><thead><tr><th>Passeio</th><th>Bruto</th><th>Reembolso</th><th>Líquido</th><th>Custo previsto</th><th>Despesas</th><th>Resultado</th></tr></thead><tbody>${list.map(t=>`<tr><td><strong>${esc(t.name)}</strong><small>${date(t.trip_date)}</small></td><td>${brl(t.gross_revenue)}</td><td>${brl(t.refunds)}</td><td><strong>${brl(t.net_revenue)}</strong></td><td>${brl(t.estimated_cost)}</td><td>${brl(t.expenses)}</td><td><strong class="${t.profit>=0?'positive':'negative'}">${brl(t.profit)}</strong></td></tr>`).join('')}</tbody></table></div>`}

  window.renderFinance=function(){
    const selected=state.financeTripFilter?state.trips.filter(t=>t.id===state.financeTripFilter):state.trips,T=totals(selected),cats={};state.expenses.filter(e=>!state.financeTripFilter||e.trip_id===state.financeTripFilter).forEach(e=>cats[e.category||'Outros']=(cats[e.category||'Outros']||0)+Number(e.amount||0));
    document.querySelector('#content').innerHTML=`<div class="adminMetricsV6"><div class="metric"><span>RECEBIDO BRUTO</span><strong>${brl(T.gross)}</strong></div><div class="metric"><span>REEMBOLSOS</span><strong>${brl(T.refunds)}</strong></div><div class="metric"><span>RECEITA LÍQUIDA</span><strong>${brl(T.net)}</strong></div><div class="metric"><span>DESPESAS</span><strong>${brl(T.expenses)}</strong></div><div class="metric good"><span>LUCRO / RESULTADO</span><strong>${brl(T.profit)}</strong><small>margem ${T.margin.toFixed(1)}%</small></div><div class="metric warn"><span>A RECEBER</span><strong>${brl(T.receivable)}</strong></div></div><section class="panel"><div class="panelHead"><div><span class="eyebrow">POR PASSEIO</span><h2>Resultado financeiro</h2></div><select id="financeFilter" class="financeFilter"><option value="">Todos os passeios</option>${state.trips.map(t=>`<option value="${t.id}" ${t.id===state.financeTripFilter?'selected':''}>${esc(t.name)}</option>`).join('')}</select></div>${tripFinanceRows(selected)}</section><section class="panel"><div class="panelHead"><div><span class="eyebrow">CUSTOS</span><h2>Despesas por categoria</h2></div><button class="btn primary" onclick="expenseModal('${state.financeTripFilter||''}')">+ Nova despesa</button></div><div class="financeCategoryGrid">${Object.entries(cats).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<div class="financeCategory"><small>${esc(k)}</small><strong>${brl(v)}</strong></div>`).join('')||'<div class="empty">Nenhuma despesa lançada.</div>'}</div><div class="tableWrap"><table class="table"><thead><tr><th>Data</th><th>Passeio</th><th>Categoria</th><th>Descrição</th><th>Valor</th><th></th></tr></thead><tbody>${state.expenses.filter(e=>!state.financeTripFilter||e.trip_id===state.financeTripFilter).map(e=>`<tr><td>${date(e.expense_date)}</td><td>${esc(state.trips.find(t=>t.id===e.trip_id)?.name||'')}</td><td>${esc(e.category)}</td><td>${esc(e.description||'')}</td><td><strong>${brl(e.amount)}</strong></td><td><button class="btn danger" onclick="deleteExpense('${e.id}')">Excluir</button></td></tr>`).join('')}</tbody></table></div></section>`;document.querySelector('#financeFilter').onchange=e=>{state.financeTripFilter=e.target.value;renderFinance()};
  };
  try{renderFinance=window.renderFinance}catch(_){ }

  window.renderCommunications=function(){
    const c={...COMM_DEFAULT,...state.commSettings},tokens=['{{nome}}','{{passeio}}','{{data}}','{{destino}}','{{saida}}','{{embarque}}','{{participantes}}','{{levar}}','{{lembrete_extra}}','{{protocolo}}','{{politica}}'];
    document.querySelector('#content').innerHTML=`<div class="commGrid"><section class="commCard"><span class="eyebrow">E-MAIL AUTOMÁTICO</span><h2>Lembrete do dia anterior</h2><form id="commForm"><label class="commSwitch"><input type="checkbox" name="enabled" ${c.enabled?'checked':''}><span><b>Ativar lembretes automáticos</b><br>O disparo preparado roda diariamente e procura passeios do dia seguinte.</span></label><label><span>Assunto</span><input name="subject" value="${esc(c.reminder_subject)}"></label><label style="display:block;margin-top:14px"><span>Texto do e-mail</span><textarea name="body" rows="18">${esc(c.reminder_body)}</textarea></label><div class="templateTokens">${tokens.map(x=>`<span class="templateToken">${esc(x)}</span>`).join('')}</div><div class="toolbar"><button class="btn primary">Salvar modelo</button><button type="button" class="btn ghost" id="previewComm">Atualizar prévia</button></div><div id="commMsg"></div></form></section><aside class="commCard"><div class="automationStatus"><b>✓ Automação gratuita preparada</b><p>Não usa Cloud Functions nem plano Blaze. O envio é feito por GitHub Actions + Resend. Para começar a enviar, é necessário configurar as credenciais uma única vez no GitHub.</p></div><h3 style="margin-top:20px">Prévia</h3><div class="templatePreview" id="commPreview"></div><h3 style="margin-top:20px">Horário</h3><p style="font-size:12px;color:var(--muted);line-height:1.6">Verificação diária por volta de <b>08:00 de Mato Grosso</b>. Cada reserva recebe apenas um lembrete por passeio.</p></aside></div>`;
    const sample={nome:'Maria Silva',passeio:'Salto das Nuvens',data:'10/10/2026',destino:'Tangará da Serra',saida:'04:00',embarque:'SESI',participantes:'Maria Silva, João Silva',levar:'Tênis, água e roupa de trilha',lembrete_extra:'Chegue com 15 minutos de antecedência.',protocolo:'TR-2026-A7K2',politica:'Consulte as condições aceitas no cadastro.'};
    const preview=()=>{let text=document.querySelector('#commForm [name="body"]').value;Object.entries(sample).forEach(([k,v])=>text=text.replaceAll(`{{${k}}}`,v));document.querySelector('#commPreview').textContent=text};preview();document.querySelector('#previewComm').onclick=preview;
    document.querySelector('#commForm').onsubmit=async e=>{e.preventDefault();const f=e.target;try{await db.collection('settings').doc('communications').set({enabled:f.enabled.checked,reminder_subject:f.subject.value.trim(),reminder_body:f.body.value.trim(),updated_at:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});document.querySelector('#commMsg').innerHTML='<div class="msg ok">Modelo salvo.</div>';toast('Comunicação atualizada.')}catch(ex){document.querySelector('#commMsg').innerHTML=`<div class="msg error">${esc(friendlyError(ex))}</div>`}};
  };

  window.renderNotifications=function(){
    (state.notifications||[]).forEach(n=>n.read=true);saveNotifications();localStorage.setItem(LAST_SEEN_KEY,String(Date.now()));updateNotificationBadge();
    document.querySelector('#content').innerHTML=`<section class="panel"><div class="panelHead"><div><span class="eyebrow">CENTRAL DE ALERTAS</span><h2>Notificações</h2></div><div class="toolbar"><button class="btn ghost" onclick="requestAdminNotifications()">🔔 Ativar no celular</button><button class="btn ghost" onclick="clearAdminNotifications()">Limpar histórico</button></div></div>${state.notifications.length?`<div class="notificationsList">${state.notifications.map(n=>`<div class="notificationItem ${n.read?'':'unread'}"><div class="notificationIcon">${n.type==='registration'?'✓':n.type==='cancel'?'!':'i'}</div><div class="notificationBody"><strong>${esc(n.title)}</strong><p>${esc(n.body)}</p><time>${esc(humanTime(n.created_at))}</time></div></div>`).join('')}</div>`:`<div class="emptyNotifications">Nenhuma notificação neste aparelho ainda.<br>Novos cadastros e pedidos de cancelamento aparecerão aqui.</div>`}</section>`;
  };

  window.tripModal=function(id=''){
    const t=id?state.trips.find(x=>x.id===id):null,c=t?.registration_options||{},policy=typeof defaultCancellationPolicy==='function'?(t?.cancellation_policy||defaultCancellationPolicy(t?.name||'este passeio')):(t?.cancellation_policy||'');
    const join=v=>typeof joinOptions==='function'?joinOptions(v):(Array.isArray(v)?v.join(' | '):'');const split=v=>typeof splitOptions==='function'?splitOptions(v):String(v||'').split('|').map(x=>x.trim()).filter(Boolean);
    modal(`<form id="tripform"><div class="modalHead"><div><span class="eyebrow">${t?'EDITAR':'NOVO'} PASSEIO</span><h2 style="margin:4px 0">${t?'Atualizar passeio':'Cadastrar passeio'}</h2></div><button type="button" class="iconClose" id="tripClose">✕</button></div><div class="modalBody"><div class="subsection"><h3>Informações principais</h3><div class="grid two"><label><span>Nome</span><input name="name" required value="${esc(t?.name||'')}"></label><label><span>Destino</span><input name="destination" value="${esc(t?.destination||'')}"></label><label><span>Data</span><input name="tripDate" type="date" required value="${String(t?.trip_date||'').slice(0,10)}"></label><label><span>Status</span><select name="status">${['draft','open','closed','completed','cancelled'].map(x=>`<option value="${x}" ${t?.status===x?'selected':''}>${status[x]}</option>`).join('')}</select></label><label><span>Total de vagas</span><input name="totalSpots" type="number" min="1" required value="${t?.total_spots||45}"></label><label><span>Valor padrão por pessoa</span><input name="defaultPrice" type="number" step=".01" value="${t?.default_price||''}"></label><label><span>Custo previsto do passeio</span><input name="estimatedCost" type="number" min="0" step=".01" value="${t?.estimated_cost||''}" placeholder="Ex.: 8500"></label></div></div><div class="subsection"><h3>Operação</h3><div class="grid two"><label><span>Horário de saída</span><input name="departureTime" type="time" value="${esc(t?.departure_time||'')}"></label><label><span>Ponto de embarque</span><input name="departurePoint" value="${esc(t?.departure_point||'')}"></label><label><span>Retorno previsto</span><input name="returnInfo" value="${esc(t?.return_info||'')}"></label><label><span>Link grupo WhatsApp</span><input name="whatsappGroupUrl" value="${esc(t?.whatsapp_group_url||'')}"></label><label><span>Nível</span><select name="difficulty"><option value="">Não informar</option>${['Fácil','Moderado','Moderado a difícil','Difícil'].map(x=>`<option ${t?.difficulty===x?'selected':''}>${x}</option>`).join('')}</select></label><label><span>Idade mínima</span><input name="minimumAge" type="number" min="0" value="${t?.minimum_age||''}"></label><label><span>Distância (km)</span><input name="distanceKm" type="number" min="0" step=".1" value="${t?.distance_km||''}"></label><label><span>Itens inclusos</span><input name="includedItems" value="${esc(t?.included_items||'')}"></label></div><label style="display:block;margin-top:14px"><span>O que levar / orientação</span><textarea name="whatToBring" rows="4">${esc(t?.what_to_bring||'')}</textarea></label></div><div class="subsection"><h3>Opções do cadastro</h3><div class="grid two"><label><span>Hospedagem</span><input name="accommodationOptions" value="${esc(join(c.accommodation))}" placeholder="Quarto compartilhado | Quarto casal | Camping"></label><label><span>Transporte</span><input name="transportOptions" value="${esc(join(c.transport))}" placeholder="Ônibus | Carro próprio"></label><label><span>Categoria</span><input name="categoryOptions" value="${esc(join(c.category))}" placeholder="Adulto | Criança"></label><label><span>Pontos de embarque</span><input name="boardingOptions" value="${esc(join(c.boarding))}" placeholder="SESI | André Maggi"></label><label><span>Nome opção extra</span><input name="extraLabel" value="${esc(c.extra_label||'')}"></label><label><span>Opções extras</span><input name="extraOptions" value="${esc(join(c.extra))}"></label></div></div><div class="subsection"><h3>Comunicação</h3><label class="check"><input name="reminderEnabled" type="checkbox" ${t?.email_reminder_enabled===false?'':'checked'}><span>Enviar lembrete automático 1 dia antes quando a automação de e-mail estiver configurada.</span></label><label style="display:block;margin-top:12px"><span>Mensagem extra deste passeio no lembrete</span><textarea name="reminderNotes" rows="3" placeholder="Ex.: Chegue 15 minutos antes. Vá com a roupa de trilha.">${esc(t?.reminder_notes||'')}</textarea></label></div><div class="subsection"><h3>Política de cancelamento</h3><div class="toolbar" style="margin-bottom:10px"><button type="button" class="btn ghost" id="defaultPolicy">Aplicar política padrão</button></div><textarea name="cancellationPolicy" rows="12" required>${esc(policy)}</textarea></div><label class="check"><input name="assumesPayment" type="checkbox" ${t?.assumes_payment===false?'':'checked'}><span>Quem recebe o link já realizou o pagamento; calcular receita automaticamente.</span></label><div id="fm"></div>${t?`<div class="dangerZone"><strong>Zona de exclusão</strong><p>Excluir um passeio também remove cadastros e despesas vinculados.</p><button type="button" class="btn danger" id="deleteTripInside">Excluir passeio</button></div>`:''}</div><div class="modalFoot"><button type="button" class="btn ghost" id="tripCancel">Cancelar</button><button class="btn primary" id="tripSave">Salvar passeio</button></div></form>`);
    document.querySelector('#tripClose').onclick=safeCloseModal;document.querySelector('#tripCancel').onclick=safeCloseModal;if(document.querySelector('#defaultPolicy'))document.querySelector('#defaultPolicy').onclick=()=>{const f=document.querySelector('#tripform');if(typeof defaultCancellationPolicy==='function')f.cancellationPolicy.value=defaultCancellationPolicy(f.name.value||'este passeio')};if(document.querySelector('#deleteTripInside'))document.querySelector('#deleteTripInside').onclick=()=>{safeCloseModal();deleteTrip(t.id)};
    document.querySelector('#tripform').onsubmit=async e=>{e.preventDefault();const f=e.target,save=document.querySelector('#tripSave');save.disabled=true;save.textContent=navigator.onLine?'Salvando...':'Salvando localmente...';try{const data={name:f.name.value.trim(),destination:f.destination.value.trim(),trip_date:f.tripDate.value,status:f.status.value,total_spots:Number(f.totalSpots.value),default_price:Number(f.defaultPrice.value||0),estimated_cost:Number(f.estimatedCost.value||0),departure_time:f.departureTime.value,departure_point:f.departurePoint.value.trim(),return_info:f.returnInfo.value.trim(),whatsapp_group_url:f.whatsappGroupUrl.value.trim(),difficulty:f.difficulty.value,minimum_age:f.minimumAge.value?Number(f.minimumAge.value):null,distance_km:f.distanceKm.value?Number(f.distanceKm.value):null,included_items:f.includedItems.value.trim(),what_to_bring:f.whatToBring.value.trim(),registration_options:{accommodation:split(f.accommodationOptions.value),transport:split(f.transportOptions.value),category:split(f.categoryOptions.value),boarding:split(f.boardingOptions.value),extra_label:f.extraLabel.value.trim(),extra:split(f.extraOptions.value)},email_reminder_enabled:f.reminderEnabled.checked,reminder_notes:f.reminderNotes.value.trim(),cancellation_policy:f.cancellationPolicy.value.trim(),assumes_payment:f.assumesPayment.checked,updated_at:firebase.firestore.FieldValue.serverTimestamp()};if(t){if(data.total_spots<Number(t.used_spots||0))throw Error('O total de vagas não pode ser menor que as vagas ocupadas.');data.used_spots=Number(t.used_spots||0);data.remaining_spots=data.total_spots-data.used_spots;await db.collection('trips').doc(t.id).update(data)}else{data.used_spots=0;data.remaining_spots=data.total_spots;data.created_at=firebase.firestore.FieldValue.serverTimestamp();await db.collection('trips').add(data)}safeCloseModal();toast(navigator.onLine?'Passeio salvo.':'Passeio salvo neste aparelho e aguardando sincronização.')}catch(ex){document.querySelector('#fm').innerHTML=`<div class="msg error">${esc(friendlyError(ex))}</div>`;save.disabled=false;save.textContent='Salvar passeio'}};
  };

  window.deleteExpense=async function(id){if(!confirm('Excluir esta despesa?'))return;try{await db.collection('expenses').doc(id).delete();toast(navigator.onLine?'Despesa excluída.':'Exclusão registrada e será sincronizada quando a internet voltar.')}catch(ex){toast(friendlyError(ex),'error')}};
  window.deleteTrip=async function(id){const t=state.trips.find(x=>x.id===id);if(!t)return;if(!navigator.onLine)return toast('Para excluir um passeio completo, conecte-se à internet.','error');const typed=prompt(`Excluir definitivamente "${t.name}"?\n\nDigite EXCLUIR para confirmar:`);if(typed!=='EXCLUIR')return;try{const tripRef=db.collection('trips').doc(id),[rs,es]=await Promise.all([tripRef.collection('reservations').get(),db.collection('expenses').where('trip_id','==',id).get()]);const refs=[...rs.docs.map(d=>d.ref),...es.docs.map(d=>d.ref)];for(let i=0;i<refs.length;i+=400){const b=db.batch();refs.slice(i,i+400).forEach(r=>b.delete(r));await b.commit()}await tripRef.delete();toast('Passeio excluído com sucesso.')}catch(ex){toast(friendlyError(ex),'error')}};
  window.deleteReservation=async function(tripId,id){const r=state.reservations.find(x=>x.trip_id===tripId&&x.id===id);if(!r)return;if(!navigator.onLine)return toast('Conecte-se à internet para excluir uma reserva e recalcular as vagas com segurança.','error');if(!confirm(`Excluir o cadastro de ${r.responsible_name}? As ${r.seats} vaga(s) serão devolvidas.`))return;const ref=db.collection('trips').doc(tripId).collection('reservations').doc(id),tripRef=db.collection('trips').doc(tripId);try{await db.runTransaction(async tx=>{const [rs,ts]=await Promise.all([tx.get(ref),tx.get(tripRef)]);if(!rs.exists||!ts.exists)throw Error('Registro não encontrado.');const old=rs.data(),t=ts.data();tx.delete(ref);if(old.status!=='cancelled')tx.update(tripRef,{remaining_spots:Number(t.remaining_spots||0)+Number(old.seats||0),used_spots:Math.max(0,Number(t.used_spots||0)-Number(old.seats||0)),updated_at:firebase.firestore.FieldValue.serverTimestamp()})});safeCloseModal();toast('Cadastro excluído e vagas devolvidas.')}catch(ex){toast(friendlyError(ex),'error')}};

  window.addEventListener('trilheiros:pwa-ready',()=>{const b=document.querySelector('.installBtn');if(b)b.textContent='⬇ Instalar'});
  window.addEventListener('trilheiros:pwa-installed',()=>toast('Aplicativo instalado.'));
})();
