# Pemindaian kode, bug dan keamanan — 18 Oktober 2026

## Cakupan dan bukti

Penelaahan mencakup kode aplikasi khusus pada `index.html`, `pdf-review.js`,
`device-compatibility.js`, aset/deployment dan dependensi yang dipakai, serta
pengujian regresi. Jalur yang ditelusuri: impor dokumen dan arsip, ekstraksi
artikel, pratinjau, packaging EPUB, koreksi PDF, ekspor komik, StarDict,
pergantian sumber saat proses berjalan, dan transfer HTTP/WebSocket.

Sera memakai profil lokal `security-privacy-guardian`, mode `threat-review`;
Vera memakai `quality-assurance`, mode review/test. Keduanya melakukan reproduksi
dan review ulang secara read-only; agen utama menulis patch. Sera dan Vera
menjalankan ulang kontrol yang relevan, bukan hanya membaca hasil agen utama.

Ini audit kode dan pengujian berbasis risiko, bukan sertifikasi bebas bug atau
pentest semua browser, firmware, dan seluruh isi library pihak ketiga.

## Temuan yang diperbaiki

| Temuan dan pemicu | Perbaikan / bukti penerimaan |
| --- | --- |
| **P1 XSS pratinjau FB2:** MIME binary berisi tanda kutip/handler event berubah menjadi atribut aktif melalui penggantian string `innerHTML`. Eksekusi marker lokal direproduksi pada jsdom. | MIME raster dibatasi; pratinjau dibangun melalui DOM inert, tanpa interpolasi metadata ke markup. Uji file FB2 berbahaya di Edge ditolak; event handler/iframe/SVG tidak muncul. |
| **Konten SVG aktif diteruskan ke EPUB:** binary SVG dan referensi jaringan tetap tersimpan saat optimasi gambar mati/gagal. Belum membuktikan eksekusi pada firmware. | FB2/ODT menolak SVG sumber; builder menolak MIME aktif, SVG yang hanya diberi label PNG, base64 tidak valid dan nama/path aset berbahaya. Raster asli tetap dipertahankan. |
| **Preview memuat gambar web sebelum ekspor.** | Preview menampilkan aset lokal/data raster yang aman atau placeholder. Tidak ada request pelacak pada uji Edge. |
| **Arsip ODT/DOCX tanpa anggaran dekompresi.** | Pemeriksaan metadata dan pembacaan streaming berbatas: 128 MiB total, 32 MiB per entri, maksimal 10.000 entri. ODT memakai anggaran byte aktual bersama; DOCX diperiksa sebelum Mammoth. |
| **CBZ memeriksa ukuran aktual setelah mengumpulkan seluruh entri.** Ukuran palsu 1 byte dapat menghasilkan 4 MiB sebelum JSZip menolak. | CBZ memakai stream berbatas, 128 MiB per entri/total, disertai batas 1.000 halaman dan 10.000 entri. Kontrol kecil dengan metadata palsu memverifikasi batas sebelum hasil penuh dikumpulkan. |
| **Respons artikel tanpa batas byte.** | Maksimal 8 MiB, pembacaan streaming dan pembatalan ketika melampaui batas. Request tidak mengirim kredensial/referrer. Batas waktu 20 detik tetap mencakup isi respons. |
| **NUL pada kata kamus merusak offset StarDict.** | Menolak NUL pada kata/definisi dan mencegah overflow field 32-bit. Pemformatan HTML dibatasi ke tag teks; skrip, event, tautan, gambar/jaringan dibuang. Metadata nama kamus tidak boleh menyisipkan baris kontrol. |
| **Parse berkas lama gagal setelah berkas baru siap, lalu menimpa galeri/status baru.** | `handle()` memeriksa token sebelum penanganan kegagalan menulis ke UI. Kontrol dua sumber tumpang tindih mempertahankan galeri/status terbaru. |
| **Ekspor XTC usang tetap mengunduh hasil setelah sumber/revisi berubah.** | Snapshot gambar, token ekspor, owner dan revisi diperiksa setelah operasi asinkron. Tidak ada unduhan lama setelah pergantian sumber atau edit metadata. |
| **Transfer dibatalkan karena dokumen berubah tetapi kontrol tetap terkunci.** | Cleanup memulihkan alamat, folder, profil, tombol dan timer. Callback XHR/WebSocket lama tidak dapat menyelesaikan transfer baru. |
| **URL WebSocket port khusus/IPv6 tidak valid.** | Host/port diparsing terpisah dengan URL native; bracket IPv6 dipertahankan. Port 65535 tidak menghasilkan port 65536; jalur fallback HTTP tersedia. |
| **ZIP batch ditawarkan sebagai hasil siap dikirim/dibaca.** | Batch tetap diunduh sebagai ZIP, tetapi tidak disimpan sebagai file siap kirim. Instruksi meminta pengguna mengekstrak EPUB terlebih dahulu. |
| **Judul artikel ganda membuat bab pembuka hanya berisi judul.** | Metadata tidak lagi menambahkan judul jika ada heading pembuka. Artikel uji kini menghasilkan satu bab; heading bab lain tetap dipertahankan. |

