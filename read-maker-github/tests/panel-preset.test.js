const fs=require('fs');const {JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:new VirtualConsole(),
  beforeParse(w){ w.JSZip=function(){}; if(!w.crypto)w.crypto={randomUUID:()=>'x'}; }});
let p=0,f=0;const ok=(c,m)=>{c?(p++):(f++,0);console.log((c?'  ok  ':'  FAIL')+' '+m);};
setTimeout(()=>{
  const doc=dom.window.document;
  const vals=[...doc.getElementById('einkSize').options].map(o=>o.value);
  ok(vals.includes('540x960'),'540x960 preset present');
  ok(vals.includes('480x800')&&vals.includes('528x792')&&vals.includes('400x600'),'existing presets kept');
  // einkOpts parses the new size
  doc.getElementById('einkSize').value='540x960';
  const o=dom.window.einkOpts();
  ok(o.maxW===540&&o.maxH===960,'einkOpts parses 540x960 ('+o.maxW+'x'+o.maxH+')');
  console.log('\nRESULT: '+p+' passed, '+f+' failed');process.exit(f?1:0);
},80);
