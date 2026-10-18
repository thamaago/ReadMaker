const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),{JSDOM,VirtualConsole}=require('jsdom'),JSZip=require('jszip');
const dom=new JSDOM(fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8'),{runScripts:'dangerously',url:'https://readmaker.example/',virtualConsole:new VirtualConsole(),beforeParse(w){w.JSZip=JSZip;}}),w=dom.window;
(async()=>{
 const png=fs.readFileSync(path.join(__dirname,'fixtures/validation-diagram.png'));
 w.checkWebPng(png);
 // A mutation anywhere inside a chunk must retain the same checksum rejection.
 for(const offset of [16,30,45,png.length-1]){const damaged=Buffer.from(png);damaged[offset]^=1;assert.throws(()=>w.checkWebPng(damaged));}
 const archive=new JSZip();archive.file('word/document.xml','<p>Clear text</p>'.repeat(5000));
 const zip=await JSZip.loadAsync(await archive.generateAsync({type:'uint8array',compression:'DEFLATE'})),file=zip.file('word/document.xml');
 const materialized=await w.readDocumentEntry(file,'uint8array'),budget={remaining:materialized.length};
 assert.equal(await w.readDocumentEntry(file,'verify',undefined,budget),materialized.length);assert.equal(budget.remaining,0);
 await assert.rejects(w.readDocumentEntry(file,'verify',undefined,{remaining:materialized.length-1}),/batas aman|safe limits/);
 await assert.rejects(w.readDocumentEntry(file,'verify',1000),/batas aman|safe limits/);
 // Cross-page blocks and front matter retain their previous overlap semantics.
 const source='<p data-rm-pages="1">Front</p><p data-rm-pages="2 3">Cross-page <em>text</em></p><p data-rm-pages="4">Last</p><p>No provenance</p>';
 const entries=[{title:'A',page:1,level:1},{title:'B',page:2,level:2},{title:'Duplicate',page:2,level:1}],pages=[[],[],[],[]];
 const chapters=w.chaptersFromPdfOutline(entries,pages,[],source);
 assert.equal(chapters.length,3);assert.match(chapters[0].html,/Front/);
 assert.match(chapters[1].html,/Cross-page <em>text<\/em>/);assert.match(chapters[2].html,/Cross-page <em>text<\/em>/);assert.match(chapters[2].html,/Last/);
 assert.ok(chapters.every(c=>!c.html.includes('No provenance')));
 assert.equal(chapters[1].sourcePages.join(','),'2');assert.equal(chapters[2].sourcePages.join(','),'3,4');
 console.log('Performance parity: CRC failures, bounded count-only inflation, and PDF block/page overlap preserved.');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>w.close());
