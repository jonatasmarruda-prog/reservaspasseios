(()=>{
const {supabaseClient}=window.ReceiptsApp;
const form=document.getElementById('validateForm');
const result=document.getElementById('validationResult');
const params=new URLSearchParams(location.search);
document.getElementById('code').value=params.get('code')||'';
document.getElementById('verification').value=params.get('v')||'';

function statusText(s){return ({pending_review:'Aguardando conferência',reviewed:'Conferido pela contabilidade',pending_issue:'Com pendência',cancelled:'Cancelado'})[s]||s}
async function validate(){
  const code=document.getElementById('code').value.trim(),v=document.getElementById('verification').value.trim();
  if(!code||!v)return;
  result.innerHTML='<div class="notice info">Validando documento...</div>';
  const {data,error}=await supabaseClient.rpc('validate_receipt',{p_code:code,p_verification:v});
  const r=data?.[0];
  if(error||!r){
    result.innerHTML='<div class="validation-card invalid"><div class="validation-icon">!</div><h3>Recibo não localizado</h3><p>Confira o número e o código de validação.</p></div>';
    return;
  }
  result.innerHTML=`<div class="validation-card valid"><div class="validation-icon">✓</div><h3>Documento válido</h3><p>Este recibo consta na base dos Trilheiros de Rondonópolis.</p><div class="detail-grid"><div class="detail"><span>Recibo</span><strong>${escapeHtml(r.receipt_code)}</strong></div><div class="detail"><span>Situação</span><strong>${escapeHtml(statusText(r.accounting_status))}</strong></div><div class="detail"><span>Fornecedor</span><strong>${escapeHtml(r.supplier_name)}</strong></div><div class="detail"><span>Documento</span><strong>${escapeHtml(r.document_masked)}</strong></div><div class="detail"><span>Tipo de serviço</span><strong>${escapeHtml(r.service_type)}</strong></div><div class="detail"><span>Data do serviço</span><strong>${dateBR(r.service_date)}</strong></div><div class="detail"><span>Valor</span><strong>${brl(r.amount_received)}</strong></div><div class="detail"><span>Registrado em</span><strong>${dateTimeBR(r.created_at)}</strong></div></div></div>`;
}
form.onsubmit=e=>{e.preventDefault();validate()};
if(form.code?.value||document.getElementById('code').value)validate();
})();