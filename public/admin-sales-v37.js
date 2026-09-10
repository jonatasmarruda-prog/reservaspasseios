/* Trilheiros Gestão V37 — vendas estáveis: ações Link/Abrir + financeiro completo */
(function(){
'use strict';
if(typeof state==='undefined') return;
const q=(s,r=document)=>r.querySelector(s),qa=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v||0));
const dateBR=v=>{const s=String(v||'').slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return s||'—';const[y,m,d]=s.split('-');return`${d}/${m}/${y}`};
const saleUrl=id=>`${location.origin}/cadastro-venda/${encodeURIComponent(id)}`;
const payLabels={pix:'PIX',card:'Cartão',pix_installment:'PIX parcelado',cash:'Dinheiro',transfer:'Transferência',other:'Outro'};
const statusLabels={paid:'Pago',partial:'Parcial',pending:'Pendente',refunded:'Reembolsado',cancelled:'Cancelada'};
const n=v=>Math.max(0,Number(v||0)||0);
function notify(msg,type=''){try{return typeof toast==='function'?toast(msg,type):alert(msg)}catch(_){alert(msg)}}
function active(s){return s?.sale_status!=='cancelled'}
function total(s){return n(s?.sale_total)>0?n(s.sale_total):n(s?.paid_amount)}
function paid(s){return Math.max(0,n(s?.paid_amount)-n(s?.refunded_amount))}
function balance(s){return s?.sale_status==='cancelled'?0:Math.max(0,Number.isFinite(Number(s?.balance_due))?Number(s.balance_due):total(s)-n(s?.paid_amount))}
function pstatus(s){if(s?.sale_status==='cancelled')return n(s?.refunded_amount)>0?'refunded':'cancelled';return s?.payment_status||(paid(s)<=0?'pending':balance(s)<=0.009?'paid':'partial')}
function pkg(s){return [s?.accommodation,s?.category].filter(Boolean).join(' • ')||'—'}
function isCanva(s){return String(s?.source||'').includes('public_portal')||s?.channel==='canva_reserva_passeios'}
async function copyText(text){
  try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);notify('Link copiado.','success');return true}}catch(_){ }
  try{const ta=document.createElement('textarea');ta.value=text;ta.setAttribute('readonly','');ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();const ok=document.execCommand('copy');ta.remove();if(ok){notify('Link copiado.','success');return true}}catch(_){ }
  window.prompt('Copie o link abaixo:',text);return false;
}
async function getSale(id){const s=await db.collection('sales').doc(id).get();if(!s.exists)throw Error('Venda não encontrada.');return{id:s.id,...s.data()}}
async function getReservation(s){
  try{const r=await db.collection('trips').doc(s.trip_id).collection('reservations').doc(s.id).get();return r.exists?{id:r.id,...r.data()}:null}catch(_){return null}
}
function closeDetails(){q('#v37SaleDetails')?.remove()}
window.openSaleDetailsV37=async function(id){
  try{
    const s=await getSale(id),r=await getReservation(s),names=(r?.participants?.length?r.participants:s.participants||[]).map(x=>x?.full_name).filter(Boolean),email=r?.email||s.customer_email||'',method=payLabels[s.payment_method]||s.payment_method||'—',st=pstatus(s),t=total(s),p=paid(s),b=balance(s),canCustomerLink=!isCanva(s)&&s.registration_status!=='completed'&&s.sale_status!=='cancelled';
    closeDetails();const back=document.createElement('div');back.id='v37SaleDetails';back.className='modalBack';
    back.innerHTML=`<div class="modal" style="max-width:820px"><div class="modalHead"><div><span class="eyebrow">DETALHES DA VENDA</span><h2>${esc(s.customer_name||r?.responsible_name||'Cliente')}</h2><p>${esc(s.trip_name||'Passeio')} • ${n(s.seats)} vaga(s)</p></div><button class="iconClose" id="v37SaleClose">✕</button></div><div class="modalBody"><div class="v35Grid"><div class="v35Fact"><span>FORMA DE PAGAMENTO</span><strong>${esc(method)}</strong></div><div class="v35Fact"><span>STATUS</span><strong>${esc(statusLabels[st]||st)}</strong></div><div class="v35Fact"><span>VALOR DA RESERVA</span><strong>${money(t)}</strong></div><div class="v35Fact"><span>RECEBIDO CONFIRMADO</span><strong>${money(p)}</strong></div><div class="v35Fact"><span>SALDO</span><strong>${money(b)}</strong></div><div class="v35Fact"><span>TIPO / OPÇÃO</span><strong>${esc(pkg(s))}</strong></div><div class="v35Fact wide"><span>PARTICIPANTES</span><strong>${esc(names.join(' • ')||s.customer_name||'—')}</strong></div><div class="v35Fact wide"><span>E-MAIL</span><strong>${esc(email||'—')}</strong></div></div>${isCanva(s)?'<div class="v35Info">Reserva recebida pelo site do Canva. O cadastro dos participantes já foi feito no fluxo de reserva; não é necessário enviar link de cadastro ao cliente.</div>':''}</div><div class="modalFoot"><button class="btn ghost" id="v37SaleClose2">Fechar</button><button class="btn ghost" id="v37Copy">Copiar link</button>${canCustomerLink?'<button class="btn primary" id="v37OpenCustomer">Abrir cadastro do cliente</button>':''}</div></div>`;
    document.body.appendChild(back);q('#v37SaleClose',back).onclick=q('#v37SaleClose2',back).onclick=closeDetails;back.onclick=e=>{if(e.target===back)closeDetails()};q('#v37Copy',back).onclick=()=>copyText(saleUrl(s.id));if(q('#v37OpenCustomer',back))q('#v37OpenCustomer',back).onclick=()=>window.open(saleUrl(s.id),'_blank','noopener');
  }catch(e){notify(e.message||'Não foi possível abrir a venda.','error')}
};

