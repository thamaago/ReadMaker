# Analisis ReadMaker — Vera, 24 Oktober 2026

## Cakupan dan status

Vera (`quality-assurance`, mode `review`) menerima konteks resmi melalui Jev setelah pengguna menyelesaikan persetujuan interaktif. Handoff berstatus `context_ready`; penanda sekali pakai dibuat oleh CLI resmi. Profil tidak memberikan izin eksekusi tambahan. Agen membaca kode dan tes; koordinator memeriksa ulang jalur kode temuan utama.

**Metode: penelaahan statis.** Tidak ada app, tes, benchmark, EPUBCheck, jaringan, atau perangkat fisik yang dijalankan pada putaran ini. Hasil pengujian 18 Oktober adalah bukti historis, bukan verifikasi ulang tanggal 24 Oktober. Kode produksi tidak diubah.

Sumber `index.html` SHA-256: `863262998f68dc5f13da0e2df4536a56bb7f2182b475696be980133f1fd1fc23`; `pdf-review.js`: `5ef63babfeeb59d9e4746d2e5d103f8561aec59905accd9bd9e756344280cfb7`.

Dokumen ini adalah snapshot tahap awal Vera. Sera, Lexi, Mira dan Raka kemudian menerima persetujuan dan menyelesaikan penelaahan masing-masing. Kesimpulan lintas bidang terdapat pada [laporan gabungan](combined-review.md); bagian-bagian di bawah tetap mencatat temuan awal Vera.

## 1. P1 — Pemecahan bab panjang dapat membuang isi secara diam-diam

Lokasi: `index.html:2814`, `splitChapterFlow`; digunakan oleh builder pada `index.html:3087`.

Untuk bab lebih dari 240.000 karakter, regex hanya mengambil beberapa jenis blok. Bila jumlah karakter blok mencapai 95% sumber, fungsi mengembalikan blok hasil regex dan meninggalkan bagian sumber lainnya. Gambar `<img>` yang berdiri sendiri, teks di luar blok, atau markup yang tidak cocok dapat hilang sekalipun kecil dibanding teks utama.

Contoh pemicu yang diturunkan dari kode, **belum dieksekusi**: sebuah `<p>` berisi 250.000 karakter diikuti `<img src="images/x.png"/>` lalu `<p>Akhir</p>`. Kedua paragraf cocok regex dan mencapai ambang 95%, tetapi elemen gambar tidak cocok. Aset masih bisa berada di ZIP sementara gambarnya tidak tampil dalam isi buku. Validitas XML saja tidak mendeteksi kehilangan isi seperti ini.

Perbaikan minimum yang disarankan: pemecahan harus mempertahankan seluruh node/teks dalam urutan semula; gunakan batas node DOM atau fallback tanpa pemecahan bila cakupan tidak utuh. Jangan menggunakan toleransi kehilangan 5% sebagai syarat keamanan. Verifikasi dengan paritas teks, jumlah/urutan gambar, catatan kaki, tabel bersarang dan bab panjang, diikuti pemeriksaan EPUB.

## 2. P2 — Pengaturan dapat bercampur dalam satu konversi batch

Lokasi: `index.html:3989` (`startBatch`), `index.html:3999` (`runBatch`), `index.html:3885` (`applyOutputPreset`), `index.html:4407`–`4422` (handler perubahan pengaturan).

`startBatch` menetapkan `parsed=null`. Pembatalan batch bergantung pada token/revisi, tetapi handler bahasa/pemisahan bab hanya menginvalidasi ketika `parsed` ada. Handler mode PDF/OCR juga langsung berhenti ketika tidak ada `parsed`. Perubahan preset dan target perangkat memiliki celah serupa. Sementara itu pipeline membaca beberapa pengaturan langsung dari DOM setelah `await` dan untuk file berikutnya.

