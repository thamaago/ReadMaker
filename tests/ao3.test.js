const fs=require('fs');const {JSDOM}=require('jsdom');
const dom=new JSDOM('<!DOCTYPE html><body></body>');
global.window=dom.window;global.document=dom.window.document;global.DOMParser=dom.window.DOMParser;global.XMLSerializer=dom.window.XMLSerializer;global.URL=dom.window.URL;
let core=[...fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8').matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map(x=>x[1]).pop();
core=core.slice(0,core.indexOf('/* ============================ orchestration')).replace(/^\s*["']use strict["'];\s*/,'');(0,eval)(core);
let p=0,f=0;const ok=(c,m)=>{c?(p++):(f++,0);console.log((c?'  ok  ':'  FAIL')+' '+m);};

// URL helpers
ok(isAo3Url('https://archiveofourown.org/works/123/chapters/456'),'AO3 URL recognised');
ok(!isAo3Url('https://example.com/blog/post'),'non-AO3 URL not matched');
ok(ao3FullWorkUrl('https://archiveofourown.org/works/123/chapters/456')==='https://archiveofourown.org/works/123?view_full_work=true','builds full-work URL from a chapter URL');
ok(ao3FullWorkUrl('https://archiveofourown.org/works/123')==='https://archiveofourown.org/works/123?view_full_work=true','builds full-work URL from a work URL');

// a realistic AO3 full-work page (multi-chapter)
const page=`<!DOCTYPE html><html lang="en"><head><title>My Fic - Author [Archive of Our Own]</title></head><body>
<div id="main">
 <div class="preface group">
   <h2 class="title heading">My Fic</h2>
   <h3 class="byline heading">by <a rel="author" href="/users/Author">Author</a></h3>
   <div class="summary module"><h3>Summary</h3><blockquote class="userstuff"><p>A short summary line.</p></blockquote></div>
   <div class="tags"><ul><li>lots of tags that should not become body text</li></ul></div>
 </div>
 <div id="chapters" role="article">
   <div class="chapter" id="chapter-1">
     <div class="chapter preface group"><h3 class="title"><a>Chapter 1</a>: The Beginning</h3></div>
     <div class="userstuff module" role="article"><p>First chapter, paragraph one.</p><p>Paragraph two.</p></div>
     <div class="notes"><p class="userstuff">Author note that must be dropped.</p></div>
   </div>
   <div class="chapter" id="chapter-2">
     <div class="chapter preface group"><h3 class="title"><a>Chapter 2</a>: The Middle</h3></div>
     <div class="userstuff module"><p>Second chapter body here.</p></div>
   </div>
 </div>
</div></body></html>`;

const r=extractAo3(page,'https://archiveofourown.org/works/123?view_full_work=true');
ok(r.ao3===true,'flagged as AO3');
ok(r.title==='My Fic','title extracted');
ok(r.author==='Author','author extracted (by stripped)');
ok(r.lang==='en','language extracted');
ok(/A short summary line\./.test(r.html),'summary kept as front matter');
ok(!/lots of tags that should not become body/.test(r.html),'tag list NOT dumped into body');
ok(!/Author note that must be dropped/.test(r.html),'chapter notes excluded from body');
ok(/First chapter, paragraph one\. ?/.test(r.html) && /Paragraph two\./.test(r.html),'chapter 1 body kept');
ok(/Second chapter body here\./.test(r.html),'chapter 2 body kept');
const heads=(r.html.match(/<h1>(.*?)<\/h1>/g)||[]).map(x=>x.replace(/<\/?h1>/g,''));
ok(heads.some(x=>/The Beginning/.test(x)) && heads.some(x=>/The Middle/.test(x)),'chapter titles become headings: '+JSON.stringify(heads));

// splits into proper chapters
const ch=splitChapters(promoteHeadings(r.html),'auto');
ok(ch.length>=3,'summary + 2 chapters -> '+ch.length+' sections');

// single-chapter work (no #chapters .chapter, one .userstuff)
const single=`<html lang="en"><head><title>One Shot - A [Archive of Our Own]</title></head><body>
 <div class="preface group"><h2 class="title">One Shot</h2><h3 class="byline">by <a rel="author">A</a></h3></div>
 <div id="chapters"><div class="userstuff"><p>The whole story in one go.</p></div></div></body></html>`;
const r2=extractAo3(single,'https://archiveofourown.org/works/999');
ok(/The whole story in one go\./.test(r2.html),'single-chapter work extracted');
ok(r2.title==='One Shot','single-chapter title');

console.log('\nRESULT: '+p+' passed, '+f+' failed');process.exit(f?1:0);
