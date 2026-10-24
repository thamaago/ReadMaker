// Manual Edge acceptance: real helper bundles, lossless HTML export and mixed-size PDF.
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('node:assert/strict'),crypto=require('crypto'),JSZip=require('jszip');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output/epub/review-fixes');fs.mkdirSync(out,{recursive:true});
const runtime=process.env.READMAKER_RUNTIME_MODULES,{chromium}=runtime?require(path.join(runtime,'playwright')):require('playwright');
const names=['index.html','pdf-review.js','device-compatibility.js','responsive.css','jszip.min.js'],assets=new Map(names.map(n=>[n,fs.readFileSync(path.join(root,n))]));
const server=http.createServer((req,res)=>{const name=req.url.slice(1)||'index.html';if(!assets.has(name)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',name.endsWith('.js')?'application/javascript':name.endsWith('.css')?'text/css':'text/html');res.end(assets.get(name));});
function mixedPdf(){
 const streams=['0 0 0 RG 2 w 10 10 780 380 re S BT /F1 20 Tf 30 30 Td (BOTTOM LANDSCAPE) Tj ET','0 0 0 RG 2 w 10 10 380 780 re S BT /F1 20 Tf 30 30 Td (BOTTOM PORTRAIT) Tj ET'];
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 800 400] /Resources << /Font << /F1 7 0 R >> >> /Contents 4 0 R >>','<< /Length '+streams[0].length+' >>\nstream\n'+streams[0]+'\nendstream','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 800] /Resources << /Font << /F1 7 0 R >> >> /Contents 6 0 R >>','<< /Length '+streams[1].length+' >>\nstream\n'+streams[1]+'\nendstream','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
 let pdf='%PDF-1.4\n',offsets=[0];objects.forEach((obj,i)=>{offsets.push(Buffer.byteLength(pdf));pdf+=(i+1)+' 0 obj\n'+obj+'\nendobj\n';});const xref=Buffer.byteLength(pdf);pdf+='xref\n0 8\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size 8 /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF';return Buffer.from(pdf);
}
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_BIN||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 const errors=[],checks=[];
 try{
  const page=await browser.newPage({acceptDownloads:true,viewport:{width:1200,height:900}});page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));
  for(const [url,file] of [['https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js','pdf'],['https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.1.0/tesseract.min.js','ocr'],['https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js','qr']])await page.route(url,route=>route.fulfill({status:200,headers:{'content-type':'application/javascript','access-control-allow-origin':'*'},body:fs.readFileSync(path.join(root,'tmp/review-fixes/cdn',file+'.js'))}));
  await page.goto('http://127.0.0.1:'+server.address().port+'/');
  const helpers=await page.evaluate(async()=>{await Promise.all([loadPdfjs(),loadTesseract(),loadJsQr()]);return {pdf:typeof pdfjsLib.getDocument,ocr:typeof Tesseract.createWorker,qr:typeof jsQR,loaders:[...document.querySelectorAll('script[integrity]')].map(s=>({src:s.src,integrity:s.integrity}))};});
  assert.equal(helpers.pdf,'function');assert.equal(helpers.ocr,'function');assert.equal(helpers.qr,'function');assert.equal(helpers.loaders.length,3);checks.push('three real helper bundles loaded through browser SRI checks; worker/recognition excluded here');
  const blocked=await browser.newPage(),qrUrl='https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
  await blocked.route(qrUrl,route=>route.fulfill({status:200,headers:{'content-type':'application/javascript','access-control-allow-origin':'*'},body:Buffer.concat([fs.readFileSync(path.join(root,'tmp/review-fixes/cdn/qr.js')),Buffer.from(';window.__modifiedHelperExecuted=true;')])}));
  await blocked.goto('http://127.0.0.1:'+server.address().port+'/');
  const rejected=await blocked.evaluate(async()=>{try{await loadJsQr();return {rejected:false};}catch(_){return {rejected:true,executed:window.__modifiedHelperExecuted===true};}});
  assert.deepEqual(rejected,{rejected:true,executed:false});await blocked.close();checks.push('modified QR helper is blocked by browser SRI without executing the added code');
  await page.locator('details:has(#outputPreset) > summary').click();await page.selectOption('#outputPreset','universal');
  const png=fs.readFileSync(path.join(__dirname,'fixtures/validation-diagram.png')).toString('base64');
  const html='<html lang="id"><head><title>Lossless review</title><meta name="author" content="QA"/></head><body><a id="start"></a><h1>Body</h1><p>'+'Readable. '.repeat(26000)+'</p>FREE TEXT<img src="data:image/png;base64,'+png+'" alt="Diagram"/><p><a href="#note">Read note</a></p><h1>Notes</h1><p id="note">well-known &amp; self-esteem <a href="#start">Back</a></p></body></html>';
  await page.setInputFiles('#file',{name:'lossless.html',mimeType:'text/html',buffer:Buffer.from(html)});await page.waitForFunction(()=>!!parsed&&!document.getElementById('build').disabled);
  await page.click('#previewBtn');await page.fill('#previewChapter','2');await page.locator('#previewChapter').dispatchEvent('change');assert.match(await page.locator('#preview').innerText(),/self-esteem/);
  const title=page.locator('input[data-chapter-title="1"]');await title.fill('Edited notes');await title.press('Tab');assert.equal(await title.inputValue(),'Edited notes');checks.push('chapter 2 preview and keyboard title editing');
  async function exportBook(name){const pending=page.waitForEvent('download');await page.click('#build');const download=await pending;const file=path.join(out,name+'.epub');await download.saveAs(file);return JSZip.loadAsync(fs.readFileSync(file),{checkCRC32:true});}
  const zip=await exportBook('lossless-notes'),all=(await Promise.all(zip.file(/chap\d+\.xhtml$/).map(f=>f.async('string')))).join('');
  await page.locator('#qualityPanel').waitFor({state:'visible'});
  for(const width of [360,480,1366]){await page.setViewportSize({width,height:1000});await page.locator('#qualityPanel').evaluate(node=>node.open=true);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  const reportDownload=page.waitForEvent('download');await page.click('#qualityDownload');const reportFile=await reportDownload;await reportFile.saveAs(path.join(out,'downloaded-quality.json'));
  const quality=JSON.parse(fs.readFileSync(path.join(out,'downloaded-quality.json'),'utf8'));assert.equal(quality.engine.version,'1.0.0');assert.equal(quality.status,'passed');assert.equal(quality.checks.textAndEmphasis,true);assert.equal(quality.metrics.imageReferences,1);assert.ok(quality.notAssessed.includes('ocr-accuracy'));assert.ok(await page.evaluate(()=>lastBuiltName.endsWith('.epub')));
  assert.equal((all.match(/Readable\./g)||[]).length,26000);assert.match(all,/FREE TEXT/);assert.equal((all.match(/<img /g)||[]).length,1);assert.match(all,/href="chap\d+\.xhtml#note"/);assert.match(all,/xml:lang="id"/);checks.push('real UI EPUB preserves 26000 phrases, standalone image, free text, note/back links and document language');
  await page.selectOption('#outputPreset','layout');await page.setInputFiles('#file',{name:'mixed.pdf',mimeType:'application/pdf',buffer:mixedPdf()});await page.waitForFunction(()=>!!parsed&&parsed.pdfMode==='fixed'&&!document.getElementById('build').disabled);
  const pdfZip=await exportBook('mixed-pages'),dimensions=[];
  for(let i=1;i<=2;i++){
   const number=String(i).padStart(3,'0'),chapter=await pdfZip.file('OEBPS/chap'+number+'.xhtml').async('string');const width=i===1?1200:600,height=i===1?600:1200;assert.match(chapter,new RegExp('width='+width+',height='+height));
   const b64=await pdfZip.file('OEBPS/images/pdf_page_'+String(i).padStart(4,'0')+'.png').async('base64');
   const decoded=await page.evaluate(async b64=>{const img=new Image();img.src='data:image/png;base64,'+b64;await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);const pixels=ctx.getImageData(0,c.height-100,c.width,100).data;let ink=0;for(let n=0;n<pixels.length;n+=4)if(pixels[n]<128)ink++;return {width:img.width,height:img.height,bottomInk:ink};},b64);
   assert.equal(decoded.width,width);assert.equal(decoded.height,height);assert.ok(decoded.bottomInk>100);dimensions.push(decoded);
  }
  checks.push('actual PDF.js renders mixed landscape/portrait pages; e-ink detail preserves both native dimensions and bottom content');assert.deepEqual(errors,[]);
  await page.setInputFiles('#file',{name:'broken-link.html',mimeType:'text/html',buffer:Buffer.from('<h1>Broken link</h1><p><a href="#absent">Missing note</a></p>')});await page.waitForFunction(()=>!!parsed&&!document.getElementById('build').disabled);
  let unexpectedDownloads=0;const countDownload=()=>unexpectedDownloads++;page.on('download',countDownload);await page.click('#build');await page.waitForFunction(()=>!document.getElementById('build').disabled&&document.getElementById('status').classList.contains('err'));assert.equal(unexpectedDownloads,0);assert.equal(await page.evaluate(()=>lastQualityReport.status),'blocked');assert.equal(await page.evaluate(()=>lastBuiltBlob),null);page.off('download',countDownload);
  checks.push('native report export, mobile quality panel, and a broken internal link blocking the actual download');
  const report={date:new Date().toISOString(),sourceAssets:Object.fromEntries([...assets].map(([n,b])=>[n,crypto.createHash('sha256').update(b).digest('hex')])),checks,helpers,dimensions,errors,hardware:'not tested'};fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
