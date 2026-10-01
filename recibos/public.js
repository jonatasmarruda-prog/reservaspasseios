(()=>{
const {supabaseClient}=window.ReceiptsApp;
const app=document.getElementById('app');
const LOCK_KEY='trilheiros_receipt_submitted_v3';
let canvas,ctx,drawing=false,signed=false;

const SERVICE_TYPES=[
  'Transporte / Ônibus',
  'Hotel / Pousada',
  'Alimentação',
  'Guia / Condutor',
  'Atrativo / Ingresso',
  'Fotografia',
  'Seguro',
  'Combustível',
  'Locação',
  'Manutenção / Serviço técnico',
  'Outro'
];

const PAYMENT_METHODS=[
  'PIX',
  'Transferência bancária',
  'Dinheiro',
  'Cartão',
  'Boleto',
  'Outro'
];

function lockedReceipt(){
  try{return JSON.parse(localStorage.getItem(LOCK_KEY)||'null')}catch{return null}
}
function lockReceipt(data){
  try{localStorage.setItem(LOCK_KEY,JSON.stringify(data))}catch{}
}
function thankYou(data){
  app.innerHTML=`
    <section class="status-screen premium-thanks">
      <div class="status-box">
        <div class="status-icon">✓</div>
        <h2>Obrigado! Recibo enviado com sucesso.</h2>
        <p>Seu recibo foi salvo e encaminhado para os <strong>Trilheiros de Rondonópolis</strong>.</p>
        <div class="receipt-success-card">
          <span>Protocolo</span>
          <strong>${escapeHtml(data?.code||'Registrado')}</strong>
          ${data?.verification?'<small>Validação: '+escapeHtml(data.verification)+'</small>':''}
        </div>
        <p class="muted">Este formulário já foi concluído neste aparelho. Não é possível alterar ou reenviar este recibo por esta página.</p>
      </div>
    </section>`;
}
function render(){
  const locked=lockedReceipt();
  if(locked){thankYou(locked);return}

  app.innerHTML=`
  <section class="hero-card premium-hero">
    <div class="receipt-kicker">RECIBO DIGITAL</div>
    <h2>Recibo de pagamento a fornecedor</h2>
    <p>Preencha as informações com atenção. Ao final, revise os dados, assine e envie o recibo.</p>
    <div class="steps-bar">
      <div class="steps-bar-item active" data-step-indicator="1"><span>1</span>Dados</div>
      <div class="steps-bar-item" data-step-indicator="2"><span>2</span>Assinatura</div>
      <div class="steps-bar-item" data-step-indicator="3"><span>3</span>Envio</div>
    </div>
  </section>

  <form id="receiptForm" novalidate>
    <div id="formStep">
      <section class="section">
        <div class="section-title"><div class="step">1</div><div><h3>Identificação do fornecedor</h3><p>Informe os dados de quem recebeu o pagamento.</p></div></div>
        <div class="grid">
          <div class="field full">
            <label class="required">Nome / Empresa</label>
            <input name="legal_name" required maxlength="160" placeholder="Nome completo ou razão social">
          </div>
          <div class="field">
            <label class="required">CPF ou CNPJ</label>
            <input name="cpf_cnpj" inputmode="numeric" required placeholder="CPF ou CNPJ">
          </div>
          <div class="field">
            <label class="required">Telefone / WhatsApp</label>
            <input name="phone" inputmode="tel" required placeholder="(66) 99999-9999">
          </div>
          <div class="field full">
            <label>E-mail <span class="muted">(opcional)</span></label>
            <input name="email" type="email" autocomplete="email" placeholder="seu@email.com">
          </div>
        </div>
      </section>

      <section class="section">
        <div class="section-title"><div class="step">2</div><div><h3>Endereço</h3><p>Informe o endereço do fornecedor ou prestador.</p></div></div>
        <div class="grid-3">
          <div class="field">
            <label>CEP</label>
            <input name="postal_code" inputmode="numeric" placeholder="00000-000">
          </div>
          <div class="field" style="grid-column:span 2">
            <label class="required">Endereço</label>
            <input name="address" required placeholder="Rua, avenida, comunidade ou localidade">
          </div>
          <div class="field">
            <label>Número</label>
            <input name="address_number" placeholder="Nº ou S/N">
          </div>
          <div class="field">
            <label>Bairro</label>
            <input name="neighborhood">
          </div>
          <div class="field">
            <label>Complemento</label>
            <input name="complement">
          </div>
          <div class="field" style="grid-column:span 2">
            <label class="required">Cidade</label>
            <input name="city" required>
          </div>
          <div class="field">
            <label class="required">UF</label>
            <input name="state" maxlength="2" required placeholder="MT">
          </div>
        </div>
      </section>

      <section class="section">
        <div class="section-title"><div class="step">3</div><div><h3>Serviço e pagamento</h3><p>Registre o serviço prestado e o pagamento recebido.</p></div></div>
        <div class="grid">
          <div class="field">
            <label class="required">Tipo de serviço</label>
            <select name="service_type" required>
              <option value="">Selecione</option>
              ${SERVICE_TYPES.map(x=>'<option value="'+escapeHtml(x)+'">'+escapeHtml(x)+'</option>').join('')}
            </select>
          </div>
          <div class="field">
            <label class="required">Data do serviço</label>
            <input name="service_date" type="date" required>
          </div>
          <div class="field full">
            <label class="required">Descrição do serviço</label>
            <textarea name="service_description" required maxlength="1200" placeholder="Descreva de forma objetiva o serviço realizado"></textarea>
          </div>
          <div class="field">
            <label class="required">Valor recebido</label>
            <input name="amount_received" inputmode="decimal" required placeholder="Ex.: 2.800,00">
          </div>
          <div class="field">
            <label class="required">Data do recebimento</label>
            <input name="payment_date" type="date" required value="${new Date().toISOString().slice(0,10)}">
          </div>
          <div class="field">
            <label class="required">Forma de pagamento</label>
            <select name="payment_method" required>
              <option value="">Selecione</option>
              ${PAYMENT_METHODS.map(x=>'<option value="'+escapeHtml(x)+'">'+escapeHtml(x)+'</option>').join('')}
            </select>
          </div>
          <div class="field">
            <label>Observação <span class="muted">(opcional)</span></label>
            <input name="notes" maxlength="500" placeholder="Informação adicional">
          </div>
        </div>
        <div id="formErr" class="notice error hidden"></div>
        <div class="actions">
          <button type="button" class="btn btn-primary btn-large" id="toSignature">Continuar para assinatura</button>
        </div>
      </section>
    </div>

    <section class="section hidden" id="signatureStep">
      <div class="section-title"><div class="step">4</div><div><h3>Revise e assine</h3><p>Confira os dados abaixo antes de salvar definitivamente.</p></div></div>

      <div id="reviewCard" class="review-card"></div>

      <div class="field">
        <label class="required">Nome de quem está assinando</label>
        <input name="declarant_name" required maxlength="160" placeholder="Nome completo do responsável">
      </div>

      <div style="height:16px"></div>
      <div class="signature-panel">
        <div class="signature-panel-head">
          <div><strong>Assinatura</strong><div class="muted">Assine com o dedo ou mouse dentro do quadro.</div></div>
          <button type="button" class="btn btn-secondary btn-sm" id="clearSig">Limpar</button>
        </div>
        <canvas id="signature" class="signature-canvas premium-signature"></canvas>
      </div>

      <div style="height:16px"></div>
      <div class="checkbox">
        <input id="declaration" type="checkbox" required>
        <label for="declaration">Declaro que as informações fornecidas são verdadeiras, que <strong>recebi o valor informado</strong> pelo serviço descrito e autorizo o registro eletrônico deste recibo.</label>
      </div>

      <div id="err" class="notice error hidden"></div>
      <div class="actions split-actions">
        <button type="button" class="btn btn-secondary" id="backToForm">Voltar e revisar</button>
        <button id="sendBtn" class="btn btn-primary btn-large">Salvar e enviar recibo</button>
      </div>
    </section>
  </form>`;

  wire();
}

function wire(){
  const f=document.getElementById('receiptForm');
  f.elements.cpf_cnpj.oninput=e=>e.target.value=formatCpfCnpj(e.target.value);
  f.elements.phone.oninput=e=>e.target.value=formatPhone(e.target.value);
  f.elements.postal_code.oninput=e=>e.target.value=formatCep(e.target.value);
  f.elements.state.oninput=e=>e.target.value=e.target.value.replace(/[^a-z]/gi,'').slice(0,2).toUpperCase();

  document.getElementById('toSignature').onclick=()=>{
    const err=document.getElementById('formErr');
    err.classList.add('hidden');
    const required=[...document.querySelectorAll('#formStep [required]')];
    const invalid=required.find(x=>!x.checkValidity());
    if(invalid){
      invalid.reportValidity();
      err.textContent='Preencha todos os campos obrigatórios antes de continuar.';
      err.classList.remove('hidden');
      invalid.scrollIntoView({behavior:'smooth',block:'center'});
      return;
    }
    const doc=onlyDigits(f.elements.cpf_cnpj.value);
    if(doc.length!==11&&doc.length!==14){
      err.textContent='Informe um CPF ou CNPJ completo.';
      err.classList.remove('hidden');
      f.elements.cpf_cnpj.focus();
      return;
    }
    if(onlyDigits(f.elements.phone.value).length<10){
      err.textContent='Informe um telefone/WhatsApp válido.';
      err.classList.remove('hidden');
      f.elements.phone.focus();
      return;
    }
    if(currencyInputToNumber(f.elements.amount_received.value)<=0){
      err.textContent='Informe um valor recebido válido.';
      err.classList.remove('hidden');
      f.elements.amount_received.focus();
      return;
    }

    document.getElementById('reviewCard').innerHTML=reviewHtml(f);
    document.getElementById('formStep').classList.add('hidden');
    document.getElementById('signatureStep').classList.remove('hidden');
    document.querySelector('[data-step-indicator="1"]').classList.remove('active');
    document.querySelector('[data-step-indicator="2"]').classList.add('active');
    document.getElementById('signatureStep').scrollIntoView({behavior:'smooth',block:'start'});
    setTimeout(initCanvas,80);
  };

  document.getElementById('backToForm').onclick=()=>{
    document.getElementById('signatureStep').classList.add('hidden');
    document.getElementById('formStep').classList.remove('hidden');
    document.querySelector('[data-step-indicator="2"]').classList.remove('active');
    document.querySelector('[data-step-indicator="1"]').classList.add('active');
    signed=false;
    window.scrollTo({top:0,behavior:'smooth'});
  };

  f.onsubmit=submit;
}

function reviewHtml(f){
  const doc=formatCpfCnpj(f.elements.cpf_cnpj.value);
  const address=[f.elements.address.value,f.elements.address_number.value,f.elements.neighborhood.value,f.elements.complement.value,f.elements.city.value,f.elements.state.value].filter(Boolean).join(', ');
  return `
    <div class="review-grid">
      <div><span>Fornecedor</span><strong>${escapeHtml(f.elements.legal_name.value)}</strong></div>
      <div><span>CPF/CNPJ</span><strong>${escapeHtml(doc)}</strong></div>
      <div><span>Telefone</span><strong>${escapeHtml(f.elements.phone.value)}</strong></div>
      <div><span>Tipo de serviço</span><strong>${escapeHtml(f.elements.service_type.value)}</strong></div>
      <div><span>Data do serviço</span><strong>${dateBR(f.elements.service_date.value)}</strong></div>
      <div><span>Valor recebido</span><strong>${brl(currencyInputToNumber(f.elements.amount_received.value))}</strong></div>
      <div><span>Recebimento</span><strong>${dateBR(f.elements.payment_date.value)} • ${escapeHtml(f.elements.payment_method.value)}</strong></div>
      <div class="review-full"><span>Endereço</span><strong>${escapeHtml(address)}</strong></div>
      <div class="review-full"><span>Serviço realizado</span><strong>${escapeHtml(f.elements.service_description.value)}</strong></div>
    </div>`;
}

function initCanvas(){
  canvas=document.getElementById('signature');
  if(!canvas)return;
  ctx=canvas.getContext('2d');
  const resize=()=>{
    const r=canvas.getBoundingClientRect(),dpr=Math.max(window.devicePixelRatio||1,1);
    canvas.width=Math.max(1,Math.round(r.width*dpr));
    canvas.height=Math.max(1,Math.round(r.height*dpr));
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.lineWidth=2.4;
    ctx.lineCap='round';
    ctx.lineJoin='round';
    ctx.strokeStyle='#102b1c';
  };
  resize();

  const pos=e=>{
    const r=canvas.getBoundingClientRect(),p=e.touches?.[0]||e;
    return{x:p.clientX-r.left,y:p.clientY-r.top};
  };
  const start=e=>{e.preventDefault();drawing=true;signed=true;const p=pos(e);ctx.beginPath();ctx.moveTo(p.x,p.y)};
  const move=e=>{if(!drawing)return;e.preventDefault();const p=pos(e);ctx.lineTo(p.x,p.y);ctx.stroke()};
  const end=e=>{if(drawing){e.preventDefault();drawing=false;ctx.closePath()}};

  canvas.addEventListener('pointerdown',start,{passive:false});
  canvas.addEventListener('pointermove',move,{passive:false});
  canvas.addEventListener('pointerup',end,{passive:false});
  canvas.addEventListener('pointerleave',end,{passive:false});
  document.getElementById('clearSig').onclick=()=>{ctx.clearRect(0,0,canvas.width,canvas.height);signed=false};
}

async function submit(e){
  e.preventDefault();
  const f=e.currentTarget,err=document.getElementById('err');
  err.classList.add('hidden');

  if(!f.elements.declarant_name.checkValidity()){f.elements.declarant_name.reportValidity();return}
  if(!document.getElementById('declaration').checked){
    err.textContent='Confirme a declaração antes de enviar.';
    err.classList.remove('hidden');
    return;
  }
  if(!signed){
    err.textContent='Faça sua assinatura dentro do quadro antes de enviar.';
    err.classList.remove('hidden');
    return;
  }

  const payload={
    legal_name:f.elements.legal_name.value.trim(),
    cpf_cnpj:onlyDigits(f.elements.cpf_cnpj.value),
    phone:onlyDigits(f.elements.phone.value),
    email:f.elements.email.value.trim(),
    postal_code:onlyDigits(f.elements.postal_code.value),
    address:f.elements.address.value.trim(),
    address_number:f.elements.address_number.value.trim(),
    neighborhood:f.elements.neighborhood.value.trim(),
    complement:f.elements.complement.value.trim(),
    city:f.elements.city.value.trim(),
    state:f.elements.state.value.trim().toUpperCase(),
    service_type:f.elements.service_type.value,
    service_description:f.elements.service_description.value.trim(),
    service_date:f.elements.service_date.value,
    amount_received:currencyInputToNumber(f.elements.amount_received.value),
    payment_date:f.elements.payment_date.value,
    payment_method:f.elements.payment_method.value,
    notes:f.elements.notes.value.trim(),
    declarant_name:f.elements.declarant_name.value.trim(),
    declaration_accepted:true,
    signature_data_url:canvas.toDataURL('image/png'),
    user_agent:navigator.userAgent
  };

  const btn=document.getElementById('sendBtn');
  btn.disabled=true;
  btn.textContent='Salvando recibo...';

  try{
    if(!supabaseClient)throw new Error('Serviço de dados indisponível.');
    const {data,error}=await supabaseClient.rpc('submit_public_receipt_open',{p_payload:payload});
    if(error)throw error;

    const result=data?.[0]||{};
    const lock={
      code:result.receipt_code||'Registrado',
      verification:result.verification_code||'',
      submitted_at:new Date().toISOString()
    };
    lockReceipt(lock);
    document.querySelector('[data-step-indicator="2"]')?.classList.remove('active');
    document.querySelector('[data-step-indicator="3"]')?.classList.add('active');
    thankYou(lock);
    window.scrollTo({top:0,behavior:'smooth'});
  }catch(error){
    err.textContent=error?.message||'Não foi possível salvar o recibo. Confira os dados e tente novamente.';
    err.classList.remove('hidden');
    btn.disabled=false;
    btn.textContent='Salvar e enviar recibo';
  }
}

render();
})();