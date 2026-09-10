/* Trilheiros Gestão V35 — reserva sincronizada sem digitação manual + relatório profissional sem CPF/responsável */
(function(){
'use strict';
if(typeof state==='undefined')return;

const q=(s,r=document)=>r.querySelector(s);
const n=v=>Math.max(0,Number(v||0)||0);
const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v||0));
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'America/Cuiaba'});
const GUIDE_NAME='Jonatas Marques de Arruda';
const GUIDE_ROLE='GUIA DE TURISMO';
const LOGO='https://i.postimg.cc/JnF2F9Hw/LOGO-TRILHEIROS-Photoroom.png';
const installmentFallback={salto_nuvens:2,nobres_bom_jardim:2,rio_cristalino:3,jaciara_canyon:3};
const saleCache=new Map();

function payKind(v){
  const s=String(v||'').toLowerCase();
  if(s.includes('parcel')||s.includes('install'))return'pix_installment';
  if(s.includes('card')||s.includes('cart'))return'card';
  if(s.includes('pix'))return'pix';
  if(s.includes('cash')||s.includes('dinheiro'))return'cash';
  return'other';
}
function payLabel(v){return({pix:'PIX',card:'CARTÃO',pix_installment:'PIX PARCELADO',cash:'DINHEIRO',other:'OUTRO'})[payKind(v)]||'OUTRO'}
function norm(v){return String(v||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'')}
function optionLabel(v,tripId=''){
  const raw=String(v||'').trim();if(!raw)return'';
  const k=norm(raw);
  const map={
    individual:'Individual',adulto:'Individual',adult:'Individual',
    casal:'Casal',compartilhado:'Individual • Quarto compartilhado',quarto_compartilhado:'Individual • Quarto compartilhado',
    casal_sem_banheiro:'Casal • Sem banheiro',casal_com_banheiro:'Casal • Com banheiro',
    camping:'Camping',crianca:'Criança',child:'Criança',infantil:'Criança',
    withtransport:'Com transporte',with_transport:'Com transporte',withouttransport:'Sem transporte',without_transport:'Sem transporte'
  };
  if(map[k])return map[k];
  return raw.replaceAll('_',' ');
}
function optionOf(r,sale){
  const a=r?.registration_answers||{};
  const values=[sale?.category,sale?.accommodation,sale?.participant_type,r?.category,r?.accommodation,r?.participant_type,a?.opcao?.value,a?.tipo?.value,a?.categoria?.value,a?.participacao?.value];
  for(const v of values){const x=optionLabel(v,r?.trip_id);if(x)return x}
  const seats=n(r?.seats||sale?.seats)||1;
  return seats===1?'Individual':`${seats} pessoas`;
}
function totalOf(r,sale,t){
  const values=[sale?.sale_total,r?.sale_total];
  for(const v of values)if(n(v)>0)return n(v);
  const composed=n(sale?.paid_amount||r?.paid_amount)+n(sale?.balance_due||r?.balance_due)-n(sale?.refunded_amount||r?.refunded_amount);
  if(composed>0)return composed;
  return n(t?.default_price)*Math.max(1,n(r?.seats||sale?.seats));
}
function paidOf(r,sale){return Math.max(n(r?.paid_amount),n(sale?.paid_amount))}
function countOf(r,sale){return Math.max(1,Math.round(n(sale?.installment_total||r?.installment_total||installmentFallback[r?.trip_id]||1)))}
function amountToConfirm(r,sale,t){
  const total=totalOf(r,sale,t),paid=paidOf(r,sale),balance=Math.max(0,total-paid);
  if(payKind(sale?.payment_method||r?.payment_method)==='pix_installment'){
    const installment=Math.round((total/countOf(r,sale))*100)/100;
    return Math.min(balance,installment||balance);
  }
  return balance;
}
function participantsOf(r,sale){
  const p=(r?.participants?.length?r.participants:sale?.participants||[]).map(x=>x?.full_name).filter(Boolean);
  if(p.length)return p;
  const name=r?.responsible_name||sale?.customer_name||'';
  return name?[name]:[];
}
function isCanva(r){return String(r?.source||'').includes('public_portal')||r?.channel==='canva_reserva_passeios'}
async function loadSale(r,force=false){
  const id=r?.sale_id||r?.id;if(!id)return null;
  if(!force&&saleCache.has(id))return saleCache.get(id);
  try{const s=await db.collection('sales').doc(id).get();const d=s.exists?{id:s.id,...s.data()}:null;saleCache.set(id,d);return d}catch(_){return null}
}
function notify(msg,type=''){try{return typeof toast==='function'?toast(msg,type):alert(msg)}catch(_){alert(msg)}}
function closeV35(){q('#v35ReservationModal')?.remove()}

