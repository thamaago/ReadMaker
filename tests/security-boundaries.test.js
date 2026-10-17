const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),{JSDOM,VirtualConsole}=require('jsdom'),JSZip=require('jszip');
const source=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const dom=new JSDOM(source,{url:'https://readmaker.example/',runScripts:'dangerously',virtualConsole:new VirtualConsole(),beforeParse(w){w.JSZip=JSZip;}});
const w=dom.window,d=w.document,png=fs.readFileSync(path.join(__dirname,'fixtures/validation-diagram.png')),b64=png.toString('base64');
const fb2=(mime,bytes=b64)=>'<FictionBook><description><title-info><book-title>Security test</book-title></title-info></description><body><section><title>Chapter</title><p>Safe text</p><image href="#picture"/></section></body><binary id="picture" content-type="'+mime+'">'+bytes+'</binary></FictionBook>';
(async()=>{
 await new Promise(r=>setTimeout(r,0));
 const payload='image/png&quot; onerror=&quot;window.__securityExecuted=1';
 assert.throws(()=>w.fb2ToBook(fb2(payload)),/tidak aman|unsafe/);
 const valid=w.fb2ToBook(fb2('image/png'));assert.equal(valid.images.length,1);
 w.finishIngest(valid,'Safe FB2');w.togglePreview();
 assert.ok(d.querySelector('#preview img[src^="data:image/png;base64,"]'));
 // Defense in depth: even malformed books reaching the preview bypassing import
 // cannot create active attributes or fetch unprepared images.
 w.finishIngest({html:'<h1>Title</h1><p onclick="window.__securityExecuted=1">Readable</p><img src="images/a.png" onerror="window.__securityExecuted=1"/><img src="https://tracker.invalid/x"/><svg onload="window.__securityExecuted=1"></svg><iframe src="https://tracker.invalid/frame"></iframe>',images:[{name:'a.png',mime:'image/png" onerror="window.__securityExecuted=1',b64}]},'Malformed');
 w.togglePreview();
 assert.equal(d.querySelectorAll('#preview [onerror],#preview [onclick],#preview svg,#preview iframe,#preview script').length,0);
 assert.equal(d.querySelectorAll('#preview img[src^="http"]').length,0);
 assert.match(d.getElementById('preview').textContent,/Readable/);
 assert.equal(w.__securityExecuted,undefined);
 const book={title:'Safe',author:'QA',language:'en',images:[],chapters:[{title:'Chapter',html:'<p>Safe text</p>'}]};
 for(const mime of ['image/svg+xml',payload,'text/html']){
  assert.throws(()=>w.fb2ToBook(fb2(mime)),/tidak aman|unsafe/);
  await assert.rejects(w.buildEpub({...book,images:[{name:'a.svg',mime,b64}]}),/tidak aman|unsafe/);
 }
 const svg=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>window.__securityExecuted=1</script></svg>').toString('base64');
 await assert.rejects(w.buildEpub({...book,images:[{name:'a.png',mime:'image/png',b64:svg}]}),/tidak aman|unsafe/,'renaming SVG as PNG is rejected');
 await assert.rejects(w.buildEpub({...book,images:[{name:'../a.png',mime:'image/png',b64}]}),/tidak aman|unsafe/);
 const zip=new JSZip();zip.file('content.xml','<document/>');zip.file('Pictures/active.svg',Buffer.from(svg,'base64'));
 await assert.rejects(w.odtToBook(await zip.generateAsync({type:'arraybuffer'})),/tidak aman|unsafe/);
 // Small real compressed input reproduces the boundary without a giant bomb.
 const large=new JSZip();large.file('content.xml','x'.repeat(32*1024*1024+1));
 const compressed=await large.generateAsync({type:'arraybuffer',compression:'DEFLATE'});
 assert.ok(compressed.byteLength<100000);
 await assert.rejects(w.loadDocumentZip(compressed),/batas aman|safe limits/);
 // A lying metadata field cannot bypass actual streaming limits.
 const little=new JSZip();little.file('content.xml','x'.repeat(100));const loaded=await JSZip.loadAsync(await little.generateAsync({type:'arraybuffer',compression:'DEFLATE'}));
 loaded.file('content.xml')._data.uncompressedSize=1;
 await assert.rejects(w.readDocumentEntry(loaded.file('content.xml'),'string',10),/batas aman|safe limits/);
 const budget={remaining:50};
 await assert.rejects(w.readDocumentEntry(loaded.file('content.xml'),'string',1000,budget),/batas aman|safe limits/);
 const forged=new JSZip();forged.file('page.png',Buffer.alloc(100));const raw=Buffer.from(await forged.generateAsync({type:'arraybuffer',compression:'DEFLATE'}));
 raw.writeUInt32LE(1,22);const central=raw.indexOf(Buffer.from('504b0102','hex'));raw.writeUInt32LE(1,central+24);
 const originalReader=w.readDocumentEntry;let cbzStream=false;
 w.readDocumentEntry=(entry,type,max,budget)=>{assert.equal(max,128*1024*1024);assert.equal(budget.remaining,128*1024*1024);cbzStream=true;return originalReader(entry,type,10,budget);};
 await assert.rejects(w.cbzToBook(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength)),/batas aman|safe limits/);assert.equal(cbzStream,true);w.readDocumentEntry=originalReader;
 let mammothCalls=0;w.mammoth={convertToHtml:async()=>{mammothCalls++;return {value:'<p>Safe DOCX</p>'};}};
 await assert.rejects(w.docxToBody(compressed),/batas aman|safe limits/);assert.equal(mammothCalls,0);
 assert.match((await w.docxToBody(await zipWithoutSvg())).html,/Safe DOCX/);assert.equal(mammothCalls,1);
 console.log('Security boundaries: FB2 MIME injection, inert preview, active/mislabeled SVG, image paths, and archive budgets pass.');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>w.close());
async function zipWithoutSvg(){const z=new JSZip();z.file('[Content_Types].xml','<Types/>');z.file('word/document.xml','<document/>');return z.generateAsync({type:'arraybuffer'});}
