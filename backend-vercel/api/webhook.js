import {getDb} from './_lib/firebase.js';

const token=()=>process.env.MERCADO_PAGO_ACCESS_TOKEN||'';
const num=v=>Math.max(0,Number(v||0)||0;
const json=(res,status,data)=>res.status(status).setHeader('Content-Type','application/json').end(JSON.stringify(data));

export default async function handler(req,res){
  if(req.method!=='POST'&&req.method!=='GET')return json(res,405,{ok:false});
  try{
    if(!token())return json(res,503,{ok:false,error:'Mercado Pago não configurado'});
    const paymentId=String(req.body?.data?.id||req.query?.['data.id']||req.query?.id||'').trim();
    if(!paymentId)return json(res,200,{ok:true,ignored:'sem payment id'});
    const rp=await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`,{headers:{Authorization:`Bearer ${token()}`}}),payment=await rp.json();
    if(!rp.ok)throw new Error(payment?.message||`Mercado Pago ${rp.status}`);
    const saleId=String(payment.external_reference||'').trim();if(!saleId)return json(res,200,{ok:true,ignored:'sem external_reference'});
    const db=getDb(),eventRef=db.collection('payment_events').doc(`mp_${paymentId}`),saleRef=db.collection('sales').doc(saleId);
    await db.runTransaction(async tx=>{
      const [eventSnap,saleSnap]=await Promise.all([tx.get(eventRef),tx.get(saleRef)]);if(eventSnap.exists)return;if(!saleSnap.exists){tx.set(eventRef,{provider:'mercado_pago',payment_id:paymentId,status:payment.status||'',ignored:'sale_not_found',created_at:new Date().toISOString()});return}
      const sale=saleSnap.data(),resRef=db.collection('trips').doc(sale.trip_id).collection('reservations').doc(saleId),resSnap=await tx.get(resRef),total=num(sale.sale_total)>0?num(sale.sale_total):num(sale.paid_amount)+num(sale.balance_due),amount=num(payment.transaction_amount),oldPaid=num(sale.paid_amount),oldRefund=num(sale.refunded_amount),stamp=new Date().toISOString();
      const entry={amount:Number(amount.toFixed(2)),date:String(payment.date_approved||payment.date_created||stamp).slice(0,10),method:payment.payment_type_id==='credit_card'||payment.payment_type_id==='debit_card'?'card':'pix',source:'mercado_pago_webhook',provider_payment_id:paymentId,status:payment.status||''};
      let patch={updated_at:stamp,mercado_pago_payment_id:paymentId,mercado_pago_status:payment.status||'',mercado_pago_status_detail:payment.status_detail||''};
      if(payment.status==='approved'){
        const newPaid=Math.min(total,Number((oldPaid+amount).toFixed(2))),balance=Math.max(0,Number((total-newPaid).toFixed(2)));patch={...patch,paid_amount:newPaid,balance_due:balance,payment_status:balance<=0.009?'paid':'partial',received_date:entry.date,payment_history:[...(sale.payment_history||[]),entry],payment_verified:true,payment_verified_at:stamp,payment_verified_provider:'mercado_pago'};
      }else if(['refunded','charged_back'].includes(payment.status)){
        const refunded=Math.max(oldRefund,num(payment.transaction_amount_refunded)||amount);patch={...patch,refunded_amount:refunded,payment_status:payment.status==='refunded'?'refunded':'cancelled',payment_verified:true,payment_verified_at:stamp,payment_verified_provider:'mercado_pago'};
      }
      tx.update(saleRef,patch);if(resSnap.exists)tx.update(resRef,patch);tx.set(eventRef,{provider:'mercado_pago',payment_id:paymentId,sale_id:saleId,status:payment.status||'',amount,processed_at:stamp});
    });
    return json(res,200,{ok:true});
  }catch(e){console.error('webhook',e);return json(res,500,{ok:false,error:'Falha no webhook'})}
}