function injectStyle(){
  if(q('#v35Style'))return;
  const s=document.createElement('style');s.id='v35Style';s.textContent=`
  .v35Modal{max-width:760px}.v35Grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.v35Fact{border:1px solid rgba(7,50,38,.14);background:#f7faf8;border-radius:16px;padding:14px}.v35Fact.wide{grid-column:1/-1}.v35Fact span{display:block;font-size:10px;font-weight:900;letter-spacing:.08em;color:#6a8178;margin-bottom:6px}.v35Fact strong{font-size:17px;color:#073226}.v35Pay{background:#edf8f2;border-color:#b7dfca}.v35Info{margin-top:16px;padding:13px 15px;border-radius:14px;background:#fff8df;border:1px solid #ead49a;color:#5f4d13;font-size:13px}.v35Names{line-height:1.6}.v35Paid{color:#137a50!important}.v35Pending{color:#9a6500!important}@media(max-width:650px){.v35Grid{grid-template-columns:1fr}.v35Fact.wide{grid-column:auto}}
  `;document.head.appendChild(s);
}
injectStyle();

async function mergedData(tripId,id){
  const r=(state.reservations||[]).find(x=>x.trip_id===tripId&&x.id===id);if(!r)return null;
  const sale=await loadSale(r,true);
  const t=(state.trips||[]).find(x=>x.id===tripId);
  return{r,sale,t};
}

window.openSyncedReservationV35=async function(tripId,id){
  const data=await mergedData(tripId,id);if(!data)return notify('Reserva não encontrada.','error');
  const {r,sale,t}=data;
  const name=r.responsible_name||sale?.customer_name||participantsOf(r,sale)[0]||'Cliente';
  const trip=t?.name||sale?.trip_name||r.trip_name||'Passeio';
  const method=sale?.payment_method||r.payment_method||'';
  const total=totalOf(r,sale,t),paid=paidOf(r,sale),balance=Math.max(0,total-paid),amount=amountToConfirm(r,sale,t);
  const option=optionOf(r,sale),names=participantsOf(r,sale),kind=payKind(method),status=balance<=0.009?'Pago':paid>0?'Parcial':'Pendente';
  closeV35();
  const back=document.createElement('div');back.id='v35ReservationModal';back.className='modalBack';
  back.innerHTML=`<div class="modal v35Modal"><div class="modalHead"><div><span class="eyebrow">RESERVA SINCRONIZADA</span><h2>${esc(name)}</h2><p>${esc(trip)} • ${n(r.seats||sale?.seats)||1} vaga(s)</p></div><button type="button" class="iconClose" id="v35Close">✕</button></div><div class="modalBody"><div class="v35Grid"><div class="v35Fact"><span>TIPO / OPÇÃO ESCOLHIDA</span><strong>${esc(option)}</strong></div><div class="v35Fact"><span>FORMA DE PAGAMENTO</span><strong>${esc(payLabel(method))}</strong></div><div class="v35Fact"><span>VALOR DA RESERVA</span><strong>${money(total)}</strong></div><div class="v35Fact"><span>STATUS FINANCEIRO</span><strong class="${balance<=0.009?'v35Paid':'v35Pending'}">${status}</strong></div><div class="v35Fact"><span>JÁ CONFIRMADO</span><strong>${money(paid)}</strong></div><div class="v35Fact v35Pay"><span>${kind==='pix_installment'?'PRÓXIMA PARCELA A CONFIRMAR':'VALOR A CONFIRMAR'}</span><strong>${money(amount)}</strong></div><div class="v35Fact wide"><span>NOME DOS PARTICIPANTES</span><strong class="v35Names">${esc(names.join(' • ')||name)}</strong></div></div><div class="v35Info">Os dados e valores vêm automaticamente do sistema de reservas. Confira o recebimento no banco/Mercado Pago e apenas confirme — não é necessário digitar valor manualmente.</div><div id="v35Msg"></div></div><div class="modalFoot"><button type="button" class="btn ghost" id="v35Cancel">Fechar</button>${balance>0.009?`<button type="button" class="btn primary" id="v35Confirm">${kind==='pix_installment'?`Confirmar parcela ${money(amount)}`:`Confirmar pagamento ${money(amount)}`}</button>`:`<button type="button" class="btn primary" disabled>Pagamento confirmado</button>`}</div></div>`;
  document.body.appendChild(back);
  q('#v35Close',back).onclick=q('#v35Cancel',back).onclick=closeV35;back.onclick=e=>{if(e.target===back)closeV35()};
  if(q('#v35Confirm',back))q('#v35Confirm',back).onclick=()=>window.confirmSyncedPaymentV35(tripId,id,r.sale_id||r.id);
};

