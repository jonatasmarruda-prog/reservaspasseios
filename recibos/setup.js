(()=>{
const {supabaseClient}=window.ReceiptsApp;
const form=document.getElementById('setupForm'),msg=document.getElementById('msg');

function show(t,k='info'){msg.textContent=t;msg.className='notice '+k}

document.querySelectorAll('[data-toggle-password]').forEach(btn=>{
  btn.addEventListener('click',()=>{
    const input=document.getElementById(btn.dataset.togglePassword);
    const show=input.type==='password';
    input.type=show?'text':'password';
    btn.textContent=show?'🙈':'👁';
    btn.setAttribute('aria-label',show?'Ocultar senha':'Mostrar senha');
    btn.title=show?'Ocultar senha':'Mostrar senha';
  });
});

form.onsubmit=async e=>{
  e.preventDefault();
  const email=form.email.value.trim();
  const password=form.password.value;
  const confirm=form.confirm_password.value;
  const code=form.code?.value?.trim()||'';
  const btn=form.querySelector('button.btn-primary');

  msg.className='notice hidden';

  if(password!==confirm){
    show('As duas senhas não são iguais. Confira e tente novamente.','error');
    return;
  }
  if(password.length<8){
    show('A senha precisa ter pelo menos 8 caracteres.','error');
    return;
  }
  if(!supabaseClient){
    show('Não foi possível conectar ao sistema. Atualize a página e tente novamente.','error');
    return;
  }

  btn.disabled=true;
  btn.textContent='Criando acesso...';

  try{
    const {data,error}=await supabaseClient.functions.invoke('bootstrap-receipts-access',{body:{email,password,code}});
    if(error) throw error;
    if(data?.error) throw new Error(data.error);

    const login=await supabaseClient.auth.signInWithPassword({email,password});
    if(login.error) throw login.error;

    show('Acesso criado com sucesso. Abrindo o painel...','success');
    setTimeout(()=>location.href='admin.html?v=20260930-1955',500);
  }catch(err){
    let text='Não foi possível criar o acesso.';
    try{
      if(err?.context){
        const j=await err.context.json();
        if(j?.error) text=j.error;
      }else if(err?.message) text=err.message;
    }catch{}
    show(text,'error');
  }finally{
    btn.disabled=false;
    btn.textContent='Criar meu acesso';
  }
};
})();