import admin from 'firebase-admin';
const raw=process.env.FIREBASE_SERVICE_ACCOUNT||'';
const minutes=Math.max(15,Number(process.env.PENDING_HOLD_MINUTES||60));
if(!raw){console.log('FIREBASE_SERVICE_ACCOUNT ausente.');process.exit(0)}
let service;try{service=JSON.parse(raw)}catch{console.error('FIREBASE_SERVICE_ACCOUNT inválido.');process.exit(1)}
admin.initializeApp({credential:admin.credential.cert(service)});
const db=admin.firestore(),FV=admin.firestore.FieldValue;
const cutoff=Date.now()-minutes*60000;
const snap=await db.collection('sales').where('payment_status','==','pending').get();
let flagged=0,skipped=0,failed=0;
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
      const [ss,rs]=await Promise.all([tx.get(saleRef),tx.get(resRef)]);
      if(!ss.exists)return;
      const sd=ss.data(),rd=rs.exists?rs.data():{};
      if(sd.payment_status!=='pending'||Number(sd.paid_amount||0)>0||sd.sale_status==='cancelled'||rd.status==='cancelled')return;
      const now=FV.serverTimestamp();
      const reason=`Pagamento ainda não confirmado após ${minutes} minutos — conferir manualmente antes de liberar a vaga`;
      tx.update(saleRef,{payment_review_required:true,payment_alert_pending:true,payment_review_reason:reason,payment_review_flagged_at:now,updated_at:now});
      if(rs.exists)tx.update(resRef,{payment_review_required:true,payment_alert_pending:true,payment_review_reason:reason,payment_review_flagged_at:now,updated_at:now});
    });
    flagged++;
  }catch(e){failed++;console.error(`Falha ${doc.id}:`,e.message)}
}
console.log(`Pendências sinalizadas para conferência: ${flagged} | ignoradas: ${skipped} | falhas: ${failed}`);
if(failed)process.exitCode=1;
