(()=>{
const {supabaseClient,CFG}=window.ReceiptsApp;const root=document.getElementById('root');let S={profile:null,settings:null,requests:[],receipts:[],view:'dashboard'};
function roleName(r){return r==='admin'?'Administrador':'Contabilidade'}
function withTimeout(promise,ms=7000){return Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(new Error('timeout')),ms))])}

async function enterPanel(session){
  const x=document.getElementById('loginErr');
  try{
    if(!session?.user?.id) throw new Error('Sessão inválida.');
    const {data:p,error}=await withTimeout(
      supabaseClient.from('profiles').select('*').eq('id',session.user.id).single(),
      7000
    );
    if(error) throw error;
    if(!p||!['admin','accounting'].includes(p.role)) throw new Error('Usuário sem acesso autorizado.');

    S.profile={...p,email:session.user.email};
    await load();
    shell();
  }catch(err){
    console.error('Falha ao abrir painel:',err);
    if(x){
      x.textContent=err?.message==='timeout'
        ?'Seu login foi aceito, mas o painel demorou para carregar. Toque em Entrar novamente.'
        :'Login realizado, mas não foi possível abrir o painel. Atualize a página e tente novamente.';
      x.classList.remove('hidden');
    }
  }
}

async function boot(){
  login();
  if(!supabaseClient){
    const x=document.getElementById('loginErr');
    if(x){x.textContent='Não foi possível conectar ao serviço de dados.';x.classList.remove('hidden')}
    return;
  }
  try{
    const {data}=await withTimeout(supabaseClient.auth.getSession(),4000);
    if(data?.session) await enterPanel(data.session);
  }catch(err){
    console.warn('Verificação inicial de sessão:',err);
  }
}

