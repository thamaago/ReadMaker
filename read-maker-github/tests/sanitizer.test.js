const fs=require('fs');const {JSDOM}=require('jsdom');
const dom=new JSDOM('<!DOCTYPE html><body></body>',{url:'https://localhost/'});
global.window=dom.window;global.document=dom.window.document;global.DOMParser=dom.window.DOMParser;global.URL=dom.window.URL;
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
let core=[...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map(x=>x[1]).pop();
core=core.slice(0,core.indexOf('/* ============================ orchestration')).replace(/^\s*["']use strict["'];\s*/,'');
(0,eval)(core);
let p=0,f=0;const ok=(c,m)=>{c?(p++,console.log('  ok  ',m)):(f++,console.log('  FAIL',m));};

const dirty=`<html lang="en-GB"><head><title>My Doc</title><meta name="author" content="Jane"><style>x{}</style></head>
<body onload="hack()">
<script>steal()</script>
<div class="wrap"><h1 onclick="x()">Hello</h1>
<p style="color:red" onmouseover="evil()">A <b>bold</b> and <em>italic</em> line with <a href="javascript:alert(1)">bad link</a> and <a href="https://ok.com">good</a>.</p>
<div><span>nested span text</span></div>
<img src="/a.png" onerror="boom()" alt="pic"/>
<iframe src="evil"></iframe>
<table><tr><td>cell</td></tr></table>
</div></body></html>`;

const r=htmlToBody(dirty);
ok(r.title==='My Doc','html title extracted');
ok(r.author==='Jane','html author extracted');
ok(r.lang==='en','html lang normalized en-GB->en');
ok(!/onload|onclick|onmouseover|onerror|style=/.test(r.html),'no on* handlers or style attrs remain');
ok(!/<script|steal|hack|evil|boom|<iframe/.test(r.html),'scripts/iframe removed');
ok(/<h1>Hello<\/h1>/.test(r.html),'semantic h1 kept (attrs stripped)');
ok(/<strong>bold<\/strong>|<b>bold<\/b>/.test(r.html) && /<em>italic<\/em>/.test(r.html),'inline bold/italic kept');
ok(/<a href="https:\/\/ok\.com">good<\/a>/.test(r.html),'safe link kept');
ok(!/javascript:/.test(r.html),'javascript: link neutralized (unwrapped)');
ok(/nested span text/.test(r.html) && !/<span/.test(r.html),'span unwrapped, text kept');
ok(/<img src="[^"]*a\.png" alt="pic"\/>/.test(r.html),'img kept with only src/alt');
ok(/<table>.*<td>cell<\/td>.*<\/table>/s.test(r.html),'table structure kept');

console.log('\nRESULT: '+p+' passed, '+f+' failed');process.exit(f?1:0);
