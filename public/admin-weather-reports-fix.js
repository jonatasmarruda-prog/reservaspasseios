/* Trilheiros Gestão — relatórios estáveis + previsão do tempo */
(function(){
'use strict';
if(typeof state==='undefined')return;

const q=(s,r=document)=>r.querySelector(s);
const qa=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const TZ='America/Cuiaba';
const HOME={name:'Rondonópolis',lat:-16.4708,lon:-54.6356};
const WEATHER_TTL=15*60*1000;
const geoCache=new Map(),forecastCache=new Map();
let renderTimer=0;

function today(){return new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
function brDate(v){const s=String(v||'').slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return'—';const[y,m,d]=s.split('-');return`${d}/${m}/${y}`}
function slug(v){return String(v||'passeio').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'').toLowerCase()}
function toastError(e,msg){console.error(msg,e);if(typeof toast==='function')toast(e?.message||msg,'error');else alert(e?.message||msg)}
function setText(el,text){if(el&&el.textContent!==text)el.textContent=text}
function activeTrips(){return(state.trips||[]).filter(t=>t.status!=='cancelled').sort((a,b)=>String(b.trip_date||'').localeCompare(String(a.trip_date||'')))}
function selectedOperationalTripId(){const trips=activeTrips(),native=q('#v40ReportTrip'),id=state.reportTripV40||native?.value||'';return trips.some(t=>t.id===id)?id:(trips[0]?.id||'')}

function weatherLabel(code){const c=Number(code);if(c===0)return'☀️ Céu limpo';if([1,2].includes(c))return'🌤️ Parcialmente nublado';if(c===3)return'☁️ Nublado';if([45,48].includes(c))return'🌫️ Neblina';if([51,53,55,56,57].includes(c))return'🌦️ Garoa';if([61,63,65,66,67].includes(c))return'🌧️ Chuva';if([80,81,82].includes(c))return'🌦️ Pancadas de chuva';if([95,96,99].includes(c))return'⛈️ Trovoadas';return'🌡️ Condições do tempo'}
function knownDestination(t){const x=`${t?.name||''} ${t?.destination||''}`.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();if(x.includes('chapada'))return'Chapada dos Guimarães, Mato Grosso, Brasil';if(x.includes('salto das nuvens')||x.includes('tangara'))return'Tangará da Serra, Mato Grosso, Brasil';if(x.includes('nobres')||x.includes('bom jardim'))return'Nobres, Mato Grosso, Brasil';if(x.includes('rio cristalino')||x.includes('poxoreu')||x.includes('morro da mesa'))return'Poxoréu, Mato Grosso, Brasil';if(x.includes('jaciara')||x.includes('canion das indias'))return'Jaciara, Mato Grosso, Brasil';if(x.includes('barra do garcas'))return'Barra do Garças, Mato Grosso, Brasil';if(x.includes('primavera'))return'Primavera do Leste, Mato Grosso, Brasil';if(x.includes('campo verde'))return'Campo Verde, Mato Grosso, Brasil';if(x.includes('alto garcas'))return'Alto Garças, Mato Grosso, Brasil';return String(t?.destination||t?.name||'').trim()}
async function geocodeTrip(t){const query=knownDestination(t);if(!query)return null;if(geoCache.has(query))return geoCache.get(query);try{const r=await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=pt&format=json`,{cache:'no-store'});if(!r.ok)throw Error('geocoding');const j=await r.json(),x=j?.results?.[0],out=x?{name:[x.name,x.admin1].filter(Boolean).join(' • '),lat:x.latitude,lon:x.longitude}:null;geoCache.set(query,out);return out}catch(_){return null}}
async function forecast(lat,lon,days=16){const key=`${Number(lat).toFixed(3)},${Number(lon).toFixed(3)},${days}`,hit=forecastCache.get(key);if(hit&&Date.now()-hit.at<WEATHER_TTL)return hit.data;const r=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&current=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=${encodeURIComponent(TZ)}&forecast_days=${days}`,{cache:'no-store'});if(!r.ok)throw Error('weather');const data=await r.json();forecastCache.set(key,{at:Date.now(),data});return data}
function dailyAt(data,date){const i=data?.daily?.time?.indexOf(String(date||'').slice(0,10))??-1;if(i<0)return null;return{code:data.daily.weather_code?.[i],max:data.daily.temperature_2m_max?.[i],min:data.daily.temperature_2m_min?.[i],rain:data.daily.precipitation_probability_max?.[i]}}

function injectStyle(){
  if(q('#weatherReportsFixStyle'))return;
  const s=document.createElement('style');s.id='weatherReportsFixStyle';s.textContent=`
  .reportTripSelect{position:relative!important;z-index:30!important;overflow:visible!important}.reportTripSelect select,#v40ReportTrip{display:block!important;visibility:visible!important;pointer-events:auto!important;touch-action:manipulation!important;position:relative!important;z-index:31!important;background:#fff!important;color:#173b30!important}
  .v40ReportBar{position:relative!important;z-index:20!important;overflow:visible!important}
  .twWeather{margin:0 0 18px;padding:18px;border:1px solid #dce8e3;border-radius:20px;background:linear-gradient(135deg,#f8fbf9,#eef7f3);box-shadow:0 10px 28px rgba(7,50,38,.06)}
  .twWeatherHead{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.twWeatherHead h2,.twWeatherHead h3{margin:3px 0 4px;color:#073226}.twWeatherHead p{margin:0;color:#63786e;font-size:12px}.twLive{font-size:10px;font-weight:900;padding:6px 9px;border-radius:999px;background:#e6f6ed;color:#136746;white-space:nowrap}
  .twCurrent{display:grid;grid-template-columns:auto 1fr repeat(3,minmax(90px,auto));gap:12px;align-items:center;margin-top:15px;padding-top:14px;border-top:1px solid #dce8e3}.twTemp{font-size:34px;font-weight:950;color:#073226}.twCurrent strong{color:#173b30}.twCurrent small{display:block;color:#6a7f75;margin-top:3px}.twMetric{padding:9px 11px;border-radius:12px;background:#fff;border:1px solid #e0e9e5}
  .twTrips{display:grid;gap:10px;margin-top:14px}.twTrip{display:grid;grid-template-columns:1.5fr .85fr .8fr .8fr;gap:10px;align-items:center;padding:12px 13px;border-radius:14px;background:#fff;border:1px solid #dfe9e4}.twTrip strong{color:#073226}.twTrip small{display:block;color:#708078;margin-top:3px}.twTrip .twRain{font-weight:900;color:#176b9a}.twTrip .twSoon{grid-column:2/-1;color:#6e7d77;font-size:12px}
  @media(max-width:780px){.twCurrent{grid-template-columns:1fr 1fr}.twTemp{grid-column:1/-1}.twTrip{grid-template-columns:1fr 1fr}.twTrip>div:first-child{grid-column:1/-1}.twTrip .twSoon{grid-column:1/-1}.v40ReportBar{grid-template-columns:1fr!important}}
  `;document.head.appendChild(s);
}

async function tripSalesMap(tripId){const ss=await db.collection('sales').where('trip_id','==',tripId).get();return new Map(ss.docs.map(d=>[d.id,{id:d.id,...d.data()}]))}
async function tripOperationsMap(tripId){const out=new Map();try{const snap=await db.collection('trips').doc(tripId).collection('operations').get();snap.docs.forEach(d=>out.set(d.id,d.data()||{}))}catch(_){ }return out}
function participantKey(p,r,i){const cpf=String(p?.cpf||'').replace(/\D/g,'');return cpf||`${r.id}-${i}`}

async function generateBusReport(tripId){
  try{
    const t=(state.trips||[]).find(x=>x.id===tripId);if(!t)throw Error('Passeio não encontrado.');
    if(!window.jspdf?.jsPDF)throw Error('Gerador de PDF ainda carregando. Tente novamente.');
    const sales=await tripSalesMap(tripId),rows=[{name:'Jonatas Marques de Arruda',email:'—'}];
    (state.reservations||[]).filter(r=>r.trip_id===tripId&&r.status!=='cancelled').forEach(r=>{const s=sales.get(r.sale_id||r.id)||{},email=String(r.email||r.customer_email||s.customer_email||s.email||'').trim(),people=(r.participants||s.participants||[]).filter(p=>p?.full_name);if(people.length)people.forEach(p=>rows.push({name:p.full_name,email:String(p.email||email||'—').trim()}));else rows.push({name:r.responsible_name||s.customer_name||'Participante',email:email||'—'})});
    const {jsPDF}=window.jspdf,doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});doc.setFont('helvetica','bold');doc.setFontSize(16);doc.text('TRILHEIROS DE RONDONÓPOLIS',14,16);doc.setFontSize(13);doc.text('RELATÓRIO DO ÔNIBUS',14,24);doc.setFont('helvetica','normal');doc.setFontSize(10);doc.text(`${t.name} • ${brDate(t.trip_date)} • ${t.destination||''}`,14,31);doc.setFont('helvetica','bold');doc.text(`TOTAL DE PESSOAS: ${rows.length}`,14,38);doc.setFont('helvetica','normal');doc.autoTable({startY:44,head:[['Nº','NOME','E-MAIL']],body:rows.map((r,i)=>[String(i+1).padStart(2,'0'),r.name,r.email]),styles:{fontSize:8.7,cellPadding:2.5},headStyles:{fillColor:[7,50,38],textColor:[255,255,255]},columnStyles:{0:{cellWidth:12},1:{cellWidth:82},2:{cellWidth:88}}});const filename=`trilheiros-onibus-${slug(t.name)}.pdf`;if(typeof window.openPdfPreviewV14==='function')window.openPdfPreviewV14(doc,{filename,title:'Relatório do ônibus',subtitle:`${t.name} • ${rows.length} pessoa(s)`,shareText:`Relatório do ônibus — ${t.name}`});else doc.save(filename)
  }catch(e){toastError(e,'Erro ao gerar relatório do ônibus.')}
}

