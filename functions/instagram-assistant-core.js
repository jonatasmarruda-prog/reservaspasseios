const STOP_WORDS=new Set(['para','como','qual','quanto','sobre','passeio','trilha','viagem','quero','saber','informacao','informacoes','onde','quando','esse','essa','este','esta','tem','uma','dos','das','com','sem','dia']);

export const DEFAULT_RESERVATION_URL='https://trilheirosderondonopolis.my.canva.site/';

export function normalizeText(value=''){
  return String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
}

export function firstName(value=''){
  const name=String(value??'').trim().replace(/^@/,'').split(/[\s._-]+/)[0];
  if(!name)return'';
  return name.charAt(0).toUpperCase()+name.slice(1).toLowerCase();
}

export function formatDateBR(value=''){
  const match=String(value??'').slice(0,10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match?`${match[3]}/${match[2]}/${match[1]}`:'';
}

export function remainingSpots(trip={}){
  const explicit=Number(trip.remaining_spots);
  if(Number.isFinite(explicit))return Math.max(0,Math.floor(explicit));
  const total=Number(trip.total_spots),used=Number(trip.used_spots||0);
  return Number.isFinite(total)?Math.max(0,Math.floor(total-used)):null;
}

export function activeTrips(trips=[],today=''){
  const iso=today||new Intl.DateTimeFormat('en-CA',{timeZone:'America/Cuiaba',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  return trips.filter(t=>!['cancelled','canceled','completed','draft'].includes(String(t.status||'').toLowerCase())&&(!t.trip_date||String(t.trip_date).slice(0,10)>=iso)).sort((a,b)=>String(a.trip_date||'9999').localeCompare(String(b.trip_date||'9999')));
}

function searchableTerms(trip={}){
  const values=[trip.id,trip.portal_template_id,trip.name,trip.destination,trip.location,trip.instagram_aliases].flat().filter(Boolean);
  const phrases=values.map(normalizeText).filter(x=>x.length>=4);
  const words=new Set(phrases.flatMap(x=>x.split(' ')).filter(x=>x.length>=4&&!STOP_WORDS.has(x)));
  return{phrases,words:[...words]};
}

function tripScore(trip,haystack){
  const {phrases,words}=searchableTerms(trip);
  let score=0;
  for(const phrase of phrases){
    if(haystack.includes(phrase))score+=30+Math.min(20,phrase.length);
  }
  for(const word of words){
    if(haystack.split(' ').includes(word))score+=4;
  }
  return score;
}

export function resolveTrip({text='',mediaCaption='',trips=[],preferredTripId=''}={}){
  const open=activeTrips(trips);
  const haystack=normalizeText(`${text} ${mediaCaption}`);
  const ranked=open.map(trip=>({trip,score:tripScore(trip,haystack)})).sort((a,b)=>b.score-a.score);
  if(ranked[0]?.score>=8&&(ranked.length===1||ranked[0].score>ranked[1].score))return ranked[0].trip;
  if(preferredTripId){
    const preferred=open.find(t=>String(t.id)===String(preferredTripId));
    if(preferred)return preferred;
  }
  return open.length===1?open[0]:null;
}

export function detectIntent(text=''){
  const s=normalizeText(text);
  const has=(...terms)=>terms.some(term=>{const value=normalizeText(term);return value.length<=3&&!value.includes(' ')?s.split(' ').includes(value):s.includes(value)});
  if(!s)return'reaction';
  if(has('acidente','machuquei','machucado','hospital','urgente','emergencia','passei mal','socorro'))return'emergency';
  if(has('cancelar','cancelamento','reembolso','estorno','devolver dinheiro','desistir'))return'cancellation';
  if(has('reclamacao','reclamar','processo','procon','enganado','golpe','absurdo'))return'complaint';
  if(has('paguei','comprovante','pagamento nao caiu','pagamento não caiu','pix nao caiu','pix não caiu','cobrou duas vezes','cobranca duplicada'))return'payment_review';
  if(has('link','reservar','reserva','garantir vaga','como faco para ir','como faço para ir','quero ir','eu vou'))return'booking';
  if(has('valor','preco','preço','quanto custa','quanto e','quanto é','pix','cartao','cartão','parcelado'))return'price';
  if(has('vaga','vagas','lotado','disponivel','disponível'))return'spots';
  if(has('crianca','criança','menor','idade minima','idade mínima','anos pode'))return'children';
  if(has('dificil','difícil','nivel','nível','pesada','puxada','iniciante','consigo fazer','sedentario','sedentário'))return'difficulty';
  if(has('inclui','incluso','inclusa','o que vem','pacote'))return'included';
  if(has('saida','saída','horario','horário','embarque','ponto de encontro','retorno'))return'departure';
  if(has('data','quando','qual dia'))return'date';
  if(has('onde fica','local','cidade','destino','onde e','onde é'))return'location';
  if(has('levar','roupa','tenis','tênis','perneira','colete','mochila'))return'what_to_bring';
  if(has('obrigado','obrigada','valeu','show','top','perfeito','lindo','linda','amei','maravilhoso','maravilhosa'))return'thanks';
  if(has('oi','ola','olá','bom dia','boa tarde','boa noite','opa'))return'greeting';
  return'general';
}

function pick(seed='',variants=[]){
  let hash=0;for(const char of String(seed))hash=(hash*31+char.charCodeAt(0))>>>0;
  return variants[variants.length?hash%variants.length:0]||'';
}

function money(value){
  const n=Number(value);
  return Number.isFinite(n)&&n>0?new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n):'';
}

function priceText(trip={}){
  const pix=money(trip.pix_price??trip.pix??trip.default_price);
  const card=money(trip.card_price??trip.card);
  const couplePix=money(trip.couple_pix_price),coupleCard=money(trip.couple_card_price);
  if(couplePix||coupleCard){
    const individual=[pix&&`${pix} no PIX`,card&&`${card} no cartão`].filter(Boolean).join(' ou ');
    const couple=[couplePix&&`${couplePix} no PIX`,coupleCard&&`${coupleCard} no cartão`].filter(Boolean).join(' ou ');
    return[individual&&`individual: ${individual}`,couple&&`casal: ${couple}`].filter(Boolean).join('; ');
  }
  return[pix&&`${pix} no PIX`,card&&`${card} no cartão`].filter(Boolean).join(' ou ');
}

function tripName(trip={}){return String(trip.name||'este passeio').replace(/^\p{Extended_Pictographic}+\s*/u,'').trim()||'este passeio'}
function includedText(trip={}){
  if(Array.isArray(trip.included_items))return trip.included_items.filter(Boolean).join(', ');
  return String(trip.included_items||trip.includes||'').replace(/\s*[|;]\s*/g,', ').trim();
}

function intro(name,seed){
  const n=firstName(name);
  return pick(seed,[n?`Oi, ${n}! 😊`:'Oi! 😊',n?`Olá, ${n}! 🥾`:'Olá! 🥾','Claro! 💚']);
}

function listTrips(trips=[]){
  const list=activeTrips(trips).slice(0,4);
  if(!list.length)return'No momento não encontrei um passeio aberto no sistema. Vou deixar o Jonatas confirmar a próxima programação para você. 👍';
  return`Temos estes próximos passeios:\n${list.map(t=>`• ${tripName(t)}${formatDateBR(t.trip_date)?` — ${formatDateBR(t.trip_date)}`:''}`).join('\n')}\n\nQual deles você quer conhecer melhor?`;
}

export function buildReply({text='',trip=null,trips=[],channel='dm',actorName='',seed='',reservationUrl=DEFAULT_RESERVATION_URL}={}){
  const intent=detectIntent(text),hello=intro(actorName,seed||text),name=tripName(trip||{}),short=channel==='comment';
  const handoff={needsHuman:true,intent,reply:''};
  if(intent==='reaction')return{needsHuman:false,intent,reply:pick(seed||text,['Que bom ter você por aqui! 🥾💚','Natureza e boas experiências esperam por você! 💚','Vem viver essa experiência com a gente! 🥾'])};
  if(intent==='emergency')return{...handoff,reply:'Sinto muito por isso. Se houver risco imediato, procure o atendimento de emergência da sua região. Também vou sinalizar agora para o Jonatas acompanhar pessoalmente.'};
  if(intent==='cancellation')return{...handoff,reply:`Entendi. Cancelamento e reembolso precisam ser conferidos pelo Jonatas conforme a sua reserva e a política do passeio. Vou deixar seu atendimento sinalizado para ele, tudo bem? 👍`};
  if(intent==='complaint')return{...handoff,reply:'Entendi e agradeço por avisar. Vou deixar esta conversa diretamente para o Jonatas analisar e responder com atenção.'};
  if(intent==='payment_review')return{...handoff,reply:'Recebi sua mensagem. Para sua segurança, o pagamento precisa ser conferido no banco antes da confirmação. Vou sinalizar para o Jonatas verificar pessoalmente. 👍'};
  if(intent==='thanks')return{needsHuman:false,intent,reply:pick(seed||text,['Por nada! 😊 Qualquer dúvida, estou por aqui.','Tamo junto! 🥾💚 Se precisar, é só chamar.','Que bom! 😊 Vai ser um prazer ter você com a gente.'])};
  if(!trip){
    if(intent==='greeting')return{needsHuman:false,intent,reply:`${hello} Eu sou o assistente dos Trilheiros de Rondonópolis. Posso explicar valores, vagas, datas, nível e o que está incluso.\n\n${listTrips(trips)}`};
    return{needsHuman:false,intent,reply:`${hello} Para eu te passar a informação certa, me diga qual passeio você quer saber.\n\n${listTrips(trips)}`};
  }
  if(intent==='price'){
    const price=priceText(trip);
    if(!price)return{...handoff,reply:`${hello} Vou pedir para o Jonatas confirmar o valor atualizado de ${name} para você, porque esse preço ainda não está completo no sistema.`};
    return{needsHuman:false,intent,reply:short?`${hello} ${name} está ${price}. Quer que eu te passe os detalhes?`:`${hello} ${name} está ${price}. Os valores e opções podem variar conforme a quantidade ou hospedagem. Quer que eu te explique o que está incluso também?`};
  }
  if(intent==='spots'){
    const spots=remainingSpots(trip);
    if(spots===null)return{...handoff,reply:`${hello} Vou confirmar a quantidade atual de vagas de ${name} com o Jonatas e já deixar seu interesse registrado.`};
    if(spots<=0)return{needsHuman:false,intent,reply:`${hello} As vagas de ${name} estão preenchidas no momento. Posso te mostrar os próximos passeios disponíveis. 💚`};
    return{needsHuman:false,intent,reply:`${hello} Tem sim! Neste momento o sistema mostra ${spots} vaga${spots===1?'':'s'} disponível${spots===1?'':'is'} para ${name}. Quer o link para reservar?`};
  }
  if(intent==='children'){
    const age=Number(trip.minimum_age);
    if(Number.isFinite(age)&&age>0)return{needsHuman:false,intent,reply:`${hello} Para ${name}, a idade mínima é ${age} anos. Essa regra é importante para a segurança de todos. 🥾`};
    if(trip.children_allowed===true)return{needsHuman:false,intent,reply:`${hello} Crianças podem participar de ${name}. A idade e o valor infantil podem variar, então me diga a idade da criança para eu orientar melhor.`};
    if(trip.children_allowed===false)return{needsHuman:false,intent,reply:`${hello} Neste passeio não é permitida a participação de crianças. A regra foi definida pelo nível e pelas condições da atividade.`};
    return{...handoff,reply:`${hello} A regra para crianças ainda não está informada neste passeio. Vou deixar o Jonatas confirmar certinho para você. 👍`};
  }
  if(intent==='difficulty'){
    const difficulty=String(trip.difficulty||'').trim(),distance=Number(trip.distance_km);
    if(!difficulty)return{...handoff,reply:`${hello} Vou pedir para o Jonatas confirmar o nível de ${name}, porque essa informação ainda não está completa no sistema.`};
    return{needsHuman:false,intent,reply:`${hello} ${name} é nível ${difficulty}${Number.isFinite(distance)&&distance>0?`, com aproximadamente ${String(distance).replace('.',',')} km`:''}. O esforço também depende do seu condicionamento e das condições do dia. Se você me contar sua experiência com trilhas, consigo orientar melhor. 🥾`};
  }
  if(intent==='included'){
    const items=includedText(trip);
    if(!items)return{...handoff,reply:`${hello} Vou deixar o Jonatas confirmar tudo o que está incluso em ${name}, para não te passar nenhuma informação incompleta.`};
    return{needsHuman:false,intent,reply:`${hello} Em ${name} está incluso: ${items}. Se quiser, também te explico valor, saída e como reservar. 😊`};
  }
  if(intent==='departure'){
    const parts=[trip.departure_time&&`saída às ${trip.departure_time}`,trip.departure_point&&`do ponto ${trip.departure_point}`,trip.return_info&&`retorno ${trip.return_info}`].filter(Boolean);
    if(!parts.length)return{...handoff,reply:`${hello} O horário e o ponto de saída de ${name} ainda serão confirmados pelo Jonatas. Vou sinalizar sua pergunta para ele.`};
    return{needsHuman:false,intent,reply:`${hello} Para ${name}, teremos ${parts.join(', ')}. Perto da data também enviamos as orientações finais aos participantes. 🥾`};
  }
  if(intent==='date'){
    const d=formatDateBR(trip.trip_date);
    return d?{needsHuman:false,intent,reply:`${hello} ${name} será no dia ${d}.${trip.trip_end_date?` O passeio vai até ${formatDateBR(trip.trip_end_date)}.`:''} Quer que eu te passe os valores também?`}:{...handoff,reply:`${hello} Vou confirmar a data de ${name} com o Jonatas para você.`};
  }
  if(intent==='location'){
    const place=String(trip.destination||trip.location||'').trim();
    return place?{needsHuman:false,intent,reply:`${hello} ${name} será em ${place}. A saída do grupo é organizada pelos Trilheiros de Rondonópolis. Quer saber horário ou valor?`}:{...handoff,reply:`${hello} Vou confirmar o local exato de ${name} com o Jonatas para você.`};
  }
  if(intent==='what_to_bring'){
    const bring=String(trip.what_to_bring||'').trim();
    return bring?{needsHuman:false,intent,reply:`${hello} Para ${name}, a orientação é levar: ${bring}. Mais perto da data enviamos o aviso final aos participantes.`}:{...handoff,reply:`${hello} A lista de itens de ${name} ainda não está cadastrada. Vou deixar o Jonatas confirmar a orientação certa para você.`};
  }
  if(intent==='booking')return{needsHuman:false,intent,reply:`${hello} Para reservar ${name}, acesse ${reservationUrl} e escolha o passeio. Se tiver dificuldade, pode chamar o Jonatas no WhatsApp (66) 99692-6174. 🥾💚`};
  if(intent==='greeting')return{needsHuman:false,intent,reply:`${hello} Que bom falar com você! Posso te explicar valor, vagas, data, nível e tudo sobre ${name}. O que você quer saber primeiro?`};
  return{needsHuman:false,intent,reply:`${hello} Sobre ${name}, posso te explicar valores, vagas, data, saída, nível e o que está incluso. Qual dessas informações você quer saber?`};
}
