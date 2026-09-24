# Rencana Pengembangan Read Maker

Tanggal telaah: 25 September 2026

Status implementasi awal: classifier PDF, rekomendasi mode, ringkasan alasan di galley, fallback metadata, pembersihan header/artefak, dan penempatan gambar PDF dekat halaman sumber sudah diterapkan. EPUBCheck, browser integration test, dan validasi hardware tetap menjadi pekerjaan berikutnya.

## 1. Arah produk

Read Maker sebaiknya diposisikan sebagai alat penerbitan lokal tahap akhir untuk pemilik berkas yang ingin membaca di e-reader kecil. Nilai utamanya adalah mengubah sumber yang berantakan menjadi EPUB yang dapat diprediksi, ringan, dan sesuai dengan kemampuan CrossPoint/Xteink.

Produk ini bukan pengelola perpustakaan umum, pembaca EPUB, atau alat untuk membuka DRM. Pemisahan ini penting agar pengembangan tetap fokus pada tiga hasil:

1. isi buku tidak hilang atau berubah secara mengejutkan;
2. struktur buku, metadata, gambar, dan daftar isi masuk ke EPUB dengan benar;
3. hasil dapat dibaca pada perangkat target tanpa pengguna harus memahami detail EPUB.

## 2. Temuan repo saat ini

### Kekuatan

- Distribusi sangat sederhana: `index.html` dan `jszip.min.js`, tanpa server dan tanpa akun.
- Banyak sumber sudah didukung: teks, Markdown, RTF, HTML, FB2, ODT, DOCX, PDF, MOBI/AZW3, CBZ, dan artikel web.
- Model internal sudah memiliki pemisahan yang berguna antara metadata, chapters, images, cover, bahasa, dan profil firmware.
- EPUB menghasilkan `nav.xhtml` dan `toc.ncx`, mendukung RTL, validasi XML ringan, profil CSS, gambar e-ink, batch conversion, dictionary, sleep screen, XTC/XTCH, dan transfer Wi-Fi.
- Deteksi TOC pada MOBI dan HTML lebih kuat daripada sekadar mencari setiap `h1`; ini sudah sejalan dengan pola kerja converter desktop.
- Test headless mencakup banyak parser, builder, sanitiser, i18n, aksesibilitas UI, paging galley, dan format biner.

### Kelemahan yang paling memengaruhi tujuan produk

1. **PDF adalah batas kualitas utama.** PDF menyimpan posisi glyph pada halaman, bukan struktur paragraf. Pada sampel Marmut Merah Jambu, hasil reflow lama menghasilkan 17 bagian, memasukkan artefak seperti `A |`/`A .`, kehilangan ilustrasi, dan metadata menjadi `Unknown`, sedangkan sumber memiliki halaman, ilustrasi, dan daftar isi yang jelas.
2. **Mode fixed sudah menyelesaikan fidelity visual, tetapi trade-off-nya belum dikomunikasikan sebagai keputusan produk.** Hasil fixed menjaga halaman dan ilustrasi, tetapi ukuran berkas membesar dan ukuran huruf tidak lagi mengikuti preferensi pembaca.
3. **Gambar PDF reflow belum mempunyai model posisi yang kuat.** Ekstraksi gambar tersedia sebagai jalur opsional, tetapi gambar belum dijamin ditempatkan kembali di lokasi halaman/paragraph asal.
4. **Kualitas EPUB baru diperiksa secara internal.** XML well-formed dan manifest dasar belum sama dengan conformance penuh EPUBCheck.
5. **Jalur browser-only belum diuji seperti pengguna nyata.** PDF.js, OCR, Mammoth, canvas, Blob, download, dan upload Wi-Fi tidak tercakup penuh oleh test headless.
6. **Repo sengaja monolitik.** Satu `index.html` memudahkan distribusi offline, tetapi sekitar 3.200 baris kode membuat perubahan parser, builder, UI, dan device tools saling berisiko.
7. **Belum ada corpus benchmark dan pengukuran kualitas.** Test saat ini membuktikan fungsi, tetapi belum mengukur apakah bab, kata, gambar, dan urutan baca hasil konversi mendekati sumber.
8. **Validasi perangkat fisik masih menjadi catatan terbuka.** Dukungan CrossPoint dibaca dari parser/layout-nya, tetapi hasil belum dibuktikan pada matriks X3/X4/firmware nyata.

## 3. Insight dari proyek rujukan

### Calibre

