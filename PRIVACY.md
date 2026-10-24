# Privasi dan materi publik

Diperbarui: 25 Oktober 2026.

## Pemrosesan aplikasi

ReadMaker memproses berkas di peramban tanpa server konversi. Membuka situs dan memuat pustaka CDN tetap melibatkan jaringan. Pengambilan artikel/gambar menghubungi sumber terkait; transfer Wi-Fi mengirim keluaran ke perangkat yang dipilih. PDF, DOCX, OCR, dan QR belum dibundel sebagai paket offline lengkap.

Metadata penulis, judul, teks, dan gambar sumber dapat ikut masuk ke EPUB. Periksa dan sunting materi sebelum membagikan hasil. Laporan kualitas tidak menyertakan teks lengkap atau byte gambar buku, tetapi nama item atau rincian diagnostik dapat mengungkap konteks sumber. Periksa laporan sebelum mempublikasikannya.

## Materi repositori

- Gunakan fixture sintetis dan domain contoh seperti `example.invalid` untuk pengujian.
- Jangan menyertakan identitas pribadi, alamat kontak nyata, nomor identitas, kredensial, jalur profil komputer, atau dokumen pribadi dalam issue, log, tangkapan layar, dan rilis.
- Gunakan jalur relatif repo dalam dokumentasi. Konfigurasi alat lokal diberikan melalui parameter atau variabel lingkungan.
- Tinjau isi gambar dan metadata berkas; nama berkas saja tidak cukup untuk memastikan isinya aman dipublikasikan.
- Pertahankan pemberitahuan hak cipta dan atribusi dependensi yang diwajibkan lisensinya.

Artefak audit lama yang disanitasi merupakan catatan historis, bukan permintaan eksekusi atau bukti persetujuan yang dapat digunakan kembali. Nilai hash dalam snapshot lama menjelaskan konteks aslinya dan tidak memvalidasi berkas yang telah disanitasi.

## Sebelum publikasi

Periksa `git diff --cached` dan daftar berkas yang dilacak. `.gitignore` membantu mencegah berkas baru ikut ditambahkan; aturan itu tidak menghapus berkas yang sudah dilacak. Artefak deployment menggunakan daftar berkas aplikasi yang eksplisit.

Pembersihan isi saat ini tidak menghapus data dari riwayat Git, fork, cache, atau rilis terdahulu. Jika informasi sensitif pernah dipublikasikan, penanganan riwayat dan pencabutan kredensial merupakan pekerjaan tersendiri.
