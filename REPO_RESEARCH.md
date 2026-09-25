# Riset Repo GitHub untuk Pengembangan EPUB

Tanggal riset: 25 September 2026

Dokumen ini memetakan repo yang relevan untuk Read Maker. Penilaian dibatasi pada tujuan Read Maker: konversi lokal, EPUB ringan untuk e-reader kecil/CrossPoint, dukungan PDF, dan privasi tanpa upload.

## Ringkasan keputusan

| Repo | Peran terbaik | Keputusan untuk Read Maker |
|---|---|---|
| [calibre](https://github.com/kovidgoyal/calibre) | Pipeline konversi, heuristics, metadata, TOC, editing | Jadikan referensi perilaku dan benchmark; jangan embed karena aplikasi desktop besar dan GPLv3 |
| [Sigil](https://github.com/Sigil-Ebook/Sigil) | Editor EPUB, TOC editor, preview, reports, validation | Tiru alur review/edit; jangan menyalin kode karena GPLv3 dan arsitektur Qt desktop |
| [epub-gen-memory](https://github.com/cpiber/epub-gen-memory) | Generator EPUB dari HTML untuk Node/browser, Promise<Blob> | Kandidat pembanding builder; adopsi hanya bila output CrossPoint tetap kompatibel dan lisensi/dependensi diaudit |
| [epub-gen](https://github.com/cyrilis/epub-gen) | Generator EPUB Node.js dengan metadata, cover, chapter, CSS | Referensi API dan opsi; tidak cocok sebagai runtime utama browser karena orientasi Node/path/download gambar |
| [epubcheck-ts](https://github.com/likecoin/epubcheck-ts) | Validasi EPUB di browser/Node melalui JS/WASM | Kandidat kuat untuk pemeriksaan setelah build; tetap bedakan dari validator resmi Java |
| [EPUBCheck](https://github.com/w3c/epubcheck) | Conformance resmi EPUB dari W3C/DAISY | Gunakan di CI/release fixture; tidak praktis dibundel ke browser |
| [epub.js](https://github.com/futurepress/epub.js) | Render, pagination, navigation, dan preview EPUB di browser | Gunakan sebagai referensi atau optional preview; bukan converter dan bukan renderer CrossPoint |
| [EbookLib](https://github.com/aerkalov/ebooklib) | Manipulasi EPUB2/EPUB3 di Python | Berguna sebagai oracle/fixture generator di luar browser; jangan dijadikan dependensi app statis karena AGPL/Python |
| [Pandoc](https://github.com/jgm/pandoc) | Pipeline reader → AST → writer | Referensi arsitektur intermediate representation; jangan jadikan runtime browser karena GPL/Haskell |
| [pdf2epub](https://github.com/overcuriousity/pdf2epub) | PDF layout/OCR/image/table extraction berbasis Python/AI | Benchmark untuk kualitas PDF dan struktur; tidak cocok sebagai default karena server/dependensi/GPU/AI |
| [pdftoepub](https://github.com/PiXeL16/pdftoepub) | Scan PDF → OCR → reflow EPUB dengan patch OCR | Referensi pipeline OCR dan test e2e; tidak cocok sebagai mode offline default karena membutuhkan server dan API key |
| [pdf2epubEX](https://github.com/dodeeric/pdf2epubEX) | PDF → fixed-layout EPUB melalui pdf2htmlEX | Referensi fidelity fixed-layout dan pilihan PNG/JPG/SVG; bergantung Docker/Linux dan perlu audit kompatibilitas reader |
| [CrossPoint Reader](https://github.com/crosspoint-reader/crosspoint-reader) | Target parser/layout/cache/renderer perangkat | Jadikan sumber kebenaran kompatibilitas markup, CSS, ukuran, cache, dan hardware |

## Temuan per kategori

### 1. Pipeline konversi

Calibre memisahkan input plugin, intermediate XHTML, transform heuristics, structure detection, TOC, lalu output plugin. Pola ini lebih penting daripada menyalin kode: Read Maker perlu memiliki tahap intermediate yang dapat dipreview dan didiagnosis.

Pandoc memberi contoh AST lintas format dan filter di antara reader dan writer. Untuk Read Maker, versi ringkasnya adalah `BookModel` bersama yang berisi metadata, chapter, asset, TOC, source page, confidence, dan diagnostics.

### 2. Builder EPUB

Builder Read Maker saat ini sudah khusus untuk CrossPoint: XHTML sederhana, nav + NCX, CSS profile, fixed layout, dan image pipeline e-ink. Karena itu mengganti builder dengan library umum belum tentu meningkatkan hasil.

`epub-gen-memory` menarik karena berjalan di browser dan mengembalikan `Blob`, tetapi fokusnya membuat EPUB umum dari HTML. Ia tetap perlu diuji terhadap CSS subset dan parser CrossPoint. Gunakan sebagai pembanding output dan kemungkinan fallback, bukan sebagai penggantian langsung.

### 3. Validasi

EPUBCheck resmi adalah standar rilis. `epubcheck-ts` lebih cocok dengan model lokal Read Maker karena dapat dipanggil dari browser, menggunakan JS/WASM, dan menghasilkan laporan tanpa upload. Repo tersebut menyatakan hasilnya mendekati EPUBCheck tetapi bukan pengganti sertifikasi formal; gunakan keduanya di tempat berbeda:

- `epubcheck-ts`: umpan balik pengguna/developer setelah build;
- EPUBCheck Java: gate CI dan fixture release.

### 4. Preview dan review

Sigil dan epub.js menunjukkan dua kebutuhan yang belum lengkap di Read Maker:

- review struktural: metadata, TOC, chapter, resource, warnings;
- preview visual: melihat hasil reflow/fixed sebelum download.

Read Maker tidak perlu menjadi editor penuh seperti Sigil. Cukup tambahkan preview ringan, rename/reorder chapter, edit TOC, dan tombol kembali ke metadata.

### 5. PDF

Repo `pdf2epubEX` memperlihatkan bahwa fixed-layout paling dapat dipercaya untuk mempertahankan posisi, gambar, dan font, tetapi menghasilkan EPUB besar dan tidak reflowable.

Repo `pdf2epub` dan `pdftoepub` menunjukkan pola yang layak dipelajari untuk mode reflow:

1. ekstraksi per halaman;
2. klasifikasi layout;
3. OCR bila perlu;
4. pemisahan figure/image;
5. struktur chapter;
6. patch atau diagnostic yang dapat ditelusuri;
7. test end-to-end pada EPUB hasil.

Read Maker sebaiknya mengambil pipeline dan pengukuran tersebut tanpa menjadikan AI/cloud sebagai syarat utama.

## Rekomendasi implementasi

### Prioritas langsung

1. Tambahkan `epubcheck-ts` sebagai validator opsional browser atau paket offline developer.
2. Buat fixture PDF: satu kolom, dua kolom, scan, ilustrasi, TOC hyperlink, dan font non-Unicode.
3. Tambahkan preview reflow/fixed dengan laporan:
   - mode;
   - confidence;
   - chapter;
   - jumlah kata;
   - gambar;
   - warning;
   - sumber halaman.
4. Bentuk `BookModel` bersama untuk semua parser.
5. Jadikan CrossPoint parser dan perangkat fisik sebagai target acceptance test.
6. Gunakan Calibre/Sigil hanya sebagai pembanding hasil dan workflow review.

### Tidak direkomendasikan

- Menyalin kode Calibre atau Sigil ke aplikasi MIT karena konflik lisensi GPLv3.
- Menambahkan backend AI sebagai default untuk file pribadi.
- Mengganti builder khusus CrossPoint dengan library umum tanpa golden tests.
- Menjanjikan PDF reflow sempurna.
- Menambah DRM removal atau cloud library yang keluar dari tujuan aplikasi.

## Matriks adopsi

| Kebutuhan | Referensi | Implementasi Read Maker |
|---|---|---|
| Intermediate representation | Pandoc, Calibre | `BookModel` |
| Structure/TOC | Calibre, Sigil | source TOC + heading confidence + manual correction |
| EPUB packaging | epub-gen-memory, EbookLib | builder sendiri dengan golden comparison |
| Browser validation | epubcheck-ts | optional local post-build check |
| Formal conformance | EPUBCheck | CI/release |
| Browser preview | epub.js | preview terbatas dan sanitized |
| PDF fixed fidelity | pdf2epubEX | fixed page PNG, viewport, metadata |
| PDF reflow | pdf2epub, pdftoepub, Calibre | deterministic extraction + OCR opt-in |
| Device compatibility | CrossPoint | CSS/markup subset + hardware matrix |

## Kesimpulan

Repo yang paling layak dijadikan acuan langsung untuk Read Maker adalah:

1. CrossPoint Reader untuk kompatibilitas perangkat.
2. Calibre untuk pipeline konversi dan heuristics.
3. Sigil untuk pola review dan koreksi EPUB.
4. epubcheck-ts untuk validasi browser lokal.
5. pdf2epubEX dan proyek PDF-to-EPUB lain sebagai benchmark kualitas.

Tidak ada satu repo yang sebaiknya menggantikan Read Maker. Keunggulan Read Maker justru berada pada gabungan konversi lokal, output kecil, profil CrossPoint, dan alur sederhana untuk pengguna e-ink.

