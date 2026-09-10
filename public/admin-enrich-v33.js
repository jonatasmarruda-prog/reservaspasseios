/* Trilheiros Gestão V33 — completa tipo/opção e parcelas a partir da venda do Canva */
(function(){
'use strict';
if(typeof state==='undefined')return;
const loaded=new Set();let running=null;
const installmentFallback={salto_nuvens:2,nobres_bom_jardim:2,rio_cristalino:3,jaciara_canyon:3};
function kind(v){v=String(v||'').toLowerCase();return v.includes('parcel')||v.includes('install')?'pix_installment':v.includes('card')||v.includes('cart')?'card':v.includes('pix')?'pix':'other'}
function normalizeCategory(v){const s=String(v||'').trim();if(!s)return'';const k=s.toLowerCase();if(k==='adult'||k==='adulto')return'Individual';if(k==='child'||k==='crianca'||k==='criança')return'Criança';return s}
async function enrich(force=false){
  if(running)return running;
  running=(async()=>{
    let changed=false;
    const rs=(state.reservations||[]);
    for(const r of rs){
      if(kind(r.payment_method)==='pix_installment'&&!Number(r.installment_total||0)&&installmentFallback[r.trip_id]){r.installment_total=installmentFallback[r.trip_id];changed=true}
      if(r.category){const c=normalizeCategory(r.category);if(c!==r.category){r.category=c;changed=true}}
    }
    const targets=rs.filter(r=>{
      const sid=r.sale_id||r.id;
      return sid&&!loaded.has(sid)&&(!r.category||!r.sale_total||kind(r.payment_method)==='pix_installment'&&!r.installment_total);
    });
    if(targets.length&&typeof db!=='undefined'){
      const snaps=await Promise.all(targets.map(async r=>{const sid=r.sale_id||r.id;try{return[r,sid,await db.collection('sales').doc(sid).get()]}catch{return[r,sid,null]}}));
      for(const [r,sid,s] of snaps){loaded.add(sid);if(!s?.exists)continue;const d=s.data()||{};
        if(!r.category&&d.category){r.category=normalizeCategory(d.category);changed=true}
        if(!r.accommodation&&d.accommodation){r.accommodation=d.accommodation;changed=true}
        if(!r.sale_total&&d.sale_total){r.sale_total=d.sale_total;changed=true}
        if(!r.payment_method&&d.payment_method){r.payment_method=d.payment_method;changed=true}
        if(!r.installment_total&&d.installment_total){r.installment_total=d.installment_total;changed=true}
        if(kind(r.payment_method)==='pix_installment'&&!Number(r.installment_total||0)&&installmentFallback[r.trip_id]){r.installment_total=installmentFallback[r.trip_id];changed=true}
      }
    }
    return changed;
  })();
  try{return await running}finally{running=null}
}
const oldRender=window.renderAdmin;if(typeof oldRender==='function'){window.renderAdmin=function(...a){const out=oldRender.apply(this,a);const tab=state.tab;setTimeout(async()=>{if(!['pending','reports'].includes(tab)||state.tab!==tab)return;const changed=await enrich();if(changed&&state.tab===tab&&typeof window.renderAdmin==='function')setTimeout(()=>window.renderAdmin(),0)},60);return out};try{renderAdmin=window.renderAdmin}catch(_){}}
const oldPdf=window.pdfTrip;if(typeof oldPdf==='function')window.pdfTrip=async function(id){await enrich(true);return oldPdf(id)};try{pdfTrip=window.pdfTrip}catch(_){}
const oldCsv=window.insuranceCsvV7;if(typeof oldCsv==='function')window.insuranceCsvV7=async function(id){await enrich(true);return oldCsv(id)};try{insuranceCsvV7=window.insuranceCsvV7}catch(_){}
const oldRooms=window.roomsPdfV7;if(typeof oldRooms==='function')window.roomsPdfV7=async function(id){await enrich(true);return oldRooms(id)};try{roomsPdfV7=window.roomsPdfV7}catch(_){}
const oldOpen=window.openPendingPaymentV32;if(typeof oldOpen==='function')window.openPendingPaymentV32=async function(tripId,id){await enrich(true);return oldOpen(tripId,id)};
const oldConfirm=window.confirmPendingPaymentV32;if(typeof oldConfirm==='function')window.confirmPendingPaymentV32=async function(tripId,id,saleId){await enrich(true);const r=(state.reservations||[]).find(x=>x.trip_id===tripId&&x.id===id);if(r&&kind(r.payment_method)==='pix_installment'&&!Number(r.installment_total||0)&&installmentFallback[tripId]){r.installment_total=installmentFallback[tripId];try{const patch={installment_total:r.installment_total,updated_at:firebase.firestore.FieldValue.serverTimestamp()};await db.collection('trips').doc(tripId).collection('reservations').doc(id).update(patch);const sid=saleId||r.sale_id||id;const s=await db.collection('sales').doc(sid).get();if(s.exists)await s.ref.update(patch)}catch(e){console.warn('V33 parcelas:',e)}}return oldConfirm(tripId,id,saleId)};
})();
