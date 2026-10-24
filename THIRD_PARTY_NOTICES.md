# Third-Party Notices — Read Maker

This project bundles or loads the following third-party components. Their licenses apply to those components.

Design references such as Calibre, Pandoc and Sigil are not bundled runtimes. The original ReadMaker Engine 1.0 implementation remains under this project's MIT license; this does not relicense those reference projects. See [adoption and evidence](docs/readmaker-engine-2026-10-25.md) for the distinction between dependencies, design references and unimplemented proposals.

## JSZip 3.10.1 — bundled (`jszip.min.js`)
- License: MIT (dual MIT/GPLv3; used here under MIT)
- Home: https://stuk.github.io/jszip/
- Copyright (c) 2009–2016 Stuart Knightley and contributors

## pdf.js — loaded on demand (PDF conversion only)
- License: Apache-2.0
- Home: https://mozilla.github.io/pdf.js/
- Copyright Mozilla Foundation and contributors
- Loaded from a CDN at runtime; not redistributed in this repository.

## mammoth.js — loaded on demand (DOCX conversion only)
- License: BSD-2-Clause
- Home: https://github.com/mwilliamson/mammoth.js
- Copyright (c) Michael Williamson
- Loaded from a CDN at runtime; not redistributed in this repository.

## Tesseract.js — loaded on demand (OCR for scanned PDFs only)
- License: Apache-2.0
- Home: https://github.com/naptha/tesseract.js
- Loaded from a CDN at runtime; not redistributed in this repository.

## jsQR — loaded on demand (scanning the device's Wi-Fi QR code)
- License: Apache-2.0
- Home: https://github.com/cozmo/jsQR
- Loaded from a CDN at runtime; not redistributed in this repository.

---

If you vendor `pdf.js` or `mammoth.js` locally (recommended for fully offline use),
include their license texts alongside the copied files.
