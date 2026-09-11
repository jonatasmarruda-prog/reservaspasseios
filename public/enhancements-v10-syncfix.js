/* Garante sincronização tardia e mantém atalhos operacionais essenciais visíveis no Admin. */
(function(){
  const LOGO='https://i.postimg.cc/JnF2F9Hw/LOGO-TRILHEIROS-Photoroom.png';
  const digits=v=>String(v||'').replace(/\D/g,'');
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const slug=v=>String(v||'passeio').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const dateBR=v=>{const s=String(v||'').slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return s||'—';const[y,m,d]=s.split('-');return`${d}/${m}/${y}`};

  async function mirror(){
    try{
      if(!location.pathname.startsWith('/admin')||!window.firebase?.apps?.length||!auth?.currentUser||!db)return;
      const s=await db.collection('settings').doc('general').get();
      if(!s.exists)return;
      const g=s.data();
      await db.collection('settings').doc('public').set({business_name:g.business_name||'Trilheiros de Rondonópolis',whatsapp:g.whatsapp||'',updated_at:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});
    }catch(_){ }
  }

  function openDayTrip(){
    try{
      if(typeof state==='undefined')return;
      state.tab='day';
      if(typeof window.toggleAdminSide==='function')window.toggleAdminSide(false);
      if(typeof window.renderAdmin==='function')window.renderAdmin();
    }catch(e){console.warn('DAY_TRIP_OPEN',e)}
  }
  window.openDayTrip=window.openDayTrip||openDayTrip;

  function ensureDayNav(){
    if(!location.pathname.startsWith('/admin'))return;
    const nav=document.querySelector('.admin .nav');
    if(!nav||nav.querySelector('[data-tab="day"]'))return;
    const button=document.createElement('button');
    button.dataset.tab='day';
    button.innerHTML='☀ Dia do passeio';
    button.onclick=openDayTrip;
    const reports=nav.querySelector('[data-tab="reports"]');
    if(reports)nav.insertBefore(button,reports);
    else nav.appendChild(button);
  }

  function optionLabel(r){
    const a=r?.registration_answers||{};
    const raw=r?.category||r?.accommodation||r?.participant_type||a?.opcao?.value||a?.tipo?.value||a?.categoria?.value||a?.participacao?.value||'';
    if(raw){
      const k=String(raw).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
      const map={adulto:'Individual',individual:'Individual',casal:'Casal',compartilhado:'Individual • Quarto compartilhado',quarto_compartilhado:'Individual • Quarto compartilhado',casal_sem_banheiro:'Casal • Sem banheiro',casal_com_banheiro:'Casal • Com banheiro',camping:'Camping',crianca:'Criança',infantil:'Criança'};
      return map[k]||String(raw).replaceAll('_',' ');
    }
    return Number(r?.seats||1)===1?'Individual':`${Number(r?.seats||0)} pessoas`;
  }

  async function ensurePdf(){
    for(let i=0;i<50;i++){
      if(window.jspdf?.jsPDF&&window.jspdf.jsPDF.API?.autoTable)return true;
      try{if(typeof window.ensurePdfLibraries==='function')await window.ensurePdfLibraries()}catch(_){ }
      await new Promise(r=>setTimeout(r,100));
    }
    return !!window.jspdf?.jsPDF;
  }

  async function logoData(){
    try{const r=await fetch(LOGO),b=await r.blob();return await new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>res(fr.result);fr.onerror=rej;fr.readAsDataURL(b)})}catch{return null}
  }

  function localPeople(tripId){
    const out=[];
    (state.reservations||[]).filter(r=>r.trip_id===tripId&&r.status!=='cancelled').forEach(r=>{
      const ps=(r.participants||[]).filter(p=>p?.full_name);
      if(ps.length)ps.forEach((p,i)=>out.push({key:digits(p.cpf)||`${r.id}-${i}`,name:p.full_name,cpf:digits(p.cpf)}));
      else if(r.responsible_name)out.push({key:r.id,name:r.responsible_name,cpf:digits(r.responsible_cpf)});
    });
    return out;
  }

  async function operationRows(tripId,field,emptyLabel){
    const ops={};
    try{const snap=await db.collection('trips').doc(tripId).collection('operations').get();snap.docs.forEach(d=>ops[d.id]=d.data()||{})}catch(_){ }
    const out=[{key:'guide',name:'Jonatas Marques de Arruda',type:'GUIA DE TURISMO',value:String(ops.guide?.[field]||'').trim()||emptyLabel,special:true}];
    (state.reservations||[]).filter(r=>r.trip_id===tripId&&r.status!=='cancelled').forEach(r=>{
      const type=optionLabel(r),ps=(r.participants||[]).filter(p=>p?.full_name);
      if(ps.length){
        ps.forEach((p,i)=>{
          const key=digits(p.cpf)||`${r.id}-${i}`,op=ops[key]||{};
          out.push({key,name:p.full_name,type,value:String(op[field]||'').trim()||emptyLabel,special:false});
        });
      }else if(r.responsible_name){
        const key=r.id,op=ops[key]||{};
        out.push({key,name:r.responsible_name,type,value:String(op[field]||'').trim()||emptyLabel,special:false});
      }
    });
    const guide=out.shift();
    out.sort((a,b)=>{
      const av=a.value===emptyLabel?'ZZZZ':a.value,bv=b.value===emptyLabel?'ZZZZ':b.value;
      return av.localeCompare(bv,'pt-BR',{numeric:true,sensitivity:'base'})||a.name.localeCompare(b.name,'pt-BR',{sensitivity:'base'});
    });
    return [guide,...out];
  }

  async function correctedRoomsPdf(id){
    if(!id)return typeof toast==='function'?toast('Selecione um passeio.','error'):null;
    const t=(state.trips||[]).find(x=>x.id===id);if(!t)return typeof toast==='function'?toast('Passeio não encontrado.','error'):null;
    try{
      if(!await ensurePdf())throw Error('Biblioteca PDF indisponível.');
      const rows=await operationRows(id,'room','SEM HOSPEDAGEM'),{jsPDF}=window.jspdf,doc=new jsPDF({unit:'mm',format:'a4'}),logo=await logoData();
      doc.setFillColor(7,50,38);doc.rect(0,0,210,54,'F');doc.setFillColor(216,173,66);doc.rect(0,54,210,2,'F');
      if(logo)try{doc.addImage(logo,'PNG',14,8,30,30)}catch(_){ }
      doc.setTextColor(255);doc.setFont('helvetica','bold');doc.setFontSize(10);doc.text('TRILHEIROS DE RONDONÓPOLIS',logo?51:14,16);doc.setFontSize(19);doc.text('MAPA DE HOSPEDAGEM / CAMPING',logo?51:14,28);doc.setFontSize(9);doc.setFont('helvetica','normal');doc.text(`${String(t.name||'')} • ${dateBR(t.trip_date)}`,logo?51:14,39);doc.text(`${rows.length} pessoa(s) incluindo guia`,logo?51:14,46);
      doc.autoTable({startY:66,head:[['Nº','NOME DO PARTICIPANTE','TIPO / OPÇÃO','HOSPEDAGEM']],body:rows.map((p,i)=>[String(i+1).padStart(2,'0'),p.name,p.type,p.value]),theme:'grid',styles:{font:'helvetica',fontSize:8.3,cellPadding:2.6,textColor:[25,48,40],lineColor:[220,231,226],lineWidth:.15},headStyles:{fillColor:[7,50,38],textColor:[255,255,255],fontStyle:'bold'},columnStyles:{0:{cellWidth:12,halign:'center'},1:{cellWidth:73},2:{cellWidth:47},3:{cellWidth:50}},margin:{left:14,right:14,bottom:16},didParseCell:data=>{if(data.section==='body'&&data.row.index===0){data.cell.styles.fillColor=[248,241,215];data.cell.styles.fontStyle='bold'}},didDrawPage:data=>{doc.setFontSize(7);doc.setTextColor(110);doc.text(`Trilheiros de Rondonópolis • hospedagem/camping • ${t.name}`,14,291);doc.text(`Página ${data.pageNumber}`,194,291,{align:'right'})}});
      const filename=`hospedagem-camping-${slug(t.name)}-${String(t.trip_date||'').slice(0,10)}.pdf`;
      if(typeof window.openPdfPreviewV14==='function')window.openPdfPreviewV14(doc,{filename,title:'Mapa de hospedagem / camping',subtitle:`${t.name} • quartos e camping`,shareText:`Mapa de hospedagem / camping — ${t.name}`});else doc.save(filename);
    }catch(e){console.error('LODGING_PDF',e);if(typeof toast==='function')toast('Não foi possível gerar o mapa de hospedagem.','error')}
  }

  async function correctedTransportPdf(id){
    if(!id)return typeof toast==='function'?toast('Selecione um passeio.','error'):null;
    const t=(state.trips||[]).find(x=>x.id===id);if(!t)return typeof toast==='function'?toast('Passeio não encontrado.','error'):null;
    try{
      if(!await ensurePdf())throw Error('Biblioteca PDF indisponível.');
      const rows=await operationRows(id,'vehicle','SEM VEÍCULO'),{jsPDF}=window.jspdf,doc=new jsPDF({unit:'mm',format:'a4'}),logo=await logoData();
      doc.setFillColor(7,50,38);doc.rect(0,0,210,54,'F');doc.setFillColor(216,173,66);doc.rect(0,54,210,2,'F');
      if(logo)try{doc.addImage(logo,'PNG',14,8,30,30)}catch(_){ }
      doc.setTextColor(255);doc.setFont('helvetica','bold');doc.setFontSize(10);doc.text('TRILHEIROS DE RONDONÓPOLIS',logo?51:14,16);doc.setFontSize(19);doc.text('LISTA DE TRANSPORTE',logo?51:14,28);doc.setFontSize(9);doc.setFont('helvetica','normal');doc.text(`${String(t.name||'')} • ${dateBR(t.trip_date)}`,logo?51:14,39);doc.text(`${rows.length} pessoa(s) incluindo guia`,logo?51:14,46);
      doc.autoTable({startY:66,head:[['Nº','NOME DO PARTICIPANTE','TIPO / OPÇÃO','VEÍCULO']],body:rows.map((p,i)=>[String(i+1).padStart(2,'0'),p.name,p.type,p.value]),theme:'grid',styles:{font:'helvetica',fontSize:8.5,cellPadding:2.7,textColor:[25,48,40],lineColor:[220,231,226],lineWidth:.15},headStyles:{fillColor:[7,50,38],textColor:[255,255,255],fontStyle:'bold'},columnStyles:{0:{cellWidth:12,halign:'center'},1:{cellWidth:80},2:{cellWidth:48},3:{cellWidth:42}},margin:{left:14,right:14,bottom:16},didParseCell:data=>{if(data.section==='body'&&data.row.index===0){data.cell.styles.fillColor=[248,241,215];data.cell.styles.fontStyle='bold'}},didDrawPage:data=>{doc.setFontSize(7);doc.setTextColor(110);doc.text(`Trilheiros de Rondonópolis • transporte • ${t.name}`,14,291);doc.text(`Página ${data.pageNumber}`,194,291,{align:'right'})}});
      const filename=`transporte-${slug(t.name)}-${String(t.trip_date||'').slice(0,10)}.pdf`;
      if(typeof window.openPdfPreviewV14==='function')window.openPdfPreviewV14(doc,{filename,title:'Lista de transporte',subtitle:`${t.name} • por veículo`,shareText:`Lista de transporte — ${t.name}`});else doc.save(filename);
    }catch(e){console.error('TRANSPORT_PDF',e);if(typeof toast==='function')toast('Não foi possível gerar a lista de transporte.','error')}
  }

  function installPdfFixes(){
    if(typeof state==='undefined'||typeof db==='undefined')return;
    window.roomsPdfV7=correctedRoomsPdf;
    window.dayLodgingPdf=correctedRoomsPdf;
    window.driverPdfV7=correctedTransportPdf;
  }

  async function applyFieldToAll(field,value){
    if(typeof state==='undefined'||!state.dayTrip||!db)return;
    const people=localPeople(state.dayTrip);
    try{
      const batch=db.batch(),stamp=firebase.firestore.FieldValue.serverTimestamp();
      people.forEach(p=>batch.set(db.collection('trips').doc(state.dayTrip).collection('operations').doc(p.key),{participant_name:p.name,cpf:p.cpf,[field]:value,updated_at:stamp},{merge:true}));
      const guideKey=Object.keys(state.dayOps||{}).find(k=>/guide|trilheiros-guia-jonatas/i.test(k));
      if(guideKey)batch.set(db.collection('trips').doc(state.dayTrip).collection('operations').doc(guideKey),{[field]:value,updated_at:stamp},{merge:true});
      await batch.commit();
      people.forEach(p=>{state.dayOps[p.key]={...(state.dayOps[p.key]||{}),[field]:value}});
      if(guideKey)state.dayOps[guideKey]={...(state.dayOps[guideKey]||{}),[field]:value};
      if(typeof toast==='function')toast(`${field==='room'?'Hospedagem':'Veículo'} aplicado para todos.`);
      if(typeof window.renderAdmin==='function')window.renderAdmin();
    }catch(e){console.error('DAY_BULK_APPLY',e);if(typeof toast==='function')toast('Não foi possível aplicar para todos.','error')}
  }
  window.applyDayRoomToAll=value=>applyFieldToAll('room',value);
  window.applyDayVehicleToAll=value=>applyFieldToAll('vehicle',value);

  function enhanceDayLabels(){
    if(typeof state==='undefined'||state.tab!=='day')return;
    document.querySelectorAll('.dayAlloc').forEach(alloc=>{
      const selects=[...alloc.querySelectorAll('select')];
      if(selects[0]?.options?.[0])selects[0].options[0].textContent='Sem hospedagem';
      alloc.querySelectorAll('input').forEach(input=>{if(/assento/i.test(input.placeholder||''))input.remove()});
    });
    document.querySelectorAll('.structureSummary h4').forEach(h=>{if(h.textContent.trim()==='Quartos')h.textContent='Hospedagem / quartos / camping'});
    const modal=document.querySelector('#structureForm');
    if(modal){
      const blocks=[...modal.querySelectorAll('.formBlock')],lodging=blocks[0];
      if(lodging){
        const h=lodging.querySelector('h3');if(h)h.textContent='Hospedagem / quartos / camping';
        const hint=lodging.querySelector('.hint');if(hint)hint.textContent='Uma linha por opção: Nome | Tipo | Capacidade. Ex.: Quarto 01 | Casal | 2 ou Camping | Barraca | 10';
        const ta=lodging.querySelector('textarea[name="rooms"]');if(ta)ta.placeholder='Quarto 01 | Casal | 2\nQuarto 02 | Compartilhado | 4\nCamping | Barraca | 10';
      }
    }
  }

  function ensureBulkSelectors(){
    if(typeof state==='undefined'||state.tab!=='day')return;
    const people=document.querySelector('.dayPeople');if(!people||document.querySelector('#dayBulkAssign'))return;
    const t=(state.trips||[]).find(x=>x.id===state.dayTrip),rooms=Array.isArray(t?.rooms)?t.rooms:[],vehicles=Array.isArray(t?.vehicles)?t.vehicles:[];
    const wrap=document.createElement('div');wrap.id='dayBulkAssign';wrap.style.cssText='display:flex;gap:10px;flex-wrap:wrap;align-items:end;padding:12px 14px;margin:0 0 10px;border:1px solid #dbe7e2;border-radius:14px;background:#f7faf8';
    wrap.innerHTML=`<label style="display:grid;gap:5px;min-width:210px"><span style="font-size:11px;font-weight:800;color:#60746b">HOSPEDAGEM PARA TODOS</span><select id="bulkRoom" style="min-height:42px;border-radius:12px;border:1px solid #d2e0da;padding:0 10px"><option value="">Selecionar...</option>${rooms.map(r=>`<option value="${esc(r.name)}">${esc(r.name)}</option>`).join('')}</select></label><label style="display:grid;gap:5px;min-width:210px"><span style="font-size:11px;font-weight:800;color:#60746b">VEÍCULO PARA TODOS</span><select id="bulkVehicle" style="min-height:42px;border-radius:12px;border:1px solid #d2e0da;padding:0 10px"><option value="">Selecionar...</option>${vehicles.map(v=>`<option value="${esc(v.name)}">${esc(v.name)}</option>`).join('')}</select></label><small style="color:#718179;padding-bottom:11px">Depois você pode alterar qualquer pessoa individualmente.</small>`;
    people.parentNode.insertBefore(wrap,people);
    const room=wrap.querySelector('#bulkRoom'),vehicle=wrap.querySelector('#bulkVehicle');
    room.onchange=()=>{if(room.value&&confirm(`Aplicar ${room.value} para todos os participantes?`))window.applyDayRoomToAll(room.value);else room.value=''};
    vehicle.onchange=()=>{if(vehicle.value&&confirm(`Aplicar ${vehicle.value} para todos os participantes?`))window.applyDayVehicleToAll(vehicle.value);else vehicle.value=''};
  }

  function enhanceDayPdfActions(){
    if(typeof state==='undefined'||state.tab!=='day')return;
    const toolbar=document.querySelector('.dayGrid .panel .panelHead .toolbar');
    if(!toolbar)return;
    const tripId=()=>state.dayTrip||document.querySelector('#dayTripSelect')?.value||'';
    const buttons=[...toolbar.querySelectorAll('button')];
    const generic=buttons.find(b=>/pdf|lista participantes/i.test(b.textContent||'')&&!/transporte|hospedagem|seguro/i.test(b.textContent||''));
    if(generic){generic.textContent='PDF Hospedagem / Camping';generic.onclick=()=>{const id=tripId();if(id)correctedRoomsPdf(id)}}
    let transport=buttons.find(b=>/PDF Transporte/i.test(b.textContent||''));
    if(!transport){transport=document.createElement('button');transport.type='button';transport.className='btn ghost';transport.textContent='PDF Transporte';toolbar.appendChild(transport)}
    transport.onclick=()=>{const id=tripId();if(id)correctedTransportPdf(id)};
    const duplicate=[...toolbar.querySelectorAll('button')].filter(b=>/PDF Hospedagem$/i.test(b.textContent||''));duplicate.forEach(b=>b.remove());
  }

  function keepOperationalUi(){ensureDayNav();installPdfFixes();enhanceDayLabels();ensureBulkSelectors();enhanceDayPdfActions()}

  const previousRender=window.renderAdmin;
  if(typeof previousRender==='function'&&!previousRender.__operationalUiSync){
    const wrapped=function(...args){const out=previousRender.apply(this,args);setTimeout(keepOperationalUi,0);return out};
    wrapped.__operationalUiSync=true;window.renderAdmin=wrapped;try{renderAdmin=wrapped}catch(_){ }
  }

  window.addEventListener('load',()=>{
    setTimeout(mirror,1800);
    setTimeout(keepOperationalUi,500);
  });
  document.addEventListener('submit',e=>{if(e.target?.id==='generalSettings')setTimeout(mirror,1200)},true);
  document.addEventListener('change',e=>{if(e.target?.matches?.('#dayTripSelect,.dayAlloc select,.checkListV7 input'))setTimeout(keepOperationalUi,80)},true);
  document.addEventListener('click',e=>{if(e.target?.closest?.('.dayPeople,.checkListV7,#dayBulkAssign'))setTimeout(keepOperationalUi,80)},true);
})();
