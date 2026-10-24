// Repeat the complete regression suite against an unchanged source snapshot.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{spawnSync}=require('child_process');
const root=path.resolve(__dirname,'..'),out=path.join(root,'tmp/five-pass-audit');fs.mkdirSync(out,{recursive:true});
const assets=['index.html','pdf-review.js','device-compatibility.js','responsive.css','jszip.min.js'];
const fingerprint=()=>Object.fromEntries(assets.map(name=>[name,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,name))).digest('hex')]));
const sourceAssets=fingerprint(),suiteCount=fs.readdirSync(__dirname).filter(name=>name.endsWith('.test.js')).length,rounds=[];
for(let round=1;round<=5;round++){
 const log=path.join(out,'round-'+round+'.log'),fd=fs.openSync(log,'w'),start=Date.now();let result;
 try{result=spawnSync(process.execPath,[path.join(__dirname,'run.js')],{cwd:root,stdio:['ignore',fd,fd],timeout:300000});}finally{fs.closeSync(fd);}
 const unchanged=JSON.stringify(sourceAssets)===JSON.stringify(fingerprint());
 const entry={round,suiteCount,milliseconds:Date.now()-start,exitCode:result.status,signal:result.signal,error:result.error?.message||null,sourceUnchanged:unchanged,passed:result.status===0&&unchanged};rounds.push(entry);
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({date:new Date().toISOString(),sourceAssets,suiteCount,rounds},null,2));
 console.log((entry.passed?'PASS':'FAIL')+' '+round+'/5: '+suiteCount+' suites, '+entry.milliseconds+' ms');
 if(!entry.passed){process.exitCode=1;break;}
}
