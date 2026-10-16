const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),{JSDOM,VirtualConsole}=require('jsdom'),JSZip=require('jszip');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'pdf-review.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8').replace('<script src="pdf-review.js"></script>',()=>'<script>'+source+'</script>');
const errors=[],virtualConsole=new VirtualConsole();virtualConsole.on('jsdomError',e=>errors.push(e.message));
const dom=new JSDOM(html,{runScripts:'dangerously',url:'http://localhost',pretendToBeVisual:true,virtualConsole,beforeParse(w){
  w.JSZip=JSZip;w.HTMLCanvasElement.prototype.getContext=()=>({fillRect(){}});
}});
const w=dom.window,d=w.document,$=id=>d.getElementById(id),tick=()=>new Promise(r=>setTimeout(r,15));
let rendered=[],destroyed=0;
w.pdfjsLib={getDocument:()=>({promise:Promise.resolve({getPage:async n=>({getViewport:({scale})=>({width:400*scale,height:600*scale}),render:()=>{rendered.push(n);return {promise:Promise.resolve(),cancel(){}};}}),destroy:async()=>{destroyed++;}})})};
const file={name:'review.pdf',arrayBuffer:async()=>new ArrayBuffer(1)};
const image={name:'diagram.png',mime:'image/png',b64:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1kAAAAASUVORK5CYII='};
const fixture=()=>({html:'<p data-rm-pages="1" data-rm-block="a">Front matter remains.</p><p data-rm-pages="2" data-rm-block="b">A <em>noïse</em> <a href="https://example.org">link</a><img src="images/diagram.png" alt="Diagram"/></p><p data-rm-pages="3" data-rm-block="c">Final paragraph.</p>',images:[image],pdfMode:'reflow',sourcePageCount:3,pdfPageInfo:[{page:1},{page:2,ocr:true,needsReview:true},{page:3}],_sourceFile:file});
function type(input,value){input.value=value;input.dispatchEvent(new w.Event('input',{bubbles:true}));}
function change(id,value){$(id).value=value;$(id).dispatchEvent(new w.Event('change',{bubbles:true}));}
(async()=>{
 await tick();const book=fixture();w.finishIngest(book,'Review');
 assert.equal(rendered.length,0,'source rendering stays lazy until review opens');
 $('pdfReviewBtn').click();await tick();
 assert.equal($('pdfReviewPage').value,'2','first uncertain OCR page opens');
 assert.equal(rendered.join(','),'2','only the selected source page is rendered');
 assert.match($('pdfReviewState').textContent,/OCR/);
 assert.ok($('pdfReviewOutput').shadowRoot.querySelector('img[src^="data:image/png;base64,"]'));
 assert.equal($('pdfReviewOutput').shadowRoot.querySelector('a').getAttribute('href'),null,'preview links do not navigate');
 const stableField=d.querySelector('#pdfReviewFields textarea');change('pdfReviewPage','2');
 assert.equal(d.querySelector('#pdfReviewFields textarea'),stableField,'a repeated page change cannot detach the field about to receive focus');
 const target=[...d.querySelectorAll('#pdfReviewFields textarea')].find(e=>e.value==='noïse');
 assert.ok(target,'inline emphasis has an independently editable text node');
 w.eval("lastBuiltBlob=new Blob(['old']);lastBuiltName='old.epub'");
 type(target,'clean <script>alert(1)</script> & "quoted"\nnext line');
 assert.ok(w.eval('lastBuiltBlob===null'),'typing invalidates an older ready-to-send book');
 $('pdfReviewNext').click();assert.equal($('pdfReviewPage').value,'2','dirty navigation is blocked');
 $('pdfReviewClose').click();assert.equal($('pdfReviewPanel').hidden,false,'dirty close is blocked');
 $('build').click();assert.match($('status').textContent,/belum disimpan/,'build cannot omit unsaved typing');
 $('pdfReviewSave').click();
 assert.equal($('pdfReviewSave').disabled,true);
 assert.match(book.html,/&lt;script&gt;/,'typed markup remains literal text');
 const parsed=new w.DOMParser().parseFromString(book.html,'text/html');
 assert.equal(parsed.querySelectorAll('script').length,0);assert.equal(parsed.querySelector('em').textContent,'clean <script>alert(1)</script> & "quoted" next line');
 assert.equal(parsed.querySelector('a').textContent,'link');assert.equal(parsed.querySelector('img').getAttribute('src'),'images/diagram.png');
 assert.match(book.html,/Front matter remains/);assert.match(book.html,/Final paragraph/);
 const beforeCalls=rendered.length;change('outputPreset','layout');await tick();
 assert.equal($('outputPreset').value,'auto','reparse cannot silently discard saved corrections');
 assert.match($('status').textContent,/pulihkan/);assert.equal(rendered.length,beforeCalls);
 change('split','single');assert.match(w.currentBook().chapters.map(c=>c.html).join(''),/clean &lt;script&gt;/,'split keeps corrected canonical text');
 change('split','auto');
 const blob=await w.buildEpub(w.currentBook()),zip=await JSZip.loadAsync(await blob.arrayBuffer());
 const chapters=await Promise.all(Object.keys(zip.files).filter(n=>/^OEBPS\/chap\d+\.xhtml$/.test(n)).map(n=>zip.file(n).async('string')));
 const xhtml=chapters.join('');assert.match(xhtml,/clean &lt;script&gt;/);assert.match(xhtml,/<em>/);assert.match(xhtml,/diagram.png/);
 assert.doesNotMatch(xhtml,/data-rm-pages|data-rm-block/,'review provenance is stripped only on the export copy');
 assert.match(book.html,/data-rm-pages/,'export does not destroy internal page mapping');
 $('pdfReviewReset').click();assert.match(book.html,/>noïse<\/em>/,'restore uses the original block including inline formatting');
 assert.equal(book._pdfReviewChanges.size,0);
 type(d.querySelector('#pdfReviewFields textarea'),'discard me');$('pdfReviewCancel').click();
 assert.match(book.html,/Front matter/);assert.ok(!book.html.includes('discard me'));
 $('pdfReviewMark').click();assert.ok(book._pdfReviewedPages.has(2));
 $('pdfReviewNext').click();await tick();assert.equal($('pdfReviewPage').value,'3');
 $('pdfReviewClose').click();assert.equal($('pdfReviewPanel').hidden,true);assert.ok(destroyed>0,'close releases the preview PDF document');

 const hostile=fixture();hostile.pdfPageInfo=[];hostile.html='<p data-rm-pages="1" data-rm-block="x">Safe<script>window.evil=1</script><span style="background:url(https://invalid.example/track)">text</span><a href="javascript:alert(1)">link</a><img src="https://invalid.example/track" onerror="alert(1)"/><svg onload="alert(1)"></svg></p>';
 w.finishIngest(hostile,'Safety');$('pdfReviewBtn').click();await tick();
 const safe=$('pdfReviewOutput').shadowRoot;
 assert.equal(safe.querySelectorAll('script,svg,iframe,object,img').length,0);
 assert.equal(safe.querySelector('a').getAttribute('href'),null);assert.equal(safe.querySelector('span').attributes.length,0);
 assert.ok(!w.evil,'preview never attaches executable source nodes');$('pdfReviewClose').click();

 // Canonical geometry keeps prefix and image-only bookmark ranges without duplicating paragraphs.
 const item=(str,y=500)=>({str,x:30,y,w:250,h:12});
 const pages=[[item('Opening without punctuation')],[],[item('continues in the next section.')]];
 const refs=[[],['diagram.png'],[]],entries=[{page:0,title:'One',level:1},{page:1,title:'Two',level:1}];
 const canonical=w.pdfItemsToHtml(pages,refs,{breakPages:[0,1]});
 const outlined=w.chaptersFromPdfOutline(entries,pages,refs,canonical);
 assert.equal(outlined.length,2);assert.match(outlined[0].html,/Opening/);assert.doesNotMatch(outlined[1].html,/Opening/);
 assert.ok(outlined[1].html.indexOf('diagram.png')<outlined[1].html.indexOf('continues'),'image-only page stays before later text');
 const prefix=w.chaptersFromPdfOutline([{page:1,title:'One',level:1},{page:2,title:'Two',level:1}],[[item('FRONT MATTER')],[item('One body')],[item('Two body')]],[]);
 assert.equal(prefix.length,3);assert.match(prefix[0].html,/FRONT MATTER/);
 const crossing=w.pdfItemsToHtml([[item('A shared paragraph')],[item('continues here.')]],[],{});
 const mapped=w.ReadMakerPdfReview.blocksForPage([{title:'Together',html:crossing}],2);
 assert.equal(mapped.length,1);assert.equal(mapped[0].pages.join(','),'1,2','shared paragraphs carry both source page numbers');

 // Stable source IDs survive reorder and cached split changes.
 const reflow=fixture();reflow.outlineChapters=[{title:'First',html:reflow.html.split('<p data-rm-pages="3"')[0]},{title:'Last',html:'<p data-rm-pages="3"'+reflow.html.split('<p data-rm-pages="3"')[1]}];
 w.finishIngest(reflow,'Reorder');w.moveChapter(1,-1);$('pdfReviewBtn').click();await tick();change('pdfReviewPage','3');await tick();
 type(d.querySelector('#pdfReviewFields textarea'),'Correct final paragraph.');$('pdfReviewSave').click();
 assert.match(w.currentBook().chapters[0].html,/Correct final/);assert.match(reflow.outlineChapters[1].html,/Correct final/);
 change('split','single');change('split','auto');assert.equal(w.currentBook().chapters[0].title,'Last');assert.match(w.currentBook().chapters[0].html,/Correct final/);
 $('pdfReviewReset').click();$('pdfReviewClose').click();

 // Manual mode changes override the automatic preset, and review is unavailable while reparsing.
 const originalParse=w.parseToBook;let resolveParse;
 w.parseToBook=()=>new Promise(resolve=>{resolveParse=resolve;});
 change('pdfMode','fixed');assert.equal($('pdfReviewBtn').hidden,true);
 $('pdfReviewBtn').click();assert.equal($('pdfReviewPanel').hidden,true);
 resolveParse({...fixture(),pdfMode:'fixed',chapters:[{title:'Page',html:'<div data-rm-pages="1" data-rm-block="f"><img src="images/diagram.png"/></div>'}]});await tick();
 assert.equal($('pdfMode').value,'fixed');assert.equal($('outputPreset').value,'custom');assert.equal(w.eval('parsed.pdfMode'),'fixed');
 $('pdfReviewBtn').click();await tick();assert.equal(d.querySelectorAll('#pdfReviewFields textarea').length,0,'fixed-page review cannot pretend to edit raster text');
 $('pdfReviewClose').click();w.parseToBook=originalParse;

 // A late PDF response cannot put old pixels into a newly loaded book.
 let resolveSource,lateDestroyed=0;
 w.pdfjsLib={getDocument:()=>({promise:new Promise(resolve=>{resolveSource=resolve;}),destroy:async()=>{}})};
 w.finishIngest(fixture(),'Old');$('pdfReviewBtn').click();await tick();
 w.finishIngest({html:'<p>New text book.</p>',images:[]},'New');
 resolveSource({destroy:async()=>{lateDestroyed++;}});await tick();
 assert.equal($('pdfReviewPanel').hidden,true);assert.equal($('pdfReviewSource').querySelectorAll('canvas').length,0);assert.equal(lateDestroyed,1);

 // Content edits during asynchronous export must not deliver an obsolete file.
 const originalBuild=w.buildEpub;let resolveBuild,downloads=0;
 w.HTMLAnchorElement.prototype.click=()=>{downloads++;};
 w.buildEpub=()=>new Promise(resolve=>{resolveBuild=resolve;});
 $('build').click();type($('title'),'Updated title');resolveBuild(new w.Blob(['epub']));await tick();
 assert.equal(downloads,0);assert.match($('status').textContent,/Buat ulang EPUB/);assert.ok(w.eval('lastBuiltBlob===null'));
 w.buildEpub=originalBuild;
 const deviceTarget=d.createElement('select');deviceTarget.id='deviceTarget';deviceTarget.innerHTML='<option>crosspoint</option>';d.body.appendChild(deviceTarget);
 w.eval("lastBuiltBlob=new Blob(['old']);lastBuiltName='old.epub'");deviceTarget.dispatchEvent(new w.Event('change',{bubbles:true}));
 assert.ok(w.eval('lastBuiltBlob===null'),'a device target change also invalidates the ready-to-send artifact');
 assert.deepEqual(errors,[],'review produces no uncaught browser errors');
 console.log('PDF review: mapping, literal corrections, export, reset, reparse guards, and asynchronous races passed');
})().then(()=>process.exit(0)).catch(error=>{console.error(error);process.exit(1);}).finally(()=>w.close());
