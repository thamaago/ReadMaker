# Perbaikan setelah telaah agen — 24 Oktober 2026

Perbaikan ini menindaklanjuti [telaah lintas agen](combined-review.md). Implementasi dan pengujian dilakukan oleh koordinator setelah pengguna meminta perbaikan; lima laporan agen sebelumnya merupakan telaah sebelum patch, bukan review independen atas patch ini. Tidak ada deployment, push atau pengujian perangkat fisik.

SHA-256 `index.html` akhir: `34d7fcac1fbe4ac10c22c77e0c70322a56e18d1d5278b6dbe60773f63191ea72`. Baseline yang direproduksi: `863262998f68dc5f13da0e2df4536a56bb7f2182b475696be980133f1fd1fc23`.

## Perubahan yang diterapkan

| Temuan | Implementasi | Bukti utama |
|---|---|---|
| Q1, kehilangan isi bab panjang | Ganti pengambilan blok regex/toleransi 95% dengan serialisasi seluruh child node DOM. Teks bebas, gambar mandiri dan nested blocks tidak ditinggalkan. Satu blok yang melebihi ambang tetap utuh. | `review-fixes.test.js`, fixture `long-flow-notes`, ekspor UI `lossless-notes` |
| Q2, catatan kaki/anchor | Sanitizer mempertahankan ID aman dan named anchor, termasuk target kosong. Target pada bagian tanpa teks diteruskan ke bab yang berisi konten. Builder memetakan fragment ke XHTML akhir, menulis ulang tautan lintas pecahan/bab, dan membuat ID duplikat unik dalam satu dokumen. | Regresi HTML/anchor, long flow, pemeriksaan semua fragment pada audit keluaran |
| Q3, PDF campuran orientasi | Simpan viewport setiap halaman dan gunakan pada XHTML masing-masing. Profil e-ink detail memproses tiap raster menurut dimensi halamannya, bukan dimensi halaman pertama. | PDF.js sebenarnya: lanskap 1200×600 dan potret 600×1200; dimensi PNG, viewport dan tinta bagian bawah diperiksa |
| Q4, tanda hubung | Hanya soft hyphen eksplisit yang dihapus saat menyambung baris; hard hyphen ambigu tetap dipertahankan. | `well-known`, `self-esteem`, reduplikasi Indonesia, dan soft-hyphen `beautiful` |
| J1, opsi batch | Ambil snapshot opsi yang dibekukan pada awal job. Perubahan opsi relevan membatalkan pekerjaan, termasuk ketika batch menetapkan `parsed=null`. Bahasa, pemisahan bab dan mode/OCR PDF membaca snapshot. | Promise batch ditahan, lalu perubahan masing-masing kontrol diverifikasi membatalkan tanpa unduhan |
| A1, proses basi | Konteks job membawa AbortController dan checkpoint; pengecekan sebelum/sesudah pembacaan sumber serta pada loop PDF/OCR/gambar. Loading/render PDF dapat dibatalkan; worker OCR dihentikan. Hasil lama tidak mengaktifkan tombol atau mengganti status sumber baru. | Regresi job, render PDF ditahan dan dibatalkan, suite race yang sudah ada |
| R1, sumber daya | Tolak sumber >128 MiB sebelum membaca. Kanvas PDF fixed/OCR, bitmap, proses gambar dan QR diperiksa sebelum alokasi: maksimal 12 juta piksel, dimensi maksimal 16.384. Job membatasi akumulasi byte raster/hasil yang dihitung hingga 128 MiB. | Regresi batas sebelum read/canvas; batas arsip streaming lama tetap diuji |
| T1, konfirmasi transfer | Fase WebSocket eksplisit; tolak `DONE` sebelum siap/seluruh byte dikirim. Progres harus finite/integer, monoton, sesuai total dan tidak melampaui offset. ACK duplikat tidak mengirim chunk berikutnya dua kali. Offset diperbarui sebelum send untuk callback yang sinkron. | DONE prematur, negatif/NaN/total palsu, ACK duplikat dan transfer dua chunk normal |
| U1, U2 | Status utama mempunyai `role=status`, live-region dan pengumuman atomik. Batch yang dibatalkan menampilkan alasan dan mereset antrean ke state menunggu. | DOM/status dan regresi batch |
| U3, U4 | Pemilih nomor bab pada pratinjau. Edit judul memperbarui input yang sama, tanpa membangun ulang daftar dan membuang fokus. | Unit identitas node/fokus; browser memilih bab kedua dan mengedit dengan keyboard |
| H1, helper utama | Tambahkan SRI/crossorigin ke loader PDF.js, Tesseract.js dan jsQR. URL jsQR lama ternyata 404; diganti dengan distribusi `jsqr@1.4.0/dist/jsQR.js`, tetap versi 1.4.0. | Tiga bundle asli lolos pemeriksaan SRI browser; modifikasi bundle QR ditolak tanpa mengeksekusi kode tambahan |
| X1, bahasa keluaran | Teruskan bahasa ke atribut `lang`/`xml:lang` XHTML, NAV dan cover. Halaman PDF memperoleh label nomor halaman pada alt. | Regresi bahasa dan pemeriksaan dokumen dalam audit |
| A2, sebagian efisiensi | Referensi gambar ditulis ulang per atribut dengan Map, bukan rangkaian penggantian substring untuk tiap gambar. Penamaan PNG menghindari benturan. Bab tanpa gambar tidak diparse oleh tahap penggantian referensi. | Suite gambar, CBZ, web resources, ekspor mixed PDF dan stress manual |

