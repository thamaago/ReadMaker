# Telaah repo dan pembaruan materi publik

Tanggal: 25 Oktober 2026. Cakupan: dokumentasi aktif, teks antarmuka, fallback metadata PDF, fixture, serta artefak audit yang dilacak repo. Telaah ini bukan sertifikasi keamanan atau kompatibilitas perangkat.

## Temuan dan penyesuaian

| Temuan | Penyesuaian |
| --- | --- |
| README mencampur panduan pengguna, riwayat audit, dan klaim offline yang terlalu luas | Panduan berbahasa Indonesia dengan format, preset, kualitas, batasan, privasi, dan langkah pengembangan yang terpisah. |
| Matriks September menyebut EPUBCheck, split ukuran, dan koreksi PDF belum tersedia | Matriks dan roadmap mengikuti engine, helper PDF, test serta workflow terkini. Riset lama diberi penunjuk ke status aktif. |
| Identitas akun dan jalur komputer lokal muncul pada materi publik | Tautan penggunaan merujuk panel deployment; snapshot audit memakai jalur relatif; alat lokal memakai parameter. |
| Fallback PDF memiliki pengecualian untuk nama penulis tertentu | Pengecualian dihapus; fallback hanya mengambil penulis berlabel dari sumber. Fixture diganti data sintetis dan ditambah pemeriksaan nama tanpa label. |
| Klaim antarmuka menyatakan tanpa internet dan tidak ada unggahan ke mana pun | Teks ID/EN menjelaskan pemrosesan lokal serta penggunaan jaringan untuk fitur web, pustaka dan transfer perangkat. |
| Panduan kontribusi belum mencantumkan helper PDF dan seluruh dependensi jaringan | Daftar aset dan penjelasan dependensi diselaraskan, ditambah panduan materi publik. |

## Perkembangan upstream yang diperiksa

- [EPUB 3.3](https://www.w3.org/TR/epub-33/) tetap menjadi rujukan stabil pada dokumentasi keluaran.
- [EPUB 3.4, 22 Oktober 2026](https://www.w3.org/TR/2026/CRD-epub-34-20261022/) berstatus Candidate Recommendation Draft. Tidak dinyatakan sebagai dukungan aplikasi.
- [EPUBCheck 5.4.0](https://github.com/w3c/epubcheck/releases/tag/v5.4.0) merupakan rilis produksi yang diperiksa; versi ini sudah dipin pada workflow repo.
- [Advisory PDF.js](https://github.com/mozilla/pdf.js/security/advisories/GHSA-wgrm-67xf-hhpq) mendokumentasikan masalah eksekusi kode dan workaround menonaktifkan evaluasi. Repo masih menggunakan 3.11.174 dengan mitigasi; migrasi ke versi yang ditambal ditempatkan sebagai prioritas tinggi, belum dikerjakan dalam perubahan konten ini.

## Batas perubahan

Pembersihan berlaku pada isi workspace saat ini. Riwayat Git dan publikasi terdahulu tidak ditulis ulang. Pemberitahuan lisensi dan atribusi pihak ketiga dipertahankan. Nama peran dalam laporan audit lama merupakan label peran, bukan identitas pengelola proyek. Contoh wallpaper yang diperiksa berisi placeholder sintetis.

Aplikasi tetap mempertahankan metadata dan isi dokumen pengguna; perubahan ini tidak menambahkan anonimisasi otomatis EPUB. Tidak dilakukan push, deployment, transfer perangkat, benchmark OCR baru, atau uji hardware.

## Verifikasi

- `node tests/run.js`: 60 suite lulus, exit code 0; menggunakan runtime Node yang dibundel di lingkungan kerja.
- Tautan relatif pada dokumentasi aktif: valid.
- Snapshot JSON audit: dapat diparse dan memakai jalur proyek relatif.
- Pemindaian teks yang dilacak untuk pola jalur profil komputer dan tautan akun lama: 0 temuan. Pemeriksaan pola ini bukan jaminan ketiadaan seluruh data sensitif.
- Sintaks helper PowerShell: valid; helper tidak dijalankan.
- `git diff --check`: lulus.

Log lokal tersedia pada `tmp/public-content-tests.log`; log dan skrip pemeriksaan tidak menjadi aset situs. Skenario browser, EPUBCheck Java dan uji hardware tidak dijalankan ulang dalam perubahan ini. Hasil audit terdahulu tetap terikat pada snapshot aslinya.
