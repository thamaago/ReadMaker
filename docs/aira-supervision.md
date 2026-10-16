# Catatan pengawasan Aira

Pemeriksaan: 16 Oktober 2026. Aira adalah agen pengawas dalam sesi pengembangan
ReadMaker ini, bukan lembaga sertifikasi atau penguji perangkat eksternal.
Pengawasan mencakup audit kode sebelum implementasi, reproduksi temuan, review
perubahan selama implementasi, pemeriksaan bukti akhir, dan inspeksi screenshot.
Implementasi aplikasi dilakukan agen utama; Aira hanya menulis catatan ini.

## Lingkup dan kriteria penerimaan

Fokus perubahan adalah membandingkan PDF sumber dengan hasil per halaman dan
memperbaiki teks hasil sebelum ekspor. Penerimaan mensyaratkan pemetaan sumber
yang stabil, koreksi literal yang aman, gambar dan format inline tetap utuh,
koreksi masuk ke XHTML unduhan, serta hasil lama tidak terkirim setelah diedit.
Perubahan pembagian atau urutan bab tidak boleh menyasar teks yang salah.
Rendering sumber harus dilakukan sesuai halaman yang dipilih, tanpa menyimpan
seluruh dokumen sebagai kumpulan raster preview.

## Temuan dan tindak lanjut yang diawasi

| Temuan | Perbaikan yang ditinjau | Status bukti |
| --- | --- | --- |
| Halaman awal sebelum bookmark pertama hilang dari ekspor berbasis outline | Bagian awal dimasukkan sebelum bab bookmark | Reproduksi awal gagal; regresi bagian awal kini lulus |
| Bookmark pada halaman kosong/gambar dapat menyebabkan paragraf lintas halaman masuk ke dua bab | Batas bookmark diperiksa pada seluruh rentang halaman yang dilintasi | Reproduksi duplikasi awal dikonfirmasi; regresi tidak lagi menggandakan teks |
| Gambar halaman tanpa teks ditempatkan setelah teks halaman berikutnya | Gambar halaman yang dilewati dikeluarkan sebelum teks berikutnya | Regresi urutan gambar di tengah lulus |
| Koreksi berpotensi membuang gambar, emphasis, atau link jika mengganti HTML keseluruhan | Identitas blok dan halaman sumber dipertahankan; koreksi hanya mengubah text node dan disebarkan ke canonical HTML, outline, serta cache bab | Uji simpan, reset, split, reorder dan ekspor lulus |
| Input menyerupai markup berpotensi menjadi HTML aktif | Koreksi memakai textContent; preview membangun subtree dari whitelist tag dan atribut | Teks literal serta hostile preview diuji tanpa node aktif atau sumber remote yang disalin |
| Preset otomatis dapat mengembalikan kontrol mode setelah parsing manual | Setelan manual menggunakan preset khusus; kontrol dan mode hasil tetap selaras | Uji mode fixed manual lulus |
| Parse, rendering sumber, dan build async dapat menampilkan atau mengunduh hasil lama | Token pemuatan, pembatalan/destroy PDF, pemblokiran review saat reparse, snapshot blok, dan revision hasil | Uji respons terlambat, draft, reparse, dan perubahan selama build lulus |
| Preview iframe tampak kosong pada inspeksi browser meski memiliki DOM | Preview diganti Shadow DOM dengan subtree aman yang dibangun ulang | Screenshot desktop/mobile dan assertion isi tampak serta decode gambar lulus |

Shadow DOM hanya mengisolasi gaya, bukan merupakan batas keamanan. Keamanan
preview bergantung pada pembangunan node baru, whitelist sempit, penolakan
event/style/href dari sumber, dan src gambar yang hanya berasal dari aset bitmap
terdaftar. Editor tidak menerima HTML mentah.

## Bukti akhir yang diperiksa

- `tmp/pdfs/stress-lab/regression-review-final.log`: **51 suite lulus**.
  Aira juga menjalankan suite integrasi `tests/pdf-review.test.js` secara
  independen selama review; suite tersebut lulus.
- `output/epub/pdf-review/browser-review-results.json`: **7 skenario**, lebar
  **320, 480, 1024, dan 1440 piksel**, tanpa error browser yang tercatat atau
  overflow halaman. Pengujian mencakup koreksi literal, draft, pembagian bab,
  reparse, invalidasi hasil lama, serta mode halaman asli yang hanya bisa ditinjau.
