const fs=require('fs');const {JSDOM}=require('jsdom');const JSZip=require('jszip');
const dom=new JSDOM('<!DOCTYPE html><body></body>');
global.window=dom.window;global.document=dom.window.document;global.DOMParser=dom.window.DOMParser;global.XMLSerializer=dom.window.XMLSerializer;global.JSZip=JSZip;global.crypto={randomUUID:()=>'x'};global.atob=s=>Buffer.from(s,'base64').toString('binary');global.btoa=s=>Buffer.from(s,'binary').toString('base64');global.TextDecoder=require('util').TextDecoder;
let core=[...fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8').matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map(x=>x[1]).pop();
core=core.slice(0,core.indexOf('/* ============================ orchestration')).replace(/^\s*["']use strict["'];\s*/,'');(0,eval)(core);
let p=0,f=0;const ok=(c,m)=>{c?(p++):(f++,0);console.log((c?'  ok  ':'  FAIL')+' '+m);};

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

// A) No TOC, no headings — only MOBI page breaks + chapter marker lines
const html='<html><body>'+
 '<p>Front matter copyright notice line.</p>'+
 '<mbp:pagebreak/><p>CHAPTER ONE</p><p>THE BOY WHO LIVED</p><p><span>M</span>r. and Mrs. Dursley were proud to say that they were perfectly normal, thank you very much indeed.</p>'+
 '<mbp:pagebreak/><p>CHAPTER TWO</p><p>THE VANISHING GLASS</p><p><span>N</span>early ten years had passed since the Dursleys woke to find their nephew on the step.</p>'+
 '<mbp:pagebreak/><p>CHAPTER THREE</p><p>THE LETTERS FROM NO ONE</p><p><span>T</span>he escape of the boa constrictor earned Harry his longest punishment ever recorded.</p>'+
 '</body></html>';
const m=buildMobi(html);
const r=mobiToBook(m.buffer.slice(m.byteOffset,m.byteOffset+m.byteLength));
ok(/data-cp-break/.test(r.html),'page-break markers preserved from MOBI');
const ch=splitChapters(r.html,'auto');
const got=ch.map(c=>c.title);
console.log('     titles ->',JSON.stringify(got));
ok(ch.length===4,'split on page breaks -> 4 chunks incl. front matter ('+ch.length+')');
ok(got.includes('CHAPTER ONE: THE BOY WHO LIVED'),'marker + name combined into title');
ok(got.includes('CHAPTER TWO: THE VANISHING GLASS'),'second chapter title combined');
ok(!got.some(x=>/Dursley|Nearly ten|boa constrictor/.test(x)),'no body prose used as title');
ok(!got.some(x=>/^M[a-z]|^N[a-z]|^T[a-z]/.test(x) && x.length>40),'no drop-cap titles');

// B) chapter marker alone (no name line)
const w=new DOMParser().parseFromString('<div><p>Bab 3</p><p>Isi bab yang panjang sekali dan tidak layak jadi judul sama sekali.</p></div>','text/html').body.firstChild;
ok(titleFromBlocks(w)==='Bab 3','marker-only title kept as-is');

// C) marker followed by prose must NOT glue prose into the title
const w2=new DOMParser().parseFromString('<div><p>CHAPTER FIVE</p><p>The wind blew hard across the moor that night, and everyone felt it.</p></div>','text/html').body.firstChild;
ok(titleFromBlocks(w2)==='CHAPTER FIVE','marker kept, following prose rejected');

// D) headings still win when present (no regression)
const withH='<h1>Real Heading</h1><p>x</p><h1>Second Heading</h1><p>y</p>';
const chH=splitChapters(withH,'auto');
ok(chH.length===2 && chH[0].title==='Real Heading','headings still take priority');

// E) TOC still outranks page breaks
const tocHtml='<h1 data-cp-toc="1">Nice Title</h1><p>a</p><hr data-cp-break="1"/><p>b</p><h1 data-cp-toc="1">Other Title</h1><p>c</p>';
const chT=splitChapters(tocHtml,'auto');
ok(chT.length===2 && chT[0].title==='Nice Title','book TOC still outranks page breaks');

console.log('\nRESULT: '+p+' passed, '+f+' failed');process.exit(f?1:0);
