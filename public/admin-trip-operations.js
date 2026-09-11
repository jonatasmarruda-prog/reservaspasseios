/* Trilheiros Gestão — embarque, checklist automático e resultado final */
(function(){
'use strict';

const CHECKLIST=[
  ['transport','Transporte confirmado'],['guide','Guia/condutor confirmado'],['insurance','Seguro/lista enviada'],
  ['food','Alimentação confirmada'],['lodging','Hospedagem confirmada'],['equipment','Equipamentos separados'],
  ['participant_list','Lista de participantes revisada'],['whatsapp','Grupo/avisos enviados'],['payments','Pagamentos conferidos']
];
const TZ='America/Cuiaba';
let renderTimer=0;

const q=(s,r=document)=>r.querySelector(s);
const qa=(s,r=document)=>[...r.querySelectorAll(s)];
const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v||0));
const localToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
function dayDiff(v){
  const s=String(v||'').slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return 999;
  const target=new Date(`${s}T12:00:00-04:00`),today=new Date(`${localToday()}T12:00:00-04:00`);
  return Math.round((target-today)/86400000);
}
function canManage(){return ['owner','admin'].includes(typeof state!=='undefined'?(state.role||''):'')}
function tripById(id){return (typeof state!=='undefined'?(state.trips||[]):[]).find(t=>t.id===id)}
function selectedTrip(){
  if(typeof state==='undefined')return null;
  const id=state.dayTrip||q('#dayTripSelect')?.value||'';
  return tripById(id)||null;
}
function missingChecklist(t){const c=t?.checklist||{};return CHECKLIST.filter(([k])=>!c[k])}
function schedule(){clearTimeout(renderTimer);renderTimer=setTimeout(()=>{injectStyle();patchNavigation();patchDayMode()},60)}

function injectStyle(){
  if(q('#tripOperationsStyle'))return;
  const s=document.createElement('style');s.id='tripOperationsStyle';s.textContent=`
  .tripOpsSummary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:0 0 16px}
  .tripOpsCard{border:1px solid #dce8e3;border-radius:18px;background:#fff;padding:15px;box-shadow:0 8px 24px rgba(7,50,38,.05)}
  .tripOpsCard .opsEyebrow{display:block;font-size:10px;font-weight:900;letter-spacing:.05em;color:#60766d}.tripOpsCard h3{margin:5px 0 5px;color:#073226;font-size:18px}.tripOpsCard p{margin:0;color:#687b73;font-size:12px;line-height:1.45}
  .tripOpsCard strong.opsValue{display:block;font-size:25px;color:#073226;margin:8px 0 4px}.tripOpsStatus{display:inline-flex;margin-top:10px;padding:5px 8px;border-radius:999px;font-size:10px;font-weight:900;background:#edf5f1;color:#315f4e}.tripOpsStatus.warn{background:#fff3d4;color:#80600f}.tripOpsStatus.ok{background:#e6f6ed;color:#156845}.tripOpsStatus.closed{background:#073226;color:#fff}
  .tripOpsActions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.tripOpsActions button{border:0;border-radius:10px;padding:9px 11px;font-weight:850;cursor:pointer;background:#0b5e45;color:#fff}.tripOpsActions button.secondary{background:#eef5f2;color:#184a39}.tripOpsActions button.gold{background:#d8ad42;color:#17372d}
  .tripOpsFinalGrid{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:9px}.tripOpsFinalGrid div{padding:8px 9px;border-radius:10px;background:#f5f8f6}.tripOpsFinalGrid span{display:block;font-size:9px;font-weight:800;color:#6b7c75}.tripOpsFinalGrid b{display:block;margin-top:3px;color:#073226;font-size:13px}
  .checkListV7:before{content:'⚠️ Checklist automático liberado 3 dias antes da viagem. Os itens pendentes também aparecem na Central de Pendências.';display:block;margin-bottom:10px;padding:10px 11px;border-radius:11px;background:#fff7df;color:#6d591c;font-size:11px;line-height:1.4}
  @media(max-width:900px){.tripOpsSummary{grid-template-columns:1fr}.tripOpsFinalGrid{grid-template-columns:1fr 1fr}}
  `;document.head.appendChild(s);
}

function patchNavigation(){
  if(typeof state==='undefined')return;
  const day=q('[data-tab="day"]');if(day)day.innerHTML='✅ Embarque / Check-in';
  if(state.tab==='day'&&q('#pageTitle'))q('#pageTitle').textContent='Embarque / Check-in';
}

