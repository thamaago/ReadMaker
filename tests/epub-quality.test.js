const fs=require('fs');const {JSDOM}=require('jsdom');const JSZip=require('jszip');
const dom=new JSDOM('<!doctype html><body></body>');
global.window=dom.window;global.document=dom.window.document;global.DOMParser=dom.window.DOMParser;global.XMLSerializer=dom.window.XMLSerializer;global.JSZip=JSZip;global.crypto={randomUUID:()=> 'x'};global.atob=s=>Buffer.from(s,'base64').toString('binary');global.btoa=s=>Buffer.from(s,'binary').toString('base64');
let app=[...fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8').matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map(x=>x[1]).pop();
app=app.slice(0,app.indexOf('/* ============================ orchestration')).replace(/^\s*["']use strict["'];\s*/,'');(0,eval)(app);
let p=0,f=0;const ok=(c,m)=>{c?p++:f++;console.log(c?'  ok  ':'  FAIL',m)};
(async()=>{
 const warnings=[]; await buildEpub({title:'',author:'',language:'xx',images:[{name:'x.webp',mime:'image/jpeg',b64:''},{name:'x.webp',mime:'image/png',b64:''}],chapters:[{title:'',html:''}]},w=>warnings.push(w));
 ok(warnings.some(x=>/missing title/.test(x)),'quality: missing title warning');
 ok(warnings.some(x=>/invalid language/.test(x)),'quality: invalid language warning');
 ok(warnings.some(x=>/duplicate href/.test(x)),'quality: duplicate image warning');
 ok(warnings.some(x=>/empty title/.test(x)),'quality: empty chapter title warning');
 ok(warnings.some(x=>/empty$/.test(x)),'quality: empty content warning');
 ok(warnings.some(x=>/image type/.test(x)),'quality: mismatched image media type warning');
 console.log('\nRESULT: '+p+' passed, '+f+' failed');process.exit(f?1:0);
})().catch(e=>{console.error(e);process.exit(2)});
