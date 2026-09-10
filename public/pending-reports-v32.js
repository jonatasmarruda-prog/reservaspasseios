/* Trilheiros Gestão V32 — pendências com valor automático + relatórios sem CPF */
(function(){
'use strict';
if(typeof state==='undefined') return;

const q=(s,r=document)=>r.querySelector(s);
const qa=(s,r=document)=>[...r.querySelectorAll(s)];
const n=v=>Math.max(0,Number(v||0)||0);
const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v||0));
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#039;'}[c]));
const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'America/Cuiaba'});
const GUIDE_NAME='Jonatas Marques de Arruda';
const GUIDE_ROLE='GUIA DE TURISMO';
const LOGO='https://i.postimg.cc/JnF2F9Hw/LOGO-TRILHEIROS-Photoroom.png';

function payKind(v){v=String(v||'').toLowerCase();if(v.includes('install')||v.includes('parcel'))return'pix_installment';if(v.includes('card')||v.includes('cart'))return'card';if(v.includes('pix'))return'pix';if(v.includes('cash')||v.includes('dinheiro'))return'cash';return'other'}
const PAY_LABEL={pix:'PIX',card:'CARTÃO',pix_installment:'PIX PARCELADO',cash:'DINHEIRO',other:'OUTRO'};
function payLabel(v){return PAY_LABEL[payKind(v)]||'OUTRO'}
function totalValue(r,t){
  if(n(r?.sale_total)>0)return n(r.sale_total);
  const composed=n(r?.paid_amount)+n(r?.balance_due)-n(r?.refunded_amount);
  if(composed>0)return composed;
  return n(t?.default_price)*Math.max(1,n(r?.seats));
}
function optionLabelRaw(v){
  const s=String(v||'').trim();if(!s)return'';
  const k=s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
  const map={adulto:'Individual',individual:'Individual',casal:'Casal',compartilhado:'Individual • Quarto compartilhado',quarto_compartilhado:'Individual • Quarto compartilhado',casal_sem_banheiro:'Casal • Sem banheiro',casal_com_banheiro:'Casal • Com banheiro',camping:'Camping',crianca:'Criança',criança:'Criança',infantil:'Criança'};
  return map[k]||s.replaceAll('_',' ');
}
function reservationOption(r){
  const a=r?.registration_answers||{};
  const candidates=[r?.category,r?.accommodation,r?.participant_type,a?.opcao?.value,a?.tipo?.value,a?.categoria?.value,a?.participacao?.value];
  for(const x of candidates){const v=optionLabelRaw(x);if(v)return v}
  return Number(r?.seats||1)===1?'Individual':`${Number(r?.seats||0)} pessoas`;
}
function participantsText(r){const a=(r?.participants||[]).map(p=>p?.full_name).filter(Boolean);return a.length?a.join(', '):(r?.responsible_name||'—')}
function nextConfirmAmount(r,t){
  const total=totalValue(r,t),paid=n(r?.paid_amount),remaining=Math.max(0,total-paid);
  if(payKind(r?.payment_method)==='pix_installment'){
    const count=Math.max(1,Math.round(n(r?.installment_total)||1));
    const installment=Math.round((total/count)*100)/100;
    return Math.min(remaining,installment||remaining);
  }
  return remaining;
}
function notify(msg,type=''){try{return typeof toast==='function'?toast(msg,type):alert(msg)}catch(_){alert(msg)}}
function closePayModal(){q('#v32PaymentModal')?.remove()}

