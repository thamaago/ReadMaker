# ReadMaker Engine 1.0 — telaah dan implementasi

Tanggal laporan: 25 Oktober 2026. Pengembangan lokal, belum dipublikasikan. Laporan ini membedakan dependensi yang dijalankan, pola yang dijadikan acuan, dan kemampuan yang belum diadopsi. Dokumen riset September tetap merupakan catatan historis.

## Kemampuan dan asal acuannya

| Acuan | Yang benar-benar digunakan | Batas implementasi ReadMaker |
| --- | --- | --- |
| [PDF.js](https://github.com/mozilla/pdf.js) | Runtime 3.11.174 untuk membaca teks/geometri dan merender PDF | Rekonstruksi paragraf dan penilaian halaman merupakan kode aplikasi; bukan mesin konversi Calibre |
| [Mammoth](https://github.com/mwilliamson/mammoth.js) | Runtime 1.11.0 untuk DOCX ke HTML | Sanitasi, pengelolaan gambar dan pengemasan EPUB dilakukan aplikasi |
| [Tesseract.js](https://github.com/naptha/tesseract.js) | Runtime 5.1.0 untuk OCR halaman tanpa teks | Akurasi tergantung sumber dan bahasa; laporan kualitas tidak mengesahkan hasil pengenalan |
| JSZip | Runtime 3.10.1 untuk arsip dan EPUB | Builder OPF, navigasi, XHTML dan kebijakan keluaran adalah kode aplikasi |
| [Calibre](https://github.com/kovidgoyal/calibre/blob/master/src/calibre/ebooks/conversion/plumber.py) | Acuan alur input → transformasi → output, serta penanganan layout | Tidak menyertakan runtime atau plugin Calibre. Lisensi Calibre GPLv3, bukan dependensi MIT aplikasi |
| [Pandoc](https://github.com/jgm/pandoc/blob/main/README.md) | Acuan model perantara dan pemisahan tahap | BookModel ReadMaker adalah model XHTML ringan, bukan AST lengkap atau dukungan format Pandoc |
| [Sigil](https://github.com/Sigil-Ebook/Sigil) | Acuan tinjauan struktur dan perbaikan sebelum ekspor | Tidak menyertakan editor desktop Sigil atau kemampuan penyuntingan EPUB lengkap |
| [CrossPoint](https://github.com/crosspoint-reader/crosspoint-reader) | Profil firmware, struktur sederhana dan fitur pendamping perangkat | Kompatibilitas fisik X4 Pro belum diuji pada pekerjaan ini |
| [EPUBCheck](https://github.com/w3c/epubcheck) | Validator Java 5.4.0 untuk fixture lokal/CI | Tidak dijalankan di browser pada setiap ekspor pengguna |
| [epub-gen-memory](https://github.com/cpiber/epub-gen-memory), [epubcheck-ts](https://github.com/likecoin/epubcheck-ts), epub.js, EbookLib | Referensi pembanding | Tidak dipasang sebagai runtime aplikasi; tidak boleh dihitung sebagai fitur yang sudah diintegrasikan |

jsQR 1.4.0 dipakai untuk pemindaian alamat transfer perangkat, bukan konversi isi buku. Kredit dan lisensi dependensi tetap berada dalam THIRD_PARTY_NOTICES.md. Tidak ada kode implementasi dari repo pembanding yang disalin dalam pengembangan Engine ini. Pernyataan ini tidak merupakan audit menyeluruh asal setiap baris historis proyek.

## Versi khusus ReadMaker

Implementasi asli berada pada `index.html`, dengan API `window.ReadMakerEngine` dan versi `1.0.0`. Tidak ditambahkan server konversi atau framework baru.

1. **BookModel `readmaker.book/1`.** Menyalin daftar bab, metadata viewport, referensi halaman dan gambar untuk memisahkan tahap builder dari sumber yang dapat diedit. Ini bukan deep clone semua metadata arbitrer.
2. **Pemisahan berdasarkan byte UTF-8.** Target isi bagian 192 KiB, termasuk teks CJK dan emoji. Paragraf panjang dapat dibagi sambil mempertahankan teks, wrapper inline dan kepemilikan ID pertama. Batas ini kebijakan aplikasi, bukan batas resmi semua firmware. Tabel, daftar, kode dan ruby dipertahankan sebagai unit; unit yang lebih besar mendapat peringatan, bukan dipotong atau dibuang.
3. **Guard sebelum pengemasan.** Membandingkan urutan teks, penekanan, ruby, anchor, gambar dan alt pada konten yang telah disiapkan dengan XHTML hasil builder. Memeriksa XML termasuk OPF/NAV/NCX, gambar lokal, target tautan, konten aktif dan CRC PNG. Kerusakan yang terdeteksi memblokir unduhan EPUB dan menghasilkan rincian.
4. **Laporan `readmaker.quality/1`.** Panel setelah ekspor dengan status lolos, perlu ditinjau, atau diblokir; JSON dapat diunduh tanpa teks buku atau data gambar. Laporan batch menyertakan hasil per item dan kegagalan. Perubahan sumber membatalkan laporan lama. Ekspor wallpaper/XTC tidak membawa laporan EPUB sebelumnya.
5. **Ruby dipertahankan.** Sanitizer dan pratinjau mengizinkan `ruby`, `rt`, `rp` dengan atribut aman. Sumber CrossPoint yang ditinjau pada revisi `facaa87e379a499855e5980edd47beba4d01c884` menangani ruby dan pre. [Parser revisi tersebut](https://github.com/crosspoint-reader/crosspoint-reader/blob/facaa87e379a499855e5980edd47beba4d01c884/lib/Epub/Epub/parsers/ChapterHtmlSlimParser.cpp) merupakan bukti kode sumber, bukan hasil pengujian firmware pengguna. Normalisasi pre konservatif ReadMaker tetap dipertahankan untuk pembaca lama.

## Batas bukti dan prioritas berikutnya

Keunggulan pendekatan ReadMaker adalah pemrosesan lokal, preset sederhana, serta pemeriksaan kehilangan isi tepat sebelum pengemasan. Kekurangannya: biaya DOM dan memori berada di browser pengguna, model perantara belum sekaya Pandoc, dan koreksi/editor belum selengkap Calibre atau Sigil. Guard baru menambah pekerjaan pemeriksaan; belum ada benchmark berpasangan yang membuktikan peningkatan kecepatan. Mengambil pola pipeline dari repo pembanding tidak otomatis memberikan seluruh kemampuan repo tersebut.

Status lolos berarti pemeriksaan transformasi konten yang sudah diekstrak berhasil. Teks yang salah sejak ekstraksi PDF atau OCR dapat tetap lolos. Kesamaan dengan PDF harus dinilai terpisah melalui sampling visual dan koreksi halaman. EPUB raster tidak berubah menjadi teks reflow hanya karena lolos validasi struktur.

Pengujian parser tiruan dan profil firmware dalam suite merupakan simulasi konservatif, bukan eksekusi parser CrossPoint aktual. Paging daftar bab aplikasi juga berbeda dengan paginasi fisik pembaca. Tidak ada bukti untuk mengklaim lebih tajam, lebih cepat, atau lebih akurat daripada seluruh pesaing.

Prioritas lanjutan: ukur ekstraksi/OCR terhadap transkripsi referensi, uji firmware CrossPoint pengguna yang sebenarnya, lalu ukur performa pada buku besar dengan baseline yang sama. Jangan menambahkan dependensi hanya karena disebut dalam riset; ukur manfaat dan lisensinya terlebih dahulu.

## Validasi

Suite baru `tests/native-engine.test.js` mencakup batas byte, Unicode, pelestarian semantik, provenance, ruby, PNG rusak, XML metadata rusak, tautan hilang dan penolakan unduhan melalui UI. Fixture validasi baru mencakup teks CJK/ruby panjang dan tabel atomik besar. Hasil pengujian aktual dicatat setelah seluruh proses selesai; laporan internal tidak menggantikan EPUBCheck, pemeriksaan OCR manusia, atau uji perangkat.

Sumber final `index.html` SHA-256: `891e80d3a6203bbf0ba05fd2fb4d4a3dc5d92811cb4460b17da8d9cdf9b6d813`.

| Pemeriksaan | Hasil |
| --- | --- |
| `node tests/run.js` | 59 suite lolos; dua mock URL lama diperbaiki agar tetap menyediakan konstruktor URL asli |
| Fixture EPUBCheck 5.4.0 `--failonwarnings` | 9/9 lolos; termasuk CJK/ruby dan tabel besar |
| Browser Edge: review-fixes, web-resources, security, pdf-review | Lolos pada sumber final; unduhan EPUB/JSON, panel 360/480/1366 px, tautan hilang memblokir unduhan, SRI, gambar web/CORS, DOCX, koreksi PDF dan orientasi campuran |
| Kontrol auditor independen | 6/6 lolos |
| Audit paket akhir + EPUBCheck | 28 EPUB, 230 gambar raster: 0 kesalahan paket, 0 kegagalan integritas/decode gambar, 0 fatal/error/warning EPUBCheck |
| Stress sintetis | 30 bab teks (~2 MB), 200 halaman CBZ/EPUB, 100 halaman XTC/XTCH, 100.000 entri kamus, 50 EPUB batch selesai |

Stress batch 50 buku mencatat sekitar 547 MB RSS sesudah tahap tersebut, bukan pengukuran puncak memori atau jaminan kebutuhan RAM. Angka waktu dari mesin ini tidak membuktikan keunggulan terhadap pesaing atau ponsel. Tidak ada benchmark akurasi OCR baru, eksekusi parser firmware aktual, atau uji perangkat fisik.

Log lokal berada dalam `tmp/readmaker-engine/`; hasil browser di `output/epub/review-fixes`, `output/epub/web-resources`, `output/epub/pdf-review`, dan `output/security/2026-10-25`. Keluaran uji dan log tersebut tidak dilacak Git. Laporan sintetis OCR tetap berstatus perlu ditinjau, sedangkan tabel atomik besar mendapat peringatan walaupun EPUBCheck lolos; status tersebut sengaja tidak disamakan dengan sertifikasi kualitas visual.

Audit snapshot engine ini tersedia lokal pada `output/epub/standardization-2026-10-25/engine-baseline/audit-results.json`, dengan hash sumber yang sama. Korpus terdiri dari 24 EPUB yang dibuat ulang melalui pengujian saat itu dan 4 EPUB korpus browser historis yang diperiksa ulang. Karena itu, hasil 28/28 bukan bukti bahwa seluruh korpus historis dikonversi ulang oleh engine baru. Hasil ini juga bukan penilaian independen oleh agen atau sertifikasi perangkat. [Audit lima putaran selanjutnya](five-pass-audit-2026-10-25.md) mencatat perubahan dan hash sumber yang lebih baru.
