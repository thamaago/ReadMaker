# PDF scan beresolusi tinggi

Status: 25 Oktober 2026.

## Masalah

Ukuran PDF terkompresi tidak menggambarkan kebutuhan memori saat gambar dibuka. Scan 3.072 × 4.490 berisi 13.793.280 piksel; kode lama mencoba mengubah gambar tertanam tersebut menjadi canvas penuh dan ditolak oleh batas 12 juta piksel, bahkan sebelum OCR berjalan.

## Perilaku setelah perbaikan

- Jalur reflow memeriksa lapisan teks seluruh halaman sebelum mengekstrak gambar.
- Jika seluruh halaman tidak memiliki teks dan OCR mati, aplikasi otomatis menyiapkan EPUB halaman asli. Setiap halaman mempunyai gambar dan viewport sendiri; urutan dan orientasi mengikuti render PDF.js.
- Untuk PDF campuran tanpa OCR, halaman teks tetap menjadi reflow dan halaman tanpa teks disertakan sebagai gambar pada posisi halaman sumber.
- Dengan OCR aktif, halaman tanpa teks langsung dirender untuk OCR tanpa mengekstrak bitmap scan asli terlebih dahulu. Halaman yang tidak menghasilkan teks tetap disertakan sebagai gambar dan ditandai untuk ditinjau.
- Render halaman asli dan OCR menghitung skala aman sebelum membuat canvas: maksimal 12 juta piksel dan sisi maksimal 16.384 piksel, dengan margin pembulatan serta rasio aspek yang dipertahankan.
- Koordinat hasil OCR menggunakan skala render aktual, termasuk ketika skala diturunkan.
- Canvas sementara dilepas setelah halaman selesai atau gagal; render dapat dibatalkan. Batas akumulasi keluaran 128 MiB tetap berlaku.
- Antarmuka ID/EN menjelaskan halaman tanpa lapisan teks dan kebutuhan OCR. Laporan kualitas memberi peringatan untuk halaman yang dipertahankan sebagai gambar dalam keluaran reflow.

## Batas

Render halaman asli tetap berupa gambar; ukuran huruf tidak dapat diatur seperti teks reflow. Resolusi render merupakan kompromi keterbacaan dan memori, bukan salinan seluruh piksel scan asli. Akurasi OCR perlu ditinjau manusia. PDF.js masih dapat mengalokasikan buffer internal untuk decode; batas canvas aplikasi bukan jaminan batas RAM total browser. Gambar terlalu besar pada halaman digital yang memiliki teks tetap mengikuti guard ekstraksi gambar yang ada.

Pemeriksaan teks awal menambah satu tahap pembacaan halaman pada jalur reflow. Tidak ada klaim percepatan konversi. Tidak ada migrasi versi PDF.js dalam perubahan ini.

## Pengujian

`tests/pdf-scan-safety.test.js` mencakup pemilihan halaman asli otomatis, alokasi render terbatas, PDF campuran dan urutan gambar, OCR dengan skala adaptif, OCR kosong, peringatan laporan, pelepasan canvas pada kegagalan, serta pembatalan.

Uji browser dengan PDF scan yang disediakan secara lokal:

```sh
node tests/pdf-scan-browser.cjs <local-scan.pdf>
```

Prasyarat: Playwright dan Edge/Chromium. Gunakan `READMAKER_RUNTIME_MODULES` bila paket Playwright berada dalam runtime terpisah, serta `BROWSER_BIN` untuk lokasi browser. Skrip memeriksa deteksi otomatis, jumlah halaman/gambar, ekspor EPUB, dan laporan kualitas. Berkas dipilih secara lokal; judul serta penulis keluaran uji diganti nilai netral. Skrip tidak mencetak isi atau identitas sumber.

## Hasil verifikasi

- Node.js 24.22.1, `node tests/run.js`: 61 suite lulus, exit code 0, pada kode final.
- Edge dengan PDF.js dan canvas asli: sampel lokal 180 halaman tanpa teks berhasil dideteksi dan diekspor menjadi 180 halaman gambar EPUB, 24.785.069 byte, laporan kualitas `passed`, 0 isu, 0 error browser. Metadata keluaran uji diganti nilai netral; sumber dan hasil buku tidak ditambahkan ke repo.
- Pemeriksaan struktur ZIP, jumlah gambar, dan metadata `pre-paginated` dilakukan pada unduhan browser.
- `git diff --check`: lulus.
- OCR pada resolusi adaptif diuji melalui worker tiruan yang terkontrol; pengukuran akurasi OCR terhadap transkripsi manusia, EPUBCheck Java, serta uji perangkat fisik tidak dijalankan ulang pada perubahan ini.

Log lokal: `tmp/scan-safety-final-tests.log` dan `tmp/browser-scan-final-source.log`. Artefak pribadi serta log lokal tidak dilacak Git.


SHA-256 aset final:

- `index.html`: `f70c9d8589d56177d95fa1634795baace87343ea62265ecab61c091bc3b015b4`
- `pdf-review.js`: `1b0238157da7b3927fcf2e018ceb23ccd92c37e88729bc498b7968d0a46069ed`
