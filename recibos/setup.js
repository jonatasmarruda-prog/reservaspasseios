(()=>{
const {supabaseClient}=window.ReceiptsApp;
const form=document.getElementById('setupForm'),msg=document.getElementById('msg');
function show(t,k='info'){msg.textContent=t;msg.className='notice '+k}
form.onsubmit=async e=>{
  e.preventDefault();
  const email=form.email.value.trim(),password=form.password.value,code=form.code.value.trim();
  const btn=form.querySelector('button');btn.disabled=true;btn.textContent='Criando acesso...';
  try{
    const {data,error}=await supabaseClient.functions.invoke('bootstrap-receipts-access',{body:{email,password,code}});
    if(error) throw error;
    if(data?.error) throw new Error(data.error);
    const login=await supabaseClient.auth.signInWithPassword({email,password});
    if(login.error) throw login.error;
    location.href='admin.html';
  }catch(err){
    let text='Não foi possível criar o acesso.';
    try{if(err?.context){const j=await err.context.json();if(j?.error)text=j.error}else if(err?.message)text=err.message}catch{}
    show(text,'error');
  }finally{btn.disabled=false;btn.textContent='Criar acesso'}
};
})();
