/* Cadastro público V11 — seleção de vagas gera automaticamente os participantes */
(function(){
  function availableSeats(){
    const texts=[...document.querySelectorAll('.simpleTripBadges span')].map(x=>x.textContent||'');
    const hit=texts.find(x=>/vaga/i.test(x));
    const n=Number((hit?.match(/(\d+)/)||[])[1]||1);
    return Math.max(1,Math.min(10,n));
  }

  function currentQty(){return 1+document.querySelectorAll('[data-companion-name]').length}

  function syncQty(target){
    target=Math.max(1,Math.min(availableSeats(),Number(target||1)));
    let guard=0;
    while(currentQty()<target&&guard++<12){
      const add=document.querySelector('#simpleAddParticipant');
      if(!add||add.disabled)break;
      add.click();
    }
    guard=0;
    while(currentQty()>target&&guard++<12){
      const removes=[...document.querySelectorAll('[data-remove-companion]')];
      const last=removes.at(-1);
      if(!last)break;
      last.click();
    }
    const select=document.querySelector('#simpleSeatSelectorV11');
    if(select)select.value=String(currentQty());
    updateCopy();
  }

  function updateCopy(){
    const qty=currentQty();
    const section=document.querySelector('.simpleCompanionSection');
    if(!section)return;
    const h=section.querySelector('.simpleSectionHead h3');
    const p=section.querySelector('.simpleSectionHead p');
    const note=section.querySelector('#simpleLimitNote');
    if(h)h.textContent=qty===1?'Participante':'Dados dos participantes';
    if(p)p.textContent=qty===1?'Você será o Participante 1.':'Preencha nome e CPF de cada acompanhante abaixo.';
    if(note)note.textContent=qty===1?'1 vaga selecionada: somente você.':`${qty} vagas selecionadas: você + ${qty-1} acompanhante${qty-1===1?'':'s'}.`;
    const counter=document.querySelector('#simpleSeatCount');
    if(counter)counter.textContent=String(qty);
  }

  function installSelector(){
    const form=document.querySelector('#simpleReg');
    if(!form||form.dataset.seatV11==='1')return;
    const grid=form.querySelector('.simpleGrid');
    if(!grid)return;
    form.dataset.seatV11='1';

    const max=availableSeats();
    const wrap=document.createElement('section');
    wrap.className='simpleSeatChoiceV11';
    wrap.innerHTML=`<div class="simpleSeatChoiceCopyV11"><span>QUANTIDADE DE VAGAS</span><h3>Quantas vagas você pagou?</h3><p>Selecione a quantidade. Os campos dos acompanhantes aparecem automaticamente.</p></div><label class="simpleSeatSelectV11"><span>Selecione as vagas</span><select id="simpleSeatSelectorV11">${Array.from({length:max},(_,i)=>{const n=i+1;const label=n===1?'1 vaga — somente eu':`${n} vagas — eu + ${n-1} acompanhante${n-1===1?'':'s'}`;return `<option value="${n}">${label}</option>`}).join('')}</select></label>`;
    grid.before(wrap);

    const add=document.querySelector('#simpleAddParticipant');
    if(add){add.classList.add('v11HiddenAdd');add.setAttribute('aria-hidden','true');add.tabIndex=-1}
    document.querySelector('#simpleSeatSelectorV11').onchange=e=>syncQty(e.target.value);
    updateCopy();
  }

  if(!location.pathname.startsWith('/admin')){
    const observer=new MutationObserver(()=>{
      installSelector();
      const add=document.querySelector('#simpleAddParticipant');
      if(add&&!add.classList.contains('v11HiddenAdd')){add.classList.add('v11HiddenAdd');add.setAttribute('aria-hidden','true');add.tabIndex=-1}
      document.querySelectorAll('[data-remove-companion]').forEach(x=>{x.classList.add('v11HiddenRemove');x.setAttribute('aria-hidden','true');x.tabIndex=-1});
    });
    observer.observe(document.documentElement,{subtree:true,childList:true});
  }
  window.addEventListener('load',installSelector);
})();
