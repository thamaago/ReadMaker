const fs=require('fs');const {JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
function mk(url){ return new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url,virtualConsole:new VirtualConsole(),
  beforeParse(w){ w.JSZip=function(){}; if(!w.crypto)w.crypto={randomUUID:()=>'x'}; }}); }
let p=0,f=0;const ok=(c,m)=>{c?(p++):(f++,0);console.log((c?'  ok  ':'  FAIL')+' '+m);};

(async()=>{
  // ---------- A) mixed content guard (page on https) ----------
  {
    const dom=mk('https://read-maker.example/'); const w=dom.window,d=w.document;
    await new Promise(r=>setTimeout(r,60));
    w.eval("lastBuiltBlob=new Blob(['x']); lastBuiltName='b.epub';");
    d.getElementById('deviceIp').value='192.168.3.3';
    d.getElementById('deviceProfile').value='http';
    let sent=false; w.XMLHttpRequest=function(){ this.upload={}; this.open=()=>{}; this.send=()=>{sent=true;}; };
    d.getElementById('sendBtn').dispatchEvent(new w.Event('click',{bubbles:true}));
    ok(!sent,'https page: upload not attempted (blocked early)');
    ok(/HTTPS/.test(d.getElementById('sendStatus').textContent),'https page: mixed-content explained, not generic error');
    ok(!/Tidak bisa terhubung/.test(d.getElementById('sendStatus').textContent),'https page: no misleading "cannot connect"');
    dom.window.close();
  }

  // ---------- B) local/http page: normal flow, folder + cancel + timeout ----------
  {
    const dom=mk('http://localhost/'); const w=dom.window,d=w.document;
    await new Promise(r=>setTimeout(r,60));
    w.eval("lastBuiltBlob=new Blob(['x']); lastBuiltName='b.epub';");
    d.getElementById('deviceIp').value='192.168.3.3';
    d.getElementById('deviceProfile').value='http';
    ok(!!d.getElementById('devicePath'),'destination folder field exists');

    // B1: folder normalization -> path query
    d.getElementById('devicePath').value='Books/';
    let openedUrl=null, aborted=false, inst=null;
    w.XMLHttpRequest=function(){ inst=this; this.upload={}; this.open=(m,u)=>{openedUrl=u;}; this.send=()=>{}; this.abort=()=>{aborted=true; this.onabort&&this.onabort();}; };
    d.getElementById('sendBtn').dispatchEvent(new w.Event('click',{bubbles:true}));
    ok(openedUrl==='http://192.168.3.3/upload?path=%2FBooks','folder normalized into path ('+openedUrl+')');
    ok(d.getElementById('sendBtn').textContent===w.eval("t('sendBtnCancel')"),'button turns into Cancel while sending');
    ok(d.getElementById('deviceIp').disabled===true,'IP field locked during send');

    // B2: clicking again cancels
    d.getElementById('sendBtn').dispatchEvent(new w.Event('click',{bubbles:true}));
    ok(aborted,'second click aborts the upload');
    ok(/dibatalkan/i.test(d.getElementById('sendStatus').textContent),'cancel message shown');
    ok(d.getElementById('sendBtn').textContent===w.eval("t('sendBtn')"),'button label restored after cancel');
    ok(d.getElementById('deviceIp').disabled===false,'IP field unlocked after cancel');

    // B3: empty folder -> root
    d.getElementById('devicePath').value='';
    openedUrl=null;
    d.getElementById('sendBtn').dispatchEvent(new w.Event('click',{bubbles:true}));
    ok(openedUrl==='http://192.168.3.3/upload?path=%2F','empty folder defaults to root');
    d.getElementById('sendBtn').dispatchEvent(new w.Event('click',{bubbles:true})); // cancel

    // B4: success path still works
    w.XMLHttpRequest=function(){ this.upload={}; this.open=()=>{}; this.abort=()=>{}; this.send=()=>{ setTimeout(()=>{ this.status=200; this.responseText=''; this.onload&&this.onload(); },0); }; };
    d.getElementById('sendBtn').dispatchEvent(new w.Event('click',{bubbles:true}));
    await new Promise(r=>setTimeout(r,20));
    ok(/Terkirim/.test(d.getElementById('sendStatus').textContent),'success still reported');
    ok(d.getElementById('sendBtn').textContent===w.eval("t('sendBtn')"),'button restored after success');

    // B5: timeout wiring present
    ok(/60000/.test(html) && /sendErrTimeout/.test(html),'stall timeout implemented');
    dom.window.close();
  }

  console.log('\nRESULT: '+p+' passed, '+f+' failed');
  process.exit(f?1:0);
})();
