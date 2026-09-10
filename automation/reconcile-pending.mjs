import admin from 'firebase-admin';
const raw=process.env.FIREBASE_SERVICE_ACCOUNT||'';
const minutes=Math.max(15,Number(process.env.PENDING_HOLD_MINUTES||30));
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
      if(sd.payment_status!=='pending'||Number(sd.paid_amount||0)>0||sd.sale_status==='expired'||rd.status==='expired')return;
      const seats=Math.max(0,Number(sd.seats||rd.seats||0));
      const now=FV.serverTimestamp();
      tx.update(saleRef,{sale_status:'expired',payment_status:'expired',balance_due:0,expired_at:now,updated_at:now,expiration_reason:`Pagamento não confirmado em ${minutes} minutos`});
      tx.update(resRef,{status:'expired',payment_status:'expired',balance_due:0,expired_at:now,updated_at:now});
      tx.update(tripRef,{used_spots:Math.max(1,Number(td.used_spots||1)-seats),remaining_spots:Math.max(0,Number(td.remaining_spots||0)+seats),updated_at:now});
    });
    released++;
  }catch(e){failed++;console.error(`Falha ${doc.id}:`,e.message)}
}
console.log(`Pendências expiradas: ${released} | ignoradas: ${skipped} | falhas: ${failed}`);
if(failed)process.exitCode=1;
