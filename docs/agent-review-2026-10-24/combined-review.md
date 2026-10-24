# Telaah lintas agen ReadMaker — 24 Oktober 2026

## Dasar penilaian

Pengguna menyetujui lima cakupan baca-saja melalui CLI Jev. Konteks resmi Vera (`review`), Sera (`threat-review`), Lexi (`publishing`), Mira (`audit`) dan Raka (`design`) diterima dengan handoff sekali pakai; seluruh agen menyelesaikan laporannya. Profil menjadi instruksi peran bagi subagen Codex, bukan layanan model/API Jev yang berjalan sendiri.

Penelaahan ini berdasarkan kode, tes yang dibaca dan laporan lokal. Tidak ada tes, app, browser, EPUBCheck, benchmark baru, jaringan, atau perangkat fisik yang dijalankan. Temuan di bawah belum diperbaiki. Hasil tes 18 Oktober tetap bukti historis; keberhasilannya tidak mencakup semua pemicu yang baru ditemukan.

Sumber utama: `index.html` SHA-256 `863262998f68dc5f13da0e2df4536a56bb7f2182b475696be980133f1fd1fc23`. Temuan Vera sebelumnya dan contoh pemicunya tetap tersedia di [findings.md](findings.md).

## Kesimpulan produk

ReadMaker mempunyai fondasi yang berguna: konversi lokal, preset, review/koreksi PDF, NAV/NCX, penanganan RTL, gambar offline, pembatas arsip, preview inert, dan pemeriksaan keluaran di CI. Kode pembatas fetch, anggaran streaming ZIP, serta `isEvalSupported:false`/`enableScripting:false` masih terlihat. Keberadaan kontrol tersebut tidak membuktikan aplikasi bebas bug atau setiap buku sudah berkualitas tinggi.

Masalah terpenting saat ini adalah **keutuhan isi**. File dapat terbentuk tanpa semua isi yang seharusnya ditampilkan, sementara pemeriksaan struktur/XML tidak cukup untuk mendeteksi kehilangan tersebut. Prioritas berikutnya adalah konsistensi proses, batas sumber daya, integritas transfer, dan kemampuan pengguna meninjau hasil.

## Temuan dan keputusan konsolidasi

P1 berarti risiko kehilangan isi yang harus didahulukan. P2 berarti kegagalan perilaku atau mutu yang berdampak pada skenario tertentu. P3 merupakan peningkatan kegunaan atau masalah yang masih perlu verifikasi interaksi. Ini prioritas rekayasa lokal, bukan skor kerentanan resmi.

| ID | Prioritas | Temuan | Bukti kode | Penelaah |
|---|---|---|---|---|
| Q1 | P1 | Pemecahan bab >240.000 karakter dapat meninggalkan gambar mandiri/teks yang tidak cocok regex; toleransi cakupan 95% memungkinkan isi terbuang. | `index.html:2814`, pemanggil `3088` | Vera, Lexi; ditelusuri ulang koordinator |
| Q2 | P2 | Sanitizer mempertahankan `href="#n"` tetapi membuang target `id="n"`; catatan kaki HTML dan DOCX dapat kehilangan tujuan. | `index.html:1041–1060`, `2590`, `2742` | Vera, Lexi; ditelusuri ulang koordinator |
| Q3 | P2 | Semua halaman PDF fixed memakai viewport pertama, walaupun raster tiap halaman memiliki rasio berbeda. | `index.html:2042–2054`, `3094` | Vera, Lexi; ditelusuri ulang koordinator |
| Q4 | P2 | `well-` + `known` atau `self-` + `esteem` dapat disatukan menjadi kata tanpa tanda hubung. | `index.html:1524–1529`, `1678`, `1702` | Lexi; ditelusuri ulang koordinator |
| J1 | P2 | Pengaturan berubah saat batch berjalan tanpa invalidasi konsisten karena `parsed=null`; satu ZIP dapat berisi buku dengan setelan berbeda. | `index.html:3885`, `3989–4045`, `4407–4422` | Vera; ditelusuri ulang koordinator |
| R1 | P2 | PDF fixed/OCR dan QR belum memeriksa anggaran luas pixel sebelum membuat kanvas dari ukuran sumber. Pembacaan beberapa format lokal juga hanya memberi peringatan ukuran. | `index.html:1893`, `2043`, `3607`, `4161` | Sera, Raka; jalur alokasi dibaca koordinator |
| T1 | P2 | WebSocket menerima `DONE` sebelum seluruh byte terkirim dan belum memvalidasi ACK/progres secara ketat. | `index.html:4324–4344` | Sera; ditelusuri ulang koordinator |
| A1 | P2 | Perubahan sumber menolak hasil lama, tetapi operasi PDF/OCR/gambar di dalamnya belum menerima pembatalan job sehingga pekerjaan basi masih berjalan. | `index.html:1882`, `2023`, `3655–3664`, `3953`, `4445` | Raka; batas pemeriksaan token dibaca koordinator |
| A2 | Kandidat efisiensi, perlu diukur | UI menyiapkan resource lalu builder menyiapkannya lagi; penggantian nama memindai setiap HTML untuk tiap gambar, preview memakai pencarian array per gambar, batch menahan seluruh EPUB sebelum ZIP akhir. | `index.html:2856`, `3038`, `3840`, `3970–3972`, `4026`, `4037–4049`, `4558` | Raka |
| U1 | P2 | Status utama berubah melalui `setStatus` tetapi elemen `#status` tidak memiliki live-region/role status. | `index.html:498`, `773` | Mira; ditelusuri ulang koordinator |
| U2 | P2 | Batch yang dibatalkan oleh perubahan revisi dapat kembali tanpa menjelaskan bahwa pekerjaan berhenti. | `index.html:4000–4012`, `4033–4045` | Mira; digabung tindak lanjut J1/A1 |
| H1 | P2 bersyarat | Loader PDF/OCR/QR memercayai CDN tanpa SRI; Mammoth sudah menerapkan SRI. Risiko memerlukan perubahan/kompromi aset yang dipercaya. | `index.html:1875`, `2016`, `4140`; pembanding `2572` | Sera |
| X1 | Peningkatan aksesibilitas | OPF mempunyai bahasa, tetapi XHTML/NAV belum diberi `lang`/`xml:lang`; halaman raster/ilustrasi PDF mempunyai alt kosong dan belum ada keterangan aksesibilitas yang memadai. | `index.html:1541`, `1650`, `2054`, `2742`, `3135`, `3172–3182` | Lexi |
| U3 | P3, keterbatasan fitur | Pratinjau umum hanya bab pertama. Sesuai label tombol, tetapi belum membantu meninjau bab lain tanpa ekspor. | `index.html:457–458`, `3819–3828` | Mira; diturunkan dari bug ke peningkatan fitur saat konsolidasi |
| U4 | P3, interaksi belum diverifikasi | Perubahan judul membangun ulang seluruh daftar, berpotensi mengganggu fokus/scroll pengguna keyboard. | `index.html:3778–3817`, `3856–3864` | Mira |