window.confirmSyncedPaymentV35=async function(tripId,id,saleId){
  const btn=q('#v35Confirm'),msg=q('#v35Msg');if(btn){btn.disabled=true;btn.textContent='Confirmando...'}
  try{
    const resRef=db.collection('trips').doc(tripId).collection('reservations').doc(id),saleRef=db.collection('sales').doc(saleId||id),day=today(),stamp=firebase.firestore.FieldValue.serverTimestamp();
    let confirmed=0,newPaid=0,newBalance=0,newStatus='pending',method='pix',total=0,count=1;
    await db.runTransaction(async tx=>{
      const rs=await tx.get(resRef);if(!rs.exists)throw Error('Reserva não encontrada.');
      const ss=await tx.get(saleRef);const rd=rs.data(),sd=ss.exists?ss.data():null,t=(state.trips||[]).find(x=>x.id===tripId);
      method=sd?.payment_method||rd.payment_method||'pix';total=totalOf(rd,sd,t);const oldPaid=Math.max(n(rd.paid_amount),n(sd?.paid_amount));const remaining=Math.max(0,total-oldPaid);if(remaining<=0)throw Error('Pagamento já confirmado.');
      count=countOf({...rd,trip_id:tripId},sd);confirmed=payKind(method)==='pix_installment'?Math.min(remaining,Math.round((total/count)*100)/100):remaining;if(confirmed<=0)throw Error('Valor da reserva não identificado.');
      newPaid=Math.min(total,Math.round((oldPaid+confirmed)*100)/100);newBalance=Math.max(0,Math.round((total-newPaid)*100)/100);newStatus=newBalance<=0.009?'paid':'partial';
      const entry={amount:confirmed,date:day,method,source:'admin_confirm_v35'};
      const rPatch={sale_total:total,paid_amount:newPaid,balance_due:newBalance,payment_status:newStatus,payment_method:method,payment_history:[...(rd.payment_history||[]),entry],received_date:day,installment_total:payKind(method)==='pix_installment'?count:(rd.installment_total||null),updated_at:stamp};
      tx.update(resRef,rPatch);
      if(ss.exists){const sPatch={sale_total:total,paid_amount:newPaid,balance_due:newBalance,payment_status:newStatus,payment_method:method,payment_history:[...(sd.payment_history||[]),entry],received_date:day,installment_total:payKind(method)==='pix_installment'?count:(sd.installment_total||null),updated_at:stamp};tx.update(saleRef,sPatch)}
    });
    saleCache.delete(saleId||id);
    const local=(state.reservations||[]).find(x=>x.trip_id===tripId&&x.id===id);if(local){local.sale_total=total;local.paid_amount=newPaid;local.balance_due=newBalance;local.payment_status=newStatus;local.payment_method=method;local.received_date=day;local.installment_total=count;}
    closeV35();notify(newStatus==='paid'?`Pagamento ${money(confirmed)} confirmado. Reserva quitada.`:`Parcela ${money(confirmed)} confirmada. Saldo ${money(newBalance)}.`,'success');if(typeof renderAdmin==='function')renderAdmin();
  }catch(e){if(msg)msg.innerHTML=`<div class="msg error">${esc(e.message||e)}</div>`;if(btn){btn.disabled=false;btn.textContent='Tentar novamente'}}
};

