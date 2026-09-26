const fs=require('fs');const {JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:new VirtualConsole(),
  beforeParse(w){ w.JSZip=function(){}; if(!w.crypto)w.crypto={randomUUID:()=>'x'}; }});
const w=dom.window,d=w.document; let p=0,f=0; const ok=(c,m)=>{c?p++:f++,console.log((c?'  ok  ':'  FAIL')+' '+m);};

setTimeout(async()=>{
  w.eval("lastBuiltBlob=new Blob(['hello']); lastBuiltName='book.epub';");
  d.getElementById('deviceIp').value='crosspoint.local';
  d.getElementById('devicePath').value='Books';
  d.getElementById('deviceProfile').value='crosspoint';
  let wsInstance=null, startMessage='', sentBinary=false;
  function FakeWebSocket(url){
    this.url=url; this.readyState=0; wsInstance=this;
    setTimeout(()=>{ this.readyState=1; this.onopen&&this.onopen(); },0);
  }
  FakeWebSocket.prototype.send=function(data){
    if(typeof data==='string'){ startMessage=data; this.onmessage&&this.onmessage({data:'READY'}); }
    else { sentBinary=true; this.onmessage&&this.onmessage({data:'PROGRESS:5:5'}); this.onmessage&&this.onmessage({data:'DONE'}); }
  };
  FakeWebSocket.prototype.close=function(){ this.readyState=3; this.onclose&&this.onclose(); };
  w.WebSocket=FakeWebSocket;
  d.getElementById('sendBtn').dispatchEvent(new w.Event('click',{bubbles:true}));
  await new Promise(r=>setTimeout(r,20));
  ok(wsInstance && wsInstance.url==='ws://crosspoint.local:81/','CrossPoint profile opens WebSocket port 81');
  ok(/^START:book\.epub:5:\/Books$/.test(startMessage),'WebSocket START includes filename, size and destination');
  ok(sentBinary,'WebSocket sends binary file data');
  ok(/Terkirim/.test(d.getElementById('sendStatus').textContent),'WebSocket completion is reported');

  // Stock profile intentionally stays on HTTP even when WebSocket is available.
  d.getElementById('deviceProfile').value='stock'; d.getElementById('deviceIp').value='192.168.3.3';
  let opened=null;
  w.XMLHttpRequest=function(){ this.upload={}; this.open=(m,u)=>{opened=u;}; this.send=()=>{ setTimeout(()=>{this.status=200;this.responseText='';this.onload&&this.onload();},0);}; this.abort=()=>{}; };
  d.getElementById('sendBtn').dispatchEvent(new w.Event('click',{bubbles:true}));
  await new Promise(r=>setTimeout(r,20));
  ok(opened==='http://192.168.3.3/upload?path=%2FBooks','Stock profile uses HTTP upload endpoint');
  console.log('\nRESULT: '+p+' passed, '+f+' failed'); process.exit(f?1:0);
},80);
