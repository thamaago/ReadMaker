# Gambar artikel yang mandiri — 18 Oktober 2026

Pembaruan berikutnya: judul bab ganda dan pengamanan kode ditangani dalam
[review keamanan dan bug](security-review-2026-10-18.md). Angka/hash dalam catatan
awal dokumen ini adalah rekaman putaran gambar artikel; berkas keluaran pada
folder kerja dapat diregenerasi oleh pengujian versi yang lebih baru.

## Perilaku pengguna

Artikel web dan dokumen HTML yang memuat gambar HTTP(S) atau data URI kini
menyimpan gambar tersebut di dalam EPUB. Pembaca tidak perlu mengunduh gambar
ketika membuka hasilnya. Tautan artikel biasa tetap berupa tautan, bukan konten
yang diunduh otomatis.

Di **Opsi lanjutan → Gambar artikel / HTML**:

- **Simpan gambar untuk dibaca tanpa internet** adalah default. Jika pengambilan
  atau pemeriksaan gambar gagal, ekspor berhenti dengan penjelasan.
- **Teks saja (tanpa gambar dari web)** menghapus gambar HTTP(S)/data URI dari
  teks ekspor. Tidak mengambil gambar dari jaringan. Gambar lokal yang sudah
  berada di daftar aset buku, termasuk halaman PDF dan cover, dipertahankan.

Pilihan ini berlaku pada ekspor satu buku dan konversi batch. Sumber dan
koreksi pengguna tidak dimutasi; pengguna bisa berganti mode lalu mencoba ulang.
Gambar URL sama digunakan kembali dalam beberapa bab tanpa unduhan berulang.

Tidak ada proxy konversi atau cara melewati CORS. Situs harus mengizinkan
browser mengambil gambarnya. Pengambilan tidak mengirim cookie/kredensial.

## Format, kualitas dan batas

- Format ditentukan dari byte, bukan ekstensi URL atau klaim `Content-Type`.
  PNG diperiksa struktur/checksum chunk-nya. Semua gambar yang diimpor melalui
  jalur ini harus berhasil didekode oleh browser sebelum disimpan.
- WebP dan BMP diubah menjadi PNG sebelum packaging, karena bukan format gambar
  inti EPUB. Konversi mempertahankan dimensi dan warna; pemrosesan e-ink yang
  dipilih pengguna berlangsung setelahnya. Animasi tidak dijanjikan dipertahankan.
  Keluaran berwarna tidak berarti jaminan piksel/profil warna identik pada semua
  format. PNG sumber pada contoh browser terbukti tersimpan byte-for-byte.
- PNG/JPEG/GIF yang tidak memerlukan konversi dipertahankan sebagai aset sumber
  sampai pengguna memilih pemrosesan e-ink. Pengujian ini tidak mengukur
  keunggulan ketajaman terhadap aplikasi lain.
- Batas pengambilan: 64 gambar unik, 8 MiB per gambar, anggaran 32 MiB total,
  15 detik per unduhan termasuk pembacaan isi respons. Ukuran aktual diperiksa,
  bukan hanya `Content-Length`. Konversi format memperhitungkan byte keluaran
  dalam anggaran secara konservatif. Batas decoding adalah 12 megapiksel.
- Streaming membatasi byte saat diterima. Fallback browser yang hanya menyediakan
  `arrayBuffer()` memeriksa ukuran setelah alokasi respons selesai.
- SVG dan format yang tidak dikenali ditolak pada jalur impor web ini. Gambar
  relatif dari HTML lokal tanpa alamat dasar/sumber aset tidak diselesaikan
  otomatis oleh fitur ini.

## Perlindungan kegagalan

Ekspor memakai salinan daftar bab dan gambar. Kegagalan CORS, HTTP, timeout,
batas ukuran, checksum atau decoding tidak mengubah sumber. Gambar hasil impor
memakai nama lokal yang tidak bertabrakan dengan aset buku. `srcset` dibuang
agar pembaca tidak mengambil varian gambar daring.

Jika pengguna mengganti dokumen saat permintaan lama berjalan, hasil/kegagalan
lama tidak mengganti status dan tombol dokumen baru. Ekspor batch juga memakai
snapshot sumber dan memeriksa token/revisi sebelum mengirim hasil.

## Bukti dan cara menguji ulang

