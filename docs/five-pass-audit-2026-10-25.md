# Audit aplikasi dan keamanan — lima putaran

Tanggal: 25 Oktober 2026. Audit lokal oleh koordinator, bukan pentest independen atau sertifikasi perangkat. Perubahan sebelumnya dalam workspace dipertahankan. Tidak ada deployment, push, pemakaian file pribadi baru, atau pengiriman ke perangkat pengguna.

## Metode

Lima area ditelaah: (1) alur input dan penggantian sumber, (2) parser serta pengemasan keluaran, (3) batas keamanan dan dependensi, (4) pembatalan/asinkron/transfer, (5) regresi dan distribusi publik. Setelah perbaikan, seluruh suite dijalankan ulang **lima kali secara berurutan** pada hash aset aplikasi yang sama. Pengulangan berguna mendeteksi ketidakstabilan, tetapi bukan lima penilaian independen dan tidak memperluas cakupan setiap test secara otomatis.

Runner `tests/run-five-pass.cjs` menyimpan exit code, jumlah suite, durasi, log dan hash sumber per putaran di `tmp/five-pass-audit/results.json`. Perubahan kode selama putaran membuat hasil tidak sah. Putaran eksplorasi sebelum kode final tidak dihitung sebagai kelima hasil final.

## Temuan dan perbaikan

| ID / prioritas | Bukti dan dampak sebelum perbaikan | Perbaikan |
| --- | --- | --- |
| F1 / P1 | `mobiParseTagx` mempercayai panjang TAGX dari metadata. Metadata kecil dengan panjang besar membentuk loop/alokasi yang tidak mengikuti ukuran record. Pembacaan VWI dan batas entri juga belum ketat. | Validasi offset, panjang dan alignment; TAGX opsional maksimal 64 KiB; IDXT/entri harus berada dalam record; VWI maksimal lima byte dan 32 bit, harus memiliki terminator. Metadata TOC yang tidak valid memakai fallback yang sudah ada. |
| F2 / P1 | `palmDocDecompress` dan penggabungan teks memakai array angka tanpa batas keluaran. Referensi kompresi rusak dapat menghasilkan byte kosong tanpa kesalahan yang jelas. | Buffer byte terbatas: 32 MiB per record kompresi dan 128 MiB total teks. Periksa literal/backreference, tabel record, panjang header, metode kompresi dan flag enkripsi sebelum memproses. Teks dikumpulkan sebagai byte chunks, bukan array angka JavaScript. |
| F3 / P2 | `createXtcWriter` memvalidasi jumlah halaman/dimensi format, tetapi mengalokasikan seluruh keluaran tanpa anggaran total. Arsip dengan banyak gambar kecil bisa menghasilkan alokasi besar. | Maksimal 128 MiB keluaran native dan batas kanvas 12 juta piksel per halaman diperiksa sebelum alokasi. Batas ini kebijakan aplikasi, bukan klaim batas resmi Xteink. |
| F4 / P2 | Wallpaper dan kamus belum menerapkan batas sumber seperti jalur konversi buku. | Tolak sumber >128 MiB sebelum membaca; periksa ukuran aktual setelah membaca, serta dimensi sumber/kanvas wallpaper. Pemeriksaan dimensi setelah decode tidak dapat menjamin browser tidak mengalokasikan memori untuk decode lebih dahulu. |
| F5 / P2 | Wallpaper/kamus lama dapat selesai atau gagal sesudah pengguna membuka sumber baru, lalu mengunduh hasil usang atau mengganti status sumber aktif. | Gunakan job pembatalan yang sama; periksa setelah operasi asinkron dan sebelum unduhan. Abaikan kegagalan terlambat dari job yang sudah dibatalkan. |
| F6 / P2 | Exception sinkron pada constructor/open/send XHR dapat meninggalkan kontrol transfer terkunci sampai timeout. | Tangkap kegagalan awal, bersihkan timer dan instance aktif, pulihkan kontrol dan tampilkan kegagalan. |
| F7 / P2 | Perubahan sumber mencegah unduhan EPUB lama, tetapi fetch gambar web yang sedang berjalan masih berlanjut sampai selesai/timeout. | Teruskan sinyal job pada ekspor tunggal/batch; batalkan fetch/reader dan hentikan persiapan sumber. Listener dibersihkan setelah selesai. |
| F8 / P2 | Hasil QR lama dapat menimpa alamat dari pemindaian terbaru atau sumber yang telah berganti. Alamat hasil scan belum dinormalisasi dengan validator transfer. | Nomor permintaan dan token sumber menolak hasil usang; jangan menimpa alamat saat transfer aktif; normalisasi menolak alamat dengan kredensial atau protokol tidak valid. |
| C1 / penguatan | Workflow test tidak menyatakan izin token secara eksplisit dan mengikuti default repository. | Tetapkan `permissions: contents: read`. Ini pengurangan izin, bukan bukti token pernah disalahgunakan. |