function enhancePending(){
  try{
    if(state.tab!=='pending')return;
    const list=q('.pendingList');if(!list)return;
    const rs=(state.reservations||[]).filter(r=>['pending','partial'].includes(r.payment_status)&&r.status!=='cancelled');
    const items=qa('.pendingItem',list).filter(el=>String(q('span',el)?.textContent||'').trim().toLowerCase().includes('pagamento')||el.dataset.v32Payment==='1');
    items.forEach((el,i)=>{
      const r=rs[i];if(!r)return;
      const t=(state.trips||[]).find(x=>x.id===r.trip_id);
      const name=r.responsible_name||(r.participants?.[0]?.full_name)||'Sem nome';
      const trip=t?.name||r.trip_name||'Passeio';
      const method=payLabel(r.payment_method),option=reservationOption(r),total=totalValue(r,t),confirmAmount=nextConfirmAmount(r,t);
      const strong=q('strong',el),tag=q('span',el);
      if(tag)tag.textContent=payKind(r.payment_method)==='pix_installment'?'PIX PARCELADO':'PAGAMENTO';
      if(strong){
        strong.textContent=payKind(r.payment_method)==='pix_installment'
          ?`${name} • ${trip} • ${option} • ${method} • próxima ${money(confirmAmount)} • total ${money(total)}`
          :`${name} • ${trip} • ${option} • ${method} • ${money(total)}`;
      }
      el.dataset.v32Payment='1';
      el.onclick=e=>{e.preventDefault();window.openPendingPaymentV32(r.trip_id,r.id)};
    });
  }catch(e){console.warn('V32 pendências:',e)}
}

window.openPendingPaymentV32=async function(tripId,id){
  const r=(state.reservations||[]).find(x=>x.trip_id===tripId&&x.id===id);if(!r)return notify('Reserva não encontrada.','error');
  const t=(state.trips||[]).find(x=>x.id===tripId);
  const saleId=r.sale_id||r.id;
  let sale=null;
  try{const s=await db.collection('sales').doc(saleId).get();if(s.exists)sale={id:s.id,...s.data()}}catch(_){ }
  const merged={...r,...(sale||{}),participants:r.participants?.length?r.participants:(sale?.participants||[]),responsible_name:r.responsible_name||sale?.customer_name||'',payment_method:sale?.payment_method||r.payment_method};
  const total=totalValue(merged,t),paid=n(merged.paid_amount),balance=Math.max(0,total-paid),amount=nextConfirmAmount(merged,t),method=payLabel(merged.payment_method),option=reservationOption(merged);
  if(balance<=0)return notify('Este pagamento já está quitado.');
  closePayModal();
  const back=document.createElement('div');back.id='v32PaymentModal';back.className='modalBack';
  back.innerHTML=`<div class="modal v32PayModal"><div class="modalHead"><div><span class="eyebrow">CONFERIR PAGAMENTO</span><h2>${esc(merged.responsible_name||'Cliente')}</h2><p>${esc(t?.name||merged.trip_name||'Passeio')}</p></div><button type="button" class="iconClose" id="v32Close">✕</button></div><div class="modalBody"><div class="v32PayFacts"><div><span>FORMA</span><strong>${esc(method)}</strong></div><div><span>TIPO / OPÇÃO</span><strong>${esc(option)}</strong></div><div><span>VALOR DA RESERVA</span><strong>${money(total)}</strong></div><div><span>JÁ CONFIRMADO</span><strong>${money(paid)}</strong></div><div class="wide"><span>PARTICIPANTES</span><strong>${esc(participantsText(merged))}</strong></div><div class="wide confirm"><span>${payKind(merged.payment_method)==='pix_installment'?'PARCELA A CONFIRMAR':'VALOR A CONFIRMAR'}</span><strong>${money(amount)}</strong></div></div><div class="v32Notice">O valor já veio da reserva. Confira no banco/Mercado Pago e apenas confirme abaixo.</div><div id="v32Msg"></div></div><div class="modalFoot"><button type="button" class="btn ghost" id="v32Cancel">Cancelar</button><button type="button" class="btn primary" id="v32Confirm">${payKind(merged.payment_method)==='pix_installment'?`Confirmar parcela ${money(amount)}`:`Confirmar pagamento ${money(amount)}`}</button></div></div>`;
  document.body.appendChild(back);q('#v32Close',back).onclick=q('#v32Cancel',back).onclick=closePayModal;back.onclick=e=>{if(e.target===back)closePayModal()};
  q('#v32Confirm',back).onclick=()=>window.confirmPendingPaymentV32(tripId,id,saleId);
};

