const CFG = window.TRILHEIROS_RECEIPTS_CONFIG || {};
const isConfigured = Boolean(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY);
const demoMode = CFG.DEMO_MODE || !isConfigured;
let supabaseClient = null;
if (!demoMode && window.supabase) {
  supabaseClient = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true }
  });
}
window.ReceiptsApp = { CFG, demoMode, supabaseClient };

function brl(value){
  const n = Number(value || 0);
  return n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
}
function dateBR(value){
  if(!value) return '—';
  const s = String(value);
  const d = s.includes('T') ? new Date(s) : new Date(`${s}T12:00:00`);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString('pt-BR');
}
function dateTimeBR(value){
  if(!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString('pt-BR');
}
function onlyDigits(v){return String(v||'').replace(/\D/g,'')}
function formatCpfCnpj(v){
  let d=onlyDigits(v).slice(0,14);
  if(d.length<=11){
    d=d.replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d{1,2})$/,'$1-$2');
  }else{
    d=d.replace(/(\d{2})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1/$2').replace(/(\d{4})(\d{1,2})$/,'$1-$2');
  }
  return d;
}
function isValidCpfCnpj(v){
  const d=onlyDigits(v);
  if(d.length===11){
    if(/^(\d)\1{10}$/.test(d))return false;
    let s=0;for(let i=0;i<9;i++)s+=Number(d[i])*(10-i);
    let a=(s*10)%11;if(a===10)a=0;if(a!==Number(d[9]))return false;
    s=0;for(let i=0;i<10;i++)s+=Number(d[i])*(11-i);
    let b=(s*10)%11;if(b===10)b=0;return b===Number(d[10]);
  }
  if(d.length===14){
    if(/^(\d)\1{13}$/.test(d))return false;
    const w1=[5,4,3,2,9,8,7,6,5,4,3,2],w2=[6,5,4,3,2,9,8,7,6,5,4,3,2];
    let s=w1.reduce((a,w,i)=>a+Number(d[i])*w,0),a=s%11<2?0:11-(s%11);
    if(a!==Number(d[12]))return false;
    s=w2.reduce((x,w,i)=>x+Number(d[i])*w,0);const b=s%11<2?0:11-(s%11);
    return b===Number(d[13]);
  }
  return false;
}
function formatPhone(v){
  let d=onlyDigits(v).slice(0,11);
  if(d.length>10) return d.replace(/(\d{2})(\d{5})(\d{4})/,'($1) $2-$3');
  if(d.length>6) return d.replace(/(\d{2})(\d{4})(\d{0,4})/,'($1) $2-$3');
  if(d.length>2) return d.replace(/(\d{2})(\d+)/,'($1) $2');
  return d;
}
function formatCep(v){return onlyDigits(v).slice(0,8).replace(/(\d{5})(\d{1,3})/,'$1-$2')}
function currencyInputToNumber(v){
  if(typeof v==='number') return v;
  const s=String(v||'').replace(/\s/g,'').replace(/R\$/g,'').replace(/\./g,'').replace(',','.');
  const n=Number(s); return Number.isFinite(n)?n:0;
}
function randomToken(bytes=32){
  const arr=new Uint8Array(bytes); crypto.getRandomValues(arr); return [...arr].map(b=>b.toString(16).padStart(2,'0')).join('');
}
async function sha256(text){
  const data=new TextEncoder().encode(text); const hash=await crypto.subtle.digest('SHA-256',data); return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
function escapeHtml(v){return String(v??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]))}
function requestStatus(r){
  if(r.status==='submitted') return 'submitted';
  if(r.status==='cancelled') return 'cancelled';
  if(new Date(r.expires_at).getTime()<Date.now()) return 'expired';
  return 'pending';
}
function statusLabel(s){return ({submitted:'Recebido',pending:'Aguardando',expired:'Expirado',cancelled:'Cancelado'})[s]||s}
function buildPublicLink(token){
  const u=new URL(window.location.href);
  const base=u.pathname.includes('admin.html')?u.pathname.replace(/admin\.html.*$/,''):u.pathname.replace(/[^/]*$/,'');
  return `${u.origin}${base}index.html?token=${encodeURIComponent(token)}`;
}
function toast(msg,type='success'){
  const el=document.createElement('div');el.className=`notice ${type}`;el.style.position='fixed';el.style.right='16px';el.style.bottom='16px';el.style.zIndex='100';el.style.maxWidth='420px';el.style.boxShadow='0 14px 40px rgba(0,0,0,.18)';el.textContent=msg;document.body.appendChild(el);setTimeout(()=>el.remove(),3400);
}
Object.assign(window,{brl,dateBR,dateTimeBR,onlyDigits,isValidCpfCnpj,formatCpfCnpj,formatPhone,formatCep,currencyInputToNumber,randomToken,sha256,escapeHtml,requestStatus,statusLabel,buildPublicLink,toast});

const DEMO_KEY='trilheiros_receipts_demo_v2';
function demoSeed(){
  const now=new Date();
  return {
    settings:{business_name:'Trilheiros de Rondonópolis',cnpj:'',address:'',city:'Rondonópolis',state:'MT',phone:'(66) 99692-6174',email:''},
    requests:[],receipts:[],
    profile:{id:'demo-admin',display_name:'Administrador',role:'admin',email:'demo@trilheiros.local'},
    meta:{seq:1,year:now.getFullYear()}
  };
}
function demoLoad(){try{return JSON.parse(localStorage.getItem(DEMO_KEY))||demoSeed()}catch{return demoSeed()}}
function demoSave(db){localStorage.setItem(DEMO_KEY,JSON.stringify(db))}
window.DemoDB={get(){const d=demoLoad();demoSave(d);return d},save:demoSave,reset(){const d=demoSeed();demoSave(d);return d}};