function focusSelector(sel){const el=q(sel);if(el){el.scrollIntoView({behavior:'smooth',block:'center'});el.animate?.([{boxShadow:'0 0 0 0 rgba(216,173,66,.7)'},{boxShadow:'0 0 0 8px rgba(216,173,66,0)'}],{duration:900})}}
window.focusTripCheckin=()=>focusSelector('.dayPeople');
window.focusTripChecklist=()=>focusSelector('.checkListV7');

function patchDayMode(){
  if(typeof state==='undefined'||state.tab!=='day')return;
  const content=q('#content'),t=selectedTrip();if(!content||!t)return;
  const panel=q('.dayPeople')?.closest('.panel');
  if(panel){const eyebrow=q('.panelHead .eyebrow',panel),h=q('.panelHead h2',panel),p=q('.panelHead p',panel);if(eyebrow)eyebrow.textContent='EMBARQUE / CHECK-IN';if(h)h.textContent='Check-in do passeio';if(p)p.textContent='Marque cada participante conforme embarcar. A lista permanece vinculada ao passeio e sincroniza com a nuvem.'}
  const checklist=q('.checkListV7')?.closest('.panel');if(checklist){const eyebrow=q('.panelHead .eyebrow',checklist),h=q('.panelHead h2',checklist);if(eyebrow)eyebrow.textContent='⚠️ CHECKLIST AUTOMÁTICO';if(h)h.textContent='Preparação antes da viagem'}

  const people=qa('.dayPerson'),present=qa('.dayPerson.present').length,total=people.length,missing=missingChecklist(t),d=dayDiff(t.trip_date),closure=t.financial_closure||{};
  let readiness='EM PREPARAÇÃO',readinessClass='';
  if(t.financial_locked){readiness='FINALIZADO';readinessClass='closed'}
  else if(d<0){readiness='AGUARDA FECHAMENTO';readinessClass='warn'}
  else if(d<=3&&missing.length){readiness=`${missing.length} PENDÊNCIA(S)`;readinessClass='warn'}
  else if(d<=3){readiness='PRONTO PARA VIAJAR';readinessClass='ok'}
  const when=d===0?'HOJE':d===1?'AMANHÃ':d>1&&d<999?`FALTAM ${d} DIAS`:d<0?`PASSOU HÁ ${Math.abs(d)} DIA(S)`:'DATA A CONFIRMAR';

  let summary=q('#tripOpsSummary',content);if(!summary){summary=document.createElement('section');summary.id='tripOpsSummary';summary.className='tripOpsSummary';const grid=q('.dayGrid',content);grid?content.insertBefore(summary,grid):content.prepend(summary)}
  summary.innerHTML=`
    <article class="tripOpsCard"><span class="opsEyebrow">✅ EMBARQUE / CHECK-IN</span><h3>${present}/${total} embarcados</h3><p>Controle presencial do grupo no momento da saída.</p><strong class="opsValue">${total?Math.round(present/total*100):0}%</strong><span class="tripOpsStatus ${present===total&&total?'ok':''}">${present===total&&total?'CHECK-IN COMPLETO':'CHECK-IN EM ANDAMENTO'}</span><div class="tripOpsActions"><button type="button" onclick="focusTripCheckin()">Abrir lista de embarque</button></div></article>
    <article class="tripOpsCard"><span class="opsEyebrow">⚠️ CHECKLIST PRÉ-VIAGEM</span><h3>${when}</h3><p>${d>=0&&d<=3?'Checklist automático ativo. Confira os itens antes da saída.':'O sistema acompanha a data do passeio e destaca pendências automaticamente.'}</p><strong class="opsValue">${CHECKLIST.length-missing.length}/${CHECKLIST.length}</strong><span class="tripOpsStatus ${missing.length&&d<=3?'warn':!missing.length?'ok':''}">${readiness}</span><div class="tripOpsActions"><button type="button" class="secondary" onclick="focusTripChecklist()">Ver checklist</button></div></article>
    <article class="tripOpsCard"><span class="opsEyebrow">💰 RESULTADO FINAL</span><h3>${t.financial_locked?'Passeio fechado':'Fechamento automático'}</h3><p>${t.financial_locked?'Resultado financeiro preservado e relatório enviado/colocado na fila de e-mail.':'Ao finalizar, o sistema calcula receitas, despesas, lucro e margem usando os dados já lançados.'}</p>${t.financial_locked?`<div class="tripOpsFinalGrid"><div><span>RECEBIDO</span><b>${money(closure.received)}</b></div><div><span>DESPESAS</span><b>${money(closure.cost_actual)}</b></div><div><span>LUCRO</span><b>${money(closure.profit_actual)}</b></div><div><span>MARGEM</span><b>${Number(closure.margin_percent||0).toFixed(1)}%</b></div></div><span class="tripOpsStatus closed">RESULTADO FINAL SALVO</span>`:`<strong class="opsValue">${d<=0?'Pronto':'Após a viagem'}</strong><span class="tripOpsStatus ${d<0?'warn':''}">${d<=0?'PODE FINALIZAR':'AGUARDANDO A DATA'}</span>${canManage()?`<div class="tripOpsActions"><button type="button" class="gold" ${d>0?'disabled style="opacity:.55;cursor:not-allowed"':''} onclick="finalizeTripOperations('${String(t.id).replace(/'/g,'')}')">Finalizar passeio e calcular</button></div>`:''}`}</article>`;
}

