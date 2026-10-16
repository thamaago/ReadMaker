// External conformance gate. A missing validator or any warning fails the gate.
const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process');
const root=path.resolve(__dirname,'..');
const jar=path.resolve(process.argv[2]||path.join(root,'tmp/xteink-conversion/validator/epubcheck-5.4.0/epubcheck.jar'));
const folder=path.resolve(process.argv[3]||path.join(root,'output/epub/validation'));
if(!fs.existsSync(jar))throw new Error('EPUBCheck jar not found: '+jar);
const files=fs.readdirSync(folder).filter(name=>name.endsWith('.epub')).sort();
if(!files.length)throw new Error('No EPUB fixtures found in '+folder);
let failed=0;
for(const file of files){
 const result=spawnSync('java',['-jar',jar,path.join(folder,file),'--failonwarnings','--json',path.join(folder,file+'.epubcheck.json')],{encoding:'utf8'});
 fs.writeFileSync(path.join(folder,file+'.epubcheck.log'),(result.stdout||'')+(result.stderr||''));
 const passed=!result.error&&result.status===0;console.log((passed?'PASS ':'FAIL ')+file);
 if(!passed){failed++;console.error(result.error||result.stdout||result.stderr);}
}
if(failed)process.exitCode=1;
