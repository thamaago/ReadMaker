const fs=require('fs');
const {JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://example.com/',virtualConsole:new VirtualConsole(),beforeParse(w){w.JSZip=function(){};}});
const {window}=dom, doc=window.document;
let p=0,f=0; const ok=(c,m)=>{c?(p++):(f++);console.log((c?'  ok  ':'  FAIL')+' '+m);};

setTimeout(()=>{
  ok(!!doc.getElementById('outputPreset'),'output preset control exists');
  const apply=(v)=>{doc.getElementById('outputPreset').value=v; window.eval('applyOutputPreset()');};
  apply('text');
  ok(doc.getElementById('pdfMode').value==='reflow'&&doc.getElementById('einkOn').value==='on','text preset selects reflow and image processing');
  apply('layout');
  ok(doc.getElementById('pdfMode').value==='fixed'&&doc.getElementById('pdfQuality').value==='eink-detail','layout preset keeps pages at high grayscale detail');
  apply('comic');
  ok(doc.getElementById('einkOn').value==='on'&&doc.getElementById('einkSize').value==='480x800','comic preset targets e-ink panel');
  doc.getElementById('einkOn').value='off';
  const warning=window.eval("validateOutputOptions({html:'<p>x</p>',images:[{mime:'image/gif'}],chapters:[{html:'<p>x</p>'}]})");
  ok(Array.isArray(warning.errors)&&Array.isArray(warning.warnings)&&warning.warnings.length===1,'export validation warns about risky image format');
  console.log('\nRESULT: '+p+' passed, '+f+' failed'); process.exit(f?1:0);
},80);
