// Manual real-browser acceptance, with controlled cross-origin image servers.
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('node:assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output/epub/web-resources');fs.mkdirSync(out,{recursive:true});
const runtime=process.env.READMAKER_RUNTIME_MODULES,{chromium}=runtime?require(path.join(runtime,'playwright')):require('playwright');
const JSZip=require('jszip'),assetNames=['index.html','pdf-review.js','responsive.css','device-compatibility.js','jszip.min.js'];
const assets=new Map(assetNames.map(n=>[n,fs.readFileSync(path.join(root,n))]));
const png=fs.readFileSync(path.join(__dirname,'fixtures/validation-diagram.png'));let webp,requests=[];
const images=http.createServer((req,res)=>{
 requests.push(req.url);
 if(!req.url.startsWith('/blocked'))res.setHeader('Access-Control-Allow-Origin','*');
 if(req.url==='/truncated.png'){res.end(png.subarray(0,8));return;}
 if(req.url==='/fake.jpg'){res.end(Buffer.concat([Buffer.from([255,216,255]),Buffer.alloc(64)]));return;}
 res.setHeader('Content-Type',req.url.startsWith('/colour')?'image/webp':'image/png');res.end(req.url.startsWith('/colour')?webp:png);
});
const server=http.createServer((req,res)=>{
 const name=req.url.split('?')[0].slice(1)||'index.html';
 if(!assets.has(name)){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',name.endsWith('.js')?'application/javascript':name.endsWith('.css')?'text/css':'text/html');res.end(assets.get(name));
});
(async()=>{
 await Promise.all([new Promise(r=>server.listen(0,'127.0.0.1',r)),new Promise(r=>images.listen(0,'127.0.0.1',r))]);
 const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_BIN||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 const checks=[],errors=[],layouts=[];
 try{
  const page=await browser.newPage({viewport:{width:1366,height:1000},acceptDownloads:true});page.setDefaultTimeout(30000);
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/');
  webp=Buffer.from(await page.evaluate(()=>{const c=document.createElement('canvas');c.width=240;c.height=160;const x=c.getContext('2d');x.fillStyle='#0044cc';x.fillRect(0,0,240,160);x.fillStyle='white';x.font='20px sans-serif';x.fillText('READABLE 012345',10,50);return c.toDataURL('image/webp').split(',')[1];}),'base64');
  const imageBase='http://127.0.0.1:'+images.address().port;
  await page.locator('details:has(#pasteHtml) > summary').click();
  const ingest=async html=>{await page.fill('#pasteUrl',imageBase+'/article');await page.fill('#pasteHtml',html);await page.click('#pasteBtn');};
  await ingest('<html lang="en"><head><title>Offline illustrated article</title><meta name="author" content="ReadMaker QA"/></head><body><article><h1>Offline illustrated article</h1><p>Readable offline text and diagrams.</p><img src="'+imageBase+'/diagram.png?token=test" alt="Diagram"/><img src="'+imageBase+'/diagram.png?token=test" alt="Same diagram"/><img src="'+imageBase+'/colour.webp" alt="Colour text"/></article></body></html>');
  await page.locator('details:has(#outputPreset) > summary').click();
  await page.selectOption('#outputPreset','universal');
  for(const width of [360,480,1366]){
   await page.setViewportSize({width,height:1000});
   const layout=await page.evaluate(()=>({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,control:document.getElementById('webImages').getBoundingClientRect().width}));
   assert.equal(layout.overflow,false);assert.ok(layout.control>100);layouts.push(layout);
  }
  async function exportBook(name){const pending=page.waitForEvent('download');await page.click('#build');const download=await pending;const target=path.join(out,name+'.epub');await download.saveAs(target);return JSZip.loadAsync(fs.readFileSync(target));}
  let zip=await exportBook('article-source');
  assert.equal(zip.file(/OEBPS\/chap\d+\.xhtml$/).length,1,'opening title is not duplicated into an extra chapter');
  let manifests=await zip.file('OEBPS/content.opf').async('string');assert.equal((manifests.match(/media-type="image\/png"/g)||[]).length,2);
  assert.equal(requests.filter(url=>url==='/diagram.png?token=test').length,1);assert.equal(requests.filter(url=>url==='/colour.webp').length,1);
  const colour=await zip.file('OEBPS/images/web_0002.png').async('base64');
  const colourPixels=await page.evaluate(async b64=>{const img=new Image();img.src='data:image/png;base64,'+b64;await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const x=c.getContext('2d');x.drawImage(img,0,0);return {width:img.width,height:img.height,pixel:[...x.getImageData(0,0,1,1).data]};},colour);
  assert.equal(colourPixels.width,240);assert.equal(colourPixels.height,160);assert.notEqual(colourPixels.pixel[0],colourPixels.pixel[2]);
  checks.push('cross-origin fetch with CORS; query retained; duplicate URLs embedded once; WebP converted to full-colour PNG at original dimensions');
  await page.selectOption('#einkOn','on');zip=await exportBook('article-eink');
  const imageFiles=zip.file(/OEBPS\/images\/[^/]+$/);assert.equal(imageFiles.length,2);
  const encoded=await Promise.all(imageFiles.map(f=>f.async('base64')));
  const decoded=await page.evaluate(async all=>{
   const values=[];for(const b64 of all){const img=new Image();img.src='data:image/png;base64,'+b64;await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const x=c.getContext('2d');x.drawImage(img,0,0);const data=x.getImageData(0,0,c.width,c.height).data;let gray=true;for(let i=0;i<data.length;i+=4)if(data[i]!==data[i+1]||data[i]!==data[i+2])gray=false;values.push({width:img.width,height:img.height,gray});}return values;
  },encoded);
  assert.ok(decoded.every(im=>im.gray&&im.width>0));checks.push('downloaded images pass actual browser decoding and selected e-ink processing');
  await ingest('<html><head><title>Blocked image</title></head><body><article><h1>Blocked image</h1><p>Text remains available.</p><img src="'+imageBase+'/blocked.png"/></article></body></html>');
  await page.click('#build');await page.waitForFunction(()=>!document.getElementById('build').disabled);
  assert.ok(await page.evaluate(()=>lastBuiltBlob===null));assert.match(await page.locator('#status').innerText(),/Teks saja|Text only/);
  const before=requests.length;await page.selectOption('#webImages','omit');zip=await exportBook('article-text-only');assert.equal(requests.length,before);
  const text=(await Promise.all(zip.file(/chap\d+\.xhtml$/).map(f=>f.async('string')))).join('');assert.match(text,/Text remains available/);assert.doesNotMatch(text,/<img/);
  checks.push('real CORS failure blocks export; explicit text-only retry makes a self-contained EPUB without another image request');
  for(const file of ['truncated.png','fake.jpg']){
   const error=await page.evaluate(async url=>{
    try{await prepareBookResources({images:[],chapters:[{html:'<p>Text</p><img src="'+url+'"/>'}]});return null;}
    catch(error){return error.message;}
   },imageBase+'/'+file);
   assert.match(error,/tidak didukung|not supported/);
  }
  checks.push('signature-only PNG and JPEG with invalid pixel data are rejected, including with image processing disabled');
  assert.deepEqual(errors,[]);
  const result={date:new Date().toISOString(),assetSha256:Object.fromEntries([...assets].map(([n,b])=>[n,crypto.createHash('sha256').update(b).digest('hex')])),checks,layouts,decoded,colourPixels,requests,errors,hardware:'not tested; device not ready'};
  fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{await browser.close();await Promise.all([new Promise(r=>server.close(r)),new Promise(r=>images.close(r))]);}
})().catch(error=>{console.error(error);server.close();images.close();process.exitCode=1;});