### Batas penting pada interpretasi

- Q1/Q2/Q4 merupakan penelusuran transformasi kode, bukan perbandingan buku pengguna yang baru dijalankan. Tambahkan reproduksi otomatis sebelum perubahan.
- Q3 menunjukkan ketidaksesuaian geometri; pemotongan aktual pada ADE/CrossPoint masih belum diverifikasi secara visual.
- R1 menunjukkan alokasi tanpa batas pixel yang konsisten. Perhitungan satu buffer RGBA 30.000 × 30.000 sekitar 3,6 GB bukan hasil pemakaian RAM yang diukur; browser dapat menolak kanvas lebih dahulu.
- T1 adalah risiko integritas/state. Tidak ada bukti RCE, pencurian dokumen, atau perilaku firmware tertentu. Perbaikan klien juga tidak membuktikan file tersimpan utuh di perangkat.
- H1 bukan bukti bahwa CDN telah dikompromikan. Tidak ada pemeriksaan advisory terkini dalam audit offline ini. Worker, WASM dan paket bahasa perlu dikelola tersendiri; SRI pada satu skrip tidak melindungi seluruh rantai.
- X1 bukan klaim paket pasti gagal EPUBCheck atau audit aksesibilitas menyeluruh. Jangan mengarang deskripsi ilustrasi atau menyebut halaman berisi teks sebagai dekorasi untuk memenuhi metadata.
- U3 adalah perluasan fungsi yang berguna, bukan kesalahan bahwa tombol berlabel bab pertama menampilkan bab pertama. U4 memerlukan pengujian keyboard nyata.

## Rencana perbaikan yang dapat diuji

### Tahap 1 — Lindungi isi sebelum mempercepat lagi

Sasaran Q1, Q2, Q4 dan Q3. Pemecahan bab harus mempertahankan seluruh node, teks dan urutan gambar. Jika batas aman tidak dapat ditentukan, pertahankan sumber lengkap. ID yang diizinkan harus aman dan unik, lalu dipetakan ke dokumen XHTML tujuan setelah pemecahan. Hard-hyphen yang ambigu harus dipertahankan atau ditandai untuk tinjauan, bukan otomatis dihilangkan. Ukuran halaman fixed perlu dibawa per halaman atau di-fit utuh ke kanvas target dengan margin.

Acceptance yang **belum dijalankan**: bab >240.000 karakter dengan gambar mandiri, teks bebas, nested blocks, tabel dan catatan kaki; tautan menuju target pada bab/flow lain; `beautiful`, reduplikasi Indonesia dan compound bertanda hubung; PDF campuran potret/lanskap dan rotasi. Bandingkan teks literal, tanda baca, urutan referensi gambar dan tautan, bukan hanya status ZIP/XML.

