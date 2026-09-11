# Contributing

Thanks for helping improve Read Maker!

## Ground rules

- The app is intentionally **static and offline-first**: one HTML file plus `jszip.min.js`, no build step, no backend. Keep it that way unless there's a strong reason not to.
- Heavy work runs **host-side (in the browser)**, never on the device. This tool must not add any load to reader firmware.
- Prefer **no new hard dependencies**. `pdf.js` and `mammoth.js` are loaded on demand only for PDF/DOCX; everything else works fully offline.

## Before you start

If you want to fold this into **CrossPoint Reader** itself (e.g. as a page under `src/network/html/`), please open a **Discussion** in that repo first — its SCOPE asks for it.

## Making changes

1. Edit `index.html` (all logic and UI live there).
2. Add or update a test suite in `tests/` for any logic change.
3. Run the tests:
   ```bash
   cd tests
   npm install
   npm test
   ```
4. Open `index.html` in a browser and sanity-check the UI (the canvas/pdf.js/mammoth paths can only be verified in a real browser).

## What tests cover

Pure logic is unit-tested headless with jsdom + JSZip: parsers (TXT/MD/RTF/HTML/FB2/ODT/PDF-reconstruction/MOBI/CBZ), the HTML sanitiser, the e-ink image maths, the EPUB builder, i18n key parity, and UI wiring/accessibility. Browser-only paths (canvas image encode, pdf.js, mammoth) are not headless-tested — verify those manually.

## Style

- Plain, dependency-free JavaScript. Match the existing formatting.
- Keep user-facing strings in the `T` i18n dictionary (both `id` and `en`).
- Only emit EPUB CSS that the reader honours (text-indent, margins, font-style). Don't add font-family/size/line-height/color/page-break — the device controls those.
