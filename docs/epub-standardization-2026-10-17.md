# Audit standardisasi keluaran ReadMaker — 17 Oktober 2026

Tindak lanjut 18 Oktober: perbaikan gambar artikel dan pengujian ulang dicatat
di [gambar artikel mandiri](web-article-images.md). Angka di bawah tetap merupakan
rekaman audit 17 Oktober, bukan hasil versi terbaru.

## Tujuan dan penilai

Memeriksa paket EPUB, sumber gambar, navigasi, mutu teks dan batas kompatibilitas
untuk arah proyek: konversi mudah di browser dan hasil yang layak dibaca pada
e-reader, terutama Xteink X4 Pro dengan CrossPoint.

Profil peran audit dibaca dari konfigurasi alat lokal:

- **Vera**, `agents/quality-assurance/agent.md`, mode `test`: menemukan celah
  auditor, membuat kontrol negatif, memperbaiki auditor Python, kemudian
  meninjau gate Node yang ditulis agen utama secara terpisah.
- **Lexi**, `agents/lexi/agent.md`, mode `publishing`: menelaah struktur dan
  kualitas penerbitan secara read-only. Rincian awal terdapat di
  [penilaian Lexi](lexi-epub-assessment.md).
- **Rena**, `agents/release-documentarian/agent.md`, mode `ci`: menelaah batas
  antara bukti lokal dan pemeriksaan yang tersambung ke workflow.

Profil adalah panduan kerja, bukan sertifikasi atau tambahan izin. Review
Vera terhadap perubahan auditor buatannya sendiri adalah self-review; agen
utama membaca dan menjalankan ulang kontrolnya. Tidak ada publikasi atau
pengujian perangkat fisik pada audit ini.

## Cakupan dan bukti awal

Ada **17 EPUB representatif**: empat korpus browser, satu hasil koreksi PDF,
empat fixture gate, dan delapan contoh keluaran unit test. Ini bukan pemeriksaan
semua buku pengguna atau seluruh kombinasi format, ukuran dan firmware.

Baseline disimpan sebelum regenerasi pada
`output/epub/standardization-2026-10-17/baseline/audit-results.json`, berikut
laporan EPUBCheck. Salinan 17 EPUB awal dipertahankan di subfolder `files/`
dengan struktur asal; identitas SHA-256 tercatat dalam JSON.

Baseline menunjukkan:

| Pemeriksaan | Hasil awal |
| --- | --- |
| EPUBCheck 5.4.0, tanpa warning | 15/17 lulus |
| Audit tambahan tanpa error | 9/17 lulus |
| Lulus keduanya sekaligus | **8/17** |
| Aset gambar | 218 |
| PNG gagal integritas CRC | 129, tersebar di 8 EPUB fixture |
| Gambar gagal decoding Pillow | 0 |
| MIME gambar tidak cocok | 3 aset dalam contoh CBZ |

Decoder browser/Pillow yang toleran masih dapat membuka PNG dengan CRC rusak.
EPUBCheck juga tidak menolak CRC tersebut. Oleh karena itu keberhasilan membuka
gambar atau lolos EPUBCheck tidak cukup untuk menyatakan integritas gambar baik.
Lima EPUB korpus/browser tidak mengandung kegagalan gambar tersebut.

## Perbaikan yang diterapkan

1. Mengganti PNG fixture rusak dengan PNG valid. Fixture gate memakai diagram
   grayscale 240 × 160; contoh CBZ memakai JPEG sungguhan untuk nama `.jpg`.
   Fixture unit kecil tetap kecil ketika hanya menguji struktur dokumen.
2. Menambahkan preflight format raster dan CRC chunk PNG sebelum EPUBCheck pada
   `tests/validate-epub.cjs`. Composite action yang sudah digunakan workflow test
   dan deploy otomatis memanggil gate yang diperketat ini.
3. Menambahkan audit lokal dengan ZIP/resource checks, referensi lokal/fragmen,
   metadata dasar, navigasi, verifikasi dan decoding Pillow, serta EPUBCheck.
   Auditor mengembalikan status gagal jika ada error, validator gagal, atau tidak
   ada file yang diperiksa.
4. Menambahkan kontrol positif/negatif untuk gambar rusak, terpotong, MIME salah,
   sumber CSS eksternal/hilang, dan kebijakan status gagal.

Tidak ada perubahan pada mesin konversi atau kualitas OCR dalam putaran ini.
Mengganti gambar fixture memperbaiki keabsahan pengujian; itu tidak membuktikan
peningkatan ketajaman buku pengguna.

Rena mengonfirmasi wiring gate di workflow test dan deployment. Audit Python/
Pillow atas 17 berkas serta enam kontrolnya **masih lokal**, belum dipanggil
workflow. Langkah lanjutan CI adalah menjalankan decoder gambar dan menyimpan
laporan validator sebagai artifact, agar bukti kegagalan tidak hilang bersama
runner. Belum ada bukti run GitHub untuk perubahan ini.

## Hasil validasi ulang

Hasil akhir tersimpan pada
`output/epub/standardization-2026-10-17/final/audit-results.json` beserta 17
laporan EPUBCheck. Lima aset sumber aplikasi tetap mempunyai hash yang sama
dengan baseline. Semua salinan EPUB baseline cocok dengan hash yang direkam.

