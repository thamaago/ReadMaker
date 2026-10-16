/* PDF source/output review. Source rendering is lazy; corrections are literal
   text-node edits shared by every chapter view, never whole-HTML replacement. */
(function(global){
  'use strict';
  const parse=html=>new DOMParser().parseFromString(String(html||''),'text/html');
  function textNodes(block){
    const walker=block.ownerDocument.createTreeWalker(block,4),nodes=[];
    let node;while((node=walker.nextNode()))nodes.push(node);
    return nodes;
  }
  function blocksForPage(chapters,page){
    const blocks=[];
    (chapters||[]).forEach(chapter=>{
      parse(chapter.html).querySelectorAll('[data-rm-block]').forEach(node=>{
        const pages=(node.getAttribute('data-rm-pages')||'').split(/\s+/).map(Number);
        if(pages.includes(page))blocks.push({id:node.getAttribute('data-rm-block'),pages,node,chapter});
      });
    });
    return blocks;
  }
  function replaceBlocks(html,replacements){
    const doc=parse(html);let changed=false;
    doc.querySelectorAll('[data-rm-block]').forEach(node=>{
      const next=replacements.get(node.getAttribute('data-rm-block'));
      if(next!==undefined){node.replaceWith(parse(next).body.firstElementChild);changed=true;}
    });
    return changed?doc.body.innerHTML:html;
  }
  // Shadow DOM isolates styles, not scripts. Rebuild a small inert subtree;
  // never attach arbitrary source nodes, event attributes, or remote resources.
  function previewNode(node,images){
    if(node.nodeType===3)return document.createTextNode(node.textContent);
    if(node.nodeType!==1)return document.createDocumentFragment();
    const tag=node.tagName.toLowerCase();
    if(!/^(p|div|span|h[1-6]|em|strong|b|i|u|s|sup|sub|br|hr|blockquote|ul|ol|li|a|img|table|thead|tbody|tfoot|tr|td|th)$/.test(tag))return document.createDocumentFragment();
    const copy=document.createElement(tag);
    if(tag==='img'){
      const image=images.find(im=>'images/'+im.name===node.getAttribute('src')&&/^image\/(png|jpeg|gif|webp|bmp)$/i.test(im.mime));
      if(!image)return document.createDocumentFragment();
      copy.src='data:'+image.mime+';base64,'+image.b64;copy.alt=node.getAttribute('alt')||'';
    }
    if(/^(td|th)$/.test(tag))['colspan','rowspan'].forEach(attr=>{const n=Number(node.getAttribute(attr));if(Number.isInteger(n)&&n>0&&n<=100)copy.setAttribute(attr,String(n));});
    if(node.classList.contains('pdf-inline-image'))copy.className='pdf-inline-image';
    if(node.classList.contains('pdf-page'))copy.className='pdf-page';
    node.childNodes.forEach(child=>copy.appendChild(previewNode(child,images)));
    return copy;
  }
  function create(context){
    const $=id=>document.getElementById(id),t=context.t;
    const state={owner:null,page:1,open:false,draft:false,fields:[],snapshots:new Map(),request:0,epoch:0,document:null,loading:null,loadingTask:null,renderTask:null};
    const changes=book=>book ? (book._pdfReviewChanges||(book._pdfReviewChanges=new Map())) : new Map();
    const reviewed=book=>book._pdfReviewedPages||(book._pdfReviewedPages=new Set());
    function notice(key){$('pdfReviewNotice').textContent=t(key);}
    function hasDraft(){return state.owner===context.getBook() && state.draft;}
    function hasChanges(){return hasDraft()||changes(context.getBook()).size>0;}
    function releaseSource(){
      state.epoch++;state.request++;
      if(state.renderTask){state.renderTask.cancel();state.renderTask=null;}
      if(state.loadingTask){try{Promise.resolve(state.loadingTask.destroy()).catch(()=>{});}catch(e){}state.loadingTask=null;}
      if(state.document){try{Promise.resolve(state.document.destroy()).catch(()=>{});}catch(e){}state.document=null;}
      state.loading=null;
      $('pdfReviewSource').querySelectorAll('canvas').forEach(cv=>{cv.width=0;cv.height=0;});
      $('pdfReviewSource').replaceChildren();$('pdfReviewSourceStatus').textContent='';
    }
    function close(force){
      if(!force&&hasDraft()){notice('pdfReviewPending');return false;}
      state.open=false;state.draft=false;state.fields=[];state.snapshots.clear();
      $('pdfReviewPanel').hidden=true;$('pdfReviewOutput').shadowRoot?.replaceChildren();$('pdfReviewFields').replaceChildren();
      state.outputSignature='';
      releaseSource();return true;
    }
    function sync(){
      const book=context.getBook();
      if(state.owner!==book){close(true);state.owner=book;state.page=1;}
      $('pdfReviewBtn').hidden=!(book&&book.sourcePageCount&&book._sourceFile&&!book._pdfReparsing);
      $('pdfReviewSave').disabled=!hasDraft();$('pdfReviewCancel').disabled=!hasDraft();
      $('pdfReviewReset').disabled=!hasChanges();
      if(state.open)updateState();
    }
    function updateState(){
      const book=state.owner,info=(book.pdfPageInfo||[]).find(p=>p.page===state.page)||{};
      $('pdfReviewPage').value=state.page;$('pdfReviewPage').max=book.sourcePageCount;
      $('pdfReviewPageCount').textContent='/ '+book.sourcePageCount;
      $('pdfReviewPrev').disabled=state.page<=1;$('pdfReviewNext').disabled=state.page>=book.sourcePageCount;
      const flags=[t(book.pdfMode==='fixed'?'pdfReviewFixed':info.ocr?'pdfReviewOcr':'pdfReviewDigital')];
      if(info.needsReview)flags.push(t('pdfReviewUncertain'));
      if(reviewed(book).has(state.page))flags.push(t('pdfReviewReviewed'));
      if(changes(book).size)flags.push(changes(book).size+' '+t('pdfReviewChanged'));
      $('pdfReviewState').textContent=flags.join(' ');
    }
    async function sourceDocument(book){
      if(state.document)return state.document;
      if(state.loading)return state.loading;
      const epoch=state.epoch;
      const promise=(async()=>{
        const library=await context.loadPdf(),bytes=await book._sourceFile.arrayBuffer();
        if(epoch!==state.epoch||book!==context.getBook()||!state.open)return null;
        const task=library.getDocument({data:new Uint8Array(bytes),isEvalSupported:false,enableScripting:false});
        state.loadingTask=task;
        const pdf=await task.promise;
        if(state.loadingTask===task)state.loadingTask=null;
        if(epoch!==state.epoch||book!==context.getBook()||!state.open){await pdf.destroy();return null;}
        state.document=pdf;return pdf;
      })();
      state.loading=promise;
      try{return await promise;}finally{if(state.loading===promise)state.loading=null;}
    }
    async function renderSource(){
      const request=++state.request,book=state.owner,pageNumber=state.page;
      if(state.renderTask){state.renderTask.cancel();state.renderTask=null;}
      $('pdfReviewSource').querySelectorAll('canvas').forEach(cv=>{cv.width=0;cv.height=0;});
      $('pdfReviewSource').replaceChildren();$('pdfReviewSourceStatus').textContent=t('pdfReviewLoading');
      let canvas;
      try{
        const pdf=await sourceDocument(book);
        if(!pdf||request!==state.request||book!==context.getBook()||!state.open)return;
        const page=await pdf.getPage(pageNumber);
        if(request!==state.request||!state.open)return;
        const natural=page.getViewport({scale:1});
        const zoom=[1,1.5,2,3].includes(Number($('pdfReviewZoom').value))?Number($('pdfReviewZoom').value):1;
        const width=Math.min(1600,Math.max(480,($('pdfReviewSource').clientWidth||480)*Math.min(global.devicePixelRatio||1,2)*zoom));
        const viewport=page.getViewport({scale:Math.min(width/natural.width,2400/natural.height)});
        canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(viewport.width));canvas.height=Math.max(1,Math.round(viewport.height));
        canvas.style.width=(zoom*100)+'%';canvas.style.maxWidth='none';
        canvas.setAttribute('role','img');canvas.setAttribute('aria-label',t('pdfReviewSource')+' '+pageNumber);
        const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas unavailable');
        ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
        const task=page.render({canvasContext:ctx,viewport});state.renderTask=task;
        try{await task.promise;}finally{if(state.renderTask===task)state.renderTask=null;}
        if(request!==state.request||book!==context.getBook()||!state.open){canvas.width=0;canvas.height=0;return;}
        $('pdfReviewSource').replaceChildren(canvas);$('pdfReviewSourceStatus').textContent='';
      }catch(error){
        if(canvas){canvas.width=0;canvas.height=0;}
        if(request===state.request&&state.open)$('pdfReviewSourceStatus').textContent=t('pdfReviewSourceError')+(error.message||'');
      }
    }
    function renderOutput(){
      const book=state.owner,blocks=blocksForPage(context.getChapters(),state.page),fields=$('pdfReviewFields');
      state.fields=[];state.snapshots.clear();fields.replaceChildren();
      const preview=document.createElement('div');preview.className='pdf-review-book';
      blocks.forEach((entry,index)=>{
        const block=entry.node;state.snapshots.set(entry.id,block.outerHTML);
        preview.appendChild(previewNode(block,book.images||[]));
        if(book.pdfMode==='fixed')return;
        textNodes(block).forEach((node,nodeIndex)=>{
          if(!node.textContent.trim())return;
          const label=document.createElement('label'),input=document.createElement('textarea');
          input.id='pdfReviewText-'+index+'-'+nodeIndex;input.rows=3;
          label.htmlFor=input.id;label.textContent=t('pdfReviewBlock')+' '+(index+1)+(nodeIndex?'.'+(nodeIndex+1):'')+' · '+entry.chapter.title+' · '+t('pdfReviewPages')+' '+entry.pages.join(', ');
          input.value=node.textContent;input.setAttribute('spellcheck','true');
          input.addEventListener('input',()=>{state.draft=true;context.invalidate();sync();notice('pdfReviewPending');});
          fields.append(label,input);state.fields.push({id:entry.id,index:nodeIndex,input});
        });
      });
      if(!blocks.length){const empty=document.createElement('p');empty.textContent=t('pdfReviewEmpty');preview.appendChild(empty);}
      const css=context.css(book.pdfMode==='fixed')+'\n:host{display:block;overflow-wrap:anywhere;background:white;color:black;font:18px/1.5 Georgia,serif}.pdf-review-book{padding:16px}h1{font-size:1.6em}img{max-width:100%;height:auto}';
      const signature=css+preview.innerHTML;
      if(state.outputSignature!==signature){
        const host=$('pdfReviewOutput'),root=host.shadowRoot||host.attachShadow({mode:'open'}),style=document.createElement('style');
        style.textContent=css;root.replaceChildren(style,preview);state.outputSignature=signature;
      }
    }
    function render(){
      if(!state.open||state.owner!==context.getBook())return;
      renderOutput();updateState();sync();renderSource();
    }
    function open(){
      sync();if(!state.owner||$('pdfReviewBtn').hidden)return;
      if(state.open){$('pdfReviewPanel').scrollIntoView?.({block:'nearest'});return;}
      state.open=true;$('pdfReviewPanel').hidden=false;
      const flagged=(state.owner.pdfPageInfo||[]).find(p=>p.needsReview&&!reviewed(state.owner).has(p.page));
      if(flagged)state.page=flagged.page;
      $('pdfReviewNotice').textContent='';render();
    }
    function navigate(page){
      if(hasDraft()){notice('pdfReviewPending');$('pdfReviewPage').value=state.page;return false;}
      const value=Number(page);
      if(!Number.isFinite(value)){updateState();return false;}
      const next=Math.max(1,Math.min(state.owner.sourcePageCount,Math.floor(value)));
      // A number input may emit change again on blur. Replacing the editor
      // during that blur detaches the textarea the user is about to focus.
      if(next===state.page){updateState();return true;}
      state.page=next;
      $('pdfReviewNotice').textContent='';render();return true;
    }
    function propagate(replacements){
      const book=state.owner;
      if(book.html)book.html=replaceBlocks(book.html,replacements);
      const views=[book.chapters,book.outlineChapters,book._editableChapters,...Object.values(book._chapterViews||{})];
      const seen=new Set();views.forEach(view=>(view||[]).forEach(chapter=>{
        if(seen.has(chapter))return;seen.add(chapter);chapter.html=replaceBlocks(chapter.html,replacements);
      }));
    }
    function save(){
      if(!hasDraft())return false;
      const current=blocksForPage(context.getChapters(),state.page),replacements=new Map();
      for(const [id,snapshot] of state.snapshots){
        const entry=current.find(b=>b.id===id);
        if(!entry||entry.node.outerHTML!==snapshot){notice('pdfReviewStale');return false;}
      }
      current.forEach(entry=>{
        const nodes=textNodes(entry.node);
        state.fields.filter(field=>field.id===entry.id).forEach(field=>{
          nodes[field.index].textContent=field.input.value.replace(/\r?\n/g,' ');
        });
        const next=entry.node.outerHTML,original=changes(state.owner).get(entry.id)||state.snapshots.get(entry.id);
        if(next!==state.snapshots.get(entry.id)){replacements.set(entry.id,next);entry.pages.forEach(page=>reviewed(state.owner).delete(page));}
        if(next===original)changes(state.owner).delete(entry.id);else changes(state.owner).set(entry.id,original);
      });
      propagate(replacements);state.draft=false;context.invalidate();context.onChange();renderOutput();sync();notice('pdfReviewSaved');return true;
    }
    function cancel(){state.draft=false;renderOutput();sync();$('pdfReviewNotice').textContent='';}
    function reset(){
      // Restoring old text also revokes review completion for affected pages.
      changes(state.owner).forEach(original=>{parse(original).querySelectorAll('[data-rm-pages]').forEach(node=>{
        (node.getAttribute('data-rm-pages')||'').split(/\s+/).map(Number).forEach(page=>reviewed(state.owner).delete(page));
      });});
      propagate(changes(state.owner));changes(state.owner).clear();state.draft=false;
      context.invalidate();context.onChange();renderOutput();sync();notice('pdfReviewRestored');
    }
    $('pdfReviewBtn').addEventListener('click',open);
    $('pdfReviewClose').addEventListener('click',()=>close(false));
    $('pdfReviewPrev').addEventListener('click',()=>navigate(state.page-1));
    $('pdfReviewNext').addEventListener('click',()=>navigate(state.page+1));
    $('pdfReviewPage').addEventListener('change',()=>navigate($('pdfReviewPage').value));
    $('pdfReviewZoom').addEventListener('change',()=>{if(state.open)renderSource();});
    $('pdfReviewFlagged').addEventListener('click',()=>{
      if(hasDraft()){notice('pdfReviewPending');return;}
      const flags=(state.owner.pdfPageInfo||[]).filter(p=>p.needsReview&&!reviewed(state.owner).has(p.page));
      if(!flags.length){notice('pdfReviewNoFlags');return;}
      navigate((flags.find(p=>p.page>state.page)||flags[0]).page);
    });
    $('pdfReviewSave').addEventListener('click',save);$('pdfReviewCancel').addEventListener('click',cancel);
    $('pdfReviewReset').addEventListener('click',reset);
    $('pdfReviewMark').addEventListener('click',()=>{
      if(hasDraft()){notice('pdfReviewPending');return;}
      reviewed(state.owner).add(state.page);updateState();
    });
    return {open,close,sync,hasDraft,hasChanges,save,navigate,refresh(){if(state.open&&!hasDraft()){renderOutput();sync();}}};
  }
  global.ReadMakerPdfReview={create,blocksForPage,replaceBlocks};
})(window);
