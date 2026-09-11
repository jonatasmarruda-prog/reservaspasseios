// Correções complementares do painel administrativo.
(function(){
  'use strict';

  const GUIDE_NAME='Jonatas';
  const GUIDE_ROLE='GUIA DE TURISMO';
  const LOGO_URL='https://i.postimg.cc/JnF2F9Hw/LOGO-TRILHEIROS-Photoroom.png';
  const PAY_LABEL={pix:'PIX',card:'CARTÃO',pix_installment:'PIX PARCELADO',cash:'DINHEIRO',transfer:'TRANSFERÊNCIA',other:'OUTRO'};
  const STATUS_LABEL={paid:'PAGO',partial:'PARCIAL',pending:'PENDENTE',refunded:'REEMBOLSADO',cancelled:'CANCELADO'};
  let premiumLogoPromise=null;

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
  function norm(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()}
  function slug(v){return String(v||'arquivo').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}
  function brDate(v){const s=String(v||'').slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return s||'—';const[y,m,d]=s.split('-');return`${d}/${m}/${y}`}
  function appState(){try{if(typeof state!=='undefined')return state;return window.state||globalThis.state||null}catch(_){return window.state||globalThis.state||null}}
  function tripPlace(t){return String(t?.city||t?.destination_city||t?.destination||t?.location||t?.place||'Não informado').trim()||'Não informado'}
  function short(v,max=55){const s=String(v||'').trim();return s.length>max?s.slice(0,Math.max(1,max-1)).trimEnd()+'…':s}
  function payKind(v){const s=norm(v);if(s.includes('parcel')||s.includes('install'))return'pix_installment';if(s.includes('card')||s.includes('cart'))return'card';if(s.includes('pix'))return'pix';if(s.includes('cash')||s.includes('dinheiro'))return'cash';if(s.includes('transfer'))return'transfer';return'other'}

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
    const raw=String(v||'').trim(),n=norm(raw).replace(/[^a-z0-9]+/g,'_');
    if(!raw)return'';
    if(n.includes('camp'))return'Camping';
    if(n.includes('compart'))return'Quarto compartilhado';
    if(n.includes('casal'))return'Quarto casal';
    if(n.includes('crianca')||n.includes('child'))return'Criança';
    return raw.replaceAll('_',' ');
  }

  function reservationOption(r,sale={}){
    const a=r?.registration_answers||{};
    const vals=[
      sale?.category,sale?.accommodation,sale?.participant_type,
      r?.category,r?.accommodation,r?.participant_type,
      a?.opcao?.value,a?.tipo?.value,a?.categoria?.value,a?.participacao?.value
    ];
    for(const v of vals){const x=optionLabel(v);if(x)return x}
    const seats=Math.max(1,Number(sale?.seats||r?.seats||1)||1);
    return seats===1?'Individual':`${seats} pessoas`;
  }

  async function getTripOps(tripId){
    const out={};
    try{const snap=await db.collection('trips').doc(tripId).collection('operations').get();snap.docs.forEach(d=>out[d.id]={id:d.id,...d.data()})}catch(err){console.warn('REPORT_OPS',err)}
    return out;
  }

  async function getTripSales(tripId){
    const out=new Map();
    try{
      const snap=await db.collection('sales').where('trip_id','==',tripId).get();
      snap.docs.forEach(d=>{
        const row={id:d.id,...d.data()};
        out.set(d.id,row);
        if(row.reservation_id)out.set(String(row.reservation_id),row);
      });
    }catch(err){console.warn('REPORT_SALES',err)}
    return out;
  }

  async function ensurePdfReady(){
    if(window.jspdf?.jsPDF&&window.jspdf?.jsPDF?.API?.autoTable)return true;
    try{if(typeof window.ensurePdfLibraries==='function')await window.ensurePdfLibraries()}catch(_){ }
    for(let i=0;i<40;i++){
      if(window.jspdf?.jsPDF&&typeof window.jspdf.jsPDF.API?.autoTable==='function')return true;
      await new Promise(r=>setTimeout(r,100));
    }
    return !!window.jspdf?.jsPDF;
  }

  async function logoData(){
    if(premiumLogoPromise)return premiumLogoPromise;
    premiumLogoPromise=(async()=>{
      try{
        const r=await fetch(LOGO_URL,{cache:'force-cache'});
        if(!r.ok)throw Error('logo');
        const b=await r.blob();
        return await new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>res(fr.result);fr.onerror=rej;fr.readAsDataURL(b)});
      }catch(_){return null}
    })();
    return premiumLogoPromise;
  }

  function isGuideName(name){
    const x=norm(name);
    return x==='jonatas'||x==='jonatas guia de turismo'||x.includes('jonatas marques de arruda');
  }

  async function peopleForPremiumReport(tripId){
    const s=appState(),[ops,sales]=await Promise.all([getTripOps(tripId),getTripSales(tripId)]);
    const rows=[{
      key:'guide',name:GUIDE_NAME,type:GUIDE_ROLE,guide:true,email:'—',responsible:'—',
      room:ops.guide?.room||'—',vehicle:ops.guide?.vehicle||'—',seat:ops.guide?.seat||'—',
      method:'—',status:'EQUIPE'
    }];
    (s?.reservations||[]).filter(r=>r.trip_id===tripId&&r.status!=='cancelled').forEach(r=>{
      const sale=sales.get(String(r.sale_id||''))||sales.get(String(r.id||''))||{};
      const participants=(Array.isArray(r.participants)&&r.participants.length?r.participants:Array.isArray(sale.participants)?sale.participants:[])
        .filter(p=>p?.full_name);
      const list=participants.length?participants:[{full_name:r.responsible_name||sale.customer_name||'Participante',cpf:r.responsible_cpf||''}];
      const type=reservationOption(r,sale),method=PAY_LABEL[payKind(sale.payment_method||r.payment_method)]||'OUTRO';
      const rawStatus=String(sale.payment_status||r.payment_status||'').toLowerCase();
      const payStatus=STATUS_LABEL[rawStatus]||String(sale.payment_status||r.payment_status||'—').toUpperCase();
      list.forEach((p,i)=>{
        if(isGuideName(p.full_name))return;
        const key=digits(p.cpf)||`${r.id}-${i}`,op=ops[key]||{};
        rows.push({
          key,name:p.full_name||'Participante',type,guide:false,email:r.email||sale.customer_email||'—',
          responsible:r.responsible_name||sale.customer_name||'—',room:op.room||'—',
          vehicle:op.vehicle||'—',seat:op.seat||'—',method,status:payStatus,reservation:r,sale
        });
      });
    });
    return rows;
  }

  function drawPremiumHeader(doc,title,t,total,subtitle=''){
    const x=52,place=tripPlace(t);
    doc.setFillColor(7,50,38);doc.rect(0,0,210,64,'F');
    doc.setFillColor(216,173,66);doc.rect(0,64,210,2,'F');
    doc.setTextColor(255,255,255);
    doc.setFont('helvetica','bold');doc.setFontSize(9.5);doc.text('TRILHEIROS DE RONDONÓPOLIS',x,13);
    doc.setFontSize(17.5);doc.text(short(title,42),x,25);
    doc.setFontSize(10);doc.setFont('helvetica','bold');doc.text(`PASSEIO: ${short(t?.name||'Passeio',45)}`,x,37);
    doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.text(`DATA: ${brDate(t?.trip_date)}   •   CIDADE / DESTINO: ${short(place,37)}`,x,47);
    doc.setFontSize(8);doc.text(`TOTAL: ${total} pessoa(s), incluindo Jonatas — Guia de Turismo`,x,56);
    if(subtitle){doc.setTextColor(66,85,77);doc.setFontSize(8.2);doc.text(short(subtitle,102),14,73)}
  }

  async function addPremiumLogo(doc){
    const logo=await logoData();
    if(logo)try{doc.addImage(logo,'PNG',12,8,34,34)}catch(_){ }
  }

  function drawContinuationHeader(doc,title,t,page){
    if(page<=1)return;
    doc.setTextColor(7,50,38);doc.setFont('helvetica','bold');doc.setFontSize(8);
    doc.text(`TRILHEIROS DE RONDONÓPOLIS • ${short(title,38)}`,14,9);
    doc.setFont('helvetica','normal');doc.setTextColor(90);doc.setFontSize(7);
    doc.text(`${short(t?.name||'Passeio',60)} • ${brDate(t?.trip_date)} • ${short(tripPlace(t),42)}`,14,14);
    doc.setDrawColor(216,173,66);doc.line(14,16,196,16);
  }

  function drawPremiumFooter(doc,t,total){
    const pages=doc.internal.getNumberOfPages(),stamp=new Date().toLocaleString('pt-BR');
    for(let i=1;i<=pages;i++){
      doc.setPage(i);
      doc.setDrawColor(222,230,226);doc.line(14,282,196,282);
      doc.setFont('helvetica','normal');doc.setFontSize(6.8);doc.setTextColor(105);
      doc.text(`Trilheiros de Rondonópolis • ${short(t?.name||'Passeio',55)} • ${total} pessoa(s) • Gerado em ${stamp}`,14,288);
      doc.text(`Página ${i}/${pages}`,196,288,{align:'right'});
    }
  }

  function tableOptions(doc,title,t,body,head,total,columnStyles={}){
    doc.autoTable({
      startY:78,
      head:[head],
      body,
      theme:'grid',
      styles:{font:'helvetica',fontSize:8.3,cellPadding:2.6,textColor:[25,48,40],lineColor:[220,231,226],lineWidth:.15,valign:'middle'},
      headStyles:{fillColor:[7,50,38],textColor:[255,255,255],fontStyle:'bold',fontSize:8},
      alternateRowStyles:{fillColor:[247,250,248]},
      columnStyles,
      margin:{left:14,right:14,top:20,bottom:19},
      showHead:'everyPage',
      didParseCell:data=>{
        if(data.section==='body'&&data.row.index===0){
          data.cell.styles.fillColor=[248,241,215];
          data.cell.styles.textColor=[74,58,17];
          data.cell.styles.fontStyle='bold';
        }
      },
      didDrawPage:data=>drawContinuationHeader(doc,title,t,data.pageNumber)
    });
    drawPremiumFooter(doc,t,total);
  }

  function previewOrSave(doc,filename,title,t,total){
    const subtitle=`${t?.name||'Passeio'} • ${brDate(t?.trip_date)} • ${tripPlace(t)} • ${total} pessoa(s)`;
    if(typeof window.openPdfPreviewV14==='function'){
      window.openPdfPreviewV14(doc,{filename,title,subtitle,shareText:`${title} — ${t?.name||'Passeio'}`});
    }else doc.save(filename);
  }

  async function createPremiumPeoplePdf(tripId,kind='participants'){
    const s=appState(),t=(s?.trips||[]).find(x=>x.id===tripId);
    if(!t)throw Error('Passeio não encontrado.');
    if(!await ensurePdfReady())throw Error('Gerador de PDF indisponível.');
    const people=await peopleForPremiumReport(tripId),total=people.length,{jsPDF}=window.jspdf;
    const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
    const configs={
      participants:{title:'LISTA OFICIAL DE PARTICIPANTES',subtitle:'Relação completa do passeio para conferência e operação.',head:['Nº','NOME DO PARTICIPANTE','TIPO / FUNÇÃO'],row:p=>[p.name,p.type],widths:{0:{cellWidth:12,halign:'center'},1:{cellWidth:100},2:{cellWidth:70}}},
      transport:{title:'LISTA DE TRANSPORTE',subtitle:'Organização de passageiros, veículo e assento.',head:['Nº','NOME DO PARTICIPANTE','TIPO / FUNÇÃO','VEÍCULO','ASSENTO'],row:p=>[p.name,p.type,p.vehicle,p.seat],widths:{0:{cellWidth:11,halign:'center'},1:{cellWidth:66},2:{cellWidth:43},3:{cellWidth:43},4:{cellWidth:19,halign:'center'}}},
      lodging:{title:'MAPA DE HOSPEDAGEM',subtitle:'Distribuição de participantes por quarto ou camping.',head:['Nº','NOME DO PARTICIPANTE','TIPO / FUNÇÃO','QUARTO / CAMPING'],row:p=>[p.name,p.type,p.room],widths:{0:{cellWidth:12,halign:'center'},1:{cellWidth:76},2:{cellWidth:51},3:{cellWidth:43}}},
      attraction:{title:'LISTA PARA ATRATIVO',subtitle:'Relação dos integrantes do grupo para acesso ao atrativo.',head:['Nº','NOME DO PARTICIPANTE','TIPO / FUNÇÃO'],row:p=>[p.name,p.type],widths:{0:{cellWidth:12,halign:'center'},1:{cellWidth:100},2:{cellWidth:70}}},
      internal:{title:'LISTA INTERNA DO PASSEIO',subtitle:'Visão operacional com opção, pagamento e status.',head:['Nº','NOME','TIPO / FUNÇÃO','PAGAMENTO','STATUS'],row:p=>[p.name,p.type,p.method,p.status],widths:{0:{cellWidth:11,halign:'center'},1:{cellWidth:65},2:{cellWidth:43},3:{cellWidth:31},4:{cellWidth:32}}}
    };
    const cfg=configs[kind]||configs.participants;
    drawPremiumHeader(doc,cfg.title,t,total,cfg.subtitle);
    await addPremiumLogo(doc);
    const body=people.map((p,i)=>[String(i+1).padStart(2,'0'),...cfg.row(p)]);
    tableOptions(doc,cfg.title,t,body,cfg.head,total,cfg.widths);
    return{doc,t,total,title:cfg.title};
  }

  async function attractionLodgingPremiumPdf(id){
    if(!id)throw Error('Selecione um passeio.');
    const s=appState(),t=(s?.trips||[]).find(x=>x.id===id);if(!t)throw Error('Passeio não encontrado.');
    if(!await ensurePdfReady())throw Error('Gerador de PDF indisponível.');
    const all=await peopleForPremiumReport(id),guide=all[0],rooms=Array.isArray(t.rooms)?t.rooms:[],roomMap=new Map(rooms.map(r=>[String(r.name||''),r]));
    const customers=all.slice(1).map(p=>{
      const def=roomMap.get(String(p.room||'')),r=p.reservation||{},a=r.registration_answers||{};
      const fallback=r.accommodation||r.category||r.participant_type||a?.opcao?.value||a?.tipo?.value||a?.categoria?.value||p.type||'';
      const lodgingType=def?.type?optionLabel(def.type):optionLabel(fallback)||(/camp/i.test(p.room||'')?'Camping':p.room&&p.room!=='—'?'Hospedagem':'Não definido');
      return{...p,lodgingType,room:p.room||'—'};
    }).sort((a,b)=>`${a.room} ${a.name}`.localeCompare(`${b.room} ${b.name}`,'pt-BR',{numeric:true,sensitivity:'base'}));
    const rows=[{...guide,lodgingType:GUIDE_ROLE,room:'—'},...customers],total=rows.length,{jsPDF}=window.jspdf;
    const doc=new jsPDF({unit:'mm',format:'a4'}),title='LISTA PARA ATRATIVOS E HOSPEDAGEM';
    drawPremiumHeader(doc,title,t,total,'Organização por hóspede, tipo de hospedagem e quarto/camping.');
    await addPremiumLogo(doc);
    tableOptions(doc,title,t,rows.map((p,i)=>[String(i+1).padStart(2,'0'),p.name,p.lodgingType,p.room]),['Nº','NOME DO TURISTA','TIPO / FUNÇÃO','QUARTO / CAMPING'],total,{0:{cellWidth:12,halign:'center'},1:{cellWidth:72},2:{cellWidth:54},3:{cellWidth:44}});
    return{doc,t,total,title};
  }

  async function transportProfessionalPremiumPdf(id){
    if(!id)throw Error('Selecione um passeio.');
    const s=appState(),t=(s?.trips||[]).find(x=>x.id===id);if(!t)throw Error('Passeio não encontrado.');
    if(!await ensurePdfReady())throw Error('Gerador de PDF indisponível.');
    const reservations=(s?.reservations||[]).filter(r=>r.trip_id===id&&r.status!=='cancelled').map(r=>({
      name:r.responsible_name||r.participants?.[0]?.full_name||'Responsável',
      email:r.email||'—',
      qty:Math.max(1,Number(r.seats||r.participants?.length||1))
    })).filter(r=>!isGuideName(r.name)).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR',{sensitivity:'base'}));
    const rows=[{name:`${GUIDE_NAME} — Guia de Turismo`,email:'—',qty:1,guide:true},...reservations];
    const total=rows.reduce((sum,r)=>sum+r.qty,0),{jsPDF}=window.jspdf,doc=new jsPDF({unit:'mm',format:'a4'}),title='LISTA PROFISSIONAL DE TRANSPORTE';
    drawPremiumHeader(doc,title,t,total,'Relação de responsáveis e quantidade de passageiros para a empresa de transporte.');
    await addPremiumLogo(doc);
    tableOptions(doc,title,t,rows.map((r,i)=>[String(i+1).padStart(2,'0'),r.name,r.email,String(r.qty)]),['Nº','NOME / RESPONSÁVEL','E-MAIL','QTD. PESSOAS'],total,{0:{cellWidth:12,halign:'center'},1:{cellWidth:70},2:{cellWidth:72},3:{cellWidth:28,halign:'center'}});
    return{doc,t,total,title};
  }

  function safePdfAction(fn){
    return async function(id){
      try{return await fn(id)}
      catch(e){console.error('PREMIUM_PDF',e);try{toast(e?.message||'Não foi possível gerar o PDF agora.','error')}catch(_){alert(e?.message||'Erro ao gerar PDF.')}}
    };
  }

  function installPremiumPdfSuite(){
    window.pdfTrip=safePdfAction(async id=>{
      if(!id)throw Error('Selecione um passeio.');
      const out=await createPremiumPeoplePdf(id,'participants');
      previewOrSave(out.doc,`lista-oficial-${slug(out.t.name)}-${String(out.t.trip_date||'').slice(0,10)}.pdf`,'Lista oficial de participantes',out.t,out.total);
      try{await window.auditV7?.('pdf','trip',id,`PDF premium de participantes gerado (${out.total} pessoas incluindo guia)`)}catch(_){ }
    });
    window.driverPdfV7=safePdfAction(async id=>{
      if(!id)throw Error('Selecione um passeio.');
      const out=await createPremiumPeoplePdf(id,'transport');
      previewOrSave(out.doc,`transporte-${slug(out.t.name)}-${String(out.t.trip_date||'').slice(0,10)}.pdf`,'Lista de transporte',out.t,out.total);
      try{await window.auditV7?.('pdf','trip',id,`PDF premium de transporte gerado (${out.total} pessoas incluindo guia)`)}catch(_){ }
    });
    window.roomsPdfV7=safePdfAction(async id=>{
      if(!id)throw Error('Selecione um passeio.');
      const out=await createPremiumPeoplePdf(id,'lodging');
      previewOrSave(out.doc,`hospedagem-${slug(out.t.name)}-${String(out.t.trip_date||'').slice(0,10)}.pdf`,'Mapa de hospedagem',out.t,out.total);
      try{await window.auditV7?.('pdf','trip',id,`PDF premium de hospedagem gerado (${out.total} pessoas incluindo guia)`)}catch(_){ }
    });
    window.attractionLodgingPdf=safePdfAction(async id=>{
      const out=await attractionLodgingPremiumPdf(id);
      previewOrSave(out.doc,`atrativos-hospedagem-${slug(out.t.name)}-${String(out.t.trip_date||'').slice(0,10)}.pdf`,'Atrativos e hospedagem',out.t,out.total);
      try{await window.auditV7?.('pdf','trip',id,`PDF premium de atrativos e hospedagem gerado (${out.total} pessoas incluindo guia)`)}catch(_){ }
    });
    window.transportProfessionalPdf=safePdfAction(async id=>{
      const out=await transportProfessionalPremiumPdf(id);
      previewOrSave(out.doc,`transporte-profissional-${slug(out.t.name)}-${String(out.t.trip_date||'').slice(0,10)}.pdf`,'Lista profissional de transporte',out.t,out.total);
      try{await window.auditV7?.('pdf','trip',id,`PDF profissional de transporte gerado (${out.total} pessoas incluindo guia)`)}catch(_){ }
    });
    try{
      globalThis.pdfTrip=window.pdfTrip;
      globalThis.driverPdfV7=window.driverPdfV7;
      globalThis.roomsPdfV7=window.roomsPdfV7;
      globalThis.attractionLodgingPdf=window.attractionLodgingPdf;
      globalThis.transportProfessionalPdf=window.transportProfessionalPdf;
    }catch(_){ }
  }

  function installV40PremiumBridge(){
    if(document.documentElement.dataset.premiumPdfV40==='1')return;
    document.documentElement.dataset.premiumPdfV40='1';
    document.addEventListener('click',e=>{
      const btn=e.target?.closest?.('[data-v40-report]');
      if(!btn)return;
      const select=document.getElementById('v40ReportTrip'),tripId=select?.value||'',kind=btn.dataset.v40Report;
      if(!tripId)return;
      e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
      const map={bus:'transport',attraction:'attraction',hotel:'lodging',internal:'internal'};
      safePdfAction(async id=>{
        const out=await createPremiumPeoplePdf(id,map[kind]||'participants');
        const label={bus:'Lista para transporte',attraction:'Lista para atrativo',hotel:'Lista para hospedagem',internal:'Lista interna'}[kind]||'Relatório';
        previewOrSave(out.doc,`trilheiros-${kind}-${slug(out.t.name)}-${String(out.t.trip_date||'').slice(0,10)}.pdf`,label,out.t,out.total);
        try{await window.auditV7?.('pdf','trip',id,`PDF operacional premium ${kind} gerado (${out.total} pessoas incluindo guia)`)}catch(_){ }
      })(tripId);
    },true);
  }

  function renderProfessionalReports(){
    const s=appState(),content=document.getElementById('content');if(!s||!content||s.tab!=='reports')return;
    const trips=s.trips||[],selected=trips.some(t=>t.id===s.reportTripCentral)?s.reportTripCentral:'';
    content.innerHTML=`<section class="panel"><div class="panelHead"><div><span class="eyebrow">CENTRAL DE RELATÓRIOS</span><h2>Documentos profissionais</h2><p>Todos os PDFs incluem cabeçalho premium, logo dos Trilheiros, dados do passeio e Jonatas — Guia de Turismo como nº 1.</p></div></div><div class="reportTripSelect"><select id="reportTrip"><option value="">Selecione um passeio</option>${trips.map(t=>`<option value="${esc(t.id)}" ${t.id===selected?'selected':''}>${esc(t.name)} — ${brDate(t.trip_date)}</option>`).join('')}</select></div><div class="reportCards">
      <button onclick="attractionLodgingPdf(document.getElementById('reportTrip').value)"><span>PDF</span><strong>Lista atrativos e hospedagem</strong><small>Guia nº 1, turistas, tipo de hospedagem e quarto/camping em layout premium.</small></button>
      <button onclick="transportProfessionalPdf(document.getElementById('reportTrip').value)"><span>PDF</span><strong>Lista de transporte</strong><small>Guia nº 1, responsáveis, e-mail e quantidade de pessoas, com total incluindo o guia.</small></button>
      <button onclick="typeof pdfTrip==='function'&&pdfTrip(document.getElementById('reportTrip').value)"><span>PDF</span><strong>Lista oficial de participantes</strong><small>Relação completa com Jonatas — Guia de Turismo no topo e dados do passeio.</small></button>
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

  function bootLate(){
    attachModalRemove();
    loadTripWeather();
    installRoomEditor();
    installReportsCenter();
    installPremiumPdfSuite();
    installV40PremiumBridge();
  }

  attachModalRemove();
  loadTripWeather();
  installReportsCenter();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bootLate,{once:true});
  else bootLate();
  window.addEventListener('load',bootLate,{once:true});
})();