async function generateHotelReport(tripId){
  try{
    const t=(state.trips||[]).find(x=>x.id===tripId);if(!t)throw Error('Passeio não encontrado.');
    if(!window.jspdf?.jsPDF)throw Error('Gerador de PDF ainda carregando. Tente novamente.');
    const [sales,ops]=await Promise.all([tripSalesMap(tripId),tripOperationsMap(tripId)]),rows=[];
    (state.reservations||[]).filter(r=>r.trip_id===tripId&&r.status!=='cancelled').forEach(r=>{const s=sales.get(r.sale_id||r.id)||{},fallbackType=String(s.accommodation||r.accommodation||s.category||r.category||'Não informado').replaceAll('_',' '),people=(r.participants||s.participants||[]).filter(p=>p?.full_name);if(people.length){people.forEach((p,i)=>{const op=ops.get(participantKey(p,r,i))||ops.get(r.id)||{};rows.push({name:p.full_name,type:String(p.accommodation||p.lodging_type||fallbackType||'Não informado').replaceAll('_',' '),room:p.room||p.room_number||op.room||op.room_number||r.room||r.room_number||s.room||s.room_number||'—'})})}else{const op=ops.get(r.id)||{};rows.push({name:r.responsible_name||s.customer_name||'Participante',type:fallbackType,room:r.room||r.room_number||s.room||s.room_number||op.room||op.room_number||'—'})}});
    const {jsPDF}=window.jspdf,doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});doc.setFont('helvetica','bold');doc.setFontSize(16);doc.text('TRILHEIROS DE RONDONÓPOLIS',14,16);doc.setFontSize(13);doc.text('RELATÓRIO DE HOSPEDAGEM',14,24);doc.setFont('helvetica','normal');doc.setFontSize(10);doc.text(`${t.name} • ${brDate(t.trip_date)} • ${t.destination||''}`,14,31);doc.setFont('helvetica','bold');doc.text(`TOTAL DE HÓSPEDES: ${rows.length}`,14,38);doc.setFont('helvetica','normal');doc.autoTable({startY:44,head:[['Nº','NOME','TIPO DE HOSPEDAGEM','QUARTO']],body:rows.map((r,i)=>[String(i+1).padStart(2,'0'),r.name,r.type,r.room]),styles:{fontSize:8.6,cellPadding:2.5},headStyles:{fillColor:[7,50,38],textColor:[255,255,255]},columnStyles:{0:{cellWidth:12},1:{cellWidth:78},2:{cellWidth:65},3:{cellWidth:27}}});const filename=`trilheiros-hospedagem-${slug(t.name)}.pdf`;if(typeof window.openPdfPreviewV14==='function')window.openPdfPreviewV14(doc,{filename,title:'Relatório de hospedagem',subtitle:`${t.name} • ${rows.length} hóspede(s)`,shareText:`Relatório de hospedagem — ${t.name}`});else doc.save(filename)
  }catch(e){toastError(e,'Erro ao gerar relatório de hospedagem.')}
}

