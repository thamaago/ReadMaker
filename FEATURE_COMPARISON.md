# Perbandingan Fitur Read Maker dengan Repo Pembanding

Tanggal audit: 25 September 2026

Dokumen ini membandingkan fitur yang benar-benar ada di Read Maker dengan kemampuan repo yang sudah diteliti. Status memakai tiga tingkat:

- **✅ Ada** — sudah tersedia dan memiliki jalur kode atau test di repo.
- **◐ Parsial** — tersedia untuk sebagian sumber/perangkat, masih ada batasan atau belum tervalidasi penuh.
- **❌ Belum ada** — belum menjadi fitur produk.

## 1. Inventaris fitur Read Maker saat ini

| Area | Fitur | Status | Bukti di repo / catatan |
|---|---|---:|---|
| Sumber | TXT, Markdown, RTF, HTML, FB2, ODT | ✅ | Parser lokal dan fixture test masing-masing format |
| Sumber | DOCX | ◐ | Mammoth dimuat saat diperlukan; browser path belum tercakup penuh oleh test headless |
| Sumber | PDF text-based | ✅ | pdf.js, reflow dan fixed-layout |
| Sumber | PDF scan | ◐ | OCR Tesseract opt-in; hasil dapat salah dan bergantung pemuatan engine |
| Sumber | MOBI/AZW3 non-DRM | ✅ | PalmDOC, gambar, cover, dan TOC bawaan |
| Sumber | CBZ | ✅ | Halaman gambar, urutan numerik, filter metadata arsip, chapter dari folder, ekspor XTC/XTCH |
| Sumber | CBR/RAR | ❌ | Pengguna diarahkan mengubahnya ke CBZ terlebih dahulu |
| Sumber | Artikel web dan AO3 | ◐ | Fetch/paste HTML; fetch tetap dibatasi CORS dan jaringan |
| Struktur | Deteksi chapter dan TOC bawaan | ✅ | TOC MOBI/HTML diprioritaskan, fallback heading/page-break/marker |
| Struktur | Nested TOC | ✅ | `nav.xhtml` dan `toc.ncx` mendukung level bertingkat |
| Struktur | Pencarian dan paging daftar chapter | ✅ | Galley memiliki pencarian, nomor halaman daftar, next/previous; export tetap memakai semua chapter |
| Struktur | Koreksi judul/penulis | ✅ | Form metadata tersedia sebelum build |
| Struktur | Edit/reorder TOC manual | ✅ | Galley menyediakan edit judul dan tombol naik/turun; urutan dipakai saat build |
| PDF | Rekomendasi reflow/fixed | ✅ | Classifier memakai text layer, gambar, kolom, dan halaman kosong/sparse |
| PDF | Pembersihan header/footer dan artefak | ✅ | Header berulang, nomor halaman, `A |`/`A .`, dan metadata fallback ditangani |
| PDF | Penempatan gambar dekat halaman sumber | ✅ | Image reference menyimpan `sourcePage` dan disisipkan di HTML reflow |
| PDF | Layout tabel, matematika, multi-kolom kompleks | ◐ | Multi-kolom dasar terdeteksi; rekonstruksi lanjutan belum tersedia |
| PDF | Preview hasil reflow/fixed | ◐ | Preview bab pertama tersedia; side-by-side per halaman sumber belum ada |
| EPUB | EPUB 2/3, OPF, spine, manifest | ✅ | Builder sendiri, termasuk `nav.xhtml` dan `toc.ncx` |
| EPUB | Fixed-layout viewport | ✅ | Halaman PDF dirender sebagai chapter pre-paginated |
| EPUB | Normalisasi markup untuk parser CrossPoint | ✅ | Tag dan CSS dibatasi; `<pre>/<code>` dinormalisasi ke blok + `<br/>` |
| EPUB | Self-check XML dan warning kualitas | ✅ | XML parse check dan warning metadata/resource/chapter |
| EPUB | EPUBCheck resmi | ❌ | Belum ada gate conformance resmi |
| EPUB | Validator browser JS/WASM | ❌ | `epubcheck-ts` belum diintegrasikan |
| EPUB | Memecah chapter XHTML besar | ◐ | Pemisahan berbasis chapter tersedia; split ukuran/byte untuk RAM firmware belum ada |
| Gambar | Grayscale, fit panel, dithering | ✅ | 2/4 tone dan Floyd–Steinberg/ordered dithering |
| Device | Profil CrossPoint/Universal | ✅ | CSS profile dan batas markup target tersedia |
| Device | XTC/XTCH native image pages | ✅ | Untuk CBZ/image pages; mengikuti panel, tone, fit, dan dithering terpilih; text-to-XTC memang di luar scope |
| Device | Dictionary StarDict | ✅ | `.ifo`, `.idx`, `.dict` untuk CrossPoint/SUMI |
| Device | Sleep screen BMP/overlay | ✅ | Indexed 4-tone dan BGRA overlay |
| Device | Upload Wi-Fi langsung | ◐ | Profil otomatis/CrossPoint/stock/generic, WebSocket dengan fallback HTTP, QR, cancel, timeout; belum lulus uji hardware nyata |
| Operasional | Batch conversion | ✅ | File rusak/unsupported dilewati dan dilaporkan per item |
| Operasional | Worker/progress/cancel untuk parsing berat | ◐ | Progress/error UI ada di beberapa jalur; parser utama masih berjalan di main thread |
| Operasional | Offline penuh tanpa dependensi jaringan | ◐ | Core offline; PDF.js, Mammoth, OCR, QR decoder dimuat saat diperlukan |
| Kualitas | Corpus benchmark dan metrik fidelity | ❌ | Test fungsional banyak, tetapi belum ada expected word/chapter/image metrics lintas corpus |
| Kualitas | Uji perangkat fisik | ❌ | Kompatibilitas dibaca dari source CrossPoint, belum ada matriks hardware pass |