| Pemeriksaan lokal | Hasil akhir |
| --- | --- |
| Seluruh rangkaian Node (`tests/run.js`) | **52/52 lulus** |
| Kontrol auditor Python | **6/6 lulus** |
| Gate empat EPUB: gambar + EPUBCheck tanpa warning | **4/4 lulus** |
| Audit tambahan atas 17 EPUB | **17/17 tanpa error** |
| EPUBCheck tanpa warning | **16/17 lulus** |
| Lulus audit tambahan dan EPUBCheck sekaligus | **16/17** |
| Integritas dan decoding 218 aset raster | **0 kegagalan** |

Satu kegagalan yang tersisa adalah `tests/sample-article.epub`: dua error
EPUBCheck, tanpa warning, karena gambar eksternal. Auditor penuh sengaja
mengembalikan **exit 1**; tidak mengabaikan file ini agar laporan terlihat hijau.
Referensi jaringan dicatat sebagai review note oleh auditor tambahan, sedangkan
EPUBCheck menentukan pelanggaran paketnya. Karena itu angka 17/17 audit tambahan
tidak boleh disajikan sebagai seluruh EPUB sudah memenuhi standar.

Log pengujian lokal:
`tmp/pdfs/stress-lab/standardization-unit-tests.log` dan
`tmp/pdfs/stress-lab/standardization-final.log`.

Putusan: kelayakan **bersyarat untuk uji baca**, dengan perbaikan integritas
fixture dan perlindungan gate yang sudah diverifikasi. Belum layak diberi klaim
konversi sempurna, kualitas OCR terjamin, atau kompatibilitas fisik X4 Pro.

## Masalah yang tetap terbuka

**P1 — Artikel bergambar harus mandiri.** `tests/sample-article.epub` merujuk
`https://slow.example/img/panel.png`. EPUBCheck menandai OPF-014 dan RSC-006.
Tes ekstraksi membuat buku dengan `images:[]` lalu langsung mengekspor. Penelusuran
`ingestArticle()` juga menunjukkan `images:[]`; jalur build hanya memproses
gambar yang sudah berada dalam buku. Ini alasan konkret untuk menambahkan tahap
penyimpanan gambar artikel, bukan menghapus contoh gagal dari laporan. Belum ada
uji end-to-end artikel nyata bergambar pada putaran ini.

Penerimaan pengembangan berikutnya: gambar yang boleh diambil disimpan lokal
di EPUB; timeout/CORS/MIME tidak dikenal menghasilkan pesan yang jelas; gambar
yang gagal tidak tertinggal sebagai referensi rusak. Ekspor teks tanpa gambar
harus menjadi pilihan yang dijelaskan kepada pengguna. Validasi ulang offline,
EPUBCheck dan decoding terhadap jalur antarmuka pengguna.

**P2 — Teks OCR belum setara naskah bersih.** Korpus kompleks sebelumnya
mencatat WER ternormalisasi **5,46%**, kecocokan **69/80** frasa dan **79/144**
marker persis. Angka, tanggal, aksen, serta 27 marker yang salah menjadi heading
memerlukan perbaikan. Korpus digital sintetis 1.200 halaman menunjukkan WER 0,
tetapi bersifat repetitif dan bukan pembuktian untuk semua PDF. Pertahankan teks
mentah/provenance dan koreksi pengguna; ukur ulang perubahan pada korpus yang
sama sebelum mengklaim OCR meningkat.

**P2 — Bahasa, struktur dan aksesibilitas.** Bahasa paket OPF tidak menggantikan
bahasa pada XHTML/NAV. Tabel yang berubah menjadi paragraf kehilangan semantik.
Alternatif gambar bermakna dan metadata aksesibilitas perlu dilengkapi dengan
jujur. Jangan menambahkan klaim sertifikasi atau deskripsi gambar hasil tebakan.
Lihat [EPUB Accessibility](https://www.w3.org/TR/epub-a11y/).

**P2 — Uji perangkat.** X4 Pro/CrossPoint masih **UNVERIFIED** karena perangkat
belum siap. Uji buka, navigasi, pagination, ukuran font, resume, ketajaman gambar
dan transfer harus dicatat bersama versi firmware. Preview desktop bukan uji
panel e-ink.

## Batas alat dan klaim

- [EPUBCheck](https://www.w3.org/publishing/epubcheck/) dipakai sebagai validator
  format, bukan pemeriksa kebenaran OCR atau jaminan kompatibilitas semua reader.
- Gate Node memeriksa tanda format raster dan CRC PNG; bukan decoder JPEG/piksel
  lengkap. Audit Pillow lokal melengkapi pemeriksaan itu. SVG tidak dirasterisasi
  oleh audit ini.
- Scanner sumber meliputi XML src/href dan CSS url/@import yang umum, bukan parser
  CSS/srcset lengkap. Sintaks CSS dengan escape memerlukan review tambahan.
- Empat fixture gate tidak mewakili seluruh 17 file. Berhasil menjalankan gate
  lokal tidak membuktikan GitHub Actions telah dijalankan pada perubahan ini.
- NAV dan NCX tidak mengubah paket EPUB 3 menjadi keluaran EPUB 2 terpisah.
- Belum ada benchmark baru terhadap Calibre/CloudConvert. Tidak ada dasar untuk
  menyatakan ReadMaker lebih baik dari keduanya pada semua sumber.