function stabilizeCentralReports(){
  if(state.tab!=='reports')return;
  const rules=[
    {needle:'pdfTrip(',title:'Lista para ônibus / atrativos',desc:'Somente Nº, nome do participante e tipo/opção escolhida. Sem CPF e sem “responsável”.'},
    {needle:'insuranceCsvV7(',title:'Seguro',desc:'Lista separada com CPF somente quando a seguradora exigir.'},
    {needle:'roomsPdfV7(',title:'Hospedagem',desc:'Nome, tipo/opção e quarto. Sem CPF.'},
    {needle:'driverPdfV7(',title:'Transporte / ônibus',desc:'Nome, tipo/opção, veículo e assento. Sem CPF.'}
  ];
  qa('.reportCards button').forEach(btn=>{
    const action=btn.getAttribute('onclick')||'',rule=rules.find(r=>action.includes(r.needle));if(!rule)return;
    setText(q('strong',btn),rule.title);setText(q('small',btn),rule.desc);
  });
}

function repairOperationalReports(){
  if(state.tab!=='reports')return;
  const sel=q('#v40ReportTrip'),bar=q('.v40ReportBar');if(!sel||!bar)return;
  const trips=activeTrips(),current=selectedOperationalTripId(),signature=trips.map(t=>`${t.id}:${t.name}:${String(t.trip_date||'').slice(0,10)}`).join('|');
  if(sel.dataset.tripSignature!==signature){sel.innerHTML=trips.map(t=>`<option value="${esc(t.id)}">${esc(t.name)} — ${brDate(t.trip_date)}</option>`).join('');sel.dataset.tripSignature=signature}
  if(current)sel.value=current;state.reportTripV40=sel.value||current;sel.hidden=false;sel.onchange=()=>{state.reportTripV40=sel.value};
  const bus=q('[data-v40-report="bus"]',bar);if(bus){setText(bus,'Ônibus');bus.onclick=()=>generateBusReport(sel.value||selectedOperationalTripId())}
  const hotel=q('[data-v40-report="hotel"]',bar);if(hotel){setText(hotel,'Hospedagem');hotel.onclick=()=>generateHotelReport(sel.value||selectedOperationalTripId())}
}

