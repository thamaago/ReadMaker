const fs=require('fs');const {JSDOM}=require('jsdom');
const dom=new JSDOM('<!DOCTYPE html><body></body>');global.window=dom.window;global.document=dom.window.document;global.DOMParser=dom.window.DOMParser;global.TextEncoder=require('util').TextEncoder;
let core=[...fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8').matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map(x=>x[1]).pop();
core=core.slice(0,core.indexOf('/* ============================ orchestration')).replace(/^\s*["']use strict["'];\s*/,'');(0,eval)(core);
let p=0,f=0;const ok=(c,m)=>{c?(p++):(f++);console.log((c?'  ok  ':'  FAIL')+' '+m);};

// device-exact decoders (mirror lib/Xtc)
function parseXtc(buf){
  const dv=new DataView(buf.buffer,buf.byteOffset,buf.byteLength);
  const magic=dv.getUint32(0,true); const twoBit=(magic===0x48435458);
  const pageCount=dv.getUint16(6,true);
  const pt=Number(dv.getBigUint64(0x18,true));
  const pages=[];
  for(let i=0;i<pageCount;i++){
    const pe=pt+i*16; const off=Number(dv.getBigUint64(pe,true)); const w=dv.getUint16(pe+12,true), h=dv.getUint16(pe+14,true);
    const pm=dv.getUint32(off,true); const pw=dv.getUint16(off+4,true), ph=dv.getUint16(off+6,true);
    const bmp=buf.subarray(off+22, off+22+ (twoBit?((pw*ph+7>>3)*2):(((pw+7)>>3)*ph)));
    pages.push({twoBit,w:pw,h:ph,bmp,magic:pm});
  }
  return {magic,twoBit,pageCount,pages};
}
function decodePixel(page,x,y){
  const {w,h,bmp,twoBit}=page;
  if(!twoBit){ const rowBytes=(w+7)>>3; const bit=(bmp[y*rowBytes+(x>>3)]>>(7-(x&7)))&1; return bit?255:0; }
  const planeSize=(w*h+7)>>3, colBytes=(h+7)>>3;
  const off=(w-1-x)*colBytes+(y>>3), b=7-(y&7);
  const bit1=(bmp[off]>>b)&1, bit2=(bmp[planeSize+off]>>b)&1; const v=(bit1<<1)|bit2;
  return v===0?255:v===1?85:v===2?170:0; // palette luminance
}

// --- build a 2-page doc, 1-bit ---
function mkGray(w,h,fn){ const g=new Uint8ClampedArray(w*h); for(let y=0;y<h;y++)for(let x=0;x<w;x++)g[y*w+x]=fn(x,y); return g; }
const W=16,H=8;
const p1=mkGray(W,H,(x,y)=> (x<8?0:255));      // left black, right white
const p2=mkGray(W,H,(x,y)=> ((x+y)&1)?255:0);  // checker
const xtc=buildXtc([{gray:p1,w:W,h:H},{gray:p2,w:W,h:H}],{twoBit:false,title:'T',author:'A'});
const P=parseXtc(xtc);
ok(P.magic===0x00435458,'XTC magic (1-bit)');
ok(P.pageCount===2,'pageCount=2');
ok(P.pages[0].magic===0x00475458,'page magic XTG');
let okpix=true; for(let y=0;y<H;y++)for(let x=0;x<W;x++){ const exp=p1[y*W+x]>=128?255:0; if(decodePixel(P.pages[0],x,y)!==exp)okpix=false; }
ok(okpix,'XTG page0 round-trips pixel-exact');
okpix=true; for(let y=0;y<H;y++)for(let x=0;x<W;x++){ const exp=p2[y*W+x]>=128?255:0; if(decodePixel(P.pages[1],x,y)!==exp)okpix=false; }
ok(okpix,'XTG page1 (checker) round-trips');

// --- 2-bit XTCH round-trip with 4 tones ---
const g4=mkGray(W,H,(x,y)=> [0,85,170,255][(x>>2)&3]); // 4 vertical bands = 4 tones
const xtch=buildXtc([{gray:g4,w:W,h:H}],{twoBit:true,title:'',author:''});
const P2=parseXtc(xtch);
ok(P2.magic===0x48435458,'XTCH magic (2-bit)');
ok(P2.pages[0].magic===0x00485458,'page magic XTH');
okpix=true; for(let y=0;y<H;y++)for(let x=0;x<W;x++){ const src=g4[y*W+x]; const expV=[255,85,170,0][grayToXthVal(src)]; if(decodePixel(P2.pages[0],x,y)!==expV)okpix=false; }
ok(okpix,'XTH 2-bit round-trips all 4 tones pixel-exact');

// --- header offsets sanity ---
const dv=new DataView(xtc.buffer);
ok(Number(dv.getBigUint64(0x18,true))===0x138,'pageTableOffset=0x138');
ok(Number(dv.getBigUint64(0x20,true))===0x138+2*16,'dataOffset after page table');
ok(xtc[0x09]===1,'hasMetadata=1');
// panel-size packing sizes correct for 480x800
const big=buildXtc([{gray:new Uint8ClampedArray(480*800),w:480,h:800}],{twoBit:false});
const bp=parseXtc(big).pages[0]; ok(bp.bmp.length===((480+7)>>3)*800,'480x800 XTG bitmap size correct ('+bp.bmp.length+')');
const bigH=buildXtc([{gray:new Uint8ClampedArray(480*800),w:480,h:800}],{twoBit:true});
const bph=parseXtc(bigH).pages[0]; ok(bph.bmp.length===((480*800+7)>>3)*2,'480x800 XTH bitmap size correct ('+bph.bmp.length+')');

console.log('\nRESULT: '+p+' passed, '+f+' failed');process.exit(f?1:0);
