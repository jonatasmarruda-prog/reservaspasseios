/* Trilheiros de Rondonópolis — Experiência de cadastro Premium V15
   Apenas apresentação/UX: preserva validação, transação, vagas e dados do V9/V11. */
(function(){
  const q=(s,r=document)=>r.querySelector(s);
  const qa=(s,r=document)=>[...r.querySelectorAll(s)];
  const digits=v=>String(v||'').replace(/\D/g,'');

  function makeStep(number,title,copy){
    const el=document.createElement('div');
    el.className='v15StepHead';
    el.dataset.v15StepHead=String(number);
    el.innerHTML=`<span class="v15StepHeadNumber">${number}</span><div><h3>${title}</h3><p>${copy}</p></div>`;
    return el;
  }

  function ensureStepBefore(target,number,title,copy){
    if(!target)return null;
    const prev=target.previousElementSibling;
    if(prev?.dataset?.v15StepHead===String(number))return prev;
    const existing=q(`[data-v15-step-head="${number}"]`,target.closest('#simpleReg')||document);
    if(existing){target.before(existing);return existing}
    const el=makeStep(number,title,copy);target.before(el);return el;
  }

  function addProgress(card,form){
    let bar=q('.v15Progress',card);
    if(bar)return bar;
    bar=document.createElement('div');
    bar.className='v15Progress';
    bar.setAttribute('aria-label','Etapas do cadastro');
    bar.innerHTML=`
      <div class="v15ProgressItem active" data-v15-progress="1"><b>1</b><span>Seus dados</span></div>
      <div class="v15ProgressItem" data-v15-progress="2"><b>2</b><span>Vagas</span></div>
      <div class="v15ProgressItem" data-v15-progress="3"><b>3</b><span>Participantes</span></div>
      <div class="v15ProgressItem" data-v15-progress="4"><b>4</b><span>Confirmar</span></div>`;
    form.before(bar);
    return bar;
  }

  function setActiveStep(form,number){
    const card=form.closest('.simpleFormCard');
    qa('.v15ProgressItem',card).forEach(x=>x.classList.toggle('active',x.dataset.v15Progress===String(number)));
  }

  function stepForElement(el,form){
    if(!el)return 1;
    if(el.closest('.simpleSeatChoiceV11'))return 2;
    if(el.closest('.simpleCompanionSection'))return 3;
    if(el.closest('.simpleReviewV10,.simplePolicySection')||el.id==='simpleSubmit')return 4;
    return 1;
  }

  function updateProgress(form){
    const card=form.closest('.simpleFormCard');if(!card)return;
    const name=q('#simpleName',form)?.value.trim()||'';
    const cpfNum=digits(q('#simpleCpf',form)?.value||'');
    const email=q('#simpleEmail',form)?.value.trim()||'';
    const step1=name.length>=3&&cpfNum.length===11&&/^\S+@\S+\.\S+$/.test(email);
    const seat=q('#simpleSeatSelectorV11',form);
    const step2=!!seat?.value;
    const companionNames=qa('[data-companion-name]',form);
    const companionCpfs=qa('[data-companion-cpf]',form);
    const step3=companionNames.every((x,i)=>x.value.trim().length>=3&&digits(companionCpfs[i]?.value||'').length===11);
    const step4=!!q('#simpleAccept',form)?.checked;
    const done={1:step1,2:step2,3:step3,4:step4};
    qa('.v15ProgressItem',card).forEach(x=>x.classList.toggle('done',!!done[Number(x.dataset.v15Progress)]));
  }

  function updateSubmit(form){
    const btn=q('#simpleSubmit',form);if(!btn||btn.disabled)return;
    const qty=1+qa('[data-companion-name]',form).length;
    btn.textContent=`✓ Confirmar minha inscrição — ${qty} vaga${qty===1?'':'s'}`;
  }

  function removeInlineErrorFor(el){
    const field=el?.closest?.('.simpleField');
    field?.querySelector('.v15FieldError')?.remove();
  }

  function syncInlineError(form){
    qa('.v15FieldError',form).forEach(x=>x.remove());
    const general=q('#simpleError',form);
    if(!general?.classList.contains('show'))return;
    const msg=general.textContent.trim();if(!msg)return;
    const invalid=q('.simpleInvalid',form);
    const field=invalid?.closest('.simpleField');
    if(field){
      const note=document.createElement('div');note.className='v15FieldError';note.textContent=msg;field.append(note);
    }
  }

  function enhanceSummary(form){
    const review=q('.simpleReviewV10',form);if(!review)return;
    ensureStepBefore(review,4,'Confira e confirme','Revise os dados antes de concluir sua inscrição.');
    const label=q('.simpleReviewHead span',review);if(label)label.textContent='RESUMO FINAL';
    const title=q('.simpleReviewHead h3',review);if(title)title.textContent='Confira os dados';
  }

  function enhanceForm(){
    const form=q('#simpleReg');if(!form)return;
    const page=form.closest('.simplePublicPage');page?.classList.add('v15Premium');
    const card=form.closest('.simpleFormCard');if(!card)return;

    document.title='Cadastro do passeio | Trilheiros de Rondonópolis';
    const brandSub=q('.simplePublicBrand span',page);if(brandSub)brandSub.textContent='Cadastro oficial de participantes';
    const heroEyebrow=q('.simpleTripHero .simpleEyebrow',page);if(heroEyebrow)heroEyebrow.textContent='CADASTRO OFICIAL • TRILHEIROS';
    const formTitle=q('.simpleFormTitle h2',card);if(formTitle)formTitle.textContent='Garanta seu cadastro';
    const formCopy=q('.simpleFormTitle p',card);if(formCopy)formCopy.textContent='Preencha os dados abaixo para confirmar os participantes do passeio.';

    addProgress(card,form);

    const primaryGrid=qa(':scope > .simpleGrid',form)[0]||q('.simpleGrid',form);
    if(primaryGrid)ensureStepBefore(primaryGrid,1,'Seus dados','Informe os dados do responsável por este cadastro.');

    const seat=q('.simpleSeatChoiceV11',form);
    if(seat&&primaryGrid){
      primaryGrid.after(seat);
      ensureStepBefore(seat,2,'Quantidade de vagas','Selecione exatamente quantas vagas foram pagas.');
      const seatTitle=q('.simpleSeatChoiceCopyV11 h3',seat);if(seatTitle)seatTitle.textContent='Quantas vagas você pagou?';
      const seatCopy=q('.simpleSeatChoiceCopyV11 p',seat);if(seatCopy)seatCopy.textContent='Ao escolher a quantidade, os campos dos acompanhantes aparecem automaticamente.';
    }

    const participants=q('.simpleCompanionSection',form);
    if(participants)ensureStepBefore(participants,3,'Participantes','Você já está incluído. Complete os dados dos acompanhantes, quando houver.');

    enhanceSummary(form);

    const submit=q('#simpleSubmit',form);
    if(submit&&!q('.v15TrustLine',form)){
      const trust=document.createElement('div');
      trust.className='v15TrustLine';
      trust.innerHTML='🔒 <span><b>Cadastro seguro.</b> Seus dados são usados somente para organização do passeio.</span>';
      submit.before(trust);
    }

    if(form.dataset.v15Enhanced!=='1'){
      form.dataset.v15Enhanced='1';
      form.addEventListener('focusin',e=>setActiveStep(form,stepForElement(e.target,form)));
      form.addEventListener('input',e=>{
        removeInlineErrorFor(e.target);updateProgress(form);updateSubmit(form);
      });
      form.addEventListener('change',e=>{
        removeInlineErrorFor(e.target);setTimeout(()=>{updateProgress(form);updateSubmit(form);enhanceSummary(form)},0);
      });
      form.addEventListener('submit',()=>setTimeout(()=>{syncInlineError(form);updateProgress(form)},0));
      q('#simpleSubmit',form)?.addEventListener('click',()=>setTimeout(()=>syncInlineError(form),0));
    }

    updateProgress(form);updateSubmit(form);
  }

  function enhanceSuccess(){
    const success=q('.simpleSuccess');if(!success)return;
    const page=success.closest('.simplePublicPage');page?.classList.add('v15Premium');
    document.title='Cadastro confirmado | Trilheiros de Rondonópolis';
    const brandSub=q('.simplePublicBrand span',page);if(brandSub)brandSub.textContent='Cadastro oficial de participantes';
    if(success.dataset.v15Success==='1')return;
    success.dataset.v15Success='1';
    const icon=q('.simpleSuccessIcon',success);
    if(icon){
      const badge=document.createElement('div');badge.className='v15SuccessBadge';badge.textContent='✓ INSCRIÇÃO REGISTRADA';icon.after(badge);
    }
    const eyebrow=q('.simpleEyebrow',success);if(eyebrow)eyebrow.textContent='TUDO CERTO';
    const h1=q('h1',success);if(h1)h1.textContent='Cadastro confirmado!';
  }

  if(!location.pathname.startsWith('/admin')){
    let queued=false;
    const observer=new MutationObserver(()=>{
      if(queued)return;queued=true;
      requestAnimationFrame(()=>{
        queued=false;
        enhanceForm();enhanceSuccess();
        const form=q('#simpleReg');if(form){enhanceSummary(form);updateProgress(form);updateSubmit(form)}
      });
    });
    observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','disabled']});
  }
  window.addEventListener('load',()=>{enhanceForm();enhanceSuccess()});
  setTimeout(()=>{enhanceForm();enhanceSuccess()},350);
})();