- Screenshot `pdf-review-320.png` dan `pdf-review-1440.png` memperlihatkan
  sumber, hasil, dan kontrol koreksi. Inspeksi mobile oleh Aira memastikan teks
  literal dan ilustrasi terlihat tanpa overflow horizontal.
- EPUB unduhan `ReadMaker-X4-Pro-uji-koreksi.epub` lolos EPUBCheck dengan
  **0 fatal, 0 error, 0 warning**. Nama file menyatakan sasaran uji, bukan bukti
  bahwa file sudah dibuka pada X4 Pro.
- Empat fixture gate: koreksi reflow, RTL, halaman asli, dan komik; log validator
  lokal masing-masing mencatat **0 fatal, 0 error, 0 warning**.
- Korpus PDF akhir selesai melalui empat jalur. Reflow kompleks tetap memiliki
  **WER token ternormalisasi 5,46%**, frasa **69/80**, urutan kolom **8/8**, dan
  ilustrasi acuan **4/4**. PDF digital berulang 1.200 halaman mempertahankan
  **3.600/3.600 penanda**. Keempat EPUB korpus lolos EPUBCheck tanpa warning.
- `output/epub/stress-lab/layout-results.json`: **864 pemeriksaan**, **0 overflow**,
  **0 kegagalan decode gambar**.

SHA-256 aset pada hasil browser review dan korpus cocok dengan source yang
diperiksa saat penutupan:

| Aset | SHA-256 |
| --- | --- |
| index.html | `5d13fab0293828a2aaf7d3315e6dc0c09fafc0f1a8c639ca9892b8c7002701b8` |
| pdf-review.js | `5ef63babfeeb59d9e4746d2e5d103f8561aec59905accd9bd9e756344280cfb7` |
| responsive.css | `cb0cf4cd702e8ae9c7c667a9bed8cd981604d60a014f08355de25bf458f049ec` |
| device-compatibility.js | `568b324b951ad1e12f6a92be803ec8e0346dd8eefee9459096db38f01e95d86f` |
| jszip.min.js | `acc7e41455a80765b5fd9c7ee1b8078a6d160bbbca455aeae854de65c947d59e` |

Konfigurasi CI/deploy telah ditinjau: modul review masuk ke artefak situs;
EPUBCheck 5.4.0 dipasang dari arsip dengan checksum yang dipatok; validator
menggunakan `--failonwarnings`. Bukti di atas adalah eksekusi lokal, bukan klaim
workflow GitHub sudah dijalankan setelah perubahan ini diterbitkan.

## Batas pengawasan dan pekerjaan yang belum dibuktikan

- **Perangkat fisik belum diuji.** Xteink X4 Pro dengan CrossPoint adalah sasaran
  pengguna, tetapi perangkat belum siap untuk sesi transfer dan baca langsung.
  Preview browser tidak menyimulasikan firmware, panel e-ink, pagination,
  resume, atau ketajaman font perangkat tersebut.
- **Benchmark pesaing belum terlaksana.** Upaya menyiapkan Calibre portable tidak
  menghasilkan instalasi siap uji. Tidak ada hasil konversi bersama dengan file
  dan setelan identik untuk Calibre atau CloudConvert. Ini bukan bukti kegagalan
  mutu Calibre dan tidak membenarkan klaim ReadMaker unggul terhadap pesaing.
- **OCR belum bebas salah.** WER dan frasa yang belum cocok tetap dilaporkan;
  koreksi manual tersedia sebagai bantuan, bukan jaminan ketepatan otomatis.
  Penilaian token menormalkan kapitalisasi dan tanda baca, serta hanya berlaku
  untuk korpus sintetis yang diuji.
- **Gambar preview belum melalui optimasi ekspor.** Bantuan UI menjelaskan bahwa
  grayscale, ukuran, dan dithering akhir perlu diperiksa pada EPUB unduhan.
- Koreksi disimpan selama sesi, bukan pada PDF sumber atau penyimpanan permanen.
  Mode halaman asli adalah gambar; editor teks tidak dapat mengubah teks pada
  raster tersebut. Sumber utuh terlihat kecil pada layar ponsel saat fit-page.
- PDF 1.200 halaman bersifat repetitif dan kecil; bukan pengganti pengujian scan
  besar pada ponsel dengan memori terbatas. Retensi empat ilustrasi bukan bukti
  seluruh diagram atau ilustrasi PDF akan selalu utuh.

Tidak ditemukan blocker baru pada perubahan preview/editor setelah pemeriksaan
akhir ini. Penerimaan dibatasi pada implementasi dan bukti lokal di atas;
pengujian perangkat fisik dan benchmark pembanding tetap terbuka.
