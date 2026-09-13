const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');
const JSZip = require('jszip');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const dom = new JSDOM(html, {
  runScripts: 'dangerously', url: 'http://localhost/', virtualConsole: new VirtualConsole(),
  beforeParse(w) { w.JSZip = JSZip; }
});
const w = dom.window, d = w.document;
const el = id => d.getElementById(id);
const file = (name, text) => ({ name, size: text.length, text: async () => text });
let download;
w.URL.createObjectURL = blob => { download = blob; return 'blob:test'; };
w.URL.revokeObjectURL = () => {};
w.HTMLAnchorElement.prototype.click = () => {};
async function build() {
  download = null;
  el('build').click();
  for (let i = 0; i < 200 && el('build').disabled; i++) await new Promise(r => setTimeout(r, 10));
  assert.ok(download, 'build produces a download');
  return JSZip.loadAsync(await download.arrayBuffer());
}
(async () => {
  await w.handle(file('first.html', '<html lang="ar"><head><title>First Book</title><meta name="author" content="First Author"></head><body><p>First body.</p></body></html>'));
  assert.equal(el('author').value, 'First Author');
  assert.equal(el('lang').value, 'ar');
  await w.handle(file('second.md', '# Second Book\n\nSecond body.'));
  assert.equal(el('title').value, 'Second Book');
  assert.equal(el('author').value, '');
  assert.equal(el('lang').value, '');
  el('title').value = 'Edited title';
  el('title').dispatchEvent(new w.Event('input'));
  const edited = await build();
  assert.match(await edited.file('OEBPS/content.opf').async('string'), /Edited title/);
  await w.handle(file('fallback.txt', 'Body without metadata.'));
  assert.equal(el('title').value, 'fallback');
  console.log('  ok metadata resets on new sources and edits survive building');

  const inputs = [
    file('a.md', '# Same Title\n\nAlpha content.'),
    file('b.md', '# Same Title\n\nBeta content.'),
    file('c.md', '# Same_Title_2\n\nGamma content.'),
    file('d.md', '# Same_Title\n\nDelta content.')
  ];
  w.startBatch(inputs);
  const batch = await build();
  const names = Object.keys(batch.files);
  assert.equal(names.length, 4);
  const contents = [];
  for (const name of names) {
    const book = await JSZip.loadAsync(await batch.file(name).async('uint8array'));
    contents.push(await book.file('OEBPS/chap001.xhtml').async('string'));
  }
  for (const word of ['Alpha', 'Beta', 'Gamma', 'Delta']) assert.equal(contents.filter(c => c.includes(word + ' content.')).length, 1);
  console.log('  ok batch preserves every book across title, normalized-name and suffix collisions');

  const article = '<html><head><title>New Article</title></head><body><article><h1>New Article</h1><p>Article body with enough words to be extracted.</p></article></body></html>';
  for (const mode of ['paste', 'fetch']) {
    w.startBatch(inputs);
    if (mode === 'paste') { el('pasteHtml').value = article; el('pasteBtn').click(); }
    else { w.fetch = async () => ({ ok: true, text: async () => article }); await w.fetchArticle('https://example.com/article'); }
    assert.equal(w.batchFiles.length, 0);
    assert.equal(el('title').value, 'New Article');
    const book = await build();
    assert.ok(book.file('OEBPS/content.opf'), mode + ' downloads EPUB rather than batch ZIP');
    const chapters = await Promise.all(book.file(/OEBPS\/chap\d+\.xhtml/).map(f => f.async('string')));
    assert.match(chapters.join(''), /Article body/);
  }
  console.log('  ok paste and fetch replace batch and export the displayed article');
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => w.close());

