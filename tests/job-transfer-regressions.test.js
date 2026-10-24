const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),{JSDOM,VirtualConsole}=require('jsdom'),JSZip=require('jszip');
const dom=new JSDOM(fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8'),{runScripts:'dangerously',url:'http://localhost/',virtualConsole:new VirtualConsole(),beforeParse(w){w.JSZip=JSZip;}}),w=dom.window,d=w.document,el=id=>d.getElementById(id);
const tick=()=>new Promise(r=>setTimeout(r,0));
(async()=>{
 await tick();let downloads=0;w.URL.createObjectURL=()=> 'blob:test';w.URL.revokeObjectURL=()=>{};w.HTMLAnchorElement.prototype.click=()=>downloads++;
 const original=w.parseToBook;
 for(const control of ['lang','split','pdfMode','ocrOn','ocrLang','outputPreset','einkSize']){
  const files=[{name:'a.txt',size:1,text:async()=> 'Alpha'},{name:'b.txt',size:1,text:async()=> 'Beta'}];
  w.startBatch(files);let resume,job;
  w.parseToBook=async(file,context)=>{job=context;await new Promise(r=>resume=r);return original(file,context);};
  const pending=w.runBatch();await tick();assert.ok(Object.isFrozen(job.options));
  el(control).dispatchEvent(new w.Event('change',{bubbles:true}));assert.equal(job.signal.aborted,true,control+' cancels running job');resume();await pending;
  assert.equal(downloads,0);assert.match(el('status').textContent,/dibatalkan|cancelled/i);assert.doesNotMatch(el('galley').textContent,/Sedang memproses/);
 }
 w.parseToBook=original;
 await assert.rejects(w.parseToBook({name:'large.txt',size:129*1024*1024,text:()=>{throw new Error('must not read');}}),/128 MB/);
 assert.throws(()=>w.assertCanvasSize(30000,30000),/12/);assert.throws(()=>w.pdfBitmapCanvas({width:30000,height:30000}),/12/);
 console.log('PASS batch control changes cancel consistently, snapshots are frozen, source/pixel limits precede allocation');
 let cancelRender=0,destroyed=0,started;
 const rendering=new Promise(r=>started=r);let rejectRender;
 w.pdfjsLib={getDocument:()=>({promise:Promise.resolve({numPages:2,getMetadata:async()=>({}),getPage:async()=>({getViewport:()=>({width:600,height:800}),render:()=>{started();return {promise:new Promise((_,reject)=>rejectRender=reject),cancel:()=>{cancelRender++;rejectRender(new Error('render cancelled'));}};}}),destroy:async()=>{destroyed++;}})})};
 const originalCanvas=w.HTMLCanvasElement.prototype.getContext;w.HTMLCanvasElement.prototype.getContext=()=>({fillRect(){}});
 const job=w.startConversionJob(),parse=w.pdfToBook(new ArrayBuffer(1),'fixed',job);await rendering;await tick();job.controller.abort();await assert.rejects(parse,/cancelled|dibatalkan/);assert.ok(cancelRender>0);assert.ok(destroyed>0);
 w.finishConversionJob(job);w.HTMLCanvasElement.prototype.getContext=originalCanvas;
 console.log('PASS in-flight PDF render is cancelled and its document destroyed');
 let socket,sent;
 w.WebSocket=function(){socket=this;sent=[];this.readyState=1;this.send=data=>sent.push(data);this.close=()=>{this.readyState=3;if(this.onclose)this.onclose();};};
 const start=()=>{w.resetSendUi();el('sendStatus').textContent='';w.startWebSocketUpload('crosspoint.local','/',el('sendStatus'),el('sendBarFill'),new w.Blob([new Uint8Array(130000)]),'book.epub',()=>{throw new Error('invalid ACK must not cause a second upload');});socket.onopen();};
 for(const message of ['DONE','PROGRESS:0:130000']){start();socket.onmessage({data:message});assert.match(el('sendStatus').textContent,/Konfirmasi|acknowledgement/);}
 for(const message of ['PROGRESS:-1:130000','PROGRESS:NaN:130000','PROGRESS:65537:130000','PROGRESS:65536:1']){start();socket.onmessage({data:'READY'});socket.onmessage({data:message});assert.match(el('sendStatus').textContent,/Konfirmasi|acknowledgement/);}
 start();socket.onmessage({data:'READY'});assert.equal(sent.length,2);socket.onmessage({data:'PROGRESS:65536:130000'});assert.equal(sent.length,3);socket.onmessage({data:'PROGRESS:65536:130000'});assert.equal(sent.length,3,'duplicate ACK cannot send more data');socket.onmessage({data:'PROGRESS:130000:130000'});socket.onmessage({data:'DONE'});assert.match(el('sendStatus').textContent,/Terkirim|Sent/);
 console.log('PASS premature/malformed ACKs fail; duplicate ACKs are idempotent; full multi-chunk transfer succeeds');
 w.finishIngest({html:'<h1>First</h1><p>Alpha</p><h1>Second</h1><p>Beta</p>',images:[]},'Preview');w.togglePreview();el('previewChapter').value='2';el('previewChapter').dispatchEvent(new w.Event('change'));assert.match(el('preview').textContent,/Beta/);assert.doesNotMatch(el('preview').textContent,/Alpha/);
 const input=d.querySelector('input[data-chapter-title="1"]');input.focus();input.value='Edited';w.chapterTitleChanged(input);assert.equal(d.querySelector('input[data-chapter-title="1"]'),input);assert.equal(d.activeElement,input);assert.equal(el('status').getAttribute('role'),'status');
 console.log('PASS arbitrary chapter preview, title input identity/focus, and announced status');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>w.close());
