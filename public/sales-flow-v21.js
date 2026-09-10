/* Trilheiros Gestão V21 — Venda paga -> link -> cadastro dos passageiros */
(function(){
  const LOGO='https://i.postimg.cc/JnF2F9Hw/LOGO-TRILHEIROS-Photoroom.png';
  const q=(s,r=document)=>r.querySelector(s);
  const qa=(s,r=document)=>[...r.querySelectorAll(s)];
  const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const digits=v=>String(v||'').replace(/\D/g,'');
  const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v||0));
  const fmtDate=v=>{const s=String(v||'').slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return s||'—';const [y,m,d]=s.split('-');return `${d}/${m}/${y}`};
  const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'America/Cuiaba'});
  const paymentLabels={pix:'PIX',card:'Cartão',pix_installment:'PIX parcelado',cash:'Dinheiro',transfer:'Transferência',other:'Outro'};

  function validEmail(v){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v||'').trim())}
  function validCPF(v){
    const n=digits(v);if(n.length!==11||/^(\d)\1{10}$/.test(n))return false;
    let s=0;for(let i=0;i<9;i++)s+=Number(n[i])*(10-i);let d=(s*10)%11;if(d===10)d=0;if(d!==Number(n[9]))return false;
    s=0;for(let i=0;i<10;i++)s+=Number(n[i])*(11-i);d=(s*10)%11;if(d===10)d=0;return d===Number(n[10]);
  }
  function cpfMask(v){
    const n=digits(v).slice(0,11);
    return n.replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d{1,2})$/,'$1-$2');
  }
  function protocol(){
    const y=new Date().getFullYear();let c='';
    if(globalThis.crypto?.getRandomValues){const a=new Uint32Array(1);crypto.getRandomValues(a);c=(a[0]%2176782336).toString(36).toUpperCase().padStart(6,'0')}
    else c=Math.random().toString(36).slice(2,8).toUpperCase();
    return `TV-${y}-${c}`;
  }
  function notify(msg,type=''){
    try{if(typeof toast==='function')return toast(msg,type)}catch(_){ }
    alert(msg);
  }
  function saleUrl(id){return `${location.origin}/cadastro-venda/${id}`}
  function roleCanSell(){try{return ['owner','admin'].includes(state?.role)}catch{return false}}
  function tripOptions(t,key){const a=t?.registration_options?.[key];return Array.isArray(a)?a.filter(Boolean):[]}
  function salePackageText(s){return [s.accommodation,s.category].filter(Boolean).join(' • ')||'—'}

  function showSaleModal(html){
    q('#saleModalV21')?.remove();
    const back=document.createElement('div');back.id='saleModalV21';back.className='saleModalBackV21';
    back.innerHTML=`<section class="saleModalV21">${html}</section>`;
    document.body.appendChild(back);
    back.addEventListener('click',e=>{if(e.target===back)back.remove()});
    return back;
  }
  function closeSaleModal(){q('#saleModalV21')?.remove()}
  window.closeSaleModalV21=closeSaleModal;

  function packageSelect(name,label,options){
    if(!options.length)return'';
    return `<label class="saleFieldV21"><span>${safe(label)}</span><select name="${name}" required><option value="">Selecione</option><option value="__customer_choice__">Cliente escolhe no cadastro</option>${options.map(o=>`<option value="${safe(o)}">${safe(o)}</option>`).join('')}</select></label>`;
  }

  window.openSaleModalV21=function(){
    if(!roleCanSell())return notify('Somente proprietário ou administrador pode registrar uma venda.','error');
    const trips=(state?.trips||[]).filter(t=>t.status==='open'&&Number(t.remaining_spots||0)>0).sort((a,b)=>String(a.trip_date||'').localeCompare(String(b.trip_date||'')));
    if(!trips.length)return notify('Não há passeio aberto com vagas disponíveis.','error');
    const back=showSaleModal(`<form id="saleFormV21"><header class="saleModalHeadV21"><div><span>VENDA JÁ PAGA</span><h2>Registrar pagamento e gerar link</h2><p>A vaga é descontada agora. O cliente só preencherá os passageiros depois.</p></div><button type="button" id="saleCloseV21">✕</button></header><div class="saleModalBodyV21"><div class="saleGridV21"><label class="saleFieldV21 saleFullV21"><span>Passeio</span><select name="trip" required>${trips.map(t=>`<option value="${t.id}">${safe(t.name)} — ${fmtDate(t.trip_date)} — ${Number(t.remaining_spots||0)} vagas</option>`).join('')}</select></label><label class="saleFieldV21"><span>Nome do cliente / pagador</span><input name="buyer" required placeholder="Nome para seu controle"></label><label class="saleFieldV21"><span>Quantidade de vagas pagas</span><select name="seats" required></select></label><label class="saleFieldV21"><span>Valor recebido</span><input name="amount" type="number" min="0.01" step="0.01" required placeholder="0,00"></label><label class="saleFieldV21"><span>Forma de pagamento</span><select name="method" required><option value="pix">PIX</option><option value="card">Cartão</option><option value="pix_installment">PIX parcelado</option><option value="cash">Dinheiro</option><option value="transfer">Transferência</option><option value="other">Outro</option></select></label><label class="saleFieldV21"><span>Data do recebimento</span><input name="receivedDate" type="date" value="${today()}" required></label><div id="salePackageFieldsV21" class="salePackageFieldsV21 saleFullV21"></div><label class="saleFieldV21 saleFullV21"><span>Observação interna (opcional)</span><textarea name="notes" rows="3" placeholder="Ex.: desconto combinado, parcela, observação do pagamento..."></textarea></label></div><div class="salePreviewV21" id="salePreviewV21"></div><div id="saleMsgV21"></div></div><footer class="saleModalFootV21"><button type="button" class="saleBtnGhostV21" id="saleCancelV21">Cancelar</button><button class="saleBtnPrimaryV21" id="saleSaveV21">Registrar venda e gerar link</button></footer></form>`);
    const f=q('#saleFormV21',back),tripSel=f.trip,seats=f.seats,pkg=q('#salePackageFieldsV21',back),preview=q('#salePreviewV21',back);
    q('#saleCloseV21',back).onclick=closeSaleModal;q('#saleCancelV21',back).onclick=closeSaleModal;

    function currentTrip(){return trips.find(t=>t.id===tripSel.value)||trips[0]}
    function refresh(){
      const t=currentTrip(),max=Math.max(1,Math.min(5,Number(t.remaining_spots||0))),old=Math.min(max,Number(seats.value||1));
      seats.innerHTML=Array.from({length:max},(_,i)=>`<option value="${i+1}" ${i+1===old?'selected':''}>${i+1} vaga${i?'s':''}</option>`).join('');
      const acc=tripOptions(t,'accommodation'),cat=tripOptions(t,'category');
      pkg.innerHTML=(acc.length||cat.length)?`<div class="salePackageTitleV21"><b>Pacote / hospedagem</b><small>Use as opções configuradas no próprio passeio.</small></div><div class="saleGridV21">${packageSelect('accommodation','Hospedagem',acc)}${packageSelect('category','Categoria',cat)}</div>`:'';
      preview.innerHTML=`<div><small>PASSEIO</small><b>${safe(t.name)}</b><span>${safe(t.destination||'')} • ${fmtDate(t.trip_date)}</span></div><div><small>VAGAS DISPONÍVEIS</small><strong>${Number(t.remaining_spots||0)}</strong></div>`;
    }
    tripSel.onchange=refresh;refresh();

    f.onsubmit=async e=>{
      e.preventDefault();const save=q('#saleSaveV21',back),msg=q('#saleMsgV21',back),t=currentTrip();msg.innerHTML='';
      const nSeats=Number(f.seats.value),amount=Number(f.amount.value),buyer=f.buyer.value.trim();
      const accField=f.elements.accommodation,catField=f.elements.category;
      if(!buyer)return;
      if(!nSeats||nSeats<1||nSeats>5)return notify('A venda deve ter de 1 a 5 vagas.','error');
      if(!amount||amount<=0)return notify('Informe o valor recebido.','error');
      if(accField&&!accField.value){accField.focus();return}
      if(catField&&!catField.value){catField.focus();return}
      save.disabled=true;save.textContent='Registrando...';
      try{
        const saleRef=db.collection('sales').doc(),tripRef=db.collection('trips').doc(t.id),resRef=tripRef.collection('reservations').doc(saleRef.id),code=protocol();
        const accRaw=accField?.value||'',catRaw=catField?.value||'';
        const accMode=accRaw==='__customer_choice__'?'customer_choice':accRaw?'fixed':'none';
        const catMode=catRaw==='__customer_choice__'?'customer_choice':catRaw?'fixed':'none';
        const acc=accMode==='fixed'?accRaw:'',cat=catMode==='fixed'?catRaw:'';
        await db.runTransaction(async tx=>{
          const ts=await tx.get(tripRef);if(!ts.exists)throw Error('Passeio não encontrado.');
          const td=ts.data(),rem=Number(td.remaining_spots||0),used=Number(td.used_spots||0);
          if(td.status!=='open')throw Error('Este passeio não está aberto para novas vendas.');
          if(rem<nSeats)throw Error(`Restam somente ${rem} vaga(s).`);
          const now=firebase.firestore.FieldValue.serverTimestamp();
          tx.set(saleRef,{trip_id:t.id,trip_name:td.name||t.name,trip_date:td.trip_date||t.trip_date,customer_name:buyer,customer_cpf:'',customer_email:'',seats:nSeats,paid_amount:amount,payment_method:f.method.value,payment_status:'paid',received_date:f.receivedDate.value,registration_status:'pending',claimed_uid:'',protocol:code,accommodation:acc,accommodation_mode:accMode,category:cat,category_mode:catMode,notes:f.notes.value.trim(),source:'admin_paid_sale',created_at:now,updated_at:now});
          tx.set(resRef,{protocol:code,sale_id:saleRef.id,responsible_name:buyer,responsible_cpf:'',email:'',seats:nSeats,participants:[],registration_answers:{},accommodation:acc,category:cat,status:'paid_waiting_registration',registration_status:'pending',payment_status:'paid',payment_method:f.method.value,paid_amount:amount,refunded_amount:0,policy_text:td.cancellation_policy||'',policy_version:'2026-09-sale-v21',policy_accepted:false,source:'admin_paid_sale',created_at:now,updated_at:now});
          tx.update(tripRef,{remaining_spots:rem-nSeats,used_spots:used+nSeats,updated_at:now});
        });
        const link=saleUrl(saleRef.id),text=`Olá, ${buyer}! Seu pagamento para ${t.name} foi registrado. Agora preencha os dados dos participantes neste link: ${link}`;
        back.querySelector('.saleModalV21').innerHTML=`<section class="saleDoneV21"><div class="saleDoneIconV21">✓</div><span>VENDA REGISTRADA</span><h2>${safe(t.name)}</h2><p><b>${nSeats} vaga${nSeats===1?'':'s'}</b> • ${money(amount)} • ${safe(paymentLabels[f.method.value]||f.method.value)}</p><div class="saleLinkBoxV21"><small>LINK EXCLUSIVO DO CLIENTE</small><input id="saleGeneratedLinkV21" readonly value="${safe(link)}"></div><div class="saleDoneActionsV21"><button id="saleCopyLinkV21">Copiar link</button><a target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(text)}">Enviar no WhatsApp</a><button id="saleShareLinkV21">Compartilhar</button></div><button class="saleCloseDoneV21" id="saleCloseDoneV21">Fechar</button></section>`;
        q('#saleCopyLinkV21',back).onclick=()=>navigator.clipboard?.writeText(link).then(()=>notify('Link copiado.')).catch(()=>prompt('Copie o link:',link));
        q('#saleShareLinkV21',back).onclick=async()=>{try{if(navigator.share)await navigator.share({title:`Cadastro — ${t.name}`,text,url:link});else throw Error()}catch(e){if(e?.name!=='AbortError')navigator.clipboard?.writeText(link).then(()=>notify('Link copiado para compartilhar.'))}};
        q('#saleCloseDoneV21',back).onclick=()=>{closeSaleModal();if(state?.tab==='salesV21')renderSalesPageV21()};
        try{window.auditV7?.('create','sale',saleRef.id,`Venda paga registrada: ${buyer} • ${nSeats} vaga(s) • ${money(amount)}`)}catch(_){ }
      }catch(err){msg.innerHTML=`<div class="saleErrorV21">${safe(err.message||'Não foi possível registrar a venda.')}</div>`;save.disabled=false;save.textContent='Registrar venda e gerar link'}
    };
  };

  async function resetClaim(id){
    if(!confirm('Liberar este link para ser aberto em outro aparelho?'))return;
    try{await db.collection('sales').doc(id).update({claimed_uid:'',updated_at:firebase.firestore.FieldValue.serverTimestamp()});notify('Link liberado.');renderSalesPageV21()}catch(e){notify(e.message||'Não foi possível liberar.','error')}
  }

  window.renderSalesPageV21=async function(){
    if(!location.pathname.startsWith('/admin'))return;
    const content=q('#content'),title=q('#pageTitle');if(!content)return;
    if(title)title.textContent='Vendas pagas';
    qa('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab==='salesV21'));
    content.innerHTML='<div class="saleLoadingV21">Carregando vendas...</div>';
    try{
      const s=await db.collection('sales').orderBy('created_at','desc').limit(250).get();
      const sales=s.docs.map(d=>({id:d.id,...d.data()}));
      const total=sales.reduce((sum,x)=>sum+Number(x.paid_amount||0),0),seats=sales.reduce((sum,x)=>sum+Number(x.seats||0),0),pending=sales.filter(x=>x.registration_status!=='completed').length,done=sales.length-pending;
      content.innerHTML=`<div class="saleAdminTopV21"><div><span>CONTROLE DE VENDAS</span><h2>Pagamento primeiro. Cadastro depois.</h2><p>O financeiro nasce quando você registra a venda. O cliente apenas completa os passageiros.</p></div><button id="salesNewV21">+ Nova venda paga</button></div><div class="saleMetricsV21"><div><small>RECEBIDO</small><strong>${money(total)}</strong></div><div><small>VAGAS VENDIDAS</small><strong>${seats}</strong></div><div><small>CADASTROS PENDENTES</small><strong>${pending}</strong></div><div><small>CADASTROS CONCLUÍDOS</small><strong>${done}</strong></div></div><section class="salePanelV21"><div class="salePanelHeadV21"><div><b>Vendas registradas</b><span>${sales.length} registro${sales.length===1?'':'s'}</span></div></div>${sales.length?`<div class="saleTableWrapV21"><table class="saleTableV21"><thead><tr><th>Cliente</th><th>Passeio</th><th>Vagas</th><th>Recebido</th><th>Pacote</th><th>Cadastro</th><th></th></tr></thead><tbody>${sales.map(x=>`<tr><td><b>${safe(x.customer_name||'—')}</b><small>${safe(paymentLabels[x.payment_method]||x.payment_method||'')}</small></td><td><b>${safe(x.trip_name||'—')}</b><small>${fmtDate(x.trip_date)}</small></td><td>${Number(x.seats||0)}</td><td><b>${money(x.paid_amount)}</b></td><td><small>${safe(salePackageText(x))}</small></td><td><span class="saleStatusV21 ${x.registration_status==='completed'?'done':'pending'}">${x.registration_status==='completed'?'Concluído':'Pendente'}</span></td><td><div class="saleRowActionsV21"><button data-copy-sale="${x.id}" title="Copiar link">Link</button><a target="_blank" href="${saleUrl(x.id)}" title="Abrir cadastro">Abrir</a>${x.registration_status!=='completed'&&x.claimed_uid?`<button data-reset-sale="${x.id}" title="Liberar para outro aparelho">Liberar</button>`:''}</div></td></tr>`).join('')}</tbody></table></div>`:'<div class="saleEmptyV21">Nenhuma venda registrada ainda.</div>'}</section>`;
      q('#salesNewV21')?.addEventListener('click',openSaleModalV21);
      qa('[data-copy-sale]',content).forEach(b=>b.onclick=()=>navigator.clipboard?.writeText(saleUrl(b.dataset.copySale)).then(()=>notify('Link copiado.')));
      qa('[data-reset-sale]',content).forEach(b=>b.onclick=()=>resetClaim(b.dataset.resetSale));
    }catch(e){content.innerHTML=`<div class="saleErrorV21">${safe(e.message||'Não foi possível carregar as vendas.')}</div>`}
  };

  function injectAdmin(){
    if(!location.pathname.startsWith('/admin'))return;
    const tools=q('.adminV7Tools')||q('.toolbar');
    if(tools&&!q('#newSaleV21')){
      const b=document.createElement('button');b.id='newSaleV21';b.className='btn saleQuickV21';b.textContent='+ Nova venda';b.disabled=!roleCanSell();b.onclick=openSaleModalV21;
      const newTrip=q('#newTrip',tools);newTrip?tools.insertBefore(b,newTrip):tools.appendChild(b);
    }
    const nav=q('.admin .nav');
    if(nav&&!q('[data-tab="salesV21"]',nav)){
      const finance=q('[data-tab="finance"]',nav),b=document.createElement('button');b.dataset.tab='salesV21';b.innerHTML='💳 Vendas pagas';
      b.onclick=()=>{state.tab='salesV21';renderSalesPageV21()};
      if(finance)finance.after(b);else nav.appendChild(b);
    }
  }

  const originalRender=window.renderAdmin;
  if(typeof originalRender==='function'&&!originalRender.__salesV21){
    const wrapped=function(...args){const out=originalRender.apply(this,args);setTimeout(()=>{injectAdmin();if(state?.tab==='salesV21')renderSalesPageV21()},0);return out};
    wrapped.__salesV21=true;window.renderAdmin=wrapped;try{renderAdmin=wrapped}catch(_){ }
  }

  function publicHeader(){return `<header class="salePublicTopV21"><img src="${LOGO}" alt="Trilheiros de Rondonópolis"><div><strong>TRILHEIROS DE RONDONÓPOLIS</strong><span>Cadastro após pagamento</span></div></header>`}
  function publicFail(title,msg){app.innerHTML=`<main class="salePublicPageV21">${publicHeader()}<section class="salePublicMessageV21"><h1>${safe(title)}</h1><p>${safe(msg)}</p></section></main>`}
  function completedPage(s,t){
    const people=Array.isArray(s.participants)?s.participants:[];
    app.innerHTML=`<main class="salePublicPageV21">${publicHeader()}<section class="salePublicDoneV21"><div>✓</div><span>CADASTRO CONCLUÍDO</span><h1>${safe(t?.name||s.trip_name)}</h1><p>Seu pagamento e os participantes já estão registrados.</p><section class="salePublicSummaryV21"><div><small>PROTOCOLO</small><b>${safe(s.protocol||'—')}</b></div><div><small>VAGAS PAGAS</small><b>${Number(s.seats||0)}</b></div><div><small>VALOR REGISTRADO</small><b>${money(s.paid_amount)}</b></div>${salePackageText(s)!=='—'?`<div><small>PACOTE</small><b>${safe(salePackageText(s))}</b></div>`:''}</section>${people.length?`<div class="salePublicPeopleV21">${people.map((p,i)=>`<div><b>${i+1}. ${safe(p.full_name)}</b>${p.cpf?`<small>${cpfMask(p.cpf)}</small>`:''}</div>`).join('')}</div>`:''}</section></main>`;
  }

  window.saleRegistrationV21=async function(id){
    if(!id)return publicFail('Link inválido','Solicite um novo link aos Trilheiros.');
    app.innerHTML=`<main class="salePublicPageV21">${publicHeader()}<div class="salePublicLoadingV21">Preparando seu cadastro...</div></main>`;
    try{
      const u=await ensureAnon(),saleRef=db.collection('sales').doc(id);let ss=await saleRef.get();
      if(!ss.exists)throw Error('Este link não foi encontrado.');
      let s={id:ss.id,...ss.data()};
      if(s.claimed_uid&&s.claimed_uid!==u.uid)throw Error('Este link já foi aberto em outro aparelho. Peça aos Trilheiros para liberar o acesso.');
      if(!s.claimed_uid){await saleRef.update({claimed_uid:u.uid,updated_at:firebase.firestore.FieldValue.serverTimestamp()});s.claimed_uid=u.uid}
      const ts=await db.collection('trips').doc(s.trip_id).get();if(!ts.exists)throw Error('Passeio não encontrado.');
      const t={id:ts.id,...ts.data()};
      if(s.registration_status==='completed')return completedPage(s,t);
      const seats=Math.max(1,Number(s.seats||1)),companions=Math.max(0,seats-1),accOpts=tripOptions(t,'accommodation'),catOpts=tripOptions(t,'category');
      const accChoice=s.accommodation_mode==='customer_choice'&&accOpts.length;
      const catChoice=s.category_mode==='customer_choice'&&catOpts.length;
      const policy=safe(t.cancellation_policy||'Política de cancelamento informada pela organização.').replace(/\n/g,'<br>');
      app.innerHTML=`<main class="salePublicPageV21">${publicHeader()}<section class="salePublicHeroV21"><span>PAGAMENTO JÁ REGISTRADO</span><h1>${safe(t.name)}</h1><p>${safe(t.destination||'')}${t.trip_date?` • ${fmtDate(t.trip_date)}`:''}</p><div><b>${seats} vaga${seats===1?'':'s'} paga${seats===1?'':'s'}</b><b>${money(s.paid_amount)}</b></div></section><section class="salePublicCardV21"><div class="salePublicCardTitleV21"><span>AGORA É SÓ IDENTIFICAR OS PASSAGEIROS</span><h2>Preencha e envie</h2><p>A quantidade de vagas e o valor já foram definidos no pagamento.</p></div><form id="salePublicFormV21" novalidate><div class="salePublicGridV21"><label><span>Seu nome completo</span><input id="saleNameV21" value="${safe(s.customer_name||'')}" required autocomplete="name"></label><label><span>CPF</span><input id="saleCpfV21" required inputmode="numeric" placeholder="000.000.000-00"></label><label class="salePublicFullV21"><span>E-mail</span><input id="saleEmailV21" required type="email" autocomplete="email" placeholder="seuemail@exemplo.com"></label></div><div class="saleFixedSeatsV21"><span>QUANTIDADE DE VAGAS</span><strong>${seats}</strong><small>Já reservadas no seu pagamento</small></div>${companions?`<section class="saleCompanionsV21"><b>Outros passageiros</b><p>Informe somente o nome de quem vai com você.</p>${Array.from({length:companions},(_,i)=>`<label><span>Nome do acompanhante ${i+2}</span><input data-sale-companion="${i}" required placeholder="Nome completo"></label>`).join('')}</section>`:''}${s.accommodation_mode==='fixed'&&s.accommodation?`<div class="salePackageFixedV21"><small>HOSPEDAGEM</small><b>${safe(s.accommodation)}</b></div>`:''}${accChoice?`<label class="salePublicOptionV21"><span>Hospedagem</span><select id="saleAccommodationV21" required><option value="">Selecione</option>${accOpts.map(o=>`<option value="${safe(o)}">${safe(o)}</option>`).join('')}</select></label>`:''}${s.category_mode==='fixed'&&s.category?`<div class="salePackageFixedV21"><small>CATEGORIA</small><b>${safe(s.category)}</b></div>`:''}${catChoice?`<label class="salePublicOptionV21"><span>Categoria</span><select id="saleCategoryV21" required><option value="">Selecione</option>${catOpts.map(o=>`<option value="${safe(o)}">${safe(o)}</option>`).join('')}</select></label>`:''}<details class="salePolicyV21"><summary><span>Política de cancelamento</span><b>Toque para ler</b></summary><div>${policy}</div></details><label class="saleAcceptV21"><input id="saleAcceptV21" type="checkbox"><span>Li e concordo com a política de cancelamento e com as condições do passeio.</span></label><div id="salePublicErrorV21" class="salePublicErrorV21"></div><button id="salePublicSubmitV21" class="salePublicSubmitV21">Concluir cadastro</button></form></section></main>`;
      const form=q('#salePublicFormV21'),name=q('#saleNameV21'),cpfEl=q('#saleCpfV21'),email=q('#saleEmailV21'),accept=q('#saleAcceptV21'),err=q('#salePublicErrorV21'),submit=q('#salePublicSubmitV21');
      cpfEl.oninput=()=>cpfEl.value=cpfMask(cpfEl.value);
      function failField(msg,el){err.textContent=msg;err.classList.add('show');el?.focus();el?.scrollIntoView({behavior:'smooth',block:'center'})}
      form.onsubmit=async e=>{
        e.preventDefault();err.classList.remove('show');
        if(name.value.trim().length<3)return failField('Informe seu nome completo.',name);
        if(!validCPF(cpfEl.value))return failField('Confira o CPF informado.',cpfEl);
        if(!validEmail(email.value))return failField('Informe um e-mail válido.',email);
        const companionInputs=qa('[data-sale-companion]',form);for(let i=0;i<companionInputs.length;i++)if(companionInputs[i].value.trim().length<3)return failField(`Informe o nome do acompanhante ${i+2}.`,companionInputs[i]);
        const accEl=q('#saleAccommodationV21'),catEl=q('#saleCategoryV21');if(accEl&&!accEl.value)return failField('Selecione a hospedagem.',accEl);if(catEl&&!catEl.value)return failField('Selecione a categoria.',catEl);if(!accept.checked)return failField('Leia a política e marque a confirmação para continuar.',accept);
        const acc=accEl?.value||s.accommodation||'',cat=catEl?.value||s.category||'',people=[{full_name:name.value.trim(),cpf:digits(cpfEl.value)},...companionInputs.map(x=>({full_name:x.value.trim(),cpf:''}))];
        const answers={};if(acc)answers.accommodation={label:'Hospedagem',value:acc};if(cat)answers.category={label:'Categoria',value:cat};
        submit.disabled=true;submit.textContent='Enviando...';
        try{
          const resRef=db.collection('trips').doc(s.trip_id).collection('reservations').doc(id);
          await db.runTransaction(async tx=>{
            const [saleSnap,resSnap]=await Promise.all([tx.get(saleRef),tx.get(resRef)]);if(!saleSnap.exists||!resSnap.exists)throw Error('Registro da venda não encontrado.');
            const sd=saleSnap.data(),rd=resSnap.data();if(sd.claimed_uid!==u.uid)throw Error('Este link não pertence a este aparelho.');if(sd.registration_status==='completed')throw Error('Este cadastro já foi concluído.');if(Number(sd.seats||0)!==people.length)throw Error('Quantidade de passageiros diferente da venda registrada.');
            const now=firebase.firestore.FieldValue.serverTimestamp();
            tx.update(saleRef,{customer_name:name.value.trim(),customer_cpf:digits(cpfEl.value),customer_email:email.value.trim().toLowerCase(),participants:people,accommodation:acc,category:cat,registration_status:'completed',registered_at:now,updated_at:now});
            tx.update(resRef,{responsible_name:name.value.trim(),responsible_cpf:digits(cpfEl.value),email:email.value.trim().toLowerCase(),participants:people,registration_answers:answers,accommodation:acc,category:cat,status:'active',registration_status:'completed',policy_text:t.cancellation_policy||rd.policy_text||'',policy_version:'2026-09-sale-v21',policy_accepted:true,policy_accepted_at:now,updated_at:now});
          });
          s={...s,customer_name:name.value.trim(),customer_cpf:digits(cpfEl.value),customer_email:email.value.trim().toLowerCase(),participants:people,accommodation:acc,category:cat,registration_status:'completed'};completedPage(s,t);
        }catch(ex){submit.disabled=false;submit.textContent='Concluir cadastro';failField(ex.message||'Não foi possível concluir o cadastro.')}
      };
    }catch(e){publicFail('Não foi possível abrir o cadastro',e.message||'Solicite um novo link aos Trilheiros.')}
  };

  let routedSaleId='';
  function routeSaleWhenReady(){
    const m=location.pathname.match(/^\/cadastro-venda\/([^/]+)/);if(!m){routedSaleId='';return}
    if(routedSaleId===m[1])return;routedSaleId=m[1];
    let tries=0;const timer=setInterval(()=>{tries++;try{if(typeof db!=='undefined'&&db&&typeof auth!=='undefined'&&auth){clearInterval(timer);saleRegistrationV21(m[1])}}catch(_){ }if(tries>100){clearInterval(timer);publicFail('Cadastro indisponível','Recarregue a página e tente novamente.')}},80);
  }

  const observer=new MutationObserver(()=>injectAdmin());
  observer.observe(document.documentElement,{subtree:true,childList:true});
  window.addEventListener('load',()=>{injectAdmin();routeSaleWhenReady()});
  window.addEventListener('popstate',routeSaleWhenReady);
  injectAdmin();routeSaleWhenReady();
})();
