/* Trilheiros Gestão — correção de Relatórios + previsão do tempo na Visão Geral e Passeios */
(function(){
'use strict';
if(typeof state==='undefined')return;

const q=(s,r=document)=>r.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const TZ='America/Cuiaba';
const HOME={name:'Rondonópolis',lat:-16.4708,lon:-54.6356};
const WEATHER_TTL=15*60*1000;
const geoCache=new Map();
const forecastCache=new Map();
let renderTimer=0;

function today(){return new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
function brDate(v){const s=String(v||'').slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return'—';const[y,m,d]=s.split('-');return`${d}/${m}/${y}`}
function weatherLabel(code){
  const c=Number(code);
  if(c===0)return'☀️ Céu limpo';
  if([1,2].includes(c))return'🌤️ Parcialmente nublado';
  if(c===3)return'☁️ Nublado';
  if([45,48].includes(c))return'🌫️ Neblina';
  if([51,53,55,56,57].includes(c))return'🌦️ Garoa';
  if([61,63,65,66,67].includes(c))return'🌧️ Chuva';
  if([71,73,75,77].includes(c))return'❄️ Neve';
  if([80,81,82].includes(c))return'🌦️ Pancadas de chuva';
  if([85,86].includes(c))return'🌨️ Pancadas de neve';
  if([95,96,99].includes(c))return'⛈️ Trovoadas';
  return'🌡️ Condições do tempo';
}
function knownDestination(t){
  const x=`${t?.name||''} ${t?.destination||''}`.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  if(x.includes('chapada'))return'Chapada dos Guimarães, Mato Grosso, Brasil';
  if(x.includes('salto das nuvens')||x.includes('tangara'))return'Tangará da Serra, Mato Grosso, Brasil';
  if(x.includes('nobres')||x.includes('bom jardim'))return'Nobres, Mato Grosso, Brasil';
  if(x.includes('rio cristalino')||x.includes('poxoreu')||x.includes('morro da mesa'))return'Poxoréu, Mato Grosso, Brasil';
  if(x.includes('jaciara')||x.includes('canion das indias'))return'Jaciara, Mato Grosso, Brasil';
  if(x.includes('barra do garcas'))return'Barra do Garças, Mato Grosso, Brasil';
  if(x.includes('primavera'))return'Primavera do Leste, Mato Grosso, Brasil';
  if(x.includes('campo verde'))return'Campo Verde, Mato Grosso, Brasil';
  if(x.includes('alto garcas'))return'Alto Garças, Mato Grosso, Brasil';
  return String(t?.destination||t?.name||'').trim();
}
async function geocodeTrip(t){
  const query=knownDestination(t);if(!query)return null;
  if(geoCache.has(query))return geoCache.get(query);
  try{
    const url=`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=pt&format=json`;
    const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw Error('geocoding');
    const j=await r.json(),x=j?.results?.[0];
    const out=x?{name:[x.name,x.admin1].filter(Boolean).join(' • '),lat:x.latitude,lon:x.longitude}:null;
    geoCache.set(query,out);return out;
  }catch(_){return null}
}
async function forecast(lat,lon,days=16){
  const key=`${Number(lat).toFixed(3)},${Number(lon).toFixed(3)},${days}`;
  const hit=forecastCache.get(key);if(hit&&Date.now()-hit.at<WEATHER_TTL)return hit.data;
  const url=`https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&current=temperature_2m,apparent_temperature,precipitation,rain,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=${encodeURIComponent(TZ)}&forecast_days=${days}`;
  const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw Error('weather');
  const data=await r.json();forecastCache.set(key,{at:Date.now(),data});return data;
}
function dailyAt(data,date){
  const i=data?.daily?.time?.indexOf(String(date||'').slice(0,10))??-1;if(i<0)return null;
  return{code:data.daily.weather_code?.[i],max:data.daily.temperature_2m_max?.[i],min:data.daily.temperature_2m_min?.[i],rain:data.daily.precipitation_probability_max?.[i]};
}
function injectStyle(){
  if(q('#weatherReportsFixStyle'))return;
  const s=document.createElement('style');s.id='weatherReportsFixStyle';s.textContent=`
  #v40ReportTrip{position:relative!important;z-index:30!important;pointer-events:auto!important;touch-action:manipulation!important;opacity:1!important;visibility:visible!important;cursor:pointer!important;-webkit-user-select:auto!important;user-select:auto!important}
  .v40ReportBar{position:relative!important;z-index:20!important;pointer-events:auto!important}.v40ReportBar *{pointer-events:auto!important}
  .twWeather{margin:0 0 18px;padding:18px;border:1px solid #dce8e3;border-radius:20px;background:linear-gradient(135deg,#f8fbf9,#eef7f3);box-shadow:0 10px 28px rgba(7,50,38,.06)}
  .twWeatherHead{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.twWeatherHead h2,.twWeatherHead h3{margin:3px 0 4px;color:#073226}.twWeatherHead p{margin:0;color:#63786e;font-size:12px}.twLive{font-size:10px;font-weight:900;padding:6px 9px;border-radius:999px;background:#e6f6ed;color:#136746;white-space:nowrap}
  .twCurrent{display:grid;grid-template-columns:auto 1fr repeat(3,minmax(90px,auto));gap:12px;align-items:center;margin-top:15px;padding-top:14px;border-top:1px solid #dce8e3}.twTemp{font-size:34px;font-weight:950;color:#073226}.twCurrent strong{color:#173b30}.twCurrent small{display:block;color:#6a7f75;margin-top:3px}.twMetric{padding:9px 11px;border-radius:12px;background:#fff;border:1px solid #e0e9e5}
  .twTrips{display:grid;gap:10px;margin-top:14px}.twTrip{display:grid;grid-template-columns:1.5fr .85fr .8fr .8fr;gap:10px;align-items:center;padding:12px 13px;border-radius:14px;background:#fff;border:1px solid #dfe9e4}.twTrip strong{color:#073226}.twTrip small{display:block;color:#708078;margin-top:3px}.twTrip .twRain{font-weight:900;color:#176b9a}.twTrip .twSoon{grid-column:2/-1;color:#6e7d77;font-size:12px}
  @media(max-width:780px){.twCurrent{grid-template-columns:1fr 1fr}.twTemp{grid-column:1/-1}.twTrip{grid-template-columns:1fr 1fr}.twTrip>div:first-child{grid-column:1/-1}.twTrip .twSoon{grid-column:1/-1}}
  `;document.head.appendChild(s);
}

function repairReports(){
  if(state.tab!=='reports')return;
  const sel=q('#v40ReportTrip');if(!sel)return;
  sel.disabled=false;sel.removeAttribute('disabled');sel.style.pointerEvents='auto';sel.style.position='relative';sel.style.zIndex='30';
  if(sel.dataset.reportFixed==='1')return;
  const previous=state.reportTripFix||sel.value;
  const trips=(state.trips||[]).filter(t=>t.status!=='cancelled').sort((a,b)=>String(b.trip_date||'').localeCompare(String(a.trip_date||'')));
  const clone=sel.cloneNode(false);clone.id='v40ReportTrip';clone.dataset.reportFixed='1';clone.disabled=false;
  clone.innerHTML=trips.map(t=>`<option value="${esc(t.id)}">${esc(t.name)} — ${brDate(t.trip_date)}</option>`).join('');
  if(previous&&trips.some(t=>t.id===previous))clone.value=previous;
  clone.addEventListener('change',()=>{state.reportTripFix=clone.value});
  sel.replaceWith(clone);state.reportTripFix=clone.value;
}

async function mountHomeWeather(){
  if(state.tab!=='dashboard')return;const content=q('#content');if(!content||q('#twHomeWeather'))return;
  const box=document.createElement('section');box.id='twHomeWeather';box.className='twWeather';box.innerHTML='<div class="twWeatherHead"><div><span class="eyebrow">PREVISÃO DO TEMPO • RONDONÓPOLIS</span><h2>Carregando clima local...</h2><p>Atualização automática pela internet.</p></div><span class="twLive">AO VIVO</span></div>';
  content.insertBefore(box,content.firstChild);
  try{
    const d=await forecast(HOME.lat,HOME.lon,4);if(state.tab!=='dashboard'||!box.isConnected)return;
    const c=d.current||{},day=dailyAt(d,today());
    box.innerHTML=`<div class="twWeatherHead"><div><span class="eyebrow">PREVISÃO DO TEMPO • RONDONÓPOLIS</span><h2>${weatherLabel(c.weather_code)}</h2><p>Condição local agora e tendência de chuva para hoje.</p></div><span class="twLive">AO VIVO</span></div><div class="twCurrent"><div class="twTemp">${Math.round(Number(c.temperature_2m||0))}°C</div><div><strong>Sensação ${Math.round(Number(c.apparent_temperature||c.temperature_2m||0))}°C</strong><small>Vento ${Math.round(Number(c.wind_speed_10m||0))} km/h</small></div><div class="twMetric"><strong>${Math.round(Number(day?.max||0))}° / ${Math.round(Number(day?.min||0))}°</strong><small>Máx. / mín.</small></div><div class="twMetric"><strong>${Math.round(Number(day?.rain||0))}%</strong><small>Chance de chuva</small></div><div class="twMetric"><strong>${Number(c.precipitation||0).toFixed(1)} mm</strong><small>Precipitação agora</small></div></div>`;
  }catch(_){box.innerHTML='<div class="twWeatherHead"><div><span class="eyebrow">PREVISÃO DO TEMPO • RONDONÓPOLIS</span><h2>Clima temporariamente indisponível</h2><p>O restante do sistema continua funcionando normalmente.</p></div></div>'}
}

async function tripWeatherRow(t){
  const date=String(t.trip_date||'').slice(0,10),base=`<div><strong>${esc(t.name||'Passeio')}</strong><small>${brDate(date)} • ${esc(t.destination||'Destino')}</small></div>`;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return `<article class="twTrip">${base}<div class="twSoon">Data ainda não definida para previsão.</div></article>`;
  const diff=Math.floor((new Date(`${date}T12:00:00-04:00`)-new Date())/86400000);
  if(diff<0)return'';
  if(diff>15)return `<article class="twTrip">${base}<div class="twSoon">🌦️ Previsão detalhada disponível quando faltar até 16 dias para o passeio.</div></article>`;
  try{
    const loc=await geocodeTrip(t);if(!loc)return `<article class="twTrip">${base}<div class="twSoon">Local do passeio não identificado para previsão automática.</div></article>`;
    const d=await forecast(loc.lat,loc.lon,16),w=dailyAt(d,date);if(!w)return `<article class="twTrip">${base}<div class="twSoon">Previsão ainda não publicada para essa data.</div></article>`;
    return `<article class="twTrip">${base}<div><strong>${weatherLabel(w.code)}</strong><small>${esc(loc.name)}</small></div><div><strong>${Math.round(Number(w.max||0))}° / ${Math.round(Number(w.min||0))}°</strong><small>Máx. / mín.</small></div><div class="twRain">💧 ${Math.round(Number(w.rain||0))}%<small>chance de chuva</small></div></article>`;
  }catch(_){return `<article class="twTrip">${base}<div class="twSoon">Não foi possível consultar a previsão agora.</div></article>`}
}
async function mountTripsWeather(){
  if(state.tab!=='trips')return;const content=q('#content');if(!content||q('#twTripsWeather'))return;
  const trips=(state.trips||[]).filter(t=>t.status!=='cancelled'&&String(t.trip_date||'')>=today()).sort((a,b)=>String(a.trip_date||'').localeCompare(String(b.trip_date||''))).slice(0,10);
  const box=document.createElement('section');box.id='twTripsWeather';box.className='twWeather';box.innerHTML='<div class="twWeatherHead"><div><span class="eyebrow">CLIMA DOS PASSEIOS</span><h3>Previsão por data e destino</h3><p>Mostra automaticamente a previsão quando o passeio entra na janela meteorológica.</p></div></div><div class="twTrips"><div class="twTrip"><div><strong>Carregando previsões...</strong></div></div></div>';
  content.insertBefore(box,content.firstChild);
  const rows=await Promise.all(trips.map(tripWeatherRow));if(state.tab!=='trips'||!box.isConnected)return;
  q('.twTrips',box).innerHTML=rows.filter(Boolean).join('')||'<div class="twTrip"><div><strong>Nenhum passeio futuro encontrado.</strong></div></div>';
}

function schedule(){clearTimeout(renderTimer);renderTimer=setTimeout(()=>{injectStyle();repairReports();mountHomeWeather();mountTripsWeather()},80)}
const oldRender=window.renderAdmin;
if(typeof oldRender==='function'&&!oldRender.__weatherReportsFix){
  const wrapped=function(...args){const out=oldRender.apply(this,args);schedule();return out};wrapped.__weatherReportsFix=true;window.renderAdmin=wrapped;try{renderAdmin=wrapped}catch(_){ }
}
window.addEventListener('DOMContentLoaded',schedule);
const mo=new MutationObserver(()=>schedule());
setTimeout(()=>{const root=q('#app');if(root)mo.observe(root,{childList:true,subtree:true})},500);
})();
