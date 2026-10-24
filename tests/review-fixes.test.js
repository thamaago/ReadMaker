const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),{JSDOM,VirtualConsole}=require('jsdom'),JSZip=require('jszip');
const source=process.env.READMAKER_TEST_SOURCE||path.join(__dirname,'..','index.html');
const dom=new JSDOM(fs.readFileSync(source,'utf8'),{runScripts:'dangerously',url:'http://localhost/',virtualConsole:new VirtualConsole(),beforeParse(w){w.JSZip=JSZip;}}),w=dom.window;
let failed=0;async function check(name,fn){try{await fn();console.log('PASS '+name);}catch(e){failed++;console.error('FAIL '+name+': '+e.message);}}
(async()=>{
 await check('large flow preserves free text, standalone images, nested markup and ordering',()=>{
  const html='<p>'+('Long text &amp; punctuation. '.repeat(12000))+'</p>FREE TEXT<img src="images/a.png" alt="Diagram"/><div><p>Nested <em>final</em></p></div>';
  const before=new w.DOMParser().parseFromString(html,'text/html'),flows=w.splitChapterFlow(html),after=new w.DOMParser().parseFromString(flows.join(''),'text/html');
  assert.equal(after.querySelectorAll('img').length,1);assert.equal(after.body.textContent.length,before.body.textContent.length);assert.ok(after.body.textContent===before.body.textContent,'all source text survives');assert.match(flows.join(''),/FREE TEXT<img/);assert.equal(after.querySelector('em').textContent,'final');
 });
 await check('HTML and DOCX-style anchors survive sanitation and chapter splitting',async()=>{
  const html=w.htmlToBody('<h1>First</h1><p><a href="#note">Read note</a></p><h1>Notes</h1><p id="note">Footnote text</p><a name="back"></a>').html;
  assert.match(html,/id="note"/);assert.match(html,/id="back"/);
  const blob=await w.buildEpub({title:'Notes',author:'QA',language:'id',images:[],chapters:w.splitChapters(html,'h1')});const zip=await JSZip.loadAsync(await blob.arrayBuffer());
  const first=await zip.file('OEBPS/chap001.xhtml').async('string'),second=await zip.file('OEBPS/chap002.xhtml').async('string');
  assert.match(first,/href="chap002.xhtml#note"/);assert.match(second,/id="note"/);assert.match(first,/xml:lang="id"/);assert.match(await zip.file('OEBPS/nav.xhtml').async('string'),/xml:lang="id"/);
 });
 await check('fragment rewriting spans long flows and keeps duplicate IDs unique per document',()=>{
  const chapter={};const entries=[{source:chapter,flow:'<p><a href="#n">Go</a></p>'},{source:chapter,flow:'<p id="n">Note</p><p id="n">Duplicate</p>'}];w.resolveFlowReferences(entries);
  assert.match(entries[0].flow,/chap002.xhtml#n/);const doc=new w.DOMParser().parseFromString(entries[1].flow,'text/html');assert.equal(new Set([...doc.querySelectorAll('[id]')].map(n=>n.id)).size,2);
 });
 await check('hard hyphens stay literal, explicit soft hyphens rejoin',()=>{
  assert.equal(w.pdfJoinHyphenated('well-','known'),'well-known');assert.equal(w.pdfJoinHyphenated('self-','esteem'),'self-esteem');assert.equal(w.pdfJoinHyphenated('beauti\u00ad','ful'),'beautiful');
  assert.match(w.ocrTextToHtml('well-\nknown author.'),/well-known/);assert.match(w.ocrTextToHtml('beauti\u00ad\nful morning.'),/beautiful/);
 });
 await check('fixed pages retain their individual landscape and portrait viewport',async()=>{
  const b64=fs.readFileSync(path.join(__dirname,'fixtures/validation-diagram.png')).toString('base64');
  const blob=await w.buildEpub({title:'Mixed pages',author:'QA',language:'en',pdfMode:'fixed',fixedViewport:{width:1200,height:800},images:[{name:'a.png',mime:'image/png',b64}],chapters:[{title:'Landscape',fixedViewport:{width:1200,height:800},html:'<img src="images/a.png"/>'},{title:'Portrait',fixedViewport:{width:800,height:1200},html:'<img src="images/a.png"/>'}]});
  const zip=await JSZip.loadAsync(await blob.arrayBuffer());assert.match(await zip.file('OEBPS/chap001.xhtml').async('string'),/width=1200,height=800/);assert.match(await zip.file('OEBPS/chap002.xhtml').async('string'),/width=800,height=1200/);
 });
})().catch(e=>{failed++;console.error(e);}).finally(()=>{w.close();if(failed)process.exitCode=1;});