window.confirmPendingPaymentV32=async function(tripId,id,saleId){
  const btn=q('#v32Confirm'),msg=q('#v32Msg');if(btn){btn.disabled=true;btn.textContent='Confirmando...'}
  try{
    const resRef=db.collection('trips').doc(tripId).collection('reservations').doc(id),saleRef=db.collection('sales').doc(saleId||id),now=firebase.firestore.FieldValue.serverTimestamp(),day=today();
    let confirmed=0,newStatus='pending',newPaid=0,newBalance=0;
    await db.runTransaction(async tx=>{
      const [rs,ss]=await Promise.all([tx.get(resRef),tx.get(saleRef)]);if(!rs.exists)throw Error('Reserva não encontrada.');
      const rd=rs.data(),sd=ss.exists?ss.data():null,t=(state.trips||[]).find(x=>x.id===tripId),base=sd?{...rd,...sd,payment_method:sd.payment_method||rd.payment_method}:{...rd};
      const total=totalValue(base,t),oldPaid=n(base.paid_amount),remaining=Math.max(0,total-oldPaid);if(remaining<=0)throw Error('Pagamento já quitado.');
      confirmed=nextConfirmAmount(base,t);if(confirmed<=0)throw Error('Valor da reserva não identificado.');
      newPaid=Math.min(total,Math.round((oldPaid+confirmed)*100)/100);newBalance=Math.max(0,Math.round((total-newPaid)*100)/100);newStatus=newBalance<=0.009?'paid':'partial';
      const entry={amount:confirmed,date:day,method:base.payment_method||'pix',source:'admin_confirm_v32'};
      tx.update(resRef,{paid_amount:newPaid,balance_due:newBalance,payment_status:newStatus,payment_method:base.payment_method||rd.payment_method||'pix',payment_history:[...(rd.payment_history||[]),entry],received_date:day,updated_at:now});
      if(ss.exists)tx.update(saleRef,{paid_amount:newPaid,balance_due:newBalance,payment_status:newStatus,payment_method:base.payment_method||sd.payment_method||'pix',payment_history:[...(sd.payment_history||[]),entry],received_date:day,updated_at:now});
    });
    const local=(state.reservations||[]).find(x=>x.trip_id===tripId&&x.id===id);if(local){local.paid_amount=newPaid;local.balance_due=newBalance;local.payment_status=newStatus;local.received_date=day;local.payment_history=[...(local.payment_history||[]),{amount:confirmed,date:day,method:local.payment_method||'pix',source:'admin_confirm_v32'}]}
    closePayModal();notify(newStatus==='paid'?`Pagamento de ${money(confirmed)} confirmado. Reserva quitada.`:`Parcela de ${money(confirmed)} confirmada. Saldo ${money(newBalance)}.`,'success');
    if(typeof renderAdmin==='function')renderAdmin();
  }catch(e){if(msg)msg.innerHTML=`<div class="msg error">${esc(e.message||e)}</div>`;if(btn){btn.disabled=false;btn.textContent='Tentar novamente'}}
};

function reportType(r){return reservationOption(r)}
function reportPeople(id){
  const out=[{name:GUIDE_NAME,type:GUIDE_ROLE,special:true}];
  (state.reservations||[]).filter(r=>r.trip_id===id&&r.status!=='cancelled').forEach(r=>{
    const type=reportType(r);const ps=(r.participants||[]).filter(p=>p?.full_name);
    if(ps.length)ps.forEach(p=>out.push({name:p.full_name,type,special:false,reservation:r}));
    else if(r.responsible_name)out.push({name:r.responsible_name,type,special:false,reservation:r});
  });
  return out;
}
async function waitPdf(){for(let i=0;i<50;i++){if(window.jspdf?.jsPDF)return true;try{if(typeof ensurePdfLibraries==='function')await ensurePdfLibraries()}catch(_){ }await new Promise(r=>setTimeout(r,100))}return !!window.jspdf?.jsPDF}
async function logoData(){try{const resp=await fetch(LOGO),blob=await resp.blob();return await new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>res(fr.result);fr.onerror=rej;fr.readAsDataURL(blob)})}catch{return null}}
function slug(v){return String(v||'passeio').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}
function dateBR(v){const s=String(v||'').slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return s||'—';const[y,m,d]=s.split('-');return`${d}/${m}/${y}`}

