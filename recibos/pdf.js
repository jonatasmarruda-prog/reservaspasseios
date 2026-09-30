function generateReceiptPDF(r,q,b){
 const {jsPDF}=window.jspdf;const d=new jsPDF({unit:'mm',format:'a4'}),M=18,W=210-M*2;
 const line=(y)=>{d.setDrawColor(210);d.line(M,y,210-M,y)};
 const block=(label,val,x,y,w)=>{d.setFont('helvetica','bold');d.setFontSize(8);d.setTextColor(95);d.text(label.toUpperCase(),x,y);d.setFont('helvetica','normal');d.setFontSize(10.5);d.setTextColor(25);const ls=d.splitTextToSize(String(val||'—'),w);d.text(ls,x,y+5);return y+5+ls.length*5};
 d.setFillColor(16,43,28);d.rect(0,0,210,30,'F');d.setTextColor(255);d.setFont('helvetica','bold');d.setFontSize(16);d.text(b.business_name||'Trilheiros de Rondonópolis',M,13);d.setFontSize(9);d.setFont('helvetica','normal');d.text('RECIBO DE PAGAMENTO A FORNECEDOR',M,21);
 d.setFont('helvetica','bold');d.text('RECIBO Nº '+(r.receipt_code||'—'),210-M,13,{align:'right'});d.setFont('helvetica','normal');d.text('Validação: '+(r.verification_code||'—'),210-M,20,{align:'right'});
 let y=42;d.setTextColor(31,111,67);d.setFont('helvetica','bold');d.setFontSize(13);d.text('Identificação do recebedor',M,y);y+=8;
 y=Math.max(block(r.supplier_type==='PJ'?'Razão social':'Nome completo',r.legal_name,M,y,82),block(r.supplier_type==='PJ'?'CNPJ':'CPF',formatCpfCnpj(r.cpf_cnpj),108,y,84))+3;line(y);y+=8;
 y=Math.max(block('Telefone',formatPhone(r.phone),M,y,82),block('E-mail',r.email||'Não informado',108,y,84))+2;
 y=block('Endereço',[r.address,r.address_number,r.neighborhood,r.complement,r.city,r.state].filter(Boolean).join(', '),M,y,W)+4;
 d.setTextColor(31,111,67);d.setFont('helvetica','bold');d.setFontSize(13);d.text('Serviço e pagamento',M,y);y+=8;
 y=Math.max(block('Referente a',q?.event_name||'—',M,y,82),block('Categoria',q?.category||'—',108,y,84))+2;
 y=block('Descrição do serviço',r.service_description,M,y,W)+2;
 y=Math.max(block('Data do serviço',dateBR(q?.service_date),M,y,82),block('Data do recebimento',dateBR(r.payment_date),108,y,84))+2;
 block('Forma de pagamento',r.payment_method,M,y,82);d.setFont('helvetica','bold');d.setFontSize(9);d.setTextColor(95);d.text('VALOR RECEBIDO',108,y);d.setFontSize(17);d.setTextColor(31,111,67);d.text(brl(r.amount_received),108,y+8);y+=18;line(y);y+=9;
 const decl='Declaro, para os devidos fins, que recebi de '+(b.business_name||'Trilheiros de Rondonópolis')+(b.cnpj?' — CNPJ '+b.cnpj:'')+', o valor acima indicado, referente ao serviço descrito neste documento, dando quitação do pagamento registrado.';
 d.setFont('helvetica','normal');d.setFontSize(10.5);d.setTextColor(35);const ls=d.splitTextToSize(decl,W);d.text(ls,M,y);y+=ls.length*5+7;
 if(r.signature_data_url){try{d.addImage(r.signature_data_url,'PNG',M,y,72,27)}catch{}}y+=32;d.setDrawColor(120);d.line(M,y,M+84,y);d.setFontSize(9.5);d.text(r.declarant_name||r.legal_name,M,y+5);y+=16;line(y);y+=7;
 d.setFontSize(8.3);d.setTextColor(105);d.text('Documento registrado eletronicamente em '+dateTimeBR(r.created_at)+'.',M,y);d.text('Código de validação: '+(r.verification_code||'—')+' • ID: '+String(r.id||'').slice(0,18),M,y+5);d.text('Este recibo registra uma declaração de recebimento. Documentos fiscais obrigatórios continuam sujeitos à legislação aplicável.',M,y+10,{maxWidth:W});
 d.save('recibo_'+String(r.receipt_code||'documento').replace(/[^a-zA-Z0-9_-]/g,'_')+'.pdf');
}
window.generateReceiptPDF=generateReceiptPDF;