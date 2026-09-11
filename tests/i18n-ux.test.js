const fs=require('fs');const {JSDOM}=require('jsdom');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
let p=0,f=0;const ok=(c,m)=>{c?(p++,console.log('  ok  ',m)):(f++,console.log('  FAIL',m));};

// 1) app script syntax intact
const app=[...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map(x=>x[1]);
ok(app.length===2,'two inline scripts (i18n + app) ('+app.length+')');
try{ new Function(app[0]); ok(true,'i18n script syntax OK'); }catch(e){ ok(false,'i18n syntax: '+e.message); }
try{ new Function(app[1].replace(/^\s*["']use strict["'];/,'')); ok(true,'app script syntax OK'); }catch(e){ ok(false,'app syntax: '+e.message); }

// 2) every data-i18n key exists in both ID and EN dicts
const Tmatch=app[0].match(/var T = (\{[\s\S]*?\n\});/);
ok(!!Tmatch,'found T dictionary');
const T=eval('('+Tmatch[1]+')');
const keysUsed=new Set();
for(const m of html.matchAll(/data-i18n(?:-html|-ph)?="([^"]+)"/g)) keysUsed.add(m[1]);
let missId=[],missEn=[];
keysUsed.forEach(k=>{ if(T.id[k]==null)missId.push(k); if(T.en[k]==null)missEn.push(k); });
ok(missId.length===0,'all markup keys present in ID '+(missId.length?JSON.stringify(missId):''));
ok(missEn.length===0,'all markup keys present in EN '+(missEn.length?JSON.stringify(missEn):''));
// dynamic status keys used in app
['stReady','stParsing','stBuilding','stImages','stFetching','stBlocked','stPasteFirst','stSaved','devDone'].forEach(k=>{
  ok(T.id[k]!=null&&T.en[k]!=null,'status key '+k+' in both langs');
});

// 3) applyLang works in a real DOM
const dom=new JSDOM(html,{runScripts:'outside-only'});
const {window}=dom; global.window=window; global.document=window.document;
// execute only the i18n script in this DOM
window.eval(app[0]);
window.applyLang('en');
const h1=window.document.querySelector('[data-i18n-html="h1"]').innerHTML;
ok(/EPUB/.test(h1)&&/span class="arrow"/.test(h1),'EN: h1 innerHTML swapped & keeps arrow span');
ok(window.document.querySelector('[data-i18n="buildBtn"]').textContent==='Create EPUB','EN: build button text');
ok(window.document.querySelector('[data-i18n-ph="urlPh"]').getAttribute('placeholder').indexOf('article')>=0,'EN: url placeholder');
window.applyLang('id');
ok(window.document.querySelector('[data-i18n="buildBtn"]').textContent==='Buat EPUB','ID: build button text');
ok(window.document.querySelector('[data-i18n="devHead"]').textContent==='Cara memasukkan ke perangkat','ID: device header');
ok(window.document.documentElement.getAttribute('lang')==='id','ID: <html lang> set');

// 4) required IDs still present exactly once
['drop','file','filecard','fname','fformat','fsize','fblocks','url','fetchBtn','pasteUrl','pasteHtml','pasteBtn','title','author','lang','split','einkOn','einkLevels','einkDither','einkSize','galley','build','status','log','deviceCard','deviceDone'].forEach(id=>{
  const n=(html.match(new RegExp('id="'+id+'"','g'))||[]).length;
  ok(n===1,'id '+id+' present once ('+n+')');
});
console.log('\nRESULT: '+p+' passed, '+f+' failed');process.exit(f?1:0);
