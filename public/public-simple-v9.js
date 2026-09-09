/* Trilheiros de Rondonópolis — Cadastro público simples V9 */
(function(){
  const LOGO='https://i.postimg.cc/JnF2F9Hw/LOGO-TRILHEIROS-Photoroom.png';
  const onlyDigits=v=>String(v||'').replace(/\D/g,'');
  const validEmail=v=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v||'').trim());
  function validCPF(v){
    const n=onlyDigits(v);if(n.length!==11||/^(\d)\1{10}$/.test(n))return false;
    let s=0;for(let i=0;i<9;i++)s+=Number(n[i])*(10-i);let d=(s*10)%11;if(d===10)d=0;if(d!==Number(n[9]))return false;
    s=0;for(let i=0;i<10;i++)s+=Number(n[i])*(11-i);d=(s*10)%11;if(d===10)d=0;return d===Number(n[10]);
  }
  function makeProtocol(){
    const y=new Date().getFullYear();let c='';
    if(crypto?.getRandomValues){const a=new Uint32Array(1);crypto.getRandomValues(a);c=(a[0]%1679616).toString(36).toUpperCase().padStart(4,'0')}
    else c=Math.random().toString(36).slice(2,6).toUpperCase();
    return `TR-${y}-${c}`;
  }
  function maskCPF(v){const n=onlyDigits(v);return n.length===11?`${n.slice(0,3)}.***.***-${n.slice(-2)}`:'—'}
  function policyFor(t){
    if(t?.cancellation_policy)return t.cancellation_policy;
    if(typeof defaultCancellationPolicy==='function')return defaultCancellationPolicy(t?.name||'este passeio');
    return 'Ao enviar o cadastro, o participante declara ciência das condições do passeio e da política de cancelamento informada pela organização.';
  }
  function logoHeader(){
    return `<header class="simplePublicTop"><div class="simplePublicBrand"><img src="${LOGO}" alt="Trilheiros de Rondonópolis"><div><strong>TRILHEIROS DE RONDONÓPOLIS</strong><span>Cadastro de participantes</span></div></div></header>`;
  }
  function tripHero(t){
    const rem=Number(t?.remaining_spots||0);
    return `<section class="simpleTripHero"><span class="simpleEyebrow">CONFIRME SUA PARTICIPAÇÃO</span><h1>${esc(t?.name||'Cadastro do passeio')}</h1><p>${t?.destination?esc(t.destination):'Trilheiros de Rondonópolis'}${t?.trip_date?` • ${date(t.trip_date)}`:''}</p><div class="simpleTripBadges">${t?.trip_date?`<span>📅 ${date(t.trip_date)}</span>`:''}${t?.departure_time?`<span>🕒 ${esc(t.departure_time)}</span>`:''}<span>👥 ${rem} vaga${rem===1?'':'s'} disponível${rem===1?'':'is'}</span></div></section>`;
  }
  function successPage(t,people,code){
    app.innerHTML=`<main class="simplePublicPage">${logoHeader()}<section class="simpleSuccess"><div class="simpleSuccessIcon">✓</div><span class="simpleEyebrow">CADASTRO CONCLUÍDO</span><h1>Pronto! Sua participação foi registrada.</h1><p><b>${esc(t.name)}</b>${t.trip_date?` • ${date(t.trip_date)}`:''}</p><div class="simpleProtocol"><small>SEU PROTOCOLO</small><strong>${esc(code)}</strong></div><div class="simpleSuccessPeople">${people.map((p,i)=>`<div><span>${i+1}. ${esc(p.full_name)}</span><small>${esc(maskCPF(p.cpf))}</small></div>`).join('')}</div><div class="simpleSuccessActions"><a class="simplePrimaryBtn" href="/minha-reserva/${t.id}">Ver minha viagem</a><button class="simpleGhostBtn" id="copySimpleProtocol" type="button">Copiar protocolo</button></div></section></main>`;
    const b=document.querySelector('#copySimpleProtocol');if(b)b.onclick=()=>navigator.clipboard?.writeText(code).then(()=>toast('Protocolo copiado.')).catch(()=>prompt('Copie o protocolo:',code));
  }

  window.renderRegistration=function(trips,fixed){
    if(!trips?.length){document.querySelector('.simpleMainMount').innerHTML='<div class="simpleEmpty"><h2>Nenhum passeio disponível</h2><p>O cadastro pode estar encerrado ou sem vagas.</p></div>';return}
    let current=trips[0],companions=[];
    const mount=document.querySelector('.simpleMainMount');

    function fieldsForTrip(){return typeof tripRegistrationFields==='function'?tripRegistrationFields(current):[]}
    function seats(){return 1+companions.length}
    function maxSeats(){return Math.max(1,Math.min(10,Number(current.remaining_spots||0)))}

    function render(){
      if(!current||current.status!=='open'||Number(current.remaining_spots||0)<1){mount.innerHTML='<div class="simpleEmpty"><h2>Inscrições encerradas</h2><p>Este passeio não possui vagas disponíveis.</p></div>';return}
      const custom=fieldsForTrip();
      mount.innerHTML=`${tripHero(current)}<section class="simpleFormCard"><div class="simpleFormTitle"><div><span class="simpleEyebrow">DADOS DO CADASTRO</span><h2>Preencha e envie</h2><p>É rápido. Informe seus dados e adicione acompanhantes somente se tiver comprado mais de uma vaga.</p></div><div class="simpleSeatCounter"><small>VAGAS NESTE CADASTRO</small><strong id="simpleSeatCount">${seats()}</strong></div></div><form id="simpleReg" novalidate>
      ${!fixed?`<label class="simpleField"><span>Passeio</span><select id="simpleTrip">${trips.map(t=>`<option value="${t.id}" ${t.id===current.id?'selected':''}>${esc(t.name)} — ${date(t.trip_date)}</option>`).join('')}</select></label>`:''}
      <div class="simpleGrid"><label class="simpleField"><span>Nome completo</span><input id="simpleName" autocomplete="name" placeholder="Digite seu nome completo" required></label><label class="simpleField"><span>CPF</span><input id="simpleCpf" inputmode="numeric" autocomplete="off" placeholder="000.000.000-00" required></label><label class="simpleField simpleFull"><span>E-mail</span><input id="simpleEmail" type="email" autocomplete="email" placeholder="seuemail@exemplo.com" required></label></div>
      <section class="simpleCompanionSection"><div class="simpleSectionHead"><div><h3>Participantes</h3><p>Você já está incluído como Participante 1.</p></div><button type="button" class="simpleAddBtn" id="simpleAddParticipant">+ Adicionar participante</button></div><div id="simpleCompanions"></div><div class="simpleLimitNote" id="simpleLimitNote"></div></section>
      ${custom.length?`<section class="simpleExtraSection"><div class="simpleSectionHead"><div><h3>Informações da sua reserva</h3><p>Preencha somente as opções abaixo.</p></div></div><div class="simpleGrid">${custom.map(q=>`<label class="simpleField"><span>${esc(q.label)}</span><select data-simple-opt="${esc(q.key)}" data-simple-label="${esc(q.label)}" required><option value="">Selecione</option>${q.options.map(o=>`<option value="${esc(o)}">${esc(o)}</option>`).join('')}</select></label>`).join('')}</div></section>`:''}
      <section class="simplePolicySection"><details><summary><span>Política de cancelamento</span><b>Toque para ler</b></summary><div class="simplePolicyText">${esc(policyFor(current))}</div></details><label class="simpleAccept"><input type="checkbox" id="simpleAccept"><span>Li e concordo com a política de cancelamento e as condições do passeio.</span></label></section>
      <div id="simpleError" class="simpleError"></div><button class="simpleSubmit" id="simpleSubmit" type="submit">Enviar cadastro</button><p class="simplePrivacy">Seus dados são usados somente para organização do passeio, lista de participantes, seguro quando aplicável e contato operacional.</p></form></section>`;

      const f=document.querySelector('#simpleReg'),name=document.querySelector('#simpleName'),cpfEl=document.querySelector('#simpleCpf'),email=document.querySelector('#simpleEmail');
      cpfEl.oninput=()=>cpfEl.value=cpf(cpfEl.value);

      function renderCompanions(){
        const box=document.querySelector('#simpleCompanions'),count=document.querySelector('#simpleSeatCount'),add=document.querySelector('#simpleAddParticipant'),note=document.querySelector('#simpleLimitNote');
        if(count)count.textContent=String(seats());
        box.innerHTML=companions.map((p,i)=>`<article class="simpleCompanionCard"><div class="simpleCompanionHead"><div><strong>Participante ${i+2}</strong><small>Acompanhante</small></div><button type="button" data-remove-companion="${i}">Remover</button></div><div class="simpleGrid"><label class="simpleField"><span>Nome completo</span><input data-companion-name="${i}" value="${esc(p.name||'')}" placeholder="Nome do acompanhante" required></label><label class="simpleField"><span>CPF</span><input data-companion-cpf="${i}" inputmode="numeric" value="${esc(p.cpf||'')}" placeholder="000.000.000-00" required></label></div></article>`).join('');
        box.querySelectorAll('[data-companion-name]').forEach(x=>x.oninput=e=>companions[Number(e.target.dataset.companionName)].name=e.target.value);
        box.querySelectorAll('[data-companion-cpf]').forEach(x=>x.oninput=e=>{e.target.value=cpf(e.target.value);companions[Number(e.target.dataset.companionCpf)].cpf=e.target.value});
        box.querySelectorAll('[data-remove-companion]').forEach(x=>x.onclick=()=>{companions.splice(Number(x.dataset.removeCompanion),1);renderCompanions()});
        const full=seats()>=maxSeats();add.disabled=full;add.textContent=full?'Limite de vagas atingido':'+ Adicionar participante';
        note.textContent=seats()===1?'Comprou mais de uma vaga? Toque em “Adicionar participante”.':`${seats()} vagas serão cadastradas: você + ${companions.length} acompanhante${companions.length===1?'':'s'}.`;
      }
      document.querySelector('#simpleAddParticipant').onclick=()=>{if(seats()>=maxSeats())return;companions.push({name:'',cpf:''});renderCompanions();setTimeout(()=>document.querySelector(`[data-companion-name="${companions.length-1}"]`)?.focus(),40)};
      renderCompanions();

      if(!fixed){
        document.querySelector('#simpleTrip').onchange=e=>{
          current=trips.find(t=>t.id===e.target.value)||trips[0];companions=[];render();
        };
      }

      function showError(msg,el){const box=document.querySelector('#simpleError');box.textContent=msg;box.classList.add('show');if(el){el.classList.add('simpleInvalid');el.scrollIntoView({behavior:'smooth',block:'center'});setTimeout(()=>el.focus({preventScroll:true}),220)}}
      function clearErrors(){document.querySelector('#simpleError').classList.remove('show');document.querySelectorAll('.simpleInvalid').forEach(x=>x.classList.remove('simpleInvalid'))}

      f.onsubmit=async e=>{
        e.preventDefault();clearErrors();
        if(name.value.trim().length<3)return showError('Informe seu nome completo.',name);
        if(!validCPF(cpfEl.value))return showError('Confira o CPF informado.',cpfEl);
        if(!validEmail(email.value))return showError('Informe um e-mail válido.',email);
        const people=[{full_name:name.value.trim(),cpf:onlyDigits(cpfEl.value)},...companions.map(x=>({full_name:String(x.name||'').trim(),cpf:onlyDigits(x.cpf)}))];
        for(let i=1;i<people.length;i++){
          const n=document.querySelector(`[data-companion-name="${i-1}"]`),c=document.querySelector(`[data-companion-cpf="${i-1}"]`);
          if(people[i].full_name.length<3)return showError(`Informe o nome completo do Participante ${i+1}.`,n);
          if(!validCPF(people[i].cpf))return showError(`Confira o CPF do Participante ${i+1}.`,c);
        }
        const cpfs=people.map(p=>p.cpf);if(new Set(cpfs).size!==cpfs.length)return showError('Há CPF repetido. Cada participante precisa ter um CPF diferente.');
        const answers={};let missing=null;
        document.querySelectorAll('[data-simple-opt]').forEach(x=>{if(!x.value&&!missing)missing=x;if(x.value)answers[x.dataset.simpleOpt]={label:x.dataset.simpleLabel,value:x.value}});
        if(missing)return showError('Selecione as informações da sua reserva.',missing);
        if(!document.querySelector('#simpleAccept').checked)return showError('Marque o aceite da política de cancelamento.',document.querySelector('#simpleAccept'));
        const btn=document.querySelector('#simpleSubmit');btn.disabled=true;btn.textContent='Enviando...';
        try{
          const u=await ensureAnon(),tripRef=db.collection('trips').doc(current.id),resRef=tripRef.collection('reservations').doc(u.uid),code=makeProtocol();
          await db.runTransaction(async tx=>{
            const [ts,rs]=await Promise.all([tx.get(tripRef),tx.get(resRef)]);
            if(!ts.exists)throw Error('Passeio não encontrado.');if(rs.exists)throw Error('DUPLICATE');
            const t=ts.data(),rem=Number(t.remaining_spots||0),used=Number(t.used_spots||0),qty=people.length;
            if(t.status!=='open')throw Error('As inscrições deste passeio estão encerradas.');if(rem<qty)throw Error(`Restam somente ${rem} vaga(s).`);
            const now=firebase.firestore.FieldValue.serverTimestamp();
            tx.set(resRef,{protocol:code,responsible_name:name.value.trim(),responsible_cpf:onlyDigits(cpfEl.value),email:email.value.trim().toLowerCase(),seats:qty,participants:people,registration_answers:answers,status:'active',payment_status:t.assumes_payment===false?'pending':'paid',payment_method:'a_confirmar',paid_amount:t.assumes_payment===false?0:Number(t.default_price||0)*qty,refunded_amount:0,policy_text:t.cancellation_policy||policyFor(t),policy_version:'2026-09-v2',policy_accepted:true,policy_accepted_at:now,created_at:now,updated_at:now});
            tx.update(tripRef,{remaining_spots:rem-qty,used_spots:used+qty,updated_at:now});
          });
          successPage(current,people,code);
        }catch(ex){btn.disabled=false;btn.textContent='Enviar cadastro';if(String(ex.message).includes('DUPLICATE'))showError('Este aparelho já possui um cadastro para este passeio. Abra “Minha viagem” para consultar.');else showError(ex.message||'Não foi possível concluir o cadastro. Tente novamente.')}
      };
    }
    render();
  };

  window.registration=async function(id=''){
    app.innerHTML=`<main class="simplePublicPage">${logoHeader()}<div class="simpleMainMount"><section class="simpleLoading"><div></div><h2>Preparando seu cadastro...</h2><p>Só um instante.</p></section></div><footer class="simpleFooter">Trilheiros de Rondonópolis • Natureza, segurança e boas experiências.</footer></main>`;
    try{
      await ensureAnon();let trips;
      if(id){const s=await db.collection('trips').doc(id).get();trips=s.exists?[{id:s.id,...s.data()}]:[]}
      else trips=await getTrips();
      renderRegistration(trips,!!id);
    }catch(e){document.querySelector('.simpleMainMount').innerHTML=`<div class="simpleEmpty"><h2>Cadastro indisponível</h2><p>${esc(e.message||'Tente novamente em instantes.')}</p></div>`}
  };

  try{registration=window.registration}catch(_){ }
  try{renderRegistration=window.renderRegistration}catch(_){ }
})();
