const fs=require('fs');const {JSDOM}=require('jsdom');
const dom=new JSDOM('<!DOCTYPE html><body></body>');
global.window=dom.window;global.document=dom.window.document;global.DOMParser=dom.window.DOMParser;global.XMLSerializer=dom.window.XMLSerializer;
let core=[...fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8').matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map(x=>x[1]).pop();
core=core.slice(0,core.indexOf('/* ============================ orchestration')).replace(/^\s*["']use strict["'];\s*/,'');(0,eval)(core);
let p=0,f=0;const ok=(c,m)=>{c?(p++):(f++,0);console.log((c?'  ok  ':'  FAIL')+' '+m);};

// drop caps fused to the sentence with no space (the case seen on device)
const fused=[
 'Ito get through his exams when he half expected Voldemort to come',
 'Mthat they were perfectly normal thank you very much they were the',
 'Hdaylight he kept his eyes shut tight and waited for the morning sun',
 'Ntheir nephew on the front step but Privet Drive had hardly changed'
];
fused.forEach(x=>ok(cleanChapterTitle(x,16)==='Chapter 17','fused drop cap rejected: "'+x.slice(0,32)+'…"'));

// real titles must survive, including lower-case Indonesian chapter markers
const keep=[
 'Bagian dua puluh satu','Bab tiga belas','Jilid dua',
 'The Curious Incident of the Dog in the Night-Time','THE LETTERS FROM NO ONE',
 'A Study in Scarlet','I Am Legend','Dr. Jekyll and Mr. Hyde','Kata Pengantar',
 'CHAPTER ONE: THE BOY WHO LIVED','Prologue','17'
];
keep.forEach(x=>ok(cleanChapterTitle(x,0)===x,'kept: "'+x+'"'));

// end to end: a chapter whose only heading is a fused drop cap
const html='<h1>Ito get through his exams when he half expected Voldemort to come</h1><p>body</p>'+
           '<h1>THE MIRROR OF ERISED</h1><p>body</p>';
const ch=splitChapters(html,'h1');
ok(ch[0].title==='Chapter 1','fused heading -> numbered label ('+ch[0].title+')');
ok(ch[1].title==='THE MIRROR OF ERISED','real heading kept');
console.log('\nRESULT: '+p+' passed, '+f+' failed');process.exit(f?1:0);
