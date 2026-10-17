// Real-browser acceptance for untrusted documents and the pinned DOCX helper.
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('node:assert/strict'),crypto=require('crypto'),JSZip=require('jszip');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output/security/2026-10-18');fs.mkdirSync(out,{recursive:true});
const runtime=process.env.READMAKER_RUNTIME_MODULES,{chromium}=runtime?require(path.join(runtime,'playwright')):require('playwright');
const names=['index.html','pdf-review.js','responsive.css','device-compatibility.js','jszip.min.js'],assets=new Map(names.map(n=>[n,fs.readFileSync(path.join(root,n))]));
const png=fs.readFileSync(path.join(__dirname,'fixtures/validation-diagram.png'));
const server=http.createServer((req,res)=>{const name=req.url.slice(1).split('?')[0]||'index.html';if(!assets.has(name)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',name.endsWith('.js')?'application/javascript':name.endsWith('.css')?'text/css':'text/html');res.end(assets.get(name));});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_BIN||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 const checks=[],errors=[];let trackerRequests=0,mammothRequests=0;
 try{
  const page=await browser.newPage({acceptDownloads:true,viewport:{width:1200,height:900}});page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(30000);
  await page.route('https://tracker.invalid/**',route=>{trackerRequests++;return route.abort();});
  await page.route('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.11.0/mammoth.browser.min.js',route=>{mammothRequests++;return route.fulfill({status:200,headers:{'content-type':'application/javascript','access-control-allow-origin':'*'},body:fs.readFileSync(path.join(root,'tmp/security/mammoth-1.11.0.min.js'))});});
  await page.goto('http://127.0.0.1:'+server.address().port+'/');
  const bad='<FictionBook><body><section><p>Text</p><image href="#picture"/></section></body><binary id="picture" content-type="image/png&quot; onerror=&quot;window.__securityExecuted=1">AAAA</binary></FictionBook>';
  await page.setInputFiles('#file',{name:'untrusted.fb2',mimeType:'application/xml',buffer:Buffer.from(bad)});
  await page.waitForFunction(()=>document.getElementById('status').classList.contains('err'));
  assert.match(await page.locator('#status').innerText(),/tidak aman|unsafe/);assert.equal(await page.evaluate(()=>window.__securityExecuted),undefined);
  checks.push('FB2 metadata injection is rejected through the real file-input flow');
  await page.evaluate(b64=>{finishIngest({html:'<h1>Readable</h1><p onclick="window.__securityExecuted=1">Safe text</p><img src="images/a.png" onerror="window.__securityExecuted=1"/><img src="https://tracker.invalid/pixel"/><iframe src="https://tracker.invalid/frame"></iframe><svg onload="window.__securityExecuted=1"></svg>',images:[{name:'a.png',mime:'image/png',b64}]},'Preview test');},png.toString('base64'));
  await page.click('#previewBtn');
  const preview=page.locator('#preview');assert.equal(await preview.locator('[onclick],[onerror],svg,iframe,script').count(),0);
  assert.equal(await preview.locator('img[src^="http"]').count(),0);
  assert.ok(await preview.locator('img').evaluate(async img=>{await img.decode();img.dispatchEvent(new Event('error'));return img.naturalWidth>0;}));
  assert.equal(await page.evaluate(()=>window.__securityExecuted),undefined);assert.equal(trackerRequests,0);
  checks.push('inert preview preserves a readable raster image while blocking events, active elements and remote image requests');
  const zip=new JSZip();zip.file('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('_rels/.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/document.xml','<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Readable DOCX content using the patched converter.</w:t></w:r></w:p></w:body></w:document>');
  await page.setInputFiles('#file',{name:'patched-helper.docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',buffer:await zip.generateAsync({type:'nodebuffer'})});
  await page.waitForFunction(()=>parsed&&parsed.html.includes('Readable DOCX content')&&!document.getElementById('build').disabled);
  assert.equal(mammothRequests,1);
  const script=await page.locator('script[src*="mammoth/1.11.0"]').evaluate(s=>({integrity:s.integrity,crossOrigin:s.crossOrigin}));
  assert.match(script.integrity,/^sha384-/);assert.equal(script.crossOrigin,'anonymous');
  const pending=page.waitForEvent('download');await page.click('#build');const download=await pending;
  const file=path.join(out,'patched-docx.epub');await download.saveAs(file);
  const epub=await JSZip.loadAsync(fs.readFileSync(file));assert.match(await epub.file('OEBPS/chap001.xhtml').async('string'),/Readable DOCX content/);
  checks.push('Mammoth 1.11.0 browser bundle passes SRI and converts a real DOCX to a downloadable EPUB');
  assert.deepEqual(errors,[]);
  const result={date:new Date().toISOString(),assetSha256:Object.fromEntries([...assets].map(([n,b])=>[n,crypto.createHash('sha256').update(b).digest('hex')])),checks,trackerRequests,mammothRequests,errors,scope:'Controlled local documents and browser; not a certification or hardware test'};
  fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