Semua perubahan berada pada pipeline yang ada; tidak menambah framework, server konversi atau worker pool. Builder tetap memindai resource, termasuk ketika dipanggil langsung. Tidak ada flag yang melewati batas keamanan.

## Verifikasi yang dijalankan

- **58/58 suite Node lulus** pada kode akhir: `tmp/review-fixes/unit-tests-verified.log`.
- Enam kontrol Python untuk auditor keluaran lulus. Dua suite baru: `review-fixes.test.js` dan `job-transfer-regressions.test.js`.
- Reproduksi baseline mencatat kegagalan kehilangan gambar, hilangnya anchor, penghapusan hard hyphen, dan viewport campuran. Log `tmp/review-fixes/baseline-regressions.log` juga mencatat belum adanya helper baru; itu bukan reproduksi cacat terpisah.
- Browser Edge: `review-fixes-browser.cjs` memeriksa helper asli/SRI, penolakan aset QR yang berubah, pratinjau bab kedua, ekspor 26.000 frasa dengan gambar/teks bebas/tautan catatan kaki, serta PDF ukuran campuran. `output/epub/review-fixes/browser-results.json` memuat hash sumber akhir dan dimensi raster.
- `web-resources-browser.cjs` dan `security-browser.cjs` lulus pada hash akhir, termasuk grayscale/warna sumber, WebP, data gambar rusak, CORS, ZIP berukuran palsu, preview inert, dan DOCX Mammoth sebenarnya. Tidak ada page error atau request pelacak pada pengujian terkait. Artefak keamanan terbaru berada di `output/security/2026-10-24/`.
- `pdf-review-browser.cjs` lulus tujuh pemeriksaan dan empat ukuran viewport pada hash akhir: sumber PDF sebenarnya, koreksi literal, draft guard, reorder/reparse dan unduhan.
- Stress manual lulus: 3.000 blok teks/30 bab, komik 200 halaman, XTC/XTCH 100 halaman, kamus 100.000 entri, tiga arsip rusak dan batch 50 EPUB. Log `tmp/review-fixes/stress-final.log`. Proses berjalan bersamaan dengan verifikasi lain; angka waktunya **tidak dipakai sebagai perbandingan performa**.
- Gate CI diperluas dari lima menjadi tujuh EPUB, termasuk long flow/catatan kaki dan viewport campuran. Semuanya lulus integritas gambar dan EPUBCheck 5.4.0 tanpa error/warning; dua EPUB browser baru juga lulus. Workflow GitHub belum dijalankan secara remote pada putaran ini.

### Hasil audit gabungan akhir

