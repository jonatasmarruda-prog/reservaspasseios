/* Trilheiros Gestão V16 — PDFs sempre abrem na prévia antes de baixar/compartilhar */
(function(){
  const LOGO='https://i.postimg.cc/JnF2F9Hw/LOGO-TRILHEIROS-Photoroom.png';
  const digits=v=>String(v||'').replace(/\D/g,'');
  const slug=v=>String(v||'arquivo').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const dateLabel=v=>typeof date==='function'?date(v):String(v||'');
  const cpfLabel=v=>digits(v)?(typeof cpf==='function'?cpf(v):v):'—';
  const statusLabel=v=>{try{return typeof status!=='undefined'&&status?.[v]?status[v]:v}catch{return v}};
  const special=()=>window.TRILHEIROS_SPECIAL_PASSENGER||{key:'trilheiros-guia-jonatas',name:'Jonatas — Guia de Turismo',role:'GUIA DE TURISMO'};

  function actualPeople(tripId){
    const out=[];
    (state?.reservations||[]).filter(r=>r.trip_id===tripId&&r.status!=='cancelled').forEach(r=>{
      (r.participants||[]).forEach((p,i)=>out.push({key:digits(p.cpf)||`${r.id}-${i}`,name:p.full_name||'',cpf:p.cpf||'',responsible:r.responsible_name||'',special:false}));
    });
    return out;
  }
  function peopleWithGuide(tripId){
    const s=special();
    return [{key:s.key,name:s.name,cpf:'',responsible:s.role,special:true},...actualPeople(tripId)];
  }
  async function logoData(){
    try{const r=await fetch(LOGO);const b=await r.blob();return await new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>res(fr.result);fr.onerror=rej;fr.readAsDataURL(b)})}catch{return null}
  }
  async function opsForTrip(id){
    const out={};
    try{const s=await db.collection('trips').doc(id).collection('operations').get();s.docs.forEach(d=>out[d.id]={id:d.id,...d.data()})}catch(_){ }
    return out;
  }
  function preview(doc,options){
    if(typeof window.openPdfPreviewV14==='function'){
      window.openPdfPreviewV14(doc,options);
      return true;
    }
    console.warn('Visualizador de PDF não carregou; usando abertura em nova guia como fallback.');
    const url=doc.output('bloburl');
    window.open(url,'_blank','noopener');
    return false;
  }

  window.pdfTrip=async function(id){
    if(!id)return toast('Selecione um passeio.','error');
    const t=(state?.trips||[]).find(x=>x.id===id);if(!t)return toast('Passeio não encontrado.','error');
    const btn=document.activeElement,old=btn?.textContent;if(btn?.tagName==='BUTTON'){btn.disabled=true;btn.textContent='Gerando PDF...'}
    try{
      await ensurePdfLibraries();
      const {jsPDF}=window.jspdf,doc=new jsPDF({unit:'mm',format:'a4'}),people=peopleWithGuide(id),rs=(state.reservations||[]).filter(r=>r.trip_id===id&&r.status!=='cancelled'),logo=await logoData();
      doc.setFillColor(7,50,38);doc.rect(0,0,210,58,'F');doc.setFillColor(216,173,66);doc.rect(0,58,210,2,'F');if(logo)try{doc.addImage(logo,'PNG',14,9,30,30)}catch(_){}
      doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(10);doc.text('TRILHEIROS DE RONDONÓPOLIS',logo?51:14,17);doc.setFontSize(22);doc.text('LISTA OFICIAL DE PARTICIPANTES',logo?51:14,29);doc.setFontSize(10);doc.setFont('helvetica','normal');doc.text(`${t.name}`,logo?51:14,39);doc.text(`${dateLabel(t.trip_date)} • ${t.destination||''}`,logo?51:14,46);
      doc.setTextColor(20,45,35);doc.setFont('helvetica','bold');doc.setFontSize(15);doc.text('Resumo do passeio',14,73);
      const summary=[['Participantes',String(people.length)],['Reservas',String(rs.length)],['Vagas ocupadas',`${t.used_spots||0}/${t.total_spots||0}`],['Status',statusLabel(t.status)]];
      summary.forEach((x,i)=>{const x0=14+i*46;doc.setFillColor(244,248,246);doc.roundedRect(x0,80,42,20,3,3,'F');doc.setTextColor(95,115,107);doc.setFontSize(7);doc.text(x[0].toUpperCase(),x0+3,87);doc.setTextColor(10,55,42);doc.setFontSize(12);doc.text(String(x[1]),x0+3,95)});
      doc.setFontSize(9);doc.setTextColor(60,80,72);doc.text('Documento gerado pelo Trilheiros Gestão • O guia ocupa a vaga nº 1.',14,110);
      const body=people.map((p,i)=>[String(i+1).padStart(2,'0'),p.name,p.special?'—':cpfLabel(p.cpf),p.special?'GUIA DE TURISMO':(p.responsible||'')]);
      doc.autoTable({startY:118,head:[['Nº','NOME DO PARTICIPANTE','CPF','RESPONSÁVEL / FUNÇÃO']],body,theme:'grid',styles:{font:'helvetica',fontSize:8.3,cellPadding:2.7,textColor:[25,48,40],lineColor:[220,231,226],lineWidth:.15},headStyles:{fillColor:[7,50,38],textColor:[255,255,255],fontStyle:'bold',fontSize:8.5},alternateRowStyles:{fillColor:[247,250,248]},columnStyles:{0:{cellWidth:12,halign:'center'},1:{cellWidth:76},2:{cellWidth:40},3:{cellWidth:54}},margin:{left:14,right:14,bottom:16},didDrawPage:data=>{doc.setFontSize(7.5);doc.setTextColor(100);doc.text(`Trilheiros de Rondonópolis • ${t.name}`,14,291);doc.text(`Página ${data.pageNumber}`,190,291,{align:'right'})}});
      const pages=doc.internal.getNumberOfPages();for(let i=1;i<=pages;i++){doc.setPage(i);doc.setFontSize(7);doc.setTextColor(120);doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')} • Total no transporte: ${people.length}`,14,286)}
      const filename=`lista-oficial-${slug(t.name)}-${String(t.trip_date||'').slice(0,10)}.pdf`;
      preview(doc,{filename,title:'Lista oficial de participantes',subtitle:`${t.name} • ${dateLabel(t.trip_date)}`,shareText:`Lista oficial de participantes — ${t.name} — Trilheiros de Rondonópolis`});
      window.auditV7?.('pdf','trip',id,`PDF visualizado com guia + ${people.length-1} participante(s)`);
    }catch(e){console.error(e);toast('Não foi possível gerar o PDF agora. Verifique sua internet e tente novamente.','error')}finally{if(btn?.tagName==='BUTTON'){btn.disabled=false;btn.textContent=old||'PDF'}}
  };

  window.driverPdfV7=async function(id){
    const t=(state?.trips||[]).find(x=>x.id===id);if(!t)return toast('Passeio não encontrado.','error');
    try{
      await ensurePdfLibraries();const ops=await opsForTrip(id),{jsPDF}=window.jspdf,doc=new jsPDF();
      const people=peopleWithGuide(id).map(p=>({...p,...(ops[p.key]||{})})).sort((a,b)=>(a.special?-1:0)-(b.special?-1:0)||String(a.vehicle||'ZZ').localeCompare(String(b.vehicle||'ZZ'))||String(a.seat||'').localeCompare(String(b.seat||'')));
      doc.setFillColor(7,50,38);doc.rect(0,0,210,35,'F');doc.setTextColor(255);doc.setFontSize(19);doc.text('LISTA DE TRANSPORTE',14,17);doc.setFontSize(9);doc.text(`${t.name} • ${dateLabel(t.trip_date)}`,14,26);
      doc.autoTable({startY:43,head:[['Nº','Participante','Veículo','Assento']],body:people.map((p,i)=>[i+1,p.name,p.vehicle||'—',p.seat||'—']),headStyles:{fillColor:[7,50,38]},styles:{fontSize:9,cellPadding:2.5},margin:{left:14,right:14}});
      preview(doc,{filename:`transporte-${slug(t.name)}.pdf`,title:'Lista de transporte',subtitle:`${t.name} • ${dateLabel(t.trip_date)}`,shareText:`Lista de transporte — ${t.name} — Trilheiros de Rondonópolis`});
    }catch(e){console.error(e);toast('Não foi possível gerar a lista de transporte.','error')}
  };

  window.roomsPdfV7=async function(id){
    const t=(state?.trips||[]).find(x=>x.id===id);if(!t)return toast('Passeio não encontrado.','error');
    try{
      await ensurePdfLibraries();const ops=await opsForTrip(id),{jsPDF}=window.jspdf,doc=new jsPDF();
      const people=peopleWithGuide(id).map(p=>({...p,...(ops[p.key]||{})})).sort((a,b)=>(a.special?-1:0)-(b.special?-1:0)||String(a.room||'ZZ').localeCompare(String(b.room||'ZZ')));
      doc.setFillColor(7,50,38);doc.rect(0,0,210,35,'F');doc.setTextColor(255);doc.setFontSize(19);doc.text('MAPA DE HOSPEDAGEM',14,17);doc.setFontSize(9);doc.text(`${t.name} • ${dateLabel(t.trip_date)}`,14,26);
      doc.autoTable({startY:43,head:[['Nº','Participante','CPF','Quarto']],body:people.map((p,i)=>[i+1,p.name,p.special?'—':cpfLabel(p.cpf),p.room||'—']),headStyles:{fillColor:[7,50,38]},styles:{fontSize:8.7,cellPadding:2.4},margin:{left:14,right:14}});
      preview(doc,{filename:`quartos-${slug(t.name)}.pdf`,title:'Mapa de hospedagem',subtitle:`${t.name} • ${dateLabel(t.trip_date)}`,shareText:`Mapa de hospedagem — ${t.name} — Trilheiros de Rondonópolis`});
    }catch(e){console.error(e);toast('Não foi possível gerar o mapa de hospedagem.','error')}
  };

  /* Reaplica após renderizações antigas que possam substituir as funções. */
  window.__TRILHEIROS_PDF_V16=true;
})();
