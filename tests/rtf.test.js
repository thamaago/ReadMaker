const fs=require('fs');const {JSDOM}=require('jsdom');const JSZip=require('jszip');
const dom=new JSDOM('<!DOCTYPE html><body></body>',{url:'https://localhost/'});
global.window=dom.window;global.document=dom.window.document;global.DOMParser=dom.window.DOMParser;global.XMLSerializer=dom.window.XMLSerializer;global.JSZip=JSZip;global.crypto={randomUUID:()=>'11111111-2222-4333-8444-555555555555'};global.atob=s=>Buffer.from(s,'base64').toString('binary');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
let core=[...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map(x=>x[1]).pop();
core=core.slice(0,core.indexOf('/* ============================ orchestration')).replace(/^\s*["']use strict["'];\s*/,'');
(0,eval)(core);
// Realistic RTF: \u always followed by an explicit fallback char (as Word/LibreOffice emit)
const rtf = String.raw`{\rtf1\ansi\ansicpg1252\deff0
{\fonttbl{\f0\froman Times New Roman;}{\f1\fswiss Arial;}}
{\colortbl;\red0\green0\blue0;}
{\stylesheet{\s1\outlinelevel0 Heading 1;}{\s0 Normal;}}
{\info{\title The Tell\u8211?Tale Heart}{\author Edgar A. Poe}}
\pard\s1\outlinelevel0\b Chapter One\b0\par
\pard\plain True! \b nervous\b0  very \i dreadfully\i0  nervous.\par
Caf\'e9 at midnight. \u8220?Listen\u8221? he said.\par
\pard\s1\outlinelevel0\b Chapter Two\b0\par
\pard The end.\par
}`;
(async()=>{
  let p=0,f=0;const ok=(c,m)=>{c?(p++,console.log('  ok  ',m)):(f++,console.log('  FAIL',m));};
  const r=rtfToBook(rtf);
  ok(r.title==='The Tell\u2013Tale Heart','rtf title unicode endash ('+JSON.stringify(r.title)+')');
  ok(r.author==='Edgar A. Poe','rtf author');
  ok((r.html.match(/<h1>/g)||[]).length===2,'rtf: 2 outline H1');
  ok(/<strong>nervous<\/strong>/.test(r.html),'rtf: bold whole word');
  ok(/<em>dreadfully<\/em>/.test(r.html),'rtf: italic whole word');
  ok(/Caf\u00e9 at midnight/.test(r.html),'rtf: hex \\x27e9 -> é');
  ok(/\u201cListen\u201d/.test(r.html),'rtf: smart quotes via \\u+fallback');
  ok(!/Times New Roman|Arial|Heading 1|Normal/.test(r.html),'rtf: tables skipped');
  ok(!/The Tell/.test(r.html),'rtf: info not leaked');
  const book={title:r.title,author:r.author,language:'en',images:[],coverName:'',chapters:splitChapters(r.html,'auto')};
  ok(book.chapters.length===2,'rtf: 2 chapters');
  ok(book.chapters[0].title==='Chapter One','rtf: chapter title');
  const blob=await buildEpub(book);const buf=Buffer.from(await blob.arrayBuffer());fs.writeFileSync('sample-rtf.epub',buf);
  const zip=await JSZip.loadAsync(buf);
  const c1=await zip.file('OEBPS/chap001.xhtml').async('string');
  ok(!new window.DOMParser().parseFromString(c1,'application/xhtml+xml').querySelector('parsererror'),'rtf: chapter XHTML valid');
  const rtf2=String.raw`{\rtf1\ansi\deff0{\fonttbl{\f0 Times;}}\pard BAB I\par\pard Isi bab pertama.\par\pard BAB II\par\pard Isi bab kedua.\par}`;
  const r2=rtfToBook(rtf2);
  ok((r2.html.match(/<h1>/g)||[]).length===2,'rtf: heading promotion BAB I/II');
  console.log('\nRESULT: '+p+' passed, '+f+' failed ('+buf.length+' bytes)');process.exit(f?1:0);
})().catch(e=>{console.error(e);process.exit(2)});