window.pdfTrip=async function(id){
  if(!id)return notify('Selecione um passeio.','error');const t=(state.trips||[]).find(x=>x.id===id);if(!t)return notify('Passeio não encontrado.','error');
  try{
    if(!await waitPdf())throw Error('Biblioteca de PDF indisponível.');
    const {jsPDF}=window.jspdf,doc=new jsPDF({unit:'mm',format:'a4'}),people=reportPeople(id),logo=await logoData();
    doc.setFillColor(7,50,38);doc.rect(0,0,210,54,'F');doc.setFillColor(216,173,66);doc.rect(0,54,210,2,'F');if(logo)try{doc.addImage(logo,'PNG',14,8,30,30)}catch(_){ }
    doc.setTextColor(255);doc.setFont('helvetica','bold');doc.setFontSize(10);doc.text('TRILHEIROS DE RONDONÓPOLIS',logo?51:14,16);doc.setFontSize(21);doc.text('LISTA DE PARTICIPANTES',logo?51:14,28);doc.setFontSize(10);doc.setFont('helvetica','normal');doc.text(String(t.name||''),logo?51:14,38);doc.text(`${dateBR(t.trip_date)} • ${t.destination||''}`,logo?51:14,45);
    doc.setTextColor(20,45,35);doc.setFont('helvetica','bold');doc.setFontSize(13);doc.text('Nome e tipo/opção confirmada',14,70);
    const body=people.map((p,i)=>[String(i+1).padStart(2,'0'),p.name,p.type]);
    doc.autoTable({startY:78,head:[['Nº','NOME DO PARTICIPANTE','TIPO / OPÇÃO']],body,theme:'grid',styles:{font:'helvetica',fontSize:9,cellPadding:3,textColor:[25,48,40],lineColor:[220,231,226],lineWidth:.15},headStyles:{fillColor:[7,50,38],textColor:[255,255,255],fontStyle:'bold'},columnStyles:{0:{cellWidth:14,halign:'center'},1:{cellWidth:105},2:{cellWidth:63}},margin:{left:14,right:14,bottom:16},didParseCell:data=>{if(data.section==='body'&&data.row.index===0){data.cell.styles.fillColor=[248,241,215];data.cell.styles.fontStyle='bold'}}});
    const filename=`lista-participantes-${slug(t.name)}.pdf`;if(typeof window.openPdfPreviewV14==='function')window.openPdfPreviewV14(doc,{filename,title:'Lista de participantes',subtitle:`${t.name} • sem CPF`,shareText:`Lista de participantes — ${t.name}`});else doc.save(filename);
  }catch(e){console.error(e);notify('Não foi possível gerar o PDF.','error')}
};
try{pdfTrip=window.pdfTrip}catch(_){ }

