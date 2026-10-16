# Penelaahan ReadMaker dan aplikasi pembanding

Tanggal pemeriksaan: 16 Oktober 2026. Penilaian ReadMaker berdasarkan kode lokal,
test suite, dan konversi browser dengan fixture sintetis. Kemampuan pembanding
ditelaah dari dokumentasi resmi yang diakses pada tanggal pemeriksaan.
Belum dilakukan benchmark bersama dengan berkas, perangkat, dan pengaturan
yang identik. Karena itu dokumen ini tidak menetapkan pemenang kualitas OCR,
ketajaman gambar, ukuran berkas, atau kecepatan konversi.

### Status implementasi lanjutan

Prioritas pertama sudah diimplementasikan: perbandingan sumber PDF dan hasil
per halaman, pembesaran sumber, penanda halaman OCR untuk ditinjau, koreksi teks,
simpan/batal/pulihkan, dan ekspor hasil koreksi. Teks literal tidak diperlakukan
sebagai HTML. Koreksi mengikuti split/urutan bab; perubahan membatalkan hasil
siap kirim sebelumnya. Halaman sebelum bookmark awal dan halaman gambar di
antara teks juga dipertahankan. Detail pengawasan Aira dicatat terpisah.

EPUBCheck kini menjadi gate pada workflow test dan deployment untuk empat
fixture representatif, termasuk EPUB hasil koreksi. Ini bukan EPUBCheck di
browser untuk setiap buku pengguna. Koreksi hanya bertahan selama sesi;
gambar preview belum menerima optimasi ekspor. Perangkat target pengguna
adalah Xteink X4 Pro/CrossPoint, tetapi belum siap untuk uji fisik.

Percobaan menyiapkan Calibre portable resmi 9.16.0 belum menghasilkan CLI:
installer macet dan proses uji dihentikan. Tidak ada angka perbandingan mutu
yang dihasilkan. Benchmark Calibre/CloudConvert tetap belum selesai.

## Posisi produk

ReadMaker paling sesuai sebagai alat konversi lokal di browser untuk pembaca
e-ink, khususnya ekosistem Xteink/CrossPoint. Nilainya ada pada alur singkat,
privasi berkas, preset, dan penyiapan hasil untuk perangkat. Dukungan format
dan adanya OCR tidak otomatis membuatnya setara dengan editor penerbitan
atau menjamin setiap PDF menghasilkan teks yang benar.

## Pro dan kontra aplikasi