function login(){
  root.innerHTML='<div class="login-wrap"><div class="login-card"><div class="brand"><img class="brand-logo brand-logo-large" src="https://i.postimg.cc/09t8GNX6/LOGO-TRILHEIROS-Photoroom.png" alt="Logo Trilheiros de Rondonópolis"><div><h1 style="font-size:17px;margin:0">Trilheiros de Rondonópolis</h1><small style="color:#657168">Gestão de Recibos</small></div></div><h1>Acesso ao sistema</h1><p>Acesso restrito ao Administrador e à Contabilidade.</p><form id="login"><div class="field"><label>E-mail</label><input name="email" type="email" required autocomplete="email" placeholder="Digite seu e-mail"></div><div style="height:12px"></div><div class="field"><label>Senha</label><div class="password-field"><input id="loginPassword" name="password" type="password" required autocomplete="current-password" placeholder="Digite sua senha"><button class="password-eye" type="button" id="toggleLoginPassword" aria-label="Mostrar senha" title="Mostrar senha"><svg class="eye-open" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5c-5 0-9 4.5-10 7 1 2.5 5 7 10 7s9-4.5 10-7c-1-2.5-5-7-10-7Zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm0-2.2A1.8 1.8 0 1 0 12 10a1.8 1.8 0 0 0 0 3.8Z"/></svg><svg class="eye-closed" viewBox="0 0 24 24" aria-hidden="true" style="display:none"><path d="m3.3 2 18.7 18.7-1.3 1.3-3.1-3.1A11.5 11.5 0 0 1 12 20C7 20 3 15.5 2 13a12.8 12.8 0 0 1 4.2-5.3L2 3.3 3.3 2Zm5.2 8.5a4 4 0 0 0 5 5l-5-5ZM12 6c5 0 9 4.5 10 7a13.5 13.5 0 0 1-2.6 3.8l-2.1-2.1A4 4 0 0 0 11.3 9L9 6.7A10.8 10.8 0 0 1 12 6Z"/></svg></button></div></div><div id="loginErr" class="notice error hidden"></div><div class="actions"><button class="btn btn-primary" style="width:100%">Entrar no painel</button></div></form><div style="text-align:center;margin-top:16px"><a class="first-access-link" href="setup.html?v=20260930-2025">Primeiro acesso — cadastrar meu acesso</a></div><div class="notice info" style="margin-top:16px">Somente dois perfis são autorizados: <strong>Administrador</strong> e <strong>Contabilidade</strong>.</div></div></div>';

  const eye=document.getElementById('toggleLoginPassword');
  eye.onclick=()=>{
    const input=document.getElementById('loginPassword');
    const show=input.type==='password';
    input.type=show?'text':'password';
    const openIcon=eye.querySelector('.eye-open');
    const closedIcon=eye.querySelector('.eye-closed');
    if(openIcon) openIcon.style.display=show?'none':'block';
    if(closedIcon) closedIcon.style.display=show?'block':'none';
    eye.setAttribute('aria-label',show?'Ocultar senha':'Mostrar senha');
    eye.title=show?'Ocultar senha':'Mostrar senha';
  };

  document.getElementById('login').onsubmit=async e=>{
    e.preventDefault();
    const form=e.currentTarget,btn=form.querySelector('button.btn-primary'),x=document.getElementById('loginErr');
    x.classList.add('hidden');
    if(!supabaseClient){x.textContent='Serviço de dados indisponível.';x.classList.remove('hidden');return}

    btn.disabled=true;
    btn.textContent='Entrando...';

    try{
      const {data,error}=await withTimeout(
        supabaseClient.auth.signInWithPassword({
          email:form.email.value.trim(),
          password:form.password.value
        }),
        10000
      );
      if(error) throw error;
      if(!data?.session) throw new Error('Sessão não criada.');
      btn.textContent='Abrindo painel...';
      await enterPanel(data.session);
    }catch(err){
      console.error('Falha no login:',err);
      x.textContent=err?.message==='timeout'
        ?'A conexão demorou demais. Tente novamente.'
        :'Não foi possível entrar. Confira e-mail e senha.';
      x.classList.remove('hidden');
    }finally{
      if(document.body.contains(btn)){btn.disabled=false;btn.textContent='Entrar no painel'}
    }
  };
}
async function load(){
  const [a,b,c]=await Promise.all([
    withTimeout(supabaseClient.from('app_settings').select('*').eq('id',1).single(),7000),
    withTimeout(supabaseClient.from('receipt_requests').select('*').order('created_at',{ascending:false}),7000),
    withTimeout(supabaseClient.from('receipts').select('*').order('created_at',{ascending:false}),7000)
  ]);
  S.settings=a.data||{};
  S.requests=b.data||[];
  S.receipts=c.data||[];
}
function shell(){
  root.innerHTML=`<div class="admin-shell"><aside class="sidebar"><div class="brand"><img class="brand-logo" src="https://i.postimg.cc/09t8GNX6/LOGO-TRILHEIROS-Photoroom.png" alt="Logo Trilheiros de Rondonópolis"><div><h1>Trilheiros</h1><small>Gestão de Recibos</small></div></div><nav class="nav"><button data-v="dashboard">Visão geral</button><button data-v="receipts">Recibos</button>${S.profile.role==='admin'?'<button data-v="settings">Configurações</button>':''}</nav><div class="sidebar-foot"><div class="user"><strong>${escapeHtml(S.profile.display_name)}</strong><br><span style="color:#bfd3c5">${roleName(S.profile.role)}</span></div><button id="logout" class="btn btn-secondary btn-sm" style="width:100%;margin-top:9px">Sair</button></div></aside><main class="admin-main"><div id="content"></div></main></div>`;
  root.querySelectorAll('[data-v]').forEach(b=>b.onclick=()=>{S.view=b.dataset.v;render()});
  document.getElementById('logout').onclick=async()=>{await supabaseClient.auth.signOut();location.reload()};
  render();
}
function reqFor(r){return S.requests.find(q=>q.id===r.request_id)||{}}
function render(){root.querySelectorAll('[data-v]').forEach(b=>b.classList.toggle('active',b.dataset.v===S.view));({dashboard,receipts,settings}[S.view]||dashboard)()}

function publicFormLink(){
  return new URL('./',location.href).href.split('?')[0].split('#')[0];
}

