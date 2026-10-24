# Permintaan analisis agen ReadMaker — 24 Oktober 2026

Audit katalog Jev 3.2.2 berhasil: 13 profil aktif. Lima proposal telah diperiksa dengan `jev.py route`; semuanya berstatus `approval_required`, bukan agen berjalan.

**Status akhir: kelima agen telah disetujui pengguna, menerima handoff resmi, dan menyelesaikan analisis baca-saja.** Lihat [laporan gabungan dan urutan perbaikan](combined-review.md), serta [temuan awal Vera](findings.md). Tidak ada persetujuan tambahan yang diperlukan untuk membaca hasil ini. Kode produksi tidak diubah; tes dan aplikasi tidak dijalankan pada putaran analisis ini.

Setelah analisis, pengguna meminta implementasi. Lihat [perbaikan dan bukti pengujian](implementation.md). Pernyataan baca-saja di atas berlaku untuk tahap analisis agen; tahap implementasi kemudian mengubah kode dan menjalankan pengujian sesuai instruksi pengguna.

| Agen | Mode | Fokus |
|---|---|---|
| Vera | review | Bug, regresi, cakupan tes dan performa |
| Sera | threat-review | Keamanan impor, preview, dependensi dan transfer |
| Lexi | publishing | Mutu teks, OCR, ilustrasi dan struktur EPUB |
| Mira | audit | Alur pengguna baru, mobile/desktop dan aksesibilitas |
| Raka | design | Arsitektur, memori dan prioritas pengembangan |

Proyek: `.`. Semua proposal membatasi tindakan ke membaca `index.html`, `pdf-review.js`, `device-compatibility.js`, `responsive.css`, `README.md`, `tests`, `docs`, dan `.github`. Tidak memberi scope perubahan kode, eksekusi tes, jaringan atau publikasi. Analisis UX dari kode tidak boleh disebut pengujian visual nyata. Tidak ada modul proyek hub yang diaktifkan; ReadMaker berstatus unregistered dan path-nya dinyatakan eksplisit.

Setiap `*.request.json` memuat scope konkret; pasangan `*.route.json` adalah snapshot routing awal, bukan status live atau bukti analisis selesai. Target keluaran setelah handoff adalah temuan dengan bukti file/baris, dampak, prioritas, saran perbaikan dan status verifikasi; koordinator akan menyatukan temuan yang tumpang tindih.

## Riwayat persetujuan

Aturan dari `konfigurasi lokal AGENTS.md` mewajibkan entrypoint Jev. `jev/README.md` menyatakan: “Setiap handoff memerlukan receipt manusia, termasuk read/discuss.” Agen tidak mengisi tantangan persetujuan atas nama manusia. Pengguna menyelesaikan kelima persetujuan sendiri, kemudian CLI resmi mengonsumsi masing-masing receipt sekali untuk mengeluarkan konteks peran.

Skrip `approve-agents.ps1` merupakan artefak persiapan awal dan tidak perlu dijalankan lagi. Sistem pengguna memblokir skrip PowerShell; persetujuan akhirnya dilakukan dengan perintah Python Jev langsung di Command Prompt, tanpa mengubah ExecutionPolicy. Snapshot `*.route.json` tetap menyimpan status proposal awal, bukan status akhir. Receipt tidak disalin ke dokumentasi atau dipakai ulang.

Konteks resmi masing-masing peran diberikan kepada subagen Codex sesuai scope. Mira menggunakan slot subagen `new_user_qa`, Raka menggunakan slot `rena`, dengan profil lama diganti konteks resmi yang baru disetujui. Jev bukan model/API yang berjalan sendiri dan tidak memberikan izin runtime tambahan.

## Sanitasi publik — 25 Oktober 2026

Jalur komputer diganti dengan akar repo relatif (`.`). Snapshot dan hash historis bukan receipt aktif dan tidak memvalidasi salinan yang telah disanitasi. Skrip persiapan menggunakan parameter lokal; jangan menjalankan ulang persetujuan historis.
