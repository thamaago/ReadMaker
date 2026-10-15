# Manual PDF conversion benchmark

This benchmark creates original synthetic fixtures inspired by the layout
failure modes found when reviewing HELLO and Sore. It does not redistribute
either book, and it keeps exported EPUBs unedited so failures remain visible.

## Workloads

- 48 pages: 12 layouts repeated as digital text, clean scans, degraded scans,
  and skewed scans. Cases include columns, tables, drop caps, illustrations,
  footnotes, small print, landscape pages, accents, and ambiguous identifiers.
- 1,200 digital pages with 3,600 ordered markers and a known text reference.
- Semantic HTML containing the reference text as a control for EPUB packaging.

The volume fixture is repetitive and compresses well. More pages do not make
it equivalent to a large scanned book in memory usage, entropy, or diversity.

## Running

1. `python tests/generate-complex-pdf.py`
2. `node tests/complex-pdf-browser.cjs`
3. `python tests/evaluate-complex-pdf.py`
4. Render source thumbnails with
   `pdftoppm -r 90 -png output/pdf/stress-lab/ReadMaker-Complex-48.pdf tmp/pdfs/stress-lab/source`
5. `node tests/complex-pdf-preview.cjs`
6. `python tests/report-complex-pdf.py`

Python needs reportlab, Pillow, pypdf, and pdftoppm. The generator defaults to
Windows Arial fonts; `READMAKER_TEST_FONTS` can select a directory containing
the corresponding font files. Node needs JSZip and Playwright; optionally set
`READMAKER_RUNTIME_MODULES` to bundled Node modules and `BROWSER_BIN` to an
Edge/Chromium executable. The browser loads the same PDF/OCR helpers as the app.
The evaluator requires Java and EPUBCheck 5.4.0 at the local path in its script.

Source PDFs and ground truth go under `output/pdf/stress-lab/`; exported EPUBs,
logs, raw checks, the offline comparison page, and report go under
`output/epub/stress-lab/`. These generated outputs are ignored by Git. Run the
skill's artifact-operation marker first when generating PDF deliverables in a
Codex session that requires it.

## Interpreting results

The browser test exercises the real file input, parsing helpers, canvas, OCR,
preset processing, build button, and download. It does not use PDF/OCR stubs.
Normalised token edit distance is compared with the generated reference;
punctuation and case are not scored. Exact identifier retention is a separate
metric: O/0 mistakes are not evidence that whole paragraphs disappeared.

Conversion completion, package validity, image preservation, reading order,
and wrapping are separate outcomes. Never treat a valid ZIP/EPUB as proof of
correct text. The report deliberately preserves failed checks. The preview
is not a physical e-ink or firmware emulator, and a single timed run is not a
performance guarantee.

The first run exposed column interleaving, separated drop caps, missing
illustrations, running headers surviving bookmark splitting, false column
recommendations, narrow-screen overflow, and a deprecated viewport warning.
Use these cases as regression gates when fixing those issues; do not repair
the fixture outputs manually or add book-specific text replacements.
