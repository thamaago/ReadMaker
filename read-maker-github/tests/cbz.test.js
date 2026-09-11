const fs=require('fs');const {JSDOM}=require('jsdom');const JSZip=require('jszip');
const dom=new JSDOM('<!DOCTYPE html><body></body>',{url:'https://localhost/'});
global.window=dom.window;global.document=dom.window.document;global.DOMParser=dom.window.DOMParser;global.XMLSerializer=dom.window.XMLSerializer;global.JSZip=JSZip;global.crypto={randomUUID:()=>'77777777-8888-4999-8aaa-bbbbbbbbbbbb'};global.atob=s=>Buffer.from(s,'base64').toString('binary');global.btoa=s=>Buffer.from(s,'binary').toString('base64');global.Image=class{};global.URL={createObjectURL:()=>'',revokeObjectURL(){}};global.Blob=dom.window.Blob;
global.t=(k)=>k; // i18n stub
// DOM stubs so app top-level wiring doesn't crash
const fake=()=>({addEventListener(){},classList:{add(){},remove(){}},style:{},textContent:'',value:'',appendChild(){},click(){},files:[],querySelectorAll:()=>[],setAttribute(){},getAttribute:()=>'' , innerHTML:''});
const vals={einkSize:'480x800',einkLevels:'4',einkDither:'fs',einkOn:'on',split:'auto',title:'',author:'',lang:'en'};
global.document.getElementById=(id)=>{ const e=fake(); if(id in vals) e.value=vals[id]; return e; };
const _add=global.document.addEventListener; global.document.addEventListener=()=>{};

const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const app=[...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map(x=>x[1]).pop();
(0,eval)(app.replace(/^\s*["']use strict["'];\s*/,''));

let p=0,f=0;const ok=(c,m)=>{c?(p++,console.log('  ok  ',m)):(f++,console.log('  FAIL',m));};
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC','base64');

(async()=>{
  const z=new JSZip();
  z.file('comic/10.jpg',png); z.file('comic/2.jpg',png); z.file('comic/1.jpg',png);
  z.file('comic/notes.txt','ignore'); z.file('__MACOSX/comic/._1.jpg',png);
  const cbz=await z.generateAsync({type:'nodebuffer'});
  const ab=cbz.buffer.slice(cbz.byteOffset,cbz.byteOffset+cbz.byteLength);
  const r=await cbzToBook(ab);
  ok(r.comic===true,'cbz -> comic book');
  ok(r.pages.length===3,'cbz: 3 pages (txt & __MACOSX filtered) ('+r.pages.length+')');
  ok(r.pages[0]==='page_0000.jpg'&&r.pages[2]==='page_0002.jpg','cbz: natural sort 1,2,10 sequential names');

  const chapters=r.pages.map((nm,i)=>({title:'Page '+(i+1),html:'<div><img src="images/'+nm+'"/></div>'}));
  const book={title:'My Comic',author:'',language:'en',images:r.images,coverName:'',comic:true,chapters};
  const blob=await buildEpub(book);const buf=Buffer.from(await blob.arrayBuffer());fs.writeFileSync('sample-cbz.epub',buf);
  const zip=await JSZip.loadAsync(buf);
  const opf=await zip.file('OEBPS/content.opf').async('string');
  ok((opf.match(/<itemref/g)||[]).length===3,'epub: 3 spine items (one per page)');
  ok(!!zip.file('OEBPS/images/page_0000.jpg'),'epub: page image embedded');
  const c1=await zip.file('OEBPS/chap001.xhtml').async('string');
  ok(/<img src="images\/page_0000\.jpg"/.test(c1),'epub: chapter shows page image');
  ok(!new window.DOMParser().parseFromString(c1,'application/xhtml+xml').querySelector('parsererror'),'comic chapter XHTML valid');

  // image-rename remap fix (real processBookImages, stubbed processImageBytes)
  processImageBytes=async()=>({u8:new Uint8Array([1,2,3]),mime:'image/png',w:10,h:16});
  const book2={images:[{name:'p.jpg',mime:'image/jpeg',b64:btoa('x')}],coverName:'p.jpg',chapters:[{title:'A',html:'<div><img src="images/p.jpg"/></div>'}]};
  const ni=await processBookImages(book2);
  ok(ni[0].name==='p.png','remap: image renamed .jpg -> .png');
  ok(book2.coverName==='p.png','remap: coverName updated');
  ok(/images\/p\.png/.test(book2.chapters[0].html)&&!/p\.jpg/.test(book2.chapters[0].html),'remap: chapter reference rewritten (latent bug fixed)');

  console.log('\nRESULT: '+p+' passed, '+f+' failed ('+buf.length+' bytes)');process.exit(f?1:0);
})().catch(e=>{console.error(e);process.exit(2)});
