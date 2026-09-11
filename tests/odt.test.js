const fs=require('fs');const {JSDOM}=require('jsdom');const JSZip=require('jszip');
const dom=new JSDOM('<!DOCTYPE html><body></body>',{url:'https://localhost/'});
global.window=dom.window;global.document=dom.window.document;global.DOMParser=dom.window.DOMParser;global.XMLSerializer=dom.window.XMLSerializer;global.JSZip=JSZip;global.Blob=dom.window.Blob;global.crypto={randomUUID:()=>'44444444-5555-4666-8777-888888888888'};global.atob=s=>Buffer.from(s,'base64').toString('binary');global.btoa=s=>Buffer.from(s,'binary').toString('base64');global.URL=dom.window.URL;
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
let core=[...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map(x=>x[1]).pop();
core=core.slice(0,core.indexOf('/* ============================ orchestration')).replace(/^\s*["']use strict["'];\s*/,'');
(0,eval)(core);

(async()=>{
  let p=0,f=0;const ok=(c,m)=>{c?(p++,console.log('  ok  ',m)):(f++,console.log('  FAIL',m));};

  // slim CSS assertions
  const bookCss=(html.match(/const BOOK_CSS_BASE = `([\s\S]*?)`/)||[])[1]||'';ok(!/font-family|line-height|page-break|font-size|text-align/.test(bookCss),'slim CSS: dropped ignored props');
  ok(/text-indent:1\.2em/.test(bookCss)&&/blockquote\{margin/.test(bookCss),'slim CSS: kept honored props');

  // build a real ODT
  const content=`<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
 xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"
 xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"
 xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"
 xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0"
 xmlns:xlink="http://www.w3.org/1999/xlink">
 <office:automatic-styles>
  <style:style style:name="T1" style:family="text"><style:text-properties fo:font-weight="bold"/></style:style>
  <style:style style:name="T2" style:family="text"><style:text-properties fo:font-style="italic"/></style:style>
 </office:automatic-styles>
 <office:body><office:text>
  <text:h text:outline-level="1">Bab Pertama</text:h>
  <text:p>Ada teks <text:span text:style-name="T1">tebal</text:span> dan <text:span text:style-name="T2">miring</text:span> di sini.</text:p>
  <text:list><text:list-item><text:p>Butir satu</text:p></text:list-item><text:list-item><text:p>Butir dua</text:p></text:list-item></text:list>
  <text:p><draw:frame><draw:image xlink:href="Pictures/pic1.png"/></draw:frame></text:p>
  <text:h text:outline-level="1">Bab Kedua</text:h>
  <text:p>Akhir cerita.</text:p>
  <text:p></text:p>
 </office:text></office:body>
</office:document-content>`;
  const meta=`<?xml version="1.0" encoding="UTF-8"?>
<office:document-meta xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:dc="http://purl.org/dc/elements/1.1/">
<office:meta><dc:title>Kisah Uji</dc:title><dc:creator>Penulis Uji</dc:creator><dc:language>id-ID</dc:language></office:meta></office:document-meta>`;
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC','base64');
  const z=new JSZip();
  z.file('mimetype','application/vnd.oasis.opendocument.text');
  z.file('content.xml',content); z.file('meta.xml',meta); z.file('Pictures/pic1.png',png);
  const odtBuf=await z.generateAsync({type:'nodebuffer'});

  const r=await odtToBook(odtBuf.buffer.slice(odtBuf.byteOffset,odtBuf.byteOffset+odtBuf.byteLength));
  ok(r.title==='Kisah Uji','odt title from meta.xml');
  ok(r.author==='Penulis Uji','odt author');
  ok(r.lang==='id','odt lang id-ID -> id');
  ok((r.html.match(/<h1>/g)||[]).length===2,'odt: 2 outline-level headings ('+((r.html.match(/<h1>/g)||[]).length)+')');
  ok(/<strong>tebal<\/strong>/.test(r.html),'odt: bold span via style map');
  ok(/<em>miring<\/em>/.test(r.html),'odt: italic span via style map');
  ok(/<ul><li>Butir satu<\/li><li>Butir dua<\/li><\/ul>/.test(r.html),'odt: list converted');
  ok(r.images.length===1 && /<img src="images\/img_0\.png"/.test(r.html),'odt: embedded image extracted');
  ok(!/<p>\s*<\/p>/.test(r.html),'odt: empty paragraph skipped');

  const book={title:r.title,author:r.author,language:r.lang,images:r.images,coverName:r.coverName,chapters:splitChapters(r.html,'auto')};
  ok(book.chapters.length===2,'odt: split -> 2 chapters');
  const blob=await buildEpub(book);const buf=Buffer.from(await blob.arrayBuffer());fs.writeFileSync('sample-odt.epub',buf);
  const zip=await JSZip.loadAsync(buf);
  ok(!!zip.file('OEBPS/images/img_0.png'),'epub: odt image embedded');
  const css=await zip.file('OEBPS/style.css').async('string');
  ok(!/font-family|page-break/.test(css),'epub: slim CSS shipped');
  const c1=await zip.file('OEBPS/chap001.xhtml').async('string');
  ok(!new window.DOMParser().parseFromString(c1,'application/xhtml+xml').querySelector('parsererror'),'odt: chapter XHTML valid');

  console.log('\nRESULT: '+p+' passed, '+f+' failed ('+buf.length+' bytes)');process.exit(f?1:0);
})().catch(e=>{console.error(e);process.exit(2)});
