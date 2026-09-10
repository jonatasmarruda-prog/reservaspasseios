import {getDb,verifyFirebaseBearer} from './_lib/firebase.js';

const mpToken=()=>process.env.MERCADO_PAGO_ACCESS_TOKEN||'';
const webhookUrl=()=>process.env.MP_WEBHOOK_URL||'';
const returnBase=()=>String(process.env.PUBLIC_RETURN_URL||'https://trilheirosderondonopolis.my.canva.site/').replace(/\/$/,'');
const num=v=>Math.max(0,Number(v||0)||0);
const json=(res,status,data)=>res.status(status).setHeader('Content-Type','application/json').end(JSON.stringify(data));

export default async function handler(req,res){
  if(req.method!=='POST')return json(res,405,{ok:false,error:'Método não permitido'});
  try{
    if(!mpToken())throw Object.assign(new Error('Mercado Pago ainda não configurado no servidor'),{status:503});
    const user=await verifyFirebaseBearer(req),saleId=String(req.body?.saleId||'').trim();
    if(!saleId)throw Object.assign(new Error('Venda não informada'),{status:400});
    const db=getDb(),saleRef=db.collection('sales').doc(saleId),ss=await saleRef.get();
    if(!ss.exists)throw Object.assign(new Error('Venda não encontrada'),{status:404});
    const sale=ss.data();
    if(sale.sale_status==='cancelled')throw Object.assign(new Error('Venda cancelada'),{status:409});
    if(sale.claimed_uid&&sale.claimed_uid!==user.uid)throw Object.assign(new Error('Venda não pertence a esta sessão'),{status:403});
    const total=num(sale.sale_total)>0?num(sale.sale_total):num(sale.paid_amount)+num(sale.balance_due);
    const balance=Math.max(0,num(sale.balance_due)>0?num(sale.balance_due):total-num(sale.paid_amount));
    if(balance<=0.009)return json(res,200,{ok:true,alreadyPaid:true});
    const body={
      items:[{id:sale.trip_id||saleId,title:sale.trip_name||'Passeio Trilheiros',quantity:1,currency_id:'BRL',unit_price:Number(balance.toFixed(2))}],
      external_reference:saleId,
      notification_url:webhookUrl()||undefined,
      payer:sale.customer_email?{email:sale.customer_email}:undefined,
      back_urls:{success:`${returnBase()}?pagamento=sucesso`,pending:`${returnBase()}?pagamento=pendente`,failure:`${returnBase()}?pagamento=falhou`},
      auto_return:'approved',
      statement_descriptor:'TRILHEIROS'
    };
    const r=await fetch('https://api.mercadopago.com/checkout/preferences',{method:'POST',headers:{Authorization:`Bearer ${mpToken()}`,'Content-Type':'application/json','X-Idempotency-Key':`trilheiros-${saleId}-${Math.round(balance*100)}`},body:JSON.stringify(body)});
    const data=await r.json();if(!r.ok)throw Object.assign(new Error(data?.message||`Mercado Pago ${r.status}`),{status:502,details:data});
    const stamp=new Date().toISOString(),patch={mercado_pago_preference_id:data.id||'',mercado_pago_init_point:data.init_point||'',mercado_pago_checkout_created_at:stamp,updated_at:stamp};
    await saleRef.set(patch,{merge:true});
    await db.collection('trips').doc(sale.trip_id).collection('reservations').doc(saleId).set(patch,{merge:true}).catch(()=>{});
    return json(res,200,{ok:true,preferenceId:data.id,initPoint:data.init_point,sandboxInitPoint:data.sandbox_init_point||''});
  }catch(e){console.error('checkout',e);return json(res,e.status||500,{ok:false,error:e.message||'Erro ao iniciar pagamento'})}
}
