# Contributing

Thanks for helping improve Read Maker!

## Ground rules

- The app is intentionally **static and offline-first**: `index.html`, `jszip.min.js`, `responsive.css`, `device-compatibility.js`, and `pdf-review.js`, with no build step or backend. Keep it that way unless there's a strong reason not to.
- Heavy work runs **host-side (in the browser)**, never on the device. This tool must not add any load to reader firmware.
- Prefer **no new hard dependencies**. PDF.js, Mammoth, Tesseract and jsQR are loaded on demand for PDF, DOCX, OCR and QR respectively. Web fetching and device transfer also use the network.

## Before you start

If you want to fold this into **CrossPoint Reader** itself (e.g. as a page under `src/network/html/`), please open a **Discussion** in that repo first — its SCOPE asks for it.

## Making changes

1. Edit `index.html` for conversion logic and primary UI; keep the responsive stylesheet and device compatibility helper in sync when changing those features.
2. Add or update a test suite in `tests/` for any logic change.
3. Run the tests:
   ```bash
   cd tests
   npm ci
   npm test
   ```
4. Open `index.html` in a browser and sanity-check the UI (the canvas/pdf.js/mammoth paths can only be verified in a real browser).

## What tests cover

Pure logic is unit-tested headless with jsdom + JSZip: parsers (TXT/MD/RTF/HTML/FB2/ODT/PDF-reconstruction/MOBI/CBZ), the HTML sanitiser, the e-ink image maths, the EPUB builder, i18n key parity, and UI wiring/accessibility. Browser-only paths (canvas image encode, PDF.js, Mammoth) require the separate browser scenarios in tests/*browser.cjs and relevant manual acceptance; the Node suite alone does not cover them.

## Style

- Plain, dependency-free JavaScript. Match the existing formatting.
- Keep user-facing strings in the `T` i18n dictionary (both `id` and `en`).
- Keep the CrossPoint stylesheet conservative and let device typography preferences take precedence. Universal and fixed-layout profiles have different scaling and viewport requirements; verify each affected profile when changing EPUB CSS.

## Privacy of contributions

Use synthetic fixtures and repository-relative paths in public reports. Review source files, images, metadata, logs, and screenshots before sharing. See [PRIVACY.md](PRIVACY.md). Preserve required third-party copyright and license notices.
