/* Cadastro público premium — Trilheiros de Rondonópolis */
(function(){
  function publicLogo(){
    return `<a class="publicBrand" href="/" aria-label="Trilheiros de Rondonópolis">
      <img src="https://i.postimg.cc/JnF2F9Hw/LOGO-TRILHEIROS-Photoroom.png" alt="Trilheiros de Rondonópolis" class="publicLogo">
      <div class="publicBrandCopy"><strong>TRILHEIROS DE RONDONÓPOLIS</strong><span>Experiências • Natureza • Segurança</span></div>
    </a>`;
  }

  function publicHero(trip,fixed){
    const name=trip?.name||'Cadastro de participantes';
    const destination=trip?.destination||'Trilheiros de Rondonópolis';
    const tripDate=trip?.trip_date?date(trip.trip_date):'';
    const remaining=Number(trip?.remaining_spots||0);
    const details=[];
    if(tripDate) details.push(`<div class="heroInfoItem"><span>DATA</span><strong>${esc(tripDate)}</strong></div>`);
    if(destination) details.push(`<div class="heroInfoItem"><span>DESTINO</span><strong>${esc(destination)}</strong></div>`);
    if(trip?.departure_time) details.push(`<div class="heroInfoItem"><span>SAÍDA</span><strong>${esc(trip.departure_time)}</strong></div>`);
    if(fixed&&trip) details.push(`<div class="heroInfoItem heroInfoSpots"><span>VAGAS DISPONÍVEIS</span><strong>${remaining}</strong></div>`);

    return `<section class="publicHero">
      <div class="publicHeroGlow"></div>
      <div class="publicHeroInner">
        <div class="publicHeroContent">
          <span class="publicEyebrow">CONFIRMAÇÃO DE PARTICIPAÇÃO</span>
          <p class="publicKicker">Você está se cadastrando para</p>
          <h1>${esc(name)}</h1>
          <p class="publicHeroText">Confirme sua reserva em poucos passos. Informe o responsável, cadastre todos os acompanhantes e revise tudo antes de enviar.</p>
          ${details.length?`<div class="heroInfoGrid">${details.join('')}</div>`:''}
        </div>
        <div class="publicHeroSeal">
          <span class="sealIcon">✓</span>
          <div><strong>Cadastro guiado</strong><small>Você + acompanhantes, com revisão antes da confirmação</small></div>
        </div>
      </div>
    </section>`;
  }

  registration=async function(id=''){
    app.innerHTML=`<main class="publicPage"><header class="publicTop"><div class="publicTopInner">${publicLogo()}${id?'':`<a class="publicAdminLink" href="/admin">Área administrativa</a>`}</div></header><div id="publicHeroMount"><section class="publicHero publicHeroLoading"><div class="publicHeroInner"><div class="publicHeroContent"><span class="publicEyebrow">TRILHEIROS DE RONDONÓPOLIS</span><h1>Preparando seu cadastro...</h1></div></div></section></div><section class="card publicFormCard"><div class="empty">Carregando informações do passeio...</div></section><div class="publicTrust"><span>✓ Cadastro guiado</span><span>✓ Revisão antes de enviar</span><span>✓ Você + acompanhantes</span></div><footer class="publicFooter"><strong>Trilheiros de Rondonópolis</strong><span>Natureza, segurança e experiências para guardar na memória.</span></footer></main>`;
    try{
      await ensureAnon();
      let trips;
      if(id){
        const s=await db.collection('trips').doc(id).get();
        trips=s.exists?[{id:s.id,...s.data()}]:[];
      }else{
        trips=await getTrips();
      }
      if(!trips.length){
        $('#publicHeroMount').innerHTML=publicHero(null,false);
        $('.publicFormCard').innerHTML=`<div class="empty publicEmpty"><div class="emptyIcon">⛰</div><h3>Nenhum passeio disponível</h3><p>Este cadastro pode estar encerrado ou as vagas podem ter acabado.</p></div>`;
        return;
      }
      $('#publicHeroMount').innerHTML=publicHero(trips[0],!!id);
      renderRegistration(trips,id);
      $('.publicFormCard')?.classList.add('isReady');

      if(!id){
        const select=document.querySelector('#reg select[name="trip"]');
        if(select){
          const refreshHero=()=>{
            const chosen=trips.find(t=>t.id===select.value)||trips[0];
            $('#publicHeroMount').innerHTML=publicHero(chosen,false);
          };
          select.addEventListener('change',()=>setTimeout(refreshHero,0));
        }
      }
    }catch(e){
      $('#publicHeroMount').innerHTML=publicHero(null,false);
      $('.publicFormCard').innerHTML=`<div class="empty publicEmpty"><div class="emptyIcon">!</div><h3>Cadastro indisponível</h3><p>${esc(e.message)}</p></div>`;
    }
  };
})();
