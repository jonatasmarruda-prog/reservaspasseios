(()=>{
const {supabaseClient}=window.ReceiptsApp;
const app=document.getElementById('app');
const token=new URLSearchParams(location.search).get('token');
let req=null,canvas,ctx,drawing=false,signed=false;
function screen(title,msg,kind='info'){app.innerHTML='<section class="status-screen"><div class="status-box"><div class="status-icon">'+(kind==='success'?'✓':'!')+'</div><h2>'+escapeHtml(title)+'</h2><p>'+escapeHtml(msg)+'</p></div></section>'}
async function load(){
 if(!token){screen('Link inválido','Abra exatamente o link enviado pelos Trilheiros.');return}
 const {data,error}=await supabaseClient.rpc('get_public_receipt_request',{p_token:token});
 if(error||!data?.length){screen('Solicitação não encontrada','Este link é inválido ou não está mais disponível.');return}
 req=data[0];
 const s=requestStatus(req);
 if(s==='submitted'){screen('Recibo já enviado','Este link já foi utilizado. O recibo está arquivado e não pode ser alterado.','success');return}
 if(s==='expired'){screen('Link expirado','Solicite aos Trilheiros um novo link para preencher o recibo.');return}
 if(s==='cancelled'){screen('Solicitação cancelada','Este link foi cancelado e não aceita mais preenchimento.');return}
 render();
}
function render(){
 app.innerHTML=`<section class="hero-card"><h2>Olá, tudo bem? 👋</h2><p>Preencha seus dados verdadeiros, confirme o valor recebido e assine no final. Depois de enviado, o recibo será encerrado e este link não poderá ser usado novamente.</p>
 <div class="context-card"><div class="context-item"><span>Referente a</span><strong>${escapeHtml(req.event_name)}</strong></div><div class="context-item"><span>Categoria</span><strong>${escapeHtml(req.category)}</strong></div><div class="context-item"><span>Data do serviço</span><strong>${dateBR(req.service_date)}</strong></div><div class="context-item"><span>Valor previsto</span><strong>${req.expected_amount?brl(req.expected_amount):'Informe o valor recebido'}</strong></div></div></section>
 <form id="receiptForm" novalidate>
 <section class="section"><div class="section-title"><div class="step">1</div><div><h3>Identificação do fornecedor</h3><p>Informe quem recebeu o pagamento.</p></div></div>
 <div class="field full"><label class="required">Tipo de fornecedor</label><div class="radio-row"><label class="radio-pill"><input type="radio" name="supplier_type" value="PF" checked><span>Pessoa Física</span></label><label class="radio-pill"><input type="radio" name="supplier_type" value="PJ"><span>Pessoa Jurídica</span></label></div></div><div style="height:14px"></div>
 <div class="grid"><div class="field full"><label id="nameLabel" class="required">Nome completo</label><input name="legal_name" required placeholder="Nome de quem recebeu"></div><div class="field"><label id="docLabel" class="required">CPF</label><input name="cpf_cnpj" inputmode="numeric" required placeholder="000.000.000-00"></div><div class="field"><label class="required">Telefone / WhatsApp</label><input name="phone" inputmode="tel" required placeholder="(66) 99999-9999"></div><div class="field full"><label>E-mail <span class="muted">(opcional)</span></label><input name="email" type="email" placeholder="seu@email.com"></div></div></section>
 <section class="section"><div class="section-title"><div class="step">2</div><div><h3>Endereço</h3><p>Use um endereço de referência do fornecedor.</p></div></div><div class="grid-3"><div class="field"><label>CEP</label><input name="postal_code" inputmode="numeric" placeholder="00000-000"></div><div class="field" style="grid-column:span 2"><label class="required">Endereço</label><input name="address" required placeholder="Rua, avenida, comunidade ou localidade"></div><div class="field"><label>Número</label><input name="address_number" placeholder="Nº ou S/N"></div><div class="field"><label>Bairro</label><input name="neighborhood"></div><div class="field"><label>Complemento</label><input name="complement"></div><div class="field" style="grid-column:span 2"><label class="required">Cidade</label><input name="city" required></div><div class="field"><label class="required">UF</label><input name="state" maxlength="2" required placeholder="MT"></div></div></section>
 <section class="section"><div class="section-title"><div class="step">3</div><div><h3>Serviço e pagamento</h3><p>Confirme o serviço prestado e o valor realmente recebido.</p></div></div><div class="grid"><div class="field full"><label class="required">Descrição do serviço</label><textarea name="service_description" required>${escapeHtml(req.service_description||'')}</textarea></div><div class="field"><label class="required">Valor recebido</label><input name="amount_received" inputmode="decimal" required placeholder="Ex.: 2.800,00" value="${req.expected_amount?Number(req.expected_amount).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}):''}"></div><div class="field"><label class="required">Data do recebimento</label><input name="payment_date" type="date" required value="${new Date().toISOString().slice(0,10)}"></div><div class="field"><label class="required">Forma de pagamento</label><select name="payment_method" required><option>PIX</option><option>Transferência bancária</option><option>Dinheiro</option><option>Cartão</option><option>Outro</option></select></div><div class="field"><label>Observação <span class="muted">(opcional)</span></label><input name="notes" placeholder="Informação adicional"></div></div><div id="amountCheck"></div></section>
 <section class="section"><div class="section-title"><div class="step">4</div><div><h3>Assinatura e declaração</h3><p>Assine com o dedo dentro do quadro branco.</p></div></div><div class="field"><label class="required">Nome de quem está assinando</label><input name="declarant_name" required placeholder="Nome completo"></div><div style="height:14px"></div><div class="signature-wrap"><canvas id="signature" class="signature-canvas"></canvas><div class="signature-actions"><span class="muted">Assine dentro do quadro</span><button type="button" class="btn btn-secondary btn-sm" id="clearSig">Limpar assinatura</button></div></div><div style="height:14px"></div><div class="checkbox"><input id="declaration" type="checkbox" required><label for="declaration">Declaro que as informações acima são verdadeiras e que <strong>recebi o valor informado</strong> referente ao serviço descrito, dando quitação do pagamento registrado neste recibo.</label></div><div id="err" class="notice error hidden"></div><div class="actions"><button id="sendBtn" class="btn btn-primary">✓ Confirmar e enviar recibo</button></div></section></form>`;
 wire();initCanvas();
}
function wire(){
 const f=document.getElementById('receiptForm');
 f.querySelectorAll('[name=supplier_type]').forEach(x=>x.onchange=()=>{const pj=f.elements.supplier_type.value==='PJ';document.getElementById('nameLabel').textContent=pj?'Razão social':'Nome completo';document.getElementById('docLabel').textContent=pj?'CNPJ':'CPF';f.elements.cpf_cnpj.value=''});
 f.elements.cpf_cnpj.oninput=e=>e.target.value=formatCpfCnpj(e.target.value);
 f.elements.phone.oninput=e=>e.target.value=formatPhone(e.target.value);
 f.elements.postal_code.oninput=e=>e.target.value=formatCep(e.target.value);
 f.elements.state.oninput=e=>e.target.value=e.target.value.replace(/[^a-z]/gi,'').slice(0,2).toUpperCase();
 f.elements.amount_received.oninput=checkAmount;checkAmount();
 f.onsubmit=submit;
}
function checkAmount(){if(!req.expected_amount)return;const v=currencyInputToNumber(document.forms.receiptForm.elements.amount_received.value),same=Math.abs(v-Number(req.expected_amount))<.01,el=document.getElementById('amountCheck');el.className='notice '+(same?'success':'warn');el.textContent=same?'✓ Valor confere com o valor previsto: '+brl(req.expected_amount):'Atenção: valor informado '+brl(v)+' diferente do previsto '+brl(req.expected_amount)+'.';}
function initCanvas(){
 canvas=document.getElementById('signature');ctx=canvas.getContext('2d');
 const resize=()=>{const r=canvas.getBoundingClientRect(),dpr=Math.max(devicePixelRatio||1,1);canvas.width=Math.round(r.width*dpr);canvas.height=Math.round(r.height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);ctx.lineWidth=2.2;ctx.lineCap='round';ctx.strokeStyle='#17231b'};resize();
 const pos=e=>{const r=canvas.getBoundingClientRect(),p=e.touches?.[0]||e;return{x:p.clientX-r.left,y:p.clientY-r.top}};
 const start=e=>{e.preventDefault();drawing=true;signed=true;const p=pos(e);ctx.beginPath();ctx.moveTo(p.x,p.y)};
 const move=e=>{if(!drawing)return;e.preventDefault();const p=pos(e);ctx.lineTo(p.x,p.y);ctx.stroke()};
 const end=e=>{if(drawing){e.preventDefault();drawing=false;ctx.closePath()}};
 ['pointerdown'].forEach(ev=>canvas.addEventListener(ev,start,{passive:false}));canvas.addEventListener('pointermove',move,{passive:false});canvas.addEventListener('pointerup',end,{passive:false});canvas.addEventListener('pointerleave',end,{passive:false});
 document.getElementById('clearSig').onclick=()=>{ctx.clearRect(0,0,canvas.width,canvas.height);signed=false};
}
async function submit(e){
 e.preventDefault();const f=e.currentTarget,err=document.getElementById('err');err.classList.add('hidden');
 if(!f.reportValidity())return;
 if(!signed){err.textContent='Faça sua assinatura no quadro antes de enviar.';err.classList.remove('hidden');return}
 const doc=onlyDigits(f.elements.cpf_cnpj.value),type=f.elements.supplier_type.value;
 if((type==='PF'&&doc.length!==11)||(type==='PJ'&&doc.length!==14)){err.textContent='Informe um '+(type==='PF'?'CPF':'CNPJ')+' completo.';err.classList.remove('hidden');return}
 const p={supplier_type:type,legal_name:f.elements.legal_name.value.trim(),cpf_cnpj:doc,phone:onlyDigits(f.elements.phone.value),email:f.elements.email.value.trim(),postal_code:onlyDigits(f.elements.postal_code.value),address:f.elements.address.value.trim(),address_number:f.elements.address_number.value.trim(),neighborhood:f.elements.neighborhood.value.trim(),complement:f.elements.complement.value.trim(),city:f.elements.city.value.trim(),state:f.elements.state.value.trim().toUpperCase(),service_description:f.elements.service_description.value.trim(),amount_received:currencyInputToNumber(f.elements.amount_received.value),payment_date:f.elements.payment_date.value,payment_method:f.elements.payment_method.value,notes:f.elements.notes.value.trim(),declarant_name:f.elements.declarant_name.value.trim(),declaration_accepted:true,signature_data_url:canvas.toDataURL('image/png'),user_agent:navigator.userAgent};
 const btn=document.getElementById('sendBtn');btn.disabled=true;btn.textContent='Enviando...';
 const {data,error}=await supabaseClient.rpc('submit_public_receipt',{p_token:token,p_payload:p});
 if(error){err.textContent=error.message||'Não foi possível enviar.';err.classList.remove('hidden');btn.disabled=false;btn.textContent='✓ Confirmar e enviar recibo';return}
 const code=data?.[0]?.receipt_code||'Registrado';
 screen('Recibo enviado com sucesso','Protocolo: '+code+'. As informações foram salvas. Este link foi encerrado e não pode mais ser usado.','success');
}
load();
})();
