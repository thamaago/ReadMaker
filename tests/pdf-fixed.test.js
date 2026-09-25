const assert=require('node:assert/strict'),fs=require('fs'),{JSDOM,VirtualConsole}=require('jsdom'),JSZip=require('jszip');
const dom=new JSDOM(fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8'),{runScripts:'dangerously',url:'http://localhost',virtualConsole:new VirtualConsole(),beforeParse(w){
  w.JSZip=JSZip;
  w.HTMLCanvasElement.prototype.getContext=function(){return {fillStyle:'',fillRect(){}};};
  w.HTMLCanvasElement.prototype.toBlob=function(cb){cb(new w.Blob([new Uint8Array([1,2,3])],{type:'image/png'}));};
}});
const w=dom.window,d=w.document;
w.pdfjsLib={getDocument:()=>({promise:Promise.resolve({
  numPages:2,
  getMetadata:async()=>({info:{Title:'Fixed PDF',Author:'Author'}}),
  getPage:async()=>({getViewport:()=>({width:600,height:800}),render:async()=>({promise:Promise.resolve()})})
})})};
(async()=>{
  const book=await w.pdfToBook(new ArrayBuffer(1),'fixed');
  assert.equal(book.pdfMode,'fixed');
  assert.equal(book.chapters.length,2);
  assert.equal(book.images.length,2);
  const epub=await w.buildEpub({title:book.title,author:book.author,language:'en',pdfMode:'fixed',fixedViewport:book.fixedViewport,images:book.images,chapters:book.chapters,cssProfile:'universal'});
  const zip=await JSZip.loadAsync(await epub.arrayBuffer());
  const opf=await zip.file('OEBPS/content.opf').async('string');
  const ch=await zip.file('OEBPS/chap001.xhtml').async('string');
  assert.match(opf,/rendition:layout/);
  assert.match(opf,/pre-paginated/);
  assert.match(opf,/rendition:viewport">width=600,height=800/);
  assert.match(opf,/itemref idref="chap1" properties="rendition:layout-pre-paginated"/);
  assert.match(ch,/name="viewport"/);
  assert.match(ch,/content="width=600,height=800"/);
  assert.match(ch,/style="margin:0;padding:0"/);
  assert.match(ch,/style="display:block;width:100%;height:auto"/);
  assert.match(await zip.file('OEBPS/style.css').async('string'),/html,body\{margin:0;padding:0;background:#fff/);
  assert.ok(zip.file('OEBPS/images/pdf_page_0001.png'));
  d.getElementById('einkOn').value='on';
  d.getElementById('pdfQuality').value='source';
  const sourceViewport=w.selectedFixedViewport({width:771,height:1182});
  assert.equal(sourceViewport.width,771); assert.equal(sourceViewport.height,1182);
  assert.equal(w.shouldProcessBookImages({pdfMode:'fixed',images:[{}]}),false);
  d.getElementById('pdfQuality').value='eink';
  const einkViewport=w.selectedFixedViewport({width:771,height:1182});
  assert.equal(einkViewport.width,480); assert.equal(einkViewport.height,800);
  assert.equal(w.shouldProcessBookImages({pdfMode:'fixed',images:[{}]}),true);
  d.getElementById('pdfQuality').value='eink-detail';
  const detailViewport=w.selectedFixedViewport({width:771,height:1182});
  assert.equal(detailViewport.width,771); assert.equal(detailViewport.height,1182);
  const detailOpts=w.einkOpts({pdfMode:'fixed',fixedViewport:detailViewport});
  assert.equal(detailOpts.maxW,771); assert.equal(detailOpts.maxH,1182);
  console.log('PDF fixed-layout mode: passed');
})().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)}).finally(()=>w.close());
