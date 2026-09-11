const fs=require('fs');const {JSDOM}=require('jsdom');const JSZip=require('jszip');
const dom=new JSDOM('<!DOCTYPE html><body></body>');
global.window=dom.window;global.document=dom.window.document;global.DOMParser=dom.window.DOMParser;global.XMLSerializer=dom.window.XMLSerializer;global.JSZip=JSZip;global.crypto={randomUUID:()=>'99999999-8888-4777-8666-555555555555'};global.atob=s=>Buffer.from(s,'base64').toString('binary');global.btoa=s=>Buffer.from(s,'binary').toString('base64');
let core=[...fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8').matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map(x=>x[1]).pop();
core=core.slice(0,core.indexOf('/* ============================ orchestration')).replace(/^\s*["']use strict["'];\s*/,'');(0,eval)(core);
let p=0,f=0;const ok=(c,m)=>{c?(p++):(f++,0);console.log((c?'  ok  ':'  FAIL')+' '+m);};

const html='<h1>Part One</h1><p>a</p>'+
           '<h2>Chapter A</h2><p>b</p>'+
           '<h2>Chapter B</h2><p>c</p>'+
           '<h1>Part Two</h1><p>d</p>'+
           '<h2>Chapter C</h2><p>e</p>';
const ch=splitChapters(html,'h1h2');
ok(ch.length===5,'5 chapters ('+ch.length+')');
ok(ch.map(c=>c.level).join(',')==='1,2,2,1,2','levels recorded: '+ch.map(c=>c.level).join(','));

(async()=>{
  const book={title:'T',author:'A',language:'en',images:[],coverName:'',chapters:ch};
  const blob=await buildEpub(book);
  const buf=Buffer.from(await blob.arrayBuffer());
  const zip=await JSZip.loadAsync(buf);
  const nav=await zip.file('OEBPS/nav.xhtml').async('string');
  const ncx=await zip.file('OEBPS/toc.ncx').async('string');

  // nav.xhtml must nest sub-chapters inside their parent <li>
  ok(/<li><a href="chap001\.xhtml">Part One<\/a><ol><li><a href="chap002\.xhtml">Chapter A/.test(nav),'nav nests H2 under H1');
  ok((nav.match(/<ol>/g)||[]).length===3,'nav has outer list + 2 nested lists ('+((nav.match(/<ol>/g)||[]).length)+')');
  ok(!new window.DOMParser().parseFromString(nav,'application/xhtml+xml').querySelector('parsererror'),'nav.xhtml well-formed');

  // toc.ncx must nest navPoints and keep playOrder unique/increasing
  ok(/<navPoint[^>]*>(?:(?!<\/navPoint>)[\s\S])*?<navPoint/.test(ncx),'ncx nests navPoints');
  const orders=[...ncx.matchAll(/playOrder="(\d+)"/g)].map(m=>+m[1]);
  ok(orders.length===5 && orders.every((v,i)=>i===0||v>orders[i-1]),'playOrder unique and increasing: '+orders.join(','));
  ok(/dtb:depth" content="2"/.test(ncx),'ncx depth reflects nesting');
  ok(!new window.DOMParser().parseFromString(ncx,'application/xml').querySelector('parsererror'),'toc.ncx valid XML');

  // flat books stay flat (no regression)
  const flat=splitChapters('<h1>One</h1><p>a</p><h1>Two</h1><p>b</p>','h1');
  const b2=await buildEpub({title:'T',author:'',language:'en',images:[],coverName:'',chapters:flat});
  const z2=await JSZip.loadAsync(Buffer.from(await b2.arrayBuffer()));
  const nav2=await z2.file('OEBPS/nav.xhtml').async('string');
  ok((nav2.match(/<ol>/g)||[]).length===1,'flat book keeps a single flat list');
  ok(/dtb:depth" content="1"/.test(await z2.file('OEBPS/toc.ncx').async('string')),'flat book depth=1');

  console.log('\nRESULT: '+p+' passed, '+f+' failed');process.exit(f?1:0);
})().catch(e=>{console.error(e);process.exit(2)});