Reproduksi dan regresi terdapat dalam `tests/five-pass-regressions.test.js`. Uji memakai input kecil dan batas terkontrol; tidak mencoba menghabiskan RAM mesin. Log reproduksi awal menunjukkan guard XTC belum ada. Berkas MOBI dan NCX normal yang sudah ada tetap diuji, sehingga penolakan data rusak tidak hanya diverifikasi dengan test negatif.

## Keamanan yang diperiksa ulang

- Sanitasi HTML/Markdown/DOCX/FB2, pratinjau inert, atribut event/protokol aktif, MIME gambar dan jalur arsip.
- Pembatasan inflate arsip dan stream web, CRC/decode gambar, target fragment serta XML paket EPUB.
- Kepemilikan job, status usang, transfer HTTP/WebSocket, ACK, timeout dan pembatalan.
- SRI script tambahan, izin CI, daftar enam aset publik, checksum validator, serta pencarian pola token/private key pada sumber proyek. Pencarian pola tidak membuktikan ketiadaan semua rahasia.

[Advisory resmi PDF.js CVE-2024-4367](https://github.com/mozilla/pdf.js/security/advisories/GHSA-wgrm-67xf-hhpq) menyebut risiko ketika `isEvalSupported` aktif. ReadMaker masih memakai versi 3.11.174 yang berada dalam rentang versi terdampak, dengan mitigasi `isEvalSupported:false` pada kedua pemanggilan `getDocument`. Parameter `enableScripting:false` juga diberikan; aplikasi tidak menginisialisasi viewer/scripting sandbox PDF. Mitigasi ini tidak berarti dependensi lama sudah menjadi versi yang ditambal. Migrasi PDF.js ke versi yang ditambal tetap pekerjaan lanjutan dengan pengujian worker/renderer.

[Dokumentasi keamanan Mammoth](https://github.com/mwilliamson/mammoth.js#security) menyatakan konversinya tidak menyanitasi sumber dan dokumen tertentu dapat membutuhkan CPU/memori besar. ReadMaker menyaring HTML sesudah konversi dan membatasi arsip; itu tidak membuktikan seluruh input patologis aman. [Daftar advisory JSZip](https://github.com/Stuk/jszip/security/advisories) dan [manifest upstream](https://github.com/Stuk/jszip/blob/main/package.json) ditinjau sebagai informasi tambahan; tidak dilakukan klaim SCA lengkap hanya dari halaman tersebut.

## Batas yang masih terbuka

Xteink X4 Pro/CrossPoint belum siap untuk uji fisik. OCR belum dibandingkan ulang dengan transkripsi manusia. Parser sinkron, analisis geometri PDF dan decode gambar tetap dapat memerlukan CPU/memori besar; batas byte tidak merupakan batas RAM total atau sandbox eksekusi. Script pekerja/aset OCR dari CDN tidak semuanya dilindungi SRI seperti script pemuat awal. Tidak ada migrasi CSP penuh, fuzzing semua parser, atau audit seluruh dependency transitif pada pekerjaan ini.

Transfer perangkat tetap menggunakan HTTP/WebSocket lokal tanpa enkripsi transport; pengujian di sini memakai simulasi protokol, bukan verifikasi server/firmware fisik. Batas sumber dan keluaran juga tidak berarti proses lain atau browser tidak dapat kehabisan memori. Penolakan buku sangat besar merupakan perilaku yang disengaja; file dapat perlu dibagi. Pesan anggaran umum aplikasi belum merinci setiap batas internal per record Kindle.

## Hasil final

SHA-256 final `index.html`: `359da4db8e3ddf34529ba5f17425154f61c3962c27ea448b752cdfe036748a35`.

| Putaran final | Suite | Exit code | Hash aset tetap | Hasil |
| --- | --- | --- | --- | --- |
| 1 | 60 | 0 | Ya | Lolos |
| 2 | 60 | 0 | Ya | Lolos |
| 3 | 60 | 0 | Ya | Lolos |
| 4 | 60 | 0 | Ya | Lolos |
| 5 | 60 | 0 | Ya | Lolos |

Total 300 eksekusi suite, bukan 300 suite berbeda. Durasi masing-masing sekitar 143, 131, 134, 126 dan 128 detik pada mesin pengujian; angka ini bukan benchmark produk atau perangkat pengguna. Log disimpan pada `tmp/five-pass-audit/round-1.log` sampai `round-5.log`, beserta `results.json`.

Lima skenario browser terpisah juga lolos pada hash yang sama:

- `review-fixes-browser.cjs`: SRI, pratinjau bab, pelestarian isi, orientasi PDF campuran, panel kualitas mobile, unduhan JSON dan pemblokiran tautan rusak.
- `security-browser.cjs`: injeksi metadata FB2 ditolak, preview tidak mengeksekusi isi aktif/tidak menghubungi tracker, konversi DOCX dengan Mammoth/SRI menghasilkan unduhan.
- `web-resources-browser.cjs`: CORS, pengemasan gambar, decode data rusak ditolak, batas arsip dengan ukuran metadata palsu, keluaran tanpa gambar web dan lebar layar.
- `pdf-review-browser.cjs`: 7 pemeriksaan koreksi PDF dan 4 pemeriksaan layout, tanpa error.
- `auxiliary-browser.cjs`: unggahan gambar menghasilkan BMP 480×800 dengan palet hitam-putih, unggahan kamus menghasilkan ZIP StarDict yang valid dan menggabungkan kata duplikat, batas wallpaper diperiksa sebelum membaca.

Sembilan fixture EPUB lolos EPUBCheck 5.4.0 dengan `--failonwarnings`; enam kontrol auditor juga lolos. Keluaran browser, log dan JSON bukti tersedia lokal dalam `output`/`tmp` dan tidak dilacak Git. Uji browser tidak merupakan penilaian ketajaman di layar e-ink fisik.

Audit paket terakhir selesai pada hash sumber final yang sama: **28 EPUB, 230 gambar raster, 0 kesalahan paket, 0 kegagalan integritas/decode gambar, 0 kegagalan EPUBCheck dan 0 peringatan EPUBCheck**. Laporan lokal: `output/epub/standardization-2026-10-25/security/audit-results.json`. Korpus berisi 24 EPUB yang dibuat ulang oleh pengujian saat ini dan 4 keluaran browser historis yang diperiksa ulang; keempat berkas historis itu tidak diklaim dikonversi ulang oleh perbaikan ini. Bukti engine sebelum audit dipertahankan pada folder `engine-baseline` di direktori standardisasi yang sama.

Hasil seluruh pemeriksaan tersebut tidak menunjukkan kegagalan pada kasus yang diuji. Hasil itu tidak membuktikan seluruh PDF atau perangkat akan selalu bekerja, maupun ketiadaan semua celah keamanan. Perubahan tetap lokal dan belum dipublikasikan.