Dokumentasi Calibre menyebut PDF sebagai sumber yang sangat buruk untuk konversi reflow: dokumen multi-kolom, image-based, vector image, tabel, link, TOC, font non-Unicode, dan teks kompleks dapat gagal atau menghasilkan output yang jauh berbeda. Calibre memisahkan heuristics, line unwrapping, search/replace untuk header/footer, structure detection, dan pengaturan TOC. [Dokumentasi konversi Calibre](https://manual.calibre-ebook.com/conversion.html) dan [catatan PDF input](https://github.com/kovidgoyal/calibre/blob/master/manual/conversion.rst) mendukung dua keputusan:

- jangan menjanjikan bahwa semua PDF dapat menjadi EPUB reflow yang setara;
- sediakan jalur keputusan: reflow bila confidence tinggi, fixed bila fidelity lebih penting, OCR bila tidak ada text layer, dan kontrol manual bila deteksi tidak yakin.

Calibre juga memfilter duplikasi TOC dan memungkinkan pengguna memperbaiki TOC setelah konversi. Read Maker perlu mengambil pola *preview → koreksi → build*, bukan hanya *drop → build*.

### EPUB 3 dan EPUBCheck

EPUB 3 mendefinisikan reflowable sebagai default dan `rendition:layout=pre-paginated` untuk fixed layout. Dokumen fixed harus memiliki dimensi viewport, dan reading system boleh membatasi style pengguna karena perubahan dinamis dapat merusak layout. [EPUB 3.3](https://www.w3.org/TR/epub-33/) juga menekankan bahwa navigation document, package metadata, manifest, dan spine adalah bagian inti publikasi.

EPUBCheck adalah validator resmi EPUB yang dipelihara DAISY atas nama W3C. [EPUBCheck](https://github.com/w3c/epubcheck) perlu menjadi pemeriksaan rilis atau pemeriksaan opsional lokal, bukan menggantikan self-check yang sudah ada.

### CrossPoint Reader

CrossPoint berjalan pada ESP32 dan menggunakan parser/layout EPUB, cache di SD, serta renderer e-ink. [Arsitektur CrossPoint](https://github.com/crosspoint-reader/crosspoint-reader/blob/develop/docs/contributing/architecture.md) menjelaskan bahwa EPUB dibaca melalui OPF/TOC/CSS, lalu layout dan section cache dibangun di perangkat. [Scope CrossPoint](https://github.com/crosspoint-reader/crosspoint-reader/blob/develop/SCOPE.md) menekankan footprint memori/flash, keterbacaan, typography, hyphenation, dan maintainability.

Implikasinya: keluaran Read Maker harus lebih konservatif daripada EPUB untuk browser modern. Markup sederhana, CSS sedikit, chapter tidak terlalu besar, gambar sudah dioptimalkan, dan keputusan profil firmware harus terlihat oleh pengguna.

## 4. Sasaran teknis

### Sasaran utama

- **Fidelity:** teks, urutan, chapter, metadata, dan gambar tidak hilang tanpa penjelasan.
- **Predictability:** pengguna selalu melihat mode konversi, confidence, peringatan, dan hasil pemeriksaan sebelum mengunduh.
- **Compatibility:** EPUB tetap ringan dan memakai subset markup/CSS yang aman untuk CrossPoint serta fallback yang masuk akal untuk reader umum.
- **Privacy/offline:** berkas tetap lokal; dependensi jaringan hanya opsional dan jelas.
- **Maintainability:** parser, normalizer, asset pipeline, EPUB builder, dan UI dapat diuji terpisah walaupun distribusi akhirnya tetap satu HTML.

### Metrik keberhasilan

Gunakan corpus berisi TXT/HTML/FB2/ODT/DOCX/MOBI/CBZ dan sedikitnya 10 PDF dengan karakter berbeda.

- 0 error EPUBCheck untuk fixture rilis.
- 100% manifest image yang dirujuk benar-benar ada dan memiliki MIME yang tepat.
- Precision/recall deteksi chapter minimal 95% pada fixture berlabel.
- Selisih jumlah kata reflow maksimal 2% untuk PDF text-based satu kolom yang bersih; kasus lain harus mendapat confidence rendah atau rekomendasi fixed.
- Semua halaman dan urutan gambar terjaga pada mode fixed.
- Konversi file 50 MB tidak membekukan UI lebih dari 1 detik tanpa progress/cancel.
- Pengguna baru dapat menyelesaikan alur file → preview → EPUB tanpa dokumentasi tambahan pada uji usability.
- Minimal satu pass fisik pada setiap kelas panel/firmware yang didukung sebelum status fitur disebut stabil.

## 5. Arsitektur target

Pertahankan distribusi offline sederhana, tetapi jadikan pipeline internal eksplisit:

```text
detect source
  -> extract (text / PDF pages / assets / metadata)
  -> normalize (encoding, paragraphs, links, images)
  -> structure (TOC, chapters, heading confidence)
  -> choose mode (reflow / fixed / OCR / manual)
  -> optimize assets (e-ink, dimensions, deduplication)
  -> quality gate (model checks + EPUBCheck when available)
  -> build EPUB / XTC / dictionary
  -> optional device transfer
```

Semua parser sebaiknya mengembalikan kontrak `BookModel` yang sama:

```text
metadata: title, author, language, publisher, identifier
chapters: [{title, level, html, sourcePages, confidence}]
assets: [{name, mime, bytes, sourcePage, alt}]
toc: [{title, chapterIndex, level, sourceHref}]
diagnostics: [{severity, code, message, location}]
renderMode: reflow | fixed | ocr
```

`sourcePages`, `confidence`, dan `diagnostics` akan membuat preview dan laporan hasil jauh lebih berguna daripada sekadar jumlah bab.

## 6. Roadmap prioritas

### Fase P0 — fondasi pengukuran (1–2 minggu)

Tujuan: membuat kualitas bisa diukur sebelum menambah format baru.

- Buat `fixtures/` berisi sumber dan expected manifest/TOC untuk PDF, DOCX, HTML, MOBI, dan CBZ.
- Simpan hasil benchmark: jumlah halaman, kata, chapter, aset, metadata, waktu, ukuran EPUB, dan peringatan.
- Tambahkan report konversi yang bisa dibaca pengguna: mode, confidence, bab terdeteksi, gambar, warning, dan rekomendasi.
- Tambahkan validasi referensi EPUBCheck di CI atau sebagai tool developer; self-check tetap dipakai offline di browser.
- Pisahkan test parser murni dari browser integration test.

**Selesai bila:** setiap perubahan parser dapat dibandingkan dengan fixture dan laporan kegagalan menunjuk ke sumber/halaman.

### Fase P1 — PDF quality pipeline (prioritas tertinggi, 2–5 minggu)

- Bangun `PdfPageModel` yang menyimpan lines, blocks, font size, bounding boxes, images, links, dan source page.
- Deteksi layout satu kolom, dua kolom, halaman scan, header/footer berulang, nomor halaman, drop cap, dan halaman TOC.
- Gunakan confidence score. Bila score rendah, tampilkan rekomendasi **Pertahankan halaman asli** dan jangan diam-diam menghasilkan EPUB reflow buruk.
- Pertahankan gambar secara inline per halaman/section, bukan menambahkan semua gambar di akhir buku.
- Ambil metadata dari cover/title/copyright page dengan heuristik generik dan tampilkan sumber metadata kepada pengguna.
- Ambil TOC hyperlink atau daftar isi sebagai kandidat struktur; filter duplikasi dan heading palsu.
- Tambahkan kontrol expert yang ringan: line unwrap, hapus header/footer, paksa fixed, paksa OCR, dan pemisahan bab manual.
- Untuk scanned PDF, tampilkan estimasi waktu OCR, bahasa, confidence OCR, dan peringatan bahwa hasil teks bisa salah.

**Selesai bila:** sampel Marmut Merah Jambu menghasilkan mode fixed yang menjaga 48 halaman dan ilustrasi, serta mode reflow yang tidak memasukkan header/artefak dan memiliki metadata/TOC yang masuk akal.

### Fase P2 — EPUB dan CrossPoint compatibility (2–4 minggu)

- Jadikan EPUBCheck sebagai gate rilis fixture.
- Audit namespace, `package` metadata, nav, spine, cover, modified date, language, identifiers, dan MIME assets.
- Tambahkan strategi memecah chapter besar berdasarkan batas blok/source page agar parser ESP32 tidak perlu memproses satu XHTML raksasa.
- Tetapkan profil CSS: `crosspoint` minimal, `universal` fallback, dan `fixed` dengan viewport/dimensi yang eksplisit.
- Uji gambar di panel 480×800 dan ukuran panel lain melalui golden render atau screenshot comparison.
- Uji RTL, CJK, tanda kutip, ligature, hyphenation, dan Unicode font fallback.
- Siapkan corpus EPUB hasil build untuk dibuka pada perangkat fisik dan reader desktop umum.

**Selesai bila:** tidak ada error EPUBCheck, tidak ada resource putus, TOC dapat dinavigasi, dan chapter/image tidak memicu kegagalan parser CrossPoint.

### Fase P3 — offline reliability dan UX (2–4 minggu)

- Bundle versi pin untuk PDF.js, Mammoth, Tesseract, dan QR decoder, atau sediakan paket “offline lengkap”. Mode dasar harus tetap tidak bergantung jaringan.
- Pindahkan parsing berat ke Web Worker agar UI tetap responsif; dukung cancel dan progress per tahap.
- Tambahkan halaman hasil sebelum download: cover/metadata, daftar isi, mode, jumlah kata/halaman/gambar, warnings, dan tombol kembali ke edit.
- Tambahkan preset “Disarankan untuk e-ink”: reflow untuk sumber terstruktur, fixed untuk PDF ilustratif, 4-tone grayscale, gambar fit-to-panel.
- Simpan preferensi perangkat secara lokal, tetapi jangan menyimpan berkas buku tanpa persetujuan.
- Pertahankan pesan DRM yang jujur: file yang dikunci hanya dapat dibuka/dikonversi melalui jalur resmi yang memberi izin ekspor.

**Selesai bila:** pengguna baru dapat memahami mengapa mode dipilih dan dapat memperbaiki warning sebelum file dibuat.

### Fase P4 — validasi perangkat dan transfer (2–3 minggu)

- Buat matriks uji X3, X4, X4 Pro/papermono, firmware CrossPoint dan stock OS yang tersedia.
- Verifikasi buka file, cover, TOC, font setting, page turn, images, RTL, fixed layout, dan resume/cache.
- Uji file besar, Wi-Fi upload, cancel, duplicate filename, timeout, dan mixed-content warning.
- Dokumentasikan hasil per perangkat dan tandai fitur sebagai experimental/stable berdasarkan bukti fisik.

**Selesai bila:** ada setidaknya satu log uji fisik per profil dan README tidak lagi hanya mengatakan “belum diuji”.

### Fase P5 — sesudah jalur inti stabil

- Edit TOC visual dan reorder chapter.
- Side-by-side preview halaman sumber dan hasil reflow untuk PDF.
- Resume batch dan ekspor laporan diagnosa.
- Dukungan sumber tambahan hanya bila ada fixture dan kebutuhan pengguna nyata.
- Jangan menambah DRM removal, cloud sync, atau fitur perpustakaan besar yang mengaburkan tujuan alat.

## 7. Prioritas issue

### Harus dikerjakan

1. PDF confidence + auto recommendation.
2. Inline image placement dan source-page mapping.
3. Metadata/TOC preview yang bisa dikoreksi.
4. EPUBCheck/fixture benchmark.
5. Browser integration test dan satu matriks hardware.
6. Worker/progress/cancel untuk file besar dan OCR.

### Baik dikerjakan setelahnya

- TOC editor, dedup image, cover selection, report export, offline dependency bundle.

### Di luar fokus

- Membuka atau menghapus DRM.
- Mengubah firmware reader dari aplikasi ini.
- Cloud storage/sync sebagai ketergantungan inti.
- Menjadi pengganti penuh Calibre.

## 8. Risiko dan keputusan desain

- **PDF tidak dapat dijadikan sumber reflow yang selalu sempurna.** Produk harus memilih kejujuran dan fallback fixed daripada heuristik agresif yang mengubah isi.
- **Fixed layout mengurangi aksesibilitas dan kontrol font.** Karena itu fixed harus menjadi pilihan sadar dengan penjelasan, bukan default universal.
- **Dependensi besar mengganggu offline dan RAM browser.** Bundling perlu dipertimbangkan setelah metrik ukuran dan penggunaan memori tersedia.
- **CrossPoint parser adalah target khusus.** CSS yang valid di browser belum tentu berguna di firmware; kompatibilitas harus diverifikasi terhadap parser dan perangkat, bukan hanya DOM browser.
- **Transfer Wi-Fi HTTP berada di jaringan lokal.** Fitur tetap opsional, dengan indikator alamat tujuan dan peringatan keamanan yang ringkas.

## 9. Definisi rilis 1.0

Read Maker layak disebut stabil ketika:

- sumber utama non-DRM dapat dikonversi offline tanpa kehilangan struktur penting;
- PDF diberi rekomendasi mode yang masuk akal dan hasil buruk tidak disamarkan;
- EPUBCheck lulus untuk seluruh fixture rilis;
- metadata, TOC, gambar, dan chapter dapat diperiksa sebelum download;
- minimal satu perangkat fisik per profil target telah diuji;
- jalur batch, OCR, dan Wi-Fi memiliki progress, cancel, serta error yang dapat ditindaklanjuti;
- dokumentasi menyatakan dengan jelas batas DRM, scan PDF, fixed layout, dan dukungan perangkat.