const oldReservationModal=window.reservationModal;
window.reservationModal=async function(tripId,id){
  const r=(state.reservations||[]).find(x=>x.trip_id===tripId&&x.id===id);
  if(r&&isCanva(r))return window.openSyncedReservationV35(tripId,id);
  if(typeof oldReservationModal==='function')return oldReservationModal(tripId,id);
};
try{reservationModal=window.reservationModal}catch(_){ }

const oldPending=window.openPendingPaymentV32;
window.openPendingPaymentV32=async function(tripId,id){
  const r=(state.reservations||[]).find(x=>x.trip_id===tripId&&x.id===id);
  if(r&&isCanva(r))return window.openSyncedReservationV35(tripId,id);
  if(typeof oldPending==='function')return oldPending(tripId,id);
};

async function enhancePending(){
  if(state.tab!=='pending')return;
  const rs=(state.reservations||[]).filter(r=>['pending','partial'].includes(r.payment_status)&&r.status!=='cancelled');
  const items=[...document.querySelectorAll('.pendingList .pendingItem')].filter(el=>String(el.querySelector('span')?.textContent||'').toLowerCase().includes('pagamento')||el.dataset.v32Payment==='1');
  for(let i=0;i<Math.min(rs.length,items.length);i++){
    const r=rs[i],sale=await loadSale(r),t=(state.trips||[]).find(x=>x.id===r.trip_id),el=items[i];
    const name=r.responsible_name||sale?.customer_name||r.participants?.[0]?.full_name||'Sem nome',trip=t?.name||sale?.trip_name||r.trip_name||'Passeio',method=sale?.payment_method||r.payment_method,option=optionOf(r,sale),total=totalOf(r,sale,t),amount=amountToConfirm(r,sale,t);
    const strong=el.querySelector('strong'),tag=el.querySelector('span');if(tag)tag.textContent=payKind(method)==='pix_installment'?'PIX PARCELADO':'PAGAMENTO';
    if(strong)strong.textContent=payKind(method)==='pix_installment'?`${name} • ${trip} • ${option} • ${payLabel(method)} • parcela ${money(amount)} • total ${money(total)}`:`${name} • ${trip} • ${option} • ${payLabel(method)} • ${money(total)}`;
    el.onclick=e=>{e.preventDefault();window.openSyncedReservationV35(r.trip_id,r.id)};
  }
}

const previousRender=window.renderAdmin;
if(typeof previousRender==='function'){
  window.renderAdmin=function(...args){const out=previousRender.apply(this,args);setTimeout(()=>enhancePending().catch(()=>{}),100);setTimeout(updateReportDescriptions,120);return out};
  try{renderAdmin=window.renderAdmin}catch(_){ }
}

function updateReportDescriptions(){
  document.querySelectorAll('.reportCards button').forEach(btn=>{
    const title=btn.querySelector('strong')?.textContent||'',small=btn.querySelector('small');
    if(!small)return;
    if(title.includes('Lista oficial de participantes'))small.textContent='Nome do participante e tipo/opção escolhida. Sem CPF e sem responsável.';
  });
}

async function waitPdf(){for(let i=0;i<60;i++){if(window.jspdf?.jsPDF)return true;try{if(typeof ensurePdfLibraries==='function')await ensurePdfLibraries()}catch(_){ }await new Promise(r=>setTimeout(r,100))}return false}
async function logoData(){try{const resp=await fetch(LOGO),blob=await resp.blob();return await new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>res(fr.result);fr.onerror=rej;fr.readAsDataURL(blob)})}catch{return null}}
function slug(v){return String(v||'passeio').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}
function dateBR(v){const s=String(v||'').slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return s||'—';const[y,m,d]=s.split('-');return`${d}/${m}/${y}`}

