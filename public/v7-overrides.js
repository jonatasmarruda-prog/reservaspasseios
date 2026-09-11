/* Trilheiros V7 — ajustes públicos: sem embarque + avaliação pós-passeio */
(function(){
  function installDarkContrastFix(){
    if(document.getElementById('adminDarkContrastFix'))return;
    const style=document.createElement('style');
    style.id='adminDarkContrastFix';
    style.textContent=`
    /* Tema escuro premium — contraste consistente em todo o painel */
    .adminDark{color-scheme:dark;--v7line:#2b473e;--v7ink:#f3f8f5;--v7muted:#b7c9c1}
    .adminDark body{background:#081611;color:#f3f8f5}
    .adminDark .admin.v7,.adminDark .adminMain,.adminDark .adminContent{background:#081611!important;color:#f3f8f5!important}
    .adminDark .adminHead{background:#0e211b!important;border-color:#28443b!important;color:#f3f8f5!important}
    .adminDark #pageTitle,.adminDark .adminHead h1,.adminDark .adminHead h2{color:#fff!important}

    .adminDark .panel,.adminDark .metric,.adminDark .wizardPanel,
    .adminDark .v42FinanceHero,.adminDark .v42Chart,.adminDark .v42FinanceNote,
    .adminDark .v42Kpi,.adminDark .v42Perf,.adminDark .v41Finance,.adminDark .v41Trips,
    .adminDark .tripOpsCard,.adminDark .dayStats>div,.adminDark .feedbackList article,
    .adminDark .commCard,.adminDark .pendingItem,.adminDark .reportCards button,
    .adminDark .detailGrid>div,.adminDark .peopleDetail,.adminDark .timelineList>div,
    .adminDark .settingsGrid .panel,.adminDark .tableWrap{
      background:#10261f!important;color:#f3f8f5!important;border-color:#2b473e!important;
      box-shadow:0 10px 28px rgba(0,0,0,.20)!important
    }
    .adminDark .v42FinanceHero,.adminDark .v42FinanceNote{background:#132c24!important}
    .adminDark .v42Kpi,.adminDark .v42Perf,.adminDark .tripOpsFinalGrid div{background:#17352c!important;border-color:#315047!important}

    .adminDark .panel h1,.adminDark .panel h2,.adminDark .panel h3,.adminDark .panel h4,
    .adminDark .v42Finance h1,.adminDark .v42Finance h2,.adminDark .v42Finance h3,
    .adminDark .v42Chart h1,.adminDark .v42Chart h2,.adminDark .v42Chart h3,
    .adminDark .v41Finance h1,.adminDark .v41Finance h2,.adminDark .v41Finance h3,
    .adminDark .tripOpsCard h3,.adminDark .reportCards strong,.adminDark .pendingItem strong,
    .adminDark .feedbackList strong,.adminDark .commCard h3,.adminDark .dayHeader h2,
    .adminDark .dayPersonMain strong,.adminDark .structureSummary span,
    .adminDark .detailGrid strong,.adminDark .peopleDetail strong,
    .adminDark .v42PerfHead strong,.adminDark .v42Kpi strong{
      color:#fff!important;opacity:1!important
    }

    .adminDark p,.adminDark small,.adminDark .hint,.adminDark .muted,
    .adminDark .dayHeader p,.adminDark .dayPersonMain small,
    .adminDark .structureSummary p,.adminDark .structureSummary b,
    .adminDark .reportCards small,.adminDark .feedbackList small,
    .adminDark .staffList small,.adminDark .auditList small,.adminDark .trashList small,
    .adminDark .timelineList span,.adminDark .timelineList small,
    .adminDark .v42Chart p,.adminDark .v42Finance p,.adminDark .v42PerfNums span,
    .adminDark .v42Kpi small,.adminDark .v42Empty{
      color:#bfd0c8!important;opacity:1!important
    }

    .adminDark .eyebrow,.adminDark .opsEyebrow,.adminDark .twEyebrow,
    .adminDark .v42Chart>.eyebrow,.adminDark .v42Finance .eyebrow{
      color:#7ed1ae!important;opacity:1!important
    }

    .adminDark input,.adminDark select,.adminDark textarea{
      background:#132a23!important;color:#f7fbf9!important;border-color:#355149!important;
      box-shadow:none!important
    }
    .adminDark input::placeholder,.adminDark textarea::placeholder{color:#8fa89e!important;opacity:1!important}
    .adminDark option{background:#132a23;color:#f7fbf9}

    .adminDark .table,.adminDark table{color:#edf6f1!important}
    .adminDark .table th,.adminDark table th{background:#18342b!important;color:#dceae4!important;border-color:#315047!important}
    .adminDark .table td,.adminDark table td{background:#10261f!important;color:#edf6f1!important;border-color:#29463c!important}
    .adminDark .table tbody tr:hover td,.adminDark table tbody tr:hover td{background:#17362d!important}

    .adminDark .globalSearchWrap,.adminDark .globalSearchResults,.adminDark .globalSearchResults button,
    .adminDark .iconAction{background:#142b24!important;color:#eef7f3!important;border-color:#355149!important}
    .adminDark .globalSearchResults strong{color:#fff!important}
    .adminDark .globalSearchResults small,.adminDark .globalSearchResults span{color:#b8cbc2!important}

    .adminDark .metricProfit{background:linear-gradient(145deg,#133028,#183a30)!important;border-color:#31564a!important}
    .adminDark .rankBar,.adminDark .occupancyCell>div{background:#29463d!important}
    .adminDark .clientBadge{background:#28473c!important;color:#d7e8e0!important}
    .adminDark .rankList>div>span,.adminDark .auditIcon,.adminDark .pwaGuideStep>span{background:#1f4035!important;color:#dcebe4!important}

    /* Clima dos passeios */
    .adminDark #tripWeatherPanel{background:#10261f!important;border-color:#2b473e!important;box-shadow:0 10px 28px rgba(0,0,0,.22)!important}
    .adminDark #tripWeatherPanel h2,.adminDark .twTitle,.adminDark .twTemp{color:#fff!important}
    .adminDark #tripWeatherPanel p,.adminDark .twMeta,.adminDark .twWait,.adminDark .twDetail,.adminDark .twFoot{color:#bdd0c7!important}
    .adminDark .twCard{background:#16342b!important;border-color:#315047!important;color:#edf6f1!important}
    .adminDark .twDetail b{color:#fff!important}
    .adminDark .twAlert{background:#1d4437!important;color:#bff0da!important}
    .adminDark .twRefresh{background:#17382e!important;color:#eaf5f0!important;border-color:#3b5d51!important}
    .adminDark .twError{color:#ffaaa0!important}

    /* Financeiro premium */
    .adminDark .v42Bars,.adminDark .v42TripPerf,.adminDark .v42DonutWrap{color:#edf6f1!important}
    .adminDark .v42Legend,.adminDark .v42Legend span,.adminDark .v42Legend b{color:#dce9e3!important}
    .adminDark .v42PerfBar{background:#29463d!important}
    .adminDark .v42FinanceNote{color:#ead99d!important;border-color:#6a5928!important}
    .adminDark .v42FinanceNote b{color:#ffe89a!important}

    /* Dia do passeio / embarque */
    .adminDark .dayPerson{border-color:#29463d!important;color:#eef7f3!important}
    .adminDark .dayPerson.present{background:linear-gradient(90deg,rgba(35,102,78,.45),transparent)!important}
    .adminDark .presenceBtn{background:#17372e!important;color:#dcebe4!important;border-color:#3a5a4f!important}
    .adminDark .dayPerson.present .presenceBtn{background:#1a805c!important;color:#fff!important;border-color:#1a805c!important}
    .adminDark .structureSummary>div,.adminDark .checkListV7 label,.adminDark .peopleDetail>div,
    .adminDark .staffList>div,.adminDark .auditList>div,.adminDark .trashList>div{border-color:#29463d!important}
    .adminDark .structureSummary h4{color:#9db8ad!important}
    .adminDark .checkListV7:before{background:#43391d!important;color:#ffe59a!important;border:1px solid #68592a!important}

    /* Saúde do sistema e cards auxiliares */
    .adminDark [class*="health" i],.adminDark [id*="health" i]{color:#edf6f1!important}
    .adminDark [class*="health" i] h2,.adminDark [class*="health" i] h3,
    .adminDark [id*="health" i] h2,.adminDark [id*="health" i] h3{color:#fff!important;opacity:1!important}
    .adminDark [class*="health" i] p,.adminDark [class*="health" i] small,
    .adminDark [id*="health" i] p,.adminDark [id*="health" i] small{color:#bfd0c8!important;opacity:1!important}

    .adminDark .templateHelp,.adminDark .offlineHint{background:#44391d!important;color:#ffe6a0!important;border-color:#69582a!important}
    .adminDark .dangerMini{background:#4a2626!important;color:#ffb6b6!important}
    .adminDark .allGood{color:#7fe0b6!important}
    .adminDark .tripOpsStatus{background:#214238!important;color:#d5e8df!important}
    .adminDark .tripOpsStatus.warn{background:#4a3d1d!important;color:#ffe6a0!important}
    .adminDark .tripOpsStatus.ok{background:#174433!important;color:#8ee0bb!important}

    @media(max-width:700px){
      .adminDark .panel,.adminDark .v42Chart,.adminDark #tripWeatherPanel,.adminDark .tripOpsCard{box-shadow:none!important}
    }
    `;
    document.head.appendChild(style);
  }
  installDarkContrastFix();
  window.addEventListener('load',installDarkContrastFix,{once:true});

  window.tripRegistrationFields=function(t){
    const c=t?.registration_options||{};
    const extraLabel=String(c.extra_label||'Opção adicional').trim()||'Opção adicional';
    return [
      {key:'accommodation',label:'Hospedagem',options:Array.isArray(c.accommodation)?c.accommodation:[]},
      {key:'transport',label:'Transporte',options:Array.isArray(c.transport)?c.transport:[]},
      {key:'category',label:'Categoria',options:Array.isArray(c.category)?c.category:[]},
      {key:'extra',label:extraLabel,options:Array.isArray(c.extra)?c.extra:[]}
    ].filter(x=>x.options.length);
  };
  try{tripRegistrationFields=window.tripRegistrationFields}catch(_){ }

  window.tripPublicDetails=function(t){
    const items=[];
    if(t?.difficulty)items.push(['Nível',t.difficulty]);
    if(t?.minimum_age)items.push(['Idade mínima',`${t.minimum_age} anos`]);
    if(t?.distance_km)items.push(['Distância',`${t.distance_km} km`]);
    if(t?.departure_time)items.push(['Saída',t.departure_time]);
    if(t?.return_info)items.push(['Retorno',t.return_info]);
    if(!items.length&&!t?.included_items)return'';
    return `<div class="tourDetails">${items.map(x=>`<div><small>${esc(x[0])}</small><strong>${esc(x[1])}</strong></div>`).join('')}${t?.included_items?`<div class="tourIncluded"><small>Incluso</small><strong>${esc(t.included_items)}</strong></div>`:''}</div>`;
  };
  try{tripPublicDetails=window.tripPublicDetails}catch(_){ }

  function hideBoardingFields(){
    document.querySelectorAll('#tripform label').forEach(label=>{
      const text=(label.querySelector(':scope > span')?.textContent||'').toLowerCase();
      if(text.includes('embarque'))label.style.display='none';
    });
  }
  function installBoardingGuard(){
    const current=window.tripModal;
    if(typeof current!=='function'||current.__hideBoardingV7)return;
    const wrapped=function(...args){const out=current.apply(this,args);hideBoardingFields();return out};
    wrapped.__hideBoardingV7=true;window.tripModal=wrapped;try{tripModal=wrapped}catch(_){ }
  }
  window.addEventListener('load',installBoardingGuard);

  async function surveyPage(tripId){
    app.innerHTML=`<main class="surveyPage"><section class="surveyCard"><img src="https://i.postimg.cc/JnF2F9Hw/LOGO-TRILHEIROS-Photoroom.png" alt="Trilheiros de Rondonópolis"><span class="eyebrow">SUA EXPERIÊNCIA IMPORTA</span><h1>Como foi seu passeio?</h1><p class="surveyLead">Carregando informações...</p></section></main>`;
    try{
      const user=await ensureAnon();
      const tripSnap=await db.collection('trips').doc(tripId).get();
      if(!tripSnap.exists)throw Error('Passeio não encontrado.');
      const t={id:tripSnap.id,...tripSnap.data()};
      const ref=db.collection('trips').doc(tripId).collection('feedback').doc(user.uid);
      const old=await ref.get();
      const card=document.querySelector('.surveyCard');
      if(old.exists){card.innerHTML=`<img src="https://i.postimg.cc/JnF2F9Hw/LOGO-TRILHEIROS-Photoroom.png" alt="Trilheiros"><div class="surveySuccess">✓</div><h1>Obrigado pela avaliação!</h1><p>Sua opinião sobre <b>${esc(t.name)}</b> já foi registrada.</p>`;return}
      card.innerHTML=`<img src="https://i.postimg.cc/JnF2F9Hw/LOGO-TRILHEIROS-Photoroom.png" alt="Trilheiros de Rondonópolis"><span class="eyebrow">SUA EXPERIÊNCIA IMPORTA</span><h1>${esc(t.name)}</h1><p class="surveyLead">Conta pra gente como foi. É rapidinho e ajuda a melhorar os próximos passeios.</p><form id="surveyForm"><div class="ratingGroup"><span>Sua nota</span><div class="ratingButtons">${[1,2,3,4,5].map(n=>`<button type="button" data-rating="${n}">${n}<small>★</small></button>`).join('')}</div></div><label><span>O que você mais gostou?</span><textarea name="liked" rows="3" placeholder="Pode contar pra gente..."></textarea></label><label><span>O que podemos melhorar?</span><textarea name="improve" rows="3" placeholder="Sua sugestão é bem-vinda"></textarea></label><label><span>Você indicaria os Trilheiros?</span><select name="recommend"><option value="sim">Sim, com certeza</option><option value="talvez">Talvez</option><option value="nao">Não</option></select></label><div id="surveyMsg"></div><button class="btn primary wide">Enviar avaliação</button></form>`;
      let rating=0;
      card.querySelectorAll('[data-rating]').forEach(btn=>btn.onclick=()=>{rating=Number(btn.dataset.rating);card.querySelectorAll('[data-rating]').forEach(x=>x.classList.toggle('active',Number(x.dataset.rating)<=rating))});
      document.querySelector('#surveyForm').onsubmit=async e=>{e.preventDefault();if(!rating){document.querySelector('#surveyMsg').innerHTML='<div class="msg error">Escolha uma nota de 1 a 5.</div>';return}const f=e.target;await ref.set({rating,liked:f.liked.value.trim(),improve:f.improve.value.trim(),recommend:f.recommend.value,created_at:firebase.firestore.FieldValue.serverTimestamp()});card.innerHTML=`<img src="https://i.postimg.cc/JnF2F9Hw/LOGO-TRILHEIROS-Photoroom.png" alt="Trilheiros"><div class="surveySuccess">✓</div><h1>Valeu, trilheiro(a)! 💚</h1><p>Sua avaliação foi registrada. Nos vemos na próxima aventura!</p>`}
    }catch(e){document.querySelector('.surveyLead').textContent=e.message||'Não foi possível abrir a avaliação.'}
  }
  window.surveyPage=surveyPage;

  const baseRoute=window.route;
  if(typeof baseRoute==='function'){
    window.route=function(){
      const p=location.pathname;
      if(p.startsWith('/avaliacao/')){clearListeners();return surveyPage(p.split('/')[2])}
      return baseRoute();
    };
    try{route=window.route}catch(_){ }
  }
})();
