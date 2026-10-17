# Raster validation fixtures

`validation-diagram.png` is a synthetic 240 × 160 grayscale diagram with text,
lines and a border. `validation-diagram.jpg` is the same diagram encoded as JPEG.
Both were generated locally with Pillow for the EPUB validation tests.

The PNG is used by the release-gate EPUB fixtures, including the offline article
added on 18 October (five EPUB fixtures in total). The JPEG is used by the
CBZ test whose archive filenames end in `.jpg`. Older versions of those tests
used malformed 1 × 1 PNG bytes (including PNG bytes under `.jpg` filenames).
The output audit on 2026-10-17 preserved the original EPUBs before regeneration.

These assets test packaging and image integrity, not photographic quality,
OCR accuracy or legibility on a physical e-reader. Other unit fixtures retain
small, valid 1 × 1 images where only document structure is under test.

Run `node tests/epub-image-integrity.test.js` for positive/negative controls.
`node tests/validate-epub.cjs` combines PNG CRC/raster MIME preflight with
EPUBCheck. It does not fully decode JPEG or all PNG pixels. The broader
`python tests/audit-epub-output.py --phase final` audit requires Pillow and Java
and separately verifies and decodes raster assets. Its exit status is nonzero
if any selected EPUB fails; unit samples are included and may expose issues
outside the release-gate fixtures.