async function requestClosureEmail(tripId){
  if(typeof db==='undefined')return;
  try{
    const ref=db.collection('trips').doc(tripId),snap=await ref.get();if(!snap.exists)return;
    const data=snap.data()||{};if(!data.financial_locked||!data.financial_closure)return;
    await ref.update({financial_closure_email_status:'pending',financial_closure_email_requested_at:firebase.firestore.FieldValue.serverTimestamp(),financial_closure_email_requested_by:auth?.currentUser?.email||'',updated_at:firebase.firestore.FieldValue.serverTimestamp()});
    const t=tripById(tripId);if(t)t.financial_closure_email_status='pending';
    if(typeof toast==='function')toast('Resultado final salvo. Relatório financeiro colocado na fila de e-mail.','success');
  }catch(e){console.warn('TRIP_CLOSURE_EMAIL_QUEUE',e);if(typeof toast==='function')toast('Resultado salvo, mas não foi possível marcar o e-mail agora.','error')}
}

function wrapFinancialClose(){
  const old=window.toggleCloseTrip;if(typeof old!=='function'||old.__tripOpsEmail)return false;
  const wrapped=async function(tripId,...rest){const before=!!tripById(tripId)?.financial_locked;const out=await old.call(this,tripId,...rest);const after=!!tripById(tripId)?.financial_locked;if(!before&&after)await requestClosureEmail(tripId);schedule();return out};
  wrapped.__tripOpsEmail=true;window.toggleCloseTrip=wrapped;try{globalThis.toggleCloseTrip=wrapped}catch(_){ }return true;
}

window.finalizeTripOperations=async function(tripId){
  const t=tripById(tripId);if(!t)return;
  if(!canManage()){if(typeof toast==='function')toast('Somente proprietário ou administrador pode finalizar o passeio.','error');return}
  const d=dayDiff(t.trip_date);if(d>0){if(typeof toast==='function')toast('O resultado final só pode ser fechado no dia do passeio ou depois.','error');return}
  const missing=missingChecklist(t);if(missing.length&&!confirm(`Ainda existem ${missing.length} item(ns) do checklist pendente(s). Deseja continuar para o fechamento financeiro?`))return;
  if(typeof window.toggleCloseTrip!=='function'){if(typeof toast==='function')toast('Fechamento financeiro indisponível. Abra a aba Financeiro e tente novamente.','error');return}
  await window.toggleCloseTrip(tripId);
};

function wrapRender(){
  const old=window.renderAdmin;if(typeof old!=='function'||old.__tripOps)return false;
  const wrapped=function(...args){const out=old.apply(this,args);schedule();return out};wrapped.__tripOps=true;window.renderAdmin=wrapped;try{globalThis.renderAdmin=wrapped}catch(_){ }return true;
}

function boot(){
  injectStyle();wrapRender();wrapFinancialClose();schedule();
  const timer=setInterval(()=>{wrapRender();wrapFinancialClose();schedule();if(typeof state!=='undefined'&&typeof window.renderAdmin==='function'&&typeof window.toggleCloseTrip==='function')clearInterval(timer)},350);
  const mo=new MutationObserver(()=>schedule());mo.observe(document.documentElement,{subtree:true,childList:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
