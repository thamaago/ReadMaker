// Manual browser acceptance: actual PDF.js, canvas, review editing and download.
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('node:assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output/epub/pdf-review');fs.mkdirSync(out,{recursive:true});
const runtime=process.env.READMAKER_RUNTIME_MODULES;
const {chromium}=runtime?require(path.join(runtime,'playwright')):require('playwright');
const JSZip=require('jszip');
const names=['index.html','pdf-review.js','responsive.css','device-compatibility.js','jszip.min.js'];
const assets=new Map(names.map(name=>[name,fs.readFileSync(path.join(root,name))]));
const hashes=Object.fromEntries([...assets].map(([name,bytes])=>[name,crypto.createHash('sha256').update(bytes).digest('hex')]));
const server=http.createServer((req,res)=>{
 const name=req.url.split('?')[0].replace(/^\//,'')||'index.html';
 if(!assets.has(name)){res.writeHead(404);res.end();return;}
 res.writeHead(200,{'Content-Type':name.endsWith('.js')?'application/javascript':name.endsWith('.css')?'text/css':'text/html'});res.end(assets.get(name));
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_BIN||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 const errors=[],checks=[],layout=[];
 try{
  const page=await browser.newPage({acceptDownloads:true,viewport:{width:1440,height:1100}});page.setDefaultTimeout(120000);
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/');
  await page.locator('details:has(#outputPreset) > summary').click();
  await page.selectOption('#outputPreset','universal');
  await page.setInputFiles('#file',path.join(root,'output/pdf/stress-lab/ReadMaker-Complex-48.pdf'));
  await page.waitForFunction(()=>!!parsed&&!document.getElementById('build').disabled);
  assert.equal(await page.locator('#pdfReviewSource canvas').count(),0);checks.push('lazy source rendering');
  await page.click('#pdfReviewBtn');await page.locator('#pdfReviewSource canvas').waitFor();
  await page.fill('#pdfReviewPage','6');await page.locator('#pdfReviewPage').dispatchEvent('change');
  await page.locator('#pdfReviewSource canvas[aria-label$="6"]').waitFor();
  const originalImageCount=await page.evaluate(()=>currentBook().images.length);
  const first=page.locator('#pdfReviewFields textarea').first();
  await first.fill('Teks uji koreksi & <tag> tetap aman.');
  await page.click('#pdfReviewNext');assert.equal(await page.inputValue('#pdfReviewPage'),'6');
  await page.click('#pdfReviewSave');
  assert.ok(await page.evaluate(()=>currentBook().chapters.some(c=>c.html.includes('Teks uji koreksi &amp; &lt;tag&gt;'))));
  await page.locator('#pdfReviewOutput').scrollIntoViewIfNeeded();
  await page.locator('#pdfReviewOutput h2').filter({hasText:'Teks uji koreksi & <tag> tetap aman.'}).waitFor();
  assert.ok(await page.locator('#pdfReviewOutput img').count());
  assert.ok(await page.locator('#pdfReviewOutput img').evaluateAll(async images=>{
   await Promise.all(images.map(image=>image.decode()));return images.every(image=>image.naturalWidth>0);
  }));
  await page.selectOption('#pdfReviewZoom','2');await page.locator('#pdfReviewSource canvas[style*="200%"]').waitFor();
  await page.selectOption('#pdfReviewZoom','1');await page.locator('#pdfReviewSource canvas[style*="100%"]').waitFor();
  checks.push('literal correction saved; dirty navigation blocked');
  const snapshots=[];
  for(const width of [320,480,1024,1440]){
   await page.setViewportSize({width,height:1000});
   await page.locator('#pdfReviewOutput').scrollIntoViewIfNeeded();
   await page.locator('#pdfReviewOutput h2').filter({hasText:'Teks uji koreksi & <tag> tetap aman.'}).waitFor();
   const measurement=await page.evaluate(()=>({viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth}));
   if(measurement.scrollWidth>width)console.log(await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(el=>el.getBoundingClientRect().right>innerWidth).map(el=>({tag:el.tagName,id:el.id,class:el.className,right:el.getBoundingClientRect().right,width:el.getBoundingClientRect().width})).slice(0,25)));
   assert.ok(measurement.scrollWidth<=width,JSON.stringify(measurement));layout.push(measurement);
   if(width===320||width===1440){const name='pdf-review-'+width+'.png';await page.locator('#pdfReviewPanel').screenshot({path:path.join(out,name)});snapshots.push(name);}
  }
  checks.push('responsive comparison at 320, 480, 1024 and 1440 pixels');
  await page.setViewportSize({width:1440,height:1000});
  await page.selectOption('#split','single');await page.selectOption('#split','auto');
  assert.ok(await page.evaluate(()=>currentBook().chapters.some(c=>c.html.includes('Teks uji koreksi'))));
  await page.selectOption('#outputPreset','layout');assert.equal(await page.inputValue('#outputPreset'),'universal');
  checks.push('corrections survive split changes and block destructive reparse');
  await page.selectOption('#deviceTarget','crosspoint');
  const pending=page.waitForEvent('download');await page.click('#build');const download=await pending;
  const target=path.join(out,'ReadMaker-X4-Pro-uji-koreksi.epub');await download.saveAs(target);
  const zip=await JSZip.loadAsync(fs.readFileSync(target)),chapters=[];
  for(const name of Object.keys(zip.files).filter(n=>/^OEBPS\/chap\d+\.xhtml$/.test(n)))chapters.push(await zip.file(name).async('string'));
  assert.match(chapters.join(''),/Teks uji koreksi &amp; &lt;tag&gt; tetap aman\./);assert.doesNotMatch(chapters.join(''),/data-rm-block|data-rm-pages/);
  assert.equal(Object.keys(zip.files).filter(n=>n.startsWith('OEBPS/images/')&&!zip.files[n].dir).length,originalImageCount);
  checks.push('download contains corrected literal text, intact image assets and no review attributes');
  await page.fill('#title','Updated title');assert.ok(await page.evaluate(()=>lastBuiltBlob===null));checks.push('metadata edits invalidate an old ready-to-send EPUB');
  await page.click('#pdfReviewReset');await page.click('#pdfReviewClose');
  await page.selectOption('#pdfMode','fixed');await page.waitForFunction(()=>parsed?.pdfMode==='fixed'&&!document.getElementById('build').disabled);
  assert.equal(await page.inputValue('#pdfMode'),'fixed');assert.equal(await page.inputValue('#outputPreset'),'custom');
  await page.click('#pdfReviewBtn');await page.locator('#pdfReviewSource canvas').waitFor();assert.equal(await page.locator('#pdfReviewFields textarea').count(),0);
  checks.push('manual fixed mode stays selected and cannot pretend to edit raster text');
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'browser-review-results.json'),JSON.stringify({assetSha256:hashes,checks,layout,errors,snapshots,hardware:'not tested; device not ready'},null,2));
  console.log(JSON.stringify({passed:checks.length,layout:layout.length,errors:errors.length,output:target}));
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
