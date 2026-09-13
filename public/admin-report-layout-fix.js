/* Trilheiros Gestão — relatórios simples de ônibus e hospedagem */
(function(){
'use strict';
if(!location.pathname.startsWith('/admin'))return;
const q=(s,r=document)=>r.querySelector(s),qa=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const brDate=v=>{const s=String(v||'').slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return'—';const[y,m,d]=s.split('-');return`${d}/${m}/${y}`};
const slug=v=>String(v||'passeio').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'').toLowerCase();
function notify(msg,type=''){try{return typeof toast==='function'?toast(msg,type):alert(msg)}catch(_){alert(msg)}}
function tripById(id){return(state.trips||[]).find(t=>t.id===id)}
function activeReservations(tripId){return(state.reservations||[]).filter(r=>r.trip_id===tripId&&!['cancelled','canceled'].includes(String(r.status||'').toLowerCase()))}
async function salesMap(tripId){const ss=await db.collection('sales').where('trip_id','==',tripId).get();return new Map(ss.docs.map(d=>[d.id,{id:d.id,...d.data()}]))}
async function operationsMap(tripId){const out=new Map();try{const ss=await db.collection('trips').doc(tripId).collection('operations').get();ss.docs.forEach(d=>out.set(d.id,d.data()||{}))}catch(_){ }return out}
function selectedTripId(){return q('#v40ReportTrip')?.value||state.reportTripV40||''}
function lodgingType(r,s){return String(s?.accommodation||r?.accommodation||s?.category||r?.category||'Não informado').replaceAll('_',' ')}
function responsibleName(r,s){return String(r?.responsible_name||s?.customer_name||(r?.participants||s?.participants||[])[0]?.full_name||'Participante').trim()}
function closeEditor(){q('#reportLodgingEditor')?.remove()}
function ensureStyle(){if(q('#reportLayoutFixStyle'))return;const st=document.createElement('style');st.id='reportLayoutFixStyle';st.textContent=`.rlfModal{max-width:900px}.rlfRows{display:grid;gap:9px}.rlfRow{display:grid;grid-template-columns:1.35fr 1fr 150px;gap:10px;align-items:center;padding:11px;border:1px solid #dbe7e2;border-radius:14px;background:#fff}.rlfRow b{color:#073226}.rlfRow small{display:block;color:#6b7d75;margin-top:3px}.rlfRow input{width:100%;box-sizing:border-box;min-height:42px;border:1px solid #bfd2c9;border-radius:10px;padding:0 10px;font:inherit;font-weight:800}.rlfHint{padding:11px 13px;border-radius:12px;background:#fff8df;color:#675316;margin-bottom:12px}@media(max-width:680px){.rlfRow{grid-template-columns:1fr}.rlfModal .modalFoot{position:sticky;bottom:0;background:#fff}}`;document.head.appendChild(st)}

async function busRows(tripId){
  const sales=await salesMap(tripId),rows=[];
  activeReservations(tripId).forEach(r=>{
    const s=sales.get(r.sale_id||r.id)||{},baseEmail=String(r.email||r.customer_email||s.customer_email||s.email||'').trim(),people=(r.participants?.length?r.participants:s.participants||[]).filter(p=>p?.full_name);
    if(people.length){people.forEach(p=>rows.push({name:String(p.full_name).trim(),email:String(p.email||baseEmail||'—').trim()||'—'}))}
    else rows.push({name:responsibleName(r,s),email:baseEmail||'—'});
  });
  return rows;
}

async function generateBus(tripId){
  try{
    const t=tripById(tripId);if(!t)throw Error('Passeio não encontrado.');if(!window.jspdf?.jsPDF)throw Error('Gerador de PDF ainda carregando.');
    const rows=await busRows(tripId),{jsPDF}=window.jspdf,doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
    doc.setFont('helvetica','bold');doc.setFontSize(16);doc.text('TRILHEIROS DE RONDONÓPOLIS',14,16);doc.setFontSize(13);doc.text('RELATÓRIO DO ÔNIBUS',14,24);doc.setFont('helvetica','normal');doc.setFontSize(10);doc.text(`${t.name} • ${brDate(t.trip_date)} • ${t.destination||''}`,14,31);doc.setFont('helvetica','bold');doc.text(`QUANTIDADE DE PESSOAS: ${rows.length}`,14,38);doc.setFont('helvetica','normal');
    doc.autoTable({startY:44,head:[['Nº','NOME','E-MAIL']],body:rows.map((r,i)=>[String(i+1).padStart(2,'0'),r.name,r.email]),styles:{fontSize:8.8,cellPadding:2.5},headStyles:{fillColor:[7,50,38],textColor:[255,255,255]},columnStyles:{0:{cellWidth:12},1:{cellWidth:84},2:{cellWidth:86}}});
    const filename=`trilheiros-onibus-${slug(t.name)}.pdf`;if(typeof window.openPdfPreviewV14==='function')window.openPdfPreviewV14(doc,{filename,title:'Relatório do ônibus',subtitle:`${t.name} • ${rows.length} pessoa(s)`,shareText:`Relatório do ônibus — ${t.name}`});else doc.save(filename);
  }catch(e){console.error('BUS_REPORT_SIMPLE',e);notify(e.message||'Erro ao gerar relatório do ônibus.','error')}
}

async function lodgingRows(tripId){
  const [sales,ops]=await Promise.all([salesMap(tripId),operationsMap(tripId)]);
  return activeReservations(tripId).map(r=>{const s=sales.get(r.sale_id||r.id)||{},op=ops.get(r.id)||{};return{id:r.id,name:responsibleName(r,s),type:lodgingType(r,s),room:String(op.room_number||op.room||r.room_number||r.room||s.room_number||s.room||'').trim()}});
}
function pdfLodging(t,rows){
  const {jsPDF}=window.jspdf,doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});doc.setFont('helvetica','bold');doc.setFontSize(16);doc.text('TRILHEIROS DE RONDONÓPOLIS',14,16);doc.setFontSize(13);doc.text('RELATÓRIO DE HOSPEDAGEM',14,24);doc.setFont('helvetica','normal');doc.setFontSize(10);doc.text(`${t.name} • ${brDate(t.trip_date)} • ${t.destination||''}`,14,31);doc.setFont('helvetica','bold');doc.text(`TOTAL DE RESERVAS: ${rows.length}`,14,38);doc.setFont('helvetica','normal');doc.autoTable({startY:44,head:[['Nº','NOME','TIPO DE HOSPEDAGEM','QUARTO']],body:rows.map((r,i)=>[String(i+1).padStart(2,'0'),r.name,r.type,r.room||'—']),styles:{fontSize:8.8,cellPadding:2.5},headStyles:{fillColor:[7,50,38],textColor:[255,255,255]},columnStyles:{0:{cellWidth:12},1:{cellWidth:76},2:{cellWidth:66},3:{cellWidth:28}}});const filename=`trilheiros-hospedagem-${slug(t.name)}.pdf`;if(typeof window.openPdfPreviewV14==='function')window.openPdfPreviewV14(doc,{filename,title:'Relatório de hospedagem',subtitle:`${t.name} • ${rows.length} reserva(s)`,shareText:`Relatório de hospedagem — ${t.name}`});else doc.save(filename)
}
async function openLodgingEditor(tripId){
  try{
    const t=tripById(tripId);if(!t)throw Error('Passeio não encontrado.');if(!window.jspdf?.jsPDF)throw Error('Gerador de PDF ainda carregando.');ensureStyle();const rows=await lodgingRows(tripId);closeEditor();const back=document.createElement('div');back.id='reportLodgingEditor';back.className='modalBack';back.innerHTML=`<div class="modal rlfModal"><div class="modalHead"><div><span class="eyebrow">HOSPEDAGEM</span><h2>${esc(t.name)}</h2><p>Uma linha por reserva. Informe ou altere o número do quarto antes de gerar o relatório.</p></div><button type="button" class="iconClose" id="rlfClose">✕</button></div><div class="modalBody"><div class="rlfHint">O relatório mostra somente <b>nome da reserva</b>, <b>tipo de hospedagem</b> e <b>número do quarto</b>. Casal ou quarto compartilhado aparece uma única vez por reserva.</div><div class="rlfRows">${rows.map((r,i)=>`<div class="rlfRow" data-row="${esc(r.id)}"><div><b>${esc(r.name)}</b><small>Reserva ${i+1}</small></div><div><b>${esc(r.type)}</b></div><div><input class="rlfRoom" placeholder="Nº do quarto" value="${esc(r.room)}"></div></div>`).join('')||'<div class="rlfHint">Nenhuma reserva de hospedagem encontrada.</div>'}</div><div id="rlfMsg"></div></div><div class="modalFoot"><button type="button" class="btn ghost" id="rlfCancel">Fechar</button><button type="button" class="btn primary" id="rlfGenerate">Salvar quartos e gerar PDF</button></div></div>`;document.body.appendChild(back);q('#rlfClose',back).onclick=q('#rlfCancel',back).onclick=closeEditor;back.onclick=e=>{if(e.target===back)closeEditor()};q('#rlfGenerate',back).onclick=async()=>{const btn=q('#rlfGenerate',back),msg=q('#rlfMsg',back);btn.disabled=true;btn.textContent='Salvando...';try{const latest=rows.map(r=>({...r,room:String(q(`[data-row="${CSS.escape(r.id)}"] .rlfRoom`,back)?.value||'').trim()}));for(let i=0;i<latest.length;i+=400){const batch=db.batch();latest.slice(i,i+400).forEach(r=>batch.set(db.collection('trips').doc(tripId).collection('operations').doc(r.id),{reservation_id:r.id,room_number:r.room,room:r.room,lodging_type:r.type,updated_at:firebase.firestore.FieldValue.serverTimestamp()},{merge:true}));await batch.commit()}closeEditor();pdfLodging(t,latest)}catch(e){msg.innerHTML=`<div class="msg error">${esc(e.message||e)}</div>`;btn.disabled=false;btn.textContent='Salvar quartos e gerar PDF'}};
  }catch(e){console.error('HOTEL_REPORT_SIMPLE',e);notify(e.message||'Erro ao abrir relatório de hospedagem.','error')}
}

document.addEventListener('click',e=>{const b=e.target?.closest?.('[data-v40-report]');if(!b)return;const kind=b.dataset.v40Report;if(kind!=='bus'&&kind!=='hotel')return;e.preventDefault();e.stopImmediatePropagation();const tripId=selectedTripId();if(!tripId)return notify('Selecione um passeio.','error');if(kind==='bus')void generateBus(tripId);else void openLodgingEditor(tripId)},true);
window.generateBusReportSimple=generateBus;window.openLodgingReportEditor=openLodgingEditor;
})();