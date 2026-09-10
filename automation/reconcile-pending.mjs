import admin from 'firebase-admin';
const raw=process.env.FIREBASE_SERVICE_ACCOUNT||'';
const minutes=Math.max(15,Number(process.env.PENDING_HOLD_MINUTES||60));
if(!raw){console.log('FIREBASE_SERVICE_ACCOUNT ausente.');process.exit(0)}
let service;try{service=JSON.parse(raw)}catch{console.error('FIREBASE_SERVICE_ACCOUNT inválido.');process.exit(1)}
admin.initializeApp({credential:admin.credential.cert(service)});
const db=admin.firestore(),FV=admin.firestore.FieldValue;
const cutoff=Date.now()-minutes*60000;
const snap=await db.collection('sales').where('payment_status','==','pending').get();
let released=0,skipped=0,failed=0;
for(const doc of snap.docs){
  const s=doc.data();
  if(s.sale_status==='cancelled'||s.sale_status==='expired'){skipped++;continue}
  const source=String(s.source||'');
  if(!source.startsWith('public_portal_')&&s.channel!=='canva_reserva_passeios'){skipped++;continue}
  if(Number(s.paid_amount||0)>0){skipped++;continue}
  const created=s.created_at?.toMillis?.()||s.updated_at?.toMillis?.()||0;
  if(!created||created>cutoff){skipped++;continue}
  try{
    const saleRef=doc.ref,tripRef=db.collection('trips').doc(s.trip_id),resRef=tripRef.collection('reservations').doc(doc.id);
    await db.runTransaction(async tx=>{
      const [ss,ts,rs]=await Promise.all([tx.get(saleRef),tx.get(tripRef),tx.get(resRef)]);
      if(!ss.exists||!ts.exists||!rs.exists)return;
      const sd=ss.data(),td=ts.data(),rd=rs.data();
      if(sd.payment_status!=='pending'||Number(sd.paid_amount||0)>0||sd.sale_status==='cancelled'||rd.status==='cancelled')return;
      const seats=Math.max(0,Number(sd.seats||rd.seats||0));
      const now=FV.serverTimestamp();
      const guideFloor=td.special_seat_counted===true?1:0;
      const used=Math.max(guideFloor,Number(td.used_spots||guideFloor)-seats);
      const remaining=Math.max(0,Number(td.total_spots||0)>0?Number(td.total_spots)-used:Number(td.remaining_spots||0)+seats);
      tx.update(saleRef,{sale_status:'cancelled',payment_status:'cancelled',balance_due:0,cancel_reason:`Pagamento não confirmado em ${minutes} minutos — vaga liberada automaticamente`,expired_at:now,cancelled_at:now,updated_at:now});
      tx.update(resRef,{status:'cancelled',payment_status:'cancelled',balance_due:0,cancel_reason:`Pagamento não confirmado em ${minutes} minutos — vaga liberada automaticamente`,expired_at:now,updated_at:now});
      tx.update(tripRef,{used_spots:used,remaining_spots:remaining,updated_at:now});
    });
    released++;
  }catch(e){failed++;console.error(`Falha ${doc.id}:`,e.message)}
}
console.log(`Pendências liberadas: ${released} | ignoradas: ${skipped} | falhas: ${failed}`);
if(failed)process.exitCode=1;
