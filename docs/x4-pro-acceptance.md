# Uji penerimaan Xteink X4 Pro / CrossPoint

Status 16 Oktober 2026: **belum diuji pada perangkat fisik**. Pengguna menyatakan
perangkat belum siap. Browser, pemeriksaan struktur, dan sumber firmware bukan
pengganti pemeriksaan layar serta transfer pada perangkat nyata.

## Berkas dan pengaturan

- `output/epub/pdf-review/ReadMaker-X4-Pro-uji-koreksi.epub`: unduhan aplikasi
  dari PDF sintetis 48 halaman, dengan satu koreksi teks literal pada halaman
  sumber 6. Kata `<tag>` sengaja menjadi teks biasa untuk menguji editor.
- Uji browser memilih target CrossPoint dan preset kualitas sumber. Tidak ada
  unggah otomatis ke perangkat saat pengujian ini; hanya unduhan lokal.
- `output/epub/stress-lab/complex-reflow.epub`: korpus OCR otomatis tanpa
  koreksi manual, termasuk kesalahan yang tersisa. Jangan menganggapnya sudah
  diteliti kata per kata.
- `complex-layout.epub`: pembanding halaman asli berbentuk gambar. Ukuran font
  pembaca tidak mengubah tulisan di dalam gambar.

## Prosedur ketika perangkat siap

Catat model, versi CrossPoint, font, ukuran font, orientasi, dan metode transfer.
Salin EPUB ke kartu SD atau unggah lewat halaman transfer bawaan CrossPoint.
Untuk pengiriman dari ReadMaker, aktifkan transfer Wi-Fi dan gunakan alamat
yang benar pada jaringan yang sama. Browser HTTPS dapat membatasi tujuan HTTP;
ikuti pesan aplikasi atau gunakan salinan lokal/transfer manual.

| Pemeriksaan | Hasil nyata yang perlu dicatat |
| --- | --- |
| Buka buku | Halaman pertama terlihat; tidak kosong atau restart |
| Navigasi | TOC menuju bagian yang benar, termasuk bagian awal |
| Koreksi | Teks `Teks uji koreksi & <tag> tetap aman.` tampil literal |
| Reflow | Mengubah ukuran font mengubah teks, tanpa potongan atau urutan kacau |
| Ilustrasi | Halaman sumber 6 dan variasinya tetap mempunyai ilustrasi |
| Scan | Periksa kode O/0/I/1 dan aksen terhadap sumber, bukan hanya tampilan tajam |
| Halaman asli | Gambar halaman terlihat; nilai keterbacaan tulisan kecil dan zoom |
| Pergantian halaman | Maju/mundur, awal/akhir bab, dan pergantian bagian stabil |
| Resume | Tutup/buka buku dan restart perangkat kembali ke posisi yang benar |
| Transfer | Upload selesai, ukuran file sesuai, file dapat dibuka setelah transfer |

Jika gagal, catat EPUB mana, bagian/halaman sumber, pengaturan dan pesan error.
Jangan menandai seluruh perangkat kompatibel hanya karena satu buku bisa dibuka.
