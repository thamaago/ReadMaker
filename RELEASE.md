# Public release checklist

Read Maker is a static browser app. The GitHub Pages artifact contains `index.html`, `jszip.min.js`, `responsive.css`, `device-compatibility.js`, `pdf-review.js`, and `.nojekyll`.

1. Run `cd tests && npm ci && npm test` with Node.js 24.19.0. On Windows with Chrome installed, also run `npm run stress:browser`.
2. Open `index.html` in a browser and convert a small text file and an image comic. Check the EPUB download, title, chapter order, and images. PDF and DOCX need a network connection to load their readers on first use.
3. Check that no copyrighted or personal source book is tracked: `git ls-files '*.epub' '*.pdf' '*.mobi' '*.docx' '*.cbz'`. Generated books are ignored by `.gitignore` and must not be added to the site artifact or a release upload.
4. Review the current limitations and privacy wording in `README.md`, especially CORS, scanned-PDF OCR, on-demand CDN libraries, and direct Wi-Fi transfer. The latter and native XTC/XTCH output remain unverified on physical hardware; describe them accordingly.
5. Configure GitHub Pages to use **GitHub Actions**. Review the staged site files in the deploy workflow before pushing to `main`; that push triggers the public site deployment.
6. After deployment, open the public site, load a small local file, build and download an EPUB, and check the browser console for errors. Then create the release tag and notes for the tested commit.

The test and Pages workflows also run `.github/actions/epub-validation`, which
builds four representative books and checks them with pinned EPUBCheck 5.4.0
using `--failonwarnings`. The downloaded validator archive is checksum-verified.
Locally, run `node tests/build-validation-fixtures.cjs` and
`node tests/validate-epub.cjs /absolute/path/to/epubcheck.jar`.

Manual browser acceptance for the PDF correction workflow:
`node tests/pdf-review-browser.cjs` (requires the synthetic benchmark PDFs,
Playwright, and Edge/Chromium; see `docs/pdf-stress-lab.md`).
Real X4 Pro/CrossPoint acceptance remains separate; use
`docs/x4-pro-acceptance.md` and record the firmware version and actual results.
