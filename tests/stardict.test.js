const fs=require('fs');const {JSDOM,VirtualConsole}=require('jsdom');const JSZip=require('jszip');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const dom=new JSDOM('<!DOCTYPE html><body></body>');
global.window=dom.window;global.document=dom.window.document;global.DOMParser=dom.window.DOMParser;global.XMLSerializer=dom.window.XMLSerializer;global.JSZip=JSZip;global.TextEncoder=require('util').TextEncoder;global.TextDecoder=require('util').TextDecoder;
let core=[...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map(x=>x[1]).pop();
core=core.slice(0,core.indexOf('/* ============================ orchestration')).replace(/^\s*["']use strict["'];\s*/,'');(0,eval)(core);
let p=0,f=0;const ok=(c,m)=>{c?(p++):(f++,0);console.log((c?'  ok  ':'  FAIL')+' '+m);};

// ---- wordlist parsing ----
ok(parseWordlist('cat\tkucing\ndog\tanjing').length===2,'TSV parsed');
ok(parseWordlist('cat:kucing\ndog:anjing').length===2,'colon-separated parsed');
ok(parseWordlist('  \n\ncat\tkucing\n').length===1,'blank lines skipped');
ok(parseWordlist('noseparator').length===0,'line without separator skipped');

// ---- build + decode with the firmware's exact .idx layout ----
const rows=parseWordlist('dog\tanjing\ncat\tkucing\ncat\tmeong\napple\tapel\n\u00e9cole\tsekolah');
const d=buildStarDict(rows,{bookname:'Test Dict',html:false});
const enc=new TextEncoder(), dec=new TextDecoder();

// parse .idx exactly as Dictionary.cpp does: headword\0 + BE32 offset + BE32 size
function parseIdx(idx){
  const out=[]; let i=0; const dv=new DataView(idx.buffer,idx.byteOffset,idx.byteLength);
  while(i<idx.length){
    let j=i; while(j<idx.length && idx[j]!==0) j++;
    const word=dec.decode(idx.subarray(i,j));
    const off=dv.getUint32(j+1,false), size=dv.getUint32(j+5,false);
    out.push({word,off,size}); i=j+9;
  }
  return out;
}
const entries=parseIdx(d.idx);
ok(entries.length===4,'4 unique headwords (cat merged) ('+entries.length+')');
// sorted by utf-8 bytes: apple, cat, dog, école
ok(entries.map(e=>e.word).join(',')==='apple,cat,dog,\u00e9cole','entries sorted by byte order: '+entries.map(e=>e.word).join(','));
ok(d.wordcount===4 && /wordcount=4/.test(dec.decode(d.ifo)),'ifo wordcount matches');
ok(/idxoffsetbits=32/.test(dec.decode(d.ifo)),'ifo declares 32-bit offsets');
ok(/bookname=Test Dict/.test(dec.decode(d.ifo)),'ifo bookname set');
ok(dec.decode(d.ifo).indexOf('idxfilesize='+d.idx.length)>=0,'ifo idxfilesize matches .idx length');

// every offset/size must point at the right definition in .dict
function defOf(e){ return dec.decode(d.dict.subarray(e.off,e.off+e.size)); }
const map={}; entries.forEach(e=>map[e.word]=defOf(e));
ok(map['apple']==='apel','apple -> apel resolves from .dict');
ok(map['dog']==='anjing','dog -> anjing resolves');
ok(map['\u00e9cole']==='sekolah','unicode headword resolves');
ok(map['cat']==='kucing\nmeong','duplicate headword merged into one definition');
// offsets contiguous and within bounds
let okoff=true, cur=0;
entries.forEach(e=>{ if(e.off!==cur) okoff=false; cur+=e.size; });
ok(okoff,'offsets are contiguous from 0');
ok(cur===d.dict.length,'offsets cover the whole .dict exactly');

// html mode
const dh=buildStarDict(parseWordlist('a\tone\na\ttwo'),{html:true});
ok(/sametypesequence=h/.test(dec.decode(dh.ifo)),'html mode sets sametypesequence=h');
ok(dec.decode(dh.dict).indexOf('<br/>')>=0,'html mode joins duplicates with <br/>');

// ---- UI + zip layout ----
const d2=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:new VirtualConsole(),
  beforeParse(w){ w.JSZip=JSZip; if(!w.crypto)w.crypto={randomUUID:()=>'x'}; }});
setTimeout(async()=>{
  const doc=d2.window.document;
  ok(!!doc.getElementById('dictFile'),'dictionary file picker exists');
  ok(!!doc.querySelector('label[for="dictFile"]'),'picker labelled');
  ok(/CrossPoint \/ SUMI/.test(doc.querySelector('[data-i18n="dictHead"]').textContent),'tool marked device-specific');

  // assemble the ZIP the way makeDictionary does and verify the layout
  const d3=buildStarDict(parseWordlist('dog\tanjing\ncat\tkucing'),{bookname:'EN-ID',html:false});
  const stem='EN-ID';
  const z=new JSZip(); const folder=z.folder('dictionaries').folder(stem);
  folder.file(stem+'.ifo',d3.ifo); folder.file(stem+'.idx',d3.idx); folder.file(stem+'.dict',d3.dict);
  const buf=Buffer.from(await z.generateAsync({type:'nodebuffer'}));
  const zip=await JSZip.loadAsync(buf); const names=Object.keys(zip.files);
  ok(names.includes('dictionaries/EN-ID/EN-ID.ifo'),'ifo under dictionaries/<stem>/');
  ok(names.includes('dictionaries/EN-ID/EN-ID.idx'),'idx present');
  ok(names.includes('dictionaries/EN-ID/EN-ID.dict'),'dict present');
  const idxBack=await zip.file('dictionaries/EN-ID/EN-ID.idx').async('uint8array');
  ok(parseIdx(idxBack).length===2,'idx inside the zip has both entries');

  console.log('\nRESULT: '+p+' passed, '+f+' failed');
  process.exit(f?1:0);
},80);
