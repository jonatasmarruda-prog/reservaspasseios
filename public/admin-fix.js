// Correções complementares do painel administrativo.
(function(){
  function attachModalRemove(){
    if(typeof window.modal === 'function'){
      window.modal.remove = function(){
        const el=document.getElementById('modal');
        if(el) el.remove();
      };
    }
  }

  function loadTripWeather(){
    if(!location.pathname.startsWith('/admin')||document.querySelector('script[data-admin-weather]'))return;
    const s=document.createElement('script');
    s.src='/admin-weather.js?v=20260911-weather3';
    s.defer=true;
    s.dataset.adminWeather='1';
    document.head.appendChild(s);
  }

  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}

  function installRoomEditor(){
    if(typeof window.structureModalV7!=='function'||window.structureModalV7.__roomEditorV2)return false;

    window.addAccommodationRow=function(data={}){
      const host=document.getElementById('accommodationRows');
      if(!host)return;
      const row=document.createElement('div');
      row.className='accommodationRowV2';
      row.style.cssText='display:grid;grid-template-columns:1.15fr 1fr 110px 42px;gap:8px;align-items:center;margin:8px 0';
      const type=String(data.type||'Compartilhado');
      row.innerHTML=`
        <input class="accName" placeholder="Ex.: Quarto 01 ou Camping 01" value="${esc(data.name||'')}">
        <select class="accType">
          <option value="Casal" ${type==='Casal'?'selected':''}>Casal</option>
          <option value="Compartilhado" ${type==='Compartilhado'?'selected':''}>Compartilhado</option>
          <option value="Camping" ${type==='Camping'?'selected':''}>Camping</option>
          <option value="Outro" ${type==='Outro'?'selected':''}>Outro</option>
        </select>
        <input class="accCapacity" type="number" min="0" step="1" placeholder="Vagas" value="${Number(data.capacity||0)||''}">
        <button type="button" class="btn danger" title="Remover" onclick="this.closest('.accommodationRowV2').remove()">×</button>`;
      host.appendChild(row);
      row.querySelector('.accName')?.focus();
    };

    window.addNextRoomRow=function(){
      const rows=[...document.querySelectorAll('#accommodationRows .accommodationRowV2 .accName')];
      let max=0;
      rows.forEach(i=>{const m=String(i.value||'').match(/quarto\s*0*(\d+)/i);if(m)max=Math.max(max,Number(m[1]||0))});
      window.addAccommodationRow({name:`Quarto ${String(max+1).padStart(2,'0')}`,type:'Compartilhado',capacity:2});
    };

    window.addCampingRow=function(){
      const rows=[...document.querySelectorAll('#accommodationRows .accommodationRowV2 .accName')];
      let count=0;rows.forEach(i=>{if(/camping/i.test(i.value||''))count++});
      window.addAccommodationRow({name:`Camping ${String(count+1).padStart(2,'0')}`,type:'Camping',capacity:1});
    };

    const enhanced=function(tripId){
      const t=(window.state?.trips||globalThis.state?.trips||[]).find(x=>x.id===tripId);
      if(!t||typeof window.modal!=='function')return;
      const rooms=Array.isArray(t.rooms)?t.rooms:[];
      const vehicles=Array.isArray(t.vehicles)?t.vehicles:[];
      const vehicleText=vehicles.map(v=>`${v.name||''} | ${v.driver||''} | ${v.plate||''} | ${v.capacity||''}`).join('\n');

      window.modal(`<form id="structureFormV2">
        <div class="modalHead"><div><span class="eyebrow">OPERAÇÃO</span><h2>Hospedagem, quartos e camping</h2><small>${esc(t.name||'')}</small></div><button type="button" class="iconClose" onclick="document.getElementById('modal')?.remove()">✕</button></div>
        <div class="modalBody">
          <div class="formBlock">
            <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap"><div><h3 style="margin-bottom:4px">Quartos / Camping</h3><p class="hint" style="margin:0">Cadastre cada acomodação separadamente. Ex.: Quarto 01, Quarto 02, Camping 01.</p></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn primary" onclick="addNextRoomRow()">+ Adicionar quarto</button><button type="button" class="btn ghost" onclick="addCampingRow()">+ Adicionar camping</button></div></div>
            <div style="display:grid;grid-template-columns:1.15fr 1fr 110px 42px;gap:8px;margin-top:14px;font-size:11px;font-weight:800;color:#60746b"><span>NÚMERO / NOME</span><span>TIPO</span><span>CAPACIDADE</span><span></span></div>
            <div id="accommodationRows"></div>
          </div>
          <div class="formBlock" style="margin-top:18px"><h3>Veículos / ônibus</h3><p class="hint">Uma linha por veículo: Nome | Motorista | Placa | Capacidade</p><textarea name="vehicles" rows="5" placeholder="Ônibus 01 | Romário | ABC1D23 | 46">${esc(vehicleText)}</textarea></div>
          <div id="structureMsgV2"></div>
        </div>
        <div class="modalFoot"><button type="button" class="btn ghost" onclick="document.getElementById('modal')?.remove()">Cancelar</button><button class="btn primary">Salvar estrutura</button></div>
      </form>`);

      const host=document.getElementById('accommodationRows');
      if(rooms.length)rooms.forEach(r=>window.addAccommodationRow(r));
      else window.addAccommodationRow({name:'Quarto 01',type:'Compartilhado',capacity:2});

      const form=document.getElementById('structureFormV2');
      if(!form)return;
      form.onsubmit=async e=>{
        e.preventDefault();
        const roomRows=[...document.querySelectorAll('#accommodationRows .accommodationRowV2')];
        const rooms2=roomRows.map(row=>({
          name:String(row.querySelector('.accName')?.value||'').trim(),
          type:String(row.querySelector('.accType')?.value||'').trim(),
          capacity:Math.max(0,Number(row.querySelector('.accCapacity')?.value||0))
        })).filter(r=>r.name);
        const vehicles2=String(form.vehicles.value||'').split('\n').map(x=>x.trim()).filter(Boolean).map(line=>{const p=line.split('|').map(x=>x.trim());return{name:p[0]||'',driver:p[1]||'',plate:p[2]||'',capacity:Math.max(0,Number(p[3]||0))}}).filter(v=>v.name);
        try{
          await db.collection('trips').doc(tripId).update({rooms:rooms2,vehicles:vehicles2,updated_at:firebase.firestore.FieldValue.serverTimestamp()});
          t.rooms=rooms2;t.vehicles=vehicles2;
          try{await window.auditV7?.('structure','trip',tripId,`Hospedagem atualizada: ${rooms2.length} acomodação(ões)`)}catch(_){ }
          document.getElementById('modal')?.remove();
          try{toast(`Estrutura salva: ${rooms2.length} acomodação(ões).`)}catch(_){ }
          if(typeof window.renderAdmin==='function')window.renderAdmin();
        }catch(err){
          const msg=document.getElementById('structureMsgV2');if(msg)msg.innerHTML=`<div class="msg error">${esc(err?.message||'Não foi possível salvar.')}</div>`;
        }
      };
    };
    enhanced.__roomEditorV2=true;
    window.structureModalV7=enhanced;
    try{globalThis.structureModalV7=enhanced}catch(_){ }
    return true;
  }

  function scheduleRoomEditor(){
    let tries=0;
    const timer=setInterval(()=>{tries++;if(installRoomEditor()||tries>60)clearInterval(timer)},200);
  }

  attachModalRemove();
  loadTripWeather();
  scheduleRoomEditor();
  window.addEventListener('load',()=>{attachModalRemove();loadTripWeather();installRoomEditor()});

  document.addEventListener('click',function(){setTimeout(()=>{attachModalRemove();installRoomEditor()},0)},true);
})();
