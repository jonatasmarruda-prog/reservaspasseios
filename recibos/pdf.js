async function generateReceiptPDF(r,q,b,mode='download'){
  const previewWindow=mode==='preview'?window.open('about:blank','_blank'):null;
  const {jsPDF}=window.jspdf;
  const d=new jsPDF({unit:'mm',format:'a4'});
  const M=16, PAGE_W=210, CONTENT_W=PAGE_W-M*2, GREEN=[16,43,28], MID=[31,111,67], SOFT=[241,246,243];

  const clean=v=>String(v??'').trim();
  const serviceType=r.service_type||q?.category||'—';
  const serviceDate=r.service_date||q?.service_date||r.payment_date;
  const address=[r.address,r.address_number,r.neighborhood,r.complement,r.city,r.state].filter(Boolean).join(', ');
  const pricingText=r.billing_mode==='per_person'?(String(r.quantity_people||0)+' pessoa(s) × '+brl(r.unit_amount||0)+' = '+brl(r.amount_received)):'Valor total: '+brl(r.amount_received);
  const validationUrl=new URL('validation.html?code='+encodeURIComponent(r.receipt_code||'')+'&v='+encodeURIComponent(r.verification_code||''),new URL('./',location.href)).href;
  let qrData=null;
  try{if(window.QRCode?.toDataURL)qrData=await window.QRCode.toDataURL(validationUrl,{width:180,margin:1})}catch(e){}

  function ensure(h){
    if(y+h>278){
      d.addPage();
      y=18;
    }
  }
  function title(text){
    ensure(12);
    d.setTextColor(...MID);d.setFont('helvetica','bold');d.setFontSize(12.5);d.text(text,M,y);y+=7;
  }
  function line(){
    d.setDrawColor(218,224,220);d.line(M,y,PAGE_W-M,y);y+=5;
  }
  function field(label,value,x,width){
    const val=clean(value)||'—';
    d.setFont('helvetica','bold');d.setFontSize(7.8);d.setTextColor(105);d.text(label.toUpperCase(),x,y);
    d.setFont('helvetica','normal');d.setFontSize(10);d.setTextColor(32);
    const lines=d.splitTextToSize(val,width);
    d.text(lines,x,y+5);
    return lines.length;
  }
  function pair(l1,v1,l2,v2){
    ensure(18);
    const n1=field(l1,v1,M,82);
    const n2=field(l2,v2,110,84);
    y+=6+Math.max(n1,n2)*4.5;
  }
  function full(label,value){
    ensure(18);
    const n=field(label,value,M,CONTENT_W);
    y+=6+n*4.5;
  }

  d.setFillColor(...GREEN);d.rect(0,0,PAGE_W,34,'F');
  d.setTextColor(255);d.setFont('helvetica','bold');d.setFontSize(16);d.text(b.business_name||'Trilheiros de Rondonópolis',M,12);
  d.setFont('helvetica','normal');d.setFontSize(8.8);d.text('RECIBO DIGITAL DE PAGAMENTO A FORNECEDOR',M,20);
  d.setFont('helvetica','bold');d.setFontSize(10);d.text('RECIBO Nº '+(r.receipt_code||'—'),PAGE_W-M,12,{align:'right'});
  d.setFont('helvetica','normal');d.setFontSize(8.3);d.text('Validação: '+(r.verification_code||'—'),PAGE_W-M,19,{align:'right'});

  let y=45;
  d.setFillColor(...SOFT);d.roundedRect(M,y-5,CONTENT_W,17,3,3,'F');
  d.setTextColor(...GREEN);d.setFont('helvetica','bold');d.setFontSize(8);d.text('VALOR RECEBIDO',M+5,y+1);
  d.setFontSize(18);d.text(brl(r.amount_received),M+5,y+9);
  d.setFontSize(8);d.setTextColor(95);d.text('Data do recebimento',123,y+1);
  d.setTextColor(32);d.setFontSize(10);d.text(dateBR(r.payment_date),123,y+8);
  y+=20;

  title('Dados do fornecedor');
  pair(r.supplier_type==='PJ'?'Razão social':'Nome completo',r.legal_name,r.supplier_type==='PJ'?'CNPJ':'CPF',formatCpfCnpj(r.cpf_cnpj));
  pair('Telefone / WhatsApp',formatPhone(r.phone),'E-mail',r.email||'Não informado');
  full('Endereço',address);
  pair('CEP',r.postal_code?formatCep(r.postal_code):'Não informado','Cidade / UF',[r.city,r.state].filter(Boolean).join(' / '));
  line();

  title('Serviço prestado');
  pair('Tipo de serviço',serviceType,'Data do serviço',dateBR(serviceDate));
  full('Descrição do serviço',r.service_description||serviceType);
  pair('Forma de pagamento',r.payment_method||'—','Cálculo do valor',pricingText);
  pair('Assinado por',r.declarant_name||r.legal_name,'Anexo',r.attachment_name||'Não informado');
  if(r.notes) full('Observação',r.notes);
  line();

  title('Declaração');
  ensure(36);
  const contractor=[
    b.business_name||'Trilheiros de Rondonópolis',
    b.cnpj?'CNPJ '+b.cnpj:'',
    b.city&&b.state?b.city+' / '+b.state:''
  ].filter(Boolean).join(' — ');
  const declaration='Declaro, para os devidos fins, que recebi de '+contractor+' o valor de '+brl(r.amount_received)+', referente ao serviço acima descrito, dando quitação do pagamento registrado neste recibo. Confirmo que os dados informados são verdadeiros e que a assinatura abaixo foi realizada eletronicamente.';
  d.setFont('helvetica','normal');d.setFontSize(9.7);d.setTextColor(45);
  const declLines=d.splitTextToSize(declaration,CONTENT_W);
  d.text(declLines,M,y);
  y+=declLines.length*4.8+6;

  title('Assinatura do fornecedor');
  ensure(40);
  if(r.signature_data_url){
    try{
      d.setFillColor(252,252,252);d.roundedRect(M,y-2,92,30,2,2,'F');
      d.addImage(r.signature_data_url,'PNG',M+3,y,82,24);
    }catch{}
  }
  y+=31;
  d.setDrawColor(120);d.line(M,y,M+92,y);
  d.setFont('helvetica','bold');d.setFontSize(9.2);d.setTextColor(35);d.text(r.declarant_name||r.legal_name,M,y+5);
  d.setFont('helvetica','normal');d.setFontSize(8);d.setTextColor(100);d.text('Responsável pela declaração e assinatura',M,y+10);
  y+=17;
  line();

  title('Registro eletrônico');
  ensure(28);
  pair('Protocolo',r.receipt_code||'—','Código de validação',r.verification_code||'—');
  pair('Registrado em',dateTimeBR(r.created_at),'Identificador',String(r.id||'').slice(0,24));
  if(qrData){
    ensure(36);
    try{d.addImage(qrData,'PNG',M,y,28,28)}catch(e){}
    d.setFont('helvetica','bold');d.setFontSize(8);d.setTextColor(70);d.text('VALIDAR ESTE DOCUMENTO',M+34,y+7);
    d.setFont('helvetica','normal');d.setFontSize(7.4);d.setTextColor(105);
    d.text(d.splitTextToSize('Escaneie o QR Code ou acesse a página de validação usando o número do recibo e o código acima.',CONTENT_W-38),M+34,y+13);
    y+=33;
  }

  d.setFillColor(248,249,248);d.roundedRect(M,y-1,CONTENT_W,18,2,2,'F');
  d.setFont('helvetica','normal');d.setFontSize(7.5);d.setTextColor(95);
  d.text('Este documento registra uma declaração de recebimento. Quando houver obrigação fiscal aplicável, nota fiscal ou documento equivalente continua sendo exigido conforme a legislação.',M+4,y+5,{maxWidth:CONTENT_W-8});
  y+=20;

  d.setDrawColor(230);d.line(M,287,PAGE_W-M,287);
  d.setFontSize(7.5);d.setTextColor(115);
  d.text((b.business_name||'Trilheiros de Rondonópolis')+' • Gestão de Recibos',M,292);
  d.text('Página '+d.getNumberOfPages(),PAGE_W-M,292,{align:'right'});

  const filename='recibo_'+String(r.receipt_code||'documento').replace(/[^a-zA-Z0-9_-]/g,'_')+'.pdf';
  if(mode==='preview'){
    const blob=d.output('blob');
    const url=URL.createObjectURL(blob);
    if(previewWindow)previewWindow.location.href=url;else window.open(url,'_blank','noopener');
    setTimeout(()=>URL.revokeObjectURL(url),60000);
  }else{
    d.save(filename);
  }
  return d;
}
async function previewReceiptPDF(r,q,b){return generateReceiptPDF(r,q,b,'preview')}
window.generateReceiptPDF=generateReceiptPDF;
window.previewReceiptPDF=previewReceiptPDF;