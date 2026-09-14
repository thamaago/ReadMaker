const fs = require('fs');
const { JSDOM } = require('jsdom');
const JSZip = require('jszip');

// Build a DOM so browser APIs exist
const dom = new JSDOM('<!DOCTYPE html><body></body>', { url: 'https://localhost/' });
const { window } = dom;
global.window = window;
global.document = window.document;
global.DOMParser = window.DOMParser;
global.XMLSerializer = window.XMLSerializer;
global.Node = window.Node;
global.JSZip = JSZip;
global.crypto = { randomUUID: () => '12345678-1234-4321-abcd-1234567890ab' };
global.atob = (s) => Buffer.from(s, 'base64').toString('binary');

// Extract ONLY the pure pipeline functions from the HTML app script (avoid DOM-wiring at bottom)
const html = fs.readFileSync(require('path').join(__dirname,'..','index.html'), 'utf8');
const app = [...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map(x => x[1]).pop();

// cut everything from the "orchestration" event-wiring section onward, keep functions
const cut = app.indexOf('/* ============================ orchestration');
let core = app.slice(0, cut).replace(/^\s*["']use strict["'];\s*/, '');
// indirect eval in sloppy mode -> function declarations become globals
(0, eval)(core);

(async () => {
  let pass = 0, fail = 0;
  const ok = (c, m) => { if (c) { pass++; console.log('  ok  ', m); } else { fail++; console.log('  FAIL', m); } };

  // ---- Markdown ----
  const md = `# The First Book

A paragraph with **bold**, *italic*, and \`code\`.

## Chapter Two

- one
- two

> a quote

# The Third

Final words.`;
  const mdHtml = mdToHtml(md);
  ok(/<h1>The First Book<\/h1>/.test(mdHtml), 'md: H1 parsed');
  ok(/<strong>bold<\/strong>/.test(mdHtml), 'md: bold');
  ok(/<em>italic<\/em>/.test(mdHtml), 'md: italic');
  ok(/<ul><li>one<\/li>/.test(mdHtml), 'md: list');
  ok(/<blockquote>/.test(mdHtml), 'md: blockquote');

  const chAuto = splitChapters(mdHtml, 'auto');
  ok(chAuto.length === 2, 'md auto-split -> 2 H1 chapters (got ' + chAuto.length + ')');
  ok(chAuto[0].title === 'The First Book', 'md chapter title from H1');

  const chH1H2 = splitChapters(mdHtml, 'h1h2');
  ok(chH1H2.length === 3, 'md h1+h2 -> 3 chapters (got ' + chH1H2.length + ')');

  // ---- XHTML well-formedness ----
  const x = toXhtml('T & <t>', '<p>hi<br>there</p><img src="a.png">');
  const reparse = new window.DOMParser().parseFromString(x, 'application/xhtml+xml');
  ok(!reparse.querySelector('parsererror'), 'xhtml: well-formed after serialize (void tags self-closed)');
  ok(/<br\s*\/>/.test(x), 'xhtml: <br/> self-closed');
  ok(/<img[^>]*\/>/.test(x), 'xhtml: <img/> self-closed');

  // ---- Plain text ----
  const txt = `Chapter 1\n\nThe wind blew\nacross the plain.\n\nIt was cold.\n\nChapter 2\n\nMorning came.`;
  const txtHtml = txtToHtml(txt);
  ok((txtHtml.match(/<h1>/g) || []).length === 2, 'txt: 2 chapter headings detected');
  ok(/The wind blew across the plain\./.test(txtHtml), 'txt: soft-wrapped lines joined');

  // ---- Full EPUB build ----
  const book = {
    title: 'Test Book', author: 'A. Author', language: 'en',
    images: [], coverName: '',
    chapters: splitChapters(mdHtml, 'auto')
  };
  const blob = await buildEpub(book);
  // jszip returns a Blob-like in browser; in node w/ jszip type 'blob' -> Blob polyfilled by jsdom? use arraybuffer instead
  // buildEpub used type:'blob'; convert: read via JSZip again
  const buf = Buffer.from(await blob.arrayBuffer());
  fs.writeFileSync('sample.epub', buf);
  const zip = await JSZip.loadAsync(buf);

  // mimetype must exist, be first, uncompressed, exact content
  const names = Object.keys(zip.files);
  ok(names[0] === 'mimetype', 'epub: mimetype is first entry');
  const mime = await zip.file('mimetype').async('string');
  ok(mime === 'application/epub+zip', 'epub: mimetype content correct');

  ok(!!zip.file('META-INF/container.xml'), 'epub: container.xml present');
  const container = await zip.file('META-INF/container.xml').async('string');
  ok(/full-path="OEBPS\/content\.opf"/.test(container), 'epub: container points to content.opf');

  const opf = await zip.file('OEBPS/content.opf').async('string');
  ok(/<dc:title>Test Book<\/dc:title>/.test(opf), 'epub: opf title');
  ok(/<dc:creator>A\. Author<\/dc:creator>/.test(opf), 'epub: opf author');
  ok(/<dc:language>en<\/dc:language>/.test(opf), 'epub: opf language');
  ok(/<dc:date>\d{4}-\d{2}-\d{2}<\/dc:date>/.test(opf), 'epub: publication date');
  ok(/<meta name="generator" content="Read Maker"\/>/.test(opf), 'epub: generator metadata');
  ok(/<spine toc="ncx">/.test(opf), 'epub: spine references ncx');
  ok((opf.match(/<itemref/g) || []).length === 2, 'epub: spine has 2 chapter itemrefs');

  // OPF must be valid XML
  const opfDoc = new window.DOMParser().parseFromString(opf, 'application/xml');
  ok(!opfDoc.querySelector('parsererror'), 'epub: content.opf is valid XML');

  ok(!!zip.file('OEBPS/nav.xhtml'), 'epub: nav.xhtml present (EPUB3)');
  ok(!!zip.file('OEBPS/toc.ncx'), 'epub: toc.ncx present (EPUB2 fallback)');
  const ncx = await zip.file('OEBPS/toc.ncx').async('string');
  ok(!new window.DOMParser().parseFromString(ncx, 'application/xml').querySelector('parsererror'), 'epub: toc.ncx valid XML');

  ok(!!zip.file('OEBPS/chap001.xhtml') && !!zip.file('OEBPS/chap002.xhtml'), 'epub: chapter files present');
  const c1 = await zip.file('OEBPS/chap001.xhtml').async('string');
  ok(!new window.DOMParser().parseFromString(c1, 'application/xhtml+xml').querySelector('parsererror'), 'epub: chapter XHTML valid');

  console.log('\nRESULT: ' + pass + ' passed, ' + fail + ' failed');
  console.log('sample.epub written (' + buf.length + ' bytes)');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR:', e); process.exit(2); });
