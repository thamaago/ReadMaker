const fs=require('fs');const {JSDOM}=require('jsdom');const JSZip=require('jszip');
const dom=new JSDOM('<!DOCTYPE html><body></body>');
global.window=dom.window;global.document=dom.window.document;global.DOMParser=dom.window.DOMParser;global.XMLSerializer=dom.window.XMLSerializer;global.JSZip=JSZip;global.crypto={randomUUID:()=>'x'};global.atob=s=>Buffer.from(s,'base64').toString('binary');global.btoa=s=>Buffer.from(s,'binary').toString('base64');global.TextDecoder=require('util').TextDecoder;
let core=[...fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8').matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map(x=>x[1]).pop();
core=core.slice(0,core.indexOf('/* ============================ orchestration')).replace(/^\s*["']use strict["'];\s*/,'');(0,eval)(core);
let p=0,f=0;const ok=(c,m)=>{c?(p++):(f++,0);console.log((c?'  ok  ':'  FAIL')+' '+m);};

// Build book text mimicking a real MOBI: TOC page with filepos anchors,
// chapters that begin with a drop cap and NO usable heading tags.
function buildBody(){
  const enc=new TextEncoder();
  const chapters=[
    {t:'The Boy Who Lived', b:'<p><span>M</span>r. and Mrs. Dursley, of number four, Privet Drive, were proud to say that they were perfectly normal, thank you very much.</p>'},
    {t:'The Vanishing Glass', b:'<p><span>N</span>early ten years had passed since the Dursleys had woken up to find their nephew on the front step.</p>'},
    {t:'The Letters from No One', b:'<p><span>T</span>he escape of the Brazilian boa constrictor earned Harry his longest-ever punishment.</p>'}
  ];
  // first pass with placeholder filepos to learn byte offsets
  let head='<html><body><h1>CONTENTS</h1>';
  const placeholders=chapters.map((c,i)=>'<a filepos=0000000>'+c.t+'</a><br/>');
  head+=placeholders.join('')+'</p>';
  let offsets=[];
  let body=head;
  chapters.forEach(c=>{ offsets.push(enc.encode(body).length); body+='<mbp:pagebreak/>'+c.b; });
  body+='</body></html>';
  // second pass: real offsets (lengths identical, 7 digits)
  let out='<html><body><h1>CONTENTS</h1>';
  out+=chapters.map((c,i)=>'<a filepos='+String(offsets[i]).padStart(7,'0')+'>'+c.t+'</a><br/>').join('')+'</p>';
  chapters.forEach(c=>{ out+='<mbp:pagebreak/>'+c.b; });
  out+='</body></html>';
  return {text:enc.encode(out), titles:chapters.map(c=>c.t)};
}
function buildMobi(textBytes){
  const rec0=Buffer.alloc(16+232);
  rec0.writeUInt16BE(1,0); rec0.writeUInt32BE(textBytes.length,4); rec0.writeUInt16BE(1,8);
  Buffer.from('MOBI').copy(rec0,16); rec0.writeUInt32BE(232,20); rec0.writeUInt32BE(65001,28);
  rec0.writeUInt32BE(0,0x54); rec0.writeUInt32BE(0,0x58); rec0.writeUInt32BE(0xffffffff,0x6c); rec0.writeUInt32BE(0,0x80);
  const recs=[rec0, Buffer.from(textBytes)];
  const headerSize=78+recs.length*8; let cur=headerSize; const offs=[];
  recs.forEach(r=>{offs.push(cur);cur+=r.length;});
  const buf=Buffer.alloc(cur);
  Buffer.from('Book\0').copy(buf,0); Buffer.from('BOOKMOBI').copy(buf,60);
  buf.writeUInt16BE(recs.length,76);
  recs.forEach((r,i)=>{buf.writeUInt32BE(offs[i],78+i*8);buf.writeUInt32BE(i,78+i*8+4);Buffer.from(r).copy(buf,offs[i]);});
  return buf;
}

const {text,titles}=buildBody();
const mobi=buildMobi(text);
const r=mobiToBook(mobi.buffer.slice(mobi.byteOffset,mobi.byteOffset+mobi.byteLength));

ok(r.tocCount===3,'book TOC detected: 3 entries (got '+r.tocCount+')');
const ch=splitChapters(r.html,'auto');
ok(ch.length===titles.length+1 || ch.length===titles.length,'split follows TOC ('+ch.length+' chapters)');
const got=ch.map(c=>c.title);
console.log('     titles ->', JSON.stringify(got));
titles.forEach(tt=>ok(got.includes(tt),'real chapter title recovered: "'+tt+'"'));
ok(!got.some(x=>/^Mr\. and Mrs|^Nearly ten|^The escape/.test(x)),'no body prose used as a title');
ok(!got.some(x=>/^M[a-z]{3,}|^N[a-z]{3,}(?!early)/.test(x) && x.length>50),'no drop-cap glued titles');

// explicit 'toc' mode works too
const ch2=splitChapters(r.html,'toc');
ok(ch2.length>=titles.length,'explicit toc mode splits ('+ch2.length+')');

// graceful fallback: a book with no filepos TOC still uses headings
const plain='<h1>Chapter One</h1><p>a</p><h1>Chapter Two</h1><p>b</p>';
const ch3=splitChapters(plain,'auto');
ok(ch3.length===2 && ch3[0].title==='Chapter One','no-TOC book still splits on headings');

console.log('\nRESULT: '+p+' passed, '+f+' failed');process.exit(f?1:0);
