const fs=require('fs');
const path=require('path');
const {JSDOM}=require('jsdom');
const JSZip=require('jszip');

const dom=new JSDOM('<!DOCTYPE html><body></body>',{url:'https://localhost/'});
global.window=dom.window;
global.document=dom.window.document;
global.DOMParser=dom.window.DOMParser;
global.XMLSerializer=dom.window.XMLSerializer;
global.JSZip=JSZip;
global.TextEncoder=require('util').TextEncoder;
global.crypto={randomUUID:()=>'77777777-8888-4999-8aaa-bbbbbbbbbbbb'};
global.atob=s=>Buffer.from(s,'base64').toString('binary');
global.btoa=s=>Buffer.from(s,'binary').toString('base64');
global.Blob=dom.window.Blob;
global.Image=class{};
global.URL={createObjectURL:()=>'',revokeObjectURL(){}};
global.t=k=>k;

const fake=()=>({addEventListener(){},classList:{add(){},remove(){},toggle(){}},style:{},textContent:'',value:'',appendChild(){},click(){},files:[],querySelectorAll:()=>[],setAttribute(){},getAttribute:()=>'',innerHTML:'',disabled:false});
const values={einkSize:'480x800',einkLevels:'4',einkDither:'fs',einkOn:'on',split:'auto',title:'',author:'',lang:'en'};
document.getElementById=id=>{const e=fake();if(id in values)e.value=values[id];return e;};
document.addEventListener=()=>{};

