// Build representative fixtures with the actual application builder and editor.
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),{JSDOM,VirtualConsole}=require('jsdom'),JSZip=require('jszip');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output/epub/validation');fs.mkdirSync(out,{recursive:true});
const html=fs.readFileSync(path.join(root,'index.html'),'utf8').replace('<script src="pdf-review.js"></script>',()=>'<script>'+fs.readFileSync(path.join(root,'pdf-review.js'),'utf8')+'</script>');
const dom=new JSDOM(html,{runScripts:'dangerously',url:'http://localhost',virtualConsole:new VirtualConsole(),beforeParse(w){w.JSZip=JSZip;}});
const w=dom.window,d=w.document;
const image={name:'diagram.png',mime:'image/png',b64:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1kAAAAASUVORK5CYII='};
(async()=>{
 await new Promise(resolve=>setTimeout(resolve,0));
 // Exercise saved corrections, retaining an image and emphasis in the same paragraph.
 w.pdfjsLib={getDocument:()=>({promise:Promise.reject(new Error('Source rendering is excluded from this packaging fixture.'))})};
 const book={html:'<h1 data-rm-pages="1" data-rm-block="heading">Chapter</h1><p data-rm-pages="1" data-rm-block="body"><em>Incorrect OCR</em><img src="images/diagram.png" alt="Diagram"/></p>',images:[image],sourcePageCount:1,pdfMode:'reflow',pdfPageInfo:[{page:1,ocr:true,needsReview:true}],_sourceFile:{name:'synthetic.pdf',arrayBuffer:async()=>new ArrayBuffer(1)}};
 w.finishIngest(book,'Corrected PDF');d.getElementById('pdfReviewBtn').click();
 const field=[...d.querySelectorAll('#pdfReviewFields textarea')].find(node=>node.value==='Incorrect OCR');
 field.value='Corrected text & literal <markup>';field.dispatchEvent(new w.Event('input',{bubbles:true}));d.getElementById('pdfReviewSave').click();d.getElementById('pdfReviewClose').click();
 const corrected=w.currentBook();corrected.language='id';corrected.author='ReadMaker synthetic test';
 const fixtures={
  'corrected-reflow':corrected,
  'rtl-reflow':{title:'RTL fixture',language:'ar',cssProfile:'universal',images:[],chapters:[{title:'الفصل الأول',html:'<h1>الفصل الأول</h1><p>هذا نص واضح للقراءة.</p>'}]},
  'fixed-pages':{title:'Fixed fixture',language:'en',cssProfile:'universal',pdfMode:'fixed',fixedViewport:{width:480,height:800},images:[image],chapters:[{title:'Page 1',html:'<div class="pdf-page" style="margin:0;padding:0"><img src="images/diagram.png" alt="Test" style="display:block;width:100%;height:auto"/></div>'}]},
  'comic-pages':{title:'Comic fixture',language:'en',cssProfile:'crosspoint',comic:true,images:[image],chapters:[{title:'Page 1',html:'<p><img src="images/diagram.png" alt="Panel"/></p>'},{title:'Page 2',html:'<p><img src="images/diagram.png" alt="Panel"/></p>'}]}
 };
 for(const [name,data] of Object.entries(fixtures)){
  data.author=data.author||'ReadMaker synthetic test';
  let warnings=0;const blob=await w.buildEpub(data,()=>warnings++);assert.equal(warnings,0);
  const bytes=Buffer.from(await blob.arrayBuffer());fs.writeFileSync(path.join(out,name+'.epub'),bytes);
  if(name==='corrected-reflow'){
   const zip=await JSZip.loadAsync(bytes),chapter=await zip.file('OEBPS/chap001.xhtml').async('string');
   assert.match(chapter,/Corrected text &amp; literal &lt;markup&gt;/);assert.doesNotMatch(chapter,/Incorrect OCR|data-rm-block|data-rm-pages/);assert.match(chapter,/<em>/);assert.ok(zip.file('OEBPS/images/diagram.png'));
  }
 }
 console.log('Built four EPUB validation fixtures, including a saved OCR correction.');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>w.close());
