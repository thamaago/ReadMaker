# Device compatibility

ReadMaker now exposes a target-device selector while keeping a standards-first
EPUB as the default. The selector chooses the existing firmware style only
where it is useful:

| Target | Export profile | Notes |
| --- | --- | --- |
| All EPUB readers | `universal` | EPUB 3 reflow, safest default for ADE, Kobo, PocketBook, Tolino, Android readers, and desktop apps. |
| Adobe Digital Editions | `universal` | Keep EPUB 3 navigation and standard XHTML/CSS. |
| Kobo | `universal` | Reflow is recommended; use original layout for page-faithful PDFs. |
| PocketBook / Tolino | `universal` | Avoid vendor-specific CSS; keep images in supported JPEG/PNG formats. |
| Kindle | `universal` | Use the resulting EPUB through the reader's supported Send to Kindle workflow. |
| Xteink stock firmware | `universal` | Uses standard EPUB CSS for the stock reader. |
| CrossPoint | `crosspoint` | Applies the lean CrossPoint stylesheet and existing e-ink image settings. |
| Sumi | `universal` | Uses the standard EPUB stylesheet. |
| Android e-readers | `universal` | Reflow works with most EPUB 3 readers. |

Only CrossPoint has a distinct stylesheet profile; all other targets use the
universal EPUB baseline. This selector does not change Amazon delivery
or add proprietary device formats. It is a compatibility hint, not a DRM
bypass. DRM-protected files must be opened and converted through the rights
holder's supported workflow.

