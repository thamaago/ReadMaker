const fs=require('fs');const {JSDOM}=require('jsdom');
const dom=new JSDOM('<!DOCTYPE html><body></body>',{url:'https://localhost/'});
global.window=dom.window;global.document=dom.window.document;global.DOMParser=dom.window.DOMParser;
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
let core=[...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map(x=>x[1]).pop();
core=core.slice(0,core.indexOf('/* ============================ orchestration')).replace(/^\s*["']use strict["'];\s*/,'');
(0,eval)(core);
let p=0,f=0;const ok=(c,m)=>{c?(p++,console.log('  ok  ',m)):(f++,console.log('  FAIL',m));};
const I=(str,x,y,w,h)=>({str,x,y,w,h});
const pages=[];
for(let pg=0;pg<5;pg++) pages.push([
  I("MY BOOK TITLE",72,820,150,11),
  I("Body paragraph number "+pg+" with enough text here.",72,780,260,12),
  I("More body content on this page appears here.",72,764,260,12),
  I(String(pg+1),300,40,8,10)
]);
const out=pdfItemsToHtml(pages);
ok(!/MY BOOK TITLE/.test(out),'running header removed across pages');
ok(!/>1<\/p>|<p>1<\/p>/.test(out),'page numbers removed');
ok(/Body paragraph number 0/.test(out)&&/Body paragraph number 4/.test(out),'body text retained');
const pages2=[[I("Unique Chapter",72,800,150,18),I("body text one two three here.",72,770,220,12)],
             [I("body continues onward here now.",72,800,220,12)]];
ok(/Unique Chapter/.test(pdfItemsToHtml(pages2)),'non-repeating heading kept');
console.log('\nRESULT: '+p+' passed, '+f+' failed');process.exit(f?1:0);
