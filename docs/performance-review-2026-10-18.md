# Percepatan konversi tanpa pengurangan kualitas

Revisi lokal 18 Oktober 2026, dengan penelaahan independen Vera (kode dan keamanan) dan Lexi (paritas keluaran). Tidak mencakup deployment atau pengujian perangkat fisik.

## Perubahan

- Blok HTML PDF beserta nomor halamannya disiapkan sekali sebelum penyusunan bab dari bookmark. Urutan dan aturan paragraf yang melintasi halaman dipertahankan.
- Pencarian ilustrasi PDF menggunakan indeks nama, mempertahankan gambar pertama bila ada nama duplikat.
- Preflight DOCX tetap membuka seluruh entri dengan batas streaming aktual, tetapi cukup menghitung byte tanpa mengumpulkan dan menyalin isi yang akan dibuang. Anggaran total tetap 128 MiB, per entri 32 MiB.
- Pemeriksaan checksum PNG menggunakan tabel CRC-32 dengan hasil penolakan yang sama.
- WebP/BMP cukup didekode saat konversi PNG; pemeriksaan decoding, dimensi maksimal, timeout dan anggaran byte tetap berlaku.

OCR, resolusi, warna, pilihan e-ink, dithering, kompresi gambar, dan pemeriksaan XML tidak diubah. Tidak ada cache tanpa batas atau penanda yang melewati pemindaian resource.

## Pengukuran

`tests/performance-browser.cjs` menjalankan versi sebelum dan sesudah dalam proses Edge yang sama menggunakan JSZip produksi 3.10.1. Setiap tahap mempunyai satu pemanasan dan tiga pengukuran; tabel menampilkan median. Input sintetis deterministik, tanpa jaringan atau OCR.

| Tahap | Sebelum | Sesudah | Pengurangan waktu |
|---|---:|---:|---:|
| Integritas PNG sekitar 4 MiB | 173,1 ms | 13,0 ms | 92,5% |
| Penyusunan bookmark 400 halaman, 80 bab | 38,6 ms | 5,3 ms | 86,3% |
| Preflight entri DOCX 12 MB | 27,4 ms | 20,2 ms | 26,3% |
| Penyusunan bookmark + ekspor EPUB | 83,1 ms | 52,4 ms | 36,9% |

Packaging saja tercatat 45,4 → 40,9 ms, tetapi jalur packaging gambar lokal tidak diubah; variasi ini tidak dijadikan klaim percepatan. Versi baseline dijalankan lebih dahulu; tiga sampel bukan benchmark lintas perangkat. Pengukuran gabungan dimulai dari blok HTML PDF, **bukan** pembukaan PDF, rendering, OCR, unduhan mesin, atau keseluruhan konversi DOCX. Jangan menyebut semua konversi 37% atau 92% lebih cepat.

Laporan mentah dan keluaran ada di `output/performance/browser-results.json`, `baseline.epub`, dan `final.epub`. SHA-256 sumber baseline: `5ff1d78158c3914a396504854b8c81cb044a6b98c5a6613c589f02b21de01257`; sesudah: `863262998f68dc5f13da0e2df4536a56bb7f2182b475696be980133f1fd1fc23`.

## Bukti kualitas dan keamanan

- Seluruh **87 anggota EPUB** sama setelah hanya UUID dan waktu modifikasi generator dinormalisasi. Pemeriksaan mencakup teks literal, XHTML, NAV/NCX/spine, metadata, CSS, alt dan byte gambar. Ukuran ZIP 41.056 / 41.057 byte; selisih satu byte berasal dari metadata generator terkompresi, bukan perubahan kualitas.
- Kedua EPUB benchmark lulus integritas gambar dan EPUBCheck 5.4.0 dengan nol error/warning.
- Lima fixture tambahan dibuat ulang dengan sumber terbaru (koreksi OCR tersimpan, RTL, fixed pages, komik, artikel offline); seluruhnya lulus integritas gambar dan EPUBCheck tanpa error/warning. Jadi tujuh EPUB diperiksa validator eksternal pada putaran ini.
- 55 suite sebelumnya lulus melalui `tests/run.js`; satu suite baru `performance-parity.test.js` juga lulus terpisah. Runner berikutnya otomatis mencakup seluruh 56 suite. Regresi baru mencakup CRC rusak, batas streaming mode verify dan paragraf lintas halaman.
- Uji Edge artikel/gambar memastikan WebP menjadi PNG pada dimensi dan warna asli, hasil e-ink tetap grayscale, CORS tetap ditolak, dan PNG/JPEG/WebP/BMP palsu tetap gagal. Arsip berukuran deklarasi palsu 1 byte dengan isi aktual 4 MiB ditolak pada batas uji streaming 32 KiB menggunakan JSZip produksi. Bukti terbaru beserta hash sumber: `output/epub/web-resources/browser-results.json`.
- Uji Edge keamanan memastikan preview inert dan konversi DOCX dengan Mammoth asli tetap lulus, tanpa request pelacak atau page error: `output/security/2026-10-18/browser-results.json`.
- Stress manual juga lulus: 3.000 blok teks (30 bab), CBZ/EPUB 200 halaman, XTC/XTCH 100 halaman, kamus 100.000 entri, tiga arsip rusak, dan batch 50 EPUB. Log: `tmp/performance/manual-stress.log`. Ini pengujian Node/JSDOM, bukan pengukuran perangkat pengguna; fixture PNG lama yang CRC-nya tidak valid telah diganti dengan diagram valid.

Vera tidak menemukan blocker pada patch dan menjalankan empat suite terkait. Lexi mengonfirmasi kesamaan 87 anggota EPUB secara independen. Saran keduanya mengenai pengujian WebP/BMP rusak dan mode verify pada browser telah ditutup oleh uji tambahan di atas.

Ketajaman tidak dikurangi untuk mengejar waktu. Ini membuktikan mutu fixture tetap terjaga; bukan peningkatan akurasi OCR atau bukti mengungguli Calibre/CloudConvert. Validasi fisik Xteink X4 Pro CrossPoint masih belum dilakukan karena perangkat belum siap.

## Menjalankan ulang

Simpan `index.html` sebelum perubahan, lalu jalankan:

```powershell
node tests/performance-browser.cjs path/to/baseline.html
node tests/performance-parity.test.js
node tests/web-resources-browser.cjs
node tests/security-browser.cjs
node tests/validate-epub.cjs tmp/xteink-conversion/validator/epubcheck-5.4.0/epubcheck.jar output/performance
```

Browser manual memerlukan Playwright dan Edge; `READMAKER_RUNTIME_MODULES` dapat menunjuk direktori node_modules runtime, `BROWSER_BIN` dapat menunjuk executable Chromium lain. EPUBCheck memerlukan Java 17. Jangan membandingkan hasil dari mesin atau input berbeda sebagai percepatan patch.