window.renderSalesPageV37=async function(){
  if(!location.pathname.startsWith('/admin'))return;
  const content=q('#content'),title=q('#pageTitle');if(!content)return;if(title)title.textContent='Vendas e recebimentos';qa('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab==='salesV21'));content.innerHTML='<div class="saleLoadingV21">Carregando vendas...</div>';
  try{
    const ss=await db.collection('sales').orderBy('created_at','desc').limit(500).get(),sales=ss.docs.map(d=>({id:d.id,...d.data()})),act=sales.filter(active),contracted=act.reduce((s,x)=>s+total(x),0),received=act.reduce((s,x)=>s+paid(x),0),receivable=act.reduce((s,x)=>s+balance(x),0),seats=act.reduce((s,x)=>s+n(x.seats),0),pendingReg=act.filter(x=>x.registration_status!=='completed').length;
    content.innerHTML=`<div class="saleAdminTopV21"><div><span>CONTROLE DE VENDAS</span><h2>Vendas, recebimentos e reservas.</h2><p>Valores contratados, recebimentos confirmados, parcelas e participantes no mesmo controle.</p></div><div class="v22TopActions"><button id="accInventoryV37" class="v22Secondary">Hospedagem / limites</button><button id="salesNewV37">+ Nova venda</button></div></div><div class="saleMetricsV21 v22Metrics"><div><small>VENDIDO</small><strong>${money(contracted)}</strong></div><div><small>RECEBIDO CONFIRMADO</small><strong>${money(received)}</strong></div><div><small>A RECEBER</small><strong>${money(receivable)}</strong></div><div><small>VAGAS ATIVAS</small><strong>${seats}</strong></div><div><small>CADASTROS PENDENTES</small><strong>${pendingReg}</strong></div></div><section class="salePanelV21"><div class="salePanelHeadV21"><div><b>Vendas registradas</b><span>${sales.length} registro${sales.length===1?'':'s'}</span></div></div>${sales.length?`<div class="saleTableWrapV21"><table class="saleTableV21 v22SaleTable"><thead><tr><th>Cliente</th><th>Passeio</th><th>Vagas</th><th>Financeiro</th><th>Tipo / opção</th><th>Cadastro</th><th>Ações</th></tr></thead><tbody>${sales.map(s=>{const st=pstatus(s),bal=balance(s),cancel=s.sale_status==='cancelled',canLink=!isCanva(s)&&s.registration_status!=='completed'&&!cancel;return`<tr class="${cancel?'v22CancelledRow':''}"><td><b>${esc(s.customer_name||'—')}</b><small>${esc(payLabels[s.payment_method]||s.payment_method||'')}</small></td><td><b>${esc(s.trip_name||'—')}</b><small>${dateBR(s.trip_date)}</small></td><td>${n(s.seats)}</td><td><b>${money(total(s))}</b><small>Recebido ${money(paid(s))}${bal>0&&!cancel?` • falta ${money(bal)}`:''}</small><span class="v22PayStatus ${esc(st)}">${esc(statusLabels[st]||st)}</span></td><td><small>${esc(pkg(s))}</small></td><td><span class="saleStatusV21 ${s.registration_status==='completed'?'done':'pending'}">${s.registration_status==='completed'?'Concluído':'Pendente'}</span></td><td><div class="saleRowActionsV21 v22RowActions">${!cancel&&bal>0?`<button data-v37-pay="${esc(s.id)}">+ Pagamento</button>`:''}${!cancel?`<button data-v37-edit="${esc(s.id)}">Editar</button>`:''}${canLink?`<button data-v37-link="${esc(s.id)}">Link</button>`:''}<button data-v37-open="${esc(s.id)}">Abrir</button>${!cancel?`<button class="danger" data-v37-cancel="${esc(s.id)}">Cancelar</button>`:''}</div></td></tr>`}).join('')}</tbody></table></div>`:'<div class="saleEmptyV21">Nenhuma venda registrada.</div>'}</section>`;
    q('#salesNewV37')?.addEventListener('click',()=>window.openSaleModalV21?.());q('#accInventoryV37')?.addEventListener('click',()=>window.openAccommodationInventoryV22?.());qa('[data-v37-pay]',content).forEach(b=>b.onclick=()=>window.openPaymentV22?.(b.dataset.v37Pay));qa('[data-v37-edit]',content).forEach(b=>b.onclick=()=>window.openEditSaleV22?.(b.dataset.v37Edit));qa('[data-v37-cancel]',content).forEach(b=>b.onclick=()=>window.cancelSaleV22?.(b.dataset.v37Cancel));qa('[data-v37-link]',content).forEach(b=>b.onclick=()=>copyText(saleUrl(b.dataset.v37Link)));qa('[data-v37-open]',content).forEach(b=>b.onclick=()=>window.openSaleDetailsV37(b.dataset.v37Open));
  }catch(e){content.innerHTML=`<div class="saleErrorV21">${esc(e.message||'Não foi possível carregar as vendas.')}</div>`}
};

window.renderSalesPageV21=window.renderSalesPageV37;try{renderSalesPageV21=window.renderSalesPageV37}catch(_){ }
function patch(){if(!location.pathname.startsWith('/admin'))return;const nav=q('[data-tab="salesV21"]');if(nav)nav.onclick=()=>{state.tab='salesV21';window.renderSalesPageV37()};if(state.tab==='salesV21'&&!q('.v22SaleTable')&&!q('.saleLoadingV21'))window.renderSalesPageV37()}
const oldRender=window.renderAdmin;if(typeof oldRender==='function'){window.renderAdmin=function(...args){const out=oldRender.apply(this,args);setTimeout(()=>{patch();if(state.tab==='salesV21')window.renderSalesPageV37()},0);return out};try{renderAdmin=window.renderAdmin}catch(_){ }}
const mo=new MutationObserver(()=>patch());mo.observe(document.body,{subtree:true,childList:true});window.addEventListener('load',patch);setTimeout(patch,300);
})();
