const fs=require('fs');const {JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://example.com/',virtualConsole:new VirtualConsole(),
  beforeParse(w){ w.JSZip=function(){}; if(!w.crypto)w.crypto={randomUUID:()=>'x'}; }});
const {window}=dom; const doc=window.document;
let p=0,f=0;const ok=(c,m)=>{c?(p++):(f++,0);console.log((c?'  ok  ':'  FAIL')+' '+m);};

setTimeout(async()=>{
  // 1) localized thrown errors (ID default)
  const rtfErr = window.eval("(function(){try{ rtfToBook('not rtf at all'); }catch(e){ return e.message; }})()");
  ok(/bukan RTF yang sah/.test(rtfErr),'RTF error localized (ID): '+rtfErr);
  const unsup = window.eval("t('errUnsupported')");
  ok(/Format belum didukung/.test(unsup),'unsupported-format key localized');
  const epubMsg = window.eval("t('errEpubInput')");
  ok(/sudah berformat EPUB/.test(epubMsg),'EPUB-input guidance exists (ID)');

  // 2) switch to EN and confirm the same errors change language
  doc.querySelector('.langtoggle button[data-lang="en"]').dispatchEvent(new window.Event('click',{bubbles:true}));
  const rtfErrEn = window.eval("(function(){try{ rtfToBook('nope'); }catch(e){ return e.message; }})()");
  ok(/not look like a valid RTF/.test(rtfErrEn),'RTF error follows EN toggle: '+rtfErrEn);
  ok(/already an EPUB/.test(window.eval("t('errEpubInput')")),'EPUB guidance follows EN toggle');
  doc.querySelector('.langtoggle button[data-lang="id"]').dispatchEvent(new window.Event('click',{bubbles:true}));

  // 3) fetch-blocked galley message is localized (not hardcoded English)
  window.fetch = () => Promise.reject(new Error('CORS'));
  doc.getElementById('url').value='https://blocked.example/a';
  doc.getElementById('fetchBtn').dispatchEvent(new window.Event('click',{bubbles:true}));
  await new Promise(r=>setTimeout(r,30));
  const g=doc.getElementById('galley').innerHTML;
  ok(/memblokir permintaan langsung/.test(g),'blocked message localized in galley');
  ok(!/The site blocked a direct request/.test(g),'no hardcoded English left in galley');

  // 3b) invalid URL input must not be misreported as CORS; domain-only input
  // is repaired when it is unambiguous.
  let fetchCalls=0; window.fetch=()=>{ fetchCalls++; return Promise.reject(new Error('should not fetch')); };
  doc.getElementById('url').value='wafat-megawati-otw-dari-sulsel-ke-rumah-duka-di-jakarta';
  doc.getElementById('fetchBtn').dispatchEvent(new window.Event('click',{bubbles:true}));
  await new Promise(r=>setTimeout(r,10));
  ok(/alamat artikel lengkap/.test(doc.getElementById('status').textContent),'bare slug gets a clear complete-URL message');
  ok(fetchCalls===0,'bare slug is rejected before network access');
  ok(window.eval("normalizeArticleUrl('example.com/artikel')")==='https://example.com/artikel','domain-only URL is upgraded to HTTPS');

  doc.getElementById('pasteHtml').value='https://example.com/article';
  doc.getElementById('pasteBtn').dispatchEvent(new window.Event('click',{bubbles:true}));
  await new Promise(r=>setTimeout(r,10));
  ok(/Yang ditempel hanya alamat URL/.test(doc.getElementById('status').textContent),'URL pasted into HTML field gets a direct instruction');

  // 4) fetch timeout wiring present (AbortController used with 20s)
  ok(/AbortController/.test(html) && /20000/.test(html),'fetch has an abort timeout');

  // 5) dropping an .epub gives friendly guidance, not a raw "Unsupported" error
  ok(/ext==='epub'/.test(html),'dispatch handles .epub input explicitly');

  console.log('\nRESULT: '+p+' passed, '+f+' failed');
  process.exit(f?1:0);
},60);
