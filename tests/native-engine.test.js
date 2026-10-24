const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),{JSDOM,VirtualConsole}=require('jsdom'),JSZip=require('jszip');
const dom=new JSDOM(fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8'),{runScripts:'dangerously',url:'http://localhost/',virtualConsole:new VirtualConsole(),beforeParse(w){w.JSZip=JSZip;}}),w=dom.window,d=w.document;
const image={name:'diagram.png',mime:'image/png',b64:fs.readFileSync(path.join(__dirname,'fixtures/validation-diagram.png')).toString('base64')};
const base={title:'Native engine',author:'QA',language:'ja',images:[image]};
function doc(html){return new w.DOMParser().parseFromString(html,'text/html');}
async function checked(book){let report;const blob=await w.buildEpub(book,undefined,value=>report=value);return {report,zip:await JSZip.loadAsync(await blob.arrayBuffer(),{checkCRC32:true})};}
(async()=>{
 assert.equal(w.ReadMakerEngine.version,'1.0.0');
 const input={...base,chapters:[{title:'A',html:'<p>Text</p>',fixedViewport:{width:600,height:800},sourcePages:[2,2,-1,'3',1]}]},model=w.ReadMakerEngine.bookModel(input);
 assert.equal(model.schema,'readmaker.book/1');assert.equal(model.chapters[0].sourcePages.join(','),'2,1');model.chapters[0].fixedViewport.width=1;model.images[0].name='changed.png';assert.equal(input.chapters[0].fixedViewport.width,600);assert.equal(input.images[0].name,'diagram.png');
 console.log('PASS native book schema, provenance and independent mutable stage copies');
 const html='<p id="body">'+('漢字 😀 &amp; <em>強調</em> '.repeat(800))+'</p><p>Last</p>',pieces=w.splitChapterFlow(html,1024);
 assert.ok(pieces.length>2);assert.ok(pieces.every(piece=>Buffer.byteLength(piece,'utf8')<=1024));
 assert.deepEqual(JSON.parse(JSON.stringify(w.readMakerSignature([doc(html)]))),JSON.parse(JSON.stringify(w.readMakerSignature(pieces.map(doc)))));assert.equal(pieces.filter(piece=>piece.includes('id="body"')).length,1);
 const compact=w.splitChapterFlow('<p>'+'漢字😀'.repeat(1000)+'</p>',300);assert.ok(compact.every(piece=>Buffer.byteLength(piece,'utf8')<=300));assert.equal(doc(compact.join('')).body.textContent,'漢字😀'.repeat(1000));
 console.log('PASS UTF-8 byte bounds, CJK/emoji/entity preservation, inline emphasis and one anchor owner');
 const ruby=w.htmlToBody('<p><ruby onclick="bad()">漢<rp>(</rp><rt>かん</rt><rp>)</rp></ruby></p>').html;
 assert.match(ruby,/<ruby>/);assert.match(ruby,/<rt>かん<\/rt>/);assert.doesNotMatch(ruby,/onclick/);assert.ok(w.safeBookPreview(ruby,[]).querySelector('ruby rt'));
 const long={...base,sourcePageCount:5,pdfPageInfo:[{page:3,needsReview:true}],chapters:[{title:'Body',sourcePages:[1,2],html:'<p id="start">'+'漢字 😀 '.repeat(32000)+'</p><p><em>Emphasis</em></p>'+ruby+'<img src="images/diagram.png" alt="Diagram"/><p><a href="#note">Note</a></p>'},{title:'Notes',sourcePages:[3],html:'<p id="note">A note. <a href="#start">Back</a></p>'}]};
 const built=await checked(long);assert.equal(built.report.status,'review');assert.equal(built.report.checks.textAndEmphasis,true);assert.equal(built.report.checks.internalLinks,true);assert.equal(built.report.metrics.imageReferences,1);assert.equal(built.report.metrics.ocrPagesForReview,1);assert.equal(built.report.metrics.sourcePages,5);assert.ok(built.report.metrics.outputSections>2);assert.equal(built.report.scope,'prepared-book-to-xhtml');assert.ok(built.report.notAssessed.includes('ocr-accuracy'));
 const documents=await Promise.all(built.zip.file(/OEBPS\/chap\d+\.xhtml$/).map(file=>file.async('string')));assert.match(documents.join(''),/<ruby/);assert.match(documents.join(''),/href="chap\d+\.xhtml#note"/);assert.match(await built.zip.file('OEBPS/content.opf').async('string'),/ReadMaker Engine 1.0.0/);
 console.log('PASS compiled multilingual book, rewritten cross-flow notes, truthful report and versioned EPUB generator');
 for(const [html,code] of [['<p><img src="images/missing.png"/></p>','missing-image'],['<p><a href="#missing">Link</a></p>','missing-link-target'],['<p onclick="bad()">Text</p>','active-content']]){
  let report;await assert.rejects(w.buildEpub({...base,chapters:[{title:'Broken',html}]},undefined,value=>report=value),error=>error.name==='ReadMakerQualityError');assert.equal(report.status,'blocked');assert.ok(report.issues.some(issue=>issue.code===code));
 }
 console.log('PASS broken resources/fragments and active content cannot produce a downloadable EPUB');
 const unicode=await checked({...base,chapters:[{title:'注',html:'<p><a href="#注">注</a></p><p id="注">日本語</p>'}]});assert.equal(unicode.report.status,'passed');
 const damaged=Buffer.from(image.b64,'base64');damaged[45]^=1;
 let damageReport;await assert.rejects(w.buildEpub({...base,images:[{...image,b64:damaged.toString('base64')}],chapters:[{title:'Damaged',html:'<img src="images/diagram.png"/>'}]},undefined,value=>damageReport=value),error=>error.name==='ReadMakerQualityError');assert.equal(damageReport.checks.pngIntegrity,false);
 console.log('PASS Unicode fragment identity and CRC rejection for local embedded PNG assets');
 let packageReport;await assert.rejects(w.buildEpub({...base,title:'Invalid\u0000metadata',chapters:[{title:'A',html:'<p>Valid body</p>'}]},undefined,value=>packageReport=value),error=>error.name==='ReadMakerQualityError');assert.equal(packageReport.checks.xml,false);
 console.log('PASS package metadata XML is checked along with content documents');
 const chapter={title:'A',sourceId:'c1',html:'<p><em>Same words</em></p>'},plain=w.toXhtml('A','<p>Same words</p>',false,false,null,'en');
 const tampered=w.auditReadMakerOutput({...base,chapters:[chapter]},[{source:chapter,filename:'chap001.xhtml',flow:'<p>Same words</p>',xhtml:plain,outputDocument:new w.DOMParser().parseFromString(plain,'application/xhtml+xml')}]);
 assert.equal(tampered.status,'blocked');assert.equal(tampered.checks.textAndEmphasis,false);
 const table=await checked({...base,chapters:[{title:'Table',html:'<table><tr><td>'+'Atomic text '.repeat(19000)+'</td></tr></table>'}]});assert.equal(table.report.status,'review');assert.ok(table.report.issues.some(issue=>issue.code==='atomic-section-large'));assert.equal(table.report.checks.textAndEmphasis,true);
 console.log('PASS independent corruption detection and honest oversized atomic-block warning');
 await new Promise(r=>setTimeout(r,0));w.URL.createObjectURL=()=> 'blob:test';w.URL.revokeObjectURL=()=>{};let downloads=0;w.HTMLAnchorElement.prototype.click=()=>downloads++;
 w.finishIngest({html:'<h1>Broken source</h1><p><a href="#missing">Link</a></p>',images:[]},'Source');d.getElementById('build').click();
 for(let n=0;n<100&&d.getElementById('build').disabled;n++)await new Promise(r=>setTimeout(r,5));
 assert.equal(downloads,0);assert.equal(d.getElementById('qualityPanel').hidden,false);assert.equal(w.eval('lastQualityReport.status'),'blocked');assert.match(d.getElementById('status').textContent,/belum dapat diunduh/);
 d.getElementById('title').value='Changed';d.getElementById('title').dispatchEvent(new w.Event('input'));assert.equal(d.getElementById('qualityPanel').hidden,true);assert.equal(w.eval('lastQualityReport'),null);
 console.log('PASS actual UI blocks failed quality checks and invalidates obsolete diagnostics');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>w.close());
