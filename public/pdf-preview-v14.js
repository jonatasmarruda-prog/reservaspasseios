/* Trilheiros Gestão V14 — visualizar PDF antes de baixar/compartilhar */
(function(){
  let currentUrl='';
  let currentFile=null;
  let currentMeta=null;

  function say(message,type=''){
    try{if(typeof toast==='function')return toast(message,type)}catch(_){ }
    alert(message);
  }

  function safeName(v){
    return String(v||'documento.pdf').replace(/[\\/:*?"<>|]+/g,'-');
  }

  function cleanup(){
    if(currentUrl){try{URL.revokeObjectURL(currentUrl)}catch(_){ }currentUrl=''}
    currentFile=null;currentMeta=null;
  }

  function closePreview(){
    document.getElementById('pdfPreviewV14')?.remove();
    cleanup();
  }
  window.closePdfPreviewV14=closePreview;

  function downloadCurrent(){
    if(!currentUrl||!currentFile)return;
    const a=document.createElement('a');
    a.href=currentUrl;a.download=currentFile.name;
    document.body.appendChild(a);a.click();a.remove();
  }

  async function shareCurrent(){
    if(!currentFile||!currentMeta)return;
    const data={
      title:currentMeta.title||'PDF dos Trilheiros',
      text:currentMeta.shareText||currentMeta.subtitle||'Documento dos Trilheiros de Rondonópolis.',
      files:[currentFile]
    };
    try{
      if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[currentFile]}))){
        await navigator.share(data);
        return;
      }
      say('Seu navegador não permite compartilhar o PDF diretamente. Toque em “Baixar PDF” e anexe o arquivo no WhatsApp ou e-mail.');
    }catch(e){
      if(e?.name==='AbortError')return;
      console.error(e);
      say('Não foi possível abrir o compartilhamento agora. Você pode baixar o PDF e enviar pelo WhatsApp ou e-mail.','error');
    }
  }

  window.openPdfPreviewV14=function(doc,options={}){
    closePreview();
    const filename=safeName(options.filename||'documento-trilheiros.pdf');
    const title=options.title||'Visualizar PDF';
    const subtitle=options.subtitle||'';
    const blob=doc.output('blob');
    currentUrl=URL.createObjectURL(blob);
    currentFile=new File([blob],filename,{type:'application/pdf'});
    currentMeta={...options,filename,title,subtitle};

    const back=document.createElement('div');
    back.id='pdfPreviewV14';back.className='pdfPreviewBackV14';
    back.innerHTML=`<section class="pdfPreviewCardV14" role="dialog" aria-modal="true" aria-label="${title.replace(/"/g,'&quot;')}">
      <header class="pdfPreviewHeadV14">
        <div><span>DOCUMENTO GERADO</span><h2>${title}</h2>${subtitle?`<p>${subtitle}</p>`:''}</div>
        <button type="button" class="pdfPreviewCloseV14" aria-label="Fechar">✕</button>
      </header>
      <div class="pdfPreviewActionsV14">
        <button type="button" class="pdfPreviewShareV14">📤 Compartilhar PDF</button>
        <button type="button" class="pdfPreviewOpenV14">↗ Abrir PDF</button>
        <button type="button" class="pdfPreviewDownloadV14">⬇ Baixar PDF</button>
      </div>
      <p class="pdfPreviewHintV14">No celular, toque em <b>Compartilhar PDF</b> e escolha WhatsApp, Gmail ou outro aplicativo. Este documento pode conter nome e CPF; compartilhe apenas com pessoas autorizadas.</p>
      <div class="pdfPreviewFrameWrapV14"><iframe class="pdfPreviewFrameV14" title="Pré-visualização do PDF"></iframe><div class="pdfPreviewFallbackV14">Se a visualização não aparecer neste aparelho, toque em <b>Abrir PDF</b>.</div></div>
    </section>`;
    document.body.appendChild(back);
    const frame=back.querySelector('.pdfPreviewFrameV14');frame.src=currentUrl;
    back.querySelector('.pdfPreviewCloseV14').onclick=closePreview;
    back.querySelector('.pdfPreviewShareV14').onclick=shareCurrent;
    back.querySelector('.pdfPreviewDownloadV14').onclick=downloadCurrent;
    back.querySelector('.pdfPreviewOpenV14').onclick=()=>window.open(currentUrl,'_blank','noopener');
    back.addEventListener('click',e=>{if(e.target===back)closePreview()});
    document.addEventListener('keydown',function escOnce(e){if(e.key==='Escape'){document.removeEventListener('keydown',escOnce);closePreview()}},{once:false});
    return true;
  };

  /* Torna mais claro no painel que o clique abre uma visualização, não baixa automaticamente. */
  function patchLabels(){
    document.querySelectorAll('button[title="PDF Premium"]').forEach(b=>b.title='Visualizar PDF');
    document.querySelectorAll('.reportCards button').forEach(b=>{
      const strong=b.querySelector('strong');
      if(strong?.textContent.includes('Lista oficial'))b.title='Visualizar lista em PDF';
      if(strong?.textContent.includes('Mapa de hospedagem'))b.title='Visualizar mapa em PDF';
      if(strong?.textContent.includes('Lista de transporte'))b.title='Visualizar lista de transporte em PDF';
    });
  }
  new MutationObserver(patchLabels).observe(document.documentElement,{subtree:true,childList:true});
  window.addEventListener('load',patchLabels);
})();