- `tests/article.test.js`: ekstraksi artikel, penyimpanan gambar dan contoh
  EPUB yang semula gagal OPF-014/RSC-006.
- `tests/web-resources.test.js`: deduplikasi lintas bab, data URI, nama aset
  bertabrakan, sumber tidak berubah, mode teks saja, retry, CORS/HTTP,
  MIME/isi rusak, PNG/JPEG terpotong, CRC PNG, kegagalan decoder, timeout
  header/isi, batas byte/jumlah, serta permintaan lama setelah ganti dokumen.
- `tests/web-resources-browser.cjs`: Edge sungguhan dengan dua server lokal
  untuk menguji CORS, unduhan EPUB melalui tombol antarmuka, WebP→PNG, warna
  sumber, pemrosesan e-ink, penolakan piksel JPEG rusak, dan tiga ukuran layar.
  Pengujian ini memakai server terkendali, bukan klaim bahwa semua situs menerima
  permintaan browser.
- Gate EPUB menambahkan fixture `web-article.epub`, sehingga kini memeriksa
  **lima** EPUB melalui preflight gambar dan EPUBCheck tanpa warning.

Hasil browser dan tiga EPUB unduhannya disimpan di
`output/epub/web-resources/`. Identitas sumber direkam pada `browser-results.json`.
Fixture jsdom mengganti fungsi decoding karena jsdom tidak menyediakan decoder
gambar; decoding nyata diuji di Edge dan diperiksa lagi oleh audit Pillow.

## Hasil akhir yang diverifikasi

| Pemeriksaan lokal | Hasil |
| --- | --- |
| Seluruh rangkaian Node pada kode akhir | **53/53 lulus** |
| Kontrol auditor Python | **6/6 lulus** |
| EPUBCheck 5.4.0 + audit tambahan | **21/21 lulus**, 0 error dan 0 warning EPUBCheck |
| Integritas dan decoding raster | **224 aset**, 0 kegagalan |
| Sumber gambar/CSS eksternal yang terdeteksi | **0** |
| Lima fixture gate terbaru | Lulus preflight gambar dan audit EPUBCheck/Pillow |
| Edge: 360, 480, 1366 piksel | 0 overflow halaman, 0 page error |

Auditor penuh mengembalikan exit 0. Contoh `tests/sample-article.epub` yang semula
gagal kini menyimpan gambarnya dan lolos pemeriksaan. Korpus bertambah dari
17 menjadi 21: satu fixture gate artikel dan tiga unduhan browser ditambahkan.

Bukti akhir:
`output/epub/standardization-2026-10-18/final/audit-results.json`, berikut 21
laporan EPUBCheck; log tes pada
`tmp/pdfs/stress-lab/article-fix-unit-tests-final.log` dan
`tmp/pdfs/stress-lab/article-fix-output-audit.log`.
Hash `index.html` yang cocok antara aplikasi dan pengujian browser adalah
`46da242b27925ad4e873b908a291f73a87d8121485a3b38ebab6dc4282c649a6`.

Vera mereproduksi dua celah lalu memverifikasi penutupannya: gambar rusak tidak
diterima, dan kegagalan permintaan lama tidak menimpa dokumen baru. Lexi memeriksa
tiga EPUB browser dengan ZIP/Pillow: referensi lokal, alt sumber, dimensi, warna,
grayscale dan keluaran teks saja sesuai klaim. Review ini tidak mengesahkan
kesempurnaan teks, kualitas deskripsi alt, atau semua situs web.

Lexi menemukan prioritas editorial berikutnya: pada ketiga contoh artikel,
terdapat dua entri bab dengan judul sama, satu hanya berisi judul dan satu berisi
judul beserta isi. Perbaikan anatomi bab ini belum diterapkan dalam putaran
penyimpanan gambar. Audit decoder lengkap dan tes browser juga masih dijalankan
lokal; belum ada bukti run GitHub untuk perubahan ini.

Lima EPUB PDF/korpus dari putaran sebelumnya tetap menjadi bahan regresi
historis. Mereka tidak diklaim dibuat ulang dengan versi aplikasi ini.
Kualitas OCR dan aksesibilitas yang tercatat dalam
[audit 17 Oktober](epub-standardization-2026-10-17.md) masih merupakan pekerjaan
lanjutan. Uji fisik X4 Pro/CrossPoint belum dilakukan karena perangkat belum siap.
