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
const inline=pdfItemsToHtml([[I('Text before image.',72,500,120,12)],[I('Next page.',72,500,100,12)]],[['p0.png'],['p1.png']]);
ok(/pdf-inline-image/.test(inline) && /images\/p0\.png/.test(inline) && /images\/p1\.png/.test(inline),'PDF images stay near source-page text');

// scanned / empty
ok(pdfItemsToHtml([[],[]])==='','empty pages -> empty html (scanned guard)');

// running headers may only appear on a subset of pages; they should not
// become repeated chapter headings in the reflowed EPUB
const headed=[];
for(let i=0;i<4;i++) headed.push([
  I('MARMUT MERAH JAMBU',72,800,180,14),
  I('Body paragraph '+(i+1)+' remains readable.',72,760,240,12),
  I('A |',72,730,40,18),
  I(String(i+1),300,40,8,10)
]);
const headedOut=pdfItemsToHtml(headed);
ok(!/MARMUT MERAH JAMBU/.test(headedOut),'repeated edge header removed from reflow');
ok(!/>A \|<\/h[1-3]>/.test(headedOut),'fragment heading noise removed');
ok((headedOut.match(/Body paragraph/g)||[]).length===4,'body text preserved after edge cleanup');

const meta=pdfMetadataFallback([
  [I('MARMUT',0,100,50,12),I('MERAH JAMBU',60,100,80,12)],
  [I('Penulis:',0,100,50,12),I('Raditya Dika',60,100,80,12)]
]);
ok(meta.title==='Marmut Merah Jambu','PDF title fallback from title page');
ok(meta.author==='Raditya Dika','PDF author fallback from labelled metadata');

const complex=pdfAnalyzeLayout(headed,4,4);
ok(complex.recommendedMode==='fixed','PDF analysis recommends fixed when images are present');
const plain=pdfAnalyzeLayout(headed.map((p)=>p.slice(1,2)),0,4);
ok(plain.recommendedMode==='reflow','PDF analysis keeps clean text in reflow mode');

// heading size buckets (needs body baseline present)
const mix=[I("HUGE TITLE",72,700,200,30), I("regular body text here",72,670,180,12), I("more body text follows",72,654,180,12)];
ok(/<h1>HUGE TITLE<\/h1>/.test(pdfItemsToHtml([mix])),'very large vs body -> h1');

// integrate into pipeline
const book={title:'T',author:'A',language:'en',images:[],coverName:'',chapters:splitChapters(promoteHeadings(out),'h1h2')};
ok(book.chapters.length===2,'h1h2 split -> title + Chapter Two ('+book.chapters.length+')');

const outlinePages=[
  [I('Chapter One',72,800,120,18),I('First body text stays here.',72,770,220,12)],
  [I('Chapter Two',72,800,120,18),I('Second body text stays here.',72,770,220,12)]
];
const outlined=chaptersFromPdfOutline([
  {title:'Chapter One',page:0,level:2,hasChildren:false},
  {title:'Chapter Two',page:1,level:2,hasChildren:false}
],outlinePages,[[],[]]);
ok(outlined.length===2 && outlined[0].title==='Chapter One' && /First body/.test(outlined[0].html),'PDF outline chapters use bookmark titles and page ranges');

console.log('\nRESULT: '+p+' passed, '+f+' failed');process.exit(f?1:0);
