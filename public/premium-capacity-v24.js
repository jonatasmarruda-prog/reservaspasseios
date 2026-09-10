/* Trilheiros Gestão V24 — lotação profissional + guia nº 01 em todos os PDFs */
(function(){
  const LOGO='https://i.postimg.cc/JnF2F9Hw/LOGO-TRILHEIROS-Photoroom.png';
  const GUIDE={
    key:'trilheiros-guia-jonatas',
    name:'Jonatas Marques de Arruda',
    role:'GUIA DE TURISMO',
    reservedSeats:1
  };
  window.TRILHEIROS_SPECIAL_PASSENGER=GUIDE;

  const digits=v=>String(v||'').replace(/\D/g,'');
  const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const slug=v=>String(v||'arquivo').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const dateLabel=v=>{try{return typeof date==='function'?date(v):String(v||'')}catch{return String(v||'')}};
  const cpfLabel=v=>{try{return digits(v)?(typeof cpf==='function'?cpf(v):v):'—'}catch{return digits(v)||'—'}};
  const statusLabel=v=>{try{return typeof status!=='undefined'&&status?.[v]?status[v]:v}catch{return v}};
  const todayCuiaba=()=>new Date().toLocaleDateString('en-CA',{timeZone:'America/Cuiaba'});
  const isFutureTrip=t=>{const d=String(t?.trip_date||'').slice(0,10);return !/^\d{4}-\d{2}-\d{2}$/.test(d)||d>todayCuiaba()};

  function capacity(t){
    const total=Math.max(0,Number(t?.total_spots||0));
    const used=Math.max(0,Number(t?.used_spots||0));
    const rawRemaining=Math.max(0,Number(t?.remaining_spots||0));
    if(!total)return {total,used,remaining:rawRemaining,occupied:used,guideReserved:!!t?.special_seat_reserved};
    const guideReserved=t?.special_seat_reserved===true||t?.special_seat_counted===true;
    const implicitGuide=guideReserved?0:GUIDE.reservedSeats;
    const hardRemaining=Math.max(0,total-used-implicitGuide);
    const remaining=Math.max(0,Math.min(rawRemaining,hardRemaining));
    const occupied=Math.min(total,used+implicitGuide);
    return {total,used,remaining,occupied,guideReserved};
  }

  function notify(msg,type=''){
    try{if(typeof toast==='function')return toast(msg,type)}catch(_){ }
    alert(msg);
  }

  /* ---------- Reserva fixa do guia + normalização de capacidade ---------- */
  async function ensureGuideSeat(t){
    if(!t?.id||typeof db==='undefined')return;
    try{
      const ref=db.collection('trips').doc(t.id);
      let normalized=null;
      await db.runTransaction(async tx=>{
        const snap=await tx.get(ref);if(!snap.exists)return;
        const d=snap.data(),total=Math.max(0,Number(d.total_spots||0));
        if(total<1)return;
        let used=Math.max(0,Number(d.used_spots||0));
        const already=d.special_seat_reserved===true||d.special_seat_counted===true;
        const now=firebase.firestore.FieldValue.serverTimestamp();
        const update={
          special_passenger_name:GUIDE.name,
          special_passenger_role:GUIDE.role,
          updated_at:now
        };
        if(!already&&used<total){
          used+=GUIDE.reservedSeats;
          update.used_spots=used;
          update.special_seat_reserved=true;
          update.special_seat_counted=true;
          update.special_seat_reserved_at=now;
        }else if(already){
          update.special_seat_reserved=true;
          update.special_seat_counted=true;
        }
        update.remaining_spots=Math.max(0,total-used);
        tx.update(ref,update);
        normalized={used_spots:used,remaining_spots:update.remaining_spots,special_seat_reserved:true,special_seat_counted:true,special_passenger_name:GUIDE.name,special_passenger_role:GUIDE.role};
      });
      if(normalized&&typeof state!=='undefined'){
        const local=(state.trips||[]).find(x=>x.id===t.id);if(local)Object.assign(local,normalized);
      }
    }catch(e){console.warn('V24: não foi possível normalizar a vaga do guia.',e?.message||e)}
  }

  async function ensureOpenTripCapacity(){
    try{
      if(!location.pathname.startsWith('/admin')||typeof state==='undefined'||!['owner','admin'].includes(state.role))return;
      const list=(state.trips||[]).filter(t=>t.status==='open'&&isFutureTrip(t));
      for(const t of list)await ensureGuideSeat(t);
    }catch(e){console.warn('V24: falha ao revisar capacidade.',e)}
  }

  const originalSale=window.openSaleModalV21;
  if(typeof originalSale==='function'&&!originalSale.__capacityV24){
    const wrappedSale=async function(...args){
      if(typeof state!=='undefined'&&['owner','admin'].includes(state.role))await ensureOpenTripCapacity();
      return originalSale.apply(this,args);
    };
    wrappedSale.__capacityV24=true;
    window.openSaleModalV21=wrappedSale;
    try{globalThis.openSaleModalV21=wrappedSale}catch(_){ }
  }

  /* ---------- Tela premium quando a lotação chegar a zero ---------- */
  function soldOutMarkup(t){
    const c=capacity(t),total=c.total||Number(t?.used_spots||0)||0;
    return `<section class="capacitySoldOutV24" data-capacity-soldout-v24="1"><div class="capacitySoldIconV24">✓</div><span>LOTAÇÃO ATINGIDA</span><h1>Todas as vagas preenchidas</h1><h2>${safe(t?.name||'Passeio')}</h2><p>O limite deste passeio foi atingido. Novos cadastros ficam bloqueados automaticamente para não ultrapassar a quantidade de vagas.</p>${total?`<div class="capacitySoldMeterV24"><small>LOTAÇÃO</small><strong>${total}/${total}</strong><b>VAGAS PREENCHIDAS</b></div>`:''}<div class="capacitySoldNoteV24">Se uma reserva for cancelada ou excluída e a vaga for liberada, este mesmo link volta a aceitar cadastro automaticamente.</div><small class="capacitySoldBrandV24">Trilheiros de Rondonópolis • Organização e segurança em primeiro lugar.</small></section>`;
  }

  function renderSoldOut(t){
    if(document.querySelector('.v17Success,.simpleSuccess,.saleDonePublicV21'))return;
    const mount=document.querySelector('.simpleMainMount')||document.getElementById('app');
    if(!mount)return;
    if(mount.querySelector('[data-capacity-soldout-v24="1"]'))return;
    mount.innerHTML=soldOutMarkup(t);
  }

  let capacityUnsub=null,lastSoldOut=false,lastWatched='';
  function stopCapacityWatch(){try{capacityUnsub?.()}catch(_){ }capacityUnsub=null;lastWatched='';lastSoldOut=false}
  function watchDirectRegistration(){
    const m=location.pathname.match(/^\/cadastro\/([^/]+)$/);
    if(!m){stopCapacityWatch();return}
    const id=m[1];if(id===lastWatched&&capacityUnsub)return;
    stopCapacityWatch();lastWatched=id;
    let tries=0;
    const start=()=>{
      tries++;
      try{
        if(typeof db==='undefined'||!db){if(tries<80)setTimeout(start,100);return}
        capacityUnsub=db.collection('trips').doc(id).onSnapshot(s=>{
          if(!s.exists)return;
          const t={id:s.id,...s.data()},c=capacity(t);
          if(!isFutureTrip(t))return;
          const full=t.status==='open'&&c.remaining<=0;
          if(full){lastSoldOut=true;renderSoldOut(t);return}
          if(lastSoldOut&&t.status==='open'&&c.remaining>0&&!document.querySelector('.v17Success,.simpleSuccess')){
            lastSoldOut=false;
            try{window.registration?.(id)}catch(_){location.reload()}
          }
          const info=document.querySelector('.v17HeroInfo b:last-child');
          if(info&&t.status==='open')info.textContent=`👥 ${c.remaining} vaga${c.remaining===1?'':'s'} disponível${c.remaining===1?'':'is'}`;
        },()=>{});
      }catch(_){if(tries<80)setTimeout(start,100)}
    };
    start();
  }

  function patchRegistrationForm(){
    const form=document.getElementById('simpleRegV17');
    if(!form||form.dataset.capacityV24==='1'||typeof form.onsubmit!=='function')return;
    const original=form.onsubmit;form.dataset.capacityV24='1';
    form.onsubmit=async function(e){
      const tripId=document.getElementById('v17Trip')?.value||location.pathname.match(/^\/cadastro\/([^/]+)$/)?.[1]||'';
      const qty=Math.max(1,Number(document.getElementById('v17Qty')?.value||1));
      if(tripId&&typeof db!=='undefined'){
        try{
          const s=await db.collection('trips').doc(tripId).get();
          if(s.exists){
            const t={id:s.id,...s.data()},c=capacity(t);
            if(t.status!=='open'){
              e.preventDefault();e.stopImmediatePropagation();notify('As inscrições deste passeio estão encerradas.','error');return false;
            }
            if(c.remaining<=0){
              e.preventDefault();e.stopImmediatePropagation();renderSoldOut(t);return false;
            }
            if(qty>c.remaining){
              e.preventDefault();e.stopImmediatePropagation();
              const box=document.getElementById('v17Error');if(box){box.textContent=`Restam somente ${c.remaining} vaga(s). Ajuste a quantidade para continuar.`;box.classList.add('show')}
              else notify(`Restam somente ${c.remaining} vaga(s).`,'error');
              return false;
            }
          }
        }catch(_){/* a transação original continua sendo a proteção final */}
      }
      return original.call(this,e);
    };
  }

  /* ---------- Exclusão segura: a vaga volta sem ultrapassar o total ---------- */
  const originalDeleteReservation=window.deleteReservation;
  if(typeof originalDeleteReservation==='function'&&!originalDeleteReservation.__capacityV24){
    const wrappedDelete=async function(tripId,id){
      try{
        const r=(state?.reservations||[]).find(x=>x.trip_id===tripId&&x.id===id);
        if(r?.sale_id&&typeof window.cancelSaleV22==='function'){
          notify('Esta reserva veio de uma venda. Use o cancelamento da venda para liberar as vagas e manter o financeiro correto.');
          try{state.tab='salesV21';window.renderSalesPageV21?.()}catch(_){ }
          return;
        }
      }catch(_){ }
      const out=await originalDeleteReservation.apply(this,[tripId,id]);
      try{
        const ref=db.collection('trips').doc(tripId);
        await db.runTransaction(async tx=>{
          const s=await tx.get(ref);if(!s.exists)return;
          const d=s.data(),total=Math.max(0,Number(d.total_spots||0)),used=Math.max(0,Number(d.used_spots||0)),rem=Math.max(0,Number(d.remaining_spots||0));
          if(!total)return;
          const correct=Math.max(0,total-used);
          if(rem!==correct)tx.update(ref,{remaining_spots:correct,updated_at:firebase.firestore.FieldValue.serverTimestamp()});
        });
      }catch(_){ }
      return out;
    };
    wrappedDelete.__capacityV24=true;
    window.deleteReservation=wrappedDelete;
    try{globalThis.deleteReservation=wrappedDelete}catch(_){ }
  }

  /* ---------- PDFs: guia nº 01, nome completo e linha em destaque ---------- */
  function actualPeople(tripId){
    const out=[];
    (state?.reservations||[]).filter(r=>r.trip_id===tripId&&r.status!=='cancelled').forEach(r=>{
      (r.participants||[]).forEach((p,i)=>out.push({key:digits(p.cpf)||`${r.id}-${i}`,name:p.full_name||'',cpf:p.cpf||'',responsible:r.responsible_name||'',special:false}));
    });
    return out;
  }
  function peopleWithGuide(tripId){return [{key:GUIDE.key,name:GUIDE.name,cpf:'',responsible:GUIDE.role,special:true},...actualPeople(tripId)]}
  async function logoData(){try{const r=await fetch(LOGO),b=await r.blob();return await new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>res(fr.result);fr.onerror=rej;fr.readAsDataURL(b)})}catch{return null}}
  async function opsForTrip(id){const out={};try{const s=await db.collection('trips').doc(id).collection('operations').get();s.docs.forEach(d=>out[d.id]={id:d.id,...d.data()})}catch(_){ }return out}
  function preview(doc,options){
    if(typeof window.openPdfPreviewV14==='function'){window.openPdfPreviewV14(doc,options);return}
    const url=doc.output('bloburl');window.open(url,'_blank','noopener');
  }
  function guideRowStyle(data){
    if(data.section==='body'&&data.row.index===0){
      data.cell.styles.fillColor=[248,241,215];
      data.cell.styles.textColor=[7,50,38];
      data.cell.styles.fontStyle='bold';
      data.cell.styles.lineColor=[216,173,66];
      data.cell.styles.lineWidth=.35;
    }
  }

  window.pdfTrip=async function(id){
    if(!id)return notify('Selecione um passeio.','error');
    const t=(state?.trips||[]).find(x=>x.id===id);if(!t)return notify('Passeio não encontrado.','error');
    const btn=document.activeElement,old=btn?.textContent;if(btn?.tagName==='BUTTON'){btn.disabled=true;btn.textContent='Gerando PDF...'}
    try{
      await ensurePdfLibraries();const {jsPDF}=window.jspdf,doc=new jsPDF({unit:'mm',format:'a4'}),people=peopleWithGuide(id),registered=people.length-1,rs=(state.reservations||[]).filter(r=>r.trip_id===id&&r.status!=='cancelled'),logo=await logoData(),c=capacity(t);
      doc.setFillColor(7,50,38);doc.rect(0,0,210,58,'F');doc.setFillColor(216,173,66);doc.rect(0,58,210,2,'F');if(logo)try{doc.addImage(logo,'PNG',14,9,30,30)}catch(_){}
      doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(10);doc.text('TRILHEIROS DE RONDONÓPOLIS',logo?51:14,17);doc.setFontSize(22);doc.text('LISTA OFICIAL DE PARTICIPANTES',logo?51:14,29);doc.setFontSize(10);doc.setFont('helvetica','normal');doc.text(`${t.name}`,logo?51:14,39);doc.text(`${dateLabel(t.trip_date)} • ${t.destination||''}`,logo?51:14,46);
      doc.setTextColor(20,45,35);doc.setFont('helvetica','bold');doc.setFontSize(15);doc.text('Resumo do passeio',14,73);
      const summary=[['Na lista',String(people.length)],['Reservas',String(rs.length)],['Vagas ocupadas',`${c.used}/${c.total||t.total_spots||0}`],['Disponíveis',String(c.remaining)]];
      summary.forEach((x,i)=>{const x0=14+i*46;doc.setFillColor(244,248,246);doc.roundedRect(x0,80,42,20,3,3,'F');doc.setTextColor(95,115,107);doc.setFontSize(7);doc.text(x[0].toUpperCase(),x0+3,87);doc.setTextColor(10,55,42);doc.setFontSize(12);doc.text(String(x[1]),x0+3,95)});
      doc.setFontSize(9);doc.setTextColor(60,80,72);doc.text('Nº 01 reservado ao Guia de Turismo • Demais participantes seguem a numeração sequencial.',14,110);
      const body=people.map((p,i)=>[String(i+1).padStart(2,'0'),p.name,p.special?'—':cpfLabel(p.cpf),p.special?GUIDE.role:(p.responsible||'')]);
      doc.autoTable({startY:118,head:[['Nº','NOME DO PARTICIPANTE','CPF','RESPONSÁVEL / FUNÇÃO']],body,theme:'grid',styles:{font:'helvetica',fontSize:8.3,cellPadding:2.7,textColor:[25,48,40],lineColor:[220,231,226],lineWidth:.15},headStyles:{fillColor:[7,50,38],textColor:[255,255,255],fontStyle:'bold',fontSize:8.5},alternateRowStyles:{fillColor:[247,250,248]},columnStyles:{0:{cellWidth:12,halign:'center'},1:{cellWidth:76},2:{cellWidth:40},3:{cellWidth:54}},margin:{left:14,right:14,bottom:16},didParseCell:guideRowStyle,didDrawPage:data=>{doc.setFontSize(7.5);doc.setTextColor(100);doc.text(`Trilheiros de Rondonópolis • ${t.name}`,14,291);doc.text(`Página ${data.pageNumber}`,190,291,{align:'right'})}});
      const pages=doc.internal.getNumberOfPages();for(let i=1;i<=pages;i++){doc.setPage(i);doc.setFontSize(7);doc.setTextColor(120);doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')} • ${registered} participante(s) + 1 Guia de Turismo`,14,286)}
      preview(doc,{filename:`lista-oficial-${slug(t.name)}-${String(t.trip_date||'').slice(0,10)}.pdf`,title:'Lista oficial de participantes',subtitle:`${t.name} • ${dateLabel(t.trip_date)}`,shareText:`Lista oficial de participantes — ${t.name} — Trilheiros de Rondonópolis`});
      window.auditV7?.('pdf','trip',id,`PDF gerado: ${GUIDE.name} nº 01 + ${registered} participante(s)`);
    }catch(e){console.error(e);notify('Não foi possível gerar o PDF agora.','error')}finally{if(btn?.tagName==='BUTTON'){btn.disabled=false;btn.textContent=old||'PDF'}}
  };

  window.driverPdfV7=async function(id){
    const t=(state?.trips||[]).find(x=>x.id===id);if(!t)return notify('Passeio não encontrado.','error');
    try{
      await ensurePdfLibraries();const ops=await opsForTrip(id),{jsPDF}=window.jspdf,doc=new jsPDF({unit:'mm',format:'a4'});
      const people=peopleWithGuide(id).map(p=>({...p,...(ops[p.key]||{})})).sort((a,b)=>(a.special?-1:0)-(b.special?-1:0)||String(a.vehicle||'ZZ').localeCompare(String(b.vehicle||'ZZ'))||String(a.seat||'').localeCompare(String(b.seat||'')));
      doc.setFillColor(7,50,38);doc.rect(0,0,210,35,'F');doc.setFillColor(216,173,66);doc.rect(0,35,210,1.5,'F');doc.setTextColor(255);doc.setFont('helvetica','bold');doc.setFontSize(19);doc.text('LISTA DE TRANSPORTE',14,17);doc.setFont('helvetica','normal');doc.setFontSize(9);doc.text(`${t.name} • ${dateLabel(t.trip_date)}`,14,26);
      const body=people.map((p,i)=>[String(i+1).padStart(2,'0'),p.name,p.special?GUIDE.role:'PARTICIPANTE',p.vehicle||'—',p.seat||'—']);
      doc.autoTable({startY:43,head:[['Nº','PARTICIPANTE','FUNÇÃO','VEÍCULO','ASSENTO']],body,theme:'grid',headStyles:{fillColor:[7,50,38],textColor:[255,255,255],fontStyle:'bold'},styles:{fontSize:8.5,cellPadding:2.4,lineColor:[220,231,226],lineWidth:.15},columnStyles:{0:{cellWidth:12,halign:'center'},1:{cellWidth:70},2:{cellWidth:32},3:{cellWidth:44},4:{cellWidth:24}},margin:{left:14,right:14},didParseCell:guideRowStyle});
      preview(doc,{filename:`transporte-${slug(t.name)}.pdf`,title:'Lista de transporte',subtitle:`${t.name} • ${dateLabel(t.trip_date)}`,shareText:`Lista de transporte — ${t.name} — Trilheiros de Rondonópolis`});
    }catch(e){console.error(e);notify('Não foi possível gerar a lista de transporte.','error')}
  };

  window.roomsPdfV7=async function(id){
    const t=(state?.trips||[]).find(x=>x.id===id);if(!t)return notify('Passeio não encontrado.','error');
    try{
      await ensurePdfLibraries();const ops=await opsForTrip(id),{jsPDF}=window.jspdf,doc=new jsPDF({unit:'mm',format:'a4'});
      const people=peopleWithGuide(id).map(p=>({...p,...(ops[p.key]||{})})).sort((a,b)=>(a.special?-1:0)-(b.special?-1:0)||String(a.room||'ZZ').localeCompare(String(b.room||'ZZ')));
      doc.setFillColor(7,50,38);doc.rect(0,0,210,35,'F');doc.setFillColor(216,173,66);doc.rect(0,35,210,1.5,'F');doc.setTextColor(255);doc.setFont('helvetica','bold');doc.setFontSize(19);doc.text('MAPA DE HOSPEDAGEM',14,17);doc.setFont('helvetica','normal');doc.setFontSize(9);doc.text(`${t.name} • ${dateLabel(t.trip_date)}`,14,26);
      const body=people.map((p,i)=>[String(i+1).padStart(2,'0'),p.name,p.special?'—':cpfLabel(p.cpf),p.special?GUIDE.role:'PARTICIPANTE',p.room||'—']);
      doc.autoTable({startY:43,head:[['Nº','PARTICIPANTE','CPF','FUNÇÃO','QUARTO']],body,theme:'grid',headStyles:{fillColor:[7,50,38],textColor:[255,255,255],fontStyle:'bold'},styles:{fontSize:8.2,cellPadding:2.35,lineColor:[220,231,226],lineWidth:.15},columnStyles:{0:{cellWidth:12,halign:'center'},1:{cellWidth:66},2:{cellWidth:37},3:{cellWidth:32},4:{cellWidth:35}},margin:{left:14,right:14},didParseCell:guideRowStyle});
      preview(doc,{filename:`quartos-${slug(t.name)}.pdf`,title:'Mapa de hospedagem',subtitle:`${t.name} • ${dateLabel(t.trip_date)}`,shareText:`Mapa de hospedagem — ${t.name} — Trilheiros de Rondonópolis`});
    }catch(e){console.error(e);notify('Não foi possível gerar o mapa de hospedagem.','error')}
  };

  /* ---------- Indicador LOTADO no painel ---------- */
  function patchAdminCapacityBadges(){
    if(!location.pathname.startsWith('/admin')||typeof state==='undefined')return;
    (state.trips||[]).forEach(t=>{
      const c=capacity(t),row=document.querySelector(`[data-trip-row="${t.id}"]`);if(!row)return;
      row.querySelector('.capacityBadgeV24')?.remove();
      if(t.status==='open'&&c.total>0&&c.remaining<=0){
        const badge=document.createElement('span');badge.className='capacityBadgeV24';badge.textContent=`LOTADO • ${c.total}/${c.total}`;
        row.querySelector('td')?.appendChild(badge);
      }
    });
  }

  let scheduled=false;
  const observer=new MutationObserver(()=>{
    if(scheduled)return;scheduled=true;
    requestAnimationFrame(()=>{scheduled=false;patchRegistrationForm();patchAdminCapacityBadges()});
  });
  observer.observe(document.documentElement,{subtree:true,childList:true});

  window.addEventListener('load',()=>{
    patchRegistrationForm();patchAdminCapacityBadges();watchDirectRegistration();
    setTimeout(ensureOpenTripCapacity,1200);
  });
  window.addEventListener('popstate',()=>{watchDirectRegistration();setTimeout(patchRegistrationForm,80)});
  setTimeout(()=>{patchRegistrationForm();patchAdminCapacityBadges();watchDirectRegistration();ensureOpenTripCapacity()},600);
})();
