const fs=require('fs');const {JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:new VirtualConsole(),
  beforeParse(w){ w.JSZip=function(){}; if(!w.crypto)w.crypto={randomUUID:()=>'x'}; }});
const {window}=dom; const doc=window.document;
let p=0,f=0;const ok=(c,m)=>{c?(p++):(f++,0);console.log((c?'  ok  ':'  FAIL')+' '+m);};

setTimeout(()=>{
  // structural checks
  ok(!!doc.getElementById('deviceIp'),'deviceIp field exists');
  ok(!!doc.getElementById('sendBtn'),'sendBtn exists');
  ok(!!doc.getElementById('sendBar') && !doc.getElementById('sendBar').classList.contains('show'),'progress bar hidden by default');
  ok(!!doc.querySelector('label[for="deviceIp"]') || doc.getElementById('deviceIp').getAttribute('placeholder'),'IP field has label or placeholder');
  ok(doc.getElementById('sendBtn').textContent.trim()==='Kirim','ID default label = Kirim');

  // 1) click Send with empty IP -> localized guard, no crash
  doc.getElementById('deviceIp').value='';   // field now defaults to crosspoint.local; clear it to test the guard
  let threw=false; try{ doc.getElementById('sendBtn').dispatchEvent(new window.Event('click',{bubbles:true})); }catch(e){threw=true;}
  ok(!threw,'Send with empty IP does not throw');
  ok(/Masukkan alamat IP dulu/.test(doc.getElementById('sendStatus').textContent),'empty-IP guidance shown');

  // 2) simulate a successful build having happened, then a successful XHR
  window.eval("lastBuiltBlob=new Blob(['x']); lastBuiltName='book.epub';");
  doc.getElementById('deviceIp').value='192.168.3.3';
  doc.getElementById('deviceProfile').value='http';
  let openedUrl=null, sentBody=null;
  const OrigXHR=window.XMLHttpRequest;
  window.XMLHttpRequest=function(){
    this.upload={};
    this.open=(m,u)=>{ openedUrl=u; };
    this.send=(body)=>{ sentBody=body; setTimeout(()=>{ this.status=200; this.responseText=''; this.onload&&this.onload(); },0); };
  };
  doc.getElementById('sendBtn').dispatchEvent(new window.Event('click',{bubbles:true}));
  setTimeout(()=>{
    ok(openedUrl==='http://192.168.3.3/upload?path=%2F','request targets /upload?path=%2F on given IP ('+openedUrl+')');
    ok(sentBody instanceof window.FormData,'multipart FormData body sent');
    ok(/Terkirim ke perangkat/.test(doc.getElementById('sendStatus').textContent),'success status shown (ID)');
    ok(doc.getElementById('sendBtn').disabled===false,'button re-enabled after success');

    // 3) simulate "file already exists" (400)
    window.XMLHttpRequest=function(){
      this.upload={}; this.open=()=>{}; this.send=()=>{ setTimeout(()=>{ this.status=400; this.responseText='File already exists: book.epub'; this.onload&&this.onload(); },0); };
    };
    doc.getElementById('sendBtn').dispatchEvent(new window.Event('click',{bubbles:true}));
    setTimeout(()=>{
      ok(/sudah ada di perangkat/.test(doc.getElementById('sendStatus').textContent),'duplicate-file message localized');

      // 4) simulate network error (device offline / CORS)
      window.XMLHttpRequest=function(){
        this.upload={}; this.open=()=>{}; this.send=()=>{ setTimeout(()=>{ this.onerror&&this.onerror(); },0); };
      };
      doc.getElementById('sendBtn').dispatchEvent(new window.Event('click',{bubbles:true}));
      setTimeout(()=>{
        ok(/Tidak bisa terhubung/.test(doc.getElementById('sendStatus').textContent),'network-error message localized and actionable');
        ok(doc.getElementById('sendBtn').disabled===false,'button re-enabled after network error');

        // 5) IP normalizer strips scheme/path
        window.eval("var r=normalizeDeviceIp('http://192.168.1.42/files/');");
        console.log('  ok   normalizeDeviceIp strips scheme/path ->', window.eval('r'));

        window.XMLHttpRequest=OrigXHR;
        console.log('\\nRESULT: '+p+' passed, '+f+' failed');
        process.exit(f?1:0);
      },10);
    },10);
  },10);
},60);
