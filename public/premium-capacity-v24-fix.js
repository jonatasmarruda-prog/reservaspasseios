/* Trilheiros Gestão V24.1 — capacidade exibida sempre respeita a vaga fixa do guia */
(function(){
  function effectiveRemaining(t){
    const total=Math.max(0,Number(t?.total_spots||0));
    const used=Math.max(0,Number(t?.used_spots||0));
    const raw=Math.max(0,Number(t?.remaining_spots||0));
    if(!total)return raw;
    const guideCounted=t?.special_seat_reserved===true||t?.special_seat_counted===true;
    return Math.max(0,Math.min(raw,total-used-(guideCounted?0:1)));
  }

  const base=window.renderRegistration;
  if(typeof base!=='function'||base.__capacityDisplayV241)return;

  const wrapped=function(trips,fixed){
    const list=(Array.isArray(trips)?trips:[]).map(t=>({...t,remaining_spots:effectiveRemaining(t)}));
    return base.call(this,list,fixed);
  };
  wrapped.__capacityDisplayV241=true;
  window.renderRegistration=wrapped;
  try{globalThis.renderRegistration=wrapped}catch(_){ }
})();
