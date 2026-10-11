const fs=require('fs');const {JSDOM,VirtualConsole}=require('jsdom');
const JSZip=require('jszip');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const dom=new JSDOM('<!DOCTYPE html><body><div id="status"></div><pre id="log"></pre></body>');
global.window=dom.window;global.document=dom.window.document;global.DOMParser=dom.window.DOMParser;global.XMLSerializer=dom.window.XMLSerializer;
global.JSZip=JSZip;global.t=k=>k==='ocrLowConfidence'?'Hasil OCR halaman {n} berkeyakinan rendah; tinjau kembali teksnya.':k;
let core=[...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map(x=>x[1]).pop();
core=core.slice(0,core.indexOf('/* ============================ orchestration')).replace(/^\s*["']use strict["'];\s*/,'');(0,eval)(core);
let p=0,f=0;const ok=(c,m)=>{c?(p++):(f++,0);console.log((c?'  ok  ':'  FAIL')+' '+m);};

// --- pure OCR text assembly ---
const page1=['CHAPTER ONE','','It was a bright cold day in April,','and the clocks were striking','thirteen.','','12'].join('\n');
const page2=['Winston Smith slipped quickly','through the glass doors of Victory','Mansions, though not quickly enough','to escape the gritty dust.','','13'].join('\n');
const out=ocrTextToHtml([page1,page2]);
ok(/<h1>CHAPTER ONE<\/h1>/.test(out),'chapter marker promoted to heading');
ok(/It was a bright cold day in April, and the clocks were striking thirteen\./.test(out),'wrapped lines merged into one paragraph');
ok(!/<p>12<\/p>|<p>13<\/p>/.test(out),'page numbers dropped');
ok(/Winston Smith slipped quickly through the glass doors/.test(out),'second page assembled');
ok((out.match(/<p>/g)||[]).length===2,'two paragraphs total ('+((out.match(/<p>/g)||[]).length)+')');

// de-hyphenation across OCR lines
const hy=ocrTextToHtml(['the beauti-','ful morning came'].join('\n'));
ok(/beautiful morning came/.test(hy),'hyphenated word rejoined');

const mapped=ocrResultToPdfItems({width:500,height:750,scale:2.5,data:{lines:[
  {text:'First line',bbox:{x0:20,y0:50,x1:180,y1:80},confidence:96},
  {text:'Second line',bbox:{x0:20,y0:90,x1:200,y1:120},confidence:92}
]}});
ok(mapped.length===2 && mapped[0].str==='First line','structured OCR lines become positioned PDF text items');
ok(mapped[0].x===8 && mapped[0].y===268 && mapped[0].h===12,'OCR boxes scale into PDF page coordinates');
ok(mapped[0].confidence===96,'line confidence is retained for diagnostics');

// blank input
ok(ocrTextToHtml([])==='','empty OCR yields empty html');
ok(ocrTextToHtml(['   ','\n'])==='','whitespace-only OCR yields empty html');

// language codes
ok(ocrLangCode('ind')==='ind' && ocrLangCode('eng')==='eng' && ocrLangCode('ind+eng')==='ind+eng','language codes mapped');
ok(ocrLangCode('zz')==='eng','unknown language falls back to English');

async function testMixedPdfOcr(){
  document.getElementById('status').textContent=''; document.getElementById('log').textContent='';
  document.body.insertAdjacentHTML('beforeend','<select id="ocrOn"><option value="on" selected>On</option></select><select id="ocrLang"><option value="eng" selected>English</option></select>');
  let recognized=0, terminated=0;
  window.Tesseract={createWorker:async function(language){
    ok(language==='eng','OCR worker receives the selected language');
    return {recognize:async function(canvas){
      recognized++;
      ok(canvas.width===500 && canvas.height===750,'OCR raster is rendered at 2.5x');
      return {data:{text:'CHAPTER ONE\\nScanned page text is readable.',confidence:95,lines:[
        {text:'CHAPTER ONE',bbox:{x0:100,y0:100,x1:240,y1:130},confidence:42},
        {text:'Scanned page text is readable.',bbox:{x0:80,y0:180,x1:420,y1:210},confidence:48}
      ]}};
    },terminate:async function(){terminated++;}};
  }};
  const page=(number)=>({
    getViewport:({scale})=>({width:200*scale,height:300*scale}),
    getTextContent:async()=>({items:number===1?[{str:'Selectable text from digital page.',transform:[1,0,0,12,72,260],width:180,height:12}]:[]}),
    getOperatorList:async()=>({fnArray:number===2?[1]:[],argsArray:number===2?[['scan']]:[]}),
    objs:{get:(key,callback)=>callback({width:800,height:1200})},
    render:()=>({promise:Promise.resolve()})
  });
  window.pdfjsLib={
    OPS:{paintImageXObject:1,paintJpegXObject:2,paintImageMaskXObject:3},
    getDocument:()=>({promise:Promise.resolve({
      numPages:2,getMetadata:async()=>({info:{}}),getPage:async n=>page(n),getOutline:async()=>[]
    })})
  };
  const createElement=document.createElement.bind(document);
  document.createElement=function(name){
    if(name.toLowerCase()==='canvas') return {width:0,height:0,getContext:()=>({fillRect(){},drawImage(){}}),toBlob:callback=>callback(new Blob([Buffer.from([1,2,3])],{type:'image/png'}))};
    return createElement(name);
  };
  try{
    const book=await pdfToBook(new ArrayBuffer(0),'reflow');
    ok(recognized===1,'only the page without a text layer is sent to OCR');
    ok(terminated===1,'OCR worker is always terminated after scanning');
    ok(/Selectable text from digital page\./.test(book.html),'selectable PDF text stays in reading order');
    ok(/Scanned page text is readable\./.test(book.html),'OCR text is merged into the same reflow HTML');
    ok(/<h1>CHAPTER ONE<\/h1>/.test(book.html),'OCR chapter heading is retained for ordinary EPUB navigation');
    ok(book.images.length===0,'full-page scan bitmap is not duplicated beside recognised text');
    ok(/Hasil OCR halaman 2 berkeyakinan rendah/.test(document.getElementById('log').textContent),'low-confidence pages get an actionable warning');
    const epubBlob=await buildEpub({title:'Mixed Scan Test',author:'QA',language:'en',images:[],chapters:splitChapters(book.html,'single')});
    const epub=await JSZip.loadAsync(Buffer.from(await epubBlob.arrayBuffer()));
    const chapter=await epub.file('OEBPS/chap001.xhtml').async('string');
    const nav=await epub.file('OEBPS/nav.xhtml').async('string');
    ok(/Scanned page text is readable\./.test(chapter),'OCR content is packaged in standard XHTML chapter');
    ok(/CHAPTER ONE/.test(nav),'OCR chapter heading appears in EPUB navigation');
  }finally{ document.createElement=createElement; }
}

// --- UI wiring ---
const d2=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:new VirtualConsole(),
  beforeParse(w){ w.JSZip=function(){}; if(!w.crypto)w.crypto={randomUUID:()=>'x'}; }});
testMixedPdfOcr().then(()=>new Promise(resolve=>setTimeout(resolve,80))).then(()=>{
  const doc=d2.window.document;
  ok(!!doc.getElementById('ocrOn'),'OCR toggle exists');
  ok(doc.getElementById('ocrOn').value==='off','OCR is off by default (opt-in)');
  ok(!!doc.getElementById('ocrLang'),'OCR language selector exists');
  ok(!!doc.querySelector('label[for="ocrOn"]'),'OCR toggle is labelled');
  ok(/Aktifkan OCR/.test(d2.window.eval("t('errScanned')")),'scanned-PDF error points at the OCR option');
  ok(/berkeyakinan rendah/.test(d2.window.eval("t('ocrLowConfidence')")),'OCR confidence warning is localised in Indonesian');
  d2.window.document.querySelector('.langtoggle button[data-lang="en"]').dispatchEvent(new d2.window.Event('click',{bubbles:true}));
  ok(/Turn on OCR/.test(d2.window.eval("t('errScanned')")),'error localised in English too');
  ok(/confidence is low/.test(d2.window.eval("t('ocrLowConfidence')")),'OCR confidence warning follows English toggle');
  console.log('\nRESULT: '+p+' passed, '+f+' failed');
  process.exit(f?1:0);
}).catch(err=>{ console.error(err); process.exitCode=1; });