async function mountHomeWeather(){
  if(state.tab!=='dashboard')return;const content=q('#content');if(!content||q('#twHomeWeather'))return;
  const box=document.createElement('section');box.id='twHomeWeather';box.className='twWeather';box.innerHTML='<div class="twWeatherHead"><div><span class="eyebrow">PREVISÃO DO TEMPO • RONDONÓPOLIS</span><h2>Carregando clima local...</h2><p>Atualização automática pela internet.</p></div><span class="twLive">AO VIVO</span></div>';content.insertBefore(box,content.firstChild);
  try{const d=await forecast(HOME.lat,HOME.lon,4);if(state.tab!=='dashboard'||!box.isConnected)return;const c=d.current||{},day=dailyAt(d,today());box.innerHTML=`<div class="twWeatherHead"><div><span class="eyebrow">PREVISÃO DO TEMPO • RONDONÓPOLIS</span><h2>${weatherLabel(c.weather_code)}</h2><p>Condição local agora e tendência de chuva para hoje.</p></div><span class="twLive">AO VIVO</span></div><div class="twCurrent"><div class="twTemp">${Math.round(Number(c.temperature_2m||0))}°C</div><div><strong>Sensação ${Math.round(Number(c.apparent_temperature||c.temperature_2m||0))}°C</strong><small>Vento ${Math.round(Number(c.wind_speed_10m||0))} km/h</small></div><div class="twMetric"><strong>${Math.round(Number(day?.max||0))}° / ${Math.round(Number(day?.min||0))}°</strong><small>Máx. / mín.</small></div><div class="twMetric"><strong>${Math.round(Number(day?.rain||0))}%</strong><small>Chance de chuva</small></div><div class="twMetric"><strong>${Number(c.precipitation||0).toFixed(1)} mm</strong><small>Precipitação agora</small></div></div>`}catch(_){box.innerHTML='<div class="twWeatherHead"><div><span class="eyebrow">PREVISÃO DO TEMPO • RONDONÓPOLIS</span><h2>Clima temporariamente indisponível</h2><p>O restante do sistema continua funcionando normalmente.</p></div></div>'}
}
async function tripWeatherRow(t){const date=String(t.trip_date||'').slice(0,10),base=`<div><strong>${esc(t.name||'Passeio')}</strong><small>${brDate(date)} • ${esc(t.destination||'Destino')}</small></div>`;if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return`<article class="twTrip">${base}<div class="twSoon">Data ainda não definida para previsão.</div></article>`;const diff=Math.floor((new Date(`${date}T12:00:00-04:00`)-new Date())/86400000);if(diff<0)return'';if(diff>15)return`<article class="twTrip">${base}<div class="twSoon">🌦️ Previsão detalhada disponível quando faltar até 16 dias para o passeio.</div></article>`;try{const loc=await geocodeTrip(t);if(!loc)return`<article class="twTrip">${base}<div class="twSoon">Local do passeio não identificado para previsão automática.</div></article>`;const d=await forecast(loc.lat,loc.lon,16),w=dailyAt(d,date);if(!w)return`<article class="twTrip">${base}<div class="twSoon">Previsão ainda não publicada para essa data.</div></article>`;return`<article class="twTrip">${base}<div><strong>${weatherLabel(w.code)}</strong><small>${esc(loc.name)}</small></div><div><strong>${Math.round(Number(w.max||0))}° / ${Math.round(Number(w.min||0))}°</strong><small>Máx. / mín.</small></div><div class="twRain">💧 ${Math.round(Number(w.rain||0))}%<small>chance de chuva</small></div></article>`}catch(_){return`<article class="twTrip">${base}<div class="twSoon">Não foi possível consultar a previsão agora.</div></article>`}}
async function mountTripsWeather(){if(state.tab!=='trips')return;const content=q('#content');if(!content||q('#twTripsWeather'))return;const trips=(state.trips||[]).filter(t=>t.status!=='cancelled'&&String(t.trip_date||'')>=today()).sort((a,b)=>String(a.trip_date||'').localeCompare(String(b.trip_date||''))).slice(0,10);const box=document.createElement('section');box.id='twTripsWeather';box.className='twWeather';box.innerHTML='<div class="twWeatherHead"><div><span class="eyebrow">CLIMA DOS PASSEIOS</span><h3>Previsão por data e destino</h3><p>Mostra automaticamente a previsão quando o passeio entra na janela meteorológica.</p></div></div><div class="twTrips"><div class="twTrip"><div><strong>Carregando previsões...</strong></div></div></div>';content.insertBefore(box,content.firstChild);const rows=await Promise.all(trips.map(tripWeatherRow));if(state.tab!=='trips'||!box.isConnected)return;q('.twTrips',box).innerHTML=rows.filter(Boolean).join('')||'<div class="twTrip"><div><strong>Nenhum passeio futuro encontrado.</strong></div></div>'}

function schedule(delay=100){clearTimeout(renderTimer);renderTimer=setTimeout(()=>{injectStyle();stabilizeCentralReports();repairOperationalReports();mountHomeWeather();mountTripsWeather()},delay)}
const oldRender=window.renderAdmin;
if(typeof oldRender==='function'&&!oldRender.__weatherReportsFix){const wrapped=function(...args){const out=oldRender.apply(this,args);schedule();return out};wrapped.__weatherReportsFix=true;window.renderAdmin=wrapped;try{renderAdmin=wrapped}catch(_){}}
window.addEventListener('DOMContentLoaded',()=>schedule(40),{once:true});
window.addEventListener('load',()=>schedule(140),{once:true});
})();
