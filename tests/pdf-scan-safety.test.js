const assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const {JSDOM,VirtualConsole}=require('jsdom'),JSZip=require('jszip');
const png=fs.readFileSync(path.join(__dirname,'fixtures/validation-diagram.png'));
const canvases=[],renders=[];let bitmapRequests=0,destroyed=0,terminated=0,ocrEmpty=false;
const dom=new JSDOM(fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8'),{
  runScripts:'dangerously',url:'http://localhost/',virtualConsole:new VirtualConsole(),
  beforeParse(w){
    w.JSZip=JSZip;w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;
    w.HTMLCanvasElement.prototype.getContext=function(){
      assert.ok(this.width*this.height<=12000000&&this.width<=16384&&this.height<=16384,'canvas allocation remains within the existing budget');
      if(!canvases.includes(this))canvases.push(this);
      return {fillRect(){},drawImage(){}};
    };
    w.HTMLCanvasElement.prototype.toBlob=function(cb){cb(new w.Blob([png],{type:'image/png'}));};
  }
});
const w=dom.window,d=w.document;
function page(text='',width=368.64,height=538.8){return {
  getViewport:({scale})=>({width:width*scale,height:height*scale}),
  getTextContent:async()=>({items:text?[{str:text,transform:[1,0,0,12,30,height-40],width:180}]:[]}),
  getOperatorList:async()=>{bitmapRequests++;if(!text)throw new Error('Original 3072x4490 scan must not be extracted');return {fnArray:[],argsArray:[]};},
  render:({viewport})=>{renders.push(viewport);return {promise:Promise.resolve()};},cleanup(){}
};}
function install(pages){
  w.pdfjsLib={OPS:{},getDocument:()=>({promise:Promise.resolve({numPages:pages.length,getMetadata:async()=>({info:{}}),getPage:async n=>pages[n-1],getOutline:async()=>[],destroy:async()=>destroyed++})})};
}
function options(ocrOn='off'){
  return {signal:new w.AbortController().signal,options:{ocrOn,ocrLang:'eng'},check(){},retain(size){assert.ok(size>0);}};
}
w.Tesseract={createWorker:async()=>({
  recognize:async canvas=>({data:{confidence:99,lines:ocrEmpty?[]:[{text:'Recognised synthetic text.',confidence:99,bbox:{x0:20,y0:20,x1:200,y1:40}}]}}),
  terminate:async()=>terminated++
})};
(async()=>{
  await new Promise(r=>setTimeout(r,0));
  const huge=page('',10000,20000),bounded=w.safePdfViewport(huge,2.5);
  assert.ok(bounded.width*bounded.height<=12000000);assert.ok(bounded.scale<2.5);
  assert.ok(Math.abs(bounded.width/bounded.height-.5)<.001);
  const thin=w.safePdfViewport(page('',100000,10),2.5);assert.ok(thin.width<=16384&&thin.height>=1);
  for(const width of [0,-1,NaN,Infinity])assert.throws(()=>w.safePdfViewport(page('',width,100),1.5));
  assert.throws(()=>w.assertCanvasSize(3072,4490),'original bitmap guard is unchanged');

  install([page(),page(),page()]);
  const scan=await w.pdfToBook(new ArrayBuffer(1),'reflow',options());
  assert.equal(scan.pdfMode,'fixed');assert.equal(scan.chapters.length,3);assert.equal(scan.images.length,3);
  assert.equal(scan.analysis.autoScanLayout,true);assert.equal(bitmapRequests,0);
  assert.deepEqual(Array.from(scan.chapters,c=>c.sourcePages[0]),[1,2,3]);
  assert.ok(canvases.every(cv=>cv.width===0&&cv.height===0));
  w.renderPdfAnalysis(scan.analysis);assert.match(d.getElementById('pdfAnalysis').textContent,/OCR/);
  const zip=await JSZip.loadAsync(await (await w.buildEpub({...scan,title:'Synthetic scan',language:'en'})).arrayBuffer());
  assert.match(await zip.file('OEBPS/content.opf').async('string'),/pre-paginated/);
  assert.equal(Object.keys(zip.files).filter(n=>/^OEBPS\/images\/pdf_page_\d+\.png$/.test(n)).length,3);
  console.log('PASS all-scan PDF automatically preserves every page without extracting oversized source bitmaps');

  bitmapRequests=0;install([page(),page('Middle selectable sentence.'),page()]);
  const mixed=await w.pdfToBook(new ArrayBuffer(1),'reflow',options());
  assert.equal(mixed.pdfMode,undefined);assert.equal(mixed.images.length,2);assert.equal(bitmapRequests,1);
  assert.ok(mixed.html.indexOf('pdf_page_0001')<mixed.html.indexOf('Middle selectable'));
  assert.ok(mixed.html.indexOf('pdf_page_0003')>mixed.html.indexOf('Middle selectable'));
  assert.equal(mixed.pdfPageInfo[0].rasterFallback,true);assert.equal(mixed.pdfPageInfo[2].needsReview,true);
  let mixedReport;await w.buildEpub({...mixed,title:'Synthetic mixed',language:'en',chapters:[{title:'Body',html:mixed.html}]},undefined,report=>mixedReport=report);
  assert.equal(mixedReport.status,'review');
  assert.ok(mixedReport.issues.some(issue=>issue.code==='raster-page-review'));
  assert.deepEqual(Array.from(mixedReport.issues.find(issue=>issue.code==='raster-page-review').sourcePages),[1,3]);
  console.log('PASS mixed PDFs preserve textless pages in order and report raster fallback for review');

  bitmapRequests=0;install([huge]);
  const ocr=await w.pdfToBook(new ArrayBuffer(1),'reflow',options('on'));
  assert.match(ocr.html,/Recognised synthetic text/);assert.equal(ocr.images.length,0);assert.equal(bitmapRequests,0);
  assert.equal(terminated,1);assert.ok(renders.at(-1).width*renders.at(-1).height<=12000000);
  const direct=await w.pdfPagesToOcrText({numPages:1,getPage:async()=>huge},'eng',[0],options('on'));
  assert.ok(direct[0].scale<2.5);assert.equal(direct[0].scale,bounded.scale);
  const item=w.ocrResultToPdfItems(direct[0])[0];assert.ok(Math.abs(item.x-20/bounded.scale)<.001);
  console.log('PASS OCR bypasses original scan extraction and uses the actual bounded scale for text geometry');

  ocrEmpty=true;install([page('Digital page.'),page()]);
  const empty=await w.pdfToBook(new ArrayBuffer(1),'reflow',options('on'));
  assert.match(empty.html,/Digital page/);assert.match(empty.html,/pdf_page_0002/);
  assert.equal(empty.pdfPageInfo[1].needsReview,true);assert.equal(empty.analysis.rasterFallbackPages,1);
  console.log('PASS unrecognised OCR pages remain visible as page images instead of disappearing');

  install([huge]);const fixed=await w.pdfToBook(new ArrayBuffer(1),'fixed',options());
  assert.ok(fixed.fixedViewport.width*fixed.fixedViewport.height<=12000000);
  await assert.rejects(w.rasterizePdfPage(page(),1.5,{...options(),retain(){const e=new Error('Synthetic retained-data budget');e.name='ResourceLimitError';throw e;}}),/retained-data budget/);
  const failure=page();failure.render=()=>({promise:Promise.reject(new Error('Synthetic render failure'))});
  await assert.rejects(w.rasterizePdfPage(failure,1.5,options()),/Synthetic render failure/);
  assert.ok(canvases.every(cv=>cv.width===0&&cv.height===0));
  const controller=new w.AbortController();let resolveRender,cancelled=0;
  const pending=page();pending.render=()=>({promise:new Promise(r=>resolveRender=r),cancel(){cancelled++;resolveRender();}});
  const job={...options(),signal:controller.signal,check(){if(controller.signal.aborted){const error=new Error('Cancelled');error.name='AbortError';throw error;}}};
  const raster=w.rasterizePdfPage(pending,1.5,job);await new Promise(r=>setTimeout(r,0));controller.abort();
  await assert.rejects(raster,e=>e.name==='AbortError');assert.equal(cancelled,1);
  assert.ok(canvases.every(cv=>cv.width===0&&cv.height===0));assert.equal(destroyed,5);
  console.log('PASS huge fixed pages are scaled before allocation; render errors and cancellation release canvases');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>w.close());
