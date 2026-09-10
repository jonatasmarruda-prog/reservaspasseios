/* Trilheiros Gestão V14 — visualizar PDF antes de baixar/compartilhar */
(function(){
  let currentUrl='';
  let currentFile=null;
  let currentMeta=null;
  let escapeHandler=null;

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

  function say(message,type=''){
    try{if(typeof toast==='function')return toast(message,type)}catch(_){ }
    alert(message);
  }

  function safeName(v){
    return String(v||'documento.pdf').replace(/[\\/:*?"<>|]+/g,'-');
  }

  function metaFromFilename(filename){
    const n=String(filename||'').toLowerCase();
    if(n.startsWith('lista-oficial-'))return{title:'Lista oficial de participantes',shareText:'Lista oficial de participantes — Trilheiros de Rondonópolis'};
    if(n.startsWith('transporte-'))return{title:'Lista de transporte',shareText:'Lista de transporte — Trilheiros de Rondonópolis'};
    if(n.startsWith('quartos-'))return{title:'Mapa de hospedagem',shareText:'Mapa de hospedagem — Trilheiros de Rondonópolis'};
    if(n.startsWith('seguro-'))return{title:'Lista para seguro',shareText:'Lista para seguro — Trilheiros de Rondonópolis'};
    return{title:'Documento PDF',shareText:'Documento — Trilheiros de Rondonópolis'};
  }

  function cleanup(){
    if(currentUrl){try{URL.revokeObjectURL(currentUrl)}catch(_){ }currentUrl=''}
    currentFile=null;currentMeta=null;
    if(escapeHandler){document.removeEventListener('keydown',escapeHandler);escapeHandler=null}
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
      say('Este navegador não consegue anexar o PDF diretamente. Toque em “Baixar PDF” e depois envie o arquivo pelo WhatsApp ou e-mail.');
    }catch(e){
      if(e?.name==='AbortError')return;
      console.error(e);
      say('Não foi possível abrir o compartilhamento agora. Você pode baixar o PDF e enviar pelo WhatsApp ou e-mail.','error');
    }
  }

  window.openPdfPreviewV14=function(doc,options={}){
    closePreview();
    const filename=safeName(options.filename||'documento-trilheiros.pdf');
    const inferred=metaFromFilename(filename);
    const title=options.title||inferred.title;
    const subtitle=options.subtitle||'Confira o documento antes de compartilhar.';
    const shareText=options.shareText||inferred.shareText;
    const blob=doc.output('blob');
    currentUrl=URL.createObjectURL(blob);
    try{currentFile=new File([blob],filename,{type:'application/pdf'})}catch(_){currentFile=blob;currentFile.name=filename}
    currentMeta={...options,filename,title,subtitle,shareText};

    const back=document.createElement('div');
    back.id='pdfPreviewV14';back.className='pdfPreviewBackV14';
    back.innerHTML=`<section class="pdfPreviewCardV14" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <header class="pdfPreviewHeadV14">
        <div><span>DOCUMENTO GERADO</span><h2>${esc(title)}</h2><p>${esc(subtitle)}</p></div>
        <button type="button" class="pdfPreviewCloseV14" aria-label="Fechar">✕</button>
      </header>
      <div class="pdfPreviewActionsV14">
        <button type="button" class="pdfPreviewShareV14">📤 Compartilhar no WhatsApp / E-mail</button>
        <button type="button" class="pdfPreviewOpenV14">👁 Visualizar PDF</button>
        <button type="button" class="pdfPreviewDownloadV14">⬇ Baixar PDF</button>
      </div>
      <p class="pdfPreviewHintV14">Primeiro confira a lista abaixo. Depois toque em <b>Compartilhar no WhatsApp / E-mail</b>; no Android abrirá a tela de compartilhamento do celular com o PDF anexado. Este documento pode conter nome e CPF.</p>
      <div class="pdfPreviewFrameWrapV14"><iframe class="pdfPreviewFrameV14" title="Pré-visualização do PDF"></iframe><div class="pdfPreviewFallbackV14">Se a visualização não aparecer neste aparelho, toque em <b>Visualizar PDF</b>.</div></div>
    </section>`;
    document.body.appendChild(back);
    back.querySelector('.pdfPreviewFrameV14').src=currentUrl;
    back.querySelector('.pdfPreviewCloseV14').onclick=closePreview;
    back.querySelector('.pdfPreviewShareV14').onclick=shareCurrent;
    back.querySelector('.pdfPreviewDownloadV14').onclick=downloadCurrent;
    back.querySelector('.pdfPreviewOpenV14').onclick=()=>window.open(currentUrl,'_blank','noopener');
    back.addEventListener('click',e=>{if(e.target===back)closePreview()});
    escapeHandler=e=>{if(e.key==='Escape')closePreview()};
    document.addEventListener('keydown',escapeHandler);
    return true;
  };

  function installSaveInterceptor(){
    const ns=window.jspdf;
    const Original=ns?.jsPDF;
    if(!Original)return false;
    if(Original.__trilheirosPreviewCtorV14)return true;

    function PreviewJsPDF(...args){
      const doc=new Original(...args);
      const originalSave=typeof doc.save==='function'?doc.save.bind(doc):null;
      if(originalSave){
        doc.__trilheirosOriginalSave=originalSave;
        doc.save=function(filename='documento.pdf',options={}){
          const meta=metaFromFilename(filename);
          window.openPdfPreviewV14(doc,{filename,...meta});
          return options?.returnPromise?Promise.resolve(doc):doc;
        };
      }
      return doc;
    }

    try{Object.setPrototypeOf(PreviewJsPDF,Original)}catch(_){ }
    try{PreviewJsPDF.prototype=Original.prototype}catch(_){ }
    PreviewJsPDF.__trilheirosPreviewCtorV14=true;
    PreviewJsPDF.__trilheirosOriginalCtorV14=Original;
    ns.jsPDF=PreviewJsPDF;
    return true;
  }

  function patchLabels(){
    document.querySelectorAll('button[title="PDF Premium"]').forEach(b=>b.title='Visualizar PDF');
    document.querySelectorAll('.reportCards button').forEach(b=>{
      const strong=b.querySelector('strong');
      if(strong?.textContent.includes('Lista oficial'))b.title='Visualizar lista em PDF';
      if(strong?.textContent.includes('Mapa de hospedagem'))b.title='Visualizar mapa em PDF';
      if(strong?.textContent.includes('Lista de transporte'))b.title='Visualizar lista de transporte em PDF';
    });
  }

  installSaveInterceptor();
  const retry=setInterval(()=>{if(installSaveInterceptor())clearInterval(retry)},250);
  setTimeout(()=>clearInterval(retry),5000);
  new MutationObserver(patchLabels).observe(document.documentElement,{subtree:true,childList:true});
  window.addEventListener('load',()=>{installSaveInterceptor();patchLabels()});
})();
