const fs=require('fs');const {JSDOM}=require('jsdom');const JSZip=require('jszip');
const dom=new JSDOM('<!DOCTYPE html><body></body>',{url:'https://localhost/'});
global.window=dom.window;global.document=dom.window.document;global.DOMParser=dom.window.DOMParser;global.XMLSerializer=dom.window.XMLSerializer;global.JSZip=JSZip;global.Blob=dom.window.Blob;global.crypto={randomUUID:()=>'x'};global.atob=s=>Buffer.from(s,'base64').toString('binary');global.btoa=s=>Buffer.from(s,'binary').toString('base64');global.URL=dom.window.URL;
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
let core=[...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map(x=>x[1]).pop();
core=core.slice(0,core.indexOf('/* ============================ orchestration')).replace(/^\s*["']use strict["'];\s*/,'');
(0,eval)(core);

let p=0,f=0;const ok=(c,m)=>{c?(p++,console.log('  ok  ',m)):(f++,console.log('  FAIL',m));};

// nearestLevel
ok(nearestLevel(200,2)===255 && nearestLevel(100,2)===0,'nearestLevel 1-bit thresholds');
ok(nearestLevel(0,4)===0 && nearestLevel(255,4)===255,'nearestLevel 2-bit extremes');
const samplingCtx={}; setHighQualityImageSampling(samplingCtx);
ok(samplingCtx.imageSmoothingEnabled===true && samplingCtx.imageSmoothingQuality==='high','image resize requests high-quality sampling');
const lv4=[0,85,170,255];
ok(lv4.includes(nearestLevel(90,4)),'nearestLevel 2-bit snaps to palette ('+nearestLevel(90,4)+')');

// rgbaToGray: red, white, black, transparent-over-white
const rgba=new Uint8ClampedArray([255,0,0,255, 255,255,255,255, 0,0,0,255, 12,34,56,0]);
const g=rgbaToGray(rgba,4,1);
ok(g[0]===76,'gray(red)=76 ('+g[0]+')');
ok(g[1]===255,'gray(white)=255');
ok(g[2]===0,'gray(black)=0');
ok(g[3]===255,'gray(transparent)=255 over white');

// quantize keeps values on palette
const grad=new Uint8ClampedArray(256); for(let i=0;i<256;i++)grad[i]=i;
const q=quantize(Uint8ClampedArray.from(grad),4);
ok(q.every(v=>lv4.includes(v)),'quantize -> all on 2-bit palette');

// floydSteinberg: output on palette, mean roughly preserved
const fsBuf=Uint8ClampedArray.from(grad);
floydSteinberg(fsBuf,16,16,2);
const pal2=[0,255];
ok(fsBuf.every(v=>pal2.includes(v)),'FS output strictly 1-bit');
const meanIn=grad.reduce((a,b)=>a+b,0)/256, meanOut=fsBuf.reduce((a,b)=>a+b,0)/256;
ok(Math.abs(meanIn-meanOut)<20,'FS preserves mean brightness ('+meanIn.toFixed(0)+' vs '+meanOut.toFixed(0)+')');

// bayer: output on palette
const bBuf=Uint8ClampedArray.from(grad); bayerDither(bBuf,16,16,4);
ok(bBuf.every(v=>lv4.includes(v)),'Bayer output on 2-bit palette');

// fitSize
let s=fitSize(1000,500,480,800); ok(s.w===480&&s.h===240,'fit 1000x500 -> 480x240');
s=fitSize(500,1000,480,800); ok(s.w===400&&s.h===800,'fit 500x1000 -> 400x800');
s=fitSize(300,300,480,800); ok(s.w===300&&s.h===300,'fit small stays');
s=fitSize(1000,1000,null,null); ok(s.w===1000&&s.h===1000,'fit none = passthrough');

// u8ToB64 round-trip
const rt=b64ToU8(u8ToB64(new Uint8Array([0,1,2,250,255])));
ok(rt.length===5 && rt[3]===250 && rt[4]===255,'u8<->b64 round-trip');

console.log('\nRESULT: '+p+' passed, '+f+' failed');process.exit(f?1:0);
