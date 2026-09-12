import admin from 'firebase-admin';
import {createHash} from 'node:crypto';

const rawService=process.env.FIREBASE_SERVICE_ACCOUNT||'';
if(!rawService){console.error('FIREBASE_SERVICE_ACCOUNT ausente.');process.exit(1)}
let service;try{service=JSON.parse(rawService)}catch{console.error('FIREBASE_SERVICE_ACCOUNT inválido.');process.exit(1)}
if(!admin.apps.length)admin.initializeApp({credential:admin.credential.cert(service)});
const db=admin.firestore();
const messaging=admin.messaging();

const TZ='America/Cuiaba';
const BASE_URL='https://trilheiros-reservas.web.app';
const ICON='https://i.postimg.cc/JnF2F9Hw/LOGO-TRILHEIROS-Photoroom.png?v=20260912-weather-alert2';
const HOME={id:'rondonopolis',name:'Rondonópolis',lat:-16.4708,lon:-54.6356};
const ALERT_COOLDOWN=2*60*60*1000;
const SEVERE_CODES=new Set([65,67,82,95,96,99]);
const RAIN_CODES=new Set([51,53,55,56,57,61,63,65,66,67,80,81,82,95,96,99]);

const clean=v=>String(v??'').trim();
const norm=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const hash=v=>createHash('sha256').update(String(v||'')).digest('hex');
function today(){return new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
function weatherLabel(code){const c=Number(code);if(c===0)return'céu limpo';if([1,2].includes(c))return'parcialmente nublado';if(c===3)return'nublado';if([45,48].includes(c))return'neblina';if([51,53,55,56,57].includes(c))return'garoa';if([61,63,65,66,67].includes(c))return'chuva';if([80,81,82].includes(c))return'pancadas de chuva';if([95,96,99].includes(c))return'trovoadas';return'condição do tempo'}
function weatherGroup(code){const c=Number(code);if(SEVERE_CODES.has(c))return'severe';if(RAIN_CODES.has(c))return'rain';if([45,48].includes(c))return'fog';if(c===3)return'cloudy';if([1,2].includes(c))return'partly';if(c===0)return'clear';return'other'}
function knownDestination(t){const x=norm(`${t?.name||''} ${t?.destination||''}`);if(x.includes('chapada'))return'Chapada dos Guimarães, Mato Grosso, Brasil';if(x.includes('salto das nuvens')||x.includes('tangara'))return'Tangará da Serra, Mato Grosso, Brasil';if(x.includes('nobres')||x.includes('bom jardim'))return'Nobres, Mato Grosso, Brasil';if(x.includes('rio cristalino')||x.includes('poxoreu')||x.includes('morro da mesa'))return'Poxoréu, Mato Grosso, Brasil';if(x.includes('jaciara')||x.includes('canion das indias'))return'Jaciara, Mato Grosso, Brasil';if(x.includes('barra do garcas'))return'Barra do Garças, Mato Grosso, Brasil';if(x.includes('primavera'))return'Primavera do Leste, Mato Grosso, Brasil';if(x.includes('campo verde'))return'Campo Verde, Mato Grosso, Brasil';if(x.includes('alto garcas'))return'Alto Garças, Mato Grosso, Brasil';return clean(t?.destination||t?.name)}
async function geocode(query){if(!query)return null;const r=await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=pt&format=json`);if(!r.ok)return null;const j=await r.json(),x=j?.results?.[0];return x?{name:[x.name,x.admin1].filter(Boolean).join(' • '),lat:x.latitude,lon:x.longitude}:null}
async function forecast(lat,lon,days=16){const r=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&current=temperature_2m,weather_code,precipitation,wind_speed_10m,wind_gusts_10m&hourly=precipitation_probability,weather_code&daily=weather_code,precipitation_probability_max,temperature_2m_max,temperature_2m_min&timezone=${encodeURIComponent(TZ)}&forecast_days=${days}`);if(!r.ok)throw Error(`Open-Meteo ${r.status}`);return r.json()}
function dailyAt(data,date){const i=data?.daily?.time?.indexOf(date)??-1;if(i<0)return null;return{code:Number(data.daily.weather_code?.[i]??-1),rain:Number(data.daily.precipitation_probability_max?.[i]??0),max:Number(data.daily.temperature_2m_max?.[i]??0),min:Number(data.daily.temperature_2m_min?.[i]??0)}}
function nextHoursRain(data,hours=6){const times=data?.hourly?.time||[],probs=data?.hourly?.precipitation_probability||[],codes=data?.hourly?.weather_code||[];const now=Date.now(),limit=now+hours*3600000;let max=0,severe=false,rainCode=false;for(let i=0;i<times.length;i++){const ms=new Date(times[i]).getTime();if(ms<now||ms>limit)continue;max=Math.max(max,Number(probs[i]||0));const c=Number(codes[i]);severe=severe||SEVERE_CODES.has(c);rainCode=rainCode||RAIN_CODES.has(c)}return{rain:max,severe,rainCode}}

