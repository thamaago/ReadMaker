const fs=require('fs');const {JSDOM}=require('jsdom');
const dom=new JSDOM('<!DOCTYPE html><body></body>');
global.window=dom.window;global.document=dom.window.document;global.DOMParser=dom.window.DOMParser;global.XMLSerializer=dom.window.XMLSerializer;
let core=[...fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8').matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map(x=>x[1]).pop();
core=core.slice(0,core.indexOf('/* ============================ orchestration')).replace(/^\s*["']use strict["'];\s*/,'');(0,eval)(core);
let p=0,f=0;const ok=(c,m)=>{c?(p++):(f++,0);console.log((c?'  ok  ':'  FAIL')+' '+m);};

// --- legitimate titles must survive untouched ---
const keep=[
 'Chapter One','CHAPTER ONE: THE BOY WHO LIVED','Prologue','Epilogue','Bab 1: Awal Mula',
 'The Curious Incident of the Dog in the Night-Time','Dr. Jekyll and Mr. Hyde','Mr. Norrell',
 '17','II. The Return','A Study in Scarlet','Kata Pengantar','THE VANISHING GLASS'
];
keep.forEach(x=>ok(cleanChapterTitle(x,0)===x,'kept: "'+x+'"  -> '+cleanChapterTitle(x,0)));

// --- prose must be rejected (the bug from the screenshot) ---
const reject=[
 'Mthat they were perfectly normal, thank you very much. They were the',
 'Ntheir nephew on the front step, but Privet Drive had hardly changed at',
 'Tpunishment. By the time he was allowed out of his cupboard again, the',
 'Hdaylight, he kept his eyes shut tight.',
 'and so it was that the whole company travelled onward through the hills',
 'Just body text with no heading whatsoever in this document.',
 'Mr. and Mrs. Dursley, of number four, Privet Drive, were proud to say that they were perfectly normal.',
 ''
];
reject.forEach(x=>{const r=cleanChapterTitle(x,4);ok(r==='Chapter 5','rejected: "'+x.slice(0,42)+'…" -> '+r);});

// --- whitespace / decoration cleanup ---
ok(cleanChapterTitle('  ***  Chapter Two  ---  ',0)==='Chapter Two','strips decoration/whitespace');
ok(cleanChapterTitle('Chapter\n  Three',0)==='Chapter Three','collapses newlines');

// --- end-to-end through splitChapters ---
const html='<h1>THE BOY WHO LIVED</h1><p>text</p>'+
 '<h1><span>M</span>r. and Mrs. Dursley, of number four, were proud to say that they were perfectly normal. They were the last.</h1><p>more</p>';
const ch=splitChapters(html,'h1');
ok(ch.length===2,'splits into 2 chapters');
ok(ch[0].title==='THE BOY WHO LIVED','real heading preserved');
ok(ch[1].title==='Chapter 2','prose heading replaced with numbered label ('+ch[1].title+')');
console.log('\nRESULT: '+p+' passed, '+f+' failed');process.exit(f?1:0);
