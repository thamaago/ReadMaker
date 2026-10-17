// Complements EPUBCheck: PNG chunk CRCs and raster MIME signatures.
// This is not a complete pixel decoder; the Python output audit also uses Pillow.
const JSZip=require('jszip'),{JSDOM}=require('jsdom'),path=require('path').posix;
function crc32(bytes){
 let crc=0xffffffff;
 for(const byte of bytes){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
 return (crc^0xffffffff)>>>0;
}
function checkRaster(bytes,mime){
 const b=Buffer.from(bytes);
 const detected=b.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex'))?'image/png':
  b[0]===255&&b[1]===216&&b[2]===255?'image/jpeg':
  /^GIF8[79]a$/.test(b.subarray(0,6).toString('ascii'))?'image/gif':
  b.subarray(0,2).toString()==='BM'?'image/bmp':
  b.subarray(0,4).toString()==='RIFF'&&b.subarray(8,12).toString()==='WEBP'?'image/webp':null;
 if(detected!==mime)throw new Error('Raster MIME mismatch: '+detected+' vs '+mime);
 if(mime!=='image/png')return;
 let offset=8,ihdr=false,idat=false,iend=false;
 while(offset<b.length){
  if(offset+12>b.length)throw new Error('Truncated PNG chunk');
  const length=b.readUInt32BE(offset),end=offset+12+length;
  if(end>b.length)throw new Error('Truncated PNG payload');
  const type=b.toString('ascii',offset+4,offset+8);
  if(crc32(b.subarray(offset+4,end-4))!==b.readUInt32BE(end-4))throw new Error('PNG CRC mismatch: '+type);
  if(!ihdr){
   if(type!=='IHDR'||length!==13||!b.readUInt32BE(offset+8)||!b.readUInt32BE(offset+12))throw new Error('Invalid PNG IHDR');
   ihdr=true;
  }else if(type==='IHDR')throw new Error('Duplicate PNG IHDR');
  if(type==='IDAT')idat=true;
  if(type==='IEND'){
   if(length||!idat||end!==b.length)throw new Error('Invalid PNG IEND');
   iend=true;
  }
  offset=end;
 }
 if(!iend)throw new Error('Missing PNG IEND');
}
function xml(text){return new JSDOM(text,{contentType:'application/xml'}).window.document;}
async function checkEpubImages(bytes){
 const zip=await JSZip.loadAsync(bytes,{checkCRC32:true});
 const container=xml(await zip.file('META-INF/container.xml').async('string'));
 const opfPath=container.querySelector('rootfile').getAttribute('full-path');
 const opf=xml(await zip.file(opfPath).async('string'));
 let count=0;
 for(const item of opf.querySelectorAll('manifest > item')){
  const mime=item.getAttribute('media-type');
  if(!mime.startsWith('image/')||mime==='image/svg+xml')continue;
  const href=item.getAttribute('href');
  if(/^(?:[a-z][\w+.-]*:|\/\/)/i.test(href))throw new Error('Remote raster resource: '+href);
  const name=path.normalize(path.join(path.dirname(opfPath),decodeURIComponent(href.split('#')[0]))),file=zip.file(name);
  if(!file)throw new Error('Missing raster resource: '+name);
  try{checkRaster(await file.async('nodebuffer'),mime);}catch(error){throw new Error(name+': '+error.message);}
  count++;
 }
 return count;
}
module.exports={checkRaster,checkEpubImages};
