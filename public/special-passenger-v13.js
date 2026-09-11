/* Trilheiros Gestão V13 — passageiro especial / vaga fixa do guia */
(function(){
  const SPECIAL={
    key:'trilheiros-guia-jonatas',
    name:'Jonatas — Guia de Turismo',
    role:'GUIA DE TURISMO',
    reservedSeats:1
  };
  const LOGO='https://i.postimg.cc/JnF2F9Hw/LOGO-TRILHEIROS-Photoroom.png';
  window.TRILHEIROS_SPECIAL_PASSENGER=SPECIAL;

  const digits=v=>String(v||'').replace(/\D/g,'');
  const html=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const slug=v=>String(v||'arquivo').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const todayISO=()=>new Date().toLocaleDateString('en-CA',{timeZone:'America/Cuiaba'});
  const tripDate=t=>String(t?.trip_date||'').slice(0,10);
  const dateLabel=v=>typeof date==='function'?date(v):String(v||'');
  const cpfLabel=v=>digits(v)?(typeof cpf==='function'?cpf(v):v):'—';
  const statusLabel=v=>{try{return typeof status!=='undefined'&&status?.[v]?status[v]:v}catch{return v}};

  function actualPeople(tripId,includeCancelled=false){
    if(typeof state==='undefined'||!Array.isArray(state.reservations))return[];
    const out=[];
    state.reservations.filter(r=>r.trip_id===tripId&&(includeCancelled||r.status!=='cancelled')).forEach(r=>{
      (r.participants||[]).forEach((p,i)=>out.push({
        key:digits(p.cpf)||`${r.id}-${i}`,
        name:p.full_name||'',cpf:p.cpf||'',responsible:r.responsible_name||'',email:r.email||'',reservation:r,index:i,special:false
      }));
    });
    return out;
  }
  function peopleWithGuide(tripId){
    return [{key:SPECIAL.key,name:SPECIAL.name,cpf:'',responsible:SPECIAL.role,email:'',reservation:null,index:-1,special:true},...actualPeople(tripId)];
  }

  /* Reserva física da vaga: grava 1 vaga ocupada no próprio passeio, sem gerar receita/reserva. */
  const reserving=new Set();
  async function reserveGuideSeat(t){
    if(!t?.id||reserving.has(t.id)||typeof db==='undefined')return;
    reserving.add(t.id);
    try{
      const ref=db.collection('trips').doc(t.id);
      await db.runTransaction(async tx=>{
        const snap=await tx.get(ref);if(!snap.exists)return;
        const d=snap.data(),total=Math.max(0,Number(d.total_spots||0)),used=Math.max(0,Number(d.used_spots||0)),rem=Math.max(0,Number(d.remaining_spots||0));
        if(total<1||rem<1)return;
        const duplicateNeedsRepair=d.special_seat_reserved===true&&used===0&&rem===total;
        if(d.special_seat_reserved===true&&!duplicateNeedsRepair)return;
        tx.update(ref,{
          remaining_spots:Math.max(0,rem-SPECIAL.reservedSeats),
          used_spots:Math.min(total,used+SPECIAL.reservedSeats),
          special_seat_reserved:true,
          special_seat_counted:true,
          special_passenger_name:SPECIAL.name,
          special_passenger_role:SPECIAL.role,
          special_seat_reserved_at:firebase.firestore.FieldValue.serverTimestamp(),
          updated_at:firebase.firestore.FieldValue.serverTimestamp()
        });
      });
    }catch(e){
      console.warn('Não foi possível reservar a vaga fixa do guia neste passeio.',t?.id,e?.message||e);
    }finally{reserving.delete(t.id)}
  }

  async function ensureGuideSeats(){
    if(!location.pathname.startsWith('/admin')||typeof state==='undefined'||typeof auth==='undefined'||!auth.currentUser)return;
    if(!['owner','admin'].includes(state.role))return;
    const today=todayISO();
    for(const t of (state.trips||[])){
      if(['cancelled','completed'].includes(String(t.status||'')))continue;
      if(tripDate(t)&&tripDate(t)<today)continue;
      const total=Number(t.total_spots||0),used=Number(t.used_spots||0),rem=Number(t.remaining_spots||0);
      const duplicateNeedsRepair=t.special_seat_reserved===true&&used===0&&rem===total&&total>0;
      if(total>0&&rem>0&&(t.special_seat_reserved!==true||duplicateNeedsRepair))await reserveGuideSeat(t);
    }
  }

  /* Inclui o guia como nº 1 no modo do dia, mantendo presença/ônibus/assento editáveis. */
  function setText(el,value){if(el&&el.textContent!==String(value))el.textContent=String(value)}
  function patchDayMode(){
    if(typeof state==='undefined')return;
    const box=document.querySelector('.dayPeople');if(!box)return;
    const tripId=state.dayTrip||'',t=(state.trips||[]).find(x=>x.id===tripId);if(!t)return;
    const ops=state.dayOps||{},o=ops[SPECIAL.key]||{},rooms=Array.isArray(t.rooms)?t.rooms:[],vehicles=Array.isArray(t.vehicles)?t.vehicles:[];
    if(!box.querySelector('.specialPassengerV13')){
      const row=document.createElement('div');
      row.className=`dayPerson specialPassengerV13 ${o.present?'present':''}`;
      row.innerHTML=`<button class="presenceBtn" onclick="togglePresenceV7('${tripId}','${SPECIAL.key}',${!o.present},'${encodeURIComponent(SPECIAL.name)}','')">${o.present?'✓':'○'}</button><div class="dayPersonMain"><strong>1. ${html(SPECIAL.name)}</strong><small>${SPECIAL.role} • VAGA FIXA</small></div><div class="dayAlloc"><select onchange="saveOpFieldV7('${tripId}','${SPECIAL.key}','room',this.value,'${encodeURIComponent(SPECIAL.name)}','')"><option value="">Sem quarto</option>${rooms.map(r=>`<option value="${html(r.name)}" ${o.room===r.name?'selected':''}>${html(r.name)}</option>`).join('')}</select><select onchange="saveOpFieldV7('${tripId}','${SPECIAL.key}','vehicle',this.value,'${encodeURIComponent(SPECIAL.name)}','')"><option value="">Sem veículo</option>${vehicles.map(v=>`<option value="${html(v.name)}" ${o.vehicle===v.name?'selected':''}>${html(v.name)}</option>`).join('')}</select><input placeholder="Assento" value="${html(o.seat||'')}" onchange="saveOpFieldV7('${tripId}','${SPECIAL.key}','seat',this.value,'${encodeURIComponent(SPECIAL.name)}','')"></div>`;
      box.prepend(row);
    }
    [...box.querySelectorAll('.dayPerson:not(.specialPassengerV13) .dayPersonMain strong')].forEach((el,i)=>{
      const clean=el.textContent.replace(/^\d+\.\s*/,'');setText(el,`${i+2}. ${clean}`);
    });
    const people=actualPeople(tripId),keys=[SPECIAL.key,...people.map(p=>p.key)],present=keys.filter(k=>ops[k]?.present).length,total=keys.length;
    const stats=document.querySelectorAll('.dayStats>div strong');setText(stats[0],`${present}/${total}`);setText(stats[1],String(total-present));
    const head=document.querySelector('.dayHeader p');if(head){const txt=`${dateLabel(t.trip_date)} • ${total} participante(s)`;setText(head,txt)}
  }

  async function logoData(){
    try{const r=await fetch(LOGO);const b=await r.blob();return await new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>res(fr.result);fr.onerror=rej;fr.readAsDataURL(b)})}catch{return null}
  }
  async function opsForTrip(id){
    const out={};
    try{const s=await db.collection('trips').doc(id).collection('operations').get();s.docs.forEach(d=>out[d.id]={id:d.id,...d.data()})}catch(_){ }
    return out;
  }

  window.pdfTrip=async function(id){
    if(!id)return toast('Selecione um passeio.','error');
    const t=(state.trips||[]).find(x=>x.id===id);if(!t)return toast('Passeio não encontrado.','error');
    const btn=document.activeElement,old=btn?.textContent;if(btn?.tagName==='BUTTON'){btn.disabled=true;btn.textContent='Gerando PDF...'}
    try{
      await ensurePdfLibraries();const {jsPDF}=window.jspdf,doc=new jsPDF({unit:'mm',format:'a4'}),people=peopleWithGuide(id),rs=(state.reservations||[]).filter(r=>r.trip_id===id&&r.status!=='cancelled'),logo=await logoData();
      doc.setFillColor(7,50,38);doc.rect(0,0,210,58,'F');doc.setFillColor(216,173,66);doc.rect(0,58,210,2,'F');if(logo)try{doc.addImage(logo,'PNG',14,9,30,30)}catch(_){}
      doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(10);doc.text('TRILHEIROS DE RONDONÓPOLIS',logo?51:14,17);doc.setFontSize(22);doc.text('LISTA OFICIAL DE PARTICIPANTES',logo?51:14,29);doc.setFontSize(10);doc.setFont('helvetica','normal');doc.text(`${t.name}`,logo?51:14,39);doc.text(`${dateLabel(t.trip_date)} • ${t.destination||''}`,logo?51:14,46);
      doc.setTextColor(20,45,35);doc.setFont('helvetica','bold');doc.setFontSize(15);doc.text('Resumo do passeio',14,73);
      const summary=[['Participantes',String(people.length)],['Reservas',String(rs.length)],['Vagas ocupadas',`${t.used_spots||0}/${t.total_spots||0}`],['Status',statusLabel(t.status)]];
      summary.forEach((x,i)=>{const x0=14+i*46;doc.setFillColor(244,248,246);doc.roundedRect(x0,80,42,20,3,3,'F');doc.setTextColor(95,115,107);doc.setFontSize(7);doc.text(x[0].toUpperCase(),x0+3,87);doc.setTextColor(10,55,42);doc.setFontSize(12);doc.text(String(x[1]),x0+3,95)});
      doc.setFontSize(9);doc.setTextColor(60,80,72);doc.text('Documento gerado pelo Trilheiros Gestão • O guia ocupa a vaga nº 1.',14,110);
      const body=people.map((p,i)=>[String(i+1).padStart(2,'0'),p.name,p.special?'—':cpfLabel(p.cpf),p.special?'GUIA DE TURISMO':(p.responsible||'')]);
      doc.autoTable({startY:118,head:[['Nº','NOME DO PARTICIPANTE','CPF','RESPONSÁVEL / FUNÇÃO']],body,theme:'grid',styles:{font:'helvetica',fontSize:8.3,cellPadding:2.7,textColor:[25,48,40],lineColor:[220,231,226],lineWidth:.15},headStyles:{fillColor:[7,50,38],textColor:[255,255,255],fontStyle:'bold',fontSize:8.5},alternateRowStyles:{fillColor:[247,250,248]},columnStyles:{0:{cellWidth:12,halign:'center'},1:{cellWidth:76},2:{cellWidth:40},3:{cellWidth:54}},margin:{left:14,right:14,bottom:16},didDrawPage:data=>{doc.setFontSize(7.5);doc.setTextColor(100);doc.text(`Trilheiros de Rondonópolis • ${t.name}`,14,291);doc.text(`Página ${data.pageNumber}`,190,291,{align:'right'})}});
      const pages=doc.internal.getNumberOfPages();for(let i=1;i<=pages;i++){doc.setPage(i);doc.setFontSize(7);doc.setTextColor(120);doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')} • Total no transporte: ${people.length}`,14,286)}
      doc.save(`lista-oficial-${slug(t.name)}-${String(t.trip_date||'').slice(0,10)}.pdf`);window.auditV7?.('pdf','trip',id,`PDF gerado com guia + ${people.length-1} participante(s)`);
    }catch(e){console.error(e);toast('Não foi possível gerar o PDF agora. Verifique sua internet e tente novamente.','error')}finally{if(btn?.tagName==='BUTTON'){btn.disabled=false;btn.textContent=old||'PDF'}}
  };

  window.driverPdfV7=async function(id){
    const t=(state.trips||[]).find(x=>x.id===id);if(!t)return;
    await ensurePdfLibraries();const ops=await opsForTrip(id),{jsPDF}=window.jspdf,doc=new jsPDF();
    const people=peopleWithGuide(id).map(p=>({...p,...(ops[p.key]||{})})).sort((a,b)=>(a.special?-1:0)-(b.special?-1:0)||String(a.vehicle||'ZZ').localeCompare(String(b.vehicle||'ZZ'))||String(a.seat||'').localeCompare(String(b.seat||'')));
    doc.setFillColor(7,50,38);doc.rect(0,0,210,35,'F');doc.setTextColor(255);doc.setFontSize(19);doc.text('LISTA DE TRANSPORTE',14,17);doc.setFontSize(9);doc.text(`${t.name} • ${dateLabel(t.trip_date)}`,14,26);
    doc.autoTable({startY:43,head:[['Nº','Participante','Veículo','Assento']],body:people.map((p,i)=>[i+1,p.name,p.vehicle||'—',p.seat||'—']),headStyles:{fillColor:[7,50,38]},styles:{fontSize:9,cellPadding:2.5},margin:{left:14,right:14}});doc.save(`transporte-${slug(t.name)}.pdf`)
  };

  window.roomsPdfV7=async function(id){
    const t=(state.trips||[]).find(x=>x.id===id);if(!t)return;
    await ensurePdfLibraries();const ops=await opsForTrip(id),{jsPDF}=window.jspdf,doc=new jsPDF();
    const people=peopleWithGuide(id).map(p=>({...p,...(ops[p.key]||{})})).sort((a,b)=>(a.special?-1:0)-(b.special?-1:0)||String(a.room||'ZZ').localeCompare(String(b.room||'ZZ')));
    doc.setFillColor(7,50,38);doc.rect(0,0,210,35,'F');doc.setTextColor(255);doc.setFontSize(19);doc.text('MAPA DE HOSPEDAGEM',14,17);doc.setFontSize(9);doc.text(`${t.name} • ${dateLabel(t.trip_date)}`,14,26);
    doc.autoTable({startY:43,head:[['Nº','Participante','CPF','Quarto']],body:people.map((p,i)=>[i+1,p.name,p.special?'—':cpfLabel(p.cpf),p.room||'—']),headStyles:{fillColor:[7,50,38]},styles:{fontSize:8.7,cellPadding:2.4},margin:{left:14,right:14}});doc.save(`quartos-${slug(t.name)}.pdf`)
  };

  /* Garante a reserva após cada renderização real, sem observar o documento inteiro. */
  const previousRender=window.renderAdmin;
  if(typeof previousRender==='function'&&!previousRender.__specialPassengerV13){
    const wrapped=function(...args){const out=previousRender.apply(this,args);setTimeout(()=>{ensureGuideSeats();patchDayMode()},0);return out};
    wrapped.__specialPassengerV13=true;window.renderAdmin=wrapped;try{renderAdmin=wrapped}catch(_){ }
  }
  document.addEventListener('change',e=>{if(e.target?.matches?.('#dayTripSelect,.dayAlloc select'))requestAnimationFrame(patchDayMode)},true);
  document.addEventListener('click',e=>{if(e.target?.closest?.('.dayPeople'))requestAnimationFrame(patchDayMode)},true);
  window.addEventListener('load',()=>setTimeout(ensureGuideSeats,1200));
})();