async function activeDevices(){
  const map=new Map();
  try{
    const s=await db.collection('push_devices').where('active','==',true).limit(100).get();
    s.docs.forEach(d=>{const token=clean(d.data()?.token);if(token)map.set(token,{id:d.id,token,source:'push_devices'})});
  }catch(e){console.warn('push_devices:',e.message)}
  try{
    const owner=await db.collection('settings').doc('push_device_owner').get();
    const tokens=owner.exists&&Array.isArray(owner.data()?.tokens)?owner.data().tokens:[];
    tokens.map(clean).filter(t=>t.length>50).forEach(token=>{if(!map.has(token))map.set(token,{id:hash(token),token,source:'settings'})});
  }catch(e){console.warn('settings push:',e.message)}
  return[...map.values()];
}

async function sendPush({title,body,tag,url=`${BASE_URL}/admin`}){
  const devices=await activeDevices();
  console.log(`Dispositivos para alerta do tempo: ${devices.length}`);
  if(!devices.length){console.log('Sem dispositivos push ativos para clima.');return{sent:0}}
  const payload={tokens:devices.map(x=>x.token),data:{url,type:'weather_alert',title,body,tag,timestamp:String(Date.now())},webpush:{headers:{Urgency:'high',TTL:'21600'},notification:{title,body,icon:ICON,tag,renotify:true,requireInteraction:false,vibrate:[180,80,180]},fcmOptions:{link:url}}};
  const out=await messaging.sendEachForMulticast(payload),invalid=[];
  out.responses.forEach((r,i)=>{const code=String(r.error?.code||'');if(!r.success&&(code.includes('registration-token-not-registered')||code.includes('invalid-registration-token')))invalid.push(devices[i])});
  for(const item of invalid){if(item.source==='push_devices')await db.collection('push_devices').doc(item.id).set({active:false,updated_at:admin.firestore.FieldValue.serverTimestamp()},{merge:true}).catch(()=>{});else await db.collection('settings').doc('push_device_owner').set({tokens:admin.firestore.FieldValue.arrayRemove(item.token),updated_at:admin.firestore.FieldValue.serverTimestamp()},{merge:true}).catch(()=>{})}
  console.log(`Push clima: ${out.successCount} enviado(s), ${out.failureCount} falha(s).`);
  return{sent:out.successCount,failed:out.failureCount}
}

async function maybeAlert(key,current,build){const ref=db.collection('weather_alert_state').doc(key),snap=await ref.get(),old=snap.exists?snap.data()||{}:{};const now=Date.now(),last=Number(old.last_alert_ms||0),alert=build(old,current);if(alert&&now-last>=ALERT_COOLDOWN){await sendPush(alert);current.last_alert_ms=now;current.last_alert_kind=alert.kind||''}await ref.set({...current,updated_at:admin.firestore.FieldValue.serverTimestamp()},{merge:true})}