## 2. Dibandingkan dengan repo utama

| Kemampuan | Read Maker | Repo pembanding | Penilaian |
|---|---|---|---|
| Pipeline konversi bertahap | Parser → normalizer → struktur → builder sudah ada, tetapi masih monolitik di `index.html` | [Calibre](https://github.com/kovidgoyal/calibre) dan [Pandoc](https://github.com/jgm/pandoc) memakai pipeline/intermediate model yang lebih eksplisit | Pertahankan builder khusus perangkat; ekstrak `BookModel`, diagnostics, dan tahap transform agar mudah diuji |
| Heuristik PDF | Classifier mode, header cleanup, metadata fallback, inline image sudah ada | [Calibre conversion](https://manual.calibre-ebook.com/conversion.html), [pdf2epub](https://github.com/overcuriousity/pdf2epub), [pdftoepub](https://github.com/PiXeL16/pdftoepub) lebih luas pada layout/OCR/table/patch | Read Maker unggul pada privasi dan determinisme; masih tertinggal pada layout kompleks, OCR confidence, dan review patch |
| Editor/review EPUB | Metadata form dan galley chapter tersedia | [Sigil](https://github.com/Sigil-Ebook/Sigil) punya editor XHTML/CSS, TOC editor, preview, reports | Ambil alur review ringan: edit judul/reorder TOC, warnings, preview; jangan meniru editor penuh |
| Packaging EPUB | OPF, spine, nav, NCX, CSS CrossPoint, fixed layout | [epub-gen-memory](https://github.com/cpiber/epub-gen-memory), [epub-gen](https://github.com/cyrilis/epub-gen) adalah generator umum | Builder sendiri lebih sesuai karena output harus aman untuk parser e-ink; gunakan generator umum hanya sebagai oracle perbandingan |
| Conformance | Self-check XML dan warning internal | [EPUBCheck](https://github.com/w3c/epubcheck) adalah validator resmi; [epubcheck-ts](https://github.com/likecoin/epubcheck-ts) menyediakan JS/WASM browser/Node | Tambahkan epubcheck-ts sebagai feedback lokal dan EPUBCheck Java sebagai CI/release gate |
| Preview/pagination | Paging hanya untuk daftar chapter/galley, bukan render EPUB final | [epub.js](https://github.com/futurepress/epub.js) menyediakan render, navigation, dan pagination browser | Tambahkan preview terbatas untuk hasil reflow/fixed; jangan jadikan epub.js sebagai renderer CrossPoint |
| Manipulasi EPUB | Build only, belum edit EPUB existing | [EbookLib](https://github.com/aerkalov/ebooklib) kuat untuk EPUB2/3 tetapi Python/AGPL | Tidak cocok sebagai dependency static; berguna untuk fixture/oracle di luar browser |
| Fixed-layout PDF | Render PNG per halaman dan metadata viewport | [pdf2epubEX](https://github.com/dodeeric/pdf2epubEX) mempertahankan layout melalui pdf2htmlEX | Arah Read Maker sudah benar; perlu golden render dan pengukuran ukuran/ketajaman gambar |
| Target e-ink | CSS, gambar, XTC, dictionary, sleep, Wi-Fi khusus CrossPoint | [CrossPoint Reader](https://github.com/crosspoint-reader/crosspoint-reader) mendokumentasikan parser, cache, layout, renderer, dan batas hardware | Ini keunggulan utama Read Maker; acceptance test harus mengacu parser/perangkat, bukan browser saja |

## 3. Fitur yang sudah lebih kuat daripada generator EPUB umum

Read Maker sudah memiliki kombinasi yang tidak diberikan oleh `epub-gen` atau `epub-gen-memory`: profil CSS CrossPoint, markup subset untuk parser ESP32, pengolahan gambar 2/4-tone, ekspor XTC/XTCH, dictionary StarDict, sleep screen, transfer Wi-Fi, RTL, serta penanganan PDF fixed/reflow. Karena itu mengganti builder dengan generator umum tidak otomatis meningkatkan kualitas.

Keunggulan lain adalah pemrosesan lokal tanpa upload. Ini sesuai kebutuhan pemilik file resmi yang hanya ingin memindahkannya ke perangkat e-ink, sekaligus menjaga batas produk: file DRM tetap tidak dibuka atau dihapus proteksinya.

## 4. Gap yang paling berdampak bagi pengguna

1. **Preview masih terbatas.** Pengguna dapat melihat ringkasan dan bab pertama, tetapi belum ada perbandingan visual per halaman sumber vs hasil EPUB.
2. **Validasi formal belum tersedia.** Self-check XML menangkap error dasar, tetapi belum menggantikan EPUBCheck.
3. **PDF kompleks masih menjadi risiko utama.** Tabel, footnote, rumus, dua kolom tidak selalu dapat direflow dengan benar; fixed-layout harus dipilih saat confidence rendah.
4. **Belum ada pengukuran fidelity lintas corpus.** Jumlah kata, urutan gambar, chapter, dan ukuran output perlu dibandingkan dengan expected fixture.
5. **Belum ada bukti hardware.** Upload Wi-Fi dan pembukaan EPUB perlu diuji pada X3/X4/X4 Pro/papermono dan firmware yang relevan.

## 5. Prioritas pengembangan berdasarkan perbandingan

### P0 — validasi hasil

- Tambahkan fixture PDF satu kolom, dua kolom, scan, ilustrasi, TOC, font non-Unicode.
- Integrasikan `epubcheck-ts` sebagai pemeriksaan opsional setelah build.
- Tambahkan report hasil: mode, confidence, chapter, kata, gambar, halaman sumber, warning.
- Jadikan EPUBCheck Java gate CI untuk fixture rilis.

### P1 — review yang bisa ditindaklanjuti

- Preview reflow/fixed yang disanitasi.
- Rename/reorder chapter dan edit judul TOC.
- Tandai sumber metadata dan halaman asal gambar.
- Tampilkan alasan rekomendasi PDF dan tombol paksa fixed/reflow/OCR.

### P2 — keandalan perangkat

- Pecah XHTML besar agar aman untuk RAM firmware.
- Golden render untuk panel 480×800 dan ukuran target lain.
- Uji fisik buka, TOC, font, page turn, resume/cache, gambar, RTL, fixed layout, dan Wi-Fi upload.
- Pindahkan OCR/PDF besar ke Web Worker dengan progress dan cancel.

## 6. Batas adopsi kode

Gunakan repo pembanding sebagai referensi perilaku, fixture, dan desain alur. Jangan menyalin kode Calibre/Sigil/Pandoc/EbookLib ke bundle MIT tanpa audit lisensi; repo tersebut berlisensi GPLv3, GPL, atau AGPL. Kandidat yang paling aman untuk dievaluasi sebagai komponen terpisah adalah `epubcheck-ts` (BSD-3-Clause) dan, dengan golden test kompatibilitas, generator MIT seperti `epub-gen-memory`.

Kesimpulan audit: Read Maker sudah memenuhi jalur inti “file lokal → EPUB ringan untuk e-ink”, tetapi belum mencapai kualitas “reviewable dan terukur” seperti Calibre/Sigil. Langkah paling bernilai bukan menambah banyak format, melainkan menutup preview, koreksi TOC, validasi EPUB, benchmark PDF, dan acceptance test perangkat.
