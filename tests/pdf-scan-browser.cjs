// Manual acceptance using an all-scan PDF supplied locally; no source content is logged or committed.
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const runtime=process.env.READMAKER_RUNTIME_MODULES;
const {chromium}=runtime?require(path.join(runtime,'playwright')):require('playwright');
if(!process.argv[2])throw new Error('Usage: node tests/pdf-scan-browser.cjs <local-scan.pdf>');
const JSZip=require(path.join(root,'tests/node_modules/jszip'));
const assets=new Map(['index.html','pdf-review.js','responsive.css','device-compatibility.js','jszip.min.js'].map(n=>[n,fs.readFileSync(path.join(root,n))]));
const server=http.createServer((req,res)=>{const n=req.url.split('?')[0].slice(1)||'index.html';if(!assets.has(n)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',n.endsWith('.js')?'text/javascript':n.endsWith('.css')?'text/css':'text/html');res.end(assets.get(n));});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_BIN||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try{
  const page=await browser.newPage({acceptDownloads:true});page.setDefaultTimeout(180000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/');
  await page.locator('details:has(#outputPreset) > summary').click();
  await page.selectOption('#outputPreset','universal');
  console.log('Loading local scan PDF with real PDF.js and canvas; source content is not logged.');
  await page.setInputFiles('#file',process.argv[2]);
  await page.waitForFunction(()=>!!parsed&&!document.getElementById('build').disabled);
  const loaded=await page.evaluate(()=>({mode:parsed.pdfMode,pages:parsed.sourcePageCount,chapters:currentBook().chapters.length,images:parsed.images.length,scanPages:parsed.pdfAnalysis.scanPages,autoLayout:parsed.pdfAnalysis.autoScanLayout,width:parsed.fixedViewport.width,height:parsed.fixedViewport.height}));
  assert.equal(loaded.mode,'fixed');assert.ok(loaded.pages>0);assert.equal(loaded.scanPages,loaded.pages);assert.equal(loaded.chapters,loaded.pages);assert.equal(loaded.images,loaded.pages);assert.equal(loaded.autoLayout,true);
  await page.fill('#title','Local scan validation');await page.fill('#author','');
  console.log(JSON.stringify({loaded}));
  const downloadPromise=page.waitForEvent('download');await page.click('#build');const download=await downloadPromise;
  const bytes=fs.readFileSync(await download.path()),zip=await JSZip.loadAsync(bytes);
  const images=Object.keys(zip.files).filter(n=>/^OEBPS\/images\/pdf_page_\d+\.png$/.test(n));
  const opf=await zip.file('OEBPS/content.opf').async('string');assert.equal(images.length,loaded.pages);assert.match(opf,/pre-paginated/);
  const report=await page.evaluate(()=>({status:lastQualityReport.status,issues:lastQualityReport.issues.length,sourcePages:lastQualityReport.metrics.sourcePages}));
  assert.equal(report.status,'passed');assert.deepEqual(errors,[]);
  console.log(JSON.stringify({exportBytes:bytes.length,imagePages:images.length,report,browserErrors:errors.length}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>server.close());
