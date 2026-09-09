/* Ajuda contextual do cadastro público */
(function(){
  const helpByKey={
    responsible_name:'Digite o nome completo da pessoa responsável pela compra e pelo cadastro. Esse nome também será usado como Participante 1.',
    responsible_cpf:'Informe o CPF do responsável. Digite somente os números; o sistema formata automaticamente.',
    email:'Informe um e-mail válido do responsável. Ele serve como referência de contato da reserva.',
    trip:'Confirme o passeio correto. Quando você recebe um link específico, o passeio já vem selecionado e não pode ser alterado.',
    seats:'Selecione exatamente quantas vagas foram compradas. O sistema abrirá um campo de nome e CPF para cada pessoa que irá ao passeio.',
    accommodation:'Escolha a hospedagem que foi contratada para sua reserva, por exemplo quarto compartilhado, quarto casal ou camping.',
    transport:'Informe como você irá ao passeio, por exemplo ônibus do grupo ou carro próprio.',
    category:'Selecione a categoria correta da reserva, como adulto ou criança, conforme a opção adquirida.',
    boarding:'Escolha o ponto onde você pretende embarcar, quando o passeio tiver mais de uma opção de saída.',
    extra:'Selecione a opção adicional configurada para este passeio.',
    observation:'Use este campo apenas se precisar avisar algo importante à organização, como restrição alimentar ou outra informação operacional.',
    participant_name:'Digite o nome completo da pessoa que ocupará esta vaga. Cada vaga precisa ter o nome real de quem irá ao passeio.',
    participant_cpf:'Informe o CPF da pessoa que ocupará esta vaga. Cada participante deve ter um CPF diferente.',
    policy:'Leia a política de cancelamento até o fim. Ao marcar o aceite, você confirma que leu e concorda com as condições apresentadas.'
  };

  function addHelp(label,key,text){
    if(!label||label.dataset.helpReady==='1')return;
    const span=label.querySelector(':scope > span');
    if(!span)return;
    label.dataset.helpReady='1';
    span.classList.add('fieldLabel');
    const btn=document.createElement('button');
    btn.type='button';btn.className='fieldHelpBtn';btn.setAttribute('aria-label','Ver ajuda deste campo');btn.textContent='?';
    const box=document.createElement('div');
    box.className='fieldHelpBox';box.hidden=true;box.textContent=text||helpByKey[key]||'Preencha este campo conforme as informações da sua reserva.';
    btn.onclick=e=>{e.preventDefault();e.stopPropagation();const willOpen=box.hidden;document.querySelectorAll('.fieldHelpBox:not([hidden])').forEach(x=>x.hidden=true);document.querySelectorAll('.fieldHelpBtn.open').forEach(x=>x.classList.remove('open'));box.hidden=!willOpen;btn.classList.toggle('open',willOpen)};
    span.appendChild(btn);label.appendChild(box);
  }

  function addSectionHelp(title,text){
    if(!title||title.dataset.helpReady==='1')return;
    title.dataset.helpReady='1';
    const btn=document.createElement('button');btn.type='button';btn.className='sectionHelpBtn';btn.textContent='?';btn.setAttribute('aria-label','Ver explicação desta etapa');
    const box=document.createElement('div');box.className='sectionHelpBox';box.hidden=true;box.textContent=text;
    btn.onclick=e=>{e.preventDefault();e.stopPropagation();box.hidden=!box.hidden;btn.classList.toggle('open',!box.hidden)};
    title.appendChild(btn);title.parentElement.appendChild(box);
  }

  function decorateParticipants(){
    document.querySelectorAll('#participants .participant').forEach((card,i)=>{
      const head=card.querySelector('.participantHead');
      if(head)head.textContent=i===0?'Participante 1 • Responsável':`Participante ${i+1} • Acompanhante`;
      const nameInput=card.querySelector('[data-pname]');
      const cpfInput=card.querySelector('[data-pcpf]');
      addHelp(nameInput?.closest('label'),'participant_name',i===0?'Este é o nome do responsável pela reserva. Ele é preenchido automaticamente com o nome informado no início do cadastro.':helpByKey.participant_name);
      addHelp(cpfInput?.closest('label'),'participant_cpf',i===0?'Este é o CPF do responsável pela reserva. Ele é preenchido automaticamente com o CPF informado no início do cadastro.':helpByKey.participant_cpf);
    });
  }

  function decorateForm(){
    const form=document.querySelector('#reg');
    if(!form||document.body.dataset.decorating==='1')return;
    document.body.dataset.decorating='1';
    form.dataset.guided='1';form.classList.add('guidedForm');

    const card=form.closest('.publicFormCard');
    const firstTitle=card?.querySelector('.sectionTitle');
    if(firstTitle&&!card.querySelector('.fillGuide')){
      const guide=document.createElement('div');guide.className='fillGuide';
      guide.innerHTML='<div class="fillGuideIcon">i</div><div><strong>Como preencher</strong><p>Informe os dados do responsável e escolha quantas vagas foram compradas. Se forem 2, 3 ou mais vagas, o formulário abrirá automaticamente os dados de todos os acompanhantes.</p></div>';
      card.insertBefore(guide,firstTitle);
    }

    const name=form.querySelector('input[name="name"]')?.closest('label');
    const cpf=form.querySelector('input[name="cpf"]')?.closest('label');
    const email=form.querySelector('input[name="email"]')?.closest('label');
    const trip=form.querySelector('select[name="trip"]')?.closest('label');
    const seats=form.querySelector('select[name="seats"]')?.closest('label');
    addHelp(name,'responsible_name');addHelp(cpf,'responsible_cpf');addHelp(email,'email');addHelp(trip,'trip');addHelp(seats,'seats');
    if(seats){const s=seats.querySelector(':scope > span');if(s&&s.childNodes[0])s.childNodes[0].nodeValue='Quantas vagas você comprou? '}

    document.querySelectorAll('[data-regopt]').forEach(el=>{
      const key=el.dataset.regopt||'extra';addHelp(el.closest('label'),key,helpByKey[key]||helpByKey.extra);
    });
    addHelp(document.querySelector('#regObservation')?.closest('label'),'observation');
    decorateParticipants();

    [...document.querySelectorAll('.publicFormCard .sectionTitle h2')].forEach(t=>{
      const tx=t.textContent.trim().toLowerCase();
      if(tx.includes('dados da reserva'))addSectionHelp(t,'Aqui você informa quem é o responsável pela compra, o passeio e quantas vagas foram adquiridas.');
      else if(tx.includes('informações do passeio'))addSectionHelp(t,'Estas opções mudam conforme o passeio. Selecione exatamente o que foi comprado ou combinado com a organização.');
      else if(tx.includes('participantes'))addSectionHelp(t,'Preencha nome e CPF de todas as pessoas que irão ao passeio. Se você comprou várias vagas, cada vaga precisa de um participante.');
      else if(tx.includes('política'))addSectionHelp(t,'Leia as condições de cancelamento e marque o aceite somente depois de conferir o texto.');
    });

    addHelp(form.querySelector('input[name="accepted"]')?.closest('label'),'policy');
    document.body.dataset.decorating='0';
  }

  const original=window.renderRegistration;
  if(typeof original==='function'){
    window.renderRegistration=function(trips,fixed){const r=original(trips,fixed);setTimeout(decorateForm,0);return r};
    try{renderRegistration=window.renderRegistration}catch{}
  }

  const observer=new MutationObserver(()=>{
    if(document.querySelector('#reg'))requestAnimationFrame(decorateForm);
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});

  document.addEventListener('click',e=>{
    if(!e.target.closest('.fieldHelpBtn')&&!e.target.closest('.fieldHelpBox')){
      document.querySelectorAll('.fieldHelpBox:not([hidden])').forEach(x=>x.hidden=true);
      document.querySelectorAll('.fieldHelpBtn.open').forEach(x=>x.classList.remove('open'));
    }
  });
})();
