import admin from 'firebase-admin';

const rawService=process.env.FIREBASE_SERVICE_ACCOUNT||'';
if(!rawService){console.error('FIREBASE_SERVICE_ACCOUNT ausente');process.exit(1)}
let service;
try{service=JSON.parse(rawService)}catch{console.error('FIREBASE_SERVICE_ACCOUNT inválido');process.exit(1)}
if(!admin.apps.length)admin.initializeApp({credential:admin.credential.cert(service)});
const db=admin.firestore();
const messaging=admin.messaging();
const FieldValue=admin.firestore.FieldValue;

const TZ='America/Cuiaba';
const MAX_FORECAST_DAYS=16;
const BASE_URL='https://trilheiros-reservas.web.app';
const WEATHER_URL=`${BASE_URL}/admin`;
const ICON='https://i.postimg.cc/JnF2F9Hw/LOGO-TRILHEIROS-Photoroom.png';
const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const clean=v=>String(v??'').trim();
const num=v=>Number(v||0)||0;

function today(){return new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
function tripDate(t){return clean(t?.trip_date||t?.date).slice(0,10)}
function daysBetween(a,b){const x=new Date(`${a}T12:00:00Z`),y=new Date(`${b}T12:00:00Z`);return Math.round((y-x)/86400000)}
function activeTrip(t){return !['cancelled','canceled','cancelado','cancelada','inactive','inativo','inativa'].includes(norm(t?.status||t?.trip_status))}
function placeHint(t){
  const raw=[t?.destination,t?.location,t?.city,t?.local,t?.name].map(clean).filter(Boolean);
  const text=norm(raw.join(' '));
  if(text.includes('chapada'))return'Chapada dos Guimarães, Mato Grosso, Brasil';
  if(text.includes('salto das nuvens')||text.includes('tangara'))return'Tangará da Serra, Mato Grosso, Brasil';
  if(text.includes('nobres')||text.includes('bom jardim'))return'Nobres, Mato Grosso, Brasil';
  if(text.includes('rio cristalino')||text.includes('poxoreu'))return'Poxoréu, Mato Grosso, Brasil';
  if(text.includes('jaciara')||text.includes('canion das indias'))return'Jaciara, Mato Grosso, Brasil';
  if(text.includes('barra do garcas'))return'Barra do Garças, Mato Grosso, Brasil';
  if(text.includes('vila bela'))return'Vila Bela da Santíssima Trindade, Mato Grosso, Brasil';
  if(text.includes('campo verde'))return'Campo Verde, Mato Grosso, Brasil';
  if(text.includes('alto garcas'))return'Alto Garças, Mato Grosso, Brasil';
  if(text.includes('primavera do leste'))return'Primavera do Leste, Mato Grosso, Brasil';
  return raw[0]||'';
}
function label(code){
  const c=Number(code);
  if(c===0)return'Céu limpo';
  if([1,2].includes(c))return'Poucas nuvens';
  if(c===3)return'Nublado';
  if([45,48].includes(c))return'Neblina';
  if([51,53,55,56,57].includes(c))return'Garoa';
  if([61,63,65,66,67,80,81,82].includes(c))return'Chuva';
  if([95,96,99].includes(c))return'Temporal';
  return'Tempo variável';
}
function severity(row){
  const rain=num(row?.precipitation_probability_max),sum=num(row?.precipitation_sum),wind=num(row?.wind_speed_10m_max),code=Number(row?.weather_code||0);
  if([95,96,99].includes(code)||sum>=25||wind>=60)return 3;
  if(rain>=80||sum>=15||wind>=45)return 2;
  if(rain>=60||sum>=8||wind>=35)return 1;
  return 0;
}
function alertReasons(row){
  const out=[],rain=Math.round(num(row?.precipitation_probability_max)),sum=num(row?.precipitation_sum),wind=Math.round(num(row?.wind_speed_10m_max)),code=Number(row?.weather_code||0);
  if([95,96,99].includes(code))out.push('temporal');
  if(rain>=60)out.push(`chuva ${rain}%`);
  if(sum>=8)out.push(`${sum.toFixed(1)} mm`);
  if(wind>=35)out.push(`vento ${wind} km/h`);
  return out;
}
function meaningfulChange(prev,next){
  if(!prev)return false;
  const prevSeverity=severity(prev),nextSeverity=severity(next);
  const rainJump=num(next.precipitation_probability_max)-num(prev.precipitation_probability_max);
  const sumJump=num(next.precipitation_sum)-num(prev.precipitation_sum);
  const windJump=num(next.wind_speed_10m_max)-num(prev.wind_speed_10m_max);
  const stormNow=[95,96,99].includes(Number(next.weather_code||0))&&![95,96,99].includes(Number(prev.weather_code||0));
  return (nextSeverity>prevSeverity&&nextSeverity>=1)||stormNow||(rainJump>=25&&num(next.precipitation_probability_max)>=60)||(sumJump>=8&&num(next.precipitation_sum)>=8)||(windJump>=15&&num(next.wind_speed_10m_max)>=35);
}

async function geocode(place){
  const url=`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(place)}&count=5&language=pt&format=json&countryCode=BR`;
  const r=await fetch(url,{headers:{'User-Agent':'TrilheirosGestaoWeather/1.0'}});if(!r.ok)throw Error(`Geocoding ${r.status}`);
  const data=await r.json(),results=Array.isArray(data.results)?data.results:[];
  const mt=results.find(x=>norm(x.admin1).includes('mato grosso'))||results[0];
  if(!mt)throw Error(`Destino não localizado: ${place}`);
  return{lat:mt.latitude,lon:mt.longitude,label:[mt.name,mt.admin1].filter(Boolean).join(' • ')};
}
async function forecast(lat,lon){
  const daily='weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max';
  const url=`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=${daily}&timezone=${encodeURIComponent(TZ)}&forecast_days=${MAX_FORECAST_DAYS}`;
  const r=await fetch(url,{headers:{'User-Agent':'TrilheirosGestaoWeather/1.0'}});if(!r.ok)throw Error(`Forecast ${r.status}`);
  const d=await r.json(),x=d.daily||{};
  return (x.time||[]).map((date,i)=>({date,weather_code:x.weather_code?.[i],temperature_2m_max:x.temperature_2m_max?.[i],temperature_2m_min:x.temperature_2m_min?.[i],precipitation_probability_max:x.precipitation_probability_max?.[i],precipitation_sum:x.precipitation_sum?.[i],wind_speed_10m_max:x.wind_speed_10m_max?.[i]}));
}
async function activeDevices(){
  const snap=await db.collection('push_devices').where('active','==',true).limit(100).get();
  return snap.docs.map(d=>({id:d.id,token:clean(d.data()?.token)})).filter(x=>x.token);
}
async function sendWeatherPush(trip,row,prev){
  const devices=await activeDevices();if(!devices.length){console.log('Sem dispositivos push ativos');return}
  const reasons=alertReasons(row),title=`⚠️ Mudança no clima — ${trip.name||'Passeio'}`;
  const body=`${label(row.weather_code)} • ${reasons.join(' • ')||'previsão alterada'} • ${tripDate(trip).split('-').reverse().join('/')}`;
  const payload={
    tokens:devices.map(x=>x.token),
    notification:{title,body,imageUrl:ICON},
    data:{type:'weather_alert',trip_id:String(trip.id||''),trip_name:String(trip.name||''),url:WEATHER_URL},
    android:{priority:'high',ttl:86400000,notification:{sound:'default',channelId:'trilheiros-alerts'}},
    webpush:{headers:{Urgency:'high',TTL:'86400'},notification:{title,body,icon:ICON,requireInteraction:true,vibrate:[180,80,180],tag:`weather-${trip.id}`},fcmOptions:{link:WEATHER_URL}}
  };
  const result=await messaging.sendEachForMulticast(payload);
  const invalid=[];
  result.responses.forEach((r,i)=>{const code=String(r.error?.code||'');if(!r.success&&(code.includes('registration-token-not-registered')||code.includes('invalid-registration-token')))invalid.push(devices[i]?.id)});
  if(invalid.length)await Promise.all(invalid.map(id=>db.collection('push_devices').doc(id).set({active:false,updated_at:FieldValue.serverTimestamp()},{merge:true})));
  console.log(`Push clima: ${result.successCount} sucesso(s), ${result.failureCount} falha(s)`);
}

const allTripsSnap=await db.collection('trips').get();
const now=today();
const trips=allTripsSnap.docs.map(d=>({id:d.id,...d.data()})).filter(activeTrip).filter(t=>{const d=tripDate(t),diff=daysBetween(now,d);return d&&diff>=0&&diff<MAX_FORECAST_DAYS});
console.log(`Clima: ${trips.length} passeio(s) dentro da janela de ${MAX_FORECAST_DAYS} dias.`);
let synced=0,alerts=0,errors=0;
for(const trip of trips){
  try{
    const date=tripDate(trip),place=placeHint(trip);if(!place){console.log(`Sem local: ${trip.name||trip.id}`);continue}
    const geo=await geocode(place),rows=await forecast(geo.lat,geo.lon),row=rows.find(x=>x.date===date);if(!row){console.log(`Sem previsão ainda: ${trip.name||trip.id}`);continue}
    const ref=db.collection('weather_monitor').doc(trip.id),oldSnap=await ref.get(),old=oldSnap.exists?oldSnap.data()||{}:{},prev=old.forecast||null;
    const changed=meaningfulChange(prev,row);
    await ref.set({trip_id:trip.id,trip_name:trip.name||'',trip_date:date,place:geo.label,forecast:row,severity:severity(row),risk_reasons:alertReasons(row),source:'open-meteo',last_synced_at:FieldValue.serverTimestamp(),previous_forecast:prev||null},{merge:true});
    await db.collection('trips').doc(trip.id).set({weather:{...row,place:geo.label,severity:severity(row),risk_reasons:alertReasons(row),source:'open-meteo'},weather_updated_at:FieldValue.serverTimestamp()},{merge:true});
    synced++;
    if(changed){await sendWeatherPush(trip,row,prev);alerts++;await ref.set({last_alert_at:FieldValue.serverTimestamp(),last_alert_forecast:row},{merge:true})}
    console.log(`${trip.name||trip.id}: ${label(row.weather_code)} • chuva ${Math.round(num(row.precipitation_probability_max))}% • ${num(row.precipitation_sum).toFixed(1)}mm • vento ${Math.round(num(row.wind_speed_10m_max))}km/h${changed?' • ALERTA':''}`);
  }catch(err){errors++;console.error(`Erro clima ${trip.name||trip.id}:`,err?.message||err)}
}
console.log(`Clima concluído: ${synced} sincronizado(s), ${alerts} alerta(s), ${errors} erro(s).`);
if(errors&&synced===0)process.exitCode=1;
