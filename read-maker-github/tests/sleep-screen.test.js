const fs=require('fs');const {JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const dom=new JSDOM('<!DOCTYPE html><body></body>');
global.window=dom.window;global.document=dom.window.document;global.DOMParser=dom.window.DOMParser;global.XMLSerializer=dom.window.XMLSerializer;
let core=[...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map(x=>x[1]).pop();
core=core.slice(0,core.indexOf('/* ============================ orchestration')).replace(/^\s*["']use strict["'];\s*/,'');(0,eval)(core);
let p=0,f=0;const ok=(c,m)=>{c?(p++):(f++,0);console.log((c?'  ok  ':'  FAIL')+' '+m);};

const W=6,H=4;
const gray=new Uint8ClampedArray(W*H);
for(let i=0;i<gray.length;i++) gray[i]=[0,85,170,255][i%4];

// ---- 8-bit indexed BMP (sleep.bmp) ----
const b8=grayToBmp8(gray,W,H);
const dv=new DataView(b8.buffer,b8.byteOffset,b8.byteLength);
ok(b8[0]===0x42&&b8[1]===0x4d,'BMP magic "BM"');
ok(dv.getUint32(14,true)===40,'DIB header size 40');
ok(dv.getInt32(18,true)===W,'width stored');
ok(dv.getInt32(22,true)===-H,'height negative (top-down rows)');
ok(dv.getUint16(28,true)===8,'8 bits per pixel');
ok(dv.getUint32(30,true)===0,'uncompressed BI_RGB');
const dataOff=dv.getUint32(10,true);
ok(dataOff===14+40+256*4,'pixel data offset after 256-colour palette ('+dataOff+')');
ok(dv.getUint32(2,true)===b8.length,'file size field matches actual length');
// palette must be the device's four levels
const pal=[0,1,2,3].map(i=>b8[54+i*4]);
ok(pal.join(',')==='0,85,170,255','palette equals device grey levels 0/85/170/255');
// rows padded to 4 bytes
const rowSize=(W+3)&~3;
ok(b8.length===dataOff+rowSize*H,'rows padded to 4-byte boundary');
// pixel values map to palette indices
const px=b8.subarray(dataOff);
ok(px[0]===0&&px[1]===1&&px[2]===2&&px[3]===3,'pixels stored as palette indices');

// ---- 32-bit BGRA overlay (sleep-overlay.bmp) ----
const alpha=new Uint8Array(W*H); alpha.fill(255); alpha[0]=0;
const b32=grayToBmp32(gray,alpha,W,H);
const dv2=new DataView(b32.buffer,b32.byteOffset,b32.byteLength);
ok(dv2.getUint16(28,true)===32,'overlay is 32-bit');
ok(dv2.getUint32(46,true)===0,'overlay has no palette');
const off2=dv2.getUint32(10,true);
ok(off2===54,'overlay pixel data right after DIB header');
ok(b32.length===54+W*H*4,'overlay size = header + w*h*4');
ok(b32[off2]===b32[off2+1]&&b32[off2+1]===b32[off2+2],'BGRA channels equal (greyscale)');
ok(b32[off2+3]===0,'alpha preserved (first pixel transparent)');
ok(b32[off2+7]===255,'opaque pixels keep alpha 255');


// ---- palette depth follows the tone count ----
function paletteOf(bytes,n){ const dv=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength); const out=[]; for(let i=0;i<n;i++) out.push(bytes[54+i*4]); return out; }
const b2=grayToBmp8(gray,W,H,2);   ok(paletteOf(b2,2).join(',')==='0,255','2-tone palette = 0,255');
const b4=grayToBmp8(gray,W,H,4);   ok(paletteOf(b4,4).join(',')==='0,85,170,255','4-tone palette = device 2-bit levels');
const b16=grayToBmp8(gray,W,H,16); const pal16=paletteOf(b16,16);
ok(pal16[0]===0&&pal16[15]===255&&pal16[8]===136,'16-tone palette spans 0..255 evenly ('+pal16.join(',')+')');
ok(greyLevels(16).length===16 && greyLevels(2).length===2 && greyLevels(4).length===4,'greyLevels returns N entries');
ok(greyLevels(7).length===4,'unsupported tone count falls back to 4');
// default (no tone arg) stays 4-level for back-compat
ok(paletteOf(grayToBmp8(gray,W,H),4).join(',')==='0,85,170,255','default palette still 4-level');

// ---- UI wiring ----
const d2=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:new VirtualConsole(),
  beforeParse(w){ w.JSZip=function(){}; if(!w.crypto)w.crypto={randomUUID:()=>'x'}; }});
setTimeout(()=>{
  const doc=d2.window.document;
  ok(!!doc.getElementById('sleepFile'),'sleep image picker exists');
  ok(!!doc.getElementById('sleepMode'),'wallpaper/overlay selector exists');
  ok(doc.getElementById('sleepMode').value==='full','defaults to full wallpaper');
  ok(!!doc.querySelector('label[for="sleepFile"]'),'picker is labelled');
  ok(/layar tidur/.test(doc.querySelector('[data-i18n="sleepHead"]').textContent),'section localised (ID)');
  doc.querySelector('.langtoggle button[data-lang="en"]').dispatchEvent(new d2.window.Event('click',{bubbles:true}));
  ok(/sleep-screen/.test(doc.querySelector('[data-i18n="sleepHead"]').textContent),'section localised (EN)');
  console.log('\nRESULT: '+p+' passed, '+f+' failed');
  process.exit(f?1:0);
},80);
