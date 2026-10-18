// Manual comparison: node tests/performance-browser.cjs path/to/baseline.html
// Same Edge process, bundled JSZip, deterministic inputs; not a competitor benchmark.
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('node:assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),baseline=process.argv[2];
if(!baseline)throw new Error('Pass a saved baseline index.html');
const runtime=process.env.READMAKER_RUNTIME_MODULES,{chromium}=runtime?require(path.join(runtime,'playwright')):require('playwright');
const JSZip=require('jszip'),out=path.join(root,'output/performance');fs.mkdirSync(out,{recursive:true});
const sources={baseline:fs.readFileSync(baseline),final:fs.readFileSync(path.join(root,'index.html'))};
const png=fs.readFileSync(path.join(__dirname,'fixtures/validation-diagram.png')).toString('base64');
const server=http.createServer((req,res)=>{
 const name=req.url.slice(1);const bytes=name==='baseline'||name==='final'?sources[name]:['jszip.min.js','pdf-review.js','responsive.css','device-compatibility.js'].includes(name)?fs.readFileSync(path.join(root,name)):null;
 if(!bytes){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',name==='baseline'||name==='final'?'text/html':name.endsWith('.css')?'text/css':'application/javascript');res.end(bytes);
});
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_BIN||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 const results={},errors=[];
 try{
  for(const mode of ['baseline','final']){
   const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:'+server.address().port+'/'+mode);
   results[mode]=await page.evaluate(async({png,verify})=>{
    const metrics={};
    async function measure(name,fn){const samples=[];let value;for(let i=0;i<4;i++){const start=performance.now();value=await fn();const ms=performance.now()-start;if(i)samples.push(ms);}metrics[name]={samplesMs:samples,medianMs:samples.slice().sort((a,b)=>a-b)[1]};return value;}
    // A valid, incompressible PNG exercises every CRC byte, without network timing.
    const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=1024;const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(1024,1024);let seed=12345;
    for(let i=0;i<pixels.data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;pixels.data[i]=seed>>>24;}ctx.putImageData(pixels,0,0);
    const pngBytes=new Uint8Array(await(await new Promise(r=>canvas.toBlob(r,'image/png'))).arrayBuffer());
    await measure('png-integrity-4MiB',()=>checkWebPng(pngBytes));
    const pages=Array.from({length:400},()=>[]),entries=Array.from({length:80},(_,i)=>({title:'Chapter '+(i+1),page:i*5,level:1}));
    const source=Array.from({length:2000},(_,i)=>'<p data-rm-pages="'+(1+Math.floor(i/5))+'">Paragraph '+i+' — clean text &amp; punctuation.</p>').join('');
    const chapters=await measure('pdf-outline-400-pages',()=>chaptersFromPdfOutline(entries,pages,[],source));
    const archive=new JSZip();archive.file('word/document.xml','<p>Readable DOCX</p>'.repeat(600000));
    const input=await archive.generateAsync({type:'uint8array',compression:'DEFLATE'});
    const inflated=await measure('docx-preflight-12MiB',async()=>{const zip=await loadDocumentZip(input);return readDocumentEntry(zip.file('word/document.xml'),verify?'verify':'uint8array',undefined,{remaining:128*1024*1024});});
    const book={title:'Performance parity',author:'ReadMaker QA',language:'id',comic:true,images:[{name:'diagram.png',mime:'image/png',b64:png}],chapters:chapters.map(c=>({...c,html:c.html+'<p><img src="images/diagram.png" alt="Diagram jelas"/></p>'}))};
    await measure('epub-build-80-chapters',()=>buildEpub(book));
    const blob=await measure('pdf-outline-and-export-400-pages',()=>{
     const fresh=chaptersFromPdfOutline(entries,pages,[],source);
     return buildEpub({...book,chapters:fresh.map(c=>({...c,html:c.html+'<p><img src="images/diagram.png" alt="Diagram jelas"/></p>'}))});
    });
    const bytes=new Uint8Array(await blob.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
    return {metrics,pngBytes:pngBytes.length,docxInflatedBytes:typeof inflated==='number'?inflated:inflated.length,chapters,epub:btoa(binary)};
   },{png,verify:mode==='final'});
   await page.close();
  }
  assert.deepEqual(results.final.chapters,results.baseline.chapters,'PDF outline markup and page provenance');
  assert.equal(results.final.docxInflatedBytes,results.baseline.docxInflatedBytes);
  const packages={};
  for(const mode of ['baseline','final']){
   const bytes=Buffer.from(results[mode].epub,'base64');fs.writeFileSync(path.join(out,mode+'.epub'),bytes);results[mode].epubBytes=bytes.length;delete results[mode].epub;delete results[mode].chapters;
   const zip=await JSZip.loadAsync(bytes,{checkCRC32:true}),members={};
   for(const name of Object.keys(zip.files).sort())if(!zip.files[name].dir){let data=await zip.file(name).async('nodebuffer');if(/\.(?:opf|xhtml|ncx)$/.test(name))data=Buffer.from(data.toString().replace(/urn:uuid:[a-f0-9-]+/gi,'urn:uuid:TEST').replace(/(<meta property="dcterms:modified">)[^<]+/g,'$1TIME'));members[name]=hash(data);}
   packages[mode]=members;results[mode].sourceSha256=hash(sources[mode]);
  }
  assert.deepEqual(packages.final,packages.baseline,'Every unpacked EPUB resource must match (only UUID/modified time excluded)');assert.deepEqual(errors,[]);
  const report={environment:'Headless Edge, bundled JSZip 3.10.1; 1 warmup + 3 measured runs per phase',results,parity:{members:Object.keys(packages.final).length,allMemberHashesEqual:true,pageErrors:errors},comparison:{}};
  for(const name of Object.keys(results.baseline.metrics)){const before=results.baseline.metrics[name].medianMs,after=results.final.metrics[name].medianMs;report.comparison[name]={beforeMs:+before.toFixed(2),afterMs:+after.toFixed(2),reductionPercent:+((before-after)/before*100).toFixed(1)};}
  fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report.comparison,null,2));console.log('All '+report.parity.members+' unpacked resources match; EPUB sizes: '+results.baseline.epubBytes+' / '+results.final.epubBytes);
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
