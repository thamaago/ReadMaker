const fs=require('fs');const {JSDOM}=require('jsdom');
const dom=new JSDOM('<!DOCTYPE html><body></body>',{url:'https://localhost/'});
global.window=dom.window;global.document=dom.window.document;global.DOMParser=dom.window.DOMParser;global.XMLSerializer=dom.window.XMLSerializer;
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
let core=[...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map(x=>x[1]).pop();
core=core.slice(0,core.indexOf('/* ============================ orchestration')).replace(/^\s*["']use strict["'];\s*/,'');
(0,eval)(core);

let p=0,f=0;const ok=(c,m)=>{c?(p++,console.log('  ok  ',m)):(f++,console.log('  FAIL',m));};
const I=(str,x,y,w,h)=>({str,x,y,w,h});
const dropCap=pdfItemsToHtml([[I('Mthat they were perfectly normal, thank you very much.',0,100,300,30),I('Mr. Dursley was the director of a firm.',0,70,220,12)]]);
ok(!/^<h1>/i.test(dropCap),'pdf: prose-like drop cap line is not promoted to heading');

// Page 0
const page0=[
  I("The Great Book",100,800,200,24),          // title -> h1
  I("This is the opening sentence that",72,760,260,12),
  I("continues on the next line.",72,744,200,12),
  I("A second paragraph starts here",90,710,240,12), // indented -> new para
  I("1",300,40,8,10)                             // page number (last) -> dropped
];
// Page 1
const page1=[
  I("and finishes the thought.",72,800,190,12),  // continues para2 (prev ended 'here')
  I("Chapter Two",72,760,120,18),                // heading h2
  I("An ordinary sentence about beauti-",72,740,260,12),
  I("ful mornings and coffee.",72,724,190,12)     // de-hyphenate -> beautiful
];
const out=pdfItemsToHtml([page0,page1]);
//console.log(out);
ok(/<h1>The Great Book<\/h1>/.test(out),'title -> h1');
ok(/<p>This is the opening sentence that continues on the next line\.<\/p>/.test(out),'para wrap join');
ok(/A second paragraph starts here and finishes the thought\./.test(out),'indent new para + cross-page continue');
ok(/<h2>Chapter Two<\/h2>/.test(out),'mid-doc heading -> h2');
ok(/beautiful mornings and coffee\./.test(out),'de-hyphenation across lines');
ok(!/>1<\/p>|<p>1<\/p>/.test(out),'page number dropped');

// space insertion within a line from split items
const line=[I("Hello",72,500,30,12), I("World",110,500,32,12)];
const out2=pdfItemsToHtml([line]);
ok(/Hello World/.test(out2),'intra-line space inserted from x-gap');

// scanned / empty
ok(pdfItemsToHtml([[],[]])==='','empty pages -> empty html (scanned guard)');

// heading size buckets (needs body baseline present)
const mix=[I("HUGE TITLE",72,700,200,30), I("regular body text here",72,670,180,12), I("more body text follows",72,654,180,12)];
ok(/<h1>HUGE TITLE<\/h1>/.test(pdfItemsToHtml([mix])),'very large vs body -> h1');

// integrate into pipeline
const book={title:'T',author:'A',language:'en',images:[],coverName:'',chapters:splitChapters(promoteHeadings(out),'h1h2')};
ok(book.chapters.length===2,'h1h2 split -> title + Chapter Two ('+book.chapters.length+')');

console.log('\nRESULT: '+p+' passed, '+f+' failed');process.exit(f?1:0);
