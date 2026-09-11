const fs=require('fs');const {JSDOM,VirtualConsole}=require('jsdom');const JSZip=require('jszip');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const dom=new JSDOM('<!DOCTYPE html><body></body>');
global.window=dom.window;global.document=dom.window.document;global.DOMParser=dom.window.DOMParser;global.XMLSerializer=dom.window.XMLSerializer;global.JSZip=JSZip;global.crypto={randomUUID:()=>'x'};global.atob=s=>Buffer.from(s,'base64').toString('binary');global.btoa=s=>Buffer.from(s,'binary').toString('base64');
let core=[...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map(x=>x[1]).pop();
core=core.slice(0,core.indexOf('/* ============================ orchestration')).replace(/^\s*["']use strict["'];\s*/,'');(0,eval)(core);
let p=0,f=0;const ok=(c,m)=>{c?(p++):(f++,0);console.log((c?'  ok  ':'  FAIL')+' '+m);};

// properties CrossPoint's CssParser actually reads
const PARSED=['text-indent','margin','padding','width','height','font-weight','font-style','text-decoration','display','vertical-align','direction','text-align'];
const cpCss=bookCss('crosspoint'), uniCss=bookCss('universal');

// base profile must not fight the reader's own typography settings
ok(!/font-family|line-height|font-size|color:|page-break|text-align/.test(cpCss),'CrossPoint profile avoids properties that override user settings');
ok(/text-indent:1\.2em/.test(cpCss)&&/blockquote\{margin/.test(cpCss),'CrossPoint profile keeps honoured rules');

// compatibility rules are present in both, and are ones CrossPoint ignores
ok(/img\{max-width:100%/.test(cpCss),'image scaling rule present for other engines');
ok(/pre\{white-space:pre-wrap\}/.test(cpCss),'code wrapping rule present');
ok(!PARSED.some(x=>x==='max-width'||x==='white-space'),'max-width/white-space are not parsed by CrossPoint (safe to add)');

// universal profile adds heading sizing that CrossPoint ignores
ok(/h1\{font-size:1\.6em/.test(uniCss),'universal profile sizes headings');
ok(!/h1\{font-size/.test(cpCss),'CrossPoint profile leaves heading size to the device');
ok(uniCss.startsWith(cpCss),'universal profile is a superset of the base');
ok(!/text-align/.test(uniCss),'universal profile still avoids forcing alignment');

(async()=>{
  const chapters=[{title:'A',level:1,html:'<p>x</p>'}];
  const mk=async(profile)=>{
    const blob=await buildEpub({title:'T',author:'',language:'en',images:[],coverName:'',cssProfile:profile,chapters});
    const zip=await JSZip.loadAsync(Buffer.from(await blob.arrayBuffer()));
    return await zip.file('OEBPS/style.css').async('string');
  };
  ok(/font-size/.test(await mk('universal')),'built EPUB carries universal CSS');
  ok(!/font-size/.test(await mk('crosspoint')),'built EPUB carries lean CSS for CrossPoint');
  ok(/font-size/.test(await mk(undefined)),'defaults to the universal profile');

  // UI wiring
  const d2=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:new VirtualConsole(),
    beforeParse(w){ w.JSZip=function(){}; if(!w.crypto)w.crypto={randomUUID:()=>'x'}; }});
  setTimeout(()=>{
    const doc=d2.window.document;
    ok(!!doc.getElementById('fwProfile'),'firmware selector exists');
    ok(doc.getElementById('fwProfile').value==='universal','defaults to the widest compatibility');
    ok(!!doc.querySelector('label[for="fwProfile"]'),'selector is labelled');
    ok(/CrossPoint/.test(doc.querySelector('[data-i18n="sleepHead"]').textContent),'sleep-screen tool marked CrossPoint-specific');
    ok(d2.window.fwProfile()==='universal','fwProfile() reads the control');
    console.log('\nRESULT: '+p+' passed, '+f+' failed');
    process.exit(f?1:0);
  },80);
})().catch(e=>{console.error(e);process.exit(2)});
