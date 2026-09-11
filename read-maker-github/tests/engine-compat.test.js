const fs=require('fs');const {JSDOM}=require('jsdom');const JSZip=require('jszip');
const dom=new JSDOM('<!DOCTYPE html><body></body>');
global.window=dom.window;global.document=dom.window.document;global.DOMParser=dom.window.DOMParser;global.XMLSerializer=dom.window.XMLSerializer;global.JSZip=JSZip;global.crypto={randomUUID:()=>'x'};global.atob=s=>Buffer.from(s,'base64').toString('binary');global.btoa=s=>Buffer.from(s,'binary').toString('base64');
let core=[...fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8').matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map(x=>x[1]).pop();
core=core.slice(0,core.indexOf('/* ============================ orchestration')).replace(/^\s*["']use strict["'];\s*/,'');(0,eval)(core);
let p=0,f=0;const ok=(c,m)=>{c?(p++):(f++,0);console.log((c?'  ok  ':'  FAIL')+' '+m);};

// normalizer: pre/code -> div with <br/>
const out=normalizeForEngine('<h1>T</h1><pre><code>line one\nline two\nline three</code></pre><p>after</p>');
ok(!/<pre|<code/.test(out),'pre/code tags removed (engine cannot parse them)');
ok(/<div>line one<br\/>line two<br\/>line three<\/div>/.test(out),'code lines preserved as <div> + <br/>');
ok(/<h1>T<\/h1>/.test(out)&&/<p>after<\/p>/.test(out),'surrounding blocks untouched');
// no code block -> unchanged
ok(normalizeForEngine('<p>hi <em>x</em></p>')==='<p>hi <em>x</em></p>','non-code html passes through unchanged');
// multiple blocks
ok((normalizeForEngine('<pre><code>a\nb</code></pre><pre><code>c\nd</code></pre>').match(/<div>/g)||[]).length===2,'multiple code blocks handled');

// end-to-end: the built EPUB chapter must have engine-friendly markup + valid XHTML
(async()=>{
  const md='# Judul\n\n```\nconst x = 1;\nconst y = 2;\nreturn x + y;\n```\n\nSelesai.';
  const html=mdToHtml(md);
  const book={title:'T',author:'',language:'en',images:[],coverName:'',chapters:splitChapters(html,'auto')};
  const zip=await JSZip.loadAsync(Buffer.from(await (await buildEpub(book)).arrayBuffer()));
  const ch=await zip.file('OEBPS/chap001.xhtml').async('string');
  ok(!/<pre|<code/.test(ch),'built chapter has no pre/code');
  ok(/const x = 1;<br ?\/>const y = 2;<br ?\/>return x \+ y;/.test(ch),'code lines survive in the chapter');
  ok(!new window.DOMParser().parseFromString(ch,'application/xhtml+xml').querySelector('parsererror'),'chapter still well-formed XHTML');

  // verify against the engine's known tag set: only handled tags remain as elements
  const HANDLED=new Set(['a','b','blockquote','br','del','div','em','h1','h2','h3','h4','h5','h6','hr','i','ins','li','p','s','span','strike','strong','sub','sup','u','table','tr','td','th','img','ul','ol','html','head','body','title','meta','link']);
  const tags=[...ch.matchAll(/<([a-z0-9]+)[\s>\/]/g)].map(m=>m[1].toLowerCase());
  const unknown=[...new Set(tags)].filter(t=>!HANDLED.has(t));
  ok(unknown.length===0,'no tags outside the engine/EPUB set: '+(unknown.join(',')||'none'));

  console.log('\nRESULT: '+p+' passed, '+f+' failed');process.exit(f?1:0);
})().catch(e=>{console.error(e);process.exit(2)});
