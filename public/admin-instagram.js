(function(){
'use strict';
const API='/api/instagram';
let rendering=false,lastData=null;
const q=(selector,root=document)=>root.querySelector(selector);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
const bool=value=>value===true;
const stamp=value=>{try{if(!value)return 0;if(typeof value.toMillis==='function')return value.toMillis();if(value._seconds)return Number(value._seconds)*1000;if(value.seconds)return Number(value.seconds)*1000;return new Date(value).getTime()||0}catch{return 0}};
const ago=value=>{const ms=Date.now()-stamp(value);if(!Number.isFinite(ms)||ms<0)return'Agora';const min=Math.floor(ms/60000);if(min<1)return'Agora';if(min<60)return`${min} min`;const h=Math.floor(min/60);if(h<24)return`${h} h`;return`${Math.floor(h/24)} d`};
const notify=(message,type='success')=>typeof window.toast==='function'?window.toast(message,type):alert(message);

async function request(action,{method='GET',body=null}={}){
  if(typeof auth==='undefined'||!auth.currentUser)throw Error('Entre novamente no painel.');
  const token=await auth.currentUser.getIdToken(),response=await fetch(`${API}?action=${encodeURIComponent(action)}`,{method,headers:{Authorization:`Bearer ${token}`,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):null});
  const raw=await response.text();let data={};try{data=JSON.parse(raw||'{}')}catch{throw Error(response.status===404?'A função do Instagram ainda não foi publicada.':raw||'Resposta inválida do servidor.')}
  if(!response.ok||data.ok===false)throw Error(data.error||`Erro ${response.status}`);return data;
}

function injectNav(){
  const nav=q('.admin .nav');if(!nav||q('[data-tab="instagram"]',nav))return;
  const communications=q('[data-tab="communications"]',nav),button=document.createElement('button');button.dataset.tab='instagram';button.innerHTML='💬 Assistente Instagram';button.onclick=()=>{state.tab='instagram';window.renderAdmin()};
  if(communications)communications.insertAdjacentElement('afterend',button);else nav.appendChild(button);
}

function statusCard(data){
  const connection=data.connection||{},settings=data.settings||{},ready=connection.connected,automatic=settings.enabled&&settings.mode==='automatic';
  return `<section class="igStatus ${ready?'ready':'pending'}"><div><span class="eyebrow">INSTAGRAM OFICIAL</span><h2>${ready?`@${esc(connection.username||settings.account_username||'trilheiros.roomt')} conectado`:'Integração preparada'}</h2><p>${ready?'A conexão oficial da Meta está funcionando.':connection.configured?'As credenciais existem, mas a Meta ainda não validou a conexão.':'Falta apenas conectar as credenciais e permissões da Meta.'}</p></div><div class="igStatusPills"><span>${ready?'● CONECTADO':'○ AGUARDANDO META'}</span><span>${automatic?'🤖 AUTOMÁTICO':'🛡️ MODO SEGURO'}</span></div></section>`;
}

function settingsPanel(data){
  const s=data.settings||{};
  return `<section class="panel igPanel"><div class="panelHead"><div><span class="eyebrow">CONTROLE</span><h2>Como o assistente responde</h2><p>Ele consulta os passeios do Gestão e nunca confirma pagamento, cancelamento ou informação ausente.</p></div></div><form id="igSettings" class="igSettings"><label class="igSwitch"><input name="enabled" type="checkbox" ${bool(s.enabled)?'checked':''}><span><b>Atendente ligado</b><small>Desligue para pausar todas as respostas.</small></span></label><label><span>Modo de funcionamento</span><select name="mode"><option value="suggestions" ${s.mode!=='automatic'?'selected':''}>Sugerir respostas para eu aprovar</option><option value="automatic" ${s.mode==='automatic'?'selected':''}>Responder automaticamente</option></select></label><label class="igSwitch"><input name="reply_comments" type="checkbox" ${s.reply_comments!==false?'checked':''}><span><b>Responder comentários</b><small>Respostas públicas, curtas e naturais.</small></span></label><label class="igSwitch"><input name="reply_messages" type="checkbox" ${s.reply_messages!==false?'checked':''}><span><b>Responder Direct</b><small>Continua a conversa usando o passeio identificado.</small></span></label><label class="igSwitch"><input name="comment_to_dm" type="checkbox" ${bool(s.comment_to_dm)?'checked':''}><span><b>Comentário também chama no Direct</b><small>Usa a resposta privada oficial da Meta. Deixe desligado no primeiro teste.</small></span></label><label><span>Link enviado para reserva</span><input name="reservation_url" type="url" value="${esc(s.reservation_url||'https://trilheirosderondonopolis.my.canva.site/')}" required></label><label><span>Limite por pessoa a cada hora</span><input name="max_user_replies_hour" type="number" min="2" max="20" value="${Number(s.max_user_replies_hour||8)}"></label><div class="igSettingsActions"><button class="btn primary">Salvar configurações</button><small id="igSettingsMsg"></small></div></form></section>`;
}

function simulatorPanel(){
  return `<section class="panel igPanel"><div class="panelHead"><div><span class="eyebrow">TESTE SEM ENVIAR</span><h2>Veja como ele responderia</h2><p>Nenhuma mensagem é enviada ao Instagram neste teste.</p></div></div><form id="igSimulator" class="igSimulator"><select name="trip_id"><option value="">Identificar passeio pela pergunta</option>${(state.trips||[]).filter(t=>!['cancelled','completed'].includes(t.status)).map(t=>`<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('')}</select><input name="text" placeholder="Ex.: Ainda tem vaga? É difícil?" required><button class="btn primary">Testar resposta</button></form><div id="igSimulationResult"></div></section>`;
}

function conversationRow(item){
  const status=item.status==='answered'?'Respondido':item.status==='human'?'Jonatas assumiu':item.status==='needs_human'?'Precisa de você':item.status==='error'?'Erro':'Sugestão pronta';
  return `<article class="igConversation ${esc(item.status||'')}"><div class="igConversationHead"><div><b>${esc(item.actor_name?`@${item.actor_name}`:'Pessoa no Instagram')}</b><span>${item.channel==='comment'?'💬 Comentário':'📩 Direct'} • ${ago(item.updated_at)}</span></div><span class="igConversationStatus">${status}</span></div>${item.trip_name?`<small class="igTrip">🥾 ${esc(item.trip_name)}</small>`:''}<div class="igBubble incoming">${esc(item.last_incoming_text||'')}</div>${item.last_outgoing_text?`<div class="igBubble outgoing">${esc(item.last_outgoing_text)}</div>`:''}${item.suggested_reply?`<div class="igSuggestion"><small>RESPOSTA SUGERIDA</small><p>${esc(item.suggested_reply)}</p></div>`:''}${item.last_error?`<div class="igError">${esc(item.last_error)}</div>`:''}<div class="igConversationActions"><button class="btn ghost" data-ig-reply="${esc(item.id)}">Responder</button><button class="btn ${item.human_takeover?'ghost':'primary'}" data-ig-takeover="${esc(item.id)}" data-enabled="${item.human_takeover?'false':'true'}">${item.human_takeover?'Liberar assistente':'Jonatas assume'}</button>${item.media_permalink?`<a class="btn ghost" target="_blank" rel="noopener" href="${esc(item.media_permalink)}">Ver publicação</a>`:''}</div></article>`;
}

function conversationsPanel(items=[]){
  return `<section class="panel igPanel"><div class="panelHead"><div><span class="eyebrow">ATENDIMENTOS</span><h2>Comentários e Direct</h2><p>${items.length?`${items.length} conversa(s) mais recente(s).`:'As conversas aparecerão aqui depois que o webhook receber a primeira interação.'}</p></div><button class="btn ghost" id="igRefresh">Atualizar</button></div><div class="igConversationList">${items.length?items.map(conversationRow).join(''):'<div class="empty">Nenhuma conversa recebida ainda.</div>'}</div></section>`;
}

function onboarding(data){
  if(data.connection?.connected)return'';
  return `<section class="panel igPanel igOnboarding"><div class="panelHead"><div><span class="eyebrow">ATIVAÇÃO SEGURA</span><h2>O que falta para começar</h2></div></div><ol><li><b>Conta profissional:</b> confirmar o @trilheiros.roomt como conta profissional.</li><li><b>Aplicativo Meta:</b> autorizar mensagens, comentários e webhooks.</li><li><b>Webhook:</b> cadastrar <code>${esc(data.webhook_url||'https://trilheiros-reservas.web.app/instagram/webhook')}</code>.</li><li><b>Primeiro teste:</b> usar “Sugerir respostas”; depois ativar o automático.</li></ol><div class="igSafety">🛡️ Não usamos sua senha do Instagram, robô de navegador ou envio em massa.</div></section>`;
}

async function renderInstagram(){
  if(rendering||typeof state==='undefined'||state.tab!=='instagram')return;rendering=true;
  const content=q('#content');if(!content){rendering=false;return}q('#pageTitle')&&(q('#pageTitle').textContent='Assistente Instagram');
  content.innerHTML='<div class="empty" style="padding:70px">Carregando o atendente do Instagram...</div>';
  try{
    const [data,conversations]=await Promise.all([request('status'),request('conversations')]);lastData=data;
    content.innerHTML=`${statusCard(data)}<div class="igGrid">${settingsPanel(data)}${simulatorPanel()}</div>${onboarding(data)}${conversationsPanel(conversations.conversations||[])}`;
    bind(data,conversations.conversations||[]);
  }catch(error){content.innerHTML=`<section class="panel igPanel"><div class="msg error"><b>Integração ainda não publicada</b><br>${esc(error.message||error)}</div><p>A estrutura do painel está pronta. Assim que as credenciais oficiais da Meta forem conectadas, o status aparecerá aqui.</p></section>`}
  finally{rendering=false}
}

function bind(data,items){
  const form=q('#igSettings');if(form)form.onsubmit=async event=>{event.preventDefault();const button=q('button',form),message=q('#igSettingsMsg');button.disabled=true;message.textContent='Salvando...';try{await request('settings',{method:'POST',body:{enabled:form.enabled.checked,mode:form.mode.value,reply_comments:form.reply_comments.checked,reply_messages:form.reply_messages.checked,comment_to_dm:form.comment_to_dm.checked,reservation_url:form.reservation_url.value,max_user_replies_hour:Number(form.max_user_replies_hour.value),account_username:'trilheiros.roomt'}});notify('Configurações do Instagram salvas.');await renderAgain()}catch(error){notify(error.message||error,'error');message.textContent=error.message||error}finally{button.disabled=false}};
  const sim=q('#igSimulator');if(sim)sim.onsubmit=async event=>{event.preventDefault();const target=q('#igSimulationResult'),button=q('button',sim);button.disabled=true;target.innerHTML='<div class="empty">Montando resposta...</div>';try{const result=await request('simulate',{method:'POST',body:{trip_id:sim.trip_id.value,text:sim.text.value,channel:'dm',actor_name:'Visitante'}});target.innerHTML=`<div class="igSimulation"><small>${result.trip?`PASSEIO: ${esc(result.trip.name)}`:'PASSEIO NÃO IDENTIFICADO'} • INTENÇÃO: ${esc(result.intent)}</small><p>${esc(result.reply)}</p>${result.needsHuman?'<span>👤 Será encaminhado ao Jonatas</span>':'<span>🤖 Pode responder automaticamente</span>'}</div>`}catch(error){target.innerHTML=`<div class="msg error">${esc(error.message||error)}</div>`}finally{button.disabled=false}};
  q('#igRefresh')?.addEventListener('click',renderAgain);
  document.querySelectorAll('[data-ig-takeover]').forEach(button=>button.onclick=async()=>{button.disabled=true;try{await request('takeover',{method:'POST',body:{conversation_id:button.dataset.igTakeover,enabled:button.dataset.enabled==='true'}});notify(button.dataset.enabled==='true'?'Conversa pausada para você.':'Assistente liberado nesta conversa.');await renderAgain()}catch(error){notify(error.message||error,'error');button.disabled=false}});
  document.querySelectorAll('[data-ig-reply]').forEach(button=>button.onclick=()=>openReply(items.find(x=>x.id===button.dataset.igReply)));
}

function openReply(item){
  if(!item)return;document.getElementById('igReplyModal')?.remove();const back=document.createElement('div');back.id='igReplyModal';back.className='modalBack';back.innerHTML=`<div class="modal igReplyModal"><form><div class="modalHead"><div><span class="eyebrow">RESPONDER NO INSTAGRAM</span><h2>${esc(item.actor_name?`@${item.actor_name}`:'Conversa')}</h2></div><button type="button" class="iconClose">✕</button></div><div class="modalBody"><div class="igBubble incoming">${esc(item.last_incoming_text||'')}</div><label><span>Sua resposta</span><textarea name="text" rows="6" maxlength="1000" required>${esc(item.suggested_reply||'')}</textarea></label><div class="igSafety">Ao enviar, o assistente pausa nesta conversa para não responder junto com você.</div><div id="igReplyMsg"></div></div><div class="modalFoot"><button type="button" class="btn ghost igCancel">Cancelar</button><button class="btn primary">Enviar resposta</button></div></form></div>`;document.body.appendChild(back);q('.iconClose',back).onclick=q('.igCancel',back).onclick=()=>back.remove();q('form',back).onsubmit=async event=>{event.preventDefault();const button=q('.btn.primary',back);button.disabled=true;try{await request('reply',{method:'POST',body:{conversation_id:item.id,text:event.target.text.value}});back.remove();notify('Resposta enviada pelo Instagram.');await renderAgain()}catch(error){q('#igReplyMsg',back).innerHTML=`<div class="msg error">${esc(error.message||error)}</div>`;button.disabled=false}}}

async function renderAgain(){rendering=false;await renderInstagram()}

function patch(){
  if(typeof window.renderAdmin!=='function'||window.renderAdmin.__instagramAssistant)return false;
  const previous=window.renderAdmin;window.renderAdmin=function(...args){const result=previous.apply(this,args);injectNav();if(state.tab==='instagram')setTimeout(renderInstagram,0);return result};window.renderAdmin.__instagramAssistant=true;try{renderAdmin=window.renderAdmin}catch(_){}injectNav();return true;
}

const observer=new MutationObserver(()=>{injectNav();if(typeof state!=='undefined'&&state.tab==='instagram'&&!q('.igStatus')&&!rendering)setTimeout(renderInstagram,30)});observer.observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('load',()=>{patch();injectNav();if(new URLSearchParams(location.search).get('tab')==='instagram'&&typeof state!=='undefined'){state.tab='instagram';window.renderAdmin()}});
let attempts=0;const timer=setInterval(()=>{attempts++;if(patch()||attempts>40)clearInterval(timer)},100);
})();

