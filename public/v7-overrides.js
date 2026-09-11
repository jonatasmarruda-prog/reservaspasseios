/* Trilheiros V7 — ajustes públicos: sem embarque + avaliação pós-passeio */
(function(){
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
