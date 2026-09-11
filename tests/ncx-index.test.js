const fs=require('fs');const {JSDOM}=require('jsdom');const JSZip=require('jszip');
const dom=new JSDOM('<!DOCTYPE html><body></body>');
global.window=dom.window;global.document=dom.window.document;global.DOMParser=dom.window.DOMParser;global.XMLSerializer=dom.window.XMLSerializer;global.JSZip=JSZip;global.crypto={randomUUID:()=>'x'};global.atob=s=>Buffer.from(s,'base64').toString('binary');global.btoa=s=>Buffer.from(s,'binary').toString('base64');global.TextDecoder=require('util').TextDecoder;
let core=[...fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8').matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map(x=>x[1]).pop();
core=core.slice(0,core.indexOf('/* ============================ orchestration')).replace(/^\s*["']use strict["'];\s*/,'');(0,eval)(core);
let p=0,f=0;const ok=(c,m)=>{c?(p++):(f++,0);console.log((c?'  ok  ':'  FAIL')+' '+m);};

// ---------- unit: variable-width integers ----------
ok(mobiReadVwi(Uint8Array.from([0x81]),0).value===1,'vwi single byte');
ok(mobiReadVwi(Uint8Array.from([0x01,0x80]),0).value===128,'vwi two bytes (0x01,0x80)=128');
ok(mobiReadVwi(Uint8Array.from([0x03,0xE8]),0).value===488,'vwi multi-byte accumulates 7 bits');
ok(mobiCountBits(0b1011)===3,'bit counting');

// ---------- build a spec-shaped NCX index ----------
function vwiEnc(n){ // variable width, last byte has high bit set
  const out=[]; do{ out.unshift(n & 0x7f); n >>= 7; }while(n>0);
  out[out.length-1] |= 0x80; return out;
}
function indxHeader(len,start,count,total){
  const b=Buffer.alloc(len,0); b.write('INDX',0);
  b.writeUInt32BE(len,0x04); b.writeUInt32BE(start,0x14); b.writeUInt32BE(count,0x18);
  b.writeUInt32BE(65001,0x1c); b.writeUInt32BE(total,0x24); return b;
}
function buildNcxRecords(chapters){
  const HDR=0xC0;
  // --- header record: INDX header + TAGX ---
  const tagx=Buffer.alloc(12+4*4);
  tagx.write('TAGX',0); tagx.writeUInt32BE(tagx.length,4); tagx.writeUInt32BE(1,8); // 1 control byte
  [[1,1,1,0],[2,1,2,0],[3,1,4,0],[0,0,0,1]].forEach((t,i)=>{ tagx[12+i*4]=t[0];tagx[13+i*4]=t[1];tagx[14+i*4]=t[2];tagx[15+i*4]=t[3]; });
  const head=Buffer.concat([indxHeader(HDR,0,1,chapters.length),tagx]);   // count=1 entry record
  // --- entry record ---
  const entries=[]; const offsets=[];
  let body=Buffer.alloc(0);
  chapters.forEach((c,i)=>{
    offsets.push(HDR+body.length);
    const label=Buffer.from('e'+i,'ascii');
    const ctrl=Buffer.from([0x07]);                       // tags 1,2,3 present
    const vals=Buffer.from([].concat(vwiEnc(c.pos),vwiEnc(10),vwiEnc(c.cncxOff)));
    body=Buffer.concat([body,Buffer.from([label.length]),label,ctrl,vals]);
  });
  const idxtOff=HDR+body.length;
  const idxt=Buffer.concat([Buffer.from('IDXT','ascii'),Buffer.from(new Uint8Array(new Uint16Array(offsets).length*2))]);
  const idxtBuf=Buffer.alloc(4+offsets.length*2); idxtBuf.write('IDXT',0);
  offsets.forEach((o,i)=>idxtBuf.writeUInt16BE(o,4+i*2));
  const entryRec=Buffer.concat([indxHeader(HDR,idxtOff,chapters.length,chapters.length),body,idxtBuf]);
  // --- cncx record ---
  let cncx=Buffer.alloc(0);
  chapters.forEach(c=>{ const t=Buffer.from(c.title,'utf8'); cncx=Buffer.concat([cncx,Buffer.from(vwiEnc(t.length)),t]); });
  return [head,entryRec,cncx];
}
function buildMobi(textBytes, ncxRecs){
  const rec0=Buffer.alloc(16+248);
  rec0.writeUInt16BE(1,0); rec0.writeUInt32BE(textBytes.length,4); rec0.writeUInt16BE(1,8);
  Buffer.from('MOBI').copy(rec0,16); rec0.writeUInt32BE(248,20); rec0.writeUInt32BE(65001,28);
  rec0.writeUInt32BE(0xffffffff,0x6c); rec0.writeUInt32BE(0,0x80);
  rec0.writeUInt32BE(2,0xf4);                      // ncxidx -> record 2
  const recs=[rec0,Buffer.from(textBytes)].concat(ncxRecs);
  const hs=78+recs.length*8; let cur=hs; const offs=[];
  recs.forEach(r=>{offs.push(cur);cur+=r.length;});
  const buf=Buffer.alloc(cur); Buffer.from('Bk\0').copy(buf,0); Buffer.from('BOOKMOBI').copy(buf,60);
  buf.writeUInt16BE(recs.length,76);
  recs.forEach((r,i)=>{buf.writeUInt32BE(offs[i],78+i*8);buf.writeUInt32BE(i,78+i*8+4);Buffer.from(r).copy(buf,offs[i]);});
  return buf;
}

// text with three chapters, no HTML TOC and no usable headings
const enc=new TextEncoder();
const parts=['<html><body><p>Front matter here.</p>',
 '<p><span>M</span>r. and Mrs. Dursley were proud to say they were perfectly normal.</p>',
 '<p><span>N</span>early ten years had passed since that particular morning arrived.</p>',
 '<p><span>T</span>he escape of the boa constrictor earned Harry a long punishment.</p></body></html>'];
let acc=parts[0]; const positions=[];
for(let i=1;i<parts.length;i++){ positions.push(enc.encode(acc).length); acc+=parts[i]; }
const titles=['The Boy Who Lived','The Vanishing Glass','The Letters from No One'];
// cncx offsets
let off=0; const chapters=titles.map((t,i)=>{ const o=off; off+=1+Buffer.byteLength(t); return {title:t,pos:positions[i],cncxOff:o}; });
const mobi=buildMobi(enc.encode(acc), buildNcxRecords(chapters));
const r=mobiToBook(mobi.buffer.slice(mobi.byteOffset,mobi.byteOffset+mobi.byteLength));

ok(r.tocCount===3,'NCX index parsed: 3 chapters (got '+r.tocCount+')');
const got=splitChapters(r.html,'auto').map(c=>c.title);
console.log('     titles ->',JSON.stringify(got));
titles.forEach(t2=>ok(got.includes(t2),'recovered from binary index: "'+t2+'"'));
ok(!got.some(x=>/Dursley|Nearly ten|boa constrictor/.test(x)),'no body prose used as a title');

// ---------- graceful fallback when the index is absent or corrupt ----------
const plain=buildMobi(enc.encode('<html><body><h1>Chapter One</h1><p>a</p><h1>Chapter Two</h1><p>b</p></body></html>'),[Buffer.from('junk')]);
const r2=mobiToBook(plain.buffer.slice(plain.byteOffset,plain.byteOffset+plain.byteLength));
ok(r2.tocCount===0,'corrupt index ignored, no crash');
ok(splitChapters(r2.html,'auto').length===2,'falls back to heading split');

console.log('\nRESULT: '+p+' passed, '+f+' failed');process.exit(f?1:0);