Kontrol arsip tidak menguji bomb raksasa yang sengaja menghabiskan RAM. Tes
menggunakan arsip kecil terkompresi, metadata palsu, dan satu payload teks
32 MiB + 1 untuk membuktikan penolakan sebelum XML diproses.

## Dependensi dan risiko yang tetap dicatat

Pemeriksaan versi memakai endpoint advisory publik npm, dengan versi dari
`tests/package-lock.json` dan empat library runtime CDN. Hanya nama/versi paket
publik yang dikirim, tanpa dokumen atau data pengguna. Ini pencocokan versi
langsung, bukan pemindaian graph penuh `npm audit` atau analisis semua library
yang tertanam di bundle.

- `source-map-js` **1.2.1 → 1.2.2** pada dependensi pengujian. Versi lama
  dicocokkan dengan advisory DoS; paket ini bukan aset aplikasi yang dideploy.
  [Advisory resmi GitHub](https://github.com/advisories/GHSA-68fv-2mgg-jv7q).
- Mammoth **1.9.0 → 1.11.0**, dengan SRI SHA-384 dan CORS anonymous. Bundle browser
  versi baru benar-benar diuji mengonversi DOCX sampai menjadi EPUB. Advisory
  menjelaskan pembacaan file eksternal pada konteks yang mendukung filesystem;
  pembacaan file arbitrer tersebut **tidak direproduksi pada web app ini**.
  [Advisory resmi GitHub](https://github.com/advisories/GHSA-rmjr-87wv-gf87).
- **PDF.js 3.11.174 tetap versi lama yang terdeteksi advisory.** Kedua jalur
  `getDocument()` memakai `isEvalSupported:false`; ini workaround resmi untuk
  GHSA-wgrm-67xf-hhpq. Karena itu hasilnya dicatat **dimitigasi**, bukan nol
  kerentanan atau sudah diperbarui. Migrasi PDF.js merupakan pekerjaan lanjutan
  yang memerlukan regresi worker, OCR, ilustrasi dan rendering.
  [Advisory dan workaround resmi](https://github.com/mozilla/pdf.js/security/advisories/GHSA-wgrm-67xf-hhpq).
- Advisory PDF.js Juli 2026 menyebut rentang mulai 5.6.83, sehingga tidak
  diterapkan sebagai kerentanan baru pada 3.11.174 hanya berdasarkan namanya.
  App juga menetapkan `enableScripting:false` di kedua pemanggil.
  [Advisory resmi](https://github.com/mozilla/pdf.js/security/advisories/GHSA-hq66-cqwq-w95j).

Catatan awal/akhir versi dan respons advisory tersimpan di
`output/security/2026-10-18/dependency-advisories*.json`.

Risiko/batas yang belum ditutup:

- Worker, data OCR dan library CDN lain tetap mempunyai ketergantungan ke pihak
  ketiga. SRI Mammoth tidak menjamin seluruh rantai runtime/offline. Tidak ada
  klaim CSP ketat atau seluruh dependensi sudah diaudit baris demi baris.
- Pemeriksaan header aset raster bukan validator piksel lengkap. Impor web
  memeriksa CRC PNG dan decoding browser; gambar lokal pada preview belum
  memiliki batas dimensi/byte yang setara dengan jalur web.
- Browser tanpa API streaming hanya dapat memeriksa ukuran sesudah respons
  fallback dimaterialisasi. DOCX didekompresi untuk preflight lalu oleh Mammoth,
  sehingga tambahan CPU/memori merupakan tradeoff meskipun memakai batas.
- Transfer lokal HTTP bukan saluran terenkripsi/autentikasi baru. App menolak
  pengiriman HTTP dari halaman HTTPS. Pengujian transfer memakai simulasi;
  perangkat X4 Pro/CrossPoint dan firmware pengguna belum diuji fisik.
- Ini tidak menghilangkan kesalahan OCR, keterbatasan aksesibilitas, atau semua
  kemungkinan masalah pada PDF dengan tata letak yang belum ada dalam korpus.

## Bukti yang dapat diulang

- Unit/integrasi: `tests/run.js`, khususnya `security-boundaries.test.js`,
  `runtime-races.test.js`, `stardict.test.js`, `article.test.js`, serta suite
  sanitizer, transfer, ZIP, PDF dan e-ink yang sudah ada.
- Browser nyata: `security-browser.cjs`, `web-resources-browser.cjs`, dan
  `pdf-review-browser.cjs`. Server/dokumen uji terkendali, tanpa menyerang situs
  atau perangkat eksternal.
- Standar output: `audit-epub-output.py --phase security`, EPUBCheck 5.4.0,
  verifikasi CRC/decode Pillow dan kontrol auditor Python.

Laporan browser menyertakan hash aset supaya bukti bisa dicocokkan dengan kode
yang diuji. Log/artefak lokal bukan bukti bahwa GitHub Actions terbaru sudah
dijalankan. Tidak ada push, deployment atau pengiriman fisik pada audit ini.

## Hasil akhir

| Pemeriksaan | Hasil terverifikasi |
| --- | --- |
| Seluruh suite Node pada kode akhir | **55/55 lulus** |
| Kontrol auditor Python | **6/6 lulus** |
| Audit gabungan EPUBCheck 5.4.0 dan pemeriksaan tambahan | **22/22 lulus**, 0 error / warning EPUBCheck |
| Integritas dan decoding gambar | **224 aset**, 0 kegagalan |
| Browser keamanan | 3 kelompok pemeriksaan lulus, 0 page error, 0 request pelacak |
| Browser artikel | Uji offline/warna/e-ink/CORS/gambar rusak lulus; 360/480/1366 px tanpa overflow |
| Browser koreksi PDF | 7 pemeriksaan dan 4 ukuran layar lulus, 0 page error |
| Judul bab artikel | Ketiga EPUB browser tepat 1 bab dan 1 entri TOC |
| Transfer | Pengujian lokal/race/protokol lulus; perangkat fisik belum diuji |

Audit 22 EPUB meliputi 4 korpus PDF/HTML historis, 1 hasil koreksi PDF yang
diregenerasi, 3 unduhan artikel, 5 fixture gate, 8 contoh unit test, dan 1
unduhan DOCX menggunakan library yang ditambal. Empat korpus historis tetap
menjadi bahan regresi; tidak diklaim dibuat ulang pada putaran ini.

Hash kode aplikasi cocok dengan tiga catatan browser. SHA-256 `index.html`:
`5ff1d78158c3914a396504854b8c81cb044a6b98c5a6613c589f02b21de01257`.

JSZip aplikasi **3.10.1** juga cocok byte-for-byte dengan aset paket registry
resmi setelah integritas tarball diverifikasi. Dependensi tes menggunakan
3.10.2; kedua versi dimasukkan pada pemeriksaan advisory. Karena perbedaan itu,
kontrol metadata ZIP palsu dijalankan lagi pada **JSZip 3.10.1 di Edge**: arsip
4.194 byte mengaku 1 byte, payload sebenarnya 4 MiB; pembaca berhenti pada batas
uji 32 KiB. Ini membuktikan mekanisme streaming pada versi produksi, bukan
klaim bahwa bomb lebih dari 128 MiB sengaja dijalankan.

Bukti akhir:

- `output/epub/standardization-2026-10-18/security/audit-results.json` dan 22
  laporan EPUBCheck. Auditor penuh selesai dengan exit 0.
- `tmp/pdfs/stress-lab/full-review-unit-tests.log` dan
  `tmp/pdfs/stress-lab/full-review-output-audit.log`.
- `output/security/2026-10-18/browser-results.json`,
  `browser-archive-results.json`, `jszip-provenance.json`, dan
  `dependency-advisories-final.json`.
- `output/epub/web-resources/browser-results.json` serta
  `output/epub/pdf-review/browser-review-results.json`.

Putusan: temuan utama yang direproduksi telah ditutup dan lolos regresi lokal.
Tidak ada dasar untuk menyatakan semua kemungkinan bug, kerentanan, atau
ketidakcocokan perangkat sudah hilang. Risiko PDF.js/CDN dan batas audit di atas
tetap berlaku.