const source=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const app=[...source.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map(x=>x[1]).pop();
(0,eval)(app.replace(/^\s*["']use strict["'];\s*/,''));

let passed=0,failed=0;
function ok(condition,message){
  if(condition){passed++;console.log('  ok   '+message);}
  else {failed++;console.log('  FAIL '+message);}
}
function bytesFrom(b64){return Buffer.from(b64,'base64');}
const png=bytesFrom('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC');

function chapterBook(parsed,count){
  const images=[]; const chapters=[];
  for(let i=0;i<count;i++){
    const name='page_'+String(i).padStart(4,'0')+'.png';
    images.push({name,mime:'image/png',b64:png.toString('base64')});
    chapters.push({title:'Page '+(i+1),html:'<div><img src="images/'+name+'" alt="page '+(i+1)+'"/></div>'});
  }
  return {title:'Stress Comic',author:'ReadMaker QA',language:'en',images,coverName:'',comic:true,chapters};
}

(async()=>{
  // 1. Archive ingestion: ordering, format filtering, and chapter folders.
  const z=new JSZip();
  z.file('00-cover.png',Buffer.from([0]));
  z.file('Vol 2/Chapter 10/10.webp',Buffer.from([5]));
  z.file('Vol 2/Chapter 2/10.jpg',Buffer.from([4]));
  z.file('Vol 2/Chapter 2/2.png',Buffer.from([3]));
  z.file('Vol 2/Chapter 2/1.gif',Buffer.from([2]));
  z.file('Vol 2/Chapter 10/2.bmp',Buffer.from([1]));
  z.file('notes.txt','skip');
  z.file('__MACOSX/Vol 2/._10.jpg',png);
  z.file('Vol 2/Chapter 2/.DS_Store','skip');
  const archive=await z.generateAsync({type:'nodebuffer'});
  const ab=archive.buffer.slice(archive.byteOffset,archive.byteOffset+archive.byteLength);
  const parsed=await cbzToBook(ab);
  ok(parsed.comic===true,'CBZ is recognised as comic input');
  ok(parsed.pages.length===6,'junk files and macOS metadata are filtered ('+parsed.pages.length+' pages remain)');
  ok(parsed.images.length===6,'every supported comic image is preserved');
  ok(parsed.pageDirs[0]===''&&parsed.pageDirs[1]==='Vol 2/Chapter 2','root cover precedes chapter pages');
  ok(parsed.pageDirs[1]===parsed.pageDirs[2]&&parsed.pageDirs[2]===parsed.pageDirs[3],'pages in Chapter 2 stay contiguous');
  ok(parsed.pageDirs[4]==='Vol 2/Chapter 10'&&parsed.pageDirs[5]==='Vol 2/Chapter 10','Chapter 10 follows Chapter 2 by natural sort');
  ok(parsed.images.map(x=>Buffer.from(x.b64,'base64')[0]).join(',')==='0,2,3,4,1,5','numeric page names sort 1,2,10 within each folder');
  ok(parsed.images.map(x=>x.mime).join(',')==='image/png,image/gif,image/png,image/jpeg,image/bmp,image/webp','mixed image MIME types are detected');

  const grouped=comicChaptersFromDirs(parsed.pageDirs);
  ok(grouped.length===2,'only named folders become native chapters');
  ok(grouped[0].name==='Chapter 2'&&grouped[0].startPage===2&&grouped[0].endPage===4,'root cover is not exposed as synthetic #1 chapter');
  ok(grouped[1].name==='Chapter 10'&&grouped[1].startPage===5&&grouped[1].endPage===6,'chapter page ranges retain original page positions');

  // 2. Large EPUB: one XHTML spine entry per comic page and valid package XML.
  const large=chapterBook(parsed,120);
  const epub=await buildEpub(large);
  const epubBytes=Buffer.from(await epub.arrayBuffer());
  const ez=await JSZip.loadAsync(epubBytes);
  const opf=await ez.file('OEBPS/content.opf').async('string');
  const nav=await ez.file('OEBPS/nav.xhtml').async('string');
  ok((opf.match(/<itemref/g)||[]).length===120,'120-page comic creates 120 spine entries');
  ok((opf.match(/media-type="image\/png"/g)||[]).length===120,'all 120 page images are in the manifest');
  ok((nav.match(/<li>/g)||[]).length===120,'navigation lists every comic page');
  ok(!new DOMParser().parseFromString(opf,'application/xml').querySelector('parsererror'),'large EPUB package XML is valid');
  ok(!!ez.file('OEBPS/chap120.xhtml')&&!!ez.file('OEBPS/images/page_0119.png'),'last comic page is packaged and addressable');
  ok(epubBytes.length<200000,'120 tiny pages remain bounded in package size ('+epubBytes.length+' bytes)');

  // 3. Native XTC/XTCH: page table, binary image blocks, and folder chapters.
  function page(w,h,seed){
    const gray=new Uint8ClampedArray(w*h);
    for(let i=0;i<gray.length;i++) gray[i]=(i*17+seed*31)%256;
    return {gray,w,h};
  }
  const pages=Array.from({length:48},(_,i)=>page(48,80,i));
  const xtc=buildXtc(pages,{twoBit:false,title:'Stress Comic',author:'ReadMaker QA',chapters:grouped});
  const dv=new DataView(xtc.buffer,xtc.byteOffset,xtc.byteLength);
  const pageTable=Number(dv.getBigUint64(0x18,true));
  const chapterOffset=Number(dv.getBigUint64(0x30,true));
  ok(dv.getUint32(0,true)===0x00435458,'1-bit XTC magic is correct');
  ok(dv.getUint16(6,true)===48,'XTC page count is 48');
  ok(dv.getUint8(0x0B)===1&&chapterOffset===0x138,'XTC chapter flag and offset are set');
  ok(pageTable===0x138+grouped.length*96,'chapter table is directly before page table');
  ok(Number(dv.getBigUint64(pageTable,true))<xtc.length,'first page offset points inside XTC data');
  ok(dv.getUint32(Number(dv.getBigUint64(pageTable,true)),true)===0x00475458,'first 1-bit page has XTG header');
  const xtch=buildXtc(pages,{twoBit:true,title:'Stress Comic',author:'ReadMaker QA',chapters:grouped});
  const hd=new DataView(xtch.buffer,xtch.byteOffset,xtch.byteLength);
  const xtchTable=Number(hd.getBigUint64(0x18,true));
  ok(hd.getUint32(0,true)===0x48435458,'2-bit XTCH magic is correct');
  ok(hd.getUint32(Number(hd.getBigUint64(xtchTable,true)),true)===0x00485458,'first 2-bit page has XTH header');
  ok(xtch.length>xtc.length,'2-bit package carries more image data than 1-bit package');
  ok(xtc.length<1000000&&xtch.length<1000000,'48-page native packages remain bounded');

  // 4. Tone algorithms: deterministic output for each user-facing mode.
  const gradient=new Uint8ClampedArray(64); for(let i=0;i<64;i++) gradient[i]=i*4;
  const direct=gradient.slice(); quantize(direct,2);
  ok(new Set(direct).size<=2,'no-dither mode produces only target tones');
  const bayer=gradient.slice(); bayerDither(bayer,8,8,2);
  ok(new Set(bayer).size<=2,'Bayer mode stays within target tones');
  const fsd=gradient.slice(); floydSteinberg(fsd,8,8,2);
  ok(new Set(fsd).size<=2,'Floyd–Steinberg mode stays within target tones');
  ok(/imageToGrayPage\([^\n]*levels, dither\)/.test(source),'XTC image pipeline accepts selected dither mode');

  fs.writeFileSync(path.join(__dirname,'sample-comic-stress.epub'),epubBytes);
  console.log('\nRESULT: '+passed+' passed, '+failed+' failed; EPUB '+epubBytes.length+' bytes; XTC '+xtc.length+' bytes; XTCH '+xtch.length+' bytes');
  process.exit(failed?1:0);
})().catch(err=>{console.error(err);process.exit(2);});
