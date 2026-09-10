/* Trilheiros — Portal de Reservas V26
   Portal premium integrado ao Trilheiros Gestão.
   Cliente preenche uma vez; PIX/cartão inicia reserva e o passeio é autocriado no Gestão quando necessário.
*/
(function(){
  'use strict';

  const LOGO='https://i.postimg.cc/JnF2F9Hw/LOGO-TRILHEIROS-Photoroom.png';
  const PIX_KEY='trilheiros.roomt@gmail.com';
  const WHATSAPP='5566996926174';
  const DATE_HINTS={
    chapada_guimaraes:'2026-09-26',
    salto_nuvens:'2026-10-10',
    nobres_bom_jardim:'2026-10-24',
    rio_cristalino:'2026-11-08',
    jaciara_canyon:'2026-11-15'
  };
  const NAME_ALIASES={
    chapada_guimaraes:['chapada dos guimaraes','chapada guimaraes'],
    salto_nuvens:['salto das nuvens','saltos das nuvens','salto nuvens'],
    nobres_bom_jardim:['nobres bom jardim','nobres','bom jardim'],
    rio_cristalino:['rio cristalino aldeia dom bosco','rio cristalino','aldeia dom bosco'],
    jaciara_canyon:['jaciara canion das indias','canion das indias','jaciara canion']
  };

  const trips=[
    {
      id:'chapada_guimaraes',name:'Chapada dos Guimarães',location:'Chapada dos Guimarães – MT',icon:'🌄',
      banner:'https://files.catbox.moe/n9mixf.png',
      description:'Chegou a oportunidade de conhecer um dos destinos mais incríveis de Mato Grosso em um final de semana repleto de natureza, aventura e paisagens inesquecíveis.\n\n🌄 Mirante do Morro dos Ventos\n📸 Mirante Geodésico\n💦 Circuito das Cachoeiras',
      cardDescription:'Explore os Mirantes do Morro dos Ventos e Geodésico, além do Circuito das Cachoeiras em um final de semana de pura natureza e aventura.',
      price:'A partir de R$ 375,00',date:'26 e 27 de Setembro',departure:'Sexta-feira (25 de setembro) às 13:00',
      departureLocation:'Rondonópolis – MT',return:'Domingo (27 de setembro) às 15:00',vacancies:40,
      includes:['Transporte ida e volta','Hospedagem conforme opção escolhida','Almoço domingo','Café da manhã domingo','Seguro de vida'],
      notIncludes:['Jantar','Barraca','Colchão'],paymentType:'accommodation',paymentMethods:['pix','card'],
      accommodations:{
        compartilhado:{pix:415,card:425,mpLinks:{'1':'https://mpago.li/2iYxQBs'}},
        casal_sem_banheiro:{pix:759,card:769,mpLinks:{'1':'https://mpago.li/2CxfzhM'}},
        casal_com_banheiro:{pix:800,card:815,mpLinks:{'1':'https://mpago.li/29k5oqg'}},
        camping:{pix:375,card:389,mpLinks:{'1':'https://mpago.li/1DhBcxg','2':'https://mpago.li/16EAfiU'}}
      }
    },
    {
      id:'salto_nuvens',name:'Salto das Nuvens',location:'Tangará da Serra – MT',icon:'🏞️',
      banner:'https://i.postimg.cc/pTz7GsCN/Chat-GPT-Image-4-de-ago-de-2026-13-30-53.png',
      description:'🌊 UM DOS LUGARES MAIS INCRÍVEIS DE MATO GROSSO ESTÁ TE ESPERANDO!\n\nConheça o incrível Salto das Nuvens, em Tangará da Serra.\n\nUma gigantesca queda d\'água, natureza exuberante e uma experiência inesquecível.',
      cardDescription:'Uma gigantesca queda d\'água, natureza exuberante e uma experiência inesquecível em Tangará da Serra.',
      price:'A partir de R$ 520,00',date:'Sábado, 10 de Outubro',departure:'04:00',departureLocation:'Rondonópolis – MT',vacancies:45,
      includes:['Transporte','Café da manhã','Entrada no Salto das Nuvens','Seguro de vida'],
      notIncludes:['Almoço (O local possui restaurante com diversas opções)'],paymentType:'accommodation',paymentMethods:['pix','pix_parcelado','card'],
      accommodations:{
        adulto:{pix:520,card:539,mpLinks:{'1':'https://mpago.li/1ynW2Rn'}},
        casal:{pix:990,card:1029,mpLinks:{'1':'https://mpago.li/1m1KsPr'}}
      }
    },
    {
      id:'nobres_bom_jardim',name:'🌊 Nobres – Bom Jardim',location:'Nobres – MT / Bom Jardim – MT',icon:'💧',
      banner:'https://i.postimg.cc/X7HGQJ1b/Chat-GPT-Image-29-de-jul-de-2026-12-42-20.png',
      description:'Conheça um dos destinos de águas cristalinas mais incríveis do Brasil.\n\n💧 Experimente as piscinas naturais de águas cristalinas em um ambiente paradisíaco.\n\n🏖️ Desfrute de dois dias completos explorando as belezas naturais de Nobres e Bom Jardim.',
      cardDescription:'Descubra as águas cristalinas mais incríveis do Brasil em Nobres e Bom Jardim.',
      price:'A partir de R$ 890,00',date:'24 e 25 de Outubro',departure:'24/10 às 05:00',departureLocation:'Rondonópolis – MT',
      return:'25/10 após o término dos passeios',vacancies:35,
      includes:['2 Passeios','Transporte ida e volta','Hospedagem','Café da manhã (Domingo)','Almoço (Sábado)','Almoço (Domingo)'],
      notIncludes:['Café da manhã de sábado','Jantar de sábado'],paymentType:'accommodation',paymentMethods:['pix','pix_parcelado','card'],
      accommodations:{
        compartilhado:{pix:890,card:910,mpLinks:{'1':'https://mpago.li/2aipqTH','2':'https://mpago.li/2aipqTH'}},
        casal:{pix:1600,card:1700,mpLinks:{'1':'https://mpago.li/2bvSSKm','2':'https://mpago.li/2bvSSKm'}}
      }
    },
    {
      id:'rio_cristalino',name:'🌿 Rio Cristalino + Aldeia Dom Bosco',location:'Aldeia Dom Bosco – Poxoréu/MT',icon:'💧',
      banner:'https://i.postimg.cc/dQSQccVT/Chat-GPT-Image-21-de-ago-de-2026-10-40-01.png',
      description:'Prepare-se para conhecer as águas cristalinas do Rio Cristalino e viver uma experiência especial de contato com a natureza e a cultura Xavante.\n\n🌊 Natureza, aventura, águas cristalinas e cultura em um único passeio!\n\n❤️ Uma oportunidade para sair da rotina, conhecer um lugar incrível e criar memórias especiais.',
      cardDescription:'Vivencie as águas cristalinas do Rio Cristalino e a cultura Xavante em uma experiência única.',
      price:'A partir de R$ 355,00',date:'08 de Novembro',departure:'05:00',departureLocation:'Rondonópolis – MT',distance:'Aproximadamente 210 km',vacancies:35,
      includes:['Seguro de vida','Transporte ida e volta','Condutor local','Visitação cultural Xavante'],notIncludes:['Alimentação','Bebidas'],
      paymentType:'standard',paymentMethods:['pix','pix_parcelado','card'],childrenPrice:300,
      childrenInfo:'Para reservas com crianças, consulte o valor diretamente pelo WhatsApp.',pix:355,card:369,
      mpLinks:{'1':'https://mpago.li/28tP6cf','2':'https://mpago.li/1vsHMsg'}
    },
    {
      id:'jaciara_canyon',name:'🌿 Jaciara – Cânion das Índias',location:'Jaciara – MT',icon:'🥾',
      banner:'https://i.postimg.cc/CLxJShnV/Chat-GPT-Image-24-de-ago-de-2026-08-43-36.png',
      description:'Prepare-se para viver um dia de muita aventura no incrível Cânion das Índias! 🥾🔥\n\nCachoeiras, cânions, águas cristalinas e muita natureza em um passeio perfeito para sair da rotina e viver uma experiência inesquecível! 😍🌳',
      cardDescription:'Cachoeiras, cânions, águas cristalinas e muita natureza em um passeio perfeito para sair da rotina.',
      price:'A partir de R$ 365,00',date:'15 de Novembro',departure:'05:00',departureLocation:'Rondonópolis – MT',vacancies:40,
      includes:['Transporte','Almoço','Perneiras de segurança','Seguro de vida','Day Use'],notIncludes:['Bebidas'],
      paymentType:'standard',paymentMethods:['pix','pix_parcelado','card'],pix:365,card:389,
      mpLinks:{'1':'https://mpago.li/15cwN4m','2':'https://mpago.li/18b8EcD'}
    }
  ];

  let db=null,auth=null,currentTrip=null,currentCommitted=false,toastTimer=null,lastResult=null;
  const $=s=>document.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v||0));
  const digits=v=>String(v||'').replace(/\D/g,'');
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
  const stop=new Set(['de','da','do','das','dos','e','mt']);
  const tokens=v=>norm(v).split(' ').filter(x=>x.length>2&&!stop.has(x));
  const serverNow=()=>firebase.firestore.FieldValue.serverTimestamp();
  const paymentText={pix:'PIX',pix_parcelado:'PIX Parcelado',card:'Cartão de Crédito'};
  const publicTripId=t=>t.id;

  function toast(message,type=''){
    const el=$('#toast');if(!el)return;
    clearTimeout(toastTimer);el.textContent=message;el.className='toast show'+(type==='error'?' error':'');
    toastTimer=setTimeout(()=>el.className='toast',4200);
  }
  function icons(){try{window.lucide?.createIcons()}catch(_){}}
  function protocol(){return `TR-${new Date().getFullYear()}-${Math.random().toString(36).slice(2,8).toUpperCase()}`}
  function validCPF(value){
    const n=digits(value);if(n.length!==11||/^(\d)\1{10}$/.test(n))return false;
    let s=0;for(let i=0;i<9;i++)s+=Number(n[i])*(10-i);let d=(s*10)%11;if(d===10)d=0;if(d!==Number(n[9]))return false;
    s=0;for(let i=0;i<10;i++)s+=Number(n[i])*(11-i);d=(s*10)%11;if(d===10)d=0;return d===Number(n[10]);
  }
  function cpfMask(value){
    const n=digits(value).slice(0,11);
    return n.replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d{1,2})$/,'$1-$2');
  }
  function optionLabel(key){
    return ({compartilhado:'Quarto Compartilhado',casal:'Casal (2 pessoas)',casal_sem_banheiro:'Quarto Casal (Sem Banheiro)',casal_com_banheiro:'Quarto Casal (Com Banheiro)',camping:'Camping',adulto:'Adulto'})[key]||key.replaceAll('_',' ');
  }
  function installmentCount(t){
    if(!t)return 1;
    if(t.id==='salto_nuvens'||t.id==='nobres_bom_jardim')return 2;
    if(t.id==='rio_cristalino'||t.id==='jaciara_canyon')return 3;
    return 1;
  }
  function effectiveRemaining(t){
    const d=t?._managed;
    if(!d)return Math.max(0,Number(t?.vacancies||0)-1);
    const total=Math.max(0,Number(d.total_spots||0)),used=Math.max(0,Number(d.used_spots||0)),raw=Math.max(0,Number(d.remaining_spots||0));
    if(!total)return raw;
    const guideCounted=d.special_seat_reserved===true||d.special_seat_counted===true;
    return Math.max(0,Math.min(raw,total-used-(guideCounted?0:1)));
  }
  function cardRemaining(t){return effectiveRemaining(t)}

  function matchManagedTrip(local,docs){
    const aliases=(NAME_ALIASES[local.id]||[local.name]).map(norm),hint=DATE_HINTS[local.id];
    let best=null,bestScore=-1;
    for(const d of docs){
      if(d.status&&d.status!=='open')continue;
      const candidate=norm(`${d.name||''} ${d.destination||''}`),ct=new Set(tokens(candidate));
      let score=0;
      if(d.id===local.id)score+=100;
      if(hint&&String(d.trip_date||'').slice(0,10)===hint)score+=35;
      for(const a of aliases){
        if(candidate===a)score=Math.max(score,90);
        else if(candidate.includes(a)||a.includes(candidate))score=Math.max(score,65);
      }
      const lt=tokens(local.name);
      if(lt.length){const hits=lt.filter(x=>ct.has(x)).length;score+=Math.round((hits/lt.length)*45)}
      if(score>bestScore){bestScore=score;best=d}
    }
    return bestScore>=45?best:null;
  }

  async function waitFirebase(){
    for(let i=0;i<90;i++){
      if(window.firebase?.apps?.length){db=firebase.firestore();auth=firebase.auth();return true}
      await new Promise(r=>setTimeout(r,100));
    }
    return false;
  }
  async function ensureAnon(){
    if(auth.currentUser)return auth.currentUser;
    const c=await auth.signInAnonymously();return c.user;
  }
  async function loadManagedTrips(){
    if(!db)return;
    try{
      const snap=await db.collection('trips').get();
      const docs=snap.docs.map(x=>({id:x.id,...x.data()}));
      trips.forEach(t=>{t._managed=matchManagedTrip(t,docs)});
      const note=$('#syncNote');
      if(note)note.innerHTML='<span class="syncDot"></span><span>Vagas atualizadas em tempo real</span>';
      renderTrips();
    }catch(e){
      console.error(e);const note=$('#syncNote');if(note)note.innerHTML='<span>⚠️ Não foi possível atualizar as vagas agora.</span>';renderTrips();
    }
  }

  function setupReveal(){
    const cards=[...document.querySelectorAll('.tripCard')];
    if(!('IntersectionObserver' in window)){cards.forEach(x=>x.classList.add('revealIn'));return}
    const io=new IntersectionObserver(entries=>{
      entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('revealIn');io.unobserve(e.target)}})
    },{threshold:.12});
    cards.forEach((card,i)=>{card.style.setProperty('--delay',`${Math.min(i*70,350)}ms`);io.observe(card)});
  }
  function renderTrips(){
    const grid=$('#tripGrid');if(!grid)return;
    grid.innerHTML=trips.map(t=>{
      const rem=cardRemaining(t),sold=rem<=0,low=rem>0&&rem<=5;
      return `<article class="tripCard ${sold?'soldout':''}">
        <div class="tripBanner"><img src="${esc(t.banner||LOGO)}" alt="${esc(t.name)}" loading="lazy"></div>
        <div class="tripBody">
          <div class="tripMeta"><span>${esc(t.icon||'🌿')}</span><span>${esc(t.date)}</span></div>
          <h3 class="tripTitle">${esc(t.name)}</h3>
          <p class="tripDescription">${esc(t.cardDescription||t.description||'')}</p>
          <div class="tripBottom"><div class="tripPrice"><small>VALOR</small><strong>${esc(t.price)}</strong></div><div class="vacancy ${sold?'zero':low?'low':''}"><small>VAGAS DISPONÍVEIS</small><strong>${sold?'LOTADO':rem}</strong></div></div>
          <button class="tripBtn" data-trip="${t.id}" ${sold?'disabled':''}>${sold?'TODAS AS VAGAS PREENCHIDAS':'VER DETALHES E RESERVAR'}</button>
        </div>
      </article>`
    }).join('');
    grid.querySelectorAll('[data-trip]').forEach(b=>b.onclick=()=>openTrip(b.dataset.trip));
    setupReveal();icons();
  }

  function optionSelect(t){
    if(t.paymentType!=='accommodation')return'';
    const rows=Object.keys(t.accommodations||{}).map(k=>`<option value="${esc(k)}">${esc(optionLabel(k))}</option>`).join('');
    return `<div class="formSection"><label>${t.id==='salto_nuvens'?'Escolha sua opção':'Tipo de hospedagem'}</label><select class="select" id="accommodation"><option value="">Selecione</option>${rows}</select></div>`;
  }
  function paymentOptions(t){
    const methods=(t.paymentMethods||['pix','card']).filter(x=>x!=='pix_parcelado'||installmentCount(t)>1);
    return `<option value="">Selecione</option>${methods.map(x=>`<option value="${x}">${x==='pix'?'💚 PIX':x==='pix_parcelado'?'💚 PIX Parcelado':'💳 Cartão de Crédito'}</option>`).join('')}`;
  }
  function infoBox(t){
    return `<article class="detailInfo"><div class="detailBanner"><img src="${esc(t.banner||LOGO)}" alt="${esc(t.name)}"></div><div class="detailCopy">
      <span class="eyebrow">${esc(t.location)}</span><h2>${esc(t.name)}</h2><p>${esc(t.description||t.cardDescription||'')}</p>
      <div class="infoChips"><div class="infoChip"><small>DATA</small><b>${esc(t.date)}</b></div><div class="infoChip"><small>SAÍDA</small><b>${esc(t.departure||'A confirmar')}</b></div>${t.return?`<div class="infoChip"><small>RETORNO</small><b>${esc(t.return)}</b></div>`:''}<div class="infoChip"><small>VAGAS DISPONÍVEIS</small><b>${cardRemaining(t)}</b></div></div>
      <div class="included"><div class="includedBox"><h4>✅ O que está incluído</h4>${(t.includes||[]).map(x=>`<p>• ${esc(x)}</p>`).join('')}</div><div class="includedBox no"><h4>❌ Não incluso</h4>${(t.notIncludes||[]).map(x=>`<p>• ${esc(x)}</p>`).join('')||'<p>Consulte as informações do passeio.</p>'}</div></div>
    </div></article>`;
  }
  function openTrip(id){
    currentTrip=trips.find(t=>t.id===id);currentCommitted=false;lastResult=null;if(!currentTrip)return;
    $('#hero').style.display='none';$('#tripListSection').hidden=true;
    const detail=$('#tripDetail');detail.hidden=false;
    const rem=cardRemaining(currentTrip);
    detail.innerHTML=`<div class="detailTop"><button class="backBtn" id="backTrips">← Voltar para passeios</button><span class="liveBadge">● ${rem} vaga${rem===1?'':'s'} disponível${rem===1?'':'is'}</span></div>
      <div class="detailGrid">${infoBox(currentTrip)}<article class="bookingCard">${rem<=0?`<div class="soldoutPanel"><span>🔒</span><h3>Todas as vagas preenchidas</h3><p>Este passeio atingiu a lotação. Assim que uma vaga for liberada, a reserva volta a ficar disponível.</p><button class="bottomBackBtn" id="soldBack">← Voltar aos passeios</button></div>`:bookingForm(currentTrip,rem)}</article></div>`;
    $('#backTrips').onclick=backTrips;
    $('#soldBack')?.addEventListener('click',backTrips);
    if(rem>0)bindForm();
    window.scrollTo({top:0,behavior:'instant'});icons();
  }
  function bookingForm(t,rem){
    const max=Math.min(10,Math.max(1,rem));
    const qty=Array.from({length:max},(_,i)=>`<option value="${i+1}">${i+1} vaga${i?'s':''}</option>`).join('');
    return `<div class="bookingHead"><span>RESERVA ONLINE</span><h3>Faça sua reserva</h3><p>Preencha seus dados, escolha a forma de pagamento e finalize em poucos passos.</p></div>
      <form id="bookingForm" novalidate>
        ${optionSelect(t)}
        <div class="formSection"><label>Quantidade de vagas</label><select class="select" id="quantity"><option value="">Selecione</option>${qty}</select></div>
        <div class="formSection"><label>Nome completo do responsável</label><input class="field" id="responsibleName" autocomplete="name" placeholder="Digite o nome completo"></div>
        <div class="formSection"><label>E-mail do responsável</label><input class="field" id="responsibleEmail" type="email" autocomplete="email" placeholder="seu@email.com"></div>
        <div class="formSection" id="participantsSection" hidden><label>Participantes</label><div class="participantsBox" id="participantsBox"></div></div>
        <div class="formSection"><label>Forma de pagamento</label><select class="select" id="paymentMethod">${paymentOptions(t)}</select></div>
        <div id="summary"></div><div id="paymentBox"></div>
        <label class="policy"><input type="checkbox" id="policyAccepted"><span>Confirmo que os dados informados estão corretos e aceito a política de cancelamento do passeio.</span></label>
        <div id="commitResult"></div>
        <div class="bookingFooterActions">
          <button type="button" class="whatsappBtn" id="receiptWhatsapp"><span>💬</span> ENVIAR COMPROVANTE PELO WHATSAPP</button>
          <button type="button" class="bottomBackBtn" id="bottomBack">← Voltar aos passeios</button>
        </div>
      </form>`;
  }
  function backTrips(){
    currentTrip=null;currentCommitted=false;lastResult=null;
    $('#tripDetail').hidden=true;$('#tripListSection').hidden=false;$('#hero').style.display='flex';
    window.scrollTo({top:0,behavior:'smooth'});loadManagedTrips();
  }

  function bindForm(){
    const q=$('#quantity'),acc=$('#accommodation'),pm=$('#paymentMethod'),name=$('#responsibleName'),email=$('#responsibleEmail');
    if(acc)acc.onchange=()=>{
      if(['casal','casal_sem_banheiro','casal_com_banheiro'].includes(acc.value))q.value='2';
      updateParticipants();updatePriceUI();
    };
    q.onchange=()=>{
      if(acc&&['casal','casal_sem_banheiro','casal_com_banheiro'].includes(acc.value))q.value='2';
      updateParticipants();updatePriceUI();
    };
    pm.onchange=updatePriceUI;
    name.oninput=()=>{syncFirstParticipant();updateSummary()};
    email.oninput=updateSummary;
    $('#bottomBack').onclick=backTrips;
    $('#receiptWhatsapp').onclick=sendReceiptWhatsapp;
  }
  function updateParticipants(){
    const qty=Number($('#quantity')?.value||0),box=$('#participantsBox'),section=$('#participantsSection');if(!box||!section)return;
    const old=[...box.querySelectorAll('.participantRow')].map(r=>({name:r.querySelector('.pName')?.value||'',cpf:r.querySelector('.pCpf')?.value||''}));
    section.hidden=qty<1;box.innerHTML='';
    for(let i=0;i<qty;i++){
      const row=document.createElement('div');row.className='participantRow';
      row.innerHTML=`<strong>PARTICIPANTE ${i+1}</strong><div class="participantInputs"><input class="field pName" data-i="${i}" placeholder="Nome completo" value="${esc(old[i]?.name||'')}"><input class="field pCpf" data-i="${i}" inputmode="numeric" maxlength="14" placeholder="000.000.000-00" value="${esc(old[i]?.cpf||'')}"></div>`;
      box.appendChild(row);
    }
    box.querySelectorAll('.pName').forEach(x=>x.oninput=updateSummary);
    box.querySelectorAll('.pCpf').forEach(x=>x.oninput=e=>{e.target.value=cpfMask(e.target.value);updateSummary()});
    syncFirstParticipant();updatePriceUI();
  }
  function syncFirstParticipant(){
    const first=$('.pName'),name=$('#responsibleName');
    if(first&&name&&!first.dataset.edited){
      if(!first.value||first.value===first.dataset.auto||!first.dataset.auto){first.value=name.value;first.dataset.auto=name.value}
    }
    if(first&&!first.dataset.bound){first.addEventListener('input',()=>first.dataset.edited='1');first.dataset.bound='1'}
  }
  function selectedPriceData(){
    const t=currentTrip,qty=Number($('#quantity')?.value||0),pm=$('#paymentMethod')?.value||'';if(!t||!qty||!pm)return null;
    let total=0,link='',option='',unit=0;
    if(t.paymentType==='accommodation'){
      const key=$('#accommodation')?.value||'';if(!key)return null;
      const p=t.accommodations?.[key];if(!p)return null;
      option=optionLabel(key);
      const price=pm==='card'?Number(p.card||0):Number(p.pix||0);
      const couple=['casal','casal_sem_banheiro','casal_com_banheiro'].includes(key);
      unit=price;total=couple?price:price*qty;
      if(pm==='card'){const k=couple?'1':String(qty);link=p.mpLinks?.[k]||''}
    }else{
      const price=pm==='card'?Number(t.card||0):Number(t.pix||0);
      unit=price;total=price*qty;if(pm==='card')link=t.mpLinks?.[String(qty)]||'';
    }
    if(total<=0)return null;
    return {total,link,option,unit,qty,pm};
  }
  function updateSummary(){
    const s=selectedPriceData(),sum=$('#summary');if(!sum)return;
    if(!s){sum.innerHTML='';return}
    const n=$('#responsibleName')?.value.trim()||'—',pm=paymentText[s.pm]||s.pm;
    sum.innerHTML=`<div class="summary"><div class="summaryRow"><span>Passeio</span><b>${esc(currentTrip.name)}</b></div>${s.option?`<div class="summaryRow"><span>Opção</span><b>${esc(s.option)}</b></div>`:''}<div class="summaryRow"><span>Responsável</span><b>${esc(n)}</b></div><div class="summaryRow"><span>Quantidade</span><b>${s.qty} vaga${s.qty===1?'':'s'}</b></div><div class="summaryRow"><span>Pagamento</span><b>${esc(pm)}</b></div><div class="summaryTotal"><span>VALOR TOTAL</span><strong>${money(s.total)}</strong></div></div>`;
  }
  function updatePriceUI(){
    updateSummary();const box=$('#paymentBox'),s=selectedPriceData();if(!box)return;
    if(!s){box.innerHTML='';return}
    if(s.pm==='pix'||s.pm==='pix_parcelado'){
      const count=s.pm==='pix_parcelado'?installmentCount(currentTrip):1;
      box.innerHTML=`<div class="paymentBox premiumPayment"><div class="payIcon">◇</div><h4>${s.pm==='pix'?'Pagamento via PIX':`PIX Parcelado em ${count}x`}</h4>${s.pm==='pix_parcelado'?`<p>${count} parcelas de aproximadamente <strong>${money(s.total/count)}</strong>.</p>`:'<p>Pagamento rápido e seguro via PIX.</p>'}<button type="button" class="payBtn" id="startPix">${s.pm==='pix'?'COPIAR PIX':'COPIAR PIX DA PARCELA'}</button><small class="paymentHint">A chave será copiada automaticamente.</small></div>`;
      $('#startPix').onclick=()=>startPayment('pix');
    }else{
      box.innerHTML=`<div class="paymentBox premiumPayment"><div class="payIcon">▣</div><h4>Pagamento com cartão</h4><p>${s.link?'Clique para abrir o pagamento com cartão.':'Para esta quantidade, solicite o link correto pelo WhatsApp.'}</p><button type="button" class="payBtn ${s.link?'':'secondaryPay'}" id="startCard">${s.link?'PAGAR COM CARTÃO':'SOLICITAR LINK DE CARTÃO'}</button></div>`;
      $('#startCard').onclick=()=>startPayment(s.link?'card':'request_card');
    }
  }

  function collectData(){
    const s=selectedPriceData(),name=$('#responsibleName')?.value.trim()||'',email=$('#responsibleEmail')?.value.trim()||'',qty=Number($('#quantity')?.value||0),policy=$('#policyAccepted')?.checked;
    if(!name||name.split(/\s+/).length<2)throw Error('Informe o nome completo do responsável.');
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('Informe um e-mail válido.');
    if(!qty||qty<1)throw Error('Selecione a quantidade de vagas.');
    if(!s)throw Error('Selecione a opção e a forma de pagamento.');
    if(!policy)throw Error('Marque a confirmação dos dados e da política de cancelamento.');
    const names=[...document.querySelectorAll('.pName')],cpfs=[...document.querySelectorAll('.pCpf')];
    if(names.length!==qty||cpfs.length!==qty)throw Error('Confira os participantes da reserva.');
    const participants=[];
    for(let i=0;i<qty;i++){
      const full_name=names[i].value.trim(),cpf=cpfMask(cpfs[i].value);
      if(!full_name)throw Error(`Informe o nome do participante ${i+1}.`);
      if(!validCPF(cpf))throw Error(`CPF inválido no participante ${i+1}.`);
      participants.push({full_name,cpf});
    }
    return {s,name,email,qty,participants,responsibleCpf:participants[0]?.cpf||''};
  }

  function autoTripData(t,qty,now){
    const total=Math.max(2,Number(t.vacancies||0)),used=1+qty;
    return {
      portal_template_id:t.id,
      name:t.name,
      destination:t.location,
      trip_date:DATE_HINTS[t.id]||'',
      departure_time:t.departure||'',
      total_spots:total,
      used_spots:used,
      remaining_spots:Math.max(0,total-used),
      status:'open',
      default_price:Number(t.pix||0)||Number(Object.values(t.accommodations||{})[0]?.pix||0)||0,
      estimated_cost:0,
      receivable:0,
      cancellation_policy:'',
      registration_options:{},
      checklist:{},
      special_seat_reserved:true,
      special_seat_counted:true,
      special_seat_count:1,
      special_passenger_name:'Jonatas Marques de Arruda',
      special_passenger_role:'GUIA DE TURISMO',
      source:'public_portal_v26_auto',
      created_at:now,
      updated_at:now
    };
  }

  async function createPortalSale(trigger,data){
    if(currentCommitted&&lastResult)return lastResult;
    const user=await ensureAnon(),uid=user.uid,t=currentTrip,mg=t._managed;
    const tripId=mg?.id||publicTripId(t),tripRef=db.collection('trips').doc(tripId),saleRef=db.collection('sales').doc(uid),resRef=tripRef.collection('reservations').doc(uid);
    const code=protocol(),method=data.s.pm==='pix_parcelado'?'pix_installment':data.s.pm,inst=data.s.pm==='pix_parcelado'?installmentCount(t):1;
    let result=null;
    await db.runTransaction(async tx=>{
      const tripSnap=await tx.get(tripRef),saleSnap=await tx.get(saleRef),resSnap=await tx.get(resRef);
      if(saleSnap.exists||resSnap.exists){
        const oldSale=saleSnap.exists?saleSnap.data():null;
        if(oldSale&&oldSale.trip_id===tripId&&oldSale.sale_status!=='cancelled'){
          result={saleId:uid,protocol:oldSale.protocol||code,reused:true,tripId};return;
        }
        throw Error('Esta sessão já possui uma reserva. Volte aos passeios e inicie uma nova reserva.');
      }

      const now=serverNow();
      let live,used,raw,total;
      if(!tripSnap.exists){
        const created=autoTripData(t,data.qty,now);
        total=created.total_spots;used=created.used_spots;raw=created.remaining_spots;live=created;
        tx.set(tripRef,created);
      }else{
        live=tripSnap.data();
        if(live.status!=='open')throw Error('Este passeio não está aberto para novas reservas.');
        total=Math.max(0,Number(live.total_spots||0));
        used=Math.max(0,Number(live.used_spots||0));
        raw=Math.max(0,Number(live.remaining_spots||0));
        const guideCounted=live.special_seat_reserved===true||live.special_seat_counted===true;
        const available=total?Math.max(0,Math.min(raw,total-used-(guideCounted?0:1))):raw;
        if(available<data.qty)throw Error(available<=0?'Todas as vagas foram preenchidas.':`Restam somente ${available} vaga(s).`);
      }

      const category=data.s.option||'',answers={
        origem:{label:'Origem',value:'Reserva de Passeios'},
        pagamento:{label:'Forma de pagamento',value:paymentText[data.s.pm]||data.s.pm},
        opcao:{label:'Opção',value:category||'Padrão'}
      };
      const sale={
        trip_id:tripId,trip_name:live.name||t.name,trip_date:live.trip_date||DATE_HINTS[t.id]||'',
        customer_name:data.name,customer_cpf:data.responsibleCpf,customer_email:data.email,
        seats:data.qty,sale_total:data.s.total,paid_amount:0,balance_due:data.s.total,refunded_amount:0,
        payment_method:method,payment_status:'pending',installment_total:inst,next_due_date:'',
        payment_history:[],received_date:'',registration_status:'completed',registered_at:now,
        sale_status:'active',claimed_uid:uid,protocol:code,accommodation:'',accommodation_mode:'none',
        category,category_mode:category?'fixed':'none',participants:data.participants,
        notes:'Reserva online iniciada pelo cliente.',source:'public_portal_v26',
        payment_trigger:trigger,payment_started_at:now,created_at:now,updated_at:now
      };
      const reservation={
        protocol:code,sale_id:uid,responsible_name:data.name,responsible_cpf:data.responsibleCpf,email:data.email,
        seats:data.qty,participants:data.participants,registration_answers:answers,accommodation:'',category,
        status:'active',registration_status:'completed',payment_status:'pending',payment_method:method,
        paid_amount:0,sale_total:data.s.total,balance_due:data.s.total,refunded_amount:0,
        installment_total:inst,next_due_date:'',policy_text:live.cancellation_policy||'',
        policy_version:'2026-09-public-v26',policy_accepted:true,policy_accepted_at:now,
        source:'public_portal_v26',payment_trigger:trigger,created_at:now,updated_at:now
      };
      tx.set(saleRef,sale);tx.set(resRef,reservation);
      if(tripSnap.exists)tx.update(tripRef,{used_spots:used+data.qty,remaining_spots:raw-data.qty,updated_at:now});
      result={saleId:uid,protocol:code,reused:false,tripId};
    });
    currentCommitted=true;lastResult=result;window.__portalLastResult=result;
    currentTrip._managed={id:result.tripId,name:currentTrip.name,status:'open'};
    return result;
  }

  function beginClipboardCopy(){
    let promise=null,legacy=false;
    try{
      if(navigator.clipboard&&window.isSecureContext){
        promise=navigator.clipboard.writeText(PIX_KEY);
      }else{
        const ta=document.createElement('textarea');
        ta.value=PIX_KEY;ta.setAttribute('readonly','');ta.style.position='fixed';ta.style.left='-9999px';ta.style.top='0';
        document.body.appendChild(ta);ta.focus();ta.select();legacy=document.execCommand('copy');ta.remove();
      }
    }catch(_){}
    return {promise,legacy};
  }
  async function finishClipboardCopy(job){
    if(job?.promise){try{await job.promise;return true}catch(_){}}
    if(job?.legacy)return true;
    try{
      const input=document.createElement('input');input.value=PIX_KEY;input.style.position='fixed';input.style.opacity='0';document.body.appendChild(input);
      input.select();input.setSelectionRange(0,99999);const ok=document.execCommand('copy');input.remove();return !!ok;
    }catch(_){return false}
  }
  function whatsappMessage(){
    const s=selectedPriceData(),name=$('#responsibleName')?.value.trim()||'',protocolText=lastResult?.protocol?`\n🔖 Protocolo: *${lastResult.protocol}*`:'';
    const msg=`Olá! Segue meu comprovante de pagamento.\n\n🏞️ Passeio: *${currentTrip?.name||''}*\n👤 Nome: *${name}*\n🎟️ Quantidade: *${s?.qty||''} vaga(s)*\n💳 Pagamento: *${paymentText[s?.pm]||''}*\n💰 Valor: *${money(s?.total||0)}*${protocolText}\n\n📎 Vou anexar o comprovante nesta conversa.`;
    return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`;
  }
  function sendReceiptWhatsapp(){
    try{
      const s=selectedPriceData();
      if(!currentTrip||!s||!$('#responsibleName')?.value.trim()){toast('Preencha os dados da reserva antes de enviar o comprovante.','error');return}
      window.open(whatsappMessage(),'_blank','noopener');
    }catch(e){toast('Não foi possível abrir o WhatsApp.','error')}
  }
  function whatsappForCustomLink(){
    const s=selectedPriceData(),name=$('#responsibleName')?.value.trim()||'';
    const msg=`Olá! Gostaria de solicitar um link de pagamento no cartão.\n\n🏞️ Passeio: *${currentTrip.name}*\n👤 Cliente: *${name}*\n🎟️ Quantidade: *${s.qty} vaga(s)*\n💰 Valor: *${money(s.total)}*`;
    return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`;
  }

  async function startPayment(trigger){
    if(currentCommitted){toast('Sua reserva já foi iniciada.');return}
    let data;
    try{data=collectData()}catch(e){toast(e.message,'error');return}

    let clipboardJob=null,pop=null;
    if(trigger==='pix')clipboardJob=beginClipboardCopy();
    if(trigger==='card'||trigger==='request_card')pop=window.open('about:blank','_blank');

    const btn=trigger==='pix'?$('#startPix'):$('#startCard');
    const oldText=btn?.textContent||'';
    if(btn){btn.disabled=true;btn.textContent='AGUARDE...'}

    try{
      const result=await createPortalSale(trigger,data);
      if(trigger==='pix'){
        const copied=await finishClipboardCopy(clipboardJob);
        if(copied)toast('✅ PIX copiado. Finalize o pagamento no seu banco.');
        else{
          toast('Não foi possível copiar automaticamente. Toque novamente em COPIAR PIX.','error');
          currentCommitted=false;
        }
      }else if(trigger==='card'){
        if(pop)pop.location.href=data.s.link;else window.open(data.s.link,'_blank');
        toast('✅ Abrindo pagamento com cartão...');
      }else{
        const w=whatsappForCustomLink();if(pop)pop.location.href=w;else window.open(w,'_blank');
        toast('✅ Solicite seu link de cartão pelo WhatsApp.');
      }

      const box=$('#commitResult');
      if(box)box.innerHTML=`<div class="successBox"><div class="successCheck">✓</div><strong>RESERVA INICIADA</strong><p>Protocolo <b>${esc(result.protocol)}</b>. Depois do pagamento, envie o comprovante pelo botão abaixo.</p><button type="button" class="successWhats" id="successWhatsapp">💬 ENVIAR COMPROVANTE</button></div>`;
      $('#successWhatsapp')?.addEventListener('click',sendReceiptWhatsapp);
      if(btn&&currentCommitted){btn.disabled=true;btn.textContent='PAGAMENTO INICIADO'}
      await loadManagedTrips();
    }catch(e){
      if(pop)try{pop.close()}catch(_){}
      console.error(e);toast(e.message||'Não foi possível iniciar a reserva.','error');
      if(btn){btn.disabled=false;btn.textContent=oldText}
      if(/vagas|lotação|preenchidas|Restam/i.test(e.message||''))await loadManagedTrips();
    }
  }

  async function init(){
    $('#goTrips')?.addEventListener('click',()=>$('#tripListSection')?.scrollIntoView({behavior:'smooth'}));
    renderTrips();icons();
    const ok=await waitFirebase();
    if(!ok){$('#syncNote').innerHTML='<span>⚠️ Conexão temporariamente indisponível.</span>';return}
    try{await ensureAnon()}catch(e){console.error(e);toast('Não foi possível iniciar a sessão de reserva.','error')}
    await loadManagedTrips();
  }
  document.addEventListener('DOMContentLoaded',init);
})();