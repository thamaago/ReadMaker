// Build representative fixtures with the actual application builder and editor.
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),{JSDOM,VirtualConsole}=require('jsdom'),JSZip=require('jszip');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output/epub/validation');fs.mkdirSync(out,{recursive:true});
const html=fs.readFileSync(path.join(root,'index.html'),'utf8').replace('<script src="pdf-review.js"></script>',()=>'<script>'+fs.readFileSync(path.join(root,'pdf-review.js'),'utf8')+'</script>');
const dom=new JSDOM(html,{runScripts:'dangerously',url:'http://localhost',virtualConsole:new VirtualConsole(),beforeParse(w){w.JSZip=JSZip;}});
const w=dom.window,d=w.document;
const image={name:'diagram.png',mime:'image/png',b64:fs.readFileSync(path.join(__dirname,'fixtures/validation-diagram.png')).toString('base64')};
w.fetch=async url=>{
 assert.equal(url,'https://article.example/diagram.png');
 return {ok:true,headers:{get:()=>null},arrayBuffer:async()=>Buffer.from(image.b64,'base64')};
};
w.decodeWebImage=async()=>{}; // jsdom has no decoder; the gate and Pillow verify these fixture bytes.
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
  'web-article':{title:'Offline article fixture',author:'ReadMaker synthetic test',language:'en',images:[],chapters:[{title:'Article',html:'<h1>Offline article</h1><p>Text and image remain available offline.</p><img src="https://article.example/diagram.png" alt="Synthetic diagram"/>'}]},
  'fixed-pages':{title:'Fixed fixture',language:'en',cssProfile:'universal',pdfMode:'fixed',fixedViewport:{width:480,height:800},images:[image],chapters:[{title:'Page 1',html:'<div class="pdf-page" style="margin:0;padding:0"><img src="images/diagram.png" alt="Test" style="display:block;width:100%;height:auto"/></div>'}]},
  'comic-pages':{title:'Comic fixture',language:'en',cssProfile:'crosspoint',comic:true,images:[image],chapters:[{title:'Page 1',html:'<p><img src="images/diagram.png" alt="Panel"/></p>'},{title:'Page 2',html:'<p><img src="images/diagram.png" alt="Panel"/></p>'}]},
  'long-flow-notes':{title:'Long flow with notes',language:'id',images:[image],chapters:w.splitChapters(w.cleanHtmlFragment('<a id="start"></a><h1>Long chapter</h1><p>'+'Clear text. '.repeat(23000)+'</p>Free text<img src="images/diagram.png" alt="Diagram"/><p><a href="#note">Read note</a></p><h1>Notes</h1><p id="note">well-known &amp; self-esteem <a href="#start">Back</a></p>'),'h1')},
  'mixed-viewports':{title:'Mixed page sizes',language:'en',pdfMode:'fixed',images:[image],chapters:[{title:'Landscape',fixedViewport:{width:1200,height:800},html:'<img src="images/diagram.png" alt="Landscape test"/>'},{title:'Portrait',fixedViewport:{width:800,height:1200},html:'<img src="images/diagram.png" alt="Portrait test"/>'}]}
 };
 for(const [name,data] of Object.entries(fixtures)){
  data.author=data.author||'ReadMaker synthetic test';
  let warnings=0;const blob=await w.buildEpub(data,()=>warnings++);assert.equal(warnings,0);
  const bytes=Buffer.from(await blob.arrayBuffer());fs.writeFileSync(path.join(out,name+'.epub'),bytes);
  if(name==='corrected-reflow'){
   const zip=await JSZip.loadAsync(bytes),chapter=await zip.file('OEBPS/chap001.xhtml').async('string');
   assert.match(chapter,/Corrected text &amp; literal &lt;markup&gt;/);assert.doesNotMatch(chapter,/Incorrect OCR|data-rm-block|data-rm-pages/);assert.match(chapter,/<em>/);assert.ok(zip.file('OEBPS/images/diagram.png'));
  }
  if(name==='long-flow-notes'){
   const zip=await JSZip.loadAsync(bytes),files=zip.file(/OEBPS\/chap\d+\.xhtml$/),all=(await Promise.all(files.map(f=>f.async('string')))).join('');
   assert.equal((all.match(/Clear text\./g)||[]).length,23000);assert.match(all,/Free text/);assert.equal((all.match(/src="images\/diagram.png"/g)||[]).length,1);assert.match(all,/href="chap\d+\.xhtml#note"/);assert.match(all,/id="start"/);
  }
 }
 console.log('Built seven EPUB validation fixtures, including lossless long flows, internal notes and mixed viewports.');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>w.close());
