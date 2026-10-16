// Render actual exported EPUB chapters and create an offline inspection page.
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output/epub/stress-lab');
const JSZip=require('jszip');
const {chromium}=process.env.READMAKER_RUNTIME_MODULES?require(path.join(process.env.READMAKER_RUNTIME_MODULES,'playwright')):require('playwright');
async function epub(key){
 const zip=await JSZip.loadAsync(fs.readFileSync(path.join(out,key+'.epub')));
 const names=Object.keys(zip.files).filter(n=>/^OEBPS\/chap\d+\.xhtml$/.test(n)).sort();
 const chapters=[];
 for(const name of names){
  const x=await zip.file(name).async('string');let body=x.match(/<body[^>]*>([\s\S]*)<\/body>/)[1];
  for(const m of [...body.matchAll(/src="([^"]+)"/g)]){
   const file=path.posix.normalize(path.posix.join(path.posix.dirname(name),m[1]));
   body=body.replace(m[0],'src="data:image/png;base64,'+await zip.file(file).async('base64')+'"');
  }
  chapters.push({body,name});
 }
 return {chapters,css:await zip.file('OEBPS/style.css').async('string'),fixed:key==='complex-layout'};
}
function render(chapter,book,font){return '<!doctype html><html lang="id"><meta charset="utf-8"><style>'+book.css+'\nhtml{background:white;color:black;font-size:'+font+'px}'+(!book.fixed?'body{font-family:Georgia,serif;margin:18px}':'')+'</style><body>'+chapter.body+'</body></html>';}
(async()=>{
 const fixtures=JSON.parse(fs.readFileSync(path.join(root,'output/pdf/stress-lab/ground-truth.json'),'utf8')).documents[0].pages;
 const quality=JSON.parse(fs.readFileSync(path.join(out,'quality-results.json'),'utf8'));
 const checks=JSON.parse(fs.readFileSync(path.join(out,'page-checks.json'),'utf8'));
 const books={};for(const key of ['complex-reflow','complex-layout','semantic-reference'])books[key]=await epub(key);
 const sources=fixtures.map(f=>fs.readFileSync(path.join(root,'tmp/pdfs/stress-lab/source-'+String(f.page).padStart(2,'0')+'.png')).toString('base64'));
 const pack=JSON.stringify({fixtures,quality,checks,books,sources}).replace(/</g,'\\u003c');
 const html=`<!doctype html><html lang="id"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ReadMaker - Laboratorium PDF kompleks</title><style>*{box-sizing:border-box}body{margin:0;background:#eeeae2;color:#222;font:16px/1.5 system-ui,sans-serif}main{max-width:1450px;margin:auto;padding:24px}h1{font-size:28px}label{display:inline-block;margin:8px 14px 8px 0}select{font:inherit;padding:5px}table{border-collapse:collapse;background:white;max-width:100%}td,th{padding:10px;border:1px solid #ccc;text-align:left}#panels{display:flex;gap:20px;flex-wrap:wrap;margin-top:20px}section{background:white;border:1px solid #ccc;padding:14px;max-width:100%}section h2{font-size:18px}iframe{border:1px solid #aaa;display:block;max-width:100%;background:white}#source{display:block;max-width:100%;border:1px solid #aaa}#finding{background:#fff5de;padding:12px;max-width:1000px}small{display:block;max-width:85ch}.scroll{overflow-x:auto}</style><main><h1>Laboratorium PDF kompleks ReadMaker</h1><p>48 halaman sulit dan dokumen panjang 1.200 halaman dikonversi melalui pemilih berkas dan tombol Buat EPUB aplikasi. Hasil di bawah berasal dari EPUB mentah, tanpa koreksi manual.</p><div class="scroll"><table><thead><tr><th>Jalur</th><th>Penanda tepat</th><th>Frasa lolos</th><th>Galat token normalisasi</th><th>EPUBCheck</th></tr></thead><tbody id="summary"></tbody></table></div><p>Penanda harus cocok persis. Salah baca O/0 pada kode ikut dihitung gagal; angka ini bukan persentase teks yang hilang. Galat token mencakup kehilangan, substitusi, tambahan, dan perubahan urutan. Ia bukan skor OCR murni.</p><label>Halaman <select id="page"></select></label><label>Hasil <select id="mode"><option value="complex-reflow">PDF → teks mengalir + OCR</option><option value="complex-layout">PDF → halaman asli</option><option value="semantic-reference">HTML acuan → EPUB</option></select></label><label>Lebar <select id="width"><option>320</option><option selected>480</option><option>528</option><option>540</option></select> px</label><label>Font <select id="font"><option>18</option><option selected>22</option><option>28</option></select> px</label><p id="finding"></p><div id="panels"><section><h2>Sumber PDF</h2><img id="source" alt="Halaman sumber uji"/></section><section><h2>Hasil EPUB aplikasi</h2><iframe id="result" title="Hasil EPUB" height="800"></iframe></section></div><small>Preview sumber adalah render PDF 90 dpi. Font mengubah hasil reflow; halaman asli tetap berupa gambar. Simulasi browser tidak mengemulasikan firmware, dithering, atau layar fisik e-ink. HTML acuan membandingkan jalur teks semantik, bukan memperbaiki hasil PDF dan tidak menguji retensi ilustrasi.</small></main><script>const data=${pack};const render=${render.toString()};const $=id=>document.getElementById(id);$('summary').innerHTML=data.quality.map(q=>'<tr><td>'+q.key+'</td><td>'+(q.markersRetained==null?'Gambar':q.markersRetained+'/'+q.markersExpected)+'</td><td>'+(q.phraseChecksExpected?q.phraseChecksPassed+'/'+q.phraseChecksExpected:'—')+'</td><td>'+(q.normalizedWerPercent==null?'Tidak diukur':q.normalizedWerPercent+'%')+'</td><td>'+q.epubcheck.nError+' error / '+q.epubcheck.nWarning+' warning</td></tr>').join('');$('page').replaceChildren(...data.fixtures.map(f=>new Option(f.page+' · '+f.variant+' · '+f.caseName,f.page)));$('page').value='3';function show(){const n=Number($('page').value)-1,key=$('mode').value,b=data.books[key],f=data.fixtures[n],width=Number($('width').value);$('source').src='data:image/png;base64,'+data.sources[n];$('source').style.width=width+'px';$('result').style.width=width+'px';$('result').srcdoc=render(b.chapters[n],b,Number($('font').value));const check=data.checks.find(c=>c.run===key&&c.page===n+1);$('finding').textContent=check?('Halaman '+(n+1)+': penanda tepat '+check.markersRetained+'/3; galat token '+check.normalizedWerPercent+'%; frasa gagal: '+check.checks.filter(c=>!c.passed).map(c=>c.phrase).join('; ')+(check.columnOrder===null?'':'; urutan kolom '+(check.columnOrder?'lolos':'gagal / label tidak pulih'))):'Halaman asli: periksa tata letak dan ketajaman secara visual. Ukuran font pembaca tidak memperbesar teks dalam gambar.';}['page','mode','width','font'].forEach(id=>$(id).addEventListener('change',show));show();</script></html>`;
 fs.writeFileSync(path.join(out,'simulasi-pdf-kompleks.html'),html);
 const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_BIN||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 const layouts=[];
 try{
  const page=await browser.newPage();
  for(const [key,b] of Object.entries(books))for(const width of [320,480,540])for(const font of [18,28]){
   await page.setViewportSize({width,height:800});
   for(let n=0;n<b.chapters.length;n++){
    await page.setContent(render(b.chapters[n],b,font));await page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));
    const test=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,images:[...document.images].every(i=>i.complete&&i.naturalWidth>0)}));
    layouts.push({key,page:n+1,width,font,...test,overflow:test.scrollWidth>width});
    if(width===480&&font===18&&[2,4,5,10,17,28,29,41].includes(n))await page.screenshot({path:path.join(out,key+'-page-'+(n+1)+'-480.png')});
   }
  }
  await page.setViewportSize({width:1180,height:1100});await page.goto('file:///'+path.join(out,'simulasi-pdf-kompleks.html').replace(/\\/g,'/'));await page.screenshot({path:path.join(out,'simulasi-ringkasan.png')});
 }finally{await browser.close();}
 fs.writeFileSync(path.join(out,'layout-results.json'),JSON.stringify(layouts,null,2));
 console.log(JSON.stringify({layoutChecks:layouts.length,overflow:layouts.filter(t=>t.overflow).length,failedImages:layouts.filter(t=>!t.images).length}));
})().catch(e=>{console.error(e);process.exitCode=1;});