async function copyPublicLink(text,button,field){
  let copied=false;
  try{
    if(navigator.clipboard&&window.isSecureContext){
      await navigator.clipboard.writeText(text);
      copied=true;
    }
  }catch(e){}

  if(!copied){
    try{
      field.removeAttribute('readonly');
      field.focus();
      field.select();
      field.setSelectionRange(0,field.value.length);
      copied=document.execCommand('copy');
      field.setAttribute('readonly','readonly');
      window.getSelection()?.removeAllRanges();
    }catch(e){}
  }

  if(copied){
    const original=button.textContent;
    button.textContent='✓ Link copiado';
    button.classList.add('copy-success');
    toast('Link copiado para a área de transferência.');
    setTimeout(()=>{
      if(document.body.contains(button)){
        button.textContent=original;
        button.classList.remove('copy-success');
      }
    },2200);
    return true;
  }

  field.removeAttribute('readonly');
  field.focus();
  field.select();
  field.setSelectionRange(0,field.value.length);
  toast('Selecione o link e toque em Copiar.','error');
  return false;
}

function showPublicLink(){
  const link=publicFormLink();
  modal(`
    <div class="modal-head">
      <div>
        <h3>Link único do fornecedor</h3>
        <span class="muted">Este é o mesmo link para todos os fornecedores.</span>
      </div>
      <button class="btn btn-secondary btn-sm" data-close>Fechar</button>
    </div>

    <div class="notice success">
      Envie este link para o fornecedor preencher, revisar, assinar e enviar o recibo.
    </div>

    <div class="field">
      <label>Link do formulário</label>
      <textarea id="publicLink" readonly rows="3">${escapeHtml(link)}</textarea>
    </div>

    <div class="actions link-actions">
      <button class="btn btn-secondary" id="copyPublic" type="button">Copiar link</button>
      <button class="btn btn-primary" id="whatsappPublic" type="button">Enviar pelo WhatsApp</button>
      <button class="btn btn-secondary" id="openPublic" type="button">Abrir formulário</button>
    </div>
  `);

  const field=document.getElementById('publicLink');
  const copyBtn=document.getElementById('copyPublic');

  copyBtn.onclick=()=>copyPublicLink(link,copyBtn,field);

  document.getElementById('whatsappPublic').onclick=()=>{
    const msg='Olá! Segue o link para preencher e assinar o recibo digital dos Trilheiros de Rondonópolis:%0A%0A'+encodeURIComponent(link);
    window.open('https://wa.me/?text='+msg,'_blank','noopener');
  };

  document.getElementById('openPublic').onclick=()=>window.open(link,'_blank','noopener');
}

