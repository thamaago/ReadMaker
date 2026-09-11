const fs=require('fs');const {JSDOM,VirtualConsole}=require('jsdom');const JSZip=require('jszip');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const dom=new JSDOM('<!DOCTYPE html><body></body>');
global.window=dom.window;global.document=dom.window.document;global.DOMParser=dom.window.DOMParser;global.XMLSerializer=dom.window.XMLSerializer;global.JSZip=JSZip;global.crypto={randomUUID:()=>'x'};global.atob=s=>Buffer.from(s,'base64').toString('binary');global.btoa=s=>Buffer.from(s,'binary').toString('base64');
let core=[...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map(x=>x[1]).pop();
core=core.slice(0,core.indexOf('/* ============================ orchestration')).replace(/^\s*["']use strict["'];\s*/,'');(0,eval)(core);
let p=0,f=0;const ok=(c,m)=>{c?(p++):(f++,0);console.log((c?'  ok  ':'  FAIL')+' '+m);};

// language detection
['ar','he','fa','ur','ar-EG','FA','ckb'].forEach(l=>ok(isRtlLang(l),'RTL detected: '+l));
['en','id','de','zh','ja','ko','ru',''].forEach(l=>ok(!isRtlLang(l),'LTR kept: "'+l+'"'));

// OCR language codes
ok(ocrLangCode('ara')==='ara'&&ocrLangCode('chi_sim')==='chi_sim'&&ocrLangCode('jpn')==='jpn','CJK/Arabic OCR codes accepted');
ok(ocrLangCode('nope')==='eng','unknown OCR language falls back to English');

(async()=>{
  const chapters=[{title:'الفصل',level:1,html:'<p>نص عربي</p>'}];
  const mkEpub=async(lang)=>{
    const blob=await buildEpub({title:'كتاب',author:'',language:lang,images:[],coverName:'',chapters});
    return await JSZip.loadAsync(Buffer.from(await blob.arrayBuffer()));
  };
  const ar=await mkEpub('ar');
  const c1=await ar.file('OEBPS/chap001.xhtml').async('string');
  const opf=await ar.file('OEBPS/content.opf').async('string');
  const nav=await ar.file('OEBPS/nav.xhtml').async('string');
  ok(/<html[^>]*dir="rtl"/.test(c1),'chapter <html> marked dir="rtl"');
  ok(/<body[^>]*dir="rtl"/.test(c1),'chapter <body> marked dir="rtl"');
  ok(/page-progression-direction="rtl"/.test(opf),'spine sets right-to-left page order');
  ok(/<html[^>]*dir="rtl"/.test(nav),'contents page marked rtl');
  ok(!new window.DOMParser().parseFromString(c1,'application/xhtml+xml').querySelector('parsererror'),'rtl chapter still well-formed XHTML');
  ok(/<dc:language>ar<\/dc:language>/.test(opf),'language recorded');

  const en=await mkEpub('en');
  const c2=await en.file('OEBPS/chap001.xhtml').async('string');
  ok(!/dir="rtl"/.test(c2),'LTR book gets no dir attribute');
  ok(!/page-progression-direction/.test(await en.file('OEBPS/content.opf').async('string')),'LTR spine unchanged');

  // UI: OCR language list
  const d2=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:new VirtualConsole(),
    beforeParse(w){ w.JSZip=function(){}; if(!w.crypto)w.crypto={randomUUID:()=>'x'}; }});
  setTimeout(()=>{
    const opts=[...d2.window.document.getElementById('ocrLang').options].map(o=>o.value);
    ok(opts.length===12,'12 OCR languages offered ('+opts.length+')');
    ['ara','chi_sim','jpn','kor'].forEach(l=>ok(opts.includes(l),'OCR offers '+l));
    console.log('\nRESULT: '+p+' passed, '+f+' failed');
    process.exit(f?1:0);
  },80);
})().catch(e=>{console.error(e);process.exit(2)});
