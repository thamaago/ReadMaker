const fs=require('fs');const {JSDOM,VirtualConsole}=require('jsdom');const JSZip=require('jszip');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:new VirtualConsole(),
  beforeParse(w){ w.JSZip=JSZip; if(!w.crypto)w.crypto={randomUUID:()=>'11111111-2222-4333-8444-555555555555'}; }});
const {window}=dom; const doc=window.document;
let p=0,f=0;const ok=(c,m)=>{c?(p++):(f++,0);console.log((c?'  ok  ':'  FAIL')+' '+m);};

function mkFile(name, text){
  const b=new window.Blob([text],{type:'text/plain'});
  b.name=name; b.text=()=>Promise.resolve(text); b.arrayBuffer=()=>Promise.resolve(Buffer.from(text).buffer);
  return b;
}
setTimeout(async()=>{
  ok(doc.getElementById('file').hasAttribute('multiple'),'file input accepts multiple files');

  const files=[
    mkFile('satu.md','# Bab Satu\n\nIsi bab satu.\n\n# Bab Dua\n\nIsi bab dua.'),
    mkFile('dua.txt','Chapter 1\n\nSome body text here.\n\nChapter 2\n\nMore text.'),
    mkFile('rusak.rtf','this is not rtf at all')          // must fail gracefully
  ];
  window.eval('window.__t=t;');
  window.startBatch(files);
  ok(window.batchFiles.length===3,'batch mode holds 3 files');
  ok(doc.getElementById('build').disabled===false,'Build enabled in batch mode');
  ok(/satu\.md/.test(doc.getElementById('galley').innerHTML),'queue lists file names');
  ok(doc.getElementById('buildXtc').style.display==='none','XTC button hidden in batch mode');

  // capture the download instead of performing it
  let zipBlob=null, zipName='';
  const origCreate=window.URL.createObjectURL;
  window.URL.createObjectURL=(b)=>{ zipBlob=b; return 'blob:x'; };
  const origAppend=doc.body.appendChild.bind(doc.body);
  doc.body.appendChild=(el)=>{ if(el.tagName==='A'){ zipName=el.download; el.click=()=>{}; } return origAppend(el); };

  await window.runBatch();
  window.URL.createObjectURL=origCreate;

  ok(/read-maker-2-books\.zip/.test(zipName),'ZIP named after successful count ('+zipName+')');
  const buf=Buffer.from(await zipBlob.arrayBuffer());
  const zip=await JSZip.loadAsync(buf);
  const names=Object.keys(zip.files);
  ok(names.length===2,'ZIP holds 2 EPUBs, broken file skipped ('+names.join(', ')+')');
  ok(names.every(n=>/\.epub$/.test(n)),'all entries are .epub');
  const inner=await zip.file(names[0]).async('uint8array');
  const ez=await JSZip.loadAsync(Buffer.from(inner));
  ok(!!ez.file('OEBPS/content.opf'),'each EPUB is a valid package');
  const g=doc.getElementById('galley').innerHTML;
  ok(/selesai/.test(g),'per-file success state shown');
  ok(/gagal/.test(g),'per-file failure state shown');
  ok(/Tersimpan/.test(doc.getElementById('status').textContent),'final status reported');

  console.log('\nRESULT: '+p+' passed, '+f+' failed');
  process.exit(f?1:0);
},80);
