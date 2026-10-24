# Rencana pengembangan ReadMaker

Status: 25 Oktober 2026. Roadmap mengikuti implementasi dalam repo; prioritas berikut belum merupakan janji tanggal rilis.

## Arah produk

Menghasilkan EPUB yang dapat diperiksa sebelum dibagikan, dengan pemrosesan lokal, pemilihan mode yang jelas, dan keluaran konservatif untuk e-reader. Keutuhan isi, struktur, keterbacaan, dan batas kompatibilitas menjadi kriteria keputusan.

## Kemampuan yang tersedia

| Area | Implementasi saat ini | Bukti |
| --- | --- | --- |
| Pipeline | BookModel, split UTF-8, pemeriksaan sebelum pengemasan | index.html, tests/native-engine.test.js |
| PDF | Rekomendasi reflow/fixed, OCR per halaman, pemetaan, tinjauan dan koreksi teks | pdf-review.js, tests/pdf-review.test.js |
| EPUB | EPUB 3, NAV/NCX, XML/resource/link checks, ruby, laporan JSON | tests/epub-quality.test.js, tests/engine-compat.test.js |
| Conformance | EPUBCheck 5.4.0 untuk fixture dalam workflow test dan Pages | .github/actions/epub-validation/action.yml |
| UX | Preset, metadata, edit/reorder bab, preview, batch, pembatalan job | tests/output-presets.test.js, tests/job-transfer-regressions.test.js |
| Browser | Skenario PDF, DOCX, gambar web, unduhan, koreksi, alat pendamping | tests/*browser.cjs |

Laporan historis tersedia di [implementasi engine](docs/readmaker-engine-2026-10-25.md) dan [audit lima putaran](docs/five-pass-audit-2026-10-25.md). Hasil sebelumnya tidak menjadi hasil pengujian ulang otomatis untuk setiap perubahan.

## Prioritas berikutnya

| Prioritas | Pekerjaan | Kriteria selesai |
| --- | --- | --- |
| Tinggi | Migrasi PDF.js 3.11.174 ke versi yang ditambal | Loader, worker, SRI, ekstraksi, rendering, OCR, koreksi dan fixture EPUB lolos regresi. Mitigasi saat ini tetap terpasang selama migrasi. |
| Tinggi | Uji perangkat fisik | Log per perangkat/firmware untuk buka buku, TOC, font, gambar, RTL, fixed layout, transfer dan resume. |
| Tinggi | Korpus fidelity sintetis berlabel | Expected teks, urutan baca, bab, gambar, halaman; ekstraksi dinilai terpisah dari pemeriksaan builder. |
| Menengah | Akurasi OCR dan layout kompleks | Bandingkan dengan transkripsi acuan; ukur kesalahan teks dan urutan baca serta batas confidence. |
| Menengah | Responsivitas dan memori | Profil main thread, decode gambar, DOM pada desktop/ponsel; pindahkan pekerjaan yang tepat ke Worker dengan progress/cancel. |
| Menengah | Paket offline lengkap | Pin/verifikasi loader, worker, WASM, data bahasa dan dependensi; uji tanpa jaringan sejak penggunaan pertama. |
| Menengah | Reproduksibilitas browser test | Dokumentasikan runtime, browser, fixture dan perintah; simpan hasil yang disanitasi. |
| Lanjutan | Pemisahan modul internal | Pisahkan parser, model, normalizer, aset, builder dan UI dengan menjaga distribusi statis serta paritas keluaran. |

## Kriteria rilis

- Seluruh suite relevan lolos pada commit yang dirilis.
- Fixture rilis lolos EPUBCheck tanpa error/peringatan dan referensi sumber daya putus.
- Fidelity diperiksa dengan sumber sintetis berlabel; laporan builder tidak dianggap bukti akurasi ekstraksi/OCR.
- Status kompatibilitas menyebut perangkat dan firmware yang benar-benar diuji.
- Aset publik mengikuti allowlist deployment dan [panduan privasi](PRIVACY.md).
- Perubahan dependensi menyertakan verifikasi worker, lisensi, integritas dan regresi browser.

## Batas lingkup

DRM removal, perubahan firmware dari aplikasi, cloud storage sebagai ketergantungan inti, dan pengganti penuh pengelola perpustakaan desktop berada di luar fokus. EPUB 3.4 masih merupakan draft pada tanggal telaah; adopsinya memerlukan kajian validator dan pembaca target.
