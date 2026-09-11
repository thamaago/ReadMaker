const fs=require('fs');const {JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:new VirtualConsole(),
  beforeParse(w){ w.JSZip=function(){}; if(!w.crypto)w.crypto={randomUUID:()=>'x'}; }});
let p=0,f=0;const ok=(c,m)=>{c?(p++):(f++,0);console.log((c?'  ok  ':'  FAIL')+' '+m);};
setTimeout(()=>{
  const w=dom.window, doc=w.document;
  doc.getElementById('einkSize').value='480x800';
  ok(w.deviceSizeWarnMB()===40,'C3 panel (480x800) -> 40 MB ceiling');
  doc.getElementById('einkSize').value='528x792';
  ok(w.deviceSizeWarnMB()===40,'X3 panel -> 40 MB');
  doc.getElementById('einkSize').value='540x960';
  ok(w.deviceSizeWarnMB()===100,'S3 panel (540x960) -> 100 MB ceiling');
  // the message interpolates the threshold and is localized
  ok(/40 MB/.test(w.eval("t('warnLarge').replace('{n}',40)")),'warning shows the number (ID)');
  doc.querySelector('.langtoggle button[data-lang="en"]').dispatchEvent(new w.Event('click',{bubbles:true}));
  ok(/100 MB/.test(w.eval("t('warnLarge').replace('{n}',100)")),'warning interpolates in EN too');
  ok(/low-RAM|X3\/X4/.test(w.eval("t('warnLarge')")),'warning explains the low-RAM risk');
  console.log('\nRESULT: '+p+' passed, '+f+' failed');process.exit(f?1:0);
},80);
