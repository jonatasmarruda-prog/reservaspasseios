/* Integração Recibos -> Trilheiros Gestão V44 */
(function(){
'use strict';
const SUPABASE_URL='https://dvblpobtfjtjypsjcjpy.supabase.co';
const SUPABASE_KEY='sb_publishable_GcAzTPw3G_zPrB_ox9BQuQ_JfWZoqXz';
const params=new URLSearchParams(location.search);
const transfer=params.get('receipt_transfer'),receiptId=params.get('rid'),code=params.get('code'),verification=params.get('v');
if(!location.pathname.startsWith('/admin')||!transfer||!receiptId||!code||!verification)return;

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#039;'}[c]));
const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v||0));
const brDate=v=>{const s=String(v||'').slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return s||'—';const[y,m,d]=s.split('-');return `${d}/${m}/${y}`};
const notify=(m,t='')=>{try{if(typeof toast==='function')return toast(m,t)}catch(_){} alert(m)};
const close=()=>document.querySelector('#receiptFinanceImportV44')?.remove();

async function rpc(name,body){
  const res=await fetch(SUPABASE_URL+'/rest/v1/rpc/'+name,{
    method:'POST',
    headers:{'apikey':SUPABASE_KEY,'content-type':'application/json','accept':'application/json'},
    body:JSON.stringify(body)
  });
  const text=await res.text();
  let data=null;try{data=text?JSON.parse(text):null}catch{data=text}
  if(!res.ok)throw new Error(data?.message||data?.error||text||'Erro na integração de recibos.');
  return data;
}
function activeTrips(){
  return (window.state?.trips||[]).filter(t=>t.status!=='cancelled').sort((a,b)=>String(a.trip_date||'').localeCompare(String(b.trip_date||'')));
}
function suggestedTrip(receipt,trips){
  const d=String(receipt.service_date||'').slice(0,10);
  return trips.find(t=>{
    const start=String(t.trip_date||'').slice(0,10),end=String(t.trip_end_date||start).slice(0,10);
    return d&&start&&d>=start&&d<=end;
  })||null;
}
async function alreadyImported(){
  try{
    const snap=await db.collection('expenses').where('source_receipt_id','==',receiptId).limit(1).get();
    return !snap.empty;
  }catch(_){return false}
}
async function loadReceipt(){
  const data=await rpc('validate_receipt',{p_code:code,p_verification:verification});
  const r=Array.isArray(data)?data[0]:null;
  if(!r)throw new Error('Não foi possível validar o recibo antes de lançar a despesa.');
  return r;
}
function openModal(r){
  close();
  const trips=activeTrips(),suggested=suggestedTrip(r,trips);
  const back=document.createElement('div');back.id='receiptFinanceImportV44';back.className='modalBack';
  const per=r.billing_mode==='per_person';
  back.innerHTML=`<div class="modal">
    <div class="modalHead"><div><span class="eyebrow">RECIBO DIGITAL</span><h2>Enviar para o Financeiro</h2><p>Escolha o passeio e confirme. A despesa será registrada como paga usando os dados do recibo.</p></div><button type="button" class="iconClose" id="rfiClose">✕</button></div>
    <form id="rfiForm">
      <div class="modalBody">
        <div class="receiptImportSummary">
          <div><span>RECIBO</span><strong>${esc(r.receipt_code)}</strong></div>
          <div><span>FORNECEDOR</span><strong>${esc(r.supplier_name)}</strong></div>
          <div><span>SERVIÇO</span><strong>${esc(r.service_type)}${r.service_reference?' — '+esc(r.service_reference):''}</strong></div>
          <div><span>DATA</span><strong>${brDate(r.service_date)}</strong></div>
          <div><span>VALOR</span><strong>${money(r.amount_received)}</strong></div>
          <div><span>COBRANÇA</span><strong>${per?esc(String(r.quantity_people||0))+' pessoa(s) × '+money(r.unit_amount):'Valor total'}</strong></div>
        </div>
        <label style="display:block;margin-top:16px"><span>Passeio que recebeu esta despesa</span><select name="trip" required>
          <option value="">Selecione o passeio</option>
          ${trips.map(t=>`<option value="${esc(t.id)}" ${suggested?.id===t.id?'selected':''}>${esc(t.name)} — ${brDate(t.trip_date)}</option>`).join('')}
        </select></label>
        <div class="grid two" style="margin-top:14px">
          <label><span>Categoria</span><input name="category" value="${esc(r.service_type||'Despesa')}"></label>
          <label><span>Data do pagamento</span><input name="paidDate" type="date" value="${esc(String(r.payment_date||r.service_date||'').slice(0,10))}"></label>
        </div>
        <div class="msg info" style="margin-top:14px">O lançamento será marcado como <b>PAGO</b>. O recibo original continuará arquivado no sistema de recibos e ficará vinculado a este passeio.</div>
        <div id="rfiMsg"></div>
      </div>
      <div class="modalFoot"><button type="button" class="btn ghost" id="rfiCancel">Cancelar</button><button class="btn primary">Confirmar e lançar despesa</button></div>
    </form>
  </div>`;
  document.body.appendChild(back);
  document.querySelector('#rfiClose').onclick=document.querySelector('#rfiCancel').onclick=close;
  const form=document.querySelector('#rfiForm');
  form.onsubmit=async e=>{
    e.preventDefault();
    const msg=document.querySelector('#rfiMsg'),btn=form.querySelector('.primary'),tripId=form.trip.value;
    const trip=trips.find(t=>t.id===tripId);
    if(!trip){msg.innerHTML='<div class="msg error">Selecione o passeio.</div>';return}
    btn.disabled=true;btn.textContent='Lançando despesa...';
    try{
      if(await alreadyImported())throw new Error('Este recibo já foi lançado no Financeiro.');
      const pp=r.billing_mode==='per_person',stamp=firebase.firestore.FieldValue.serverTimestamp();
      const expense={
        trip_id:trip.id,trip_name:trip.name,
        category:form.category.value.trim()||r.service_type||'Despesa',
        description:[r.service_type,r.service_reference,r.supplier_name,'Recibo '+r.receipt_code].filter(Boolean).join(' — '),
        cost_mode:pp?'per_person':'fixed',
        unit_amount:pp?Number(r.unit_amount||0):Number(r.amount_received||0),
        quantity_basis:pp?Number(r.quantity_people||0):1,
        amount:Number(r.amount_received||0),
        dynamic_per_person:false,
        due_date:form.paidDate.value||String(r.payment_date||'').slice(0,10),
        expense_date:String(r.service_date||form.paidDate.value||'').slice(0,10),
        payment_status:'paid',status:'paid',
        paid_date:form.paidDate.value||String(r.payment_date||'').slice(0,10),
        source:'receipt_system',
        source_receipt_id:receiptId,
        source_receipt_code:r.receipt_code,
        source_receipt_verification:r.verification_code,
        supplier_name:r.supplier_name,
        created_at:stamp,updated_at:stamp
      };
      await db.collection('expenses').add(expense);
      await rpc('mark_finance_transfer',{p_receipt_id:receiptId,p_token:transfer,p_trip_id:trip.id,p_trip_name:trip.name});
      if(window.state){state.expenses=state.expenses||[];state.expenses.push(expense)}
      const cleanUrl=new URL(location.href);['receipt_transfer','rid','code','v'].forEach(k=>cleanUrl.searchParams.delete(k));history.replaceState({},'',cleanUrl.pathname+cleanUrl.search+cleanUrl.hash);
      close();notify('Recibo lançado como despesa em '+trip.name+'.','success');
      try{if(typeof renderAdmin==='function')renderAdmin()}catch(_){}
    }catch(err){msg.innerHTML='<div class="msg error">'+esc(err.message||err)+'</div>';btn.disabled=false;btn.textContent='Confirmar e lançar despesa'}
  };
}
async function start(){
  try{
    if(typeof db==='undefined'||!window.state||!Array.isArray(state.trips)){setTimeout(start,500);return}
    if(await alreadyImported()){notify('Este recibo já está registrado no Financeiro.','success');return}
    const r=await loadReceipt();openModal(r);
  }catch(err){notify(err.message||'Não foi possível carregar o recibo para o Financeiro.','error')}
}
window.addEventListener('load',()=>setTimeout(start,700));
setTimeout(start,1800);

const style=document.createElement('style');
style.textContent=`
.receiptImportSummary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.receiptImportSummary>div{padding:12px;border:1px solid #dce8e2;border-radius:12px;background:#f7fbf9}
.receiptImportSummary span{display:block;font-size:9px;font-weight:900;letter-spacing:.05em;color:#6c8177}
.receiptImportSummary strong{display:block;margin-top:4px;color:#173f31}
@media(max-width:600px){.receiptImportSummary{grid-template-columns:1fr}}
`;
document.head.appendChild(style);
})();