import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReply,detectIntent,remainingSpots,resolveTrip } from '../instagram-assistant-core.js';

const trips=[
  {id:'canyon',name:'Jaciara – Cânion das Índias',destination:'Jaciara – MT',trip_date:'2099-11-15',status:'open',default_price:365,card_price:389,total_spots:40,used_spots:12,difficulty:'Moderado',minimum_age:14,included_items:'Transporte, almoço e seguro'},
  {id:'rio',name:'Rio Cristalino + Aldeia Dom Bosco',destination:'Poxoréu – MT',trip_date:'2099-11-08',status:'open',default_price:355,remaining_spots:7}
];

test('identifica passeio pelo nome no texto',()=>{
  assert.equal(resolveTrip({text:'Qual o valor do Cânion das Índias?',trips})?.id,'canyon');
});

test('usa a publicação para identificar o passeio',()=>{
  assert.equal(resolveTrip({text:'Tem vaga?',mediaCaption:'Conheça o Rio Cristalino em Poxoréu',trips})?.id,'rio');
});

test('calcula vagas sem alterar o passeio',()=>{
  assert.equal(remainingSpots(trips[0]),28);
  assert.equal(remainingSpots(trips[1]),7);
});

test('responde valor com dados reais do passeio',()=>{
  const result=buildReply({text:'Quanto custa?',trip:trips[0],trips,channel:'dm',seed:'a'});
  assert.equal(result.intent,'price');
  assert.equal(result.needsHuman,false);
  assert.match(result.reply,/R\$\s*365,00/);
  assert.match(result.reply,/R\$\s*389,00/);
});

test('não inventa idade quando o campo não existe',()=>{
  const result=buildReply({text:'Criança pode?',trip:trips[1],trips,channel:'dm'});
  assert.equal(result.needsHuman,true);
  assert.match(result.reply,/Jonatas/);
});

test('pagamento informado sempre vai para conferência humana',()=>{
  assert.equal(detectIntent('Paguei no PIX e estou mandando o comprovante'),'payment_review');
  const result=buildReply({text:'Paguei no PIX',trip:trips[0],trips});
  assert.equal(result.needsHuman,true);
  assert.match(result.reply,/conferido no banco/);
});

test('cancelamento nunca é decidido automaticamente',()=>{
  const result=buildReply({text:'Quero cancelar e pedir reembolso',trip:trips[0],trips});
  assert.equal(result.intent,'cancellation');
  assert.equal(result.needsHuman,true);
});

test('não inventa lista de itens quando ela não está cadastrada',()=>{
  const result=buildReply({text:'O que preciso levar?',trip:trips[1],trips});
  assert.equal(result.needsHuman,true);
  assert.match(result.reply,/não está cadastrada/);
});

test('sem passeio pede escolha e lista opções abertas',()=>{
  const result=buildReply({text:'Qual o valor?',trips,trip:null});
  assert.match(result.reply,/qual passeio/i);
  assert.match(result.reply,/Cânion das Índias/);
});

test('comentário só com emoji recebe resposta acolhedora',()=>{
  const result=buildReply({text:'😍🥾',trip:trips[0],trips,channel:'comment'});
  assert.equal(result.intent,'reaction');
  assert.equal(result.needsHuman,false);
  assert.match(result.reply,/💚|🥾/u);
});
