const assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const {checkRaster,checkEpubImages}=require('./epub-image-integrity.cjs');
const png=fs.readFileSync(path.join(__dirname,'fixtures/validation-diagram.png'));
const jpg=fs.readFileSync(path.join(__dirname,'fixtures/validation-diagram.jpg'));
checkRaster(png,'image/png');checkRaster(jpg,'image/jpeg');
const corrupted=Buffer.from(png);let offset=8;
while(corrupted.toString('ascii',offset+4,offset+8)!=='IDAT')offset+=12+corrupted.readUInt32BE(offset);
corrupted[offset+8]^=1;
assert.throws(()=>checkRaster(corrupted,'image/png'),/CRC mismatch/);
assert.throws(()=>checkRaster(png,'image/jpeg'),/MIME mismatch/);
assert.throws(()=>checkRaster(png.subarray(0,png.length-4),'image/png'),/Truncated/);
assert.throws(()=>checkRaster(Buffer.from([1,2,3]),'image/png'),/MIME mismatch/);
// Exercise the package-level path too, not only a standalone byte helper.
(async()=>{
 const JSZip=require('jszip'),zip=new JSZip();
 zip.file('META-INF/container.xml','<container><rootfiles><rootfile full-path="EPUB/package.opf"/></rootfiles></container>');
 zip.file('EPUB/package.opf','<package><manifest><item href="images/a.png" media-type="image/png"/></manifest></package>');
 zip.file('EPUB/images/a.png',png);
 assert.equal(await checkEpubImages(await zip.generateAsync({type:'nodebuffer'})),1);
 zip.file('EPUB/images/a.png',corrupted);
 await assert.rejects(checkEpubImages(await zip.generateAsync({type:'nodebuffer'})),/a.png: PNG CRC/);
 console.log('Image preflight: valid PNG/JPEG pass; corrupt, truncated and mislabeled images fail.');
})().catch(error=>{console.error(error);process.exitCode=1;});
