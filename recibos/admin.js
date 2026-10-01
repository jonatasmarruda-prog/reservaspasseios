(()=>{
const {supabaseClient}=window.ReceiptsApp;
const root=document.getElementById('root');
let S={profile:null,settings:{},receipts:[],closures:[],serviceTypes:[],deleted:[],users:[],globalQuery:'',view:'dashboard'};

function roleName(r){return r==='admin'?'Administrador':'Contabilidade'}
function withTimeout(promise,ms=8000){return Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(new Error('timeout')),ms))])}
function statusText(s){return ({pending_review:'Não conferido',reviewed:'Conferido',pending_issue:'Com pendência',cancelled:'Cancelado'})[s]||'Não conferido'}
function statusClass(s){return ({pending_review:'pending',reviewed:'success',pending_issue:'warn',cancelled:'cancelled'})[s]||'pending'}
function localISO(d){const x=new Date(d.getTime()-d.getTimezoneOffset()*60000);return x.toISOString().slice(0,10)}
function serviceDate(r){return r.service_date||r.payment_date||''}
function closureFor(y,m){return S.closures.find(c=>Number(c.year)===Number(y)&&Number(c.month)===Number(m))||null}
function isMonthClosed(date){if(!date)return false;const y=Number(String(date).slice(0,4)),m=Number(String(date).slice(5,7));return closureFor(y,m)?.is_closed===true}
function publicFormLink(){return new URL('./',location.href).href.split('?')[0].split('#')[0]}
function validationLink(r){return new URL('validation.html?code='+encodeURIComponent(r.receipt_code||'')+'&v='+encodeURIComponent(r.verification_code||''),publicFormLink()).href}

async function boot(){
  login();
  if(!supabaseClient)return showLoginError('Não foi possível conectar ao serviço de dados.');
  try{
    const {data}=await withTimeout(supabaseClient.auth.getSession(),5000);
    if(data?.session)await enterPanel(data.session);
  }catch(e){console.warn(e)}
}
function showLoginError(msg){const x=document.getElementById('loginErr');if(x){x.textContent=msg;x.classList.remove('hidden')}}
async function enterPanel(session){
  try{
    const {data:p,error}=await withTimeout(supabaseClient.from('profiles').select('*').eq('id',session.user.id).single(),7000);
    if(error||!p||!['admin','accounting'].includes(p.role))throw new Error('Acesso não autorizado.');
    S.profile={...p,email:session.user.email};
    await load();
    shell();
  }catch(e){console.error(e);showLoginError('Login realizado, mas não foi possível abrir o painel. Atualize a página.')}
}
function login(){
  root.innerHTML=`<div class="login-wrap"><div class="login-card"><div class="brand"><img class="brand-logo brand-logo-large" src="https://i.postimg.cc/09t8GNX6/LOGO-TRILHEIROS-Photoroom.png" alt="Logo Trilheiros de Rondonópolis"><div><h1 style="font-size:17px;margin:0">Trilheiros de Rondonópolis</h1><small style="color:#657168">Gestão Premium de Recibos</small></div></div><h1>Acesso ao sistema</h1><p>Acesso restrito ao Administrador e à Contabilidade.</p><form id="login"><div class="field"><label>E-mail</label><input name="email" type="email" required autocomplete="email" placeholder="Digite seu e-mail"></div><div style="height:12px"></div><div class="field"><label>Senha</label><div class="password-field"><input id="loginPassword" name="password" type="password" required autocomplete="current-password" placeholder="Digite sua senha"><button class="password-eye" type="button" id="toggleLoginPassword" aria-label="Mostrar senha" title="Mostrar senha"><svg class="eye-open" viewBox="0 0 24 24"><path d="M12 5c-5 0-9 4.5-10 7 1 2.5 5 7 10 7s9-4.5 10-7c-1-2.5-5-7-10-7Zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8Z"/></svg><svg class="eye-closed" viewBox="0 0 24 24" style="display:none"><path d="m3 2 19 19-1.4 1.4-3.1-3.1A11 11 0 0 1 12 20C7 20 3 15.5 2 13a12 12 0 0 1 4-5.1L1.6 3.4 3 2Zm6 8a4 4 0 0 0 5 5l-5-5ZM12 6c5 0 9 4.5 10 7a13 13 0 0 1-2.6 3.8l-2.1-2.1A4 4 0 0 0 11.3 9L9 6.7A10 10 0 0 1 12 6Z"/></svg></button></div></div><div id="loginErr" class="notice error hidden"></div><div class="actions"><button class="btn btn-primary" style="width:100%">Entrar no painel</button></div></form></div></div>`;
  const eye=document.getElementById('toggleLoginPassword');
  eye.onclick=()=>{const input=document.getElementById('loginPassword'),show=input.type==='password';input.type=show?'text':'password';eye.querySelector('.eye-open').style.display=show?'none':'block';eye.querySelector('.eye-closed').style.display=show?'block':'none'};
  document.getElementById('login').onsubmit=async e=>{
    e.preventDefault();
    const form=e.currentTarget,btn=form.querySelector('.btn-primary');
    document.getElementById('loginErr').classList.add('hidden');
    btn.disabled=true;btn.textContent='Entrando...';
    try{
      const {data,error}=await withTimeout(supabaseClient.auth.signInWithPassword({email:form.email.value.trim(),password:form.password.value}),10000);
      if(error)throw error;
      btn.textContent='Abrindo painel...';
      await enterPanel(data.session);
    }catch(err){console.error(err);showLoginError('Não foi possível entrar. Confira e-mail e senha.')}
    finally{if(document.body.contains(btn)){btn.disabled=false;btn.textContent='Entrar no painel'}}
  };
}
async function load(){
  const base=[
    withTimeout(supabaseClient.from('app_settings').select('*').eq('id',1).single(),8000),
    withTimeout(supabaseClient.from('receipts').select('*').order('created_at',{ascending:false}),8000),
    withTimeout(supabaseClient.from('monthly_closures').select('*').order('year',{ascending:false}).order('month',{ascending:false}),8000),
    withTimeout(supabaseClient.from('service_types').select('*').order('sort_order',{ascending:true}),8000)
  ];
  if(S.profile?.role==='admin')base.push(withTimeout(supabaseClient.from('deleted_receipts_log').select('*').order('deleted_at',{ascending:false}),8000));
  const result=await Promise.all(base);
  S.settings=result[0].data||{};
  S.receipts=result[1].data||[];
  S.closures=result[2].data||[];
  S.serviceTypes=result[3].data||[];
  S.deleted=result[4]?.data||[];
}
function shell(){
  root.innerHTML=`<div class="admin-shell"><aside class="sidebar"><div class="brand"><img class="brand-logo" src="${escapeHtml(S.settings.logo_url||'https://i.postimg.cc/09t8GNX6/LOGO-TRILHEIROS-Photoroom.png')}" alt="Logo Trilheiros"><div><h1>Trilheiros</h1><small>Gestão de Recibos</small></div></div><nav class="nav"><button data-v="dashboard">Visão geral</button><button data-v="receipts">Recibos <span class="nav-count">${S.receipts.filter(r=>(r.accounting_status||'pending_review')==='pending_review'||r.accounting_status==='pending_issue').length}</span></button><button data-v="suppliers">Fornecedores</button><button data-v="documents">Documentos</button><button data-v="monthly">Fechamento mensal</button>${S.profile.role==='admin'?'<button data-v="trash">Lixeira <span class="nav-count">'+S.deleted.length+'</span></button><button data-v="settings">Configurações</button>':''}</nav><div class="sidebar-foot"><div class="user"><strong>${escapeHtml(S.profile.display_name)}</strong><br><span style="color:#bfd3c5">${roleName(S.profile.role)}</span></div><button id="logout" class="btn btn-secondary btn-sm" style="width:100%;margin-top:9px">Sair</button></div></aside><main class="admin-main"><div class="admin-searchbar"><input id="globalSearch" placeholder="Buscar recibo, fornecedor, CPF/CNPJ, serviço ou valor..." value="${escapeHtml(S.globalQuery||'')}"><button class="btn btn-secondary btn-sm" id="globalSearchBtn">Buscar</button></div><div id="content"></div></main></div>`;
  root.querySelectorAll('[data-v]').forEach(b=>b.onclick=()=>{S.view=b.dataset.v;render()});
  document.getElementById('logout').onclick=async()=>{await supabaseClient.auth.signOut();location.reload()};
  const gs=document.getElementById('globalSearch');
  const goSearch=()=>{S.globalQuery=gs.value.trim();S.view='receipts';render();setTimeout(()=>{const q=document.getElementById('fq');if(q){q.value=S.globalQuery;filterReceipts()}},0)};
  document.getElementById('globalSearchBtn').onclick=goSearch;
  gs.onkeydown=e=>{if(e.key==='Enter')goSearch()};
  render();
}
function render(){
  root.querySelectorAll('[data-v]').forEach(b=>b.classList.toggle('active',b.dataset.v===S.view));
  ({dashboard,receipts,suppliers,documents,monthly,trash,settings}[S.view]||dashboard)();
}
async function copyText(text,btn,field){
  let ok=false;
  try{if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(text);ok=true}}catch{}
  if(!ok&&field){try{field.removeAttribute('readonly');field.select();field.setSelectionRange(0,field.value.length);ok=document.execCommand('copy');field.setAttribute('readonly','readonly')}catch{}}
  if(ok){const old=btn?.textContent;if(btn){btn.textContent='✓ Copiado';btn.classList.add('copy-success');setTimeout(()=>{if(document.body.contains(btn)){btn.textContent=old;btn.classList.remove('copy-success')}},1800)}toast('Copiado.');return true}
  if(field){field.removeAttribute('readonly');field.select()}toast('Não foi possível copiar automaticamente. O texto foi selecionado.','error');return false;
}
function showPublicLink(){
  const link=publicFormLink();
  modal(`<div class="modal-head"><div><h3>Link único do fornecedor</h3><span class="muted">Use sempre este mesmo link.</span></div><button class="btn btn-secondary btn-sm" data-close>Fechar</button></div><div class="notice success">O fornecedor preenche, revisa, assina e envia o recibo por este formulário.</div><div class="field"><label>Link do formulário</label><textarea id="publicLink" readonly rows="3">${escapeHtml(link)}</textarea></div><div class="actions link-actions"><button class="btn btn-secondary" id="copyPublic">Copiar link</button><button class="btn btn-primary" id="whatsappPublic">Enviar pelo WhatsApp</button><button class="btn btn-secondary" id="openPublic">Abrir formulário</button></div>`);
  const field=document.getElementById('publicLink'),btn=document.getElementById('copyPublic');
  btn.onclick=()=>copyText(link,btn,field);
  document.getElementById('whatsappPublic').onclick=()=>window.open('https://wa.me/?text='+encodeURIComponent('Olá! Segue o link para preencher e assinar o recibo digital dos Trilheiros de Rondonópolis:\n\n'+link),'_blank','noopener');
  document.getElementById('openPublic').onclick=()=>window.open(link,'_blank','noopener');
}
function dashboard(){
  const now=new Date(),ym=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
  const month=S.receipts.filter(r=>serviceDate(r).startsWith(ym)&&r.accounting_status!=='cancelled');
  const total=month.reduce((a,b)=>a+Number(b.amount_received||0),0);
  const pending=S.receipts.filter(r=>(r.accounting_status||'pending_review')==='pending_review').length;
  const issue=S.receipts.filter(r=>r.accounting_status==='pending_issue').length;
  const byType={};month.forEach(r=>byType[r.service_type]=(byType[r.service_type]||0)+Number(r.amount_received||0));
  const topSuppliers={};month.forEach(r=>{const k=r.cpf_cnpj;topSuppliers[k]??={name:r.legal_name,total:0,count:0};topSuppliers[k].total+=Number(r.amount_received||0);topSuppliers[k].count++});
  const types=Object.entries(byType).sort((a,b)=>b[1]-a[1]).slice(0,6);
  const tops=Object.values(topSuppliers).sort((a,b)=>b.total-a.total).slice(0,5);
  document.getElementById('content').innerHTML=`<div class="admin-head"><div><h2>Visão geral</h2><p>Resumo financeiro e contábil dos recibos.</p></div><button class="btn btn-primary" id="publicLinkBtn">Link do fornecedor</button></div>
  ${pending||issue?'<div class="dashboard-alert"><strong>⚠ Atenção da contabilidade</strong><span>'+pending+' recibo(s) não conferido(s) e '+issue+' com pendência.</span><button class="btn btn-secondary btn-sm" id="reviewPending">Revisar agora</button></div>':''}
  <div class="kpis"><div class="kpi"><span>Recibos no mês</span><strong>${month.length}</strong></div><div class="kpi"><span>Valor no mês</span><strong>${brl(total)}</strong></div><div class="kpi"><span>Não conferidos</span><strong>${pending}</strong></div><div class="kpi"><span>Com pendência</span><strong>${issue}</strong></div></div>
  <div class="dashboard-grid"><div class="panel"><h3>Por tipo de serviço — mês</h3>${types.length?types.map(([k,v])=>'<div class="metric-row"><span>'+escapeHtml(k)+'</span><strong>'+brl(v)+'</strong></div>').join(''):'<div class="empty">Sem dados no mês.</div>'}</div>
  <div class="panel"><h3>Principais fornecedores</h3>${tops.length?tops.map(x=>'<div class="metric-row"><span>'+escapeHtml(x.name)+' <small>('+x.count+')</small></span><strong>'+brl(x.total)+'</strong></div>').join(''):'<div class="empty">Sem dados no mês.</div>'}</div></div>
  <div class="panel"><div class="panel-head"><h3>Resumo anual — ${now.getFullYear()}</h3></div>${annualSummary(now.getFullYear())}<div class="annual-trend">${annualTrendHtml(now.getFullYear())}</div></div>
  <div class="panel"><div class="panel-head"><h3>Últimos recibos</h3><button class="btn btn-secondary btn-sm" id="goReceipts">Ver todos</button></div>${tableReceipts(S.receipts.slice(0,8))}</div>`;
  document.getElementById('publicLinkBtn').onclick=showPublicLink;
  document.getElementById('reviewPending')?.addEventListener('click',()=>{S.view='receipts';render();setTimeout(()=>{const fs=document.getElementById('fs');if(fs){fs.value='pending_review';filterReceipts()}},0)});
  document.getElementById('goReceipts').onclick=()=>{S.view='receipts';render()};
  wireReceipt();
}

function annualSummary(year){
  const rows=S.receipts.filter(r=>Number(serviceDate(r).slice(0,4))===year&&r.accounting_status!=='cancelled');
  if(!rows.length)return'<div class="empty">Sem recibos neste ano.</div>';
  const byType={};rows.forEach(r=>byType[r.service_type]=(byType[r.service_type]||0)+Number(r.amount_received||0));
  const total=rows.reduce((a,b)=>a+Number(b.amount_received||0),0);
  return '<div class="metric-row"><span>Total anual</span><strong>'+brl(total)+'</strong></div>'+
    Object.entries(byType).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([k,v])=>'<div class="metric-row"><span>'+escapeHtml(k)+'</span><strong>'+brl(v)+'</strong></div>').join('');
}

function annualTrendHtml(year){
  const months=Array.from({length:12},(_,i)=>({m:i+1,total:0,count:0}));
  S.receipts.filter(r=>r.accounting_status!=='cancelled'&&Number(serviceDate(r).slice(0,4))===year).forEach(r=>{const m=Number(serviceDate(r).slice(5,7));if(months[m-1]){months[m-1].total+=Number(r.amount_received||0);months[m-1].count++}});
  const max=Math.max(1,...months.map(x=>x.total));
  return '<div class="trend-bars">'+months.map(x=>'<div class="trend-item" title="'+String(x.m).padStart(2,'0')+'/'+year+' • '+brl(x.total)+'"><div class="trend-bar-wrap"><div class="trend-bar" style="height:'+Math.max(3,Math.round((x.total/max)*100))+'%"></div></div><span>'+String(x.m).padStart(2,'0')+'</span></div>').join('')+'</div>';
}
function tableReceipts(rows){
  if(!rows.length)return'<div class="empty">Nenhum recibo encontrado.</div>';
  return '<div class="table-wrap"><table><thead><tr><th>Recibo</th><th>Fornecedor</th><th>Serviço</th><th>Data</th><th>Valor</th><th>Status</th><th>Ações</th></tr></thead><tbody>'+
  rows.map(r=>`<tr><td><strong>${escapeHtml(r.receipt_code||'—')}</strong></td><td><button class="supplier-link" data-history="${escapeHtml(r.cpf_cnpj)}">${escapeHtml(r.legal_name)}</button><br><span class="muted">${formatCpfCnpj(r.cpf_cnpj)}</span></td><td>${escapeHtml(r.service_type||'—')}</td><td>${dateBR(serviceDate(r))}</td><td class="money">${brl(r.amount_received)}</td><td><span class="badge ${statusClass(r.accounting_status)}">${statusText(r.accounting_status)}</span></td><td><div class="table-actions"><button class="btn btn-secondary btn-sm" data-open="${r.id}">Abrir</button><button class="btn btn-primary btn-sm" data-pdf="${r.id}">PDF</button></div></td></tr>`).join('')+
  '</tbody></table></div>';
}
function wireReceipt(){
  document.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>openReceipt(b.dataset.open));
  document.querySelectorAll('[data-pdf]').forEach(b=>b.onclick=()=>{const r=S.receipts.find(x=>x.id===b.dataset.pdf);if(r)previewReceiptPDF(r,null,S.settings)});
  document.querySelectorAll('[data-history]').forEach(b=>b.onclick=()=>supplierHistory(b.dataset.history));
}
function setQuickRange(kind){
  const a=document.getElementById('fd1'),b=document.getElementById('fd2'),now=new Date();let start='',end='';
  if(kind==='today'){start=end=localISO(now)}
  if(kind==='week'){const d=new Date(now);const day=(d.getDay()+6)%7;d.setDate(d.getDate()-day);start=localISO(d);end=localISO(now)}
  if(kind==='month'){start=localISO(new Date(now.getFullYear(),now.getMonth(),1));end=localISO(now)}
  if(kind==='last'){start=localISO(new Date(now.getFullYear(),now.getMonth()-1,1));end=localISO(new Date(now.getFullYear(),now.getMonth(),0))}
  if(kind==='all'){start='';end=''}
  a.value=start;b.value=end;filterReceipts();
  document.querySelectorAll('[data-range]').forEach(x=>x.classList.toggle('active-filter',x.dataset.range===kind));
}
function receipts(){
  const types=[...new Set(S.receipts.map(r=>r.service_type).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
  document.getElementById('content').innerHTML=`<div class="admin-head"><div><h2>Recibos</h2><p>Consulte, confira, filtre e gere documentos.</p></div><div class="actions inline-actions"><button class="btn btn-secondary" id="publicLinkBtn">Link do fornecedor</button><button class="btn btn-secondary" id="csv">Exportar CSV</button></div></div>
  <div class="quick-filters"><button class="btn btn-secondary btn-sm" data-range="today">Hoje</button><button class="btn btn-secondary btn-sm" data-range="week">Esta semana</button><button class="btn btn-secondary btn-sm" data-range="month">Este mês</button><button class="btn btn-secondary btn-sm" data-range="last">Mês anterior</button><button class="btn btn-secondary btn-sm" data-range="all">Todos</button></div>
  <div class="toolbar"><div class="field"><label>Tipo de serviço</label><select id="ft"><option value="">Todos</option>${types.map(t=>'<option value="'+escapeHtml(t)+'">'+escapeHtml(t)+'</option>').join('')}</select></div><div class="field"><label>Status</label><select id="fs"><option value="">Todos</option><option value="pending_review">Não conferido</option><option value="reviewed">Conferido</option><option value="pending_issue">Com pendência</option><option value="cancelled">Cancelado</option></select></div><div class="field"><label>Data inicial</label><input id="fd1" type="date"></div><div class="field"><label>Data final</label><input id="fd2" type="date"></div><div class="field search"><label>Buscar</label><input id="fq" placeholder="Fornecedor, CPF/CNPJ, serviço, recibo ou valor..." value="${escapeHtml(S.globalQuery||'')}"></div></div><div id="list"></div>`;
  ['ft','fs','fd1','fd2'].forEach(id=>document.getElementById(id).onchange=filterReceipts);
  document.getElementById('fq').oninput=filterReceipts;
  document.getElementById('csv').onclick=exportCSV;
  document.getElementById('publicLinkBtn').onclick=showPublicLink;
  document.querySelectorAll('[data-range]').forEach(b=>b.onclick=()=>setQuickRange(b.dataset.range));
  setQuickRange('month');
}
function filtered(){
  const type=document.getElementById('ft')?.value||'',status=document.getElementById('fs')?.value||'',start=document.getElementById('fd1')?.value||'',end=document.getElementById('fd2')?.value||'',q=(document.getElementById('fq')?.value||'').toLowerCase().trim();
  return S.receipts.filter(r=>{const d=serviceDate(r),hay=(r.legal_name+' '+r.cpf_cnpj+' '+(r.service_type||'')+' '+(r.service_reference||'')+' '+(r.receipt_code||'')+' '+String(r.amount_received||'')+' '+(r.payment_method||'')).toLowerCase();return(!type||r.service_type===type)&&(!status||(r.accounting_status||'pending_review')===status)&&(!start||d>=start)&&(!end||d<=end)&&(!q||hay.includes(q))});
}
function filterReceipts(){const rows=filtered(),sum=rows.filter(r=>r.accounting_status!=='cancelled').reduce((a,b)=>a+Number(b.amount_received||0),0);document.getElementById('list').innerHTML='<div class="panel"><strong>'+rows.length+' recibo(s) • '+brl(sum)+'</strong><div style="height:12px"></div>'+tableReceipts(rows)+'</div>';wireReceipt()}
async function openReceipt(id){
  const r=S.receipts.find(x=>x.id===id);if(!r)return;
  const address=[r.address,r.address_number,r.neighborhood,r.complement,r.city,r.state].filter(Boolean).join(', ');
  modal(`<div class="modal-head"><div><h3>Recibo ${escapeHtml(r.receipt_code||'—')}</h3><span class="muted">Validação: ${escapeHtml(r.verification_code||'—')}</span></div><button class="btn btn-secondary btn-sm" data-close>Fechar</button></div>
  <div class="receipt-status-bar"><div><span class="badge ${statusClass(r.accounting_status)}">${statusText(r.accounting_status)}</span> ${isMonthClosed(serviceDate(r))?'<span class="badge locked">Competência fechada</span>':''} ${r.finance_synced_at?'<span class="badge success">No financeiro</span>':''}</div><span class="muted">Registrado em ${dateTimeBR(r.created_at)}</span></div>
  <div class="receipt-view-section"><h4>Fornecedor</h4><div class="detail-grid"><div class="detail"><span>Nome / Empresa</span><strong>${escapeHtml(r.legal_name)}</strong></div><div class="detail"><span>CPF/CNPJ</span><strong>${formatCpfCnpj(r.cpf_cnpj)}</strong></div><div class="detail"><span>Telefone</span><strong>${formatPhone(r.phone)}</strong></div><div class="detail"><span>E-mail</span><strong>${escapeHtml(r.email||'Não informado')}</strong></div><div class="detail detail-full"><span>Endereço</span><strong>${escapeHtml(address||'—')}</strong></div></div></div>
  <div class="receipt-view-section"><h4>Serviço e pagamento</h4><div class="detail-grid"><div class="detail"><span>Tipo de serviço</span><strong>${escapeHtml(r.service_type||'—')}</strong></div><div class="detail"><span>Data do serviço</span><strong>${dateBR(serviceDate(r))}</strong></div><div class="detail detail-full"><span>Descrição</span><strong>${escapeHtml(r.service_description||'—')}</strong></div><div class="detail"><span>Valor recebido</span><strong>${brl(r.amount_received)}</strong></div>${r.billing_mode==='per_person'?'<div class="detail"><span>Cálculo</span><strong>'+r.quantity_people+' pessoa(s) × '+brl(r.unit_amount)+'</strong></div>':''}<div class="detail"><span>Recebimento</span><strong>${dateBR(r.payment_date)}</strong></div><div class="detail"><span>Forma</span><strong>${escapeHtml(r.payment_method||'—')}</strong></div><div class="detail"><span>Assinado por</span><strong>${escapeHtml(r.declarant_name||r.legal_name)}</strong></div>${r.notes?'<div class="detail detail-full"><span>Observação</span><strong>'+escapeHtml(r.notes)+'</strong></div>':''}</div></div>
  ${r.attachment_data_url?'<div class="receipt-view-section"><h4>Anexo</h4><a class="btn btn-secondary" href="'+r.attachment_data_url+'" download="'+escapeHtml(r.attachment_name||'anexo')+'">Baixar '+escapeHtml(r.attachment_name||'anexo')+'</a></div>':''}
  <div class="receipt-view-section"><h4>Assinatura</h4><img class="signature-preview premium-signature-preview" src="${r.signature_data_url}"></div>
  <div class="receipt-view-section"><h4>Conferência contábil</h4><div class="field"><label>Observação da conferência</label><textarea id="reviewNotes" placeholder="Opcional">${escapeHtml(r.review_notes||'')}</textarea></div><div class="actions review-actions"><button class="btn btn-secondary" data-review="pending_review">Não conferido</button><button class="btn btn-primary" data-review="reviewed">Conferido</button><button class="btn btn-secondary" data-review="pending_issue">Com pendência</button>${S.profile.role==='admin'?'<button class="btn btn-danger" data-review="cancelled">Cancelar</button>':''}</div></div>
  <div id="auditBox" class="receipt-view-section"><h4>Histórico</h4><div class="muted">Carregando...</div></div>
  <div class="actions receipt-main-actions">
    ${S.profile.role==='admin'?'<button class="btn btn-secondary" id="editReceiptBtn">Editar recibo</button><button class="btn btn-danger" id="deleteReceiptBtn">Excluir recibo</button>'+(r.finance_synced_at?'<button class="btn btn-secondary" disabled>Financeiro: '+escapeHtml(r.finance_trip_name||'Enviado')+'</button>':'<button class="btn btn-secondary" id="sendFinanceBtn">Enviar para o Financeiro</button>'):''}
    <button class="btn btn-secondary" id="validateNow">Validar documento</button>
    <button class="btn btn-secondary" id="previewPdfNow">Visualizar PDF</button>
    <button class="btn btn-primary" id="pdfNow">Baixar PDF</button>
  </div>`);
  document.getElementById('pdfNow').onclick=()=>generateReceiptPDF(r,null,S.settings,'download');
  document.getElementById('previewPdfNow').onclick=()=>previewReceiptPDF(r,null,S.settings);
  document.getElementById('validateNow').onclick=()=>window.open(validationLink(r),'_blank','noopener');
  document.getElementById('editReceiptBtn')?.addEventListener('click',()=>editReceipt(r.id));
  document.getElementById('deleteReceiptBtn')?.addEventListener('click',()=>deleteReceipt(r.id));
  document.getElementById('sendFinanceBtn')?.addEventListener('click',()=>sendToFinance(r.id));
  document.querySelectorAll('[data-review]').forEach(b=>b.onclick=()=>reviewReceipt(r.id,b.dataset.review,document.getElementById('reviewNotes').value));
  loadAudit(r.id);
}


async function sendToFinance(id){
  const r=S.receipts.find(x=>x.id===id);if(!r)return;
  const btn=document.getElementById('sendFinanceBtn');if(btn){btn.disabled=true;btn.textContent='Preparando...'}
  try{
    const {data,error}=await supabaseClient.rpc('create_finance_transfer',{p_receipt_id:id});
    if(error)throw error;
    const x=data?.[0];if(!x?.token)throw new Error('Não foi possível gerar a transferência.');
    const url=new URL('https://trilheiros-reservas.web.app/admin');
    url.searchParams.set('receipt_transfer',x.token);
    url.searchParams.set('rid',id);
    url.searchParams.set('code',r.receipt_code||'');
    url.searchParams.set('v',r.verification_code||'');
    window.open(url.href,'_blank','noopener');
    toast('Abra o Trilheiros Gestão, escolha o passeio e confirme a despesa.');
  }catch(e){toast(e.message||'Não foi possível preparar a transferência.','error')}
  finally{if(btn&&document.body.contains(btn)){btn.disabled=false;btn.textContent='Enviar para o Financeiro'}}
}
function editReceipt(id){
  const r=S.receipts.find(x=>x.id===id);if(!r)return;
  const serviceTypes=['Transporte / Ônibus','Hotel / Pousada','Alimentação','Guia / Condutor','Atrativo / Ingresso','Fotografia','Seguro','Combustível','Locação','Manutenção / Serviço técnico','Outro'];
  const paymentMethods=['PIX','Transferência bancária','Dinheiro','Cartão','Boleto','Outro'];

  modal(`<div class="modal-head"><div><h3>Editar recibo ${escapeHtml(r.receipt_code||'')}</h3><span class="muted">As alterações ficam registradas no histórico.</span></div><button class="btn btn-secondary btn-sm" data-close>Fechar</button></div>
  <form id="editReceiptForm">
    <div class="grid">
      <div class="field full"><label class="required">Nome / Empresa</label><input name="legal_name" required value="${escapeHtml(r.legal_name||'')}"></div>
      <div class="field"><label class="required">CPF/CNPJ</label><input name="cpf_cnpj" required value="${escapeHtml(formatCpfCnpj(r.cpf_cnpj||''))}"></div>
      <div class="field"><label class="required">Telefone</label><input name="phone" required value="${escapeHtml(formatPhone(r.phone||''))}"></div>
      <div class="field full"><label>E-mail</label><input name="email" type="email" value="${escapeHtml(r.email||'')}"></div>
      <div class="field"><label>CEP</label><input name="postal_code" value="${escapeHtml(r.postal_code?formatCep(r.postal_code):'')}"></div>
      <div class="field"><label class="required">Cidade</label><input name="city" required value="${escapeHtml(r.city||'')}"></div>
      <div class="field"><label class="required">UF</label><input name="state" maxlength="2" required value="${escapeHtml(r.state||'')}"></div>
      <div class="field full"><label>Endereço</label><input name="address" value="${escapeHtml(r.address||'')}"></div>
      <div class="field"><label>Número</label><input name="address_number" value="${escapeHtml(r.address_number||'')}"></div>
      <div class="field"><label>Bairro</label><input name="neighborhood" value="${escapeHtml(r.neighborhood||'')}"></div>
      <div class="field full"><label>Complemento</label><input name="complement" value="${escapeHtml(r.complement||'')}"></div>
      <div class="field"><label class="required">Tipo de serviço</label><select name="service_type" required>${serviceTypes.map(x=>'<option '+(x===r.service_type?'selected':'')+'>'+escapeHtml(x)+'</option>').join('')}</select></div>
      <div class="field"><label class="required">Data do serviço</label><input name="service_date" type="date" required value="${escapeHtml(serviceDate(r))}"></div>
      <div class="field full"><label>Referência do serviço</label><input name="service_reference" value="${escapeHtml(r.service_reference||'')}"></div>
      <div class="field"><label class="required">Forma de cobrança</label><select name="billing_mode"><option value="total" ${(r.billing_mode||'total')==='total'?'selected':''}>Valor total</option><option value="per_person" ${r.billing_mode==='per_person'?'selected':''}>Valor por pessoa</option></select></div>
      <div class="field" id="editTotalWrap"><label class="required">Valor total</label><input name="amount_received" inputmode="decimal" value="${Number(r.amount_received||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}"></div>
      <div class="field" id="editQtyWrap"><label>Quantidade de pessoas</label><input name="quantity_people" type="number" min="1" step="1" value="${r.quantity_people||''}"></div>
      <div class="field" id="editUnitWrap"><label>Valor por pessoa</label><input name="unit_amount" inputmode="decimal" value="${r.unit_amount?Number(r.unit_amount).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}):''}"></div>
      <div class="field"><label class="required">Data do recebimento</label><input name="payment_date" type="date" required value="${escapeHtml(r.payment_date||'')}"></div>
      <div class="field"><label class="required">Forma de pagamento</label><select name="payment_method" required>${paymentMethods.map(x=>'<option '+(x===r.payment_method?'selected':'')+'>'+escapeHtml(x)+'</option>').join('')}</select></div>
      <div class="field"><label>Assinado por</label><input name="declarant_name" value="${escapeHtml(r.declarant_name||r.legal_name||'')}"></div>
      <div class="field full"><label>Observação</label><textarea name="notes">${escapeHtml(r.notes||'')}</textarea></div>
    </div>
    <div id="editErr" class="notice error hidden"></div>
    <div class="actions"><button type="button" class="btn btn-secondary" data-close>Cancelar</button><button class="btn btn-primary">Salvar alterações</button></div>
  </form>`);

  const f=document.getElementById('editReceiptForm');
  f.cpf_cnpj.oninput=e=>e.target.value=formatCpfCnpj(e.target.value);
  f.phone.oninput=e=>e.target.value=formatPhone(e.target.value);
  f.postal_code.oninput=e=>e.target.value=formatCep(e.target.value);
  f.state.oninput=e=>e.target.value=e.target.value.replace(/[^a-z]/gi,'').slice(0,2).toUpperCase();
  const toggleEditPricing=()=>{
    const per=f.billing_mode.value==='per_person';
    document.getElementById('editTotalWrap').classList.toggle('hidden',per);
    document.getElementById('editQtyWrap').classList.toggle('hidden',!per);
    document.getElementById('editUnitWrap').classList.toggle('hidden',!per);
  };
  f.billing_mode.onchange=toggleEditPricing;
  toggleEditPricing();

  f.onsubmit=async e=>{
    e.preventDefault();
    const btn=f.querySelector('.btn-primary'),err=document.getElementById('editErr');
    err.classList.add('hidden');btn.disabled=true;btn.textContent='Salvando...';
    const payload={
      legal_name:f.legal_name.value.trim(),
      cpf_cnpj:onlyDigits(f.cpf_cnpj.value),
      phone:onlyDigits(f.phone.value),
      email:f.email.value.trim(),
      postal_code:onlyDigits(f.postal_code.value),
      address:f.address.value.trim(),
      address_number:f.address_number.value.trim(),
      neighborhood:f.neighborhood.value.trim(),
      complement:f.complement.value.trim(),
      city:f.city.value.trim(),
      state:f.state.value.trim().toUpperCase(),
      service_type:f.service_type.value,
      service_reference:f.service_reference.value.trim(),
      service_date:f.service_date.value,
      billing_mode:f.billing_mode.value,
      quantity_people:f.billing_mode.value==='per_person'?Number(f.quantity_people.value||0):null,
      unit_amount:f.billing_mode.value==='per_person'?currencyInputToNumber(f.unit_amount.value):null,
      amount_received:f.billing_mode.value==='total'?currencyInputToNumber(f.amount_received.value):0,
      payment_date:f.payment_date.value,
      payment_method:f.payment_method.value,
      declarant_name:f.declarant_name.value.trim(),
      notes:f.notes.value.trim()
    };
    try{
      const {error}=await supabaseClient.rpc('update_receipt_admin',{p_receipt_id:id,p_payload:payload});
      if(error)throw error;
      await load();
      document.querySelector('.modal-backdrop')?.remove();
      toast('Recibo atualizado com sucesso.');
      render();
    }catch(ex){
      err.textContent=ex.message||'Não foi possível atualizar.';
      err.classList.remove('hidden');
      btn.disabled=false;btn.textContent='Salvar alterações';
    }
  };
}

async function deleteReceipt(id){
  const r=S.receipts.find(x=>x.id===id);if(!r)return;
  const ok=window.confirm('Excluir definitivamente o recibo '+(r.receipt_code||'')+' de '+r.legal_name+'?\n\nUma cópia será preservada no histórico administrativo.');
  if(!ok)return;
  const {error}=await supabaseClient.rpc('delete_receipt_admin',{p_receipt_id:id});
  if(error){toast(error.message,'error');return}
  await load();
  document.querySelector('.modal-backdrop')?.remove();
  toast('Recibo excluído. Cópia preservada no histórico administrativo.');
  render();
}

function auditLabel(action){return ({submitted:'Recibo enviado',edited:'Recibo editado',status_changed:'Status alterado',restored:'Recibo restaurado',finance_synced:'Enviado ao financeiro'})[action]||action}
function auditChanges(a){
  const d=a.details||{};
  if(a.action==='edited'&&d.before&&d.after){
    const fields={legal_name:'Fornecedor',cpf_cnpj:'CPF/CNPJ',phone:'Telefone',city:'Cidade',state:'UF',service_type:'Serviço',service_reference:'Referência',service_date:'Data do serviço',billing_mode:'Cobrança',quantity_people:'Quantidade',unit_amount:'Valor por pessoa',amount_received:'Valor total',payment_date:'Data do recebimento',payment_method:'Pagamento',notes:'Observação'};
    const changes=[];
    Object.entries(fields).forEach(([k,label])=>{
      const before=d.before?.[k]??'',after=d.after?.[k]??'';
      if(String(before)!==String(after))changes.push('<div class="audit-change"><span>'+escapeHtml(label)+'</span><del>'+escapeHtml(k.includes('amount')||k==='unit_amount'?brl(before):String(before||'—'))+'</del><b>→</b><ins>'+escapeHtml(k.includes('amount')||k==='unit_amount'?brl(after):String(after||'—'))+'</ins></div>');
    });
    return changes.join('')||'<div class="muted">Dados administrativos atualizados.</div>';
  }
  if(a.action==='status_changed')return '<div class="audit-change"><span>Status</span><del>'+escapeHtml(statusText(d.before_status))+'</del><b>→</b><ins>'+escapeHtml(statusText(d.after_status))+'</ins></div>'+(d.notes?'<div class="muted">'+escapeHtml(d.notes)+'</div>':'');
  if(a.action==='finance_synced')return '<div class="muted">Vinculado ao passeio '+escapeHtml(d.trip_name||d.trip_id||'')+'.</div>';
  return '';
}
async function loadAudit(id){
  const box=document.getElementById('auditBox');if(!box)return;
  const {data}=await supabaseClient.from('receipt_audit_log').select('*').eq('receipt_id',id).order('created_at',{ascending:false});
  box.innerHTML='<h4>Histórico de auditoria</h4>'+((data||[]).length?(data||[]).map(a=>'<div class="audit-entry"><div class="audit-row"><strong>'+escapeHtml(auditLabel(a.action))+'</strong><span>'+dateTimeBR(a.created_at)+'</span></div>'+auditChanges(a)+'</div>').join(''):'<div class="muted">Sem histórico.</div>');
}
async function reviewReceipt(id,status,notes){
  const {error}=await supabaseClient.rpc('review_receipt',{p_receipt_id:id,p_status:status,p_notes:notes||null});
  if(error){toast(error.message,'error');return}
  await load();document.querySelector('.modal-backdrop')?.remove();toast('Status atualizado.');render();
}
function supplierHistory(doc){
  const rows=S.receipts.filter(r=>r.cpf_cnpj===doc),active=rows.filter(r=>r.accounting_status!=='cancelled'),total=active.reduce((a,b)=>a+Number(b.amount_received||0),0),name=rows[0]?.legal_name||'Fornecedor';
  modal(`<div class="modal-head"><div><h3>Histórico do fornecedor</h3><span class="muted">${escapeHtml(name)} • ${formatCpfCnpj(doc)}</span></div><button class="btn btn-secondary btn-sm" data-close>Fechar</button></div><div class="kpis compact-kpis"><div class="kpi"><span>Recibos</span><strong>${rows.length}</strong></div><div class="kpi"><span>Total válido</span><strong>${brl(total)}</strong></div></div>${tableReceipts(rows)}`);wireReceipt();
}

function supplierGroups(){
  const map=new Map();
  S.receipts.filter(r=>r.accounting_status!=='cancelled').forEach(r=>{
    const key=r.cpf_cnpj||r.legal_name;
    if(!map.has(key))map.set(key,{doc:r.cpf_cnpj,name:r.legal_name,phone:r.phone,email:r.email,city:r.city,state:r.state,count:0,total:0,last:'',types:new Set()});
    const x=map.get(key);x.count++;x.total+=Number(r.amount_received||0);x.types.add(r.service_type||'Outro');if(serviceDate(r)>x.last)x.last=serviceDate(r);
  });
  return [...map.values()].sort((a,b)=>b.total-a.total);
}
function suppliers(){
  const rows=supplierGroups();
  document.getElementById('content').innerHTML=`<div class="admin-head"><div><h2>Central de fornecedores</h2><p>Histórico consolidado por CPF/CNPJ.</p></div></div><div class="kpis compact-kpis"><div class="kpi"><span>Fornecedores</span><strong>${rows.length}</strong></div><div class="kpi"><span>Total movimentado</span><strong>${brl(rows.reduce((a,b)=>a+b.total,0))}</strong></div></div><div class="panel">${rows.length?'<div class="table-wrap"><table><thead><tr><th>Fornecedor</th><th>Contato</th><th>Serviços</th><th>Recibos</th><th>Último serviço</th><th>Total</th><th>Ação</th></tr></thead><tbody>'+rows.map(x=>'<tr><td><strong>'+escapeHtml(x.name)+'</strong><br><span class="muted">'+formatCpfCnpj(x.doc||'')+'</span></td><td>'+escapeHtml(formatPhone(x.phone||''))+'<br><span class="muted">'+escapeHtml(x.email||[x.city,x.state].filter(Boolean).join('/'))+'</span></td><td>'+escapeHtml([...x.types].slice(0,3).join(', '))+'</td><td>'+x.count+'</td><td>'+dateBR(x.last)+'</td><td class="money">'+brl(x.total)+'</td><td><button class="btn btn-secondary btn-sm" data-supplier-doc="'+escapeHtml(x.doc||'')+'">Ver histórico</button></td></tr>').join('')+'</tbody></table></div>':'<div class="empty">Nenhum fornecedor cadastrado.</div>'}</div>`;
  document.querySelectorAll('[data-supplier-doc]').forEach(b=>b.onclick=()=>supplierHistory(b.dataset.supplierDoc));
}
function documents(){
  const withDoc=S.receipts.filter(r=>r.attachment_data_url&&r.accounting_status!=='cancelled');
  const missing=S.receipts.filter(r=>!r.attachment_data_url&&r.accounting_status!=='cancelled');
  document.getElementById('content').innerHTML=`<div class="admin-head"><div><h2>Central de documentos</h2><p>Recibos, notas fiscais, NFS-e e comprovantes em um só lugar.</p></div></div><div class="kpis"><div class="kpi"><span>Com anexo</span><strong>${withDoc.length}</strong></div><div class="kpi"><span>Sem anexo</span><strong>${missing.length}</strong></div><div class="kpi"><span>Total de recibos</span><strong>${S.receipts.filter(r=>r.accounting_status!=='cancelled').length}</strong></div></div><div class="panel"><div class="panel-head"><h3>Documentos anexados</h3></div>${withDoc.length?'<div class="table-wrap"><table><thead><tr><th>Recibo</th><th>Fornecedor</th><th>Documento</th><th>Serviço</th><th>Data</th><th>Ações</th></tr></thead><tbody>'+withDoc.map(r=>'<tr><td><strong>'+escapeHtml(r.receipt_code||'—')+'</strong></td><td>'+escapeHtml(r.legal_name)+'</td><td>'+escapeHtml(r.attachment_name||'Anexo')+'</td><td>'+escapeHtml(r.service_type||'—')+'</td><td>'+dateBR(serviceDate(r))+'</td><td><div class="table-actions"><button class="btn btn-secondary btn-sm" data-open="'+r.id+'">Ver recibo</button><a class="btn btn-primary btn-sm" href="'+r.attachment_data_url+'" download="'+escapeHtml(r.attachment_name||'documento')+'">Baixar anexo</a></div></td></tr>').join('')+'</tbody></table></div>':'<div class="empty">Nenhum documento anexado ainda.</div>'}</div><div class="panel"><div class="panel-head"><h3>Recibos sem documento fiscal/comprovante</h3><span class="badge warn">${missing.length}</span></div>${tableReceipts(missing.slice(0,100))}</div>`;
  wireReceipt();
}

function monthly(){
  const now=new Date(),years=[...new Set([now.getFullYear(),...S.receipts.map(r=>Number((serviceDate(r)||'0000').slice(0,4))).filter(Boolean),...S.closures.map(c=>Number(c.year)).filter(Boolean)])].sort((a,b)=>b-a);
  document.getElementById('content').innerHTML=`<div class="admin-head"><div><h2>Fechamento mensal</h2><p>Ao fechar uma competência, recibos daquele mês ficam bloqueados para envio, edição, exclusão e mudança de status até a reabertura pelo Administrador.</p></div></div><div class="toolbar"><div class="field"><label>Mês</label><select id="cm">${Array.from({length:12},(_,i)=>'<option value="'+(i+1)+'" '+(i===now.getMonth()?'selected':'')+'>'+new Date(2020,i).toLocaleDateString('pt-BR',{month:'long'})+'</option>').join('')}</select></div><div class="field"><label>Ano</label><select id="cy">${years.map(y=>'<option '+(y===now.getFullYear()?'selected':'')+'>'+y+'</option>').join('')}</select></div></div><div id="monthSummary"></div><div class="panel"><h3>Histórico de competências</h3>${S.closures.length?'<div class="table-wrap"><table><thead><tr><th>Competência</th><th>Status</th><th>Recibos</th><th>Total</th><th>Última ação</th></tr></thead><tbody>'+S.closures.map(c=>'<tr><td>'+String(c.month).padStart(2,'0')+'/'+c.year+'</td><td><span class="badge '+(c.is_closed?'locked':'success')+'">'+(c.is_closed?'Fechado':'Reaberto')+'</span></td><td>'+c.receipt_count+'</td><td>'+brl(c.total_amount)+'</td><td>'+dateTimeBR(c.is_closed?c.closed_at:c.reopened_at)+'</td></tr>').join('')+'</tbody></table></div>':'<div class="empty">Nenhuma competência fechada.</div>'}</div>`;
  document.getElementById('cm').onchange=renderMonthSummary;document.getElementById('cy').onchange=renderMonthSummary;renderMonthSummary();
}
function monthRows(y,m){return S.receipts.filter(r=>{const d=serviceDate(r);return Number(d.slice(0,4))===y&&Number(d.slice(5,7))===m&&r.accounting_status!=='cancelled'})}
function renderMonthSummary(){
  const y=Number(document.getElementById('cy').value),m=Number(document.getElementById('cm').value),rows=monthRows(y,m),sum=rows.reduce((a,b)=>a+Number(b.amount_received||0),0),reviewed=rows.filter(r=>r.accounting_status==='reviewed').length,pending=rows.filter(r=>(r.accounting_status||'pending_review')==='pending_review'||r.accounting_status==='pending_issue').length,closure=closureFor(y,m),closed=closure?.is_closed===true;
  document.getElementById('monthSummary').innerHTML=`<div class="month-lock-banner ${closed?'closed':'open'}"><strong>${closed?'🔒 Competência fechada':'🔓 Competência aberta'}</strong><span>${closed?'Alterações estão bloqueadas até o Administrador reabrir este mês.':'Revise os recibos antes de fechar. O fechamento só é permitido sem pendências.'}</span></div><div class="kpis"><div class="kpi"><span>Recibos</span><strong>${rows.length}</strong></div><div class="kpi"><span>Total</span><strong>${brl(sum)}</strong></div><div class="kpi"><span>Conferidos</span><strong>${reviewed}</strong></div><div class="kpi"><span>Pendentes</span><strong>${pending}</strong></div></div><div class="panel"><div class="actions inline-actions"><button class="btn btn-secondary" id="monthPdf">Gerar relatório PDF</button><button class="btn btn-secondary" id="monthBackup">Backup do mês</button><button class="btn btn-secondary" id="yearBackup">Backup do ano</button>${S.profile.role==='admin'?(closed?'<button class="btn btn-primary" id="reopenMonth">Reabrir mês</button>':'<button class="btn btn-primary" id="closeMonth" '+(pending?'disabled':'')+'>Fechar mês</button>'):''}</div>${pending&&!closed?'<div class="notice info">Antes de fechar, confira ou resolva os '+pending+' recibo(s) pendente(s).</div>':''}<div style="height:12px"></div>${tableReceipts(rows)}</div>`;
  document.getElementById('monthPdf').onclick=()=>generateMonthlyPDF(rows,y,m);
  document.getElementById('monthBackup').onclick=()=>backupPeriod(rows,y+'_'+String(m).padStart(2,'0'));
  document.getElementById('yearBackup').onclick=()=>backupPeriod(S.receipts.filter(r=>Number(serviceDate(r).slice(0,4))===y&&r.accounting_status!=='cancelled'),String(y));
  document.getElementById('closeMonth')?.addEventListener('click',()=>closeMonth(y,m));
  document.getElementById('reopenMonth')?.addEventListener('click',()=>reopenMonth(y,m));
  wireReceipt();
}
async function closeMonth(y,m){
  const {error}=await supabaseClient.rpc('close_receipt_month',{p_year:y,p_month:m,p_notes:null});
  if(error){toast(error.message,'error');return}
  await load();toast('Competência fechada e bloqueada.');monthly();
}
async function reopenMonth(y,m){
  if(!confirm('Reabrir esta competência? Os recibos voltarão a permitir alterações administrativas.'))return;
  const {error}=await supabaseClient.rpc('reopen_receipt_month',{p_year:y,p_month:m});
  if(error){toast(error.message,'error');return}
  await load();toast('Competência reaberta.');monthly();
}
function generateMonthlyPDF(rows,y,m){
  const {jsPDF}=window.jspdf,d=new jsPDF({unit:'mm',format:'a4'}),M=14,W=182;
  d.setFillColor(16,43,28);d.rect(0,0,210,28,'F');d.setTextColor(255);d.setFont('helvetica','bold');d.setFontSize(15);d.text(S.settings.business_name||'Trilheiros de Rondonópolis',M,12);d.setFontSize(9);d.setFont('helvetica','normal');d.text('RELATÓRIO MENSAL DE RECIBOS • '+String(m).padStart(2,'0')+'/'+y,M,20);
  const sum=rows.reduce((a,b)=>a+Number(b.amount_received||0),0);let yy=38;
  d.setTextColor(30);d.setFont('helvetica','bold');d.setFontSize(13);d.text(rows.length+' recibo(s) • '+brl(sum),M,yy);yy+=10;
  const byType={};rows.forEach(r=>byType[r.service_type]=(byType[r.service_type]||0)+Number(r.amount_received||0));
  d.setFontSize(10);Object.entries(byType).sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>{if(yy>276){d.addPage();yy=18}d.setFont('helvetica','normal');d.text(k,M,yy);d.setFont('helvetica','bold');d.text(brl(v),196,yy,{align:'right'});yy+=6});yy+=4;
  d.setDrawColor(220);d.line(M,yy,196,yy);yy+=8;
  rows.forEach(r=>{if(yy>272){d.addPage();yy=18}d.setFont('helvetica','bold');d.setFontSize(9);d.setTextColor(35);d.text((r.receipt_code||'—')+' • '+r.legal_name,M,yy);d.setFont('helvetica','normal');d.setFontSize(8);d.setTextColor(90);d.text(dateBR(serviceDate(r))+' • '+(r.service_type||'—')+' • '+brl(r.amount_received),M,yy+5);yy+=12});
  d.save('relatorio_recibos_'+y+'_'+String(m).padStart(2,'0')+'.pdf');
}


function dataUrlToBlob(dataUrl){
  const parts=String(dataUrl||'').split(','),meta=parts[0]||'',raw=atob(parts[1]||''),mime=(meta.match(/data:([^;]+)/)||[])[1]||'application/octet-stream',arr=new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i++)arr[i]=raw.charCodeAt(i);
  return new Blob([arr],{type:mime});
}
async function backupPeriod(rows,label){
  if(!window.JSZip){toast('Biblioteca de backup não carregou. Atualize a página.','error');return}
  const btn=document.getElementById('monthBackup');if(btn){btn.disabled=true;btn.textContent='Gerando backup...'}
  try{
    const zip=new JSZip();
    const head=['Recibo','Status','Data do serviço','Fornecedor','CPF/CNPJ','Tipo de serviço','Referência','Valor','Pagamento','Validação','Anexo'];
    const body=rows.map(r=>[r.receipt_code,statusText(r.accounting_status),dateBR(serviceDate(r)),r.legal_name,formatCpfCnpj(r.cpf_cnpj),r.service_type,r.service_reference||'',Number(r.amount_received).toFixed(2).replace('.',','),r.payment_method,r.verification_code,r.attachment_name||'']);
    const csv='\ufeff'+[head,...body].map(row=>row.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(';')).join('\n');
    zip.file('recibos_'+label+'.csv',csv);
    const pdfs=zip.folder('pdfs'),attachments=zip.folder('anexos');
    for(const r of rows){
      const doc=await generateReceiptPDF(r,null,S.settings,'blob');
      pdfs.file('recibo_'+String(r.receipt_code||r.id)+'.pdf',doc.output('blob'));
      if(r.attachment_data_url&&r.attachment_name){
        try{attachments.file(String(r.receipt_code||r.id)+'_'+r.attachment_name.replace(/[\\/:*?"<>|]/g,'_'),dataUrlToBlob(r.attachment_data_url))}catch(e){console.warn('Anexo no backup',e)}
      }
    }
    const blob=await zip.generateAsync({type:'blob'}),a=document.createElement('a');
    a.href=URL.createObjectURL(blob);a.download='backup_recibos_'+label+'.zip';a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),30000);toast('Backup completo gerado.');
  }catch(e){console.error(e);toast('Não foi possível gerar o backup.','error')}
  finally{if(btn){btn.disabled=false;btn.textContent='Backup do mês'}}
}
function trash(){
  if(S.profile.role!=='admin'){S.view='dashboard';render();return}
  document.getElementById('content').innerHTML=`<div class="admin-head"><div><h2>Lixeira</h2><p>Recibos excluídos ficam preservados aqui e podem ser restaurados.</p></div></div><div class="panel">${S.deleted.length?'<div class="table-wrap"><table><thead><tr><th>Recibo</th><th>Fornecedor</th><th>Serviço</th><th>Data</th><th>Valor</th><th>Excluído em</th><th>Ação</th></tr></thead><tbody>'+S.deleted.map(x=>'<tr><td><strong>'+escapeHtml(x.receipt_code||'—')+'</strong></td><td>'+escapeHtml(x.legal_name||'—')+'<br><span class="muted">'+formatCpfCnpj(x.cpf_cnpj||'')+'</span></td><td>'+escapeHtml(x.service_type||'—')+'</td><td>'+dateBR(x.service_date)+'</td><td>'+brl(x.amount_received)+'</td><td>'+dateTimeBR(x.deleted_at)+'</td><td><button class="btn btn-primary btn-sm" data-restore="'+x.id+'">Restaurar</button></td></tr>').join('')+'</tbody></table></div>':'<div class="empty">A lixeira está vazia.</div>'}</div>`;
  document.querySelectorAll('[data-restore]').forEach(b=>b.onclick=()=>restoreDeleted(b.dataset.restore));
}
async function restoreDeleted(id){
  const {error}=await supabaseClient.rpc('restore_deleted_receipt',{p_deleted_id:id});
  if(error){toast(error.message,'error');return}
  await load();toast('Recibo restaurado.');trash();
}

function serviceTypesPanel(){
  if(S.profile.role!=='admin')return'';
  return `<div class="panel" style="margin-top:18px"><div class="panel-head"><div><h3>Tipos de serviço</h3><p class="muted">Controle os campos e a forma de cobrança sugerida no formulário público.</p></div><button class="btn btn-primary btn-sm" id="newServiceType">Novo tipo</button></div><div class="table-wrap"><table><thead><tr><th>Serviço</th><th>Referência</th><th>Cobrança padrão</th><th>Status</th><th>Ação</th></tr></thead><tbody>${S.serviceTypes.map(x=>'<tr><td><strong>'+escapeHtml(x.name)+'</strong></td><td>'+escapeHtml(x.reference_label||'—')+(x.reference_required?' <span class="badge warn">Obrigatório</span>':'')+'</td><td>'+(x.default_billing==='per_person'?'Por pessoa':'Total')+'</td><td><span class="badge '+(x.active?'success':'cancelled')+'">'+(x.active?'Ativo':'Inativo')+'</span></td><td><button class="btn btn-secondary btn-sm" data-service-edit="'+x.id+'">Editar</button></td></tr>').join('')}</tbody></table></div></div>`;
}
function wireServiceTypes(){
  document.getElementById('newServiceType')?.addEventListener('click',()=>editServiceType(null));
  document.querySelectorAll('[data-service-edit]').forEach(b=>b.onclick=()=>editServiceType(b.dataset.serviceEdit));
}
function editServiceType(id){
  const x=id?S.serviceTypes.find(v=>v.id===id):{name:'',reference_label:'',reference_placeholder:'',reference_required:false,default_billing:'total',active:true,sort_order:100};
  modal(`<div class="modal-head"><div><h3>${id?'Editar':'Novo'} tipo de serviço</h3><span class="muted">Isso altera o formulário dos fornecedores.</span></div><button class="btn btn-secondary btn-sm" data-close>Fechar</button></div><form id="serviceTypeForm"><div class="grid"><div class="field full"><label class="required">Nome do serviço</label><input name="name" required value="${escapeHtml(x.name||'')}"></div><div class="field full"><label>Campo de referência</label><input name="reference_label" value="${escapeHtml(x.reference_label||'')}" placeholder="Ex.: Nome do hotel"></div><div class="field full"><label>Exemplo / placeholder</label><input name="reference_placeholder" value="${escapeHtml(x.reference_placeholder||'')}"></div><div class="field"><label>Cobrança padrão</label><select name="default_billing"><option value="total" ${x.default_billing==='total'?'selected':''}>Valor total</option><option value="per_person" ${x.default_billing==='per_person'?'selected':''}>Valor por pessoa</option></select></div><div class="field"><label>Ordem</label><input name="sort_order" type="number" value="${x.sort_order||100}"></div><div class="checkbox"><input id="refRequired" name="reference_required" type="checkbox" ${x.reference_required?'checked':''}><label for="refRequired">Referência obrigatória</label></div><div class="checkbox"><input id="serviceActive" name="active" type="checkbox" ${x.active?'checked':''}><label for="serviceActive">Serviço ativo</label></div></div><div id="serviceErr" class="notice error hidden"></div><div class="actions"><button class="btn btn-primary">Salvar serviço</button></div></form>`);
  const f=document.getElementById('serviceTypeForm');
  f.onsubmit=async e=>{
    e.preventDefault();const btn=f.querySelector('.btn-primary');btn.disabled=true;btn.textContent='Salvando...';
    const {error}=await supabaseClient.rpc('upsert_service_type',{p_id:id||null,p_name:f.name.value.trim(),p_reference_label:f.reference_label.value.trim(),p_reference_placeholder:f.reference_placeholder.value.trim(),p_reference_required:f.reference_required.checked,p_default_billing:f.default_billing.value,p_active:f.active.checked,p_sort_order:Number(f.sort_order.value||100)});
    if(error){document.getElementById('serviceErr').textContent=error.message;document.getElementById('serviceErr').classList.remove('hidden');btn.disabled=false;btn.textContent='Salvar serviço';return}
    await load();document.querySelector('.modal-backdrop')?.remove();toast('Tipo de serviço salvo.');settings();
  };
}

function settings(){
  if(S.profile.role!=='admin'){S.view='dashboard';render();return}
  const x=S.settings||{};
  const methods=Array.isArray(x.payment_methods)?x.payment_methods.join('\n'):'PIX\nTransferência bancária\nDinheiro\nCartão\nBoleto\nOutro';
  document.getElementById('content').innerHTML=`
  <div class="admin-head"><div><h2>Configurações</h2><p>Personalize o sistema sem alterar código.</p></div></div>
  <form id="set" class="panel">
    <div class="panel-head"><div><h3>Identidade e dados do contratante</h3><p class="muted">Usados no formulário, PDFs e validações.</p></div></div>
    <div class="grid">
      <div class="field full"><label class="required">Nome / Razão social</label><input name="business_name" required value="${escapeHtml(x.business_name||'Trilheiros de Rondonópolis')}"></div>
      <div class="field full"><label>URL da logo</label><input name="logo_url" value="${escapeHtml(x.logo_url||'https://i.postimg.cc/09t8GNX6/LOGO-TRILHEIROS-Photoroom.png')}" placeholder="https://..."></div>
      <div class="field"><label>CNPJ</label><input name="cnpj" value="${escapeHtml(x.cnpj||'')}"></div>
      <div class="field"><label>WhatsApp</label><input name="whatsapp_number" value="${escapeHtml(x.whatsapp_number||x.phone||'5566996926174')}"></div>
      <div class="field"><label>Telefone</label><input name="phone" value="${escapeHtml(x.phone||'')}"></div>
      <div class="field"><label>E-mail</label><input name="email" type="email" value="${escapeHtml(x.email||'')}"></div>
      <div class="field full"><label>Endereço</label><input name="address" value="${escapeHtml(x.address||'')}"></div>
      <div class="field"><label>Cidade</label><input name="city" value="${escapeHtml(x.city||'Rondonópolis')}"></div>
      <div class="field"><label>UF</label><input name="state" maxlength="2" value="${escapeHtml(x.state||'MT')}"></div>
      <div class="field full"><label>Formas de pagamento</label><textarea name="payment_methods" rows="6">${escapeHtml(methods)}</textarea><div class="help">Uma forma de pagamento por linha.</div></div>
      <div class="field full"><label>Texto da declaração do fornecedor</label><textarea name="declaration_text" rows="4">${escapeHtml(x.declaration_text||'Declaro que as informações são verdadeiras e que recebi o valor informado pelo serviço registrado neste recibo.')}</textarea></div>
      <div class="field full"><label>Rodapé dos PDFs</label><textarea name="receipt_footer" rows="3">${escapeHtml(x.receipt_footer||'Documento eletrônico emitido pelo sistema de Gestão de Recibos dos Trilheiros de Rondonópolis.')}</textarea></div>
    </div>
    <div class="actions"><button class="btn btn-primary">Salvar configurações</button></div>
  </form>
  <div id="usersPanel" class="panel" style="margin-top:18px"><div class="panel-head"><div><h3>Usuários e acessos</h3><p class="muted">Administrador e Contabilidade.</p></div><button class="btn btn-primary btn-sm" id="newAccountingInvite">Novo acesso da contadora</button></div><div class="empty">Carregando usuários...</div></div>
  ${serviceTypesPanel()}`;
  document.getElementById('set').onsubmit=saveSettings;
  document.getElementById('newAccountingInvite').onclick=generateAccountingInvite;
  wireServiceTypes();
  loadUsersPanel();
}
async function saveSettings(e){
  e.preventDefault();
  const f=e.currentTarget,btn=f.querySelector('.btn-primary');
  const paymentMethods=f.payment_methods.value.split(/\n|,/).map(x=>x.trim()).filter(Boolean);
  if(!paymentMethods.length){toast('Informe pelo menos uma forma de pagamento.','error');return}
  const p={
    business_name:f.business_name.value.trim(),
    logo_url:f.logo_url.value.trim(),
    cnpj:formatCpfCnpj(f.cnpj.value),
    whatsapp_number:onlyDigits(f.whatsapp_number.value),
    phone:f.phone.value.trim(),
    address:f.address.value.trim(),
    city:f.city.value.trim(),
    state:f.state.value.toUpperCase(),
    email:f.email.value.trim(),
    payment_methods:paymentMethods,
    declaration_text:f.declaration_text.value.trim(),
    receipt_footer:f.receipt_footer.value.trim(),
    updated_at:new Date().toISOString()
  };
  btn.disabled=true;btn.textContent='Salvando...';
  const {error}=await supabaseClient.from('app_settings').update(p).eq('id',1);
  if(error)toast(error.message,'error');
  else{await load();toast('Configurações salvas.');settings()}
  if(document.body.contains(btn)){btn.disabled=false;btn.textContent='Salvar configurações'}
}
async function loadUsersPanel(){
  const box=document.getElementById('usersPanel');if(!box)return;
  const {data,error}=await supabaseClient.rpc('list_receipt_users');
  if(error){box.insertAdjacentHTML('beforeend','<div class="notice error">'+escapeHtml(error.message)+'</div>');return}
  S.users=data||[];
  const table=S.users.length?'<div class="table-wrap"><table><thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Status</th><th>Ação</th></tr></thead><tbody>'+S.users.map(u=>'<tr><td><strong>'+escapeHtml(u.display_name||'Usuário')+'</strong></td><td>'+escapeHtml(u.email||'—')+'</td><td>'+escapeHtml(roleName(u.role))+'</td><td><span class="badge '+(u.active?'success':'cancelled')+'">'+(u.active?'Ativo':'Desativado')+'</span></td><td>'+(u.id===S.profile.id?'<span class="muted">Seu acesso</span>':'<button class="btn btn-secondary btn-sm" data-user-toggle="'+u.id+'" data-active="'+String(!u.active)+'">'+(u.active?'Desativar':'Reativar')+'</button>')+'</td></tr>').join('')+'</tbody></table></div>':'<div class="empty">Nenhum usuário encontrado.</div>';
  box.querySelector('.empty')?.remove();
  box.querySelector('.table-wrap')?.remove();
  box.insertAdjacentHTML('beforeend',table);
  box.querySelectorAll('[data-user-toggle]').forEach(b=>b.onclick=()=>toggleReceiptUser(b.dataset.userToggle,b.dataset.active==='true'));
}
async function toggleReceiptUser(id,active){
  const action=active?'reativar':'desativar';
  if(!confirm('Deseja '+action+' este acesso?'))return;
  const {error}=await supabaseClient.rpc('set_receipt_user_active',{p_user_id:id,p_active:active});
  if(error){toast(error.message,'error');return}
  toast('Acesso '+(active?'reativado':'desativado')+'.');
  loadUsersPanel();
}
async function generateAccountingInvite(){
  const {data,error}=await supabaseClient.rpc('create_accounting_invite');
  if(error){toast(error.message,'error');return}
  const x=data?.[0];if(!x?.code){toast('Não foi possível gerar o código.','error');return}
  const setup=new URL('setup.html',location.href).href;
  modal(`<div class="modal-head"><div><h3>Novo primeiro acesso da Contabilidade</h3><span class="muted">O código é de uso único e expira em 30 dias.</span></div><button class="btn btn-secondary btn-sm" data-close>Fechar</button></div><div class="notice success">Envie o link e o código abaixo somente para a pessoa autorizada.</div><div class="field"><label>Link de primeiro acesso</label><textarea id="inviteLink" readonly rows="2">${escapeHtml(setup)}</textarea></div><div class="field"><label>Código de autorização</label><input id="inviteCode" readonly value="${escapeHtml(x.code)}"></div><div class="actions"><button class="btn btn-secondary" id="copyInviteLink">Copiar link</button><button class="btn btn-primary" id="copyInviteCode">Copiar código</button></div>`);
  const linkField=document.getElementById('inviteLink'),codeField=document.getElementById('inviteCode');
  document.getElementById('copyInviteLink').onclick=e=>copyText(setup,e.currentTarget,linkField);
  document.getElementById('copyInviteCode').onclick=e=>copyText(x.code,e.currentTarget,codeField);
}
function modal(html){const el=document.createElement('div');el.className='modal-backdrop';el.innerHTML='<div class="modal">'+html+'</div>';document.body.appendChild(el);el.onclick=e=>{if(e.target===el||e.target.closest('[data-close]'))el.remove()}}
function exportCSV(){
  const rows=filtered(),head=['Recibo','Status','Data do serviço','Fornecedor','CPF/CNPJ','Tipo de serviço','Valor','Pagamento'];
  const body=rows.map(r=>[r.receipt_code,statusText(r.accounting_status),dateBR(serviceDate(r)),r.legal_name,formatCpfCnpj(r.cpf_cnpj),r.service_type,Number(r.amount_received).toFixed(2).replace('.',','),r.payment_method]);
  const csv='\ufeff'+[head,...body].map(row=>row.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(';')).join('\n'),a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='recibos_trilheiros.csv';a.click();
}
boot();
})();