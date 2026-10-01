/* Trilheiros — cadastro único de participantes */
(function(){
  'use strict';
  const BASE='https://southamerica-east1-trilheiros-reservas.cloudfunctions.net';
  const PROFILE_API=BASE+'/participantProfileApi';
  const REGISTER_API=BASE+'/unifiedRegistrationApi';
  const digits=v=>String(v||'').replace(/\D/g,'').slice(0,11);
  const tokenKey=cpf=>`trilheiros_profile_${digits(cpf)}`;
  const dataKey=cpf=>`trilheiros_profile_data_${digits(cpf)}`;

  async function authHeader(auth){
    let user=auth?.currentUser;
    if(!user&&auth?.signInAnonymously)user=(await auth.signInAnonymously()).user;
    if(!user)throw Error('Não foi possível identificar este aparelho.');
    const idToken=await user.getIdToken();
    return {'Content-Type':'application/json','Authorization':`Bearer ${idToken}`};
  }
  async function jsonFetch(url,auth,payload){
    const resp=await fetch(url,{method:'POST',headers:await authHeader(auth),body:JSON.stringify(payload)});
    const data=await resp.json().catch(()=>({ok:false,error:`HTTP ${resp.status}`}));
    if(!resp.ok||data.ok===false)throw Error(data.error||'Não foi possível concluir.');
    return data;
  }
  function storedToken(cpf){
    try{return localStorage.getItem(tokenKey(cpf))||''}catch{return''}
  }
  function localProfile(cpf){
    try{const raw=localStorage.getItem(dataKey(cpf));return raw?JSON.parse(raw):null}catch{return null}
  }
  function rememberLocal(participants){
    try{
      for(const p of (Array.isArray(participants)?participants:[])){
        const c=digits(p?.cpf);if(c.length!==11)continue;
        localStorage.setItem(dataKey(c),JSON.stringify({full_name:String(p?.full_name||p?.name||'').trim(),cpf:c,email:String(p?.email||'').trim().toLowerCase(),phone:String(p?.phone||'').trim()}));
      }
    }catch(_){}
  }
  function saveTokens(tokens){
    if(!tokens||typeof tokens!=='object')return;
    try{Object.entries(tokens).forEach(([cpf,t])=>{if(t)localStorage.setItem(tokenKey(cpf),String(t))})}catch(_){}
  }
  async function lookupProfile(auth,cpf,email=''){
    const c=digits(cpf);if(c.length!==11)return{ok:true,found:false};
    const local=localProfile(c);if(local)return{ok:true,found:true,verified:true,profile:local,local:true};
    const access_token=storedToken(c);
    const data=await jsonFetch(PROFILE_API,auth,{cpf:c,email:String(email||'').trim().toLowerCase(),access_token});
    if(data.access_token){try{localStorage.setItem(tokenKey(c),data.access_token)}catch(_){}}
    if(data?.verified&&data.profile)rememberLocal([data.profile]);
    return data;
  }
  async function register(auth,payload){
    const data=await jsonFetch(REGISTER_API,auth,payload);
    saveTokens(data.profile_tokens);
    rememberLocal(payload?.participants||[]);
    return data;
  }
  window.TrilheirosParticipant={lookupProfile,register,storedToken,saveTokens,rememberLocal,localProfile};
})();