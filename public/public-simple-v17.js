/* Trilheiros de Rondonópolis — Cadastro simples V17 */
(function(){
  const LOGO='https://i.postimg.cc/JnF2F9Hw/LOGO-TRILHEIROS-Photoroom.png';
  const digits=v=>String(v||'').replace(/\D/g,'');
  const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const emailOk=v=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v||'').trim());
  function cpfOk(v){
    const n=digits(v);if(n.length!==11||/^(\d)\1{10}$/.test(n))return false;
    let s=0;for(let i=0;i<9;i++)s+=Number(n[i])*(10-i);let d=(s*10)%11;if(d===10)d=0;if(d!==Number(n[9]))return false;
    s=0;for(let i=0;i<10;i++)s+=Number(n[i])*(11-i);d=(s*10)%11;if(d===10)d=0;return d===Number(n[10]);
  }
  function cpfMask(v){
    const n=digits(v).slice(0,11);
    return n.replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d{1,2})$/,'$1-$2');
  }
  function fmtDate(v){
    const s=String(v||'').slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return s;
    const [y,m,d]=s.split('-');return `${d}/${m}/${y}`;
  }
  function protocol(){
    const y=new Date().getFullYear();
    let c='';
    if(globalThis.crypto?.getRandomValues){const a=new Uint32Array(1);crypto.getRandomValues(a);c=(a[0]%1679616).toString(36).toUpperCase().padStart(4,'0')}
    else c=Math.random().toString(36).slice(2,6).toUpperCase();
    return `TR-${y}-${c}`;
  }
  function policyFor(t){
    if(t?.cancellation_policy)return t.cancellation_policy;
    try{if(typeof defaultCancellationPolicy==='function')return defaultCancellationPolicy(t?.name||'este passeio')}catch(_){ }
    return 'Condições do passeio aceitas no momento do cadastro.';
  }
  function notify(msg,type=''){
    try{if(typeof toast==='function')return toast(msg,type)}catch(_){ }
    alert(msg);
  }

  function pageHeader(){
    return `<header class="v17Top"><img src="${LOGO}" alt="Trilheiros de Rondonópolis"><div><strong>TRILHEIROS DE RONDONÓPOLIS</strong><span>Cadastro do passeio</span></div></header>`;
  }

  function hero(t){
    const rem=Math.max(0,Number(t?.remaining_spots||0));
    return `<section class="v17Hero"><div><span>CADASTRO</span><h1>${safe(t?.name||'Passeio')}</h1><p>${t?.destination?safe(t.destination):'Trilheiros de Rondonópolis'}</p></div><div class="v17HeroInfo">${t?.trip_date?`<b>📅 ${fmtDate(t.trip_date)}</b>`:''}${t?.departure_time?`<b>🕒 ${safe(t.departure_time)}</b>`:''}<b>👥 ${rem} vaga${rem===1?'':'s'} disponível${rem===1?'':'is'}</b></div></section>`;
  }

  function success(t,people,code){
    app.innerHTML=`<main class="v17Page">${pageHeader()}<section class="v17Success"><div class="v17Check">✓</div><span>CADASTRO CONCLUÍDO</span><h1>Pronto!</h1><p>Sua inscrição para <b>${safe(t.name)}</b> foi registrada.</p><div class="v17Protocol"><small>PROTOCOLO</small><strong>${safe(code)}</strong></div><div class="v17SuccessPeople">${people.map((p,i)=>`<div><b>${i+1}. ${safe(p.full_name)}</b>${p.cpf?`<small>${safe(cpfMask(p.cpf))}</small>`:''}</div>`).join('')}</div><div class="v17SuccessActions"><a href="/minha-reserva/${t.id}">Ver minha viagem</a><button id="v17Copy" type="button">Copiar protocolo</button></div></section></main>`;
    const copy=document.getElementById('v17Copy');
    if(copy)copy.onclick=()=>navigator.clipboard?.writeText(code).then(()=>notify('Protocolo copiado.')).catch(()=>prompt('Copie o protocolo:',code));
  }

  window.renderRegistration=function(trips,fixed){
    const mount=document.querySelector('.simpleMainMount')||document.getElementById('app');
    if(!trips?.length){
      if(mount)mount.innerHTML='<div class="v17Empty"><h2>Nenhum passeio disponível</h2><p>O cadastro está encerrado ou sem vagas.</p></div>';
      return;
    }
    let current=trips[0];
    let qty=1;
    let companions=[];

    function maxQty(){return Math.max(1,Math.min(3,Number(current?.remaining_spots||0)))}
    function syncCompanions(){
      const needed=Math.max(0,qty-1);
      while(companions.length<needed)companions.push('');
      if(companions.length>needed)companions=companions.slice(0,needed);
    }

    function render(){
      if(!current||current.status!=='open'||Number(current.remaining_spots||0)<1){
        mount.innerHTML='<div class="v17Empty"><h2>Inscrições encerradas</h2><p>Este passeio não possui vagas disponíveis.</p></div>';
        return;
      }
      qty=Math.min(qty,maxQty());syncCompanions();
      const policyHtml=safe(policyFor(current)).replace(/\n/g,'<br>');
      mount.innerHTML=`${hero(current)}<section class="v17Card"><div class="v17CardTitle"><span>INSCRIÇÃO RÁPIDA</span><h2>Preencha e envie</h2><p>São só os dados necessários para reservar suas vagas.</p></div><form id="simpleRegV17" novalidate>
        ${!fixed?`<label class="v17Field v17Full"><span>Passeio</span><select id="v17Trip">${trips.map(t=>`<option value="${t.id}" ${t.id===current.id?'selected':''}>${safe(t.name)} — ${fmtDate(t.trip_date)}</option>`).join('')}</select></label>`:''}
        <div class="v17Grid">
          <label class="v17Field"><span>Nome completo</span><input id="v17Name" autocomplete="name" placeholder="Seu nome completo" required></label>
          <label class="v17Field"><span>CPF</span><input id="v17Cpf" inputmode="numeric" autocomplete="off" placeholder="000.000.000-00" required></label>
          <label class="v17Field v17Full"><span>E-mail</span><input id="v17Email" type="email" autocomplete="email" placeholder="seuemail@exemplo.com" required></label>
        </div>
        <label class="v17Qty"><span>Quantas vagas?</span><select id="v17Qty">${Array.from({length:maxQty()},(_,i)=>i+1).map(n=>`<option value="${n}" ${n===qty?'selected':''}>${n} vaga${n===1?'':'s'}</option>`).join('')}</select></label>
        <div id="v17Companions">${companions.map((name,i)=>`<label class="v17Field v17Companion"><span>Nome do acompanhante ${i+2}</span><input data-v17-companion="${i}" value="${safe(name)}" placeholder="Nome completo" required></label>`).join('')}</div>
        <details class="v17Policy"><summary><span>Política de cancelamento</span><b>Toque para ler</b></summary><div class="v17PolicyText">${policyHtml}</div></details>
        <label class="v17Accept"><input id="v17Accept" type="checkbox"><span>Li e concordo com a política de cancelamento e com as condições do passeio.</span></label>
        <div id="v17Error" class="v17Error"></div>
        <button id="v17Submit" class="v17Submit" type="submit">Enviar cadastro</button>
      </form></section>`;

      const form=document.getElementById('simpleRegV17');
      const name=document.getElementById('v17Name');
      const cpf=document.getElementById('v17Cpf');
      const email=document.getElementById('v17Email');
      const qtyEl=document.getElementById('v17Qty');
      const accept=document.getElementById('v17Accept');
      const error=document.getElementById('v17Error');
      const submit=document.getElementById('v17Submit');

      cpf.oninput=()=>cpf.value=cpfMask(cpf.value);
      document.querySelectorAll('[data-v17-companion]').forEach(x=>x.oninput=e=>companions[Number(e.target.dataset.v17Companion)]=e.target.value);
      qtyEl.onchange=e=>{
        qty=Math.max(1,Math.min(maxQty(),Number(e.target.value||1)));
        const mainValues={name:name.value,cpf:cpf.value,email:email.value};
        syncCompanions();render();
        document.getElementById('v17Name').value=mainValues.name;
        document.getElementById('v17Cpf').value=mainValues.cpf;
        document.getElementById('v17Email').value=mainValues.email;
      };
      if(!fixed){document.getElementById('v17Trip').onchange=e=>{current=trips.find(t=>t.id===e.target.value)||trips[0];qty=1;companions=[];render()}}

      function show(msg,el){
        error.textContent=msg;error.classList.add('show');
        document.querySelectorAll('.v17Invalid').forEach(x=>x.classList.remove('v17Invalid'));
        if(el){el.classList.add('v17Invalid');el.focus({preventScroll:true});el.scrollIntoView({behavior:'smooth',block:'center'})}
      }
      form.onsubmit=async e=>{
        e.preventDefault();error.classList.remove('show');document.querySelectorAll('.v17Invalid').forEach(x=>x.classList.remove('v17Invalid'));
        if(name.value.trim().length<3)return show('Informe seu nome completo.',name);
        if(!cpfOk(cpf.value))return show('Confira o CPF informado.',cpf);
        if(!emailOk(email.value))return show('Informe um e-mail válido.',email);
        const companionInputs=[...document.querySelectorAll('[data-v17-companion]')];
        for(let i=0;i<companionInputs.length;i++)if(companionInputs[i].value.trim().length<3)return show(`Informe o nome do acompanhante ${i+2}.`,companionInputs[i]);
        if(!accept.checked)return show('Leia a política de cancelamento e marque a confirmação para enviar.',accept);

        const people=[{full_name:name.value.trim(),cpf:digits(cpf.value)},...companionInputs.map(x=>({full_name:x.value.trim(),cpf:''}))];
        submit.disabled=true;submit.textContent='Enviando...';
        try{
          const u=await ensureAnon();
          const tripRef=db.collection('trips').doc(current.id);
          const resRef=tripRef.collection('reservations').doc(u.uid);
          const code=protocol();
          await db.runTransaction(async tx=>{
            const [ts,rs]=await Promise.all([tx.get(tripRef),tx.get(resRef)]);
            if(!ts.exists)throw Error('Passeio não encontrado.');
            if(rs.exists)throw Error('DUPLICATE');
            const t=ts.data();
            const rem=Number(t.remaining_spots||0),used=Number(t.used_spots||0),seats=people.length;
            if(t.status!=='open')throw Error('As inscrições deste passeio estão encerradas.');
            if(rem<seats)throw Error(`Restam somente ${rem} vaga(s).`);
            const now=firebase.firestore.FieldValue.serverTimestamp();
            tx.set(resRef,{
              protocol:code,
              responsible_name:name.value.trim(),
              responsible_cpf:digits(cpf.value),
              email:email.value.trim().toLowerCase(),
              seats,
              participants:people,
              registration_answers:{},
              status:'active',
              payment_status:t.assumes_payment===false?'pending':'paid',
              payment_method:'a_confirmar',
              paid_amount:t.assumes_payment===false?0:Number(t.default_price||0)*seats,
              refunded_amount:0,
              policy_text:t.cancellation_policy||policyFor(t),
              policy_version:'2026-09-v4-simple-policy-visible',
              policy_accepted:true,
              policy_accepted_at:now,
              created_at:now,
              updated_at:now
            });
            tx.update(tripRef,{remaining_spots:rem-seats,used_spots:used+seats,updated_at:now});
          });
          success(current,people,code);
        }catch(ex){
          submit.disabled=false;submit.textContent='Enviar cadastro';
          if(String(ex.message).includes('DUPLICATE'))show('Este aparelho já possui um cadastro para este passeio.');
          else show(ex.message||'Não foi possível concluir o cadastro. Tente novamente.');
        }
      };
    }
    render();
  };

  window.registration=async function(id=''){
    app.innerHTML=`<main class="v17Page">${pageHeader()}<div class="simpleMainMount"><div class="v17Loading"><div></div><h2>Preparando cadastro...</h2></div></div></main>`;
    try{
      await ensureAnon();
      let trips=[];
      if(id){const s=await db.collection('trips').doc(id).get();trips=s.exists?[{id:s.id,...s.data()}]:[]}
      else trips=await getTrips();
      window.renderRegistration(trips,!!id);
    }catch(e){document.querySelector('.simpleMainMount').innerHTML=`<div class="v17Empty"><h2>Cadastro indisponível</h2><p>${safe(e.message||'Tente novamente em instantes.')}</p></div>`}
  };

  try{registration=window.registration}catch(_){ }
  try{renderRegistration=window.renderRegistration}catch(_){ }
})();
