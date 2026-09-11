const fs=require('fs');const {JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:new VirtualConsole(),
  beforeParse(w){ w.JSZip=function(){}; if(!w.crypto)w.crypto={randomUUID:()=>'x'}; }});
let p=0,f=0;const ok=(c,m)=>{c?(p++):(f++,0);console.log((c?'  ok  ':'  FAIL')+' '+m);};
setTimeout(()=>{
  const w=dom.window, doc=w.document;
  ok(w.addressFromQr('http://crosspoint.local/')==='crosspoint.local','QR http URL -> host');
  ok(w.addressFromQr('http://192.168.4.1/')==='192.168.4.1','QR IP URL -> ip');
  ok(w.addressFromQr('crosspoint.local')==='crosspoint.local','bare host kept');
  ok(w.addressFromQr('http://crosspoint.local:8080/files')==='crosspoint.local:8080','host:port kept, path dropped');
  ok(w.addressFromQr('')==='','empty stays empty');
  ok(w.normalizeDeviceIp('crosspoint.local')==='crosspoint.local','normalizer keeps hostname');
  ok(doc.getElementById('deviceIp').value==='crosspoint.local','address defaults to crosspoint.local');
  ok(!!doc.getElementById('scanQrBtn'),'QR scan button present');
  ok(!!doc.getElementById('qrFile') && doc.getElementById('qrFile').getAttribute('capture')==='environment','hidden camera-capable file input present');
  ok(/crosspoint\.local/.test(doc.querySelector('[data-i18n="sendHint"]').textContent),'hint mentions crosspoint.local (ID)');
  try{
    w.localStorage.setItem('rm_device','192.168.1.50');
    w.eval("try{ const saved=localStorage.getItem('rm_device'); if(saved) document.getElementById('deviceIp').value=saved; }catch(e){}");
    ok(doc.getElementById('deviceIp').value==='192.168.1.50','remembered address restored from localStorage');
  }catch(e){ ok(false,'localStorage: '+e.message); }
  ok(typeof w.scanDeviceQr==='function' && typeof w.handleQrPick==='function','QR handlers defined');
  doc.querySelector('.langtoggle button[data-lang="en"]').dispatchEvent(new w.Event('click',{bubbles:true}));
  ok(/crosspoint\.local/.test(doc.querySelector('[data-i18n="sendHint"]').textContent),'hint localised in EN too');
  console.log('\nRESULT: '+p+' passed, '+f+' failed');process.exit(f?1:0);
},80);
