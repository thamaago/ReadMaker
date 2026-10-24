// Real-browser smoke for the auxiliary exporters repaired by the five-pass audit.
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('node:assert/strict'),crypto=require('crypto'),JSZip=require('jszip');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output/security/2026-10-25/auxiliary');fs.mkdirSync(out,{recursive:true});
const runtime=process.env.READMAKER_RUNTIME_MODULES,{chromium}=runtime?require(path.join(runtime,'playwright')):require('playwright');
const names=['index.html','jszip.min.js','pdf-review.js','device-compatibility.js','responsive.css'],assets=new Map(names.map(name=>[name,fs.readFileSync(path.join(root,name))]));
const server=http.createServer((req,res)=>{const name=req.url.slice(1)||'index.html';if(!assets.has(name)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',name.endsWith('.js')?'application/javascript':name.endsWith('.css')?'text/css':'text/html');res.end(assets.get(name));});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try{
  const page=await browser.newPage({acceptDownloads:true}),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('http://127.0.0.1:'+server.address().port+'/');
  await page.locator('details').evaluateAll(nodes=>nodes.forEach(node=>node.open=true));
  await page.selectOption('#einkSize','480x800');await page.selectOption('#einkLevels','2');
  let pending=page.waitForEvent('download');await page.setInputFiles('#sleepFile',path.join(__dirname,'fixtures/validation-diagram.png'));let download=await pending;assert.equal(download.suggestedFilename(),'sleep.bmp');const bmpPath=path.join(out,'sleep.bmp');await download.saveAs(bmpPath);const bmp=fs.readFileSync(bmpPath);assert.equal(bmp.readInt32LE(18),480);assert.equal(bmp.readInt32LE(22),-800);assert.equal(bmp.readUInt16LE(28),8);
  const used=[...new Set(bmp.subarray(bmp.readUInt32LE(10)))];assert.deepEqual(used.sort((a,b)=>a-b),[0,1]);
  assert.deepEqual([...bmp.subarray(54,57)],[0,0,0]);assert.deepEqual([...bmp.subarray(58,61)],[255,255,255]);
  await page.waitForFunction(()=>lastBuiltName==='sleep.bmp');assert.equal(await page.locator('#deviceCard').isVisible(),true);
  pending=page.waitForEvent('download');await page.setInputFiles('#dictFile',{name:'sample.tsv',mimeType:'text/plain',buffer:Buffer.from('cat\tkucing\ndog\tanjing\ncat\tmeong')});download=await pending;const dictPath=path.join(out,'dictionary.zip');await download.saveAs(dictPath);const zip=await JSZip.loadAsync(fs.readFileSync(dictPath),{checkCRC32:true});const ifo=await zip.file(/\.ifo$/)[0].async('string');assert.match(ifo,/wordcount=2/);await page.waitForFunction(()=>!activeConversionJob);assert.equal(await page.evaluate(()=>lastBuiltBlob),null);
  const rejected=await page.evaluate(async()=>{let read=false;try{await makeSleepScreen({size:129*1024*1024,arrayBuffer:async()=>{read=true;return new ArrayBuffer(0);}},false);return false;}catch(error){return !read&&/128 MB/.test(error.message);}});assert.equal(rejected,true);
  assert.deepEqual(errors,[]);const report={date:new Date().toISOString(),sourceAssets:Object.fromEntries([...assets].map(([name,bytes])=>[name,crypto.createHash('sha256').update(bytes).digest('hex')])),checks:['actual wallpaper upload downloads a 480x800 monochrome BMP','actual dictionary upload merges duplicate entries and downloads valid StarDict ZIP','dictionary ZIP is not offered as a device-ready book','oversized wallpaper is rejected before reading'],errors,hardware:'not tested'};fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
