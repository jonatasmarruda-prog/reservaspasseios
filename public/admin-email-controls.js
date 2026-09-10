/* Trilheiros Gestão — controles de e-mail na tela de Vendas */
(function(){
'use strict';
if(!location.pathname.startsWith('/admin'))return;
const q=(s,r=document)=>r.querySelector(s),qa=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#039;'}[c]));
const n=v=>Math.max(0,Number(v||0)||0);
const validEmail=v=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v||'').trim());
function notify(msg,type=''){try{return typeof toast==='function'?toast(msg,type):alert(msg)}catch(_){alert(msg)}}
function fullyPaid(s){const total=n(s?.sale_total),paid=n(s?.paid_amount),bal=Math.max(0,n(s?.balance_due));return s?.sale_status!=='cancelled'&&s?.payment_status==='paid'&&bal<=0.009&&(!total||paid>=total-0.009)}
function emailOf(s){return String(s?.customer_email||s?.email||'').trim()}
function emailState(s){
  const email=emailOf(s);
  if(s?.sale_status==='cancelled')return{key:'off',label:'Cancelada',action:''};
  if(!validEmail(email))return{key:'noemail',label:'Sem e-mail',action:''};
  if(s?.welcome_email_sent_at||s?.welcome_email_status==='sent')return{key:'sent',label:'Enviado',action:'Reenviar'};
  if(s?.welcome_email_status==='error')return{key:'error',label:'Erro no envio',action:'Tentar novamente'};
  if(!fullyPaid(s))return{key:'waiting',label:'Após quitação',action:''};
  if(s?.welcome_email_status==='sending'||s?.welcome_email_status==='pending')return{key:'pending',label:'Aguardando envio',action:''};
  return{key:'ready',label:'Pronto para enviar',action:'Enviar agora'};
}
function injectStyle(){
  if(q('#emailControlStyle'))return;
  const s=document.createElement('style');s.id='emailControlStyle';s.textContent=`
  .emailControlCell{min-width:150px}.emailBadge{display:inline-flex;align-items:center;gap:5px;padding:5px 8px;border-radius:999px;font-size:10px;font-weight:900;white-space:nowrap}.emailBadge.sent{background:#e2f6eb;color:#17603f}.emailBadge.pending,.emailBadge.ready{background:#fff4d8;color:#785617}.emailBadge.error{background:#ffebe8;color:#a12d24}.emailBadge.waiting,.emailBadge.noemail,.emailBadge.off{background:#edf1ef;color:#60716a}.emailAddress{display:block;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:5px;color:#6d7c76;font-size:10px}.emailAction{margin-top:6px;border:1px solid #bfd2ca;background:#fff;color:#0b523d;border-radius:8px;padding:6px 8px;font-size:10px;font-weight:900;cursor:pointer}.emailAction:hover{background:#eff7f3}
  `;document.head.appendChild(s);
}
injectStyle();

async function saleById(id){const snap=await db.collection('sales').doc(id).get();return snap.exists?{id:snap.id,...snap.data()}:null}
window.requestWelcomeEmailV37=async function(id){
  try{
    const s=await saleById(id);if(!s)throw Error('Venda não encontrada.');
    if(!fullyPaid(s))throw Error('O e-mail de boas-vindas só pode ser enviado depois da quitação total.');
    const email=emailOf(s);if(!validEmail(email))throw Error('Esta venda não possui um e-mail válido.');
    if((s.welcome_email_sent_at||s.welcome_email_status==='sent')&&!confirm(`Reenviar o e-mail de boas-vindas para ${email}?`))return;
    const stamp=firebase.firestore.FieldValue.serverTimestamp(),del=firebase.firestore.FieldValue.delete();
    const patch={welcome_email_status:'pending',welcome_email_resend_requested_at:stamp,welcome_email_error:del,welcome_email_sent_at:del,welcome_email_resend_id:del};
    if(!s.payment_completed_at)patch.payment_completed_at=stamp;
    await db.collection('sales').doc(id).update(patch);
    notify('E-mail colocado na fila. O envio ocorre automaticamente em poucos minutos.','success');
    if(typeof window.renderSalesPageV37==='function')window.renderSalesPageV37();
  }catch(e){notify(e.message||'Não foi possível solicitar o e-mail.','error')}
};

async function enhanceSalesEmail(){
  const table=q('.v22SaleTable');if(!table||q('.emailControlHead',table))return;
  try{
    const ss=await db.collection('sales').orderBy('created_at','desc').limit(500).get(),map=new Map(ss.docs.map(d=>[d.id,{id:d.id,...d.data()}]));
    const headRow=q('thead tr',table),actionHead=headRow?.lastElementChild;
    if(headRow&&actionHead){const th=document.createElement('th');th.className='emailControlHead';th.textContent='E-mail';headRow.insertBefore(th,actionHead)}
    qa('tbody tr',table).forEach(row=>{
      const id=q('[data-v37-open]',row)?.dataset.v37Open||q('[data-v37-pay]',row)?.dataset.v37Pay||q('[data-v37-delete]',row)?.dataset.v37Delete||q('[data-v37-cancel]',row)?.dataset.v37Cancel;
      const s=map.get(id);if(!s)return;const st=emailState(s),actionCell=row.lastElementChild,td=document.createElement('td');td.className='emailControlCell';
      td.innerHTML=`<span class="emailBadge ${esc(st.key)}">📧 ${esc(st.label)}</span>${emailOf(s)?`<small class="emailAddress" title="${esc(emailOf(s))}">${esc(emailOf(s))}</small>`:''}${st.action?`<button class="emailAction" data-email-action="${esc(id)}">${esc(st.action)}</button>`:''}`;
      row.insertBefore(td,actionCell);
    });
    qa('[data-email-action]',table).forEach(b=>b.onclick=e=>{e.preventDefault();e.stopPropagation();window.requestWelcomeEmailV37(b.dataset.emailAction)});
  }catch(e){console.warn('EMAIL_STATUS_VENDAS',e)}
}

function watchPaymentCompletion(id){
  if(!id||typeof db==='undefined')return;
  const ref=db.collection('sales').doc(id);let stopped=false;
  const unsub=ref.onSnapshot(async snap=>{
    if(stopped||!snap.exists)return;const s=snap.data()||{};
    if(!fullyPaid(s))return;
    stopped=true;unsub();
    try{
      const stamp=firebase.firestore.FieldValue.serverTimestamp(),patch={};
      if(!s.payment_completed_at)patch.payment_completed_at=stamp;
      if(validEmail(emailOf(s))&&!s.welcome_email_sent_at&&!['sent','sending','pending'].includes(String(s.welcome_email_status||'')))patch.welcome_email_status='pending';
      if(Object.keys(patch).length)await ref.update(patch);
    }catch(e){console.warn('EMAIL_PAYMENT_MARKER',e)}
  },()=>{});
  setTimeout(()=>{if(!stopped){stopped=true;unsub()}},10*60*1000);
}

const originalPay=window.openPaymentV22;
if(typeof originalPay==='function'&&!originalPay.__emailWatch){
  const wrapped=function(id,...args){watchPaymentCompletion(id);return originalPay.call(this,id,...args)};wrapped.__emailWatch=true;window.openPaymentV22=wrapped;
}
const originalRender=window.renderSalesPageV37;
if(typeof originalRender==='function'&&!originalRender.__emailStatus){
  const wrapped=async function(...args){const out=await originalRender.apply(this,args);await enhanceSalesEmail();return out};wrapped.__emailStatus=true;window.renderSalesPageV37=wrapped;window.renderSalesPageV21=wrapped;try{renderSalesPageV21=wrapped}catch(_){ }
}
setTimeout(enhanceSalesEmail,450);
})();