### Tahap 2 — Satukan satu konteks pekerjaan

Sasaran J1, A1, R1 dan U2. Snapshot opsi sebelum membaca sumber dan teruskan ke parser, OCR, pemrosesan gambar serta builder. Keluaran harus berasal dari satu sumber/revisi/opsi. Berikan pembatalan sampai ke loop per halaman dan setiap operasi async; lakukan cleanup resource dalam `finally`. UI harus membedakan selesai, gagal dan dibatalkan, tanpa menimpa status sumber baru.

Tetapkan anggaran byte/pixel/halaman sebelum alokasi. Jika kualitas yang diminta melampaui budget, hentikan dengan alasan dan tawarkan pilihan yang eksplisit; jangan mengecilkan otomatis sambil tetap menyebut hasil berkualitas sumber. Pilihan penurunan skala harus mempertahankan rasio dan menjelaskan komprominya. Anggaran perlu realistis untuk buku besar dan perangkat mobile; jangan menggunakan satu ukuran desktop sebagai jaminan universal. Pembatalan tidak boleh ditangkap sebagai kegagalan gambar biasa yang kemudian diam-diam dipertahankan apa adanya.

Acceptance yang **belum dijalankan**: tahan promise di pertengahan batch lalu ubah setiap kontrol keluaran, ganti sumber saat OCR berlangsung, pastikan operasi lama berhenti, buffer dilepas dan tidak ada unduhan basi. Uji batas pixel serta arsip dengan ukuran deklarasi palsu dan periksa bahwa limit lama tetap berlaku.

### Tahap 3 — Tegakkan integritas transfer dan dependensi

Sasaran T1 dan H1. Definisikan state transfer mulai → siap → mengirim → menunggu konfirmasi → selesai/gagal/batal. Validasi progres finite dan monoton, total yang sesuai, ACK yang tidak melampaui byte terkirim, serta `DONE` pada fase yang benar setelah seluruh byte terkirim. Bila firmware menyediakan bukti ukuran/checksum, nilai kemampuan tersebut secara terpisah.

Bundel helper yang diverifikasi atau pin SRI yang benar; periksa jalur worker/WASM/bahasa dan perilaku offline. Tidak perlu menambah backend atau mengganti framework untuk memperbaiki temuan ini.

Acceptance yang **belum dijalankan**: `DONE` prematur, progres negatif/NaN/berulang/tidak sesuai total, koneksi putus, pembatalan dan callback lama, fallback HTTP serta konflik nama. Uji aset helper gagal integritas dan resource pendukung gagal dimuat. Validasi fisik CrossPoint tetap diperlukan kemudian.

### Tahap 4 — Bantu pengguna memeriksa hasil

Sasaran U1, U3, U4 dan X1. Tambahkan pengumuman status yang tidak terlalu ramai, pemilih pratinjau bab, pemulihan fokus ketika daftar berubah, bahasa dokumen dan keterangan aksesibilitas yang jujur. Pertahankan preview inert dan jangan memasukkan HTML aktif demi memperkaya preview.

Acceptance yang **belum dijalankan**: keyboard dan pembaca layar untuk mulai/berhasil/gagal/batal, edit beberapa judul tanpa kehilangan posisi, tinjau bab selain bab pertama, viewport mobile/desktop dan teks panjang, serta pemeriksaan bahasa/alt tanpa deskripsi rekaan.

## Keputusan implementasi

Mulai dari patch kecil dan regresi yang membuktikan pemicu; tidak perlu rewrite seluruh `index.html`, framework baru, atau worker pool sebelum profil beban nyata. Setelah perilaku benar, pisahkan tahap parse → prepare resources → process images → package dari akses DOM agar opsi dan pembatalan dapat diuji. Perluas objek buku/bab yang sudah ada untuk metadata per halaman dan peta target tautan; hindari model domain besar yang spekulatif.

Optimasi A2 harus mempertahankan keamanan builder bagi pemanggil langsung. Jangan sekadar mempercayai flag “sudah disiapkan” untuk melewati pemeriksaan resource. Gunakan kontrak hasil tahap yang tegas, peta nama gambar dan penulisan ulang atribut tepat satu kali bila terbukti lebih efisien. Ukur waktu dan puncak memori dengan sumber serta setelan yang sama sambil menjaga paritas keluaran. Audit ini tidak menghasilkan angka percepatan baru atau perbandingan baru dengan Calibre/CloudConvert.

Raka menganggap kontrak job dan budget sebagai prasyarat arsitektur yang mendesak; pada tabel konsolidasi, severity bug tetap P2 karena dampak runtime dan puncak memori belum diukur. Urutan implementasi tidak harus disamakan dengan skor severity. Ketiga peran yang memeriksa Q1 sepakat mendahulukan pencegahan kehilangan isi.
