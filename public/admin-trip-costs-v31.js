/* Trilheiros Gestão V31 — despesas do passeio: valor total ou por pessoa */
(function(){
  'use strict';
  if(typeof state==='undefined') return;

  const q=(s,r=document)=>r.querySelector(s);
  const qa=(s,r=document)=>[...r.querySelectorAll(s)];
  const n=v=>Math.max(0,Number(v||0)||0);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v||0));
  const GUIDE_NAME='Jonatas Marques de Arruda';
  const GUIDE_ROLE='GUIA DE TURISMO';

  const PRESETS=[
    {category:'Ônibus / Transporte',mode:'fixed'},
    {category:'Hospedagem',mode:'per_person'},
    {category:'Alimentação',mode:'per_person'},
    {category:'Camping',mode:'per_person'},
    {category:'Custo do passeio / Entrada / Day Use',mode:'per_person'},
    {category:'Seguro',mode:'per_person'},
    {category:'Guia / Condutor local',mode:'fixed'},
    {category:'Pedágio / Taxas',mode:'fixed'},
    {category:'Outros',mode:'fixed'}
  ];

  function notify(msg,type=''){
    try{return typeof toast==='function'?toast(msg,type):alert(msg)}catch(_){alert(msg)}
  }
  function closeModal(){q('#modal')?.remove()}
  function openModal(html){
    closeModal();
    if(typeof modal==='function'){modal(html);return q('#modal')}
    const back=document.createElement('div');back.id='modal';back.className='modalBack';back.innerHTML=`<div class="modal">${html}</div>`;document.body.appendChild(back);return back;
  }
  function norm(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()}
  function reservedSeats(id){return (state.reservations||[]).filter(r=>r.trip_id===id&&r.status!=='cancelled').reduce((s,r)=>s+n(r.seats),0)}

  function legacyItems(t){
    const out=[];
    const add=(category,mode,amount)=>{if(n(amount)>0)out.push({category,mode,amount:n(amount)})};
    add('Ônibus / Transporte','fixed',t?.cost_bus_fixed);
    add('Hospedagem','per_person',t?.cost_lodging_per_person);
    add('Custo do passeio / Entrada / Day Use','per_person',t?.cost_activity_per_person);
    add('Alimentação','per_person',t?.cost_food_per_person);
    add('Seguro','per_person',t?.cost_insurance_per_person);
    add('Guia / Condutor local','fixed',t?.cost_guide_fixed);
    add('Outros','fixed',t?.cost_other_fixed);
    add('Outros','per_person',t?.cost_other_per_person);
    return out;
  }

  function initialItems(t){
    const saved=Array.isArray(t?.cost_items)&&t.cost_items.length?t.cost_items.map(x=>({category:String(x.category||'Outros'),mode:x.mode==='per_person'?'per_person':'fixed',amount:n(x.amount)})):legacyItems(t);
    const used=new Set(saved.map(x=>norm(x.category)));
    const rows=[...saved];
    PRESETS.forEach(p=>{if(!used.has(norm(p.category)))rows.push({...p,amount:0})});
    return rows;
  }

  function costRow(item={category:'Outros',mode:'fixed',amount:0}){
    return `<div class="v31CostRow">
      <label class="v31Category"><span>Despesa</span><input class="v31CostCategory" value="${esc(item.category||'Outros')}" placeholder="Ex.: Hospedagem"></label>
      <label class="v31Mode"><span>Como esse custo é cobrado?</span><select class="v31CostMode">
        <option value="fixed" ${item.mode!=='per_person'?'selected':''}>VALOR TOTAL DO PASSEIO</option>
        <option value="per_person" ${item.mode==='per_person'?'selected':''}>POR PESSOA</option>
      </select></label>
      <label class="v31Amount"><span>Valor</span><input class="v31CostAmount" type="number" min="0" step="0.01" value="${n(item.amount)||''}" placeholder="0,00"></label>
      <button type="button" class="v31Remove" title="Remover despesa">×</button>
    </div>`;
  }

  function readCosts(){
    return qa('.v31CostRow').map(row=>({
      category:q('.v31CostCategory',row)?.value.trim()||'Outros',
      mode:q('.v31CostMode',row)?.value==='per_person'?'per_person':'fixed',
      amount:n(q('.v31CostAmount',row)?.value)
    })).filter(x=>x.category||x.amount>0);
  }

  function totals(items,seats,capacityClients){
    const fixed=items.filter(x=>x.mode==='fixed').reduce((s,x)=>s+n(x.amount),0);
    const pp=items.filter(x=>x.mode==='per_person').reduce((s,x)=>s+n(x.amount),0);
    return {fixed,pp,current:fixed+pp*Math.max(0,seats),full:fixed+pp*Math.max(0,capacityClients)};
  }

  function legacyCompatibility(items){
    const sum=(test,mode)=>items.filter(x=>x.mode===mode&&test(norm(x.category))).reduce((s,x)=>s+n(x.amount),0);
    const isBus=s=>/onibus|transporte/.test(s);
    const isLodging=s=>/hospedagem/.test(s);
    const isActivity=s=>/passeio|entrada|day use|dayuse/.test(s);
    const isFood=s=>/aliment/.test(s);
    const isInsurance=s=>/seguro/.test(s);
    const isGuide=s=>/guia|condutor/.test(s);
    const known=s=>isBus(s)||isLodging(s)||isActivity(s)||isFood(s)||isInsurance(s)||isGuide(s);
    return {
      cost_bus_fixed:sum(isBus,'fixed'),
      cost_lodging_per_person:sum(isLodging,'per_person'),
      cost_activity_per_person:sum(isActivity,'per_person'),
      cost_food_per_person:sum(isFood,'per_person'),
      cost_insurance_per_person:sum(isInsurance,'per_person'),
      cost_guide_fixed:sum(isGuide,'fixed'),
      cost_other_fixed:sum(s=>!known(s),'fixed'),
      cost_other_per_person:sum(s=>!known(s),'per_person')
    };
  }

  function bindCostRows(form,t){
    const container=q('#v31Costs');
    const refresh=()=>{
      const items=readCosts();
      const totalSpots=n(form.totalSpots?.value);
      const clientCapacity=Math.max(0,totalSpots-1);
      const reserved=t?.id?reservedSeats(t.id):0;
      const c=totals(items,reserved,clientCapacity);
      const preview=q('#v31CostPreview');
      if(preview)preview.innerHTML=`
        <div><span>CUSTOS DE VALOR TOTAL</span><strong>${money(c.fixed)}</strong><small>entram uma única vez no passeio</small></div>
        <div><span>CUSTO POR PESSOA</span><strong>${money(c.pp)}</strong><small>multiplica pela quantidade de clientes</small></div>
        <div><span>CUSTO COM RESERVAS ATUAIS</span><strong>${money(c.current)}</strong><small>${reserved} cliente(s) reservado(s)</small></div>
        <div><span>CUSTO COM LOTAÇÃO</span><strong>${money(c.full)}</strong><small>${clientCapacity} cliente(s) + guia</small></div>`;
      qa('.v31CostMode').forEach(sel=>{const row=sel.closest('.v31CostRow');row?.classList.toggle('perPerson',sel.value==='per_person')});
    };
    const bind=()=>{
      qa('.v31Remove').forEach(b=>b.onclick=()=>{b.closest('.v31CostRow')?.remove();refresh()});
      qa('.v31CostRow input,.v31CostRow select').forEach(el=>{el.oninput=refresh;el.onchange=refresh});
    };
    q('#v31AddCost')?.addEventListener('click',()=>{container.insertAdjacentHTML('beforeend',costRow({category:'Outros',mode:'fixed',amount:0}));bind();refresh()});
    form.totalSpots?.addEventListener('input',refresh);
    bind();refresh();
  }

  window.tripModal=function(id=''){
    const t=id?(state.trips||[]).find(x=>x.id===id):null;
    const multi=!!(t?.trip_end_date&&String(t.trip_end_date).slice(0,10)!==String(t.trip_date||'').slice(0,10));
    const items=initialItems(t);
    const oldReturn=String(t?.return_time||t?.return_info||'');
    const returnTime=/^\d{2}:\d{2}$/.test(oldReturn)?oldReturn:'';

    openModal(`<form id="tripFormV31">
      <div class="modalHead"><div><span class="eyebrow">${t?'EDITAR':'NOVO'} PASSEIO</span><h2>${t?'Atualizar passeio':'Cadastrar passeio'}</h2><p>Cadastre os dados do passeio e classifique cada despesa como valor total ou custo por pessoa.</p></div><button type="button" class="iconClose" id="v31Close">✕</button></div>
      <div class="modalBody">
        <div class="grid two">
          <label><span>Nome do passeio</span><input name="name" required value="${esc(t?.name||'')}"></label>
          <label><span>Destino</span><input name="destination" value="${esc(t?.destination||'')}"></label>
          <label><span>Status</span><select name="status">${['draft','open','closed','completed','cancelled'].map(s=>`<option value="${s}" ${t?.status===s?'selected':''}>${({draft:'Rascunho',open:'Aberto',closed:'Fechado',completed:'Concluído',cancelled:'Cancelado'})[s]}</option>`).join('')}</select></label>
          <label><span>Total de vagas (inclui o guia)</span><input name="totalSpots" type="number" min="1" required value="${n(t?.total_spots)||45}"></label>
          <label><span>Data do passeio</span><input name="tripDate" type="date" required value="${String(t?.trip_date||'').slice(0,10)}"></label>
          <label class="v31Multi"><span>Período</span><label class="v31Toggle"><input id="v31MultiDay" type="checkbox" ${multi?'checked':''}><b>Passeio com mais de 1 dia</b></label></label>
          <label id="v31EndWrap" ${multi?'':'hidden'}><span>Último dia</span><input name="tripEndDate" type="date" value="${String(t?.trip_end_date||'').slice(0,10)}"></label>
          <label><span>Saída</span><input name="departureTime" type="time" value="${esc(t?.departure_time||'')}"></label>
          <label><span>Retorno</span><input name="returnTime" type="time" value="${esc(returnTime)}"></label>
          <label><span>Ponto de saída</span><input name="departurePoint" value="${esc(t?.departure_point||'')}"></label>
          <label><span>Valor cobrado por pessoa</span><input name="defaultPrice" type="number" min="0" step="0.01" value="${n(t?.default_price)||''}"></label>
          <label><span>Link do grupo WhatsApp</span><input name="whatsapp" value="${esc(t?.whatsapp_group_url||'')}"></label>
        </div>

        <section class="v31CostsBox">
          <div class="v31CostsHead"><div><span class="eyebrow">DESPESAS DO PASSEIO</span><h3>Custos previstos</h3><p>Escolha em cada linha se o valor é <b>total do passeio</b> ou <b>por pessoa</b>. O financeiro fará o cálculo automaticamente conforme entrarem reservas.</p></div><button type="button" class="btn ghost" id="v31AddCost">+ Adicionar despesa</button></div>
          <div class="v31Examples"><span><b>VALOR TOTAL:</b> ônibus, van, guia, pedágio</span><span><b>POR PESSOA:</b> alimentação, camping, hospedagem, ingresso, seguro</span></div>
          <div id="v31Costs">${items.map(costRow).join('')}</div>
          <div id="v31CostPreview" class="v31CostPreview"></div>
        </section>

        <label style="display:block;margin-top:16px"><span>O que levar / orientação</span><textarea name="bring" rows="3">${esc(t?.what_to_bring||'')}</textarea></label>
        <label style="display:block;margin-top:14px"><span>Política de cancelamento</span><textarea name="policy" rows="5">${esc(t?.cancellation_policy||'')}</textarea></label>
        <div id="v31Msg"></div>
      </div>
      <div class="modalFoot"><button type="button" class="btn ghost" id="v31Cancel">Cancelar</button><button class="btn primary">Salvar passeio</button></div>
    </form>`);

    const form=q('#tripFormV31');
    if(!form)return;
    q('#v31Close').onclick=q('#v31Cancel').onclick=closeModal;
    q('#v31MultiDay').onchange=e=>{const wrap=q('#v31EndWrap');if(wrap)wrap.hidden=!e.target.checked;if(!e.target.checked)form.tripEndDate.value=''};
    bindCostRows(form,t);

    form.onsubmit=async e=>{
      e.preventDefault();
      const msg=q('#v31Msg');
      try{
        const start=form.tripDate.value;
        const end=q('#v31MultiDay')?.checked?form.tripEndDate.value:'';
        if(q('#v31MultiDay')?.checked&&!end)throw Error('Informe o último dia do passeio.');
        if(end&&end<start)throw Error('A data final não pode ser anterior à data inicial.');
        const totalSpots=n(form.totalSpots.value);
        if(totalSpots<1)throw Error('Informe o total de vagas.');
        const items=readCosts();
        const clientCapacity=Math.max(0,totalSpots-1);
        const c=totals(items,t?.id?reservedSeats(t.id):0,clientCapacity);
        const compatibility=legacyCompatibility(items);
        const data={
          name:form.name.value.trim(),destination:form.destination.value.trim(),status:form.status.value,total_spots:totalSpots,
          trip_date:start,trip_end_date:end&&end!==start?end:'',departure_time:form.departureTime.value,return_time:form.returnTime.value,
          return_info:form.returnTime.value,departure_point:form.departurePoint.value.trim(),default_price:n(form.defaultPrice.value),
          whatsapp_group_url:form.whatsapp.value.trim(),what_to_bring:form.bring.value.trim(),cancellation_policy:form.policy.value.trim(),
          cost_items:items,cost_fixed_total:c.fixed,cost_per_person_total:c.pp,estimated_cost:c.full,...compatibility,
          email_reminder_enabled:t?.email_reminder_enabled===false?false:true,updated_at:firebase.firestore.FieldValue.serverTimestamp()
        };
        if(t){
          const used=n(t.used_spots);
          if(totalSpots<used)throw Error('O total de vagas não pode ser menor que as vagas já ocupadas.');
          data.used_spots=used;data.remaining_spots=Math.max(0,totalSpots-used);
          await db.collection('trips').doc(t.id).update(data);
        }else{
          Object.assign(data,{used_spots:1,remaining_spots:Math.max(0,totalSpots-1),special_seat_reserved:true,special_seat_counted:true,special_seat_count:1,special_passenger_name:GUIDE_NAME,special_passenger_role:GUIDE_ROLE,created_at:firebase.firestore.FieldValue.serverTimestamp()});
          await db.collection('trips').add(data);
        }
        closeModal();notify('Passeio salvo com despesas integradas ao financeiro.');
      }catch(err){if(msg)msg.innerHTML=`<div class="msg error">${esc(err.message)}</div>`}
    };
  };
  try{globalThis.tripModal=window.tripModal}catch(_){ }

  const style=document.createElement('style');
  style.textContent=`
    .v31CostsBox{margin-top:20px;padding:18px;border:1px solid var(--line,#dce8e2);border-radius:18px;background:linear-gradient(180deg,#fbfdfc,#f5faf7)}
    .v31CostsHead{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:12px}.v31CostsHead h3{margin:3px 0 4px}.v31CostsHead p{margin:0;color:var(--muted,#6e8279);font-size:12px;max-width:650px}
    .v31Examples{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0 14px}.v31Examples span{padding:8px 10px;border-radius:999px;background:#edf6f1;color:#244c3d;font-size:11px}
    .v31CostRow{display:grid;grid-template-columns:minmax(210px,1.5fr) minmax(210px,1fr) minmax(120px,.7fr) 38px;gap:10px;align-items:end;padding:12px;margin:9px 0;border:1px solid #dce8e2;border-radius:14px;background:#fff}
    .v31CostRow.perPerson{box-shadow:inset 4px 0 0 #d9ad42}.v31CostRow label>span{display:block;margin-bottom:6px;font-size:10px;font-weight:800;letter-spacing:.04em;color:#667b72}.v31CostRow input,.v31CostRow select{width:100%}
    .v31Remove{height:42px;border:0;border-radius:10px;background:#fff0ee;color:#a33;font-size:22px;cursor:pointer}.v31CostPreview{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:14px}.v31CostPreview>div{padding:13px;border-radius:13px;background:#edf6f1}.v31CostPreview span{display:block;font-size:9px;font-weight:900;letter-spacing:.05em;color:#6b8177}.v31CostPreview strong{display:block;margin:4px 0;font-size:17px;color:#0a4b39}.v31CostPreview small{font-size:10px;color:#72857c}.v31Toggle{display:flex!important;gap:8px;align-items:center;height:42px;padding:0 12px;border:1px solid #dce8e2;border-radius:12px;background:#fff}.v31Toggle input{width:auto}.v31Toggle b{font-size:12px}
    @media(max-width:900px){.v31CostRow{grid-template-columns:1fr 1fr}.v31Remove{width:100%}.v31CostPreview{grid-template-columns:1fr 1fr}}
    @media(max-width:560px){.v31CostsHead{display:block}.v31CostsHead button{margin-top:10px}.v31CostRow{grid-template-columns:1fr}.v31CostPreview{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);
})();
