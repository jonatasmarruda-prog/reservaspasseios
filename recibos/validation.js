(()=>{
const {supabaseClient}=window.ReceiptsApp;
const form=document.getElementById('validateForm');
const result=document.getElementById('validationResult');
const params=new URLSearchParams(location.search);
document.getElementById('code').value=params.get('code')||'';
document.getElementById('verification').value=params.get('v')||'';
let current=null;

function statusText(s){return ({pending_review:'Aguardando conferência',reviewed:'Conferido pela contabilidade',pending_issue:'Com pendência',cancelled:'Cancelado'})[s]||s}
function billingText(r){
  return r.billing_mode==='per_person'
    ? (String(r.quantity_people||0)+' pessoa(s) × '+brl(r.unit_amount||0))
    : 'Valor total';
}
function downloadValidationPDF(r){
  const {jsPDF}=window.jspdf||{};
  if(!jsPDF){toast('Gerador de PDF indisponível. Atualize a página.','error');return}
  const d=new jsPDF({unit:'mm',format:'a4'}),M=16,W=178;
  d.setFillColor(16,43,28);d.rect(0,0,210,34,'F');
  d.setTextColor(255);d.setFont('helvetica','bold');d.setFontSize(16);d.text(r.business_name||'Trilheiros de Rondonópolis',M,13);
  d.setFont('helvetica','normal');d.setFontSize(8.5);d.text('COMPROVANTE DE VALIDAÇÃO DE RECIBO',M,21);
  d.setFont('helvetica','bold');d.setFontSize(10);d.text(r.receipt_code||'—',194,13,{align:'right'});
  let y=48;
  d.setFillColor(239,248,242);d.roundedRect(M,y-5,W,20,3,3,'F');
  d.setTextColor(25,103,59);d.setFont('helvetica','bold');d.setFontSize(14);d.text('✓ DOCUMENTO VÁLIDO',M+6,y+6);
  y+=26;
  const field=(label,value)=>{
    d.setFont('helvetica','bold');d.setFontSize(7.5);d.setTextColor(110);d.text(label.toUpperCase(),M,y);
    d.setFont('helvetica','normal');d.setFontSize(10);d.setTextColor(35);
    const lines=d.splitTextToSize(String(value||'—'),W);d.text(lines,M,y+5);y+=7+lines.length*4;
  };
  field('Fornecedor',r.supplier_name);
  field('Documento',r.document_masked);
  field('Tipo de serviço',r.service_type+(r.service_reference?' — '+r.service_reference:''));
  field('Data do serviço',dateBR(r.service_date));
  field('Forma de cobrança',billingText(r));
  field('Valor recebido',brl(r.amount_received));
  field('Data do recebimento',dateBR(r.payment_date));
  field('Forma de pagamento',r.payment_method);
  field('Situação contábil',statusText(r.accounting_status));
  field('Código de validação',r.verification_code);
  d.setDrawColor(220);d.line(M,276,194,276);
  d.setFontSize(7.5);d.setTextColor(110);
  d.text('Validação emitida em '+new Date().toLocaleString('pt-BR')+'. Este comprovante confirma a existência do recibo no sistema.',M,283,{maxWidth:W});
  d.save('validacao_'+String(r.receipt_code||'recibo').replace(/[^A-Za-z0-9_-]/g,'_')+'.pdf');
}
async function validate(){
  const code=document.getElementById('code').value.trim(),v=document.getElementById('verification').value.trim();
  if(!code||!v)return;
  result.innerHTML='<div class="notice info">Validando documento...</div>';
  const {data,error}=await supabaseClient.rpc('validate_receipt',{p_code:code,p_verification:v});
  const r=data?.[0];current=r||null;
  if(error||!r){
    result.innerHTML='<div class="validation-card invalid"><div class="validation-icon">!</div><h3>Recibo não localizado</h3><p>Confira o número e o código de validação.</p></div>';
    return;
  }
  result.innerHTML=`<div class="validation-card valid"><div class="validation-seal"><div class="validation-icon">✓</div><div><span>VALIDAÇÃO DIGITAL</span><h3>Documento válido</h3><p>Este recibo consta na base oficial dos Trilheiros de Rondonópolis.</p></div></div><div class="detail-grid"><div class="detail"><span>Recibo</span><strong>${escapeHtml(r.receipt_code)}</strong></div><div class="detail"><span>Situação</span><strong>${escapeHtml(statusText(r.accounting_status))}</strong></div><div class="detail"><span>Fornecedor</span><strong>${escapeHtml(r.supplier_name)}</strong></div><div class="detail"><span>Documento</span><strong>${escapeHtml(r.document_masked)}</strong></div><div class="detail"><span>Tipo de serviço</span><strong>${escapeHtml(r.service_type)}</strong></div><div class="detail"><span>Referência</span><strong>${escapeHtml(r.service_reference||'Não informada')}</strong></div><div class="detail"><span>Data do serviço</span><strong>${dateBR(r.service_date)}</strong></div><div class="detail"><span>Forma de cobrança</span><strong>${escapeHtml(billingText(r))}</strong></div><div class="detail"><span>Valor</span><strong>${brl(r.amount_received)}</strong></div><div class="detail"><span>Recebimento</span><strong>${dateBR(r.payment_date)} • ${escapeHtml(r.payment_method||'—')}</strong></div><div class="detail"><span>Registrado em</span><strong>${dateTimeBR(r.created_at)}</strong></div></div><div class="actions"><button class="btn btn-primary" id="downloadValidation">Baixar comprovante em PDF</button></div></div>`;
  document.getElementById('downloadValidation').onclick=()=>downloadValidationPDF(r);
}
form.onsubmit=e=>{e.preventDefault();validate()};
if(document.getElementById('code').value&&document.getElementById('verification').value)validate();
})();