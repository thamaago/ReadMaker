// End-to-end browser smoke/load test. Run: node tests/browser-stress.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const page = path.join(root, '.browser-stress-run.html');
const profile = path.join(os.tmpdir(), `readmaker-browser-stress-${process.pid}`);
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const app = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const harness = `<script>
document.addEventListener('DOMContentLoaded', async function () {
  const result = { browser: navigator.userAgent };
  const stamp = async (name, fn) => {
    result[name] = await fn();
  };
  try {
    await stamp('uiFileToDownload', async () => {
      const input = 'Chapter One\\n\\n' + ('A browser file flow paragraph. '.repeat(5000));
      const file = new File([input], 'stress.txt', {type:'text/plain'});
      await handle(file);
      if ($('build').disabled || !parsed) throw Error('file ingest did not enable build');
      const previous = lastBuiltBlob;
      const oldClick = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function () {};
      try {
        $('build').click();
        for (let i=0; i<500 && lastBuiltBlob===previous; i++) await new Promise(r=>setTimeout(r,10));
      } finally { HTMLAnchorElement.prototype.click = oldClick; }
      if (!lastBuiltBlob || lastBuiltBlob===previous) throw Error('UI build did not produce blob: '+$('status').textContent);
      const zip=await JSZip.loadAsync(await lastBuiltBlob.arrayBuffer());
      if (!zip.file('OEBPS/content.opf')) throw Error('UI EPUB package missing');
      return {sourceKB:Math.round(input.length/1024), outputKB:Math.round(lastBuiltBlob.size/1024)};
    });
    await stamp('text', async () => {
      const input = Array.from({length:3000}, (_,i) =>
        (i % 100 === 0 ? '\\n\\nChapter ' + (i/100+1) + '\\n\\n' : '') +
        'Ordinary paragraph of repeated text. '.repeat(10) + '\\n\\n').join('');
      const chapters = splitChapters(txtToHtml(input), 'auto');
      if (chapters.length !== 30) throw Error('chapter loss: ' + chapters.length);
      return {sourceKB: Math.round(input.length/1024), chapters: chapters.length};
    });
    await stamp('epub', async () => {
      const chapters = Array.from({length:200}, (_,i) => ({title:'Chapter '+(i+1), html:'<p>'+('Text '.repeat(200))+'</p>'}));
      const blob = await buildEpub({title:'Browser Stress',author:'QA',language:'en',images:[],chapters});
      const zip = await JSZip.loadAsync(await blob.arrayBuffer());
      const opf = await zip.file('OEBPS/content.opf').async('string');
      if ((opf.match(/<itemref /g)||[]).length !== 200) throw Error('spine loss');
      return {chapters:200, epubKB:Math.round(blob.size/1024)};
    });
    await stamp('canvas', async () => {
      const cv = document.createElement('canvas'); cv.width=480; cv.height=800;
      const ctx=cv.getContext('2d');
      const data=ctx.createImageData(480,800);
      for(let i=0;i<data.data.length;i+=4){const v=(i/4)%256;data.data[i]=v;data.data[i+1]=v;data.data[i+2]=v;data.data[i+3]=255;}
      ctx.putImageData(data,0,0);
      const gray=rgbaToGray(ctx.getImageData(0,0,480,800).data,480,800);
      floydSteinberg(gray,480,800,4);
      if(gray.length!==384000 || ![0,85,170,255].includes(gray[12345])) throw Error('canvas output invalid');
      return {pixels:gray.length};
    });
    result.ok = true;
  } catch(e) { result.ok = false; result.error = String(e && e.stack || e); }
  if (performance.memory) result.heapMB = +(performance.memory.usedJSHeapSize / 1048576).toFixed(1);
  const out = document.createElement('pre'); out.id='stress-results'; out.textContent=JSON.stringify(result);
  document.body.appendChild(out);
});
</script>`;
if (fs.existsSync(page)) throw new Error('temporary browser test page already exists');
const bodyEnd = app.lastIndexOf('</body>');
if (bodyEnd < 0) throw new Error('app body closing tag not found');
fs.writeFileSync(page, app.slice(0, bodyEnd) + harness + app.slice(bodyEnd));
try {
  const html = execFileSync(chrome, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--enable-precise-memory-info',
    `--user-data-dir=${profile}`, '--virtual-time-budget=60000', '--dump-dom',
    new URL(`file:///${page.replace(/\\/g, '/')}`).href
  ], { encoding:'utf8', maxBuffer: 4 * 1024 * 1024, timeout: 90000 });
  const match = html.match(/<pre id="stress-results">([\s\S]*?)<\/pre>/);
  if (!match) throw new Error('browser did not finish test: ' + html.slice(-1200));
  const raw = match[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  const result = JSON.parse(raw);
  console.log(JSON.stringify(result));
  if (!result.ok) process.exitCode = 1;
} finally {
  fs.unlinkSync(page);
  const tempRoot = path.resolve(os.tmpdir());
  const target = path.resolve(profile);
  if (target.startsWith(tempRoot + path.sep) && path.basename(target).startsWith('readmaker-browser-stress-')) {
    fs.rmSync(target, { recursive:true, force:true });
  }
}
