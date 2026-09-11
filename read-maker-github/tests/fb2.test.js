const fs=require('fs');const {JSDOM}=require('jsdom');const JSZip=require('jszip');
const dom=new JSDOM('<!DOCTYPE html><body></body>',{url:'https://localhost/'});
global.window=dom.window;global.document=dom.window.document;global.DOMParser=dom.window.DOMParser;
global.XMLSerializer=dom.window.XMLSerializer;global.JSZip=JSZip;
global.crypto={randomUUID:()=>'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'};global.atob=s=>Buffer.from(s,'base64').toString('binary');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
let core=[...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map(x=>x[1]).pop();
core=core.slice(0,core.indexOf('/* ============================ orchestration')).replace(/^\s*["']use strict["'];\s*/,'');
(0,eval)(core);
// 1x1 png base64
const px='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC';
const fb2=`<?xml version="1.0" encoding="utf-8"?>
<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0" xmlns:l="http://www.w3.org/1999/xlink">
<description><title-info>
<book-title>Naga Merah</book-title>
<author><first-name>Siti</first-name><last-name>Rahma</last-name></author>
<lang>id</lang>
<coverpage><image l:href="#cov.png"/></coverpage>
</title-info></description>
<body>
<section><title>Bab Satu</title><p>Angin <emphasis>berhembus</emphasis> pelan.</p><p>Malam turun.</p></section>
<section><title>Bab Dua</title><p>Pagi tiba.</p></section>
</body>
<binary id="cov.png" content-type="image/png">${px}</binary>
</FictionBook>`;
(async()=>{
  let p=0,f=0;const ok=(c,m)=>{c?(p++,console.log('  ok  ',m)):(f++,console.log('  FAIL',m));};
  const r=fb2ToBook(fb2);
  ok(r.title==='Naga Merah','fb2 title');
  ok(r.author==='Siti Rahma','fb2 author');
  ok(r.lang==='id','fb2 lang');
  ok(r.coverName && /^cover\.png$/.test(r.coverName),'fb2 cover extracted ('+r.coverName+')');
  ok(r.images.length===1,'fb2 image count');
  ok(/<em>berhembus<\/em>/.test(r.html),'fb2 emphasis->em');
  ok((r.html.match(/<h1>/g)||[]).length===2,'fb2 two title headings');
  const book={title:r.title,author:r.author,language:r.lang,images:r.images,coverName:r.coverName,chapters:splitChapters(r.html,'auto')};
  ok(book.chapters.length===2,'fb2 split -> 2 chapters');
  const blob=await buildEpub(book);const buf=Buffer.from(await blob.arrayBuffer());fs.writeFileSync('sample-fb2.epub',buf);
  const zip=await JSZip.loadAsync(buf);
  ok(!!zip.file('OEBPS/images/cover.png'),'epub cover image embedded');
  ok(!!zip.file('OEBPS/cover.xhtml'),'epub cover page present');
  const opf=await zip.file('OEBPS/content.opf').async('string');
  ok(/properties="cover-image"/.test(opf),'opf cover-image property');
  ok(/<meta name="cover"/.test(opf),'opf epub2 cover meta');
  ok(/<dc:language>id<\/dc:language>/.test(opf),'opf language id');
  console.log('\nRESULT: '+p+' passed, '+f+' failed ('+buf.length+' bytes)');process.exit(f?1:0);
})().catch(e=>{console.error(e);process.exit(2)});
