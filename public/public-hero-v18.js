/* Trilheiros de Rondonópolis — Hero do cadastro V18 */
(function(){
  const normalize=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

  function cityFor(name,current){
    const n=normalize(name);
    if(n.includes('salto das nuvens'))return 'Tangará da Serra - MT';
    const c=String(current||'').trim();
    if(c&&normalize(c)!=='trilheiros de rondonopolis')return c;
    return 'Mato Grosso';
  }

  function patchHero(){
    const hero=document.querySelector('.v17Hero');
    if(!hero||hero.dataset.v18==='1')return;
    const main=hero.firstElementChild;
    const title=main?.querySelector('h1');
    const place=main?.querySelector('p');
    const info=hero.querySelector('.v17HeroInfo');
    if(!main||!title||!place||!info)return;

    const city=cityFor(title.textContent,place.textContent);
    const kicker=main.querySelector(':scope > span');
    if(kicker)kicker.textContent='PASSEIO';
    place.classList.add('v18Destination');
    place.innerHTML=`<span>📍</span><strong>${city}</strong>`;

    const badges=[...info.querySelectorAll('b')];
    badges.forEach(b=>{
      const text=b.textContent.trim();
      if(/vaga/i.test(text)){
        const count=(text.match(/(\d+)/)||[])[1]||'0';
        b.classList.add('v18Vacancy');
        b.innerHTML=`<span>VAGAS DISPONÍVEIS</span><strong>${count}</strong>`;
      }else if(/📅/.test(text)){
        const value=text.replace('📅','').trim();
        b.classList.add('v18Date');
        b.innerHTML=`<span>DATA</span><strong>${value}</strong>`;
      }else if(/🕒/.test(text)){
        const value=text.replace('🕒','').trim();
        b.classList.add('v18Time');
        b.innerHTML=`<span>SAÍDA</span><strong>${value}</strong>`;
      }
    });

    main.classList.add('v18HeroMain');
    info.classList.add('v18HeroInfo');
    hero.dataset.v18='1';
  }

  if(!location.pathname.startsWith('/admin')){
    let queued=false;
    const observer=new MutationObserver(()=>{
      if(queued)return;
      queued=true;
      requestAnimationFrame(()=>{queued=false;patchHero()});
    });
    observer.observe(document.documentElement,{subtree:true,childList:true});
  }
  window.addEventListener('load',patchHero);
  setTimeout(patchHero,250);
})();