| Aplikasi dan peran | Pro | Kontra / batas relevan |
| --- | --- | --- |
| **ReadMaker — konverter browser untuk e-ink** | Konversi lokal; UI Indonesia/Inggris; preset; OCR; batch/CBZ; grayscale; XTC/XTCH, wallpaper, kamus, Wi-Fi; review PDF per halaman dan koreksi teks | OCR masih dapat salah; belum mengimpor EPUB; editor isi terbatas pada blok hasil PDF dan sesi aktif; OCR berat bergantung RAM/CPU browser; helper awal perlu jaringan; belum uji perangkat fisik |
| **Calibre — konverter dan pengelola koleksi** | Format luas, pustaka dan metadata, editor, serta integrasi perangkat; cocok untuk koleksi besar | Banyak kontrol membutuhkan pemahaman; dokumentasinya mengakui batas PDF kompleks, multikolom, dan berbasis gambar. Penilaian beban belajar adalah inferensi dari luasnya kontrol, bukan hasil uji pengguna. [Fitur](https://calibre-ebook.com/about), [batas PDF](https://manual.calibre-ebook.com/conversion.html#convert-pdf-documents) |
| **CloudConvert — konverter daring** | PDF ke EPUB melalui web; pemrosesan server tidak memakai CPU lokal untuk tahap konversi | Memerlukan transfer berkas dan jaringan; bukan alur lokal seperti ReadMaker. Dokumentasi produk tidak membuktikan setiap PDF akan akurat atau lebih tajam. Layanan menyatakan berkas dihapus setelah pemrosesan. [Konversi](https://cloudconvert.com/pdf-to-epub), [keamanan](https://cloudconvert.com/security) |
| **Sigil — editor EPUB** | Edit XHTML/CSS, preview, metadata, daftar isi, pencarian regex, spell-check, dan plugin; kuat untuk penyempurnaan manual | Alur utamanya penyuntingan EPUB/HTML; bukan pengganti OCR PDF otomatis. Penguasaan markup membantu saat memperbaiki struktur. [Fitur resmi](https://sigil-ebook.com/about/) |
| **Pandoc — konverter dokumen terstruktur** | CLI yang dapat diulang, metadata/CSS, EPUB, dan konversi dari dokumen terstruktur; cocok untuk otomasi | Tidak menyediakan pembaca PDF bawaan dalam daftar format masukan; sumber scan memerlukan tahap ekstraksi/OCR lain; CLI menambah langkah bagi pengguna awam. [Format](https://pandoc.org/MANUAL.html#general-options), [EPUB](https://pandoc.org/epub.html) |

OCRmyPDF menjadi pembanding **tahap OCR**, bukan pesaing ekspor EPUB: menyediakan
lapisan teks PDF, deskew, dan pemrosesan scan/campuran, tetapi keluaran utamanya
tetap PDF. Dokumentasinya juga menjelaskan batas Tesseract pada urutan kolom,
scan buruk, dan kesalahan pengenalan. Pelajaran bagi ReadMaker ialah memperlakukan
OCR, susunan bacaan, dan struktur buku sebagai tahap berbeda.
[Dokumentasi OCRmyPDF](https://ocrmypdf.readthedocs.io/en/latest/introduction.html)

CrossPoint adalah firmware pembaca, sehingga bukan konverter pembanding.
Dukungan format dan perilaku rendernya tetap menjadi acuan kompatibilitas.
[Repositori resmi](https://github.com/crosspoint-reader/crosspoint-reader)

## Temuan pada implementasi ReadMaker

### Kelebihan yang sudah memiliki jalur kode

- Pemrosesan lokal menghindari unggah sumber saat konversi berkas biasa.
  Pengambilan artikel, pemuatan helper, dan pengiriman ke perangkat tetap memakai jaringan.
- Preset menyatukan pengaturan yang sebelumnya perlu dipilih sendiri. Pengguna
  dapat memilih teks mengalir, kualitas sumber, atau halaman asli.
- Pipeline mencakup format dokumen, komik, dan fitur pendamping e-ink.
  File gagal pada batch dilaporkan per item.
- Navigasi EPUB, XHTML, pemrosesan gambar, dan penanganan sumber memiliki
  regression test. Uji PDF nyata di browser menambah bukti di luar mock unit test.

### Kekurangan yang berdampak langsung

- **Teks OCR belum dapat dipercaya tanpa tinjauan.** Kode O/0/I/1, nama,
  aksen, cetakan kecil, dan scan buruk tetap berisiko. Confidence mesin bukan
  persentase kebenaran. Editor PDF sudah tersedia, tetapi belum merupakan editor EPUB umum.
- **Halaman asli menggunakan raster.** Tampilan sumber lebih terjaga, tetapi
  ukuran font tidak mengikuti pembaca dan pembesaran dibatasi resolusi gambar.
  Dithering atau penurunan resolusi untuk satu panel dapat mengurangi detail
  pada perangkat lain. Teks reflow yang benar lebih fleksibel lintas ukuran layar.
- **Dukungan standar belum sama dengan bukti perangkat.** XML self-check berjalan
  saat build. EPUBCheck menjadi gate CI untuk fixture, belum menjadi validasi
  penuh otomatis untuk setiap hasil pengguna. Lolos validator tidak membuktikan
  teks benar atau semua firmware akan menampilkan halaman dengan baik.
- **Transfer langsung masih beta.** Bergantung firmware, jaringan lokal, dan
  kebijakan browser; halaman HTTPS tidak bebas mengunggah ke perangkat HTTP.
- **Cakupan impor belum lengkap.** `parseToBook()` menolak EPUB; CBR dan
  MOBI HUFF/CDIC belum didukung langsung. Ini membatasi perbaikan buku yang sudah EPUB.
- **Artikel web bergantung CORS.** Tempel HTML memerlukan isi halaman yang valid;
  menempel URL saja tidak menggantikannya. Gambar jarak jauh belum otomatis
  menjadikan buku mandiri untuk dibaca offline.
- **Pemeliharaan perlu pemisahan modul.** Ekstraksi, OCR, rekonstruksi, builder,
  dan UI banyak berada dalam `index.html`. Perubahan heuristik dapat berdampak
  lintas format. Beban besar belum terbukti aman di ponsel dengan RAM rendah.

Bukti lokal: `index.html` (`parseToBook`, `pdfToBook`, `pdfItemsToHtml`,
`pdfPagesToOcrText`, `buildEpub`, pengiriman perangkat), `responsive.css`,
`device-compatibility.js`, `tests/run.js`, dan `docs/pdf-stress-lab.md`.

## Evaluasi terukur

Snapshot pengujian terbaru:

| Pemeriksaan ReadMaker | Hasil |
| --- | --- |
| Regression suite | 51/51 lolos |
| Empat EPUB keluaran browser | EPUBCheck: 0 fatal, 0 error, 0 warning |
| PDF kompleks, 48 halaman | 69/80 frasa; WER token normalisasi 5,46% (baseline 17,98%) |
| Urutan dua kolom | 8/8 probe lolos (baseline 0/8) |
| Ilustrasi pada reflow | 4/4 halaman ilustrasi memiliki gambar; ketepatan crop tetap perlu ditinjau |
| Preview lintas ukuran | 864 pemeriksaan; 0 overflow; 0 gambar gagal decode |
| PDF digital sintetis berulang, 1.200 halaman | 3.600/3.600 penanda; WER normalisasi 0% |

Sebelas frasa pada PDF kompleks masih gagal, terutama kode/label dan aksen
hasil scan. Pemeriksaan visual juga memperlihatkan kontras gambar scan yang
lebih lemah dan penanda OCR yang kadang dianggap heading. Retensi gambar atau
lolos validator tidak menutup kekurangan tampilan tersebut.

Hasil terbaru, perbandingan sebelum/sesudah, batas metode, dan kasus yang masih
gagal dicatat di `output/epub/stress-lab/Laporan-stress-test.md`. Dashboard
`simulasi-pdf-kompleks.html` menampilkan sumber sintetis dan hasil EPUB aktual.
Artefak lokal tersebut tidak diterbitkan bersama situs.

Korpus berisi 48 halaman sulit (digital, scan bersih, rusak, miring), satu PDF
digital berulang 1.200 halaman, dan kontrol HTML. Korpus ini belum mencakup
seluruh buku nyata, bahasa, tabel, matematika, atau variasi firmware.

## Prioritas pengembangan dari perbandingan

| Urutan | Pekerjaan | Kriteria penerimaan |
| --- | --- | --- |
| 1 | Tersedia: tinjau sumber/hasil dan koreksi teks PDF | Sudah diuji melalui browser; lanjutkan proofread dan korpus nyata |
| 2 | Benchmark bersama Calibre/CloudConvert, serta alur OCR + editor | Berkas dan mode yang sama; pisahkan WER, urutan baca, ilustrasi, ukuran, waktu, dan validitas; jangan menyamakan raster dengan reflow |
| 3 | EPUBCheck gate tersedia; uji perangkat fisik masih menunggu | Buka, TOC, font, gambar, pergantian halaman, resume, dan transfer lulus pada perangkat/firmware yang dicatat |
| 4 | Impor EPUB dan perbaikan isi ringan | EPUB yang sudah ada dapat diperiksa dan disimpan ulang tanpa kehilangan aset atau navigasi |
| 5 | Worker, pembatalan, batas memori, dan helper offline yang jelas | Pekerjaan berat dapat dibatalkan, UI tetap responsif, batas perangkat dilaporkan dengan jujur |
| 6 | Pisahkan model buku, transformasi, diagnostics, dan UI | Tiap tahap bisa diuji tersendiri tanpa menambahkan dependensi desktop ke situs statis |

Arah yang paling bernilai adalah konversi e-ink yang mudah diperiksa dan
dipercaya. Menambah daftar format tanpa menutup kesalahan isi tidak cukup untuk
menyamai hasil yang telah dikoreksi melalui Calibre atau Sigil.
