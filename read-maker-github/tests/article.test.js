const fs=require('fs');const {JSDOM}=require('jsdom');const JSZip=require('jszip');
const dom=new JSDOM('<!DOCTYPE html><body></body>',{url:'https://localhost/'});
global.window=dom.window;global.document=dom.window.document;global.DOMParser=dom.window.DOMParser;global.XMLSerializer=dom.window.XMLSerializer;global.JSZip=JSZip;global.Blob=dom.window.Blob;global.crypto={randomUUID:()=>'22222222-3333-4444-8555-666666666666'};global.atob=s=>Buffer.from(s,'base64').toString('binary');global.URL=dom.window.URL;
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
let core=[...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map(x=>x[1]).pop();
core=core.slice(0,core.indexOf('/* ============================ orchestration')).replace(/^\s*["']use strict["'];\s*/,'');
(0,eval)(core);

const page=`<!DOCTYPE html><html lang="en-US"><head>
<meta property="og:title" content="Why E-Ink Wins"/>
<meta name="author" content="By Jane Reader"/>
<title>Why E-Ink Wins - The Slow Web</title></head>
<body>
<header><nav><a href="/">Home</a><a href="/about">About</a></nav></header>
<div class="sidebar"><ul><li>Ad one</li><li>Ad two</li></ul></div>
<article>
  <h1>Why E-Ink Wins</h1>
  <p>Reading on <strong>e-ink</strong> is calm. See <a href="/deep">the deep dive</a>.</p>
  <h2>No glare</h2>
  <p>Sunlight is fine.</p>
  <figure><img src="/img/panel.png" alt="panel"/><figcaption>caption to drop</figcaption></figure>
  <p></p>
  <blockquote>Paper, but electric.</blockquote>
</article>
<footer>© 2026 The Slow Web · <a href="/privacy">Privacy</a></footer>
<script>tracker();</script>
</body></html>`;

(async()=>{
  let p=0,f=0;const ok=(c,m)=>{c?(p++,console.log('  ok  ',m)):(f++,console.log('  FAIL',m));};
  const r=extractArticle(page,'https://slow.example/why');
  ok(r.title==='Why E-Ink Wins','article title from og:title');
  ok(r.author==='Jane Reader','author, "By " stripped');
  ok(r.lang==='en','lang normalized en-US -> en');
  ok(/<strong>e-ink<\/strong>/.test(r.html),'inline bold kept');
  ok(/href="https:\/\/slow\.example\/deep"/.test(r.html),'relative link made absolute');
  ok(/src="https:\/\/slow\.example\/img\/panel\.png"/.test(r.html),'relative img made absolute');
  ok(!/Home|About|Ad one|Privacy|©|tracker/.test(r.html),'nav/sidebar/footer/script removed ('+/Home|About|Ad one|Privacy|©|tracker/.exec(r.html)+')');
  ok(!/caption to drop/.test(r.html),'figcaption removed');
  ok((r.html.match(/<h2>/g)||[]).length===1,'subheading kept');
  ok(!/<p>\s*<\/p>/.test(r.html),'empty paragraph dropped');

  const book={title:r.title,author:r.author,language:r.lang,images:[],coverName:'',chapters:splitChapters(r.html,'auto')};
  ok(book.chapters.length>=1,'chapters built');
  const blob=await buildEpub(book);const buf=Buffer.from(await blob.arrayBuffer());fs.writeFileSync('sample-article.epub',buf);
  const zip=await JSZip.loadAsync(buf);
  const opf=await zip.file('OEBPS/content.opf').async('string');
  ok(/<dc:title>Why E-Ink Wins<\/dc:title>/.test(opf),'epub title');
  ok(/<dc:creator>Jane Reader<\/dc:creator>/.test(opf),'epub author');
  const c1=await zip.file('OEBPS/chap001.xhtml').async('string');
  ok(!new window.DOMParser().parseFromString(c1,'application/xhtml+xml').querySelector('parsererror'),'chapter XHTML valid');

  // no <article>, fallback to densest block
  const page2=`<html lang="id"><body><div class="wrap"><div class="content"><p>Paragraf satu yang cukup panjang untuk menang skor konten artikel.</p><p>Paragraf dua.</p></div><div class="rail"><p>x</p></div></div></body></html>`;
  const r2=extractArticle(page2,'https://a.b/');
  ok(/Paragraf satu/.test(r2.html)&&/Paragraf dua/.test(r2.html),'fallback picks densest content block');
  console.log('\nRESULT: '+p+' passed, '+f+' failed ('+buf.length+' bytes)');process.exit(f?1:0);
})().catch(e=>{console.error(e);process.exit(2)});
