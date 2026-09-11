const fs=require('fs');const {JSDOM}=require('jsdom');const JSZip=require('jszip');
const dom=new JSDOM('<!DOCTYPE html><body></body>');
global.window=dom.window;global.document=dom.window.document;global.DOMParser=dom.window.DOMParser;global.XMLSerializer=dom.window.XMLSerializer;global.JSZip=JSZip;global.crypto={randomUUID:()=>'x'};global.atob=s=>Buffer.from(s,'base64').toString('binary');global.btoa=s=>Buffer.from(s,'binary').toString('base64');global.TextDecoder=require('util').TextDecoder;
let core=[...fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8').matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map(x=>x[1]).pop();
core=core.slice(0,core.indexOf('/* ============================ orchestration')).replace(/^\s*["']use strict["'];\s*/,'');(0,eval)(core);
let p=0,f=0;const ok=(c,m)=>{c?(p++):(f++,0);console.log((c?'  ok  ':'  FAIL')+' '+m);};

// --- A) drop-cap titles rejected, legit single-letter titles kept ---
ok(cleanChapterTitle('T \u201cWhere?\u201d',8)==='Chapter 9','drop cap + dialogue rejected');
ok(cleanChapterTitle('M \u201cHello there\u201d',1)==='Chapter 2','drop cap + quote rejected');
ok(cleanChapterTitle('A Study in Scarlet',0)==='A Study in Scarlet','"A ..." title kept');
ok(cleanChapterTitle('I Am Legend',0)==='I Am Legend','"I ..." title kept');
ok(cleanChapterTitle('A',0)==='A','single letter alone kept');

// --- B) anchor-based TOC (Calibre style) ---
function buildMobi(text){
  const t=new TextEncoder().encode(text);
  const rec0=Buffer.alloc(16+232);
  rec0.writeUInt16BE(1,0); rec0.writeUInt32BE(t.length,4); rec0.writeUInt16BE(1,8);
  Buffer.from('MOBI').copy(rec0,16); rec0.writeUInt32BE(232,20); rec0.writeUInt32BE(65001,28);
  rec0.writeUInt32BE(0xffffffff,0x6c); rec0.writeUInt32BE(0,0x80);
  const recs=[rec0,Buffer.from(t)]; const hs=78+recs.length*8; let cur=hs; const offs=[];
  recs.forEach(r=>{offs.push(cur);cur+=r.length;});
  const buf=Buffer.alloc(cur); Buffer.from('Bk\0').copy(buf,0); Buffer.from('BOOKMOBI').copy(buf,60);
  buf.writeUInt16BE(recs.length,76);
  recs.forEach((r,i)=>{buf.writeUInt32BE(offs[i],78+i*8);buf.writeUInt32BE(i,78+i*8+4);Buffer.from(r).copy(buf,offs[i]);});
  return buf;
}
const html='<html><body>'+
 '<h1>CONTENTS</h1><p>'+
 '<a href="#c1">The Boy Who Lived</a><br/>'+
 '<a href="#c2">The Vanishing Glass</a><br/>'+
 '<a href="#c3">The Letters from No One</a></p>'+
 '<a name="c1"></a><p><span>M</span>r. and Mrs. Dursley were proud to say that they were perfectly normal, thank you very much.</p>'+
 '<a name="c2"></a><p><span>N</span>early ten years had passed since the Dursleys had woken up to find their nephew.</p>'+
 '<div id="c3"><p><span>T</span>he escape of the boa constrictor earned Harry his longest punishment ever.</p></div>'+
 '</body></html>';
const m=buildMobi(html);
const r=mobiToBook(m.buffer.slice(m.byteOffset,m.byteOffset+m.byteLength));
ok(r.tocCount===3,'anchor TOC detected: 3 (got '+r.tocCount+')');
const ch=splitChapters(r.html,'auto');
const got=ch.map(c=>c.title);
console.log('     titles ->',JSON.stringify(got));
['The Boy Who Lived','The Vanishing Glass','The Letters from No One'].forEach(x=>ok(got.includes(x),'recovered: "'+x+'"'));
ok(!got.some(x=>/Dursley|Nearly ten|escape of the boa/.test(x)),'no body prose as title');

// --- C) no TOC at all -> still falls back cleanly ---
const plain='<html><body><h1>Chapter One</h1><p>a</p><h1>Chapter Two</h1><p>b</p></body></html>';
const m2=buildMobi(plain);
const r2=mobiToBook(m2.buffer.slice(m2.byteOffset,m2.byteOffset+m2.byteLength));
ok(r2.tocCount===0,'no TOC reported when there is none');
ok(splitChapters(r2.html,'auto').length===2,'falls back to heading split');

console.log('\nRESULT: '+p+' passed, '+f+' failed');process.exit(f?1:0);
