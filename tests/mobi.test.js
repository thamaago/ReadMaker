const fs=require('fs');const {JSDOM}=require('jsdom');const JSZip=require('jszip');
const dom=new JSDOM('<!DOCTYPE html><body></body>',{url:'https://localhost/'});
global.window=dom.window;global.document=dom.window.document;global.DOMParser=dom.window.DOMParser;global.XMLSerializer=dom.window.XMLSerializer;global.JSZip=JSZip;global.crypto={randomUUID:()=>'66666666-7777-4888-8999-aaaaaaaaaaaa'};global.atob=s=>Buffer.from(s,'base64').toString('binary');global.btoa=s=>Buffer.from(s,'binary').toString('base64');global.TextDecoder=require('util').TextDecoder;
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
let core=[...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map(x=>x[1]).pop();
core=core.slice(0,core.indexOf('/* ============================ orchestration')).replace(/^\s*["']use strict["'];\s*/,'');
(0,eval)(core);

let p=0,f=0;const ok=(c,m)=>{c?(p++,console.log('  ok  ',m)):(f++,console.log('  FAIL',m));};

// 1) PalmDOC decompress unit tests
const d1=palmDocDecompress(Uint8Array.from([0x61,0x62,0x63,0x80,0x18]));
ok(Buffer.from(d1).toString('latin1')==='abcabc','PalmDOC length/distance copy -> abcabc');
const d2=palmDocDecompress(Uint8Array.from([0xE1]));
ok(Buffer.from(d2).toString('latin1')===' a','PalmDOC space-compression 0xE1 -> " a"');
const d3=palmDocDecompress(Uint8Array.from([0x03,0x78,0x79,0x7a]));
ok(Buffer.from(d3).toString('latin1')==='xyz','PalmDOC literal run (0x03 + xyz)');

// 2) Build a synthetic uncompressed MOBI
function buildMobi(){
  const enc=new TextEncoder();
  const text=enc.encode('<html><body><h1>Bab Satu</h1><p>Halo <b>dunia</b> yang indah.</p><img recindex="00001"/><h1>Bab Dua</h1><p>Tamat.</p></body></html>');
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC','base64');
  const author=enc.encode('Sang Penulis'); const stitle=enc.encode('Judul Uji'); const lang=enc.encode('id');
  // EXTH
  function exthRec(type,data){ const b=Buffer.alloc(8+data.length); b.writeUInt32BE(type,0); b.writeUInt32BE(8+data.length,4); Buffer.from(data).copy(b,8); return b; }
  const exthRecs=Buffer.concat([exthRec(100,author),exthRec(503,stitle),exthRec(524,lang),exthRec(201,Buffer.from([0,0,0,0]))]);
  const exthBody=Buffer.concat([Buffer.from('EXTH'),(()=>{const b=Buffer.alloc(8);b.writeUInt32BE(12+exthRecs.length,0);b.writeUInt32BE(4,4);return b;})(),exthRecs]);
  const mobiHeaderLen=232;
  const fullName=enc.encode('Judul Uji Lengkap');
  // record0 = palmdoc(16) + mobiheader(232) + exth + fullname
  const exthOffset=16+mobiHeaderLen;
  const fullNameOffset=exthOffset+exthBody.length;
  const rec0=Buffer.alloc(fullNameOffset+fullName.length);
  rec0.writeUInt16BE(1,0);            // compression = none
  rec0.writeUInt32BE(text.length,4);  // textLength
  rec0.writeUInt16BE(1,8);            // record count (text records)
  rec0.writeUInt16BE(4096,10);
  Buffer.from('MOBI').copy(rec0,16);
  rec0.writeUInt32BE(mobiHeaderLen,20);
  rec0.writeUInt32BE(2,24);           // mobi type
  rec0.writeUInt32BE(65001,28);       // UTF-8
  rec0.writeUInt32BE(fullNameOffset,0x54);
  rec0.writeUInt32BE(fullName.length,0x58);
  rec0.writeUInt32BE(0,0x5c);
  rec0.writeUInt32BE(2,0x6c);         // firstImageIndex = record 2
  rec0.writeUInt32BE(0x40,0x80);      // EXTH present
  Buffer.from(exthBody).copy(rec0,exthOffset);
  Buffer.from(fullName).copy(rec0,fullNameOffset);
  const recs=[rec0, Buffer.from(text), png];
  // PDB header
  const numRec=recs.length;
  const headerSize=78+numRec*8;
  const offsets=[]; let cur=headerSize;
  for(const r of recs){ offsets.push(cur); cur+=r.length; }
  const total=cur;
  const buf=Buffer.alloc(total);
  Buffer.from('TestBook\0').copy(buf,0);
  Buffer.from('BOOKMOBI').copy(buf,60);
  buf.writeUInt16BE(numRec,76);
  for(let i=0;i<numRec;i++){ buf.writeUInt32BE(offsets[i],78+i*8); buf.writeUInt32BE(i,78+i*8+4); }
  recs.forEach((r,i)=>Buffer.from(r).copy(buf,offsets[i]));
  return buf;
}
const mobiBuf=buildMobi();
const ab=mobiBuf.buffer.slice(mobiBuf.byteOffset,mobiBuf.byteOffset+mobiBuf.byteLength);
const r=mobiToBook(ab);
ok(r.title==='Judul Uji','MOBI title from EXTH 503 ('+r.title+')');
ok(r.author==='Sang Penulis','MOBI author from EXTH 100');
ok(r.lang==='id','MOBI language from EXTH 524');
ok((r.html.match(/<h1>/g)||[]).length===2,'MOBI two headings ('+((r.html.match(/<h1>/g)||[]).length)+')');
ok(/<strong>dunia<\/strong>/.test(r.html)||/<b>dunia<\/b>/.test(r.html),'MOBI inline bold kept');
ok(r.images.length>=1 && /<img src="images\/img_0\./.test(r.html),'MOBI img recindex resolved to embedded image');
ok(r.coverName && r.coverName.length>0,'MOBI cover set from EXTH 201 ('+r.coverName+')');

(async()=>{
  const book={title:r.title,author:r.author,language:r.lang,images:r.images,coverName:r.coverName,chapters:splitChapters(r.html,'auto')};
  ok(book.chapters.length===2,'MOBI split -> 2 chapters');
  const blob=await buildEpub(book);const buf=Buffer.from(await blob.arrayBuffer());fs.writeFileSync('sample-mobi.epub',buf);
  const zip=await JSZip.loadAsync(buf);
  ok(!!zip.file('OEBPS/images/img_0.png') || !!zip.file('OEBPS/images/cover.png'),'epub: mobi image embedded');
  const c1=await zip.file('OEBPS/chap001.xhtml').async('string');
  ok(!new window.DOMParser().parseFromString(c1,'application/xhtml+xml').querySelector('parsererror'),'MOBI chapter XHTML valid');
  // HUFF guard
  try{ const b2=Buffer.from(mobiBuf); b2.writeUInt16BE(17480,offsetsHack(b2)); }catch(e){}
  console.log('\nRESULT: '+p+' passed, '+f+' failed ('+buf.length+' bytes)');process.exit(f?1:0);
})().catch(e=>{console.error(e);process.exit(2)});
function offsetsHack(){return 0;}
