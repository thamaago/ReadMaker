# Reviewing scanned books

## Regression found in the Sore back cover

A page with a high median OCR confidence still contained an isolated margin
digit, a two-letter fragment attached to a valid line, and a short centered
paragraph ending interpreted as a new paragraph. Small print on a two-column
publisher page was also read across columns. Passing EPUBCheck did not detect
these textual defects.

The application now:

- Uses word boxes to trim short fragments below 55 confidence only when they
  lie beyond a margin established by at least 30 clear alphabetic words.
  The margin includes generous padding; uncertain body words and confident
  margin labels remain intact. Sparse pages and incomplete word boxes are
  left unchanged.
- Recognizes groups of differently sized lines sharing a center. Blank gaps
  still separate paragraphs, and a short centered final line stays with its
  paragraph. Alignment is checked within separated groups as well as pages,
  so publisher information can use a different alignment.
- Flags local uncertainty when at least three words below 65 confidence make
  up at least 3% of the recognized words, or when margin cleanup changed text.
  The existing low-median warning still applies.
- Keeps hyphens in Indonesian repeated words split across lines, including
  a suffix on the second word, while joining ordinary wrapped words.

These are conservative heuristics, not general spelling correction or full
layout reconstruction. OCR cannot reliably recover every stylized title,
barcode, logo, address, multi-column panel, or damaged scan automatically.
Such areas require source comparison, zoning, or retaining the source image.

## Validation workflow

1. Keep source documents and the previous EPUB unchanged.
2. Account for every source page, including blank and illustrated pages.
3. Run a second OCR segmentation pass into separate caches. Differences and
   confidence values identify review candidates; neither is ground truth.
4. Compare flagged regions with rendered source pages before applying a
   correction. Preserve wording and document the page and reason.
5. Check package validity with EPUBCheck and test all resulting chapters at
   several widths and font sizes. Inspect rendered examples visually.
6. Report automated checks separately from manual proofreading and physical
   device tests. A median confidence score is not an accuracy percentage.

For the local HELLO/Sore review, the original AUTO segmentation was compared
with a separate normalized SINGLE_BLOCK pass over all 804 rendered pages.
The second pass is an audit reference, not an automatic replacement: a
single-block model can misread covers and columns. Source-verified changes
to the books are stored in local conversion artifacts, not hardcoded in the
application or its tests. The sample books are not added to this repository.

## Regression tests

`tests/ocr.test.js` covers centered paragraph endings, mixed alignment,
margin noise, legitimate numbers, sparse pages, missing geometry, localized
review warnings, and OCR-to-EPUB integration. Related PDF and drop-cap suites
protect reading order and chapter detection.

The browser simulation checks wrapping and image decoding. It does not
emulate Xteink firmware, display dithering, font rendering, or Adobe Digital
Editions. Hardware compatibility and word-perfect OCR require separate tests.
