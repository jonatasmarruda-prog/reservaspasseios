(()=>{
const {supabaseClient}=window.ReceiptsApp;
const app=document.getElementById('app');
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
  'Outro'
];

function render(){
  app.innerHTML=`
  <section class="hero-card">
    <h2>Recibo de fornecedor</h2>
    <p>Preencha os dados abaixo para registrar o recebimento do pagamento. Todos os campos marcados são obrigatórios.</p>
  </section>

  <form id="receiptForm" novalidate>
    <section class="section">
      <div class="section-title"><div class="step">1</div><div><h3>Fornecedor</h3><p>Informe o nome ou empresa e o CPF/CNPJ.</p></div></div>
      <div class="grid">
        <div class="field full">
          <label class="required">Nome / Empresa</label>
          <input name="legal_name" required placeholder="Nome completo ou razão social">
        </div>
        <div class="field full">
          <label class="required">CPF ou CNPJ</label>
          <input name="cpf_cnpj" inputmode="numeric" required placeholder="CPF ou CNPJ">
        </div>
      </div>
    </section>

    <section class="section">
      <div class="section-title"><div class="step">2</div><div><h3>Serviço e pagamento</h3><p>Informe o serviço prestado, a data e o valor recebido.</p></div></div>
      <div class="grid">
        <div class="field full">
          <label class="required">Tipo de serviço</label>
          <select name="service_type" required>
            <option value="">Selecione o tipo de serviço</option>
            ${SERVICE_TYPES.map(x=>'<option value="'+escapeHtml(x)+'">'+escapeHtml(x)+'</option>').join('')}
          </select>
        </div>
        <div class="field">
          <label class="required">Data</label>
          <input name="service_date" type="date" required value="${new Date().toISOString().slice(0,10)}">
        </div>
        <div class="field">
          <label class="required">Valor recebido</label>
          <input name="amount_received" inputmode="decimal" required placeholder="Ex.: 2.800,00">
        </div>
        <div class="field full">
          <label>Observação <span class="muted">(opcional)</span></label>
          <input name="notes" placeholder="Informação adicional, se necessário">
        </div>
      </div>
    </section>

    <section class="section">
      <div class="section-title"><div class="step">3</div><div><h3>Assinatura</h3><p>Assine dentro do quadro branco.</p></div></div>
      <div class="signature-wrap">
        <canvas id="signature" class="signature-canvas"></canvas>
        <div class="signature-actions">
          <span class="muted">Assine dentro do quadro</span>
          <button type="button" class="btn btn-secondary btn-sm" id="clearSig">Limpar assinatura</button>
        </div>
      </div>
      <div style="height:14px"></div>
      <div class="checkbox">
        <input id="declaration" type="checkbox" required>
        <label for="declaration">Declaro que as informações acima são verdadeiras e que <strong>recebi o valor informado</strong> pelo serviço registrado neste recibo.</label>
      </div>
      <div id="err" class="notice error hidden"></div>
      <div class="actions"><button id="sendBtn" class="btn btn-primary">Confirmar e enviar recibo</button></div>
    </section>
  </form>`;

  wire();
  initCanvas();
}

function wire(){
  const f=document.getElementById('receiptForm');
  f.elements.cpf_cnpj.oninput=e=>e.target.value=formatCpfCnpj(e.target.value);
  f.onsubmit=submit;
}

function initCanvas(){
  canvas=document.getElementById('signature');
  ctx=canvas.getContext('2d');

  const resize=()=>{
    const r=canvas.getBoundingClientRect(),dpr=Math.max(devicePixelRatio||1,1);
    canvas.width=Math.round(r.width*dpr);
    canvas.height=Math.round(r.height*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.lineWidth=2.2;
    ctx.lineCap='round';
    ctx.strokeStyle='#17231b';
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

  if(!f.reportValidity())return;
  if(!signed){
    err.textContent='Faça sua assinatura antes de enviar.';
    err.classList.remove('hidden');
    return;
  }

  const doc=onlyDigits(f.elements.cpf_cnpj.value);
  if(doc.length!==11&&doc.length!==14){
    err.textContent='Informe um CPF ou CNPJ completo.';
    err.classList.remove('hidden');
    return;
  }

  const payload={
    legal_name:f.elements.legal_name.value.trim(),
    cpf_cnpj:doc,
    service_type:f.elements.service_type.value,
    service_date:f.elements.service_date.value,
    amount_received:currencyInputToNumber(f.elements.amount_received.value),
    notes:f.elements.notes.value.trim(),
    declaration_accepted:true,
    signature_data_url:canvas.toDataURL('image/png'),
    user_agent:navigator.userAgent
  };

  const btn=document.getElementById('sendBtn');
  btn.disabled=true;
  btn.textContent='Enviando...';

  try{
    if(!supabaseClient)throw new Error('Serviço indisponível.');
    const {data,error}=await supabaseClient.rpc('submit_public_receipt_open',{p_payload:payload});
    if(error)throw error;
    const code=data?.[0]?.receipt_code||'Registrado';

    app.innerHTML=`
      <section class="status-screen">
        <div class="status-box">
          <div class="status-icon">✓</div>
          <h2>Recibo enviado com sucesso</h2>
          <p>Protocolo: <strong>${escapeHtml(code)}</strong></p>
          <p>O recibo foi registrado e já está disponível para os Trilheiros.</p>
          <div class="actions"><button id="another" class="btn btn-primary">Preencher outro recibo</button></div>
        </div>
      </section>`;
    document.getElementById('another').onclick=render;
  }catch(error){
    err.textContent=error?.message||'Não foi possível enviar o recibo.';
    err.classList.remove('hidden');
    btn.disabled=false;
    btn.textContent='Confirmar e enviar recibo';
  }
}

render();
})();