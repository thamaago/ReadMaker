const fs=require('fs');const {JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const dom=new JSDOM('<!DOCTYPE html><body></body>');
global.window=dom.window;global.document=dom.window.document;global.DOMParser=dom.window.DOMParser;global.XMLSerializer=dom.window.XMLSerializer;
let core=[...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map(x=>x[1]).pop();
core=core.slice(0,core.indexOf('/* ============================ orchestration')).replace(/^\s*["']use strict["'];\s*/,'');(0,eval)(core);
let p=0,f=0;const ok=(c,m)=>{c?(p++):(f++,0);console.log((c?'  ok  ':'  FAIL')+' '+m);};

// --- pure OCR text assembly ---
const page1=['CHAPTER ONE','','It was a bright cold day in April,','and the clocks were striking','thirteen.','','12'].join('\n');
const page2=['Winston Smith slipped quickly','through the glass doors of Victory','Mansions, though not quickly enough','to escape the gritty dust.','','13'].join('\n');
const out=ocrTextToHtml([page1,page2]);
ok(/<h1>CHAPTER ONE<\/h1>/.test(out),'chapter marker promoted to heading');
ok(/It was a bright cold day in April, and the clocks were striking thirteen\./.test(out),'wrapped lines merged into one paragraph');
ok(!/<p>12<\/p>|<p>13<\/p>/.test(out),'page numbers dropped');
ok(/Winston Smith slipped quickly through the glass doors/.test(out),'second page assembled');
ok((out.match(/<p>/g)||[]).length===2,'two paragraphs total ('+((out.match(/<p>/g)||[]).length)+')');

// de-hyphenation across OCR lines
const hy=ocrTextToHtml(['the beauti-','ful morning came'].join('\n'));
ok(/beautiful morning came/.test(hy),'hyphenated word rejoined');

// blank input
ok(ocrTextToHtml([])==='','empty OCR yields empty html');
ok(ocrTextToHtml(['   ','\n'])==='','whitespace-only OCR yields empty html');

// language codes
ok(ocrLangCode('ind')==='ind' && ocrLangCode('eng')==='eng' && ocrLangCode('ind+eng')==='ind+eng','language codes mapped');
ok(ocrLangCode('zz')==='eng','unknown language falls back to English');

// --- UI wiring ---
const d2=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:new VirtualConsole(),
  beforeParse(w){ w.JSZip=function(){}; if(!w.crypto)w.crypto={randomUUID:()=>'x'}; }});
setTimeout(()=>{
  const doc=d2.window.document;
  ok(!!doc.getElementById('ocrOn'),'OCR toggle exists');
  ok(doc.getElementById('ocrOn').value==='off','OCR is off by default (opt-in)');
  ok(!!doc.getElementById('ocrLang'),'OCR language selector exists');
  ok(!!doc.querySelector('label[for="ocrOn"]'),'OCR toggle is labelled');
  ok(/Aktifkan OCR/.test(d2.window.eval("t('errScanned')")),'scanned-PDF error points at the OCR option');
  d2.window.document.querySelector('.langtoggle button[data-lang="en"]').dispatchEvent(new d2.window.Event('click',{bubbles:true}));
  ok(/Turn on OCR/.test(d2.window.eval("t('errScanned')")),'error localised in English too');
  console.log('\nRESULT: '+p+' passed, '+f+' failed');
  process.exit(f?1:0);
},80);
