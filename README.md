# ReadMaker

ReadMaker adalah aplikasi konversi berbasis peramban untuk mengubah dokumen, artikel web, dan komik menjadi EPUB. Berkas diproses di perangkat pengguna, dengan preset untuk teks reflow, halaman asli, dan layar e-ink.

**Status dokumentasi: 25 Oktober 2026.** ReadMaker Engine 1.0.0 tersedia dalam kode. Kompatibilitas perangkat fisik dan akurasi OCR tetap memerlukan pemeriksaan tersendiri. Proyek komunitas ini tidak mengubah firmware e-reader.

## Mulai menggunakan

1. Buka URL deployment melalui panel **About** atau **Deployments** repositori, atau unduh repo dan buka `index.html` secara lokal.
2. Pilih berkas, tempel HTML, atau masukkan URL artikel.
3. Periksa metadata, daftar bab, preset, dan pratinjau. Untuk PDF, gunakan tinjauan halaman dan koreksi teks bila diperlukan.
4. Pilih **Buat EPUB**, periksa laporan kualitas, lalu salin hasil ke e-reader.

Untuk penggunaan lokal, simpan lima berkas aplikasi dalam folder yang sama: `index.html`, `jszip.min.js`, `responsive.css`, `device-compatibility.js`, dan `pdf-review.js`. PDF, DOCX, OCR, dan pemindaian QR memuat dependensi tambahan melalui jaringan; unduhan repo belum menyediakan seluruh dependensi untuk penggunaan offline penuh.

## Format dan keluaran

| Sumber | Dukungan dan batas utama |
| --- | --- |
| TXT, Markdown, RTF, HTML | Teks, struktur bab, dan pemformatan dasar; HTML disanitasi. |
| FB2, ODT, DOCX | Metadata, struktur, dan gambar sesuai hasil parser. DOCX menggunakan Mammoth yang dimuat saat diperlukan. |
| PDF | Reflow untuk teks yang dapat disesuaikan, atau halaman raster untuk mempertahankan tampilan sumber. OCR opsional membaca halaman tanpa lapisan teks, termasuk PDF campuran. |
| MOBI / AZW3 | Berkas tanpa DRM dengan kompresi yang didukung. HUFF/CDIC belum didukung. |
| CBZ | Halaman gambar dengan urutan numerik dan bab berdasarkan folder. CBR/RAR perlu diubah ke CBZ terlebih dahulu. |
| Artikel web / AO3 | Ambil URL atau tempel HTML. Akses jaringan dan gambar mengikuti kebijakan CORS situs sumber. |

Keluaran utama adalah **EPUB 3**, dengan `nav.xhtml` dan fallback `toc.ncx`. NCX tidak berarti tersedia ekspor EPUB 2 terpisah. Fitur pendamping mencakup XTC/XTCH untuk halaman gambar, kamus StarDict, wallpaper BMP, konversi batch ke ZIP, serta transfer Wi-Fi opsional.

## Memilih preset

| Kebutuhan | Pilihan |
| --- | --- |
| Memulai dengan rekomendasi aplikasi | Otomatis aman (disarankan) |
| Menjaga kualitas gambar sumber lintas pembaca | Semua perangkat (kualitas sumber) |
| Teks ringan dan ukuran huruf yang dapat diubah | Teks paling ringan / reflow |
| PDF dengan ilustrasi atau tata letak kompleks | Pertahankan tata letak |
| Komik pada layar e-ink kecil | Komik untuk e-ink |

Halaman asli menjaga tampilan sebagai gambar sehingga ukuran huruf tidak dapat diatur seperti teks reflow. Optimasi e-ink menyediakan penyesuaian panel, grayscale, dan dithering; hasil akhir perlu diperiksa pada pembaca yang digunakan.

## Pemeriksaan kualitas

Engine memeriksa XML, sumber daya lokal, tautan internal, urutan teks dan gambar, penekanan, serta ruby sebelum mengemas EPUB. Bagian teks besar dipecah dengan target 192 KiB UTF-8; blok atomik yang terlalu besar diberi peringatan. Laporan kualitas dapat diunduh sebagai JSON.