window.insuranceCsvV7=function(id){
  if(!id)return notify('Selecione um passeio.','error');const t=(state.trips||[]).find(x=>x.id===id);if(!t)return;const people=reportPeople(id).filter(x=>!x.special),rows=[['Nº','Nome completo','Tipo / Opção','Passeio','Data'],...people.map((p,i)=>[i+1,p.name,p.type,t.name,dateBR(t.trip_date)])];
  const csv=rows.map(r=>r.map(v=>{const s=String(v??'');return /[;"\n]/.test(s)?`"${s.replaceAll('"','""')}"`:s}).join(';')).join('\n');const b=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=`participantes-${slug(t.name)}.csv`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000);notify('Lista CSV gerada sem CPF.');
};
try{insuranceCsvV7=window.insuranceCsvV7}catch(_){ }

window.roomsPdfV7=async function(id){
  if(!id)return notify('Selecione um passeio.','error');const t=(state.trips||[]).find(x=>x.id===id);if(!t)return;try{if(!await waitPdf())throw Error('PDF indisponível');const {jsPDF}=window.jspdf,doc=new jsPDF(),opsSnap=await db.collection('trips').doc(id).collection('operations').get(),ops={};opsSnap.docs.forEach(d=>ops[d.id]=d.data());const people=[];(state.reservations||[]).filter(r=>r.trip_id===id&&r.status!=='cancelled').forEach(r=>(r.participants||[]).forEach((p,i)=>{const digits=String(p.cpf||'').replace(/\D/g,''),key=digits||`${r.id}-${i}`;people.push({name:p.full_name||'',type:reportType(r),room:ops[key]?.room||'—'})}));people.sort((a,b)=>String(a.room).localeCompare(String(b.room))||a.name.localeCompare(b.name));doc.setFillColor(7,50,38);doc.rect(0,0,210,35,'F');doc.setTextColor(255);doc.setFontSize(19);doc.text('MAPA DE HOSPEDAGEM',14,17);doc.setFontSize(9);doc.text(`${t.name} • ${dateBR(t.trip_date)}`,14,26);doc.autoTable({startY:43,head:[['Nº','Participante','Tipo / Opção','Quarto']],body:people.map((p,i)=>[i+1,p.name,p.type,p.room]),headStyles:{fillColor:[7,50,38]},styles:{fontSize:8.7,cellPadding:2.4},margin:{left:14,right:14}});doc.save(`quartos-${slug(t.name)}.pdf`)}catch(e){console.error(e);notify('Não foi possível gerar o mapa de hospedagem.','error')}
};
try{roomsPdfV7=window.roomsPdfV7}catch(_){ }

function patchReports(){
  if(state.tab!=='reports')return;const cards=qa('.reportCards button');
  cards.forEach(b=>{const title=q('strong',b),small=q('small',b),txt=String(title?.textContent||'');if(txt.includes('Lista oficial')){if(small)small.textContent='Nome e tipo/opção confirmada de cada participante. Sem CPF.'}else if(txt.includes('Lista para seguro')){if(title)title.textContent='Lista de participantes (CSV)';if(small)small.textContent='Nome e tipo/opção confirmada, sem CPF.'}else if(txt.includes('Mapa de hospedagem')){if(small)small.textContent='Nome, tipo/opção e quarto. Sem CPF.'}});
}

const oldRender=window.renderAdmin;if(typeof oldRender==='function'){window.renderAdmin=function(...args){const out=oldRender.apply(this,args);setTimeout(()=>{enhancePending();patchReports()},20);return out};try{renderAdmin=window.renderAdmin}catch(_){ }}
new MutationObserver(()=>{if(state.tab==='pending')setTimeout(enhancePending,20);if(state.tab==='reports')setTimeout(patchReports,20)}).observe(document.documentElement,{childList:true,subtree:true});

const style=document.createElement('style');style.textContent=`.v32PayModal{max-width:720px}.v32PayFacts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.v32PayFacts>div{padding:14px;border:1px solid var(--line,#dfe7e3);border-radius:14px;background:var(--card,#fff)}.v32PayFacts .wide{grid-column:1/-1}.v32PayFacts span{display:block;font-size:10px;font-weight:800;letter-spacing:.06em;color:var(--muted,#71867e);margin-bottom:5px}.v32PayFacts strong{font-size:16px;color:var(--green,#0b4d3b)}.v32PayFacts .confirm{background:#f1f8f4;border-color:#b9dacb}.v32PayFacts .confirm strong{font-size:25px}.v32Notice{margin-top:14px;padding:12px 14px;border-radius:12px;background:#fff8e7;color:#6d5318;font-size:12px}.pendingItem[data-v32-payment="1"] strong{line-height:1.45}@media(max-width:600px){.v32PayFacts{grid-template-columns:1fr}.v32PayFacts .wide{grid-column:auto}}`;document.head.appendChild(style);
})();
