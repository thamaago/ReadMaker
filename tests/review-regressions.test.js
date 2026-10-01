const fs=require('fs');
const {JSDOM,VirtualConsole}=require('jsdom');
const JSZip=require('jszip');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const app=[...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map(x=>x[1]).pop();
const core=app.slice(0,app.indexOf('/* ============================ orchestration')).replace(/^\s*["']use strict["'];\s*/,'');
const dom=new JSDOM('<!doctype html><body></body>',{url:'https://localhost/'});
Object.assign(global,{window:dom.window,document:dom.window.document,DOMParser:dom.window.DOMParser,
  XMLSerializer:dom.window.XMLSerializer,JSZip,TextEncoder:require('util').TextEncoder,
  TextDecoder:require('util').TextDecoder,atob:s=>Buffer.from(s,'base64').toString('binary'),t:k=>k});
(0,eval)(core);
let pass=0,fail=0;
function ok(condition,label){ console.log((condition?'  ok  ':'  FAIL')+label); condition?pass++:fail++; }

(async()=>{
  const md=mdToHtml('[valid](https://example.com/?a=1&b=2) [unsafe](javascript:alert%281%29) ![bad](javascript:alert%281%29)');
  const parsed=new DOMParser().parseFromString(toXhtml('Links',md),'application/xhtml+xml');
  ok(parsed.querySelector('a').getAttribute('href')==='https://example.com/?a=1&b=2','Markdown URL query retains ampersand');
  const encoded=mdToHtml('[encoded](https://example.com/?a=1&amp;b=2)');
  const encodedDoc=new DOMParser().parseFromString(toXhtml('Encoded',encoded),'application/xhtml+xml');
  ok(encodedDoc.querySelector('a').getAttribute('href')==='https://example.com/?a=1&b=2','Markdown encoded ampersand is not double escaped');
  ok(!/javascript:/i.test(md),'Markdown unsafe link and image are removed');
  ok(!/javascript:/i.test(fb2ToBook('<FictionBook><body><section><p><a href="javascript:alert%281%29">click</a></p></section></body></FictionBook>').html),'FB2 unsafe link removed');
  const odt=new JSZip(); odt.file('content.xml','<office:document-content xmlns:office="urn:office" xmlns:text="urn:text" xmlns:xlink="http://www.w3.org/1999/xlink"><office:body><office:text><text:p><text:a xlink:href="javascript:alert%281%29">click</text:a></text:p></office:text></office:body></office:document-content>');
  const odtBook=await odtToBook(await odt.generateAsync({type:'arraybuffer'}));
  ok(!/javascript:/i.test(odtBook.html),'ODT unsafe link removed');
  ok(!/javascript:/i.test(cleanHtmlFragment('<p><img src="javascript:alert(1)">text</p>')),'HTML unsafe image URL removed');

  const dict=buildStarDict(parseWordlist('toString\tone\nconstructor\ttwo\n__proto__\tthree\nnormal\tfour'),{});
  const idxText=new TextDecoder().decode(dict.idx);
  ok(dict.wordcount===4 && ['toString','constructor','__proto__','normal'].every(w=>idxText.includes(w+'\0')),'StarDict retains prototype-named headwords');

  const gray=new Uint8ClampedArray(16*8).fill(255);
  const streamed=createXtcWriter([{w:16,h:8},{w:16,h:8}],{twoBit:true,title:'Stream'});
  streamed.addPage({gray,w:16,h:8}); streamed.addPage({gray,w:16,h:8});
  const direct=buildXtc([{gray,w:16,h:8},{gray,w:16,h:8}],{twoBit:true,title:'Stream'});
  ok(Buffer.from(streamed.finish()).equals(Buffer.from(direct)),'streamed XTC matches complete writer byte for byte');
  const oddPage=buildXtc([{gray:new Uint8ClampedArray(3*9).fill(255),w:3,h:9}],{twoBit:true});
  const oddView=new DataView(oddPage.buffer);
  const oddOff=Number(oddView.getBigUint64(0x138,true));
  ok(oddView.getUint32(oddOff+10,true)===12,'2-bit XTC uses full padded columns for odd page heights');

  let sizeRejected=false;
  try{ await cbzToBook({byteLength:129*1024*1024}); }catch(e){ sizeRejected=e.message==='errCbzLarge'; }
  ok(sizeRejected,'oversized CBZ rejected before archive parsing');
  const many=new JSZip(); for(let i=0;i<1001;i++) many.file('p'+i+'.png','x');
  let pageRejected=false;
  try{ await cbzToBook(await many.generateAsync({type:'arraybuffer'})); }catch(e){ pageRejected=e.message==='errCbzLarge'; }
  ok(pageRejected,'CBZ over page cap rejected before image inflation');

  const live=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:new VirtualConsole(),beforeParse(w){w.JSZip=JSZip;}});
  await new Promise(r=>setTimeout(r,60));
  const w=live.window, doc=w.document;
  const realSet=w.setTimeout.bind(w), realClear=w.clearTimeout.bind(w);
  const timers=new Map(), cleared=[]; let nextId=10000;
  w.setTimeout=function(fn,delay){ if(delay===60000){ const id=nextId++; timers.set(id,fn); return id; } return realSet(fn,delay); };
  w.clearTimeout=function(id){ if(timers.has(id)){timers.delete(id);cleared.push(id);} else realClear(id); };
  let xhr;
  w.XMLHttpRequest=function(){ xhr=this; this.upload={}; this.open=()=>{}; this.send=()=>{}; this.abort=()=>{}; };
  w.eval("lastBuiltBlob=new Blob(['book']); lastBuiltName='book.epub';");
  doc.getElementById('deviceIp').value='192.168.1.2';
  doc.getElementById('deviceProfile').value='http';
  doc.getElementById('sendBtn').click();
  const first=nextId-1;
  xhr.upload.onprogress({lengthComputable:true,loaded:1,total:2});
  ok(cleared.includes(first) && timers.has(nextId-1) && !timers.has(first),'HTTP progress refreshes stalled-transfer timer');
  xhr.status=200; xhr.responseText=''; xhr.onload();
  ok(timers.size===0,'successful upload clears timeout');
  let ws;
  w.WebSocket=function(){ ws=this; this.readyState=1; this.send=()=>{}; this.close=()=>{}; };
  doc.getElementById('deviceProfile').value='auto';
  doc.getElementById('sendBtn').click();
  const wsStart=nextId-1;
  ws.onopen();
  ws.onmessage({data:'READY'});
  ws.onmessage({data:'PROGRESS:2:4'});
  ok(cleared.includes(wsStart) && timers.size===1 && nextId-1!==wsStart,'WebSocket progress refreshes stalled-transfer timer');
  ws.onmessage({data:'DONE'});
  ok(timers.size===0,'completed WebSocket upload clears timeout');
  doc.getElementById('deviceProfile').value='http';
  doc.getElementById('sendBtn').click();
  const stalled=[...timers.values()][0]; stalled();
  ok(/waktu|time|timeout/i.test(doc.getElementById('sendStatus').textContent) && timers.size===0,'inactive transfer still times out');
  w.close();

  console.log('\nRESULT: '+pass+' passed, '+fail+' failed');
  process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(2)});