Status lolos membandingkan konten yang **sudah diekstrak** dengan keluaran builder. Kesalahan ekstraksi PDF dan OCR masih dapat lolos pemeriksaan tersebut. EPUBCheck 5.4.0 dijalankan untuk fixture lokal/CI, bukan pada setiap ekspor peramban. Rujukan stabil tetap [EPUB 3.3](https://www.w3.org/TR/epub-33/); [EPUB 3.4 bertanggal 22 Oktober 2026](https://www.w3.org/TR/2026/CRD-epub-34-20261022/) masih berstatus Candidate Recommendation Draft dan belum menjadi klaim dukungan aplikasi.

Lihat [matriks fitur](FEATURE_COMPARISON.md), [implementasi engine](docs/readmaker-engine-2026-10-25.md), dan [audit lima putaran](docs/five-pass-audit-2026-10-25.md). Hasil audit terdahulu berlaku untuk snapshot yang dicatat dalam masing-masing laporan. Penyesuaian dokumentasi dan privasi dicatat dalam [telaah repo](docs/repository-review-2026-10-25.md).

## Perangkat dan transfer

EPUB universal menjadi baseline untuk pembaca umum. CrossPoint memakai profil stylesheet khusus; pilihan perangkat lain tidak menjamin seluruh fitur firmware. Kindle menggunakan alur Send to Kindle. Rincian profil tersedia di [kompatibilitas perangkat](DEVICE_COMPATIBILITY.md).

Salin EPUB ke kartu SD, unggah melalui halaman berbagi perangkat, atau gunakan transfer langsung pada jaringan yang sama. Profil otomatis mencoba WebSocket CrossPoint lalu HTTP; profil stock menggunakan HTTP. Situs HTTPS dapat dibatasi oleh mixed content saat mengakses perangkat HTTP. Gunakan salinan lokal atau transfer manual jika peramban memblokirnya.

Transfer langsung dan XTC/XTCH masih memerlukan validasi hardware. ZIP batch harus diekstrak sebelum EPUB disalin ke perangkat. Gunakan [checklist X4 Pro](docs/x4-pro-acceptance.md) untuk mencatat firmware dan hasil nyata.

## Privasi

Berkas lokal diproses di peramban tanpa server konversi atau akun. Permintaan jaringan terjadi ketika membuka situs, memuat pustaka tambahan, mengambil artikel/gambar web, atau mengirim hasil ke e-reader atas pilihan pengguna. Konversi berkas lokal tidak mengunggah sumber ke layanan konversi.

Konversi mempertahankan metadata dan isi sumber; aplikasi **tidak otomatis menganonimkan dokumen**. Periksa judul, penulis, isi, gambar, dan laporan sebelum membagikannya. Panduan materi publik tersedia di [PRIVACY.md](PRIVACY.md).

## Batasan

- PDF multi-kolom, tabel, rumus, dan OCR dapat memerlukan koreksi manual atau mode halaman asli.
- DRM, HUFF/CDIC, dan CBR/RAR tidak didukung langsung.
- CBZ dibatasi hingga 1.000 halaman dan 128 MiB data gambar. Batas byte tidak menjamin batas penggunaan RAM peramban.
- Gambar artikel/HTML disimpan ke EPUB bila dapat diambil. Jika situs memblokir gambar, ekspor berhenti dengan penjelasan; pilih **Teks saja** untuk melanjutkan tanpa gambar web. Gambar lokal yang sudah tertanam tetap dipertahankan. Lihat [penanganan gambar web](docs/web-article-images.md).
- PDF.js yang dipakai masih memerlukan migrasi ke versi yang ditambal. Mitigasi `isEvalSupported:false` tersedia; mitigasi bukan pembaruan dependensi. Lihat [audit keamanan](docs/five-pass-audit-2026-10-25.md).
- Pengujian struktur, simulasi protokol, dan browser tidak menggantikan uji perangkat fisik.

## Pengembangan dan rilis

CI menggunakan Node.js 24.19.0. Dari direktori repo:

```sh
cd tests
npm ci
npm test
```

Suite headless menguji parser, builder, sanitasi, kualitas keluaran, i18n, dan alur aplikasi. Jalur canvas, PDF.js, Mammoth, serta unduhan memerlukan pengujian browser. Skenario terpisah tersedia sebagai `tests/*browser.cjs`; lihat prasyarat pada skrip dan [lab PDF](docs/pdf-stress-lab.md). Stress tambahan: `npm run stress` dan `npm run stress:browser` dari folder `tests`.

GitHub Pages memakai workflow `.github/workflows/deploy-pages.yml`. Artefak situs hanya berisi lima berkas aplikasi dan `.nojekyll`. Lihat [checklist rilis](RELEASE.md), [kontribusi](CONTRIBUTING.md), [roadmap](DEVELOPMENT_PLAN.md), dan [riset acuan](REPO_RESEARCH.md).

## Lisensi

ReadMaker menggunakan [MIT License](LICENSE). Atribusi dan lisensi dependensi tetap dipertahankan dalam [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). [CrossPoint Reader](https://github.com/crosspoint-reader/crosspoint-reader) merupakan proyek rujukan perangkat; ReadMaker adalah alat komunitas independen.
