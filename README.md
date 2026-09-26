# Read Maker

A tiny, offline-friendly tool that turns everyday writing formats into clean **EPUB** books for e-ink readers — a host-side EPUB maker and companion for [CrossPoint Reader](https://github.com/crosspoint-reader/crosspoint-reader) (Xteink X3 / X4 / X4 Pro / papermono).
Here to Access https://thamaago.github.io/ReadMaker/

Everything runs **in your browser**. No account, no upload, no server. Two files: `index.html` + `jszip.min.js`.

> Unofficial community tool. It does **not** modify device firmware — it only produces EPUB files you copy to your reader.

---

## What it does

Converts these sources into a reflowable, chaptered EPUB the reader opens natively:

| Source | Notes |
| --- | --- |
| Plain text (`.txt`) | Detects `Chapter` / `Bab` / `Part` headings |
| Markdown (`.md`) | Headings, lists, bold/italic, links, quotes, code |
| Rich Text (`.rtf`) | Bold/italic, headings via outline level, title/author |
| HTML (`.html`) | Sanitised to safe, semantic markup |
| FictionBook (`.fb2`) | Metadata + embedded cover/images |
| OpenDocument (`.odt`) | Headings, styles, lists, embedded images |
| Word (`.docx`) | Via `mammoth.js` (loads once, needs a connection) |
| PDF (`.pdf`) | Via `pdf.js`; reconstructs paragraphs/headings, or preserves each source page as a fixed-layout EPUB image for complex/illustrated PDFs. Scanned PDFs can be read with optional OCR (Tesseract.js, Indonesian/English) |
| Kindle (`.mobi` / `.azw3`) | Non-DRM only; PalmDOC text + images + cover; **reads the book's own table of contents** to recover real chapter titles |
| Comics (`.cbz`) | One image per page; prepared for e-ink |
| Web articles | Paste a URL or the page HTML (reader mode). **AO3 works** are recognised: it fetches the full work and keeps title, author, summary and every chapter |

Extras:

- **E-ink image pipeline** — greyscale, panel-fit resize, and dithering (Floyd–Steinberg / ordered), matching the device's 2-bit greyscale palette (`0 / 85 / 170 / 255`).
- **Engine-tuned output** — EPUB 2/3 with both `nav.xhtml` and `toc.ncx`, well-formed XHTML, and CSS limited to the properties the reader actually honours (so the user's font/size/spacing settings win).
- **PDF layout and quality choice** — use *Reflow text* for adjustable e-ink typography, or *Keep original pages* for PDFs with illustrations, drop caps, tables, and complex placement. Fixed PDFs can keep the *Source* colour/resolution, use a smaller device-fit e-ink render, or use *E-ink detail*: source-sized 16-level grayscale without Floyd–Steinberg speckle, which keeps small type cleaner on LCD, ADE, and e-ink readers. After parsing, Read Maker shows a recommendation based on the text layer, image count, and detected layout; the choice remains yours. The latter produces EPUB 3 pre-paginated chapters and is intentionally larger.
- **Bilingual UI** (Indonesian / English) with a simple 3-step flow.
- **Review before build** — edit chapter titles, move chapters up/down, inspect a compact output summary, and preview the first chapter before downloading. The EPUB export uses the edited order and titles.
- **Chapter detection:** uses the book's built-in table of contents when there is one (PDF bookmarks, MOBI `filepos` offsets, the binary NCX/INDX index, or HTML `href="#id"` anchors), the way desktop converters do, instead of guessing from heading tags — which fails on books that wrap body prose or drop caps in `<h1>`. Falls back to heading detection, then to the book's own page-break separators, then to `Chapter`/`Bab` line patterns (a marker line and the chapter name that follows it are combined, e.g. "CHAPTER ONE: THE BOY WHO LIVED"). Titles that read like running text are rejected and replaced with a numbered label.
- **Batch conversion:** drop several files at once and get one ZIP of EPUBs back. Each file is converted independently, so a broken or unsupported file is reported in the queue and skipped rather than stopping the run.
- **Hierarchical contents:** when a book splits on headings and sub-headings, the EPUB gets a nested `nav.xhtml` and `toc.ncx` so the reader shows sub-chapters under their parent instead of one flat list.
- **Dictionary maker (CrossPoint / SUMI):** turn a `word<TAB>definition` list into a StarDict dictionary (`.ifo`/`.idx`/`.dict`) the device uses for long-press lookups. Entries are merged, sorted by byte order, and delivered as a `dictionaries/<name>/` folder to drop on the SD card.
- **Sleep-screen maker:** turn a photo or ID card into the wallpaper the device shows while asleep — `sleep.bmp` (indexed, using the device's own 0/85/170/255 grey levels) or `sleep-overlay.bmp` (32-bit BGRA, alpha preserved). Resizing requests the browser's highest-quality filter and preserves the complete source frame; high-contrast text cards automatically avoid speckle dithering while photographs retain tonal dithering. Copy the result to the SD card root.
- **Works beyond CrossPoint:** the EPUB output is standard EPUB 2/3 (both `toc.ncx` and `nav.xhtml`), so it also opens on the stock Xteink OS and other community firmware. A firmware selector under Advanced options picks the stylesheet: *Any* (default) adds image-scaling and heading-size rules that CrossPoint ignores but other engines need; *CrossPoint* keeps the leanest file. The `.xtc/.xtch` export uses Xteink's native page format. Sleep-screen files and direct Wi-Fi upload are CrossPoint-specific and are labelled as such.
- **Right-to-left scripts:** set the language to Arabic, Hebrew, Persian, Urdu (and similar) and the EPUB is marked `dir="rtl"` on every page plus `page-progression-direction="rtl"` on the spine, so pages turn the right way. OCR covers Arabic, Chinese (simplified/traditional), Japanese, Korean, Russian and major European languages alongside Indonesian and English.
- **Engine-matched markup:** output uses only the tags CrossPoint's parser understands. Since it doesn't handle `<pre>`/`<code>` and ignores `white-space`, fenced code blocks are rewritten to a real block with `<br/>` line breaks so code doesn't collapse onto one line.
- **Structural self-check** on build (each XHTML/OPF/NCX is re-parsed as XML).
- **Native comics export (optional):** for `.cbz`, you can also export directly to CrossPoint's native **`.xtc`** (1-bit) / **`.xtch`** (2-bit) page format — pre-rendered, so the reader just blits each page. Image pages only; targeted at the X4 480x800 panel. Numeric page names are sorted naturally, archive junk is ignored, and named CBZ folders become a chapter table without inventing a `#1` chapter for root-level covers. The XTC export uses the selected fit, tone count, and dithering mode.
- **Send directly over Wi-Fi (optional):** if this browser and your reader are on the same Wi-Fi, enter the reader's address after building and the file uploads straight to its SD card. The **Automatic** profile tries CrossPoint's faster WebSocket transfer first and falls back to the HTTP `/upload` endpoint; **Stock Xteink** uses HTTP directly, while **Generic HTTP** is available for compatible community firmware. Progress, cancellation, QR addresses, destination folders, and a stalled-transfer timeout are included.

---

## Use it

**Online:** open the GitHub Pages URL for this repo (see *Deploy* below).

**Locally:** download the repo and open `index.html` in any modern browser. Keep `index.html` and `jszip.min.js` **in the same folder**.

Then: drop a file (or paste a link) → check the title/chapters → **Create EPUB** → download.

### Put the EPUB on your reader

- **SD card:** copy the `.epub` to the reader's SD card (any folder), reinsert, open it from the file list.
- **Wi-Fi (manual):** turn on the reader's Wi-Fi sharing, open its built-in web page in a browser, and upload the `.epub` on the Files page.
- **Wi-Fi (direct from Read Maker):** after building, the address defaults to `crosspoint.local` (no IP needed on most networks) — or tap **QR** to scan the code on the device's Wi-Fi screen, or enter the IP (and optionally a destination folder, e.g. `Books`) in the "How to put it on your device" card and click Send. Choose **Stock Xteink** for stock firmware or leave **Automatic** for CrossPoint. You can cancel a transfer mid-flight, and a stalled upload times out on its own.
  - This needs the browser and the reader on the same network. Because the reader serves plain **HTTP**, an **HTTPS-hosted** copy of Read Maker cannot upload to it (browsers block mixed content) — Read Maker detects this and says so explicitly. To use direct sending, open your local `index.html` copy; otherwise use the SD-card or manual Wi-Fi method.
  - **Status: beta.** The HTTP and WebSocket request formats match the documented CrossPoint endpoints and are covered by tests, but physical X3/X4/X4 Pro/papermono hardware and every stock-firmware revision are still not certified.

### Ringkas (Bahasa Indonesia)

**Read Maker** — alat gratis untuk mengubah tulisan (Word, PDF berteks, Kindle non-DRM, komik CBZ, teks, Markdown, ODT, HTML, FB2, dan artikel web) menjadi **EPUB** yang rapi untuk e-reader. Semua diproses di peramban — tidak ada yang diunggah. Buka `index.html`, taruh berkas atau tempel tautan, lalu **Buat EPUB**. Salin hasilnya ke kartu SD e-reader, atau unggah lewat Wi-Fi di halaman web bawaan perangkat.

---

## Deploy to GitHub Pages

**Option A — from a branch (simplest):**
1. Push this repo to GitHub.
2. **Settings → Pages → Build and deployment → Source: Deploy from a branch**, pick `main` and `/ (root)`.
3. Your site goes live at `https://<user>.github.io/<repo>/`.

**Option B — GitHub Actions (included):** the workflow in `.github/workflows/deploy-pages.yml` deploys on every push to `main`. Just set **Settings → Pages → Source: GitHub Actions**.

The included `.nojekyll` file tells Pages to serve files as-is.

---

## Limitations (by design / honest notes)

- **Fetch article** is limited by the browser's CORS policy on many sites — hosting doesn't change this. Use a complete `https://...` address; Read Maker rejects bare slugs before making a request and upgrades an unprefixed domain when it is unambiguous. The **Paste HTML** fallback always works.
- **DRM-protected** Kindle files are not supported (they're copy-protected). HUFF/CDIC-compressed MOBI isn't supported — convert with Calibre first.
- **CBR** (RAR) isn't read directly; convert it to CBZ first. For CrossPoint-compatible EPUB comics, JPG and PNG are the safest embedded image formats; GIF and progressive JPEG are not supported by the firmware and can show an `[Image]` placeholder. With the e-ink image option enabled, Read Maker normalizes comic pages to PNG and fits them to the selected panel when one is selected.
- **Scanned PDFs** need the optional OCR mode (Advanced options). It is off by default, downloads the OCR engine on first use, is much slower than normal conversion, and the recognised text will contain some mistakes.
- **Fixed-layout PDF mode** preserves page appearance as rendered PNGs; it does not provide the same font resizing or reflow as normal EPUB chapters.
- Remote images referenced by URL stay as references (won't show offline). Embed images in the source for a self-contained book.
- **XTC/XTCH export is image-pages only** (comics/images), oriented at the X4 480x800 panel; text-to-XTC would require the device's own renderer and is out of scope here. The byte layout is round-trip verified against the reader's format, but not yet confirmed on hardware.
- **Not yet tested on physical hardware.** Output is validated structurally and against the reader's parser/panel behaviour by reading its source, but a real X3/X4 pass is still recommended before relying on it.

The comic stress suite (`tests/comic-stress.test.js`) exercises a mixed-format CBZ, natural page ordering, root covers, folder chapters, a 120-page EPUB package, 1-bit XTC, 2-bit XTCH, and all three tone algorithms. It is included in the regular test run.

---

## Privacy

All parsing and conversion happen locally in your browser. Files never leave your device. The only network use is optional: loading `pdf.js`/`mammoth.js` on first use, and fetching an article URL if you choose to.

---

## Development & tests

Repo pembanding dan keputusan adopsi dicatat di [REPO_RESEARCH.md](REPO_RESEARCH.md); matriks fitur saat ini ada di [FEATURE_COMPARISON.md](FEATURE_COMPARISON.md); roadmap teknis ada di [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md).

Use Node.js 24.19.0 (the version used in CI) to run the test suite.

Pure logic (binary MOBI/PalmDOC, PDF reconstruction, dithering, EPUB builder, sanitiser, i18n, UI wiring) is covered by headless tests. The canvas/pdf.js/mammoth paths are browser-only and not headless-tested.

```bash
cd tests
npm install
npm test
```

---

## Credits & licenses

This project is released under the [MIT License](LICENSE).

Third-party components (see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)):

- **JSZip** 3.10.1 — MIT (bundled as `jszip.min.js`)
- **pdf.js** — Apache-2.0 (loaded on demand for PDF)
- **mammoth.js** — BSD-2-Clause (loaded on demand for DOCX)

**Read Maker** — companion to **CrossPoint Reader** — https://github.com/crosspoint-reader/crosspoint-reader

---

## Contributing

Issues and PRs welcome — see [CONTRIBUTING.md](CONTRIBUTING.md). If you're proposing to fold this into CrossPoint Reader itself, please open a Discussion there first (per its SCOPE).
