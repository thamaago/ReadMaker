// Manual browser benchmark with real PDF.js, OCR, canvas and the download UI.
// First run tests/generate-complex-pdf.py. Requires Playwright and Edge/Chrome.
const fs=require('fs'),path=require('path'),http=require('http'),crypto=require('crypto');
const root=path.resolve(__dirname,'..');
const runtime=process.env.READMAKER_RUNTIME_MODULES;
const {chromium}=runtime?require(path.join(runtime,'playwright')):require('playwright');
const out=path.join(root,'output/epub/stress-lab');fs.mkdirSync(out,{recursive:true});
const pdfDir=path.join(root,'output/pdf/stress-lab');
const mime={'.html':'text/html','.js':'application/javascript','.json':'application/json','.pdf':'application/pdf','.css':'text/css','.png':'image/png'};
const results=[],errors=[],failedRequests=[];
const appSnapshot=fs.readFileSync(path.join(root,'index.html'));
const appSha256=crypto.createHash('sha256').update(appSnapshot).digest('hex');
const server=http.createServer((req,res)=>{
 const relative=decodeURIComponent(req.url.split('?')[0]);
 const file=path.resolve(root,'.'+(relative==='/'?'/index.html':relative));
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
 res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});
 if(file===path.join(root,'index.html'))res.end(appSnapshot);else fs.createReadStream(file).pipe(res);
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_BIN||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 const context=await browser.newContext({acceptDownloads:true,viewport:{width:1440,height:1000}});
 let ticker;
 try{
  const page=await context.newPage();page.setDefaultTimeout(180000);
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('requestfailed',r=>failedRequests.push({url:r.url(),error:r.failure()?.errorText}));
  ticker=setInterval(async()=>{try{console.log(JSON.stringify({progress:await page.locator('#status').textContent()}));}catch{}},15000);
  for(const test of [
   {key:'complex-reflow',file:'ReadMaker-Complex-48.pdf',preset:'text',ocr:'on'},
   {key:'complex-layout',file:'ReadMaker-Complex-48.pdf',preset:'layout',ocr:'off'},
   {key:'volume-reflow',file:'ReadMaker-Volume-1200.pdf',preset:'text',ocr:'off'},
   {key:'semantic-reference',file:'ReadMaker-Complex-acuan.html',preset:'universal',ocr:'off'}
  ]){
   const started=Date.now();console.log(JSON.stringify({start:test.key}));
   await page.goto('http://127.0.0.1:'+server.address().port+'/');
   await page.waitForFunction(()=>typeof handle==='function'&&typeof JSZip==='function');
   await page.evaluate(test=>{
    document.getElementById('outputPreset').value=test.preset;
    document.getElementById('outputPreset').dispatchEvent(new Event('change',{bubbles:true}));
    document.getElementById('ocrOn').value=test.ocr;document.getElementById('ocrLang').value='ind+eng';
   },test);
   await page.setInputFiles('#file',path.join(pdfDir,test.file));
   await page.waitForFunction(()=>!!parsed&&!document.getElementById('build').disabled||document.getElementById('status').classList.contains('err'),null,{timeout:600000});
   const ingestion=await page.evaluate(()=>({ready:!!parsed,sourcePages:parsed?.sourcePageCount||null,mode:parsed?.pdfMode||'html',images:parsed?.images?.length||0,chapters:parsed?currentBook().chapters.length:0,status:document.getElementById('status').textContent,analysis:parsed?.pdfAnalysis,heapMB:performance.memory?Math.round(performance.memory.usedJSHeapSize/1048576):null}));
   if(!ingestion.ready){results.push({...test,...ingestion,failed:true});continue;}
   const ingestMs=Date.now()-started;
   await page.screenshot({path:path.join(out,test.key+'-app.png')});
   const pending=page.waitForEvent('download',{timeout:180000});
   await page.click('#build');
   const download=await pending;const target=path.join(out,test.key+'.epub');await download.saveAs(target);
   const logs=await page.locator('#log').textContent();fs.writeFileSync(path.join(out,test.key+'-process.log'),logs);
   const actual=await page.evaluate(()=>({options:{preset:document.getElementById('outputPreset').value,ocr:document.getElementById('ocrOn').value,ocrLang:document.getElementById('ocrLang').value,pdfMode:document.getElementById('pdfMode').value,pdfQuality:document.getElementById('pdfQuality').value},status:document.getElementById('status').textContent}));
   const result={...test,...ingestion,...actual,ingestMs,totalMs:Date.now()-started,bytes:fs.statSync(target).size,output:target};results.push(result);console.log(JSON.stringify({completed:result}));
   fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify({appSha256,results,errors,failedRequests},null,2));
  }
 }finally{clearInterval(ticker);await browser.close();await new Promise(r=>server.close(r));fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify({appSha256,results,errors,failedRequests},null,2));}
 if(results.some(r=>r.failed))process.exitCode=1;
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
