// Run manually: node --expose-gc tests/manual-stress.js
// Larger, timed workloads that are intentionally excluded from npm test.
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');
const { JSDOM } = require('jsdom');
const JSZip = require('jszip');

const dom = new JSDOM('<!DOCTYPE html><body></body>', { url: 'https://localhost/' });
global.window = dom.window;
global.document = dom.window.document;
global.DOMParser = dom.window.DOMParser;
global.XMLSerializer = dom.window.XMLSerializer;
global.JSZip = JSZip;
global.TextEncoder = require('util').TextEncoder;
global.crypto = { randomUUID: () => '77777777-8888-4999-8aaa-bbbbbbbbbbbb' };
global.atob = s => Buffer.from(s, 'base64').toString('binary');
global.btoa = s => Buffer.from(s, 'binary').toString('base64');
global.Blob = dom.window.Blob;
global.t = k => k;
const source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const app = [...source.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map(x => x[1]).pop();
const cut = app.indexOf('/* ============================ orchestration');
(0, eval)(app.slice(0, cut).replace(/^\s*["']use strict["'];\s*/, ''));

async function measure(name, fn) {
  if (global.gc) global.gc();
  const before = process.memoryUsage();
  const start = performance.now();
  const result = await fn();
  const after = process.memoryUsage();
  console.log(JSON.stringify({
    name, ms: Math.round(performance.now() - start),
    heapDeltaMB: +((after.heapUsed - before.heapUsed) / 1048576).toFixed(1),
    rssAfterMB: +(after.rss / 1048576).toFixed(1), ...result
  }));
}

(async () => {
  const textBlocks = Number(process.env.STRESS_TEXT_BLOCKS || 12000);
  const text = Array.from({ length: textBlocks }, (_, i) =>
    (i % 100 === 0 ? `\n\nChapter ${i / 100 + 1}\n\n` : '') +
    'A long paragraph of ordinary prose, numbers 12345, and punctuation. '.repeat(10) + '\n\n'
  ).join('');
  await measure('text-ingest-and-chapter-split', async () => {
    const html = txtToHtml(text);
    const chapters = splitChapters(html, 'auto');
    const expected = Math.ceil(textBlocks / 100);
    if (chapters.length !== expected) throw new Error(`expected ${expected} chapters, got ${chapters.length}`);
    return { sourceMB: +(text.length / 1048576).toFixed(1), chapters: chapters.length };
  });

  const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC', 'base64');
  const count = Number(process.env.STRESS_PAGES || 300);
  const cbz = new JSZip();
  for (let i = count; i >= 1; i--) cbz.file(`Chapter ${Math.ceil(i / 50)}/${i}.png`, tinyPng);
  const cbzBytes = await cbz.generateAsync({ type: 'nodebuffer' });
  let parsed;
  await measure('cbz-ingest', async () => {
    parsed = await cbzToBook(cbzBytes);
    if (parsed.pages.length !== count || parsed.images.length !== count) throw new Error('CBZ page loss');
    return { pages: parsed.pages.length };
  });
  await measure('epub-build-and-validate', async () => {
    const chapters = parsed.pages.map((name, i) => ({ title: `Page ${i + 1}`, html: `<div><img src="images/${name}"/></div>` }));
    const blob = await buildEpub({ title: 'Stress', author: 'QA', language: 'en', images: parsed.images, coverName: '', comic: true, chapters });
    const epubBytes = Buffer.from(await blob.arrayBuffer());
    const epub = await JSZip.loadAsync(epubBytes);
    const opf = await epub.file('OEBPS/content.opf').async('string');
    const nav = await epub.file('OEBPS/nav.xhtml').async('string');
    if ((opf.match(/<itemref /g) || []).length !== count) throw new Error('spine page loss');
    if ((nav.match(/<li>/g) || []).length !== count) throw new Error('TOC page loss');
    if (!epub.file(`OEBPS/chap${String(count).padStart(3, '0')}.xhtml`)) throw new Error('last chapter missing');
    if (new DOMParser().parseFromString(opf, 'application/xml').querySelector('parsererror')) throw new Error('invalid OPF');
    return { pages: count, epubKB: Math.round(epubBytes.length / 1024) };
  });

  await measure('xtc-100-full-panel-pages', async () => {
    const gray = new Uint8ClampedArray(480 * 800);
    for (let i = 0; i < gray.length; i++) gray[i] = i % 256;
    const pages = Array.from({ length: 100 }, () => ({ gray, w: 480, h: 800 }));
    const xtc = buildXtc(pages, { twoBit: false, title: 'Stress' });
    const xtch = buildXtc(pages, { twoBit: true, title: 'Stress' });
    const one = new DataView(xtc.buffer, xtc.byteOffset, xtc.byteLength);
    const two = new DataView(xtch.buffer, xtch.byteOffset, xtch.byteLength);
    if (one.getUint16(6, true) !== 100 || two.getUint16(6, true) !== 100) throw new Error('native page loss');
    return { pages: 100, xtcMB: +(xtc.length / 1048576).toFixed(1), xtchMB: +(xtch.length / 1048576).toFixed(1) };
  });

  await measure('dictionary-100k-entries', async () => {
    const rows = Array.from({ length: 100000 }, (_, i) => [`word${String(i).padStart(6, '0')}`, `definition ${i}`]);
    const dict = buildStarDict(rows, { bookname: 'Stress Dictionary' });
    if (dict.wordcount !== rows.length) throw new Error('dictionary entry loss');
    return { entries: dict.wordcount, idxMB: +(dict.idx.length / 1048576).toFixed(1) };
  });

  await measure('malformed-cbz-rejection', async () => {
    let rejected = 0;
    for (const bytes of [Buffer.alloc(0), Buffer.from('not a zip'), Buffer.from([0x50, 0x4b, 0x03, 0x04])]) {
      try { await cbzToBook(bytes); } catch (_) { rejected++; }
    }
    if (rejected !== 3) throw new Error('malformed CBZ accepted');
    return { rejected };
  });

  await measure('batch-50-epubs', async () => {
    const archive = new JSZip();
    for (let i = 0; i < 50; i++) {
      const chapters = Array.from({ length: 10 }, (_, j) => ({ title: `Chapter ${j + 1}`, html: `<p>Book ${i}, chapter ${j}. ${'Text '.repeat(200)}</p>` }));
      const blob = await buildEpub({ title: `Book ${i}`, author: 'QA', language: 'en', images: [], chapters });
      archive.file(`book-${i}.epub`, Buffer.from(await blob.arrayBuffer()));
    }
    const bytes = await archive.generateAsync({ type: 'nodebuffer' });
    const zip = await JSZip.loadAsync(bytes);
    if (Object.keys(zip.files).length !== 50 || !zip.file('book-49.epub')) throw new Error('batch output loss');
    return { books: 50, zipKB: Math.round(bytes.length / 1024) };
  });
})().catch(err => { console.error(err); process.exitCode = 1; });