function dashboard(){
  const now=new Date();
  const month=S.receipts.filter(r=>{const raw=r.service_date||r.payment_date;const d=new Date(raw+'T12:00:00');return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear()});
  const total=month.reduce((a,b)=>a+Number(b.amount_received||0),0);
  const types=new Set(S.receipts.map(r=>r.service_type||reqFor(r).category).filter(Boolean)).size;
  document.getElementById('content').innerHTML=`<div class="admin-head"><div><h2>Visão geral</h2><p>Controle dos recibos enviados pelos fornecedores.</p></div><button class="btn btn-primary" id="publicLinkBtn">Link do fornecedor</button></div><div class="kpis"><div class="kpi"><span>Recibos no mês</span><strong>${month.length}</strong></div><div class="kpi"><span>Valor no mês</span><strong>${brl(total)}</strong></div><div class="kpi"><span>Total arquivado</span><strong>${S.receipts.length}</strong></div><div class="kpi"><span>Tipos de serviço</span><strong>${types}</strong></div></div><div class="panel"><h3>Últimos recibos</h3>${tableReceipts(S.receipts.slice(0,8))}</div>`;
  document.getElementById('publicLinkBtn').onclick=showPublicLink;
  wireReceipt();
}
function tableReceipts(rows){
  if(!rows.length)return'<div class="empty">Nenhum recibo encontrado.</div>';
  return'<div class="table-wrap"><table><thead><tr><th>Recibo</th><th>Fornecedor</th><th>Tipo de serviço</th><th>Data</th><th>Valor</th><th>Ações</th></tr></thead><tbody>'+
  rows.map(r=>{const q=reqFor(r),type=r.service_type||q.category||'—';return`<tr><td><strong>${escapeHtml(r.receipt_code||'—')}</strong></td><td>${escapeHtml(r.legal_name)}<br><span class="muted">${formatCpfCnpj(r.cpf_cnpj)}</span></td><td>${escapeHtml(type)}</td><td>${dateBR(r.service_date||r.payment_date)}</td><td class="money">${brl(r.amount_received)}</td><td><div class="table-actions"><button class="btn btn-secondary btn-sm" data-open="${r.id}">Ver</button><button class="btn btn-primary btn-sm" data-pdf="${r.id}">PDF</button></div></td></tr>`}).join('')+
  '</tbody></table></div>';
}
function wireReceipt(){
  document.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>openReceipt(b.dataset.open));
  document.querySelectorAll('[data-pdf]').forEach(b=>b.onclick=()=>{const r=S.receipts.find(x=>x.id===b.dataset.pdf);if(r)generateReceiptPDF(r,reqFor(r),S.settings)});
}
function receipts(){
  const types=[...new Set(S.receipts.map(r=>r.service_type||reqFor(r).category).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
  document.getElementById('content').innerHTML=`<div class="admin-head"><div><h2>Recibos arquivados</h2><p>Filtre por serviço, data, fornecedor ou CPF/CNPJ.</p></div><div class="actions"><button class="btn btn-secondary" id="publicLinkBtn">Link do fornecedor</button><button class="btn btn-secondary" id="csv">Exportar CSV</button></div></div><div class="toolbar"><div class="field"><label>Tipo de serviço</label><select id="ft"><option value="">Todos</option>${types.map(t=>'<option value="'+escapeHtml(t)+'">'+escapeHtml(t)+'</option>').join('')}</select></div><div class="field"><label>Data inicial</label><input id="fd1" type="date"></div><div class="field"><label>Data final</label><input id="fd2" type="date"></div><div class="field search"><label>Buscar fornecedor</label><input id="fq" placeholder="Nome, empresa, CPF ou CNPJ"></div></div><div id="list"></div>`;
  ['ft','fd1','fd2'].forEach(id=>document.getElementById(id).onchange=filterReceipts);
  document.getElementById('fq').oninput=filterReceipts;
  document.getElementById('csv').onclick=exportCSV;
  document.getElementById('publicLinkBtn').onclick=showPublicLink;
  filterReceipts();
}
function filtered(){
  const type=document.getElementById('ft')?.value||'';
  const start=document.getElementById('fd1')?.value||'';
  const end=document.getElementById('fd2')?.value||'';
  const q=(document.getElementById('fq')?.value||'').toLowerCase().trim();
  return S.receipts.filter(r=>{
    const legacy=reqFor(r),rt=r.service_type||legacy.category||'',date=r.service_date||r.payment_date||'';
    const hay=(r.legal_name+' '+r.cpf_cnpj+' '+rt).toLowerCase();
    return(!type||rt===type)&&(!start||date>=start)&&(!end||date<=end)&&(!q||hay.includes(q));
  });
}
function filterReceipts(){
  const rows=filtered(),sum=rows.reduce((a,b)=>a+Number(b.amount_received||0),0);
  document.getElementById('list').innerHTML='<div class="panel"><strong>'+rows.length+' recibo(s) • '+brl(sum)+'</strong><div style="height:12px"></div>'+tableReceipts(rows)+'</div>';
  wireReceipt();
}
function settings(){if(S.profile.role!=='admin'){S.view='dashboard';render();return}const s=S.settings||{};document.getElementById('content').innerHTML=`<div class="admin-head"><div><h2>Dados do contratante</h2><p>Usados no recibo e no PDF.</p></div></div><form id="set" class="panel"><div class="grid"><div class="field full"><label class="required">Nome / Razão social</label><input name="business_name" required value="${escapeHtml(s.business_name||'Trilheiros de Rondonópolis')}"></div><div class="field"><label>CNPJ</label><input name="cnpj" value="${escapeHtml(s.cnpj||'')}"></div><div class="field"><label>Telefone</label><input name="phone" value="${escapeHtml(s.phone||'')}"></div><div class="field full"><label>Endereço</label><input name="address" value="${escapeHtml(s.address||'')}"></div><div class="field"><label>Cidade</label><input name="city" value="${escapeHtml(s.city||'Rondonópolis')}"></div><div class="field"><label>UF</label><input name="state" maxlength="2" value="${escapeHtml(s.state||'MT')}"></div><div class="field full"><label>E-mail</label><input name="email" type="email" value="${escapeHtml(s.email||'')}"></div></div><div class="actions"><button class="btn btn-primary">Salvar dados</button></div></form>`;document.getElementById('set').onsubmit=saveSettings}
async function saveSettings(e){e.preventDefault();const f=e.currentTarget,p={business_name:f.business_name.value.trim(),cnpj:formatCpfCnpj(f.cnpj.value),phone:f.phone.value.trim(),address:f.address.value.trim(),city:f.city.value.trim(),state:f.state.value.toUpperCase(),email:f.email.value.trim(),updated_at:new Date().toISOString()};const {error}=await supabaseClient.from('app_settings').update(p).eq('id',1);if(error)toast(error.message,'error');else{await load();toast('Dados salvos.')}}
function openReceipt(id){
  const r=S.receipts.find(x=>x.id===id),q=reqFor(r),type=r.service_type||q.category||'—';
  const address=[r.address,r.address_number,r.neighborhood,r.complement,r.city,r.state].filter(Boolean).join(', ');
  modal(`<div class="modal-head"><div><h3>Recibo ${escapeHtml(r.receipt_code||'—')}</h3><span class="muted">Validação: ${escapeHtml(r.verification_code||'—')}</span></div><button class="btn btn-secondary btn-sm" data-close>Fechar</button></div>
  <div class="receipt-view-section"><h4>Fornecedor</h4><div class="detail-grid">
    <div class="detail"><span>Nome / Empresa</span><strong>${escapeHtml(r.legal_name)}</strong></div>
    <div class="detail"><span>CPF/CNPJ</span><strong>${formatCpfCnpj(r.cpf_cnpj)}</strong></div>
    <div class="detail"><span>Telefone / WhatsApp</span><strong>${formatPhone(r.phone)}</strong></div>
    <div class="detail"><span>E-mail</span><strong>${escapeHtml(r.email||'Não informado')}</strong></div>
    <div class="detail detail-full"><span>Endereço</span><strong>${escapeHtml(address||'—')}</strong></div>
    ${r.postal_code?'<div class="detail"><span>CEP</span><strong>'+formatCep(r.postal_code)+'</strong></div>':''}
  </div></div>
  <div class="receipt-view-section"><h4>Serviço e pagamento</h4><div class="detail-grid">
    <div class="detail"><span>Tipo de serviço</span><strong>${escapeHtml(type)}</strong></div>
    <div class="detail"><span>Data do serviço</span><strong>${dateBR(r.service_date||r.payment_date)}</strong></div>
    <div class="detail detail-full"><span>Descrição</span><strong>${escapeHtml(r.service_description||type)}</strong></div>
    <div class="detail"><span>Valor recebido</span><strong>${brl(r.amount_received)}</strong></div>
    <div class="detail"><span>Data do recebimento</span><strong>${dateBR(r.payment_date)}</strong></div>
    <div class="detail"><span>Forma de pagamento</span><strong>${escapeHtml(r.payment_method||'—')}</strong></div>
    <div class="detail"><span>Assinado por</span><strong>${escapeHtml(r.declarant_name||r.legal_name)}</strong></div>
    ${r.notes?'<div class="detail detail-full"><span>Observação</span><strong>'+escapeHtml(r.notes)+'</strong></div>':''}
  </div></div>
  <div class="receipt-view-section"><h4>Assinatura</h4><img class="signature-preview premium-signature-preview" src="${r.signature_data_url}"></div>
  <div class="actions"><button class="btn btn-primary" id="pdfNow">Baixar PDF</button></div>`);
  document.getElementById('pdfNow').onclick=()=>generateReceiptPDF(r,q,S.settings);
}
function modal(html){const el=document.createElement('div');el.className='modal-backdrop';el.innerHTML='<div class="modal">'+html+'</div>';document.body.appendChild(el);el.onclick=e=>{if(e.target===el||e.target.closest('[data-close]'))el.remove()}}
function exportCSV(){
  const rows=filtered(),head=['Recibo','Data','Fornecedor','CPF/CNPJ','Tipo de serviço','Valor'];
  const body=rows.map(r=>{const q=reqFor(r),type=r.service_type||q.category||'';return[r.receipt_code,dateBR(r.payment_date),r.legal_name,formatCpfCnpj(r.cpf_cnpj),type,Number(r.amount_received).toFixed(2).replace('.',',')]});
  const csv='\ufeff'+[head,...body].map(row=>row.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(';')).join('\n'),a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
  a.download='recibos_trilheiros.csv';
  a.click();
}
boot();
})();
