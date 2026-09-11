const fs=require('fs');const {JSDOM}=require('jsdom');
const dom=new JSDOM('<!DOCTYPE html><body></body>');
global.window=dom.window;global.document=dom.window.document;global.DOMParser=dom.window.DOMParser;global.XMLSerializer=dom.window.XMLSerializer;global.TextEncoder=require('util').TextEncoder;
let core=[...fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8').matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map(x=>x[1]).pop();
core=core.slice(0,core.indexOf('/* ============================ orchestration')).replace(/^\s*["']use strict["'];\s*/,'');(0,eval)(core);
let p=0,f=0;const ok=(c,m)=>{c?(p++):(f++,0);console.log((c?'  ok  ':'  FAIL')+' '+m);};

// ---- folder grouping ----
ok(comicChaptersFromDirs([]).length===0,'no dirs -> no chapters');
ok(comicChaptersFromDirs(['','','']).length===0,'single/no folder -> no chapter table');
const g=comicChaptersFromDirs(['ch1','ch1','ch1','ch2','ch2','ch3']);
ok(g.length===3,'three folders -> three chapters ('+g.length+')');
ok(g[0].name==='ch1'&&g[0].startPage===1&&g[0].endPage===3,'first chapter spans pages 1-3');
ok(g[1].startPage===4&&g[1].endPage===5,'second chapter spans pages 4-5');
ok(g[2].startPage===6&&g[2].endPage===6,'last chapter single page');
const nested=comicChaptersFromDirs(['comic/Vol 1','comic/Vol 1','comic/Vol 2']);
ok(nested[0].name==='Vol 1','nested folder uses the leaf name');

// ---- write an XTC with chapters, then decode it the way the firmware does ----
function mkPage(){ return {gray:new Uint8ClampedArray(16*8), w:16, h:8}; }
const chapters=[{name:'Bab Satu',startPage:1,endPage:2},{name:'Bab Dua',startPage:3,endPage:3}];
const buf=buildXtc([mkPage(),mkPage(),mkPage()],{twoBit:false,title:'Komik',author:'Penulis',chapters:chapters});
const dv=new DataView(buf.buffer,buf.byteOffset,buf.byteLength);

ok(buf[0x0B]===1,'hasChapters flag set');
const chapterOffset=Number(dv.getBigUint64(0x30,true));
const pageTableOffset=Number(dv.getBigUint64(0x18,true));
ok(chapterOffset===0x138,'chapterOffset = 0x138 (right after metadata)');
ok(pageTableOffset===chapterOffset+chapters.length*96,'page table follows the chapter table');
// firmware derives the count from the gap
const derived=(pageTableOffset-chapterOffset)/96;
ok(derived===2,'firmware-style derived chapter count = 2 (got '+derived+')');
// decode each 96-byte record
function readChapter(i){
  const base=chapterOffset+i*96;
  let end=base; while(end<base+80 && buf[end]!==0) end++;
  const name=Buffer.from(buf.subarray(base,end)).toString('utf8');
  return {name, startPage:dv.getUint16(base+0x50,true), endPage:dv.getUint16(base+0x52,true)};
}
const c0=readChapter(0), c1=readChapter(1);
ok(c0.name==='Bab Satu'&&c0.startPage===1&&c0.endPage===2,'chapter 1 round-trips ('+JSON.stringify(c0)+')');
ok(c1.name==='Bab Dua'&&c1.startPage===3&&c1.endPage===3,'chapter 2 round-trips');
// names must be null-padded, not run into the next record
ok(buf[chapterOffset+8]===0,'name is null-terminated inside its 80-byte slot');
// pages still decode correctly with chapters present
ok(dv.getUint32(0,true)===0x00435458,'XTC magic intact');
ok(dv.getUint16(6,true)===3,'page count intact');
const dataOffset=Number(dv.getBigUint64(0x20,true));
ok(dataOffset===pageTableOffset+3*16,'data starts after the page table');
const firstPageOff=Number(dv.getBigUint64(pageTableOffset,true));
ok(firstPageOff===dataOffset,'first page points at the data section');
ok(dv.getUint32(firstPageOff,true)===0x00475458,'page header magic XTG');

// ---- no chapters: legacy layout preserved ----
const plain=buildXtc([mkPage()],{twoBit:false,title:'x',author:''});
const pv=new DataView(plain.buffer,plain.byteOffset,plain.byteLength);
ok(plain[0x0B]===0,'hasChapters cleared when no chapters');
ok(Number(pv.getBigUint64(0x30,true))===0,'chapterOffset zero when unused');
ok(Number(pv.getBigUint64(0x18,true))===0x138,'page table stays at 0x138 without chapters');

console.log('\nRESULT: '+p+' passed, '+f+' failed');process.exit(f?1:0);
