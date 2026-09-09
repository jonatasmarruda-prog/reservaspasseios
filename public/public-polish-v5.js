/* Trilheiros de Rondonópolis — acabamento comportamental do cadastro público V5 */
(function(){
  let dirty=false;
  let completed=false;
  let lastStep='';
  let stepTimer=null;

  const isPublic=()=>!!document.querySelector('.publicPage')&&!location.pathname.startsWith('/admin');

  function friendlyError(text){
    const raw=String(text||'').trim();
    const low=raw.toLowerCase();
    if(!raw)return raw;
    if(low.includes('missing or insufficient permission')||low.includes('permission-denied')||low.includes('permission denied')){
      return 'Não foi possível acessar os dados necessários. Atualize a página e tente novamente.';
    }
    if(low.includes('network')||low.includes('unavailable')||low.includes('failed to fetch')||low.includes('network request failed')){
      return 'Não foi possível concluir agora. Confira sua internet e tente novamente.';
    }
    if(low.includes('failed-precondition')||low.includes('internal')||low.includes('firebase')){
      return 'O sistema não conseguiu concluir esta etapa agora. Atualize a página e tente novamente.';
    }
    if(low.includes('duplicate')||low.includes('já possui cadastro')){
      return 'Este aparelho já possui um cadastro para este passeio. Use “Ver minha viagem” para consultar sua reserva.';
    }
    return raw;
  }

  function normalizeErrors(){
    document.querySelectorAll('.wizardError').forEach(el=>{
      el.setAttribute('role','alert');
      el.setAttribute('aria-live','assertive');
      const next=friendlyError(el.textContent);
      if(next&&next!==el.textContent)el.textContent=next;
    });
  }

  function updateProgressAccessibility(){
    const buttons=[...document.querySelectorAll('.wizardStepBtn')];
    buttons.forEach((b,i)=>{
      b.setAttribute('aria-label',`Etapa ${i+1} de ${buttons.length}: ${b.textContent.trim().replace(/\s+/g,' ')}`);
      if(b.classList.contains('active'))b.setAttribute('aria-current','step');
      else b.removeAttribute('aria-current');
    });
  }

  function markDraftSaved(){
    const badge=document.querySelector('#draftBadge');
    if(!badge)return;
    badge.textContent='✓ Progresso salvo';
    badge.classList.add('show');
    badge.setAttribute('aria-live','polite');
  }

  function setDynamicTitle(){
    if(!isPublic())return;
    const title=document.querySelector('.publicHero h1')?.textContent?.trim();
    if(title&&title!=='Preparando seu cadastro...'&&title!=='Cadastro de participantes'){
      document.title=`${title} | Trilheiros de Rondonópolis`;
    }
  }

  function removeAdminPublicLink(){
    document.querySelectorAll('.publicAdminLink').forEach(x=>x.remove());
  }

  function decorateButtons(){
    const submit=document.querySelector('#submitReg');
    if(submit){
      submit.setAttribute('data-original-label',submit.getAttribute('data-original-label')||submit.textContent||'Confirmar cadastro');
      if(submit.disabled){submit.setAttribute('aria-busy','true')}else submit.removeAttribute('aria-busy');
    }

    document.querySelectorAll('#nextStep,#prevStep').forEach(btn=>{
      if(btn.dataset.rapidGuard==='1')return;
      btn.dataset.rapidGuard='1';
      btn.addEventListener('click',e=>{
        const now=Date.now(),last=Number(btn.dataset.lastTap||0);
        if(now-last<450){e.preventDefault();e.stopImmediatePropagation();return}
        btn.dataset.lastTap=String(now);
      },true);
    });
  }

  function bindForm(){
    const form=document.querySelector('#reg');
    if(!form||form.dataset.polishV5==='1')return;
    form.dataset.polishV5='1';

    const change=()=>{
      dirty=true;
      markDraftSaved();
    };
    form.addEventListener('input',change,{passive:true});
    form.addEventListener('change',change,{passive:true});
    form.addEventListener('submit',()=>{
      const submit=document.querySelector('#submitReg');
      if(submit){
        submit.setAttribute('aria-busy','true');
        submit.dataset.submitting='1';
      }
    },true);
  }

  function watchStep(){
    const screen=document.querySelector('.wizardScreen .screenEyebrow')?.textContent?.trim()||'';
    if(!screen||screen===lastStep)return;
    lastStep=screen;
    updateProgressAccessibility();
    clearTimeout(stepTimer);
    stepTimer=setTimeout(()=>{
      if(window.innerWidth<=760){
        const panel=document.querySelector('.wizardPanel');
        if(panel){
          const y=panel.getBoundingClientRect().top+window.scrollY-4;
          window.scrollTo({top:Math.max(0,y),behavior:'smooth'});
        }
      }
    },80);
  }

  function detectCompletion(){
    if(document.querySelector('.successV3')){
      completed=true;
      dirty=false;
      document.title='Cadastro concluído | Trilheiros de Rondonópolis';
      const protocol=document.querySelector('.protocolCard strong');
      if(protocol)protocol.setAttribute('aria-label',`Protocolo da reserva ${protocol.textContent.trim()}`);
    }
    if(document.querySelector('.duplicateCard')){
      dirty=false;
    }
  }

  function polish(){
    if(!isPublic())return;
    removeAdminPublicLink();
    bindForm();
    normalizeErrors();
    updateProgressAccessibility();
    decorateButtons();
    watchStep();
    detectCompletion();
    setDynamicTitle();

    document.querySelectorAll('.supportLink').forEach(a=>{
      a.setAttribute('aria-label','Abrir WhatsApp para pedir ajuda sobre este passeio');
    });
  }

  window.addEventListener('beforeunload',e=>{
    if(!dirty||completed||!document.querySelector('#reg'))return;
    e.preventDefault();
    e.returnValue='';
  });

  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible')polish();
  });

  document.addEventListener('click',e=>{
    if(!isPublic())return;
    if(!e.target.closest('.helpBtn')&&!e.target.closest('.helpBox')){
      document.querySelectorAll('.helpBox:not([hidden])').forEach(x=>x.hidden=true);
      document.querySelectorAll('.helpBtn.open').forEach(x=>{x.classList.remove('open');x.setAttribute('aria-expanded','false')});
    }
  });

  const observer=new MutationObserver(()=>requestAnimationFrame(polish));
  observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  document.addEventListener('DOMContentLoaded',polish);
  setTimeout(polish,350);
})();