async function checkHome(){
  const data=await forecast(HOME.lat,HOME.lon,3),next=nextHoursRain(data,6),cur={weather_code:Number(data.current?.weather_code??-1),weather_group:weatherGroup(data.current?.weather_code),temperature:Number(data.current?.temperature_2m??0),precipitation:Number(data.current?.precipitation??0),wind:Number(data.current?.wind_speed_10m??0),gust:Number(data.current?.wind_gusts_10m??0),rain_probability:next.rain,severe:next.severe,rain_code:next.rainCode};
  await maybeAlert('home_rondonopolis',cur,(old,c)=>{
    if(!old.updated_at)return null;
    const oldRain=Number(old.rain_probability||0),oldTemp=Number(old.temperature||c.temperature),oldWind=Number(old.wind||0),oldGust=Number(old.gust||0);
    const rainStarted=(oldRain<40&&!old.rain_code&&!old.severe)&&(c.rain_probability>=50||c.rain_code||c.severe);
    const rainJump=c.rain_probability-oldRain>=25&&c.rain_probability>=45;
    const severeNew=!old.severe&&c.severe;
    const windNew=(oldWind<35&&c.wind>=40)||(oldGust<45&&c.gust>=50);
    const tempShift=Math.abs(c.temperature-oldTemp)>=5;
    const conditionChanged=old.weather_group&&old.weather_group!==c.weather_group&&['rain','severe','fog'].includes(c.weather_group);
    if(!(rainStarted||rainJump||severeNew||windNew||tempShift||conditionChanged))return null;
    let title='🌦️ Mudança no tempo em Rondonópolis';
    if(severeNew)title='⛈️ Alerta de mudança no tempo';else if(rainStarted||rainJump)title='🌧️ Chuva pode chegar em Rondonópolis';else if(windNew)title='💨 Vento forte em Rondonópolis';else if(tempShift)title='🌡️ Mudança de temperatura em Rondonópolis';
    const parts=[`${weatherLabel(c.weather_code)}`,`${Math.round(c.temperature)}°C`,`chuva ${Math.round(c.rain_probability)}%`];if(c.wind>=30)parts.push(`vento ${Math.round(c.wind)} km/h`);if(c.gust>=40)parts.push(`rajadas ${Math.round(c.gust)} km/h`);
    return{title,body:parts.join(' • '),tag:`weather-home-${today()}-${severeNew?'severe':rainStarted||rainJump?'rain':windNew?'wind':tempShift?'temp':'change'}`,kind:severeNew?'severe':rainStarted||rainJump?'rain':windNew?'wind':tempShift?'temp':'change',url:`${BASE_URL}/admin`}
  })
}

async function checkTrips(){
  const s=await db.collection('trips').limit(300).get(),todayIso=today();
  for(const d of s.docs){
    const t={id:d.id,...d.data()};if(String(t.status||'').toLowerCase()==='cancelled')continue;
    const date=clean(t.trip_date).slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date<todayIso)continue;
    const diff=Math.floor((new Date(`${date}T12:00:00-04:00`)-new Date(`${todayIso}T12:00:00-04:00`))/86400000);if(diff>15)continue;
    const loc=await geocode(knownDestination(t));if(!loc)continue;
    const data=await forecast(loc.lat,loc.lon,16),day=dailyAt(data,date);if(!day)continue;
    const cur={trip_id:t.id,trip_name:clean(t.name)||'Passeio',trip_date:date,location:loc.name,rain_probability:day.rain,weather_code:day.code,weather_group:weatherGroup(day.code),max:day.max,min:day.min,severe:SEVERE_CODES.has(day.code)};
    await maybeAlert(`trip_${t.id}`,cur,(old,c)=>{
      if(!old.updated_at)return null;
      const oldRain=Number(old.rain_probability||0),jump=c.rain_probability-oldRain,crossed=oldRain<50&&c.rain_probability>=60,severeNew=!old.severe&&c.severe,tempChanged=Math.abs(Number(old.max||c.max)-c.max)>=5||Math.abs(Number(old.min||c.min)-c.min)>=5,conditionChanged=old.weather_group&&old.weather_group!==c.weather_group&&['rain','severe','fog'].includes(c.weather_group);
      if(!(crossed||jump>=25||severeNew||tempChanged||conditionChanged))return null;
      return{title:severeNew?`⛈️ Atenção no passeio: ${c.trip_name}`:`🌦️ Mudança na previsão: ${c.trip_name}`,body:`${c.trip_date.split('-').reverse().join('/')} • ${c.location} • ${weatherLabel(c.weather_code)} • chuva ${Math.round(c.rain_probability)}% • ${Math.round(c.min)}°/${Math.round(c.max)}°.`,tag:`weather-trip-${c.trip_id}-${c.trip_date}-${severeNew?'severe':crossed||jump>=25?'rain':'change'}`,kind:severeNew?'severe':crossed||jump>=25?'rain':'change',url:`${BASE_URL}/admin?tab=trips`}
    })
  }
}

let failures=0;try{await checkHome()}catch(e){failures++;console.error('Clima local:',e)}try{await checkTrips()}catch(e){failures++;console.error('Clima passeios:',e)}console.log(`Monitor do tempo concluído. Falhas=${failures}`);if(failures)process.exitCode=1;