`output/epub/standardization-2026-10-24/security/audit-results.json` mencatat **26/26 sampel lulus**, **229 aset raster**, nol error pemeriksaan lokal, nol kegagalan integritas/dekode gambar, dan nol error/warning EPUBCheck 5.4.0. Identitas sumber pada laporan sama dengan hash akhir di atas. Log proses: `tmp/review-fixes/output-audit-final.log`; exit code 0.

Komposisinya: tujuh fixture gate, delapan sampel suite unit, tiga artikel browser, satu review/koreksi PDF browser, dua regresi browser baru, satu DOCX keamanan browser, dan empat EPUB stress-corpus historis. **22 keluaran dibuat ulang pada putaran ini; empat stress-corpus lama hanya divalidasi ulang**, bukan dikonversi ulang dari PDF/OCR. Laporan menguji ZIP/manifest/XML/fragment, resource lokal, gambar dengan pemeriksa integritas dan Pillow, serta EPUBCheck; ini bukan penilaian akurasi OCR seluruh naskah.

## Batas yang tetap berlaku

- Hard hyphen yang ambigu seperti `beauti-` di akhir baris dipertahankan sebagai `beauti-ful`, karena sumber tersebut tidak cukup membedakan pemenggalan dari compound. Perbaikan ini memilih tidak mengubah ejaan secara tebakan; bukan peningkatan akurasi OCR untuk semua bahasa. Fixture lama yang mengharapkan penyatuan sekarang memakai soft hyphen eksplisit; kasus hard hyphen diuji tersendiri.
- Angka 128 MiB adalah batas file dan anggaran byte yang dihitung secara konservatif, **bukan jaminan total RAM browser maksimal 128 MiB**. DOM, hasil dekode, buffer RGBA dan ZIP memerlukan memori tambahan. Sumber besar yang melampaui batas ditolak dengan penjelasan, tanpa diam-diam mengecilkan gambar.
- Pembatalan bersifat kooperatif. Operasi sinkron dapat berhenti pada checkpoint berikutnya; `Blob.text()` yang sudah berjalan tidak mempunyai abort fisik, tetapi hasilnya diperiksa sebelum parsing dilanjutkan.
- SRI melindungi tiga skrip helper utama. Worker PDF/OCR, WASM dan paket bahasa masih memerlukan pembundelan/verifikasi tersendiri untuk menutup seluruh rantai CDN. Ini hardening sebagian, bukan klaim seluruh dependensi offline atau bebas kompromi. Jalur distribusi QR mengikuti [paket jsQR resmi](https://github.com/cozmo/jsQR/blob/master/package.json).
- Bahasa dan label halaman bukan alternatif tekstual lengkap untuk seluruh ilustrasi/halaman raster. Tidak ada deskripsi rekaan atau klaim sertifikasi aksesibilitas. Metadata aksesibilitas lengkap tetap memerlukan pemeriksaan isi/editorial.
- Pemindaian resource dua kali pada jalur UI/builder belum dihapus; keamanan pemanggil langsung dipertahankan. Belum ada angka percepatan baru atau benchmark pembanding Calibre/CloudConvert.
- ADE dan Xteink X4 Pro/CrossPoint fisik belum diuji pada putaran ini. Tidak ada perubahan firmware atau klaim checksum penyimpanan perangkat.

## Menjalankan ulang

```powershell
node tests/run.js
python tests/audit-epub-output-test.py
node tests/build-validation-fixtures.cjs
node tests/validate-epub.cjs
node tests/job-transfer-regressions.test.js
node tests/review-fixes-browser.cjs
```

Tes browser manual memerlukan Edge/Playwright dan cache bundle yang dipin di `tmp/review-fixes/cdn/pdf.js`, `ocr.js`, `qr.js`. URL dan hash ada pada loader `index.html`; browser memeriksa byte cache melalui SRI. `security-browser.cjs` juga memerlukan cache Mammoth yang dijelaskan pada laporan keamanan sebelumnya; `pdf-review-browser.cjs` memakai PDF sintetis stress-lab yang sudah tersedia. Validasi EPUB memerlukan Java 17 dan EPUBCheck pada lokasi yang diterima `validate-epub.cjs`.
