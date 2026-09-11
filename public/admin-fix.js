// Correções complementares do painel administrativo.
(function(){
  function attachModalRemove(){
    if(typeof window.modal === 'function'){
      window.modal.remove = function(){
        const el=document.getElementById('modal');
        if(el) el.remove();
      };
    }
  }

  function loadTripWeather(){
    if(!location.pathname.startsWith('/admin')||document.querySelector('script[data-admin-weather]'))return;
    const s=document.createElement('script');
    s.src='/admin-weather.js?v=20260911-stable-admin1';
    s.defer=true;
    s.dataset.adminWeather='1';
    document.head.appendChild(s);
  }

  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
  function digits(v){return String(v||'').replace(/\D/g,'')}
  function slug(v){return String(v||'arquivo').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}
  function brDate(v){const s=String(v||'').slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return s||'—';const[y,m,d]=s.split('-');return`${d}/${m}/${y}`}
  function appState(){try{if(typeof state!=='undefined')return state;return window.state||globalThis.state||null}catch(_){return window.state||globalThis.state||null}}

  function installRoomEditor(){
    if(typeof window.structureModalV7!=='function'||window.structureModalV7.__roomEditorV2)return false;

    window.addAccommodationRow=function(data={}){
      const host=document.getElementById('accommodationRows');
      if(!host)return;
      const row=document.createElement('div');
      row.className='accommodationRowV2';
      row.style.cssText='display:grid;grid-template-columns:1.15fr 1fr 110px 42px;gap:8px;align-items:center;margin:8px 0';
      const type=String(data.type||'Compartilhado');
      row.innerHTML=`
        <input class="accName" placeholder="Ex.: Quarto 01 ou Camping 01" value="${esc(data.name||'')}">
        <select class="accType">
          <option value="Casal" ${type==='Casal'?'selected':''}>Casal</option>
          <option value="Compartilhado" ${type==='Compartilhado'?'selected':''}>Compartilhado</option>
          <option value="Camping" ${type==='Camping'?'selected':''}>Camping</option>
          <option value="Outro" ${type==='Outro'?'selected':''}>Outro</option>
        </select>
        <input class="accCapacity" type="number" min="0" step="1" placeholder="Vagas" value="${Number(data.capacity||0)||''}">
        <button type="button" class="btn danger" title="Remover" onclick="this.closest('.accommodationRowV2').remove()">×</button>`;
      host.appendChild(row);
      row.querySelector('.accName')?.focus();
    };

    window.addNextRoomRow=function(){
      const rows=[...document.querySelectorAll('#accommodationRows .accommodationRowV2 .accName')];
      let max=0;
      rows.forEach(i=>{const m=String(i.value||'').match(/quarto\s*0*(\d+)/i);if(m)max=Math.max(max,Number(m[1]||0))});
      window.addAccommodationRow({name:`Quarto ${String(max+1).padStart(2,'0')}`,type:'Compartilhado',capacity:2});
    };

    window.addCampingRow=function(){
      const rows=[...document.querySelectorAll('#accommodationRows .accommodationRowV2 .accName')];
      let count=0;rows.forEach(i=>{if(/camping/i.test(i.value||''))count++});
      window.addAccommodationRow({name:`Camping ${String(count+1).padStart(2,'0')}`,type:'Camping',capacity:1});
    };

    const enhanced=function(tripId){
      const t=(appState()?.trips||[]).find(x=>x.id===tripId);
      if(!t||typeof window.modal!=='function'){
        try{toast('Não foi possível abrir a configuração deste passeio. Atualize a página e tente novamente.','error')}catch(_){ }
        return;
      }
      const rooms=Array.isArray(t.rooms)?t.rooms:[];
      const vehicles=Array.isArray(t.vehicles)?t.vehicles:[];
      const vehicleText=vehicles.map(v=>`${v.name||''} | ${v.driver||''} | ${v.plate||''} | ${v.capacity||''}`).join('\n');

      window.modal(`<form id="structureFormV2">
        <div class="modalHead"><div><span class="eyebrow">OPERAÇÃO</span><h2>Hospedagem, quartos e camping</h2><small>${esc(t.name||'')}</small></div><button type="button" class="iconClose" onclick="document.getElementById('modal')?.remove()">✕</button></div>
        <div class="modalBody">
          <div class="formBlock">
            <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap"><div><h3 style="margin-bottom:4px">Quartos / Camping</h3><p class="hint" style="margin:0">Cadastre cada acomodação separadamente. Ex.: Quarto 01, Quarto 02, Camping 01.</p></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn primary" onclick="addNextRoomRow()">+ Adicionar quarto</button><button type="button" class="btn ghost" onclick="addCampingRow()">+ Adicionar camping</button></div></div>
            <div style="display:grid;grid-template-columns:1.15fr 1fr 110px 42px;gap:8px;margin-top:14px;font-size:11px;font-weight:800;color:#60746b"><span>NÚMERO / NOME</span><span>TIPO</span><span>CAPACIDADE</span><span></span></div>
            <div id="accommodationRows"></div>
          </div>
          <div class="formBlock" style="margin-top:18px"><h3>Veículos / ônibus</h3><p class="hint">Uma linha por veículo: Nome | Motorista | Placa | Capacidade</p><textarea name="vehicles" rows="5" placeholder="Ônibus 01 | Romário | ABC1D23 | 46">${esc(vehicleText)}</textarea></div>
          <div id="structureMsgV2"></div>
        </div>
        <div class="modalFoot"><button type="button" class="btn ghost" onclick="document.getElementById('modal')?.remove()">Cancelar</button><button class="btn primary">Salvar estrutura</button></div>
      </form>`);

      if(rooms.length)rooms.forEach(r=>window.addAccommodationRow(r));
      else window.addAccommodationRow({name:'Quarto 01',type:'Compartilhado',capacity:2});

      const form=document.getElementById('structureFormV2');
      if(!form)return;
      form.onsubmit=async e=>{
        e.preventDefault();
        const roomRows=[...document.querySelectorAll('#accommodationRows .accommodationRowV2')];
        const rooms2=roomRows.map(row=>({
          name:String(row.querySelector('.accName')?.value||'').trim(),
          type:String(row.querySelector('.accType')?.value||'').trim(),
          capacity:Math.max(0,Number(row.querySelector('.accCapacity')?.value||0))
        })).filter(r=>r.name);
        const vehicles2=String(form.vehicles.value||'').split('\n').map(x=>x.trim()).filter(Boolean).map(line=>{const p=line.split('|').map(x=>x.trim());return{name:p[0]||'',driver:p[1]||'',plate:p[2]||'',capacity:Math.max(0,Number(p[3]||0))}}).filter(v=>v.name);
        try{
          await db.collection('trips').doc(tripId).update({rooms:rooms2,vehicles:vehicles2,updated_at:firebase.firestore.FieldValue.serverTimestamp()});
          t.rooms=rooms2;t.vehicles=vehicles2;
          try{await window.auditV7?.('structure','trip',tripId,`Hospedagem atualizada: ${rooms2.length} acomodação(ões)`)}catch(_){ }
          document.getElementById('modal')?.remove();
          try{toast(`Estrutura salva: ${rooms2.length} acomodação(ões).`)}catch(_){ }
          if(typeof window.renderAdmin==='function')window.renderAdmin();
        }catch(err){
          const msg=document.getElementById('structureMsgV2');if(msg)msg.innerHTML=`<div class="msg error">${esc(err?.message||'Não foi possível salvar.')}</div>`;
        }
      };
    };
    enhanced.__roomEditorV2=true;
    window.structureModalV7=enhanced;
    try{globalThis.structureModalV7=enhanced}catch(_){ }
    return true;
  }

  function optionLabel(v){
    const raw=String(v||'').trim(),n=raw.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'_');
    if(!raw)return'';
    if(n.includes('camp'))return'Camping';
    if(n.includes('compart'))return'Quarto compartilhado';
    if(n.includes('casal'))return'Quarto casal';
    return raw.replaceAll('_',' ');
  }

  async function getTripOps(tripId){
    const out={};
    try{const snap=await db.collection('trips').doc(tripId).collection('operations').get();snap.docs.forEach(d=>out[d.id]={id:d.id,...d.data()})}catch(err){console.warn('REPORT_OPS',err)}
    return out;
  }

  function peopleForReport(tripId){
    const s=appState(),out=[];
    (s?.reservations||[]).filter(r=>r.trip_id===tripId&&r.status!=='cancelled').forEach(r=>(r.participants||[]).forEach((p,i)=>out.push({
      key:digits(p.cpf)||`${r.id}-${i}`,
      name:p.full_name||r.responsible_name||'Participante',
      email:r.email||'',
      reservation:r,
      responsible:r.responsible_name||'',
      index:i
    })));
    return out;
  }

  function reportHeader(doc,title,t,subtitle=''){
    doc.setFillColor(7,50,38);doc.rect(0,0,210,38,'F');
    doc.setFillColor(216,173,66);doc.rect(0,38,210,2,'F');
    doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(10);doc.text('TRILHEIROS DE RONDONÓPOLIS',14,13);
    doc.setFontSize(18);doc.text(title,14,23);
    doc.setFont('helvetica','normal');doc.setFontSize(9);doc.text(`${t.name||'Passeio'} • ${brDate(t.trip_date)}${t.destination?` • ${t.destination}`:''}`,14,31);
    if(subtitle){doc.setTextColor(70,88,81);doc.setFontSize(8.5);doc.text(subtitle,14,47)}
  }

  function reportFooter(doc,t,total){
    const pages=doc.internal.getNumberOfPages();
    for(let i=1;i<=pages;i++){
      doc.setPage(i);doc.setFontSize(7);doc.setTextColor(110);doc.text(`Trilheiros de Rondonópolis • ${t.name||'Passeio'} • ${total} registro(s)`,14,289);doc.text(`Página ${i}/${pages}`,196,289,{align:'right'});
    }
  }

  window.attractionLodgingPdf=async function(id){
    if(!id){try{return toast('Selecione um passeio.','error')}catch(_){return}}
    const s=appState(),t=(s?.trips||[]).find(x=>x.id===id);if(!t)return;
    if(!window.jspdf?.jsPDF){try{return toast('Gerador de PDF ainda está carregando. Tente novamente.','error')}catch(_){return}}
    const ops=await getTripOps(id),rooms=Array.isArray(t.rooms)?t.rooms:[],roomMap=new Map(rooms.map(r=>[String(r.name||''),r]));
    const rows=peopleForReport(id).map(p=>{
      const op=ops[p.key]||{},room=String(op.room||'').trim(),def=roomMap.get(room),r=p.reservation||{};
      const answer=r.registration_answers||{};
      const fallback=r.accommodation||r.category||r.participant_type||answer?.opcao?.value||answer?.tipo?.value||answer?.categoria?.value||'';
      const type=def?.type?optionLabel(def.type):optionLabel(fallback)||(/camp/i.test(room)?'Camping':room?'Hospedagem':'Não definido');
      return{...p,room:room||'Não definido',type};
    }).sort((a,b)=>`${a.room} ${a.name}`.localeCompare(`${b.room} ${b.name}`,'pt-BR',{numeric:true,sensitivity:'base'}));
    const {jsPDF}=window.jspdf,doc=new jsPDF({unit:'mm',format:'a4'});
    reportHeader(doc,'LISTA PARA ATRATIVOS E HOSPEDAGEM',t,'Organização por hóspede, tipo de hospedagem e número do quarto/camping.');
    doc.autoTable({startY:53,head:[['Nº','NOME DO TURISTA','TIPO DE HOSPEDAGEM','QUARTO / CAMPING']],body:rows.map((p,i)=>[String(i+1).padStart(2,'0'),p.name,p.type,p.room]),theme:'grid',styles:{font:'helvetica',fontSize:8.5,cellPadding:2.8,textColor:[25,48,40],lineColor:[220,231,226],lineWidth:.15},headStyles:{fillColor:[7,50,38],textColor:[255,255,255],fontStyle:'bold',fontSize:8},alternateRowStyles:{fillColor:[247,250,248]},columnStyles:{0:{cellWidth:12,halign:'center'},1:{cellWidth:72},2:{cellWidth:53},3:{cellWidth:43}},margin:{left:14,right:14,bottom:16}});
    reportFooter(doc,t,rows.length);doc.save(`atrativos-hospedagem-${slug(t.name)}.pdf`);
    try{await window.auditV7?.('pdf','trip',id,`Lista de atrativos e hospedagem gerada (${rows.length} pessoas)`)}catch(_){ }
  };

  window.transportProfessionalPdf=async function(id){
    if(!id){try{return toast('Selecione um passeio.','error')}catch(_){return}}
    const s=appState(),t=(s?.trips||[]).find(x=>x.id===id);if(!t)return;
    if(!window.jspdf?.jsPDF){try{return toast('Gerador de PDF ainda está carregando. Tente novamente.','error')}catch(_){return}}
    const reservations=(s?.reservations||[]).filter(r=>r.trip_id===id&&r.status!=='cancelled').map(r=>({name:r.responsible_name||r.participants?.[0]?.full_name||'Responsável',email:r.email||'—',qty:Math.max(1,Number(r.seats||r.participants?.length||1))})).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR',{sensitivity:'base'}));
    const total=reservations.reduce((sum,r)=>sum+r.qty,0),{jsPDF}=window.jspdf,doc=new jsPDF({unit:'mm',format:'a4'});
    reportHeader(doc,'LISTA DE TRANSPORTE',t,`Relação de responsáveis para transporte • Total de passageiros: ${total}`);
    doc.autoTable({startY:53,head:[['Nº','NOME / RESPONSÁVEL','E-MAIL','QTD. PESSOAS']],body:reservations.map((r,i)=>[String(i+1).padStart(2,'0'),r.name,r.email,String(r.qty)]),theme:'grid',styles:{font:'helvetica',fontSize:8.6,cellPadding:2.8,textColor:[25,48,40],lineColor:[220,231,226],lineWidth:.15},headStyles:{fillColor:[7,50,38],textColor:[255,255,255],fontStyle:'bold',fontSize:8},alternateRowStyles:{fillColor:[247,250,248]},columnStyles:{0:{cellWidth:12,halign:'center'},1:{cellWidth:68},2:{cellWidth:76},3:{cellWidth:28,halign:'center'}},margin:{left:14,right:14,bottom:16}});
    reportFooter(doc,t,total);doc.save(`transporte-${slug(t.name)}.pdf`);
    try{await window.auditV7?.('pdf','trip',id,`Lista profissional de transporte gerada (${total} pessoas)`)}catch(_){ }
  };

  function renderProfessionalReports(){
    const s=appState(),content=document.getElementById('content');if(!s||!content||s.tab!=='reports')return;
    const trips=s.trips||[],selected=trips.some(t=>t.id===s.reportTripCentral)?s.reportTripCentral:'';
    content.innerHTML=`<section class="panel"><div class="panelHead"><div><span class="eyebrow">CENTRAL DE RELATÓRIOS</span><h2>Documentos profissionais</h2><p>Selecione o passeio e gere documentos prontos para enviar a pousadas, atrativos, transporte e seguro.</p></div></div><div class="reportTripSelect"><select id="reportTrip"><option value="">Selecione um passeio</option>${trips.map(t=>`<option value="${esc(t.id)}" ${t.id===selected?'selected':''}>${esc(t.name)} — ${brDate(t.trip_date)}</option>`).join('')}</select></div><div class="reportCards">
      <button onclick="attractionLodgingPdf(document.getElementById('reportTrip').value)"><span>PDF</span><strong>Lista atrativos e hospedagem</strong><small>Nome do turista, tipo de hospedagem e número do quarto ou camping. Organizado para enviar à pousada e aos atrativos.</small></button>
      <button onclick="transportProfessionalPdf(document.getElementById('reportTrip').value)"><span>PDF</span><strong>Lista de transporte</strong><small>Nome do responsável, e-mail e quantidade de pessoas. Documento limpo para empresa de transporte.</small></button>
      <button onclick="typeof pdfTrip==='function'&&pdfTrip(document.getElementById('reportTrip').value)"><span>PDF</span><strong>Lista oficial de participantes</strong><small>Relação completa do passeio para uso interno.</small></button>
      <button onclick="typeof insuranceCsvV7==='function'&&insuranceCsvV7(document.getElementById('reportTrip').value)"><span>CSV</span><strong>Lista para seguro</strong><small>Nome completo e CPF no formato solicitado para seguro.</small></button>
      <button onclick="typeof copySurveyV7==='function'&&copySurveyV7(document.getElementById('reportTrip').value)"><span>LINK</span><strong>Avaliação pós-passeio</strong><small>Copie o link para os participantes avaliarem a experiência.</small></button>
      <button onclick="typeof backupV7==='function'&&backupV7()"><span>JSON</span><strong>Backup completo</strong><small>Passeios, reservas, despesas e configurações.</small></button>
    </div></section>`;
    const select=document.getElementById('reportTrip');
    if(select)select.onchange=()=>{s.reportTripCentral=select.value};
  }

  function installReportsCenter(){
    window.renderProfessionalReports=renderProfessionalReports;
    return true;
  }

  attachModalRemove();
  loadTripWeather();
  installReportsCenter();
  document.addEventListener('DOMContentLoaded',()=>{attachModalRemove();installRoomEditor();installReportsCenter()});
  window.addEventListener('load',()=>{attachModalRemove();loadTripWeather();installRoomEditor();installReportsCenter()});
})();
