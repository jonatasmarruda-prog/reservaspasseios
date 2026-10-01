(()=>{
const {supabaseClient}=window.ReceiptsApp;
const root=document.getElementById('root');
let S={profile:null,settings:{},receipts:[],closures:[],view:'dashboard'};

function roleName(r){return r==='admin'?'Administrador':'Contabilidade'}
function withTimeout(promise,ms=8000){return Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(new Error('timeout')),ms))])}
function statusText(s){return ({pending_review:'Não conferido',reviewed:'Conferido',pending_issue:'Com pendência',cancelled:'Cancelado'})[s]||'Não conferido'}
function statusClass(s){return ({pending_review:'pending',reviewed:'success',pending_issue:'warn',cancelled:'cancelled'})[s]||'pending'}
function localISO(d){const x=new Date(d.getTime()-d.getTimezoneOffset()*60000);return x.toISOString().slice(0,10)}
function serviceDate(r){return r.service_date||r.payment_date||''}
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
  const [a,b,c]=await Promise.all([
    withTimeout(supabaseClient.from('app_settings').select('*').eq('id',1).single(),8000),
    withTimeout(supabaseClient.from('receipts').select('*').order('created_at',{ascending:false}),8000),
    withTimeout(supabaseClient.from('monthly_closures').select('*').order('year',{ascending:false}).order('month',{ascending:false}),8000)
  ]);
  S.settings=a.data||{};
  S.receipts=b.data||[];
  S.closures=c.data||[];
}
function shell(){
  root.innerHTML=`<div class="admin-shell"><aside class="sidebar"><div class="brand"><img class="brand-logo" src="https://i.postimg.cc/09t8GNX6/LOGO-TRILHEIROS-Photoroom.png" alt="Logo Trilheiros"><div><h1>Trilheiros</h1><small>Gestão de Recibos</small></div></div><nav class="nav"><button data-v="dashboard">Visão geral</button><button data-v="receipts">Recibos</button><button data-v="monthly">Fechamento mensal</button>${S.profile.role==='admin'?'<button data-v="settings">Configurações</button>':''}</nav><div class="sidebar-foot"><div class="user"><strong>${escapeHtml(S.profile.display_name)}</strong><br><span style="color:#bfd3c5">${roleName(S.profile.role)}</span></div><button id="logout" class="btn btn-secondary btn-sm" style="width:100%;margin-top:9px">Sair</button></div></aside><main class="admin-main"><div id="content"></div></main></div>`;
  root.querySelectorAll('[data-v]').forEach(b=>b.onclick=()=>{S.view=b.dataset.v;render()});
  document.getElementById('logout').onclick=async()=>{await supabaseClient.auth.signOut();location.reload()};
  render();
}
function render(){
  root.querySelectorAll('[data-v]').forEach(b=>b.classList.toggle('active',b.dataset.v===S.view));
  ({dashboard,receipts,monthly,settings}[S.view]||dashboard)();
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
  <div class="kpis"><div class="kpi"><span>Recibos no mês</span><strong>${month.length}</strong></div><div class="kpi"><span>Valor no mês</span><strong>${brl(total)}</strong></div><div class="kpi"><span>Não conferidos</span><strong>${pending}</strong></div><div class="kpi"><span>Com pendência</span><strong>${issue}</strong></div></div>
  <div class="dashboard-grid"><div class="panel"><h3>Por tipo de serviço</h3>${types.length?types.map(([k,v])=>'<div class="metric-row"><span>'+escapeHtml(k)+'</span><strong>'+brl(v)+'</strong></div>').join(''):'<div class="empty">Sem dados no mês.</div>'}</div>
  <div class="panel"><h3>Principais fornecedores</h3>${tops.length?tops.map(x=>'<div class="metric-row"><span>'+escapeHtml(x.name)+' <small>('+x.count+')</small></span><strong>'+brl(x.total)+'</strong></div>').join(''):'<div class="empty">Sem dados no mês.</div>'}</div></div>
  <div class="panel"><div class="panel-head"><h3>Últimos recibos</h3><button class="btn btn-secondary btn-sm" id="goReceipts">Ver todos</button></div>${tableReceipts(S.receipts.slice(0,8))}</div>`;
  document.getElementById('publicLinkBtn').onclick=showPublicLink;
  document.getElementById('goReceipts').onclick=()=>{S.view='receipts';render()};
  wireReceipt();
}
function tableReceipts(rows){
  if(!rows.length)return'<div class="empty">Nenhum recibo encontrado.</div>';
  return '<div class="table-wrap"><table><thead><tr><th>Recibo</th><th>Fornecedor</th><th>Serviço</th><th>Data</th><th>Valor</th><th>Status</th><th>Ações</th></tr></thead><tbody>'+
  rows.map(r=>`<tr><td><strong>${escapeHtml(r.receipt_code||'—')}</strong></td><td><button class="supplier-link" data-history="${escapeHtml(r.cpf_cnpj)}">${escapeHtml(r.legal_name)}</button><br><span class="muted">${formatCpfCnpj(r.cpf_cnpj)}</span></td><td>${escapeHtml(r.service_type||'—')}</td><td>${dateBR(serviceDate(r))}</td><td class="money">${brl(r.amount_received)}</td><td><span class="badge ${statusClass(r.accounting_status)}">${statusText(r.accounting_status)}</span></td><td><div class="table-actions"><button class="btn btn-secondary btn-sm" data-open="${r.id}">Abrir</button><button class="btn btn-primary btn-sm" data-pdf="${r.id}">PDF</button></div></td></tr>`).join('')+
  '</tbody></table></div>';
}
function wireReceipt(){
  document.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>openReceipt(b.dataset.open));
  document.querySelectorAll('[data-pdf]').forEach(b=>b.onclick=()=>{const r=S.receipts.find(x=>x.id===b.dataset.pdf);if(r)generateReceiptPDF(r,null,S.settings)});
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
  <div class="toolbar"><div class="field"><label>Tipo de serviço</label><select id="ft"><option value="">Todos</option>${types.map(t=>'<option value="'+escapeHtml(t)+'">'+escapeHtml(t)+'</option>').join('')}</select></div><div class="field"><label>Status</label><select id="fs"><option value="">Todos</option><option value="pending_review">Não conferido</option><option value="reviewed">Conferido</option><option value="pending_issue">Com pendência</option><option value="cancelled">Cancelado</option></select></div><div class="field"><label>Data inicial</label><input id="fd1" type="date"></div><div class="field"><label>Data final</label><input id="fd2" type="date"></div><div class="field search"><label>Buscar</label><input id="fq" placeholder="Fornecedor, CPF/CNPJ, serviço..."></div></div><div id="list"></div>`;
  ['ft','fs','fd1','fd2'].forEach(id=>document.getElementById(id).onchange=filterReceipts);
  document.getElementById('fq').oninput=filterReceipts;
  document.getElementById('csv').onclick=exportCSV;
  document.getElementById('publicLinkBtn').onclick=showPublicLink;
  document.querySelectorAll('[data-range]').forEach(b=>b.onclick=()=>setQuickRange(b.dataset.range));
  setQuickRange('month');
}
function filtered(){
  const type=document.getElementById('ft')?.value||'',status=document.getElementById('fs')?.value||'',start=document.getElementById('fd1')?.value||'',end=document.getElementById('fd2')?.value||'',q=(document.getElementById('fq')?.value||'').toLowerCase().trim();
  return S.receipts.filter(r=>{const d=serviceDate(r),hay=(r.legal_name+' '+r.cpf_cnpj+' '+(r.service_type||'')+' '+(r.receipt_code||'')).toLowerCase();return(!type||r.service_type===type)&&(!status||(r.accounting_status||'pending_review')===status)&&(!start||d>=start)&&(!end||d<=end)&&(!q||hay.includes(q))});
}
function filterReceipts(){const rows=filtered(),sum=rows.filter(r=>r.accounting_status!=='cancelled').reduce((a,b)=>a+Number(b.amount_received||0),0);document.getElementById('list').innerHTML='<div class="panel"><strong>'+rows.length+' recibo(s) • '+brl(sum)+'</strong><div style="height:12px"></div>'+tableReceipts(rows)+'</div>';wireReceipt()}
async function openReceipt(id){
  const r=S.receipts.find(x=>x.id===id);if(!r)return;
  const address=[r.address,r.address_number,r.neighborhood,r.complement,r.city,r.state].filter(Boolean).join(', ');
  modal(`<div class="modal-head"><div><h3>Recibo ${escapeHtml(r.receipt_code||'—')}</h3><span class="muted">Validação: ${escapeHtml(r.verification_code||'—')}</span></div><button class="btn btn-secondary btn-sm" data-close>Fechar</button></div>
  <div class="receipt-status-bar"><span class="badge ${statusClass(r.accounting_status)}">${statusText(r.accounting_status)}</span><span class="muted">Registrado em ${dateTimeBR(r.created_at)}</span></div>
  <div class="receipt-view-section"><h4>Fornecedor</h4><div class="detail-grid"><div class="detail"><span>Nome / Empresa</span><strong>${escapeHtml(r.legal_name)}</strong></div><div class="detail"><span>CPF/CNPJ</span><strong>${formatCpfCnpj(r.cpf_cnpj)}</strong></div><div class="detail"><span>Telefone</span><strong>${formatPhone(r.phone)}</strong></div><div class="detail"><span>E-mail</span><strong>${escapeHtml(r.email||'Não informado')}</strong></div><div class="detail detail-full"><span>Endereço</span><strong>${escapeHtml(address||'—')}</strong></div></div></div>
  <div class="receipt-view-section"><h4>Serviço e pagamento</h4><div class="detail-grid"><div class="detail"><span>Tipo de serviço</span><strong>${escapeHtml(r.service_type||'—')}</strong></div><div class="detail"><span>Data do serviço</span><strong>${dateBR(serviceDate(r))}</strong></div><div class="detail detail-full"><span>Descrição</span><strong>${escapeHtml(r.service_description||'—')}</strong></div><div class="detail"><span>Valor recebido</span><strong>${brl(r.amount_received)}</strong></div><div class="detail"><span>Recebimento</span><strong>${dateBR(r.payment_date)}</strong></div><div class="detail"><span>Forma</span><strong>${escapeHtml(r.payment_method||'—')}</strong></div><div class="detail"><span>Assinado por</span><strong>${escapeHtml(r.declarant_name||r.legal_name)}</strong></div>${r.notes?'<div class="detail detail-full"><span>Observação</span><strong>'+escapeHtml(r.notes)+'</strong></div>':''}</div></div>
  ${r.attachment_data_url?'<div class="receipt-view-section"><h4>Anexo</h4><a class="btn btn-secondary" href="'+r.attachment_data_url+'" download="'+escapeHtml(r.attachment_name||'anexo')+'">Baixar '+escapeHtml(r.attachment_name||'anexo')+'</a></div>':''}
  <div class="receipt-view-section"><h4>Assinatura</h4><img class="signature-preview premium-signature-preview" src="${r.signature_data_url}"></div>
  <div class="receipt-view-section"><h4>Conferência contábil</h4><div class="field"><label>Observação da conferência</label><textarea id="reviewNotes" placeholder="Opcional">${escapeHtml(r.review_notes||'')}</textarea></div><div class="actions review-actions"><button class="btn btn-secondary" data-review="pending_review">Não conferido</button><button class="btn btn-primary" data-review="reviewed">Conferido</button><button class="btn btn-secondary" data-review="pending_issue">Com pendência</button>${S.profile.role==='admin'?'<button class="btn btn-danger" data-review="cancelled">Cancelar</button>':''}</div></div>
  <div id="auditBox" class="receipt-view-section"><h4>Histórico</h4><div class="muted">Carregando...</div></div>
  <div class="actions"><button class="btn btn-secondary" id="validateNow">Validar documento</button><button class="btn btn-primary" id="pdfNow">Baixar PDF premium</button></div>`);
  document.getElementById('pdfNow').onclick=()=>generateReceiptPDF(r,null,S.settings);
  document.getElementById('validateNow').onclick=()=>window.open(validationLink(r),'_blank','noopener');
  document.querySelectorAll('[data-review]').forEach(b=>b.onclick=()=>reviewReceipt(r.id,b.dataset.review,document.getElementById('reviewNotes').value));
  loadAudit(r.id);
}
async function loadAudit(id){
  const box=document.getElementById('auditBox');if(!box)return;
  const {data}=await supabaseClient.from('receipt_audit_log').select('*').eq('receipt_id',id).order('created_at',{ascending:false});
  box.innerHTML='<h4>Histórico</h4>'+((data||[]).length?(data||[]).map(a=>'<div class="audit-row"><strong>'+escapeHtml(a.action==='submitted'?'Recibo enviado':'Status atualizado')+'</strong><span>'+dateTimeBR(a.created_at)+'</span></div>').join(''):'<div class="muted">Sem histórico.</div>');
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
function monthly(){
  const now=new Date(),years=[...new Set([now.getFullYear(),...S.receipts.map(r=>Number((serviceDate(r)||'0000').slice(0,4))).filter(Boolean)])].sort((a,b)=>b-a);
  document.getElementById('content').innerHTML=`<div class="admin-head"><div><h2>Fechamento mensal</h2><p>Consolide os recibos por competência.</p></div></div><div class="toolbar"><div class="field"><label>Mês</label><select id="cm">${Array.from({length:12},(_,i)=>'<option value="'+(i+1)+'" '+(i===now.getMonth()?'selected':'')+'>'+new Date(2020,i).toLocaleDateString('pt-BR',{month:'long'})+'</option>').join('')}</select></div><div class="field"><label>Ano</label><select id="cy">${years.map(y=>'<option '+(y===now.getFullYear()?'selected':'')+'>'+y+'</option>').join('')}</select></div></div><div id="monthSummary"></div><div class="panel"><h3>Fechamentos registrados</h3>${S.closures.length?'<div class="table-wrap"><table><thead><tr><th>Competência</th><th>Recibos</th><th>Total</th><th>Fechado em</th></tr></thead><tbody>'+S.closures.map(c=>'<tr><td>'+String(c.month).padStart(2,'0')+'/'+c.year+'</td><td>'+c.receipt_count+'</td><td>'+brl(c.total_amount)+'</td><td>'+dateTimeBR(c.closed_at)+'</td></tr>').join('')+'</tbody></table></div>':'<div class="empty">Nenhum mês fechado.</div>'}</div>`;
  document.getElementById('cm').onchange=renderMonthSummary;document.getElementById('cy').onchange=renderMonthSummary;renderMonthSummary();
}
function monthRows(y,m){return S.receipts.filter(r=>{const d=serviceDate(r);return Number(d.slice(0,4))===y&&Number(d.slice(5,7))===m&&r.accounting_status!=='cancelled'})}
function renderMonthSummary(){
  const y=Number(document.getElementById('cy').value),m=Number(document.getElementById('cm').value),rows=monthRows(y,m),sum=rows.reduce((a,b)=>a+Number(b.amount_received||0),0),reviewed=rows.filter(r=>r.accounting_status==='reviewed').length,pending=rows.filter(r=>(r.accounting_status||'pending_review')==='pending_review'||r.accounting_status==='pending_issue').length;
  document.getElementById('monthSummary').innerHTML=`<div class="kpis"><div class="kpi"><span>Recibos</span><strong>${rows.length}</strong></div><div class="kpi"><span>Total</span><strong>${brl(sum)}</strong></div><div class="kpi"><span>Conferidos</span><strong>${reviewed}</strong></div><div class="kpi"><span>Pendentes</span><strong>${pending}</strong></div></div><div class="panel"><div class="actions inline-actions"><button class="btn btn-secondary" id="monthPdf">Gerar relatório PDF</button>${S.profile.role==='admin'?'<button class="btn btn-primary" id="closeMonth">Fechar mês</button>':''}</div><div style="height:12px"></div>${tableReceipts(rows)}</div>`;
  document.getElementById('monthPdf').onclick=()=>generateMonthlyPDF(rows,y,m);
  document.getElementById('closeMonth')?.addEventListener('click',()=>closeMonth(y,m));
  wireReceipt();
}
async function closeMonth(y,m){
  const {error}=await supabaseClient.rpc('close_receipt_month',{p_year:y,p_month:m,p_notes:null});
  if(error){toast(error.message,'error');return}
  await load();toast('Mês fechado e consolidado.');monthly();
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
function settings(){
  if(S.profile.role!=='admin'){S.view='dashboard';render();return}
  const s=S.settings||{};
  document.getElementById('content').innerHTML=`<div class="admin-head"><div><h2>Dados do contratante</h2><p>Usados nos PDFs e validações.</p></div></div><form id="set" class="panel"><div class="grid"><div class="field full"><label class="required">Nome / Razão social</label><input name="business_name" required value="${escapeHtml(s.business_name||'Trilheiros de Rondonópolis')}"></div><div class="field"><label>CNPJ</label><input name="cnpj" value="${escapeHtml(s.cnpj||'')}"></div><div class="field"><label>Telefone</label><input name="phone" value="${escapeHtml(s.phone||'')}"></div><div class="field full"><label>Endereço</label><input name="address" value="${escapeHtml(s.address||'')}"></div><div class="field"><label>Cidade</label><input name="city" value="${escapeHtml(s.city||'Rondonópolis')}"></div><div class="field"><label>UF</label><input name="state" maxlength="2" value="${escapeHtml(s.state||'MT')}"></div><div class="field full"><label>E-mail</label><input name="email" type="email" value="${escapeHtml(s.email||'')}"></div></div><div class="actions"><button class="btn btn-primary">Salvar dados</button></div></form>`;
  document.getElementById('set').onsubmit=saveSettings;
}
async function saveSettings(e){
  e.preventDefault();const f=e.currentTarget,p={business_name:f.business_name.value.trim(),cnpj:formatCpfCnpj(f.cnpj.value),phone:f.phone.value.trim(),address:f.address.value.trim(),city:f.city.value.trim(),state:f.state.value.toUpperCase(),email:f.email.value.trim(),updated_at:new Date().toISOString()};
  const {error}=await supabaseClient.from('app_settings').update(p).eq('id',1);if(error)toast(error.message,'error');else{await load();toast('Dados salvos.')}
}
function modal(html){const el=document.createElement('div');el.className='modal-backdrop';el.innerHTML='<div class="modal">'+html+'</div>';document.body.appendChild(el);el.onclick=e=>{if(e.target===el||e.target.closest('[data-close]'))el.remove()}}
function exportCSV(){
  const rows=filtered(),head=['Recibo','Status','Data do serviço','Fornecedor','CPF/CNPJ','Tipo de serviço','Valor','Pagamento'];
  const body=rows.map(r=>[r.receipt_code,statusText(r.accounting_status),dateBR(serviceDate(r)),r.legal_name,formatCpfCnpj(r.cpf_cnpj),r.service_type,Number(r.amount_received).toFixed(2).replace('.',','),r.payment_method]);
  const csv='\ufeff'+[head,...body].map(row=>row.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(';')).join('\n'),a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='recibos_trilheiros.csv';a.click();
}
boot();
})();