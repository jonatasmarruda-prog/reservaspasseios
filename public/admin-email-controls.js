/* Trilheiros Gestão — controles de e-mail + disparo imediato pós-pagamento */
(function(){
'use strict';
if(!location.pathname.startsWith('/admin'))return;
const q=(s,r=document)=>r.querySelector(s),qa=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#039;'}[c]));
const n=v=>Math.max(0,Number(v||0)||0);
const validEmail=v=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v||'').trim());
const IMMEDIATE_PAYMENT_URL='https://trilheiros-automacoes.netlify.app/.netlify/functions/payment-confirmed';
function notify(msg,type=''){try{return typeof toast==='function'?toast(msg,type):alert(msg)}catch(_){alert(msg)}}
function canManageEmail(){return['owner','admin','finance'].includes(String(state?.role||''))}
function fullyPaid(s){
  const total=n(s?.sale_total||s?.total_amount||s?.amount),paid=n(s?.paid_amount||s?.amount_paid||s?.received_amount),rawBal=Number(s?.balance_due),bal=Number.isFinite(rawBal)?Math.max(0,rawBal):Math.max(0,total-paid),status=String(s?.payment_status||s?.status||'').toLowerCase(),explicit=['paid','confirmed','approved','completed','pago','quitado'].includes(status)||s?.payment_confirmed===true;
  return s?.sale_status!=='cancelled'&&bal<=0.009&&(explicit||(total>0&&paid>=total-0.009)||!!s?.payment_completed_at);
}
function emailOf(s){return String(s?.customer_email||s?.email||'').trim()}
function emailState(s){
  const email=emailOf(s);
  if(s?.sale_status==='cancelled')return{key:'off',label:'Cancelada',action:''};
  if(!validEmail(email))return{key:'noemail',label:'Sem e-mail',action:''};
  if(s?.welcome_email_sent_at||s?.welcome_email_status==='sent')return{key:'sent',label:'Enviado',action:'Reenviar'};
  if(s?.welcome_email_status==='error')return{key:'error',label:'Erro no envio',action:'Tentar novamente'};
  if(!fullyPaid(s))return{key:'waiting',label:'Após quitação',action:''};
  if(s?.welcome_email_status==='sending'||s?.welcome_email_status==='pending')return{key:'pending',label:'Envio automático imediato',action:''};
  return{key:'ready',label:'Pronto para envio automático',action:'Enviar agora'};
}
function injectStyle(){
  if(q('#emailControlStyle'))return;
  const s=document.createElement('style');s.id='emailControlStyle';s.textContent=`
  .emailControlCell{min-width:170px}.emailBadge{display:inline-flex;align-items:center;gap:5px;padding:5px 8px;border-radius:999px;font-size:10px;font-weight:900;white-space:nowrap}.emailBadge.sent{background:#e2f6eb;color:#17603f}.emailBadge.pending,.emailBadge.ready{background:#fff4d8;color:#785617}.emailBadge.error{background:#ffebe8;color:#a12d24}.emailBadge.waiting,.emailBadge.noemail,.emailBadge.off{background:#edf1ef;color:#60716a}.emailAddress{display:block;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:5px;color:#6d7c76;font-size:10px}.emailAction{margin-top:6px;border:1px solid #bfd2ca;background:#fff;color:#0b523d;border-radius:8px;padding:6px 8px;font-size:10px;font-weight:900;cursor:pointer}.emailAction:hover{background:#eff7f3}
  `;document.head.appendChild(s);
}
injectStyle();

async function saleById(id){const snap=await db.collection('sales').doc(id).get();return snap.exists?{id:snap.id,...snap.data()}:null}
async function tripForSale(s){
  const local=(state?.trips||[]).find(t=>String(t.id)===String(s?.trip_id));if(local)return local;
  if(!s?.trip_id)return null;
  try{const snap=await db.collection('trips').doc(String(s.trip_id)).get();return snap.exists?{id:snap.id,...snap.data()}:null}catch(_){return null}
}
async function queuePaidWelcome(id,{silent=false}={}){
  if(!id||typeof db==='undefined')return false;
  const ref=db.collection('sales').doc(id),snap=await ref.get();if(!snap.exists)return false;
  const s={id:snap.id,...snap.data()};
  if(!fullyPaid(s)||s.welcome_email_sent_at||s.welcome_email_status==='sent')return false;
  const stamp=firebase.firestore.FieldValue.serverTimestamp(),patch={};
  if(!s.payment_completed_at)patch.payment_completed_at=stamp;
  if(validEmail(emailOf(s))){
    if(!['pending','sending'].includes(String(s.welcome_email_status||'')))patch.welcome_email_status='pending';
    if(!s.welcome_email_requested_at)patch.welcome_email_requested_at=stamp;
  }
  if(!Object.keys(patch).length)return false;
  await ref.update(patch);
  if(!silent&&validEmail(emailOf(s)))notify('Pagamento confirmado. Enviando e-mail de boas-vindas agora...','success');
  return true;
}
window.queuePaidWelcomeEmail=queuePaidWelcome;

async function buildImmediatePayload(id){
  const s=await saleById(id);if(!s)throw Error('Venda não encontrada.');
  const t=await tripForSale(s);
  let subscription=null;
  try{subscription=await window.getTrilheirosWebPushSubscription?.()}catch(_){subscription=null}
  const sale={
    customer_name:s.customer_name||s.responsible_name||'',
    responsible_name:s.responsible_name||s.customer_name||'',
    customer_email:s.customer_email||s.email||'',
    email:s.email||s.customer_email||'',
    participants:Array.isArray(s.participants)?s.participants:[],
    trip_name:s.trip_name||t?.name||'',
    destination:s.destination||t?.destination||'',
    trip_date:s.trip_date||t?.trip_date||'',
    protocol:s.protocol||'',
    sale_total:n(s.sale_total||s.total_amount||s.amount),
    paid_amount:n(s.paid_amount||s.amount_paid||s.received_amount),
    balance_due:Math.max(0,Number.isFinite(Number(s.balance_due))?Number(s.balance_due):n(s.sale_total)-n(s.paid_amount)),
    payment_status:s.payment_status||s.status||'',
    payment_method:s.payment_method||'',
    payment_confirmed:s.payment_confirmed===true,
    sale_status:s.sale_status||''
  };
  return{s,body:{saleId:id,sale,subscription}};
}

async function markImmediateResult(id,data,s){
  const ref=db.collection('sales').doc(id),stamp=firebase.firestore.FieldValue.serverTimestamp(),del=firebase.firestore.FieldValue.delete(),patch={immediate_dispatch_at:stamp};
  if(data?.email?.sent){
    patch.welcome_email_status='sent';patch.welcome_email_sent_at=stamp;patch.welcome_email_to=emailOf(s);patch.welcome_email_version=7;patch.welcome_email_error=del;
    if(data.email.id)patch.welcome_email_resend_id=data.email.id;
  }else if(fullyPaid(s)&&validEmail(emailOf(s))&&data?.email?.skipped!==true){patch.welcome_email_status='pending'}
  if(data?.push?.sent){patch.immediate_push_status='sent';patch.immediate_push_sent_at=stamp}
  else if(data?.push?.expired){patch.immediate_push_status='expired'}
  await ref.set(patch,{merge:true}).catch(()=>{});
}

async function dispatchPaymentImmediate(id,{silent=false,retries=2}={}){
  if(!id)throw Error('Venda não informada.');
  const user=window.firebase?.auth?.().currentUser;if(!user||user.isAnonymous)throw Error('Faça login novamente para concluir o disparo.');
  let lastError=null;
  for(let attempt=0;attempt<=retries;attempt++){
    try{
      const {s,body}=await buildImmediatePayload(id),token=await user.getIdToken(attempt>0),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),14000);
      let response;
      try{response=await fetch(IMMEDIATE_PAYMENT_URL,{method:'POST',cache:'no-store',signal:controller.signal,headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify(body)})}finally{clearTimeout(timer)}
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw Error(data.error||`Falha no disparo imediato (${response.status}).`);
      await markImmediateResult(id,data,s);
      if(!silent){
        if(data?.email?.sent&&data?.push?.sent)notify('✅ Pagamento confirmado: e-mail e notificação enviados agora.','success');
        else if(data?.email?.sent)notify('✅ E-mail de boas-vindas enviado imediatamente.','success');
        else if(data?.push?.sent)notify('✅ Notificação enviada imediatamente.','success');
      }
      return data;
    }catch(e){lastError=e;if(attempt<retries)await new Promise(r=>setTimeout(r,700*(attempt+1)))}
  }
  try{
    const s=await saleById(id);if(s&&fullyPaid(s)&&validEmail(emailOf(s)))await db.collection('sales').doc(id).set({welcome_email_status:'pending',welcome_email_error:String(lastError?.message||'Falha no envio imediato').slice(0,500),immediate_dispatch_failed_at:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});
  }catch(_){ }
  if(!silent)notify(`Pagamento confirmado, mas o disparo imediato falhou: ${lastError?.message||'erro de envio'}. O backup automático continuará tentando.`,'error');
  throw lastError||Error('Falha no disparo imediato.');
}
window.dispatchPaymentImmediate=dispatchPaymentImmediate;
window.sendPaidWelcomeImmediate=dispatchPaymentImmediate;

window.requestWelcomeEmailV37=async function(id){
  try{
    if(!canManageEmail())throw Error('Seu perfil não pode reenviar e-mails de clientes.');
    const s=await saleById(id);if(!s)throw Error('Venda não encontrada.');
    if(!fullyPaid(s))throw Error('O e-mail de boas-vindas só pode ser enviado depois da quitação total.');
    const email=emailOf(s);if(!validEmail(email))throw Error('Esta venda não possui um e-mail válido.');
    if((s.welcome_email_sent_at||s.welcome_email_status==='sent')&&!confirm(`Reenviar o e-mail de boas-vindas para ${email}?`))return;
    const stamp=firebase.firestore.FieldValue.serverTimestamp(),del=firebase.firestore.FieldValue.delete();
    await db.collection('sales').doc(id).update({welcome_email_status:'pending',welcome_email_resend_requested_at:stamp,welcome_email_requested_at:stamp,welcome_email_error:del,welcome_email_sent_at:del,welcome_email_resend_id:del,payment_completed_at:s.payment_completed_at||stamp});
    await dispatchPaymentImmediate(id);
    if(typeof window.renderSalesPageV37==='function')window.renderSalesPageV37();
  }catch(e){if(!String(e?.message||'').includes('disparo imediato'))notify(e.message||'Não foi possível solicitar o e-mail.','error')}
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
      td.innerHTML=`<span class="emailBadge ${esc(st.key)}">📧 ${esc(st.label)}</span>${emailOf(s)?`<small class="emailAddress" title="${esc(emailOf(s))}">${esc(emailOf(s))}</small>`:''}${st.action&&canManageEmail()?`<button class="emailAction" data-email-action="${esc(id)}">${esc(st.action)}</button>`:''}`;
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
    try{await queuePaidWelcome(id,{silent:true});await dispatchPaymentImmediate(id,{silent:true})}catch(e){console.warn('EMAIL_PAYMENT_IMMEDIATE',e)}
  },()=>{});
  setTimeout(()=>{if(!stopped){stopped=true;unsub()}},10*60*1000);
}

/* Pendências: qualquer confirmação dispara notificação; quitação também dispara e-mail no mesmo clique. */
const originalConfirm=window.confirmSyncedPaymentV35;
if(typeof originalConfirm==='function'&&!originalConfirm.__welcomeQueue){
  const wrappedConfirm=async function(tripId,id,saleId,...args){
    const sid=saleId||id,result=await originalConfirm.call(this,tripId,id,saleId,...args);
    try{
      const sale=await saleById(sid);
      if(sale){if(fullyPaid(sale)&&validEmail(emailOf(sale)))await queuePaidWelcome(sid,{silent:true});await dispatchPaymentImmediate(sid)}
    }catch(e){console.warn('PAYMENT_IMMEDIATE_AFTER_CONFIRM',e)}
    return result;
  };
  wrappedConfirm.__welcomeQueue=true;window.confirmSyncedPaymentV35=wrappedConfirm;try{globalThis.confirmSyncedPaymentV35=wrappedConfirm}catch(_){ }
}

const originalPay=window.openPaymentV22;
if(typeof originalPay==='function'&&!originalPay.__emailWatch){const wrapped=function(id,...args){watchPaymentCompletion(id);return originalPay.call(this,id,...args)};wrapped.__emailWatch=true;window.openPaymentV22=wrapped}
const originalRender=window.renderSalesPageV37;
if(typeof originalRender==='function'&&!originalRender.__emailStatus){const wrapped=async function(...args){const out=await originalRender.apply(this,args);await enhanceSalesEmail();return out};wrapped.__emailStatus=true;window.renderSalesPageV37=wrapped;window.renderSalesPageV21=wrapped;try{renderSalesPageV21=wrapped}catch(_){ }}
setTimeout(enhanceSalesEmail,450);
})();
