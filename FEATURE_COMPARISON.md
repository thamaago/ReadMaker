# Matriks kemampuan ReadMaker

Diperbarui: 25 Oktober 2026 berdasarkan kode, pengujian, dan workflow repo. **Tersedia** berarti ada implementasi; **parsial** berarti ada batas format, jaringan, atau validasi. Status tidak menyatakan sertifikasi perangkat.

| Area | Status | Kemampuan dan batas bukti |
| --- | --- | --- |
| TXT, Markdown, RTF, HTML, FB2, ODT | Tersedia | Parser lokal, sanitasi, metadata/struktur sesuai format. |
| DOCX | Tersedia | Mammoth dimuat lewat jaringan; skenario browser tersedia. |
| PDF reflow dan fixed | Tersedia | Rekomendasi mode, pembersihan header, metadata fallback, gambar dan pemetaan halaman. Layout kompleks perlu ditinjau. |
| OCR PDF scan/campuran | Parsial | Render aman sebelum OCR tanpa ekstraksi scan asli; fallback gambar untuk halaman tanpa hasil teks. Akurasi belum disahkan terhadap transkripsi manusia. |
| Tinjauan dan koreksi PDF | Tersedia | Bandingkan halaman sumber dengan hasil; koreksi teks reflow selama sesi. Teks halaman raster tidak dapat diedit. |
| MOBI/AZW3 | Parsial | Tanpa DRM, PalmDOC dan TOC bawaan; HUFF/CDIC belum didukung. |
| CBZ / XTC / XTCH | Tersedia | Halaman gambar, urutan numerik, folder bab dan pipeline e-ink; native output belum diuji pada hardware. CBR tidak didukung. |
| Artikel web / AO3 | Parsial | Fetch/paste HTML; gambar dikemas jika dapat diambil, pilihan teks saja bila diblokir. CORS tetap berlaku. |
| Metadata dan TOC | Tersedia | Edit judul/penulis, edit/reorder bab, nested NAV/NCX, preview dan paging daftar bab. |
| Keluaran EPUB | Tersedia | EPUB 3 dengan NCX fallback, fixed-layout viewport, profil universal/CrossPoint; tidak ada ekspor EPUB 2 terpisah. |
| Engine 1.0.0 | Tersedia | BookModel, split target 192 KiB UTF-8, ruby dan guard isi/aset/tautan/XML. Blok atomik besar diberi peringatan. |
| Laporan kualitas | Tersedia | JSON tunggal/batch; membandingkan konten siap-build dengan hasil, bukan akurasi sumber/OCR. |
| EPUBCheck resmi | Tersedia untuk fixture | Versi 5.4.0 pada lokal/CI dengan fail-on-warnings; tidak dijalankan pada setiap ekspor browser. |
| Validator JS/WASM browser | Belum tersedia | epubcheck-ts merupakan acuan riset, belum menjadi runtime. |
| Perangkat umum | Parsial | Baseline universal; CrossPoint memiliki profil khusus. Pemilihan target bukan sertifikasi firmware. |
| RTL dan CJK | Parsial | Arah baca, bahasa dan ruby tersedia; tipografi akhir bergantung pembaca. |
| Batch / kamus / wallpaper | Tersedia | ZIP EPUB per item, StarDict, BMP/overlay; pembatalan dan batas sumber diuji. |
| Transfer Wi-Fi | Parsial | WebSocket/HTTP, profil, QR, timeout/cancel; simulasi protokol bukan uji perangkat nyata. |
| Pengujian browser | Tersedia | Skrip khusus terpisah dari suite headless; sebagian memerlukan fixture dan Playwright. |
| Offline penuh | Parsial | Core lokal; PDF/DOCX/OCR/QR memuat dependensi on demand. |
| Responsivitas proses berat | Parsial | Progress/cancel pada beberapa alur; parser sinkron dan decode dapat membebani main thread. |
| Korpus fidelity | Parsial | Fixture sintetis dan auditor tersedia; benchmark akurasi OCR serta seluruh variasi layout belum lengkap. |
| Uji hardware | Belum tervalidasi | Gunakan checklist perangkat dan catat firmware sebelum menaikkan status. |

## Posisi terhadap proyek acuan

Calibre dan Pandoc menjadi acuan pipeline; Sigil menjadi acuan review/edit; EPUBCheck memeriksa conformance; CrossPoint menjadi acuan profil perangkat. ReadMaker tidak menyertakan seluruh kemampuan proyek tersebut. epub.js, epub-gen-memory, epubcheck-ts, dan EbookLib belum diintegrasikan sebagai runtime.

Daftar riset tersedia di [REPO_RESEARCH.md](REPO_RESEARCH.md). Pekerjaan terbuka tersedia di [roadmap](DEVELOPMENT_PLAN.md). Rincian implementasi serta batas hasil pengujian tersedia di [laporan engine](docs/readmaker-engine-2026-10-25.md) dan [audit lima putaran](docs/five-pass-audit-2026-10-25.md).
