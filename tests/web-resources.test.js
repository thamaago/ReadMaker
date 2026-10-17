const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),{JSDOM,VirtualConsole}=require('jsdom'),JSZip=require('jszip');
const source=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const dom=new JSDOM('<!doctype html><body></body>',{url:'https://readmaker.example/'});
Object.assign(global,{window:dom.window,document:dom.window.document,DOMParser:dom.window.DOMParser,XMLSerializer:dom.window.XMLSerializer,JSZip,
 atob:s=>Buffer.from(s,'base64').toString('binary'),btoa:s=>Buffer.from(s,'binary').toString('base64'),t:k=>k});
let core=[...source.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map(x=>x[1]).pop();
core=core.slice(0,core.indexOf('/* ============================ orchestration')).replace(/^\s*["']use strict["'];\s*/,'');(0,eval)(core);
global.t=k=>k;
global.decodeWebImage=async()=>{}; // Real decoding is covered by web-resources-browser.cjs.
const png=fs.readFileSync(path.join(__dirname,'fixtures/validation-diagram.png'));
const local={name:'web_0001.png',mime:'image/png',b64:png.toString('base64')};
const response=()=>({ok:true,headers:{get:()=>null},arrayBuffer:async()=>png});
const book=html=>({title:'Article',author:'QA',language:'en',images:[local],chapters:[{title:'Article',html}]});
(async()=>{
 let fetches=0;
 const original=book('<p>Article text</p><img src="https://example.com/photo.php?token=abc" alt="Illustration"/>');
 original.chapters.push({...original.chapters[0]});const snapshot=JSON.stringify(original);
 const fetchFn=async url=>{assert.equal(url,'https://example.com/photo.php?token=abc');fetches++;return response();};
 const saved=await prepareBookResources(original,{fetchFn});
 assert.equal(fetches,1);assert.equal(saved.images.length,2);
 assert.equal(saved.images[1].name,'web_0002.png');assert.equal(saved.images[1].mime,'image/png');
 assert.ok(saved.chapters.every(c=>/src="images\/web_0002.png"/.test(c.html)));
 assert.match(saved.chapters[0].html,/alt="Illustration"/);assert.equal(JSON.stringify(original),snapshot);
 await prepareBookResources(saved,{fetchFn:()=>{throw new Error('Should not fetch prepared images');}});
 const embedded=await prepareBookResources(book('<img src="data:image/png;base64,'+png.toString('base64')+'"/>'));
 assert.equal(embedded.images.length,2);assert.match(embedded.chapters[0].html,/images\/web_0002.png/);
 const omitted=await prepareBookResources(book('<p>Text</p><img src="images/web_0001.png" srcset="https://example.com/hi.png 2x"/><img src="https://blocked.example/p.png"/><img src="data:image/png;base64,'+png.toString('base64')+'"/>'),{mode:'omit',fetchFn:()=>{throw new Error('Must not fetch');}});
 assert.match(omitted.chapters[0].html,/images\/web_0001.png/);assert.doesNotMatch(omitted.chapters[0].html,/blocked.example|data:image/);
 assert.doesNotMatch(omitted.chapters[0].html,/srcset=/);
 assert.equal(omitted.images.length,1);
 await assert.rejects(prepareBookResources(original,{fetchFn:async()=>{throw new Error('CORS');}}),/errWebImages.*webImageReason_network/);
 assert.equal(JSON.stringify(original),snapshot);
 await assert.rejects(prepareBookResources(original,{fetchFn:async()=>({ok:false})}),/webImageReason_network/);
 await assert.rejects(prepareBookResources(original,{fetchFn:async()=>({ok:true,arrayBuffer:async()=>Buffer.from('<html>Denied</html>')})}),/webImageReason_format/);
 for(const bytes of [Buffer.from('89504e470d0a1a0a','hex'),Buffer.from([255,216,255]),png.subarray(0,png.length-8)]){
  await assert.rejects(prepareBookResources(original,{fetchFn:async()=>({ok:true,arrayBuffer:async()=>bytes})}),/webImageReason_format/);
 }
 const corrupt=Buffer.from(png);corrupt[corrupt.indexOf('IDAT')+4]^=1;
 await assert.rejects(prepareBookResources(original,{fetchFn:async()=>({ok:true,arrayBuffer:async()=>corrupt})}),/webImageReason_format/);
 await assert.rejects(prepareBookResources(original,{fetchFn,decodeImage:async()=>{throw new Error('Decoder rejected pixels');}}),/webImageReason_format/);
 await assert.rejects(prepareBookResources(book('<img src="data:image/jpeg;base64,'+png.toString('base64')+'"/>')),/webImageReason_format/);
 await assert.rejects(prepareBookResources(original,{timeoutMs:20,fetchFn:async()=>({ok:true,arrayBuffer:()=>new Promise(()=>{})})}),/webImageReason_timeout/);
 await assert.rejects(prepareBookResources(original,{timeoutMs:20,fetchFn:()=>new Promise(()=>{})}),/webImageReason_timeout/);
 let cancelled=false;
 await assert.rejects(prepareBookResources(original,{maxImageBytes:10,fetchFn:async()=>({ok:true,headers:{get:()=>1},body:{getReader:()=>({read:async()=>({done:false,value:png}),cancel:async()=>{cancelled=true;},releaseLock(){}})}})}),/webImageReason_size/);
 assert.ok(cancelled,'oversize stream is cancelled');
 await assert.rejects(prepareBookResources(original,{maxTotalBytes:10,fetchFn}),/webImageReason_size/);
 await assert.rejects(prepareBookResources(book('<img src="https://example.com/a"/><img src="https://example.com/b"/>'),{maxImages:1,fetchFn:async()=>response()}),/webImageReason_size/);
 const again=await prepareBookResources(original,{fetchFn});assert.equal(again.images.length,2);assert.equal(JSON.stringify(original),snapshot);
 console.log('Web resources: deduplication, offline data, collision, immutable source, errors, timeout and resource limits pass.');

 // Actual UI path: failed export, explicit text-only retry, then include retry.
 const ui=new JSDOM(source,{runScripts:'dangerously',url:'https://readmaker.example/',virtualConsole:new VirtualConsole(),beforeParse(w){w.JSZip=JSZip;}});
 const w=ui.window,d=w.document;let downloaded,networkCalls=0;
 await new Promise(resolve=>setTimeout(resolve,0)); // Finish initial language/UI setup before user actions.
 w.decodeWebImage=async()=>{};
 w.URL.createObjectURL=blob=>{downloaded=blob;return 'blob:test';};w.URL.revokeObjectURL=()=>{};w.HTMLAnchorElement.prototype.click=()=>{};
 w.ingestArticle('<html><head><title>Offline article</title></head><body><article><h1>Offline article</h1><p>Text that survives an image failure.</p><img src="https://example.com/p.png" alt="Diagram"/></article></body></html>','https://example.com/article');
 d.getElementById('einkOn').value='off';
 const build=async()=>{downloaded=null;d.getElementById('build').click();for(let i=0;i<200&&d.getElementById('build').disabled;i++)await new Promise(r=>setTimeout(r,10));assert.equal(d.getElementById('build').disabled,false,'export finishes');};
 w.fetch=async()=>{networkCalls++;throw new Error('CORS');};
 await build();assert.equal(downloaded,null);assert.match(d.getElementById('status').textContent,/Teks saja|Text only/);
 d.getElementById('webImages').value='omit';d.getElementById('webImages').dispatchEvent(new w.Event('change'));await build();
 assert.ok(downloaded);assert.equal(networkCalls,1);
 let zip=await JSZip.loadAsync(await downloaded.arrayBuffer());
 let chapters=(await Promise.all(zip.file(/chap\d+\.xhtml$/).map(f=>f.async('string')))).join('');
 assert.match(chapters,/Text that survives/);assert.doesNotMatch(chapters,/<img/);
 d.getElementById('webImages').value='include';d.getElementById('webImages').dispatchEvent(new w.Event('change'));w.fetch=async()=>response();await build();
 zip=await JSZip.loadAsync(await downloaded.arrayBuffer());assert.ok(zip.file('OEBPS/images/web_0001.png'));
 assert.match(w.currentBook().chapters.map(c=>c.html).join(''),/https:\/\/example.com\/p.png/,'source remains available for a fresh export');
 // An old image request must not change the state of a newly opened source.
 let rejectOld;w.fetch=()=>new Promise((_,reject)=>{rejectOld=reject;});
 d.getElementById('build').click();
 w.ingestArticle('<article><h1>New source</h1><p>New source body remains ready.</p></article>','https://new.example/article');
 const newStatus=d.getElementById('status').textContent;rejectOld(new Error('Old request failed'));
 await new Promise(r=>setTimeout(r,20));assert.equal(d.getElementById('status').textContent,newStatus);assert.equal(d.getElementById('build').disabled,false);
 ui.window.close();dom.window.close();
 console.log('Web resource UI: CORS failure stops download; text-only and include retries both work.');
})().catch(error=>{console.error(error);process.exitCode=1;});