window.pdfTrip=async function(id){
  if(!id)return notify('Selecione um passeio.','error');const t=(state.trips||[]).find(x=>x.id===id);if(!t)return notify('Passeio não encontrado.','error');
  try{
    if(!await waitPdf())throw Error('Biblioteca PDF indisponível.');
    const reservations=(state.reservations||[]).filter(r=>r.trip_id===id&&r.status!=='cancelled');
    const enriched=await Promise.all(reservations.map(async r=>({r,sale:await loadSale(r,true)})));
    const people=[{name:GUIDE_NAME,type:GUIDE_ROLE,special:true}];
    enriched.forEach(({r,sale})=>{const type=optionOf(r,sale),names=participantsOf(r,sale);names.forEach(name=>people.push({name,type,special:false}))});
    const {jsPDF}=window.jspdf,doc=new jsPDF({unit:'mm',format:'a4'}),logo=await logoData();
    doc.setFillColor(7,50,38);doc.rect(0,0,210,57,'F');doc.setFillColor(216,173,66);doc.rect(0,57,210,2,'F');if(logo)try{doc.addImage(logo,'PNG',14,9,30,30)}catch(_){ }
    doc.setTextColor(255);doc.setFont('helvetica','bold');doc.setFontSize(10);doc.text('TRILHEIROS DE RONDONÓPOLIS',logo?51:14,17);doc.setFontSize(22);doc.text('LISTA DE PARTICIPANTES',logo?51:14,29);doc.setFont('helvetica','normal');doc.setFontSize(10);doc.text(String(t.name||''),logo?51:14,40);doc.text(`${dateBR(t.trip_date)} • ${t.destination||''}`,logo?51:14,47);
    doc.setTextColor(20,45,35);doc.setFont('helvetica','bold');doc.setFontSize(14);doc.text('Participantes e tipo de reserva',14,73);
    doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(85,105,97);doc.text(`Total na lista: ${people.length} • Reservas: ${reservations.length}`,14,81);
    const body=people.map((p,i)=>[String(i+1).padStart(2,'0'),p.name,p.type]);
    doc.autoTable({startY:88,head:[['Nº','NOME DO PARTICIPANTE','TIPO / OPÇÃO']],body,theme:'grid',styles:{font:'helvetica',fontSize:9,cellPadding:3,textColor:[25,48,40],lineColor:[220,231,226],lineWidth:.15},headStyles:{fillColor:[7,50,38],textColor:[255,255,255],fontStyle:'bold'},columnStyles:{0:{cellWidth:14,halign:'center'},1:{cellWidth:105},2:{cellWidth:63}},margin:{left:14,right:14,bottom:17},didParseCell:data=>{if(data.section==='body'&&data.row.index===0){data.cell.styles.fillColor=[248,241,215];data.cell.styles.fontStyle='bold'}},didDrawPage:data=>{doc.setFontSize(7.5);doc.setTextColor(105);doc.text(`Trilheiros de Rondonópolis • ${t.name}`,14,291);doc.text(`Página ${data.pageNumber}`,194,291,{align:'right'})}});
    const filename=`lista-participantes-${slug(t.name)}-${String(t.trip_date||'').slice(0,10)}.pdf`;
    if(typeof window.openPdfPreviewV14==='function')window.openPdfPreviewV14(doc,{filename,title:'Lista de participantes',subtitle:`${t.name} • nome e tipo/opção`,shareText:`Lista de participantes — ${t.name}`});else doc.save(filename);
  }catch(e){console.error('PDF V35',e);notify('Não foi possível gerar o relatório.','error')}
};
try{pdfTrip=window.pdfTrip}catch(_){ }

setTimeout(()=>{enhancePending().catch(()=>{});updateReportDescriptions()},500);
})();