Pemicu: mulai batch beberapa buku lalu ubah pemisahan bab, bahasa, preset, atau opsi PDF ketika satu buku masih diproses. Revisi dapat tetap sama sehingga proses tidak dibatalkan, sementara buku berikutnya memakai pengaturan berbeda. Opsi e-ink tertentu sudah mempunyai cabang invalidasi untuk `parsed=null`; pola ini belum konsisten di seluruh kontrol.

Perbaikan yang disarankan: ambil satu snapshot seluruh opsi batch dan teruskan ke semua tahap, atau invalidasi/batalkan proses ketika opsi relevan berubah. Tambahkan tes dengan promise tertahan, perubahan kontrol di tengah proses, dan pemeriksaan seluruh EPUB dalam ZIP. Tes batch yang dibaca saat ini mencakup nama bentrok/transisi sumber, belum skenario ini.

## 3. P2 — PDF dengan rasio halaman berbeda memakai satu viewport

Lokasi: `index.html:2042` (viewport pertama saja), `index.html:2054` (gambar berlebar 100%, tinggi otomatis), `index.html:3094` (viewport yang sama pada semua XHTML fixed).

Mode halaman asli merender masing-masing halaman mengikuti ukurannya, tetapi menyimpan hanya viewport halaman pertama. Builder lalu menerapkan ukuran tersebut pada semua bab. Jika halaman pertama lanskap dan halaman berikutnya potret, tinggi gambar berikutnya dapat melebihi viewport yang dinyatakan. Sebaliknya, gambar dapat tampil terlalu kecil atau menyisakan ruang luas.

Risiko pemotongan pada pembaca fixed-layout merupakan konsekuensi geometri kode, **belum diverifikasi secara visual pada ADE/CrossPoint**. `tests/pdf-fixed.test.js` yang dibaca menggunakan dua halaman dengan ukuran sama, sehingga tidak menutup kasus campuran orientasi/ukuran.

Perbaikan yang disarankan: bawa dimensi per halaman sampai builder, atau sesuaikan gambar utuh ke kanvas target konsisten dengan letterboxing. Pertahankan rasio dan seluruh isi; uji halaman potret/lanskap, ukuran campuran, dan rotasi pada preset sumber serta e-ink.

## 4. P2 — Sanitasi HTML membuang target tautan internal

Lokasi: `index.html:1039`–`1067` (`cleanNode`), `index.html:1073` (`htmlToBody`), `index.html:2742` (`toXhtml`).

Sanitizer mempertahankan `href` yang lolos pemeriksaan, tetapi tidak mempertahankan `id` atau anchor target. Pada impor HTML lokal, `<a href="#n">Catatan</a>` tetap dapat menghasilkan tautan `#n`, sementara `<p id="n">Isi catatan</p>` menjadi paragraf tanpa `id`. Serialisasi XHTML tidak membentuk ulang target tersebut. Catatan kaki dan navigasi internal sumber dapat berhenti berfungsi meskipun teksnya masih ada.

Contoh ini berasal dari penelusuran kode, bukan hasil EPUBCheck pada putaran ini. Fixture validasi yang dibaca belum memuat kasus tautan fragment HTML seperti ini. Perbaikan perlu mempertahankan ID aman dan unik, lalu menulis ulang referensi lintas XHTML ketika bab dipecah; sekadar menyimpan ID belum cukup untuk perpindahan target antarbab.

## Urutan tindak lanjut

1. Tutup kehilangan isi bab panjang dan buktikan seluruh teks/gambar tetap ada.
2. Pastikan satu batch memakai snapshot opsi yang konsisten atau dibatalkan dengan jelas.
3. Pertahankan seluruh halaman PDF dengan ukuran/orientasi campuran.
4. Pulihkan tautan catatan kaki/fragment sampai setelah pemisahan bab.

Setiap perbaikan memerlukan reproduksi otomatis minimum lebih dahulu, pemeriksaan regresi relevan, dan validasi keluaran. Tidak ada temuan di atas yang dinyatakan telah diperbaiki atau lulus pengujian pada 24 Oktober.
