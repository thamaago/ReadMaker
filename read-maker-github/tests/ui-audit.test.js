const fs=require('fs');const {JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const vc=new VirtualConsole(); // silence page console
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,
  beforeParse(w){ w.JSZip=function(){}; if(!w.crypto)w.crypto={randomUUID:()=>'x'}; }});
const {window}=dom; const doc=window.document;
let p=0,f=0;const ok=(c,m)=>{c?(p++):(f++,0);console.log((c?'  ok  ':'  FAIL')+' '+m);};

// wait a tick for DOMContentLoaded handlers
setTimeout(()=>{
  // 1) all form controls have an associated label[for]
  const controls=[...doc.querySelectorAll('input:not([type=file]), select')];
  controls.forEach(c=>{
    const lab=c.id && doc.querySelector('label[for="'+c.id+'"]');
    ok(!!lab || c.getAttribute('aria-label') || c.getAttribute('placeholder'), 'control #'+(c.id||c.name)+' has label/aria/placeholder');
  });
  // 2) every button has an accessible name
  [...doc.querySelectorAll('button')].forEach(b=>{
    const name=(b.textContent||'').trim()||b.getAttribute('aria-label');
    ok(!!name,'button has accessible name: "'+((b.textContent||'').trim()||b.getAttribute('data-lang')||'?')+'"');
  });
  // 3) required interactive IDs exist
  ['drop','file','url','fetchBtn','pasteBtn','pasteHtml','build','status','galley','title','author','split','einkOn'].forEach(id=>{
    ok(!!doc.getElementById(id),'exists #'+id);
  });
  // 4) build button disabled on load (nothing chosen yet)
  ok(doc.getElementById('build').disabled===true,'Build disabled before any input');
  // 5) default language applied = Indonesian
  ok(doc.getElementById('build').textContent==='Buat EPUB','default UI language = ID (Build="Buat EPUB")');
  ok(doc.documentElement.getAttribute('lang')==='id','<html lang> = id');
  // 6) language toggle works (click EN)
  const enBtn=doc.querySelector('.langtoggle button[data-lang="en"]');
  enBtn.dispatchEvent(new window.Event('click',{bubbles:true}));
  ok(doc.getElementById('build').textContent==='Create EPUB','EN toggle switches Build text');
  ok(enBtn.getAttribute('aria-pressed')==='true','EN button aria-pressed=true after click');
  // back to ID
  doc.querySelector('.langtoggle button[data-lang="id"]').dispatchEvent(new window.Event('click',{bubbles:true}));
  ok(doc.getElementById('build').textContent==='Buat EPUB','ID toggle restores Build text');

  // 7) drop zone keyboard opens file dialog (spy on file.click)
  let clicked=false; const fileEl=doc.getElementById('file'); fileEl.click=()=>{clicked=true;};
  doc.getElementById('drop').dispatchEvent(new window.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
  ok(clicked===true,'Enter on drop zone triggers file picker');

  // 8) clicking Fetch with empty URL does not throw / does nothing bad
  let threw=false; try{ doc.getElementById('fetchBtn').dispatchEvent(new window.Event('click',{bubbles:true})); }catch(e){threw=true;}
  ok(!threw,'Fetch with empty URL does not throw');

  // 9) Paste with empty textarea shows a localized error (not a crash)
  threw=false; try{ doc.getElementById('pasteBtn').dispatchEvent(new window.Event('click',{bubbles:true})); }catch(e){threw=true;}
  ok(!threw,'Paste with empty HTML does not throw');
  ok(/Tempel HTML dulu|Paste some HTML/.test(doc.getElementById('status').textContent),'Paste-empty shows guidance ('+doc.getElementById('status').textContent+')');

  // 10) advanced/paste/log are <details> (collapsed, keyboard accessible)
  ok(doc.querySelectorAll('details').length>=3,'advanced/paste/log use <details> ('+doc.querySelectorAll('details').length+')');

  // 11) no <label for> pointing to a missing id
  [...doc.querySelectorAll('label[for]')].forEach(l=>{ const target=doc.getElementById(l.getAttribute('for')); ok(!!target,'label for="'+l.getAttribute('for')+'" has a target'); });

  // 12) steps guide present for beginners
  ok(doc.querySelectorAll('.steps .step').length===3,'1-2-3 beginner steps present');

  console.log('\nRESULT: '+p+' passed, '+f+' failed');
  process.exit(f?1:0);
},50);
