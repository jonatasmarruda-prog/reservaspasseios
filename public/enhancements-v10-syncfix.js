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

  async function lodgingRows(tripId){
    const ops={};
    try{const snap=await db.collection('trips').doc(tripId).collection('operations').get();snap.docs.forEach(d=>ops[d.id]=d.data()||{})}catch(_){ }
    const out=[{key:'guide',name:'Jonatas Marques de Arruda',type:'GUIA DE TURISMO',lodging:'—',special:true}];
    (state.reservations||[]).filter(r=>r.trip_id===tripId&&r.status!=='cancelled').forEach(r=>{
      const type=optionLabel(r),ps=(r.participants||[]).filter(p=>p?.full_name);
      if(ps.length){
        ps.forEach((p,i)=>{
          const key=digits(p.cpf)||`${r.id}-${i}`;
          const op=ops[key]||{};
          out.push({key,name:p.full_name,type,lodging:String(op.room||'').trim()||'SEM HOSPEDAGEM',special:false});
        });
      }else if(r.responsible_name){
        const key=r.id;
        const op=ops[key]||{};
        out.push({key,name:r.responsible_name,type,lodging:String(op.room||'').trim()||'SEM HOSPEDAGEM',special:false});
      }
    });
    const guide=out.shift();
    out.sort((a,b)=>{
      const ah=a.lodging==='SEM HOSPEDAGEM'?'ZZZZ':a.lodging, bh=b.lodging==='SEM HOSPEDAGEM'?'ZZZZ':b.lodging;
      return ah.localeCompare(bh,'pt-BR',{numeric:true,sensitivity:'base'})||a.name.localeCompare(b.name,'pt-BR',{sensitivity:'base'});
    });
    return [guide,...out];
  }

  async function correctedRoomsPdf(id){
    if(!id)return typeof toast==='function'?toast('Selecione um passeio.','error'):null;
    const t=(state.trips||[]).find(x=>x.id===id);if(!t)return typeof toast==='function'?toast('Passeio não encontrado.','error'):null;
    try{
      if(!await ensurePdf())throw Error('Biblioteca PDF indisponível.');
      const rows=await lodgingRows(id),{jsPDF}=window.jspdf,doc=new jsPDF({unit:'mm',format:'a4'}),logo=await logoData();
      doc.setFillColor(7,50,38);doc.rect(0,0,210,54,'F');doc.setFillColor(216,173,66);doc.rect(0,54,210,2,'F');
      if(logo)try{doc.addImage(logo,'PNG',14,8,30,30)}catch(_){ }
      doc.setTextColor(255);doc.setFont('helvetica','bold');doc.setFontSize(10);doc.text('TRILHEIROS DE RONDONÓPOLIS',logo?51:14,16);doc.setFontSize(19);doc.text('MAPA DE HOSPEDAGEM / CAMPING',logo?51:14,28);doc.setFontSize(9);doc.setFont('helvetica','normal');doc.text(`${String(t.name||'')} • ${dateBR(t.trip_date)}`,logo?51:14,39);doc.text(`${rows.length} pessoa(s) incluindo guia`,logo?51:14,46);
      doc.autoTable({startY:66,head:[['Nº','NOME DO PARTICIPANTE','TIPO / OPÇÃO','HOSPEDAGEM']],body:rows.map((p,i)=>[String(i+1).padStart(2,'0'),p.name,p.type,p.lodging]),theme:'grid',styles:{font:'helvetica',fontSize:8.3,cellPadding:2.6,textColor:[25,48,40],lineColor:[220,231,226],lineWidth:.15},headStyles:{fillColor:[7,50,38],textColor:[255,255,255],fontStyle:'bold'},columnStyles:{0:{cellWidth:12,halign:'center'},1:{cellWidth:73},2:{cellWidth:47},3:{cellWidth:50}},margin:{left:14,right:14,bottom:16},didParseCell:data=>{if(data.section==='body'&&data.row.index===0){data.cell.styles.fillColor=[248,241,215];data.cell.styles.fontStyle='bold'}},didDrawPage:data=>{doc.setFontSize(7);doc.setTextColor(110);doc.text(`Trilheiros de Rondonópolis • hospedagem/camping • ${t.name}`,14,291);doc.text(`Página ${data.pageNumber}`,194,291,{align:'right'})}});
      const filename=`hospedagem-camping-${slug(t.name)}-${String(t.trip_date||'').slice(0,10)}.pdf`;
      if(typeof window.openPdfPreviewV14==='function')window.openPdfPreviewV14(doc,{filename,title:'Mapa de hospedagem / camping',subtitle:`${t.name} • quartos e camping`,shareText:`Mapa de hospedagem / camping — ${t.name}`});else doc.save(filename);
    }catch(e){console.error('LODGING_PDF',e);if(typeof toast==='function')toast('Não foi possível gerar o mapa de hospedagem.','error')}
  }

  function installLodgingPdfFix(){
    if(typeof state==='undefined'||typeof db==='undefined')return;
    window.roomsPdfV7=correctedRoomsPdf;
    window.dayLodgingPdf=correctedRoomsPdf;
  }

  function enhanceDayLabels(){
    if(typeof state==='undefined'||state.tab!=='day')return;
    document.querySelectorAll('.dayAlloc select').forEach((sel,index)=>{
      if(index%2===0&&sel.options?.[0])sel.options[0].textContent='Sem hospedagem';
    });
    document.querySelectorAll('.structureSummary h4').forEach(h=>{if(h.textContent.trim()==='Quartos')h.textContent='Hospedagem / quartos / camping'});
    const modal=document.querySelector('#structureForm');
    if(modal){
      const blocks=[...modal.querySelectorAll('.formBlock')];
      const lodging=blocks[0];
      if(lodging){
        const h=lodging.querySelector('h3');if(h)h.textContent='Hospedagem / quartos / camping';
        const hint=lodging.querySelector('.hint');if(hint)hint.textContent='Uma linha por opção: Nome | Tipo | Capacidade. Ex.: Quarto 01 | Casal | 2 ou Camping | Barraca | 10';
        const ta=lodging.querySelector('textarea[name="rooms"]');if(ta)ta.placeholder='Quarto 01 | Casal | 2\nQuarto 02 | Compartilhado | 4\nCamping | Barraca | 10';
      }
    }
  }

  function enhanceDayPdfActions(){
    if(typeof state==='undefined'||state.tab!=='day')return;
    const toolbar=document.querySelector('.dayGrid .panel .panelHead .toolbar');
    if(!toolbar)return;
    const tripId=()=>state.dayTrip||document.querySelector('#dayTripSelect')?.value||'';
    const buttons=[...toolbar.querySelectorAll('button')];
    const generic=buttons.find(b=>/pdf|lista participantes/i.test(b.textContent||'')&&!/transporte|hospedagem|seguro/i.test(b.textContent||''));
    if(generic){generic.textContent='PDF Hospedagem / Camping';generic.onclick=()=>{const id=tripId();if(id)correctedRoomsPdf(id)}}
    if(!buttons.some(b=>/PDF Transporte/i.test(b.textContent||''))){
      const b=document.createElement('button');b.type='button';b.className='btn ghost';b.textContent='PDF Transporte';b.onclick=()=>{const id=tripId();if(id&&typeof window.driverPdfV7==='function')window.driverPdfV7(id)};toolbar.appendChild(b);
    }
    const duplicate=[...toolbar.querySelectorAll('button')].filter(b=>/PDF Hospedagem$/i.test(b.textContent||''));duplicate.forEach(b=>b.remove());
  }

  function keepOperationalUi(){ensureDayNav();installLodgingPdfFix();enhanceDayLabels();enhanceDayPdfActions()}

  window.addEventListener('load',()=>{
    setTimeout(mirror,1800);
    setTimeout(keepOperationalUi,500);
    setTimeout(keepOperationalUi,1500);
  });
  document.addEventListener('submit',e=>{if(e.target?.id==='generalSettings')setTimeout(mirror,1200)},true);
  document.addEventListener('click',()=>setTimeout(keepOperationalUi,80),true);
  setInterval(keepOperationalUi,1600);
})();
