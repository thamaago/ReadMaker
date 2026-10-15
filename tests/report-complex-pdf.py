"""Write a human-readable report without treating failed quality gates as passes."""
from pathlib import Path
from collections import defaultdict
import json,csv,hashlib
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'output/epub/stress-lab'
quality=json.loads((OUT/'quality-results.json').read_text(encoding='utf8'))
browser=json.loads((OUT/'browser-results.json').read_text(encoding='utf8'))
pages=json.loads((OUT/'page-checks.json').read_text(encoding='utf8'))
layouts=json.loads((OUT/'layout-results.json').read_text(encoding='utf8'))
truth=json.loads((ROOT/'output/pdf/stress-lab/ground-truth.json').read_text(encoding='utf8'))
assert len(browser['results'])==4 and all(r.get('ready') for r in browser['results'])
assert len(layouts)==864
groups=defaultdict(lambda:dict(edits=0,words=0,checks=0,passed=0))
for p in pages:
 if p['run']!='complex-reflow':continue
 g=groups[p['variant']];g['edits']+=p['normalizedWordEdits'];g['words']+=p['referenceWords'];g['checks']+=len(p['checks']);g['passed']+=sum(c['passed'] for c in p['checks'])
with (OUT/'ringkasan-per-halaman.csv').open('w',encoding='utf-8-sig',newline='') as f:
 fields=['run','page','variant','case','markersRetained','markersExpected','markerOrder','columnOrder','normalizedWordEdits','referenceWords','normalizedWerPercent','failedPhrases']
 w=csv.DictWriter(f,fieldnames=fields);w.writeheader()
 for p in pages:w.writerow({**{k:p[k] for k in fields if k in p},'failedPhrases':' | '.join(c['phrase'] for c in p['checks'] if not c['passed'])})
text='''# Hasil stress test PDF kompleks ReadMaker

## Kesimpulan

Pembuatan file EPUB berhasil pada empat jalur, tetapi kualitas konversi PDF
kompleks **belum memenuhi seluruh kriteria**. Jalur teks digital panjang kuat
pada fixture ini; pemulihan struktur PDF kompleks masih menjadi batas utama.
Hasil yang dibagikan adalah output aplikasi mentah, tanpa penyuntingan isi.

## Dokumen uji

- `ReadMaker-Complex-48.pdf`: 12 kasus tata letak dalam empat varian: digital,
  scan bersih 180 dpi, scan 125 dpi dengan kontras rendah/blur/JPEG 50, dan
  scan miring 2,2 derajat. Total 48 halaman, sekitar 2,3 MB.
- Kasus: narasi/dialog, sinopsis rata tengah dengan artefak margin, dua kolom,
  tabel harga, judul bergaya dan drop cap, ilustrasi, catatan kaki, lanskap,
  aksen dan kode O/0/I/1, teks putih di panel gelap, kredit kecil dua kolom,
  serta halaman dengan sedikit teks.
- `ReadMaker-Volume-1200.pdf`: 1.200 halaman digital, 60 bookmark, 3.600 penanda,
  183.600 token acuan. Jumlah halaman dan teks melebihi dua buku referensi
  digabungkan; ukurannya sekitar 1,3 MB karena teks sintetis berulang dan font
  tertanam. Ini bukan pengganti uji PDF scan 100 MB atau variasi isi dunia nyata.
- `ReadMaker-Complex-acuan.html`: acuan teks semantik untuk membedakan masalah
  ekstraksi PDF/OCR dari pengemasan EPUB. Tidak membawa ilustrasi dan tidak
  merupakan perbaikan otomatis PDF.
- Isi seluruh fixture ditulis baru; tidak menyalin isi HELLO atau Sore.

## Metode

Pengujian menggunakan Edge headless, halaman aplikasi dari server localhost,
pemilih berkas `#file`, preset aplikasi, PDF.js 3.11.174, Tesseract.js 5.1.0,
bahasa ind+eng, canvas asli, tombol Buat EPUB, dan unduhan browser. Tidak
memakai stub PDF/OCR, cache OCR buku sebelumnya, atau konverter EPUB terpisah.
Pilihan preset/OCR disetel oleh harness sebelum unggah. Tidak ada perbaikan
manual pada EPUB sebelum dinilai.

Teks diekstraksi dari XHTML sesuai urutan spine, lalu dibandingkan dengan
`ground-truth.json`. Normalisasi memakai Unicode NFKC, huruf kecil, dan token
alfanumerik; tanda baca dan kapitalisasi tidak dinilai. Header uji dan judul
volume yang diketahui dikecualikan. Word error rate (WER) memakai jarak edit
Levenshtein token, sehingga menghitung substitusi, tambahan, kehilangan, dan
perubahan urutan. Ini **bukan** persentase akurasi OCR umum atau jaminan atas
dokumen lain. Penanda kode diuji cocok persis, sehingga O/0 ikut menjadi gagal.

## Hasil konversi

| Jalur | Bagian EPUB | Ukuran | Waktu satu percobaan | Frasa | WER normalisasi | EPUBCheck |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
'''
timing={r['key']:r for r in browser['results']}
for q in quality:
 b=timing[q['key']];phrase=f'{q["phraseChecksPassed"]}/{q["phraseChecksExpected"]}' if q.get('phraseChecksExpected') else 'tidak diukur'
 wer=f'{q["normalizedWerPercent"]}%' if 'normalizedWerPercent' in q else 'gambar; tidak diukur'
 ck=q['epubcheck'];text+=f'| {q["key"]} | {q["spineItems"]} | {q["bytes"]:,} byte | {b["totalMs"]/1000:.2f} detik | {phrase} | {wer} | {ck["nError"]} error, {ck["nWarning"]} warning |\n'
text+='''
Waktu adalah satu pengukuran pada komputer ini, termasuk parse dan ekspor;
hasil OCR pertama juga mencakup pemuatan helper/model. Angka heap browser
tidak mencakup seluruh RAM proses, bitmap, worker, dan WASM. Tidak dilakukan
uji pengguna serentak, perangkat ponsel fisik, atau pengujian baterai.

### Variasi OCR dan ekstraksi pada PDF kompleks

| Varian | Frasa lolos | Edit token / token acuan | WER |
| --- | ---: | ---: | ---: |
'''
for variant,g in groups.items():text+=f'| {variant} | {g["passed"]}/{g["checks"]} | {g["edits"]}/{g["words"]} | {100*g["edits"]/g["words"]:.2f}% |\n'
text+='''
## Temuan yang dapat direproduksi

1. **Urutan baca dua kolom salah pada 8/8 kasus.** Contoh halaman 3, 11, 15,
   23, 27, 35, 39, 47. Aplikasi menyatukan baris dengan ketinggian sama melintasi
   kedua kolom. Daftar KIRI dan KANAN/penerbit seharusnya dibaca per kolom.
   Label numerik KIRI/KANAN dinormalisasi khusus untuk membedakan salah baca
   O/I dari kesalahan urutan; teks lain tidak dikoreksi saat pengujian.
2. **Drop cap masih terpisah menjadi `J ana`.** Frasa `Jana menerima sebuah surat`
   gagal pada halaman 5, 17, 29, 41, termasuk PDF digital. Perbaikan terdahulu
   belum mencakup bentuk geometri drop cap ini.
3. **Ilustrasi hilang pada reflow.** Sumber memiliki empat versi halaman
   ilustrasi (6, 18, 30, 42); hasil reflow tidak memiliki aset gambar sama sekali.
   Hasil halaman asli menyimpan 48 gambar halaman. Penilaian decode gambar
   bukan bukti bahwa ilustrasi yang hilang telah dipertahankan.
4. **Kode dan aksen tidak selalu akurat dalam OCR.** Contoh halaman 21, 33,
   45 pada kode O0I1l dan kata beraksen. Penanda tepat hanya 70/144 pada PDF
   kompleks, tetapi ini tidak berarti 51% teks narasi hilang: banyak penanda
   berubah O/0. Frasa diuji lokal per halaman, bukan dicari di seluruh buku.
5. **Rekomendasi multikolom salah untuk volume narasi.** `pdfAnalyzeLayout`
   menganggap 1.200 halaman multikolom meski sumbernya satu kolom. Ini muncul
   sebagai analisis/rekomendasi; preset teks yang dipilih tetap reflow.
6. **Header berulang ikut masuk pada jalur bookmark satu halaman.** Contoh
   halaman kompleks menampilkan header `READMAKER LAB...` sebagai isi karena
   rekonstruksi setiap bab kehilangan bukti pengulangan antarsumber halaman.
7. **Overflow pada layar sempit dan font besar.** Dari 864 kombinasi preview
   (48 halaman x 3 jalur x 3 lebar x 2 font), 13 overflow horizontal ditemukan
   pada 320 px/font 28 px: sembilan reflow PDF dan empat HTML acuan. Alamat
   situs/email serta beberapa token OCR panjang perlu aturan pemenggalan.
   Tidak ada gambar yang gagal decode.
8. **EPUB halaman asli memiliki satu warning OPF-086.** `rendition:viewport`
   dinyatakan deprecated oleh EPUBCheck 5.4.0. Tidak ada fatal/error pada keempat
   EPUB. Warning ini bukan bukti halaman kosong atau kegagalan perangkat.

## Bagian yang lulus pada fixture ini

- Keempat konversi selesai tanpa crash dan tanpa error JavaScript tercatat.
- Volume 1.200 halaman mempertahankan 3.600/3.600 penanda, urutan 1.200 halaman,
  dan seluruh 183.600 token acuan setelah normalisasi (WER 0%). Ini hanya
  berlaku pada dokumen digital sintetis yang diuji, bukan seluruh jenis PDF.
- HTML acuan mempertahankan 144/144 penanda, 80/80 frasa, dan token acuan (WER
  0%). Ini mengisolasi masalah utama pada ekstraksi/rekonstruksi PDF dan OCR;
  overflow di font besar tetap ditemukan pada jalur HTML.
- Kasus tabel yang diuji mempertahankan hubungan dua baris harga yang menjadi
  probe; ini belum membuktikan seluruh struktur tabel semantik dipertahankan.
- Dialog/sinopsis rata tengah, angka isi, catatan kaki, dan panel terbalik
  melewati frasa probe yang dipilih. Kecocokan kutip/tanda baca tidak dinilai
  WER karena normalisasi menghapusnya.
- Mode halaman asli mempertahankan seluruh 48 gambar sumber. Pada lebar
  480 px, cetakan 7,5 pt di halaman potret hanya setara sekitar 8,3 px sebelum
  efek rasterisasi. Diperlukan zoom atau reflow untuk pembaca yang memerlukan
  huruf besar; teks dalam gambar tidak mengikuti ukuran font pembaca.

## Prioritas perbaikan berikutnya

1. P1: segmentasi area/kolom sebelum pengurutan baris, diuji dengan seluruh
   delapan contoh kolom; jangan hanya mengganti label atau teks buku tertentu.
2. P1: ekstraksi bitmap PDF.js yang benar dan pemisahan ilustrasi dari scan
   halaman sebelum bitmap penuh dibuang setelah OCR.
3. P1: gabungkan glyph drop cap tanpa menyisipkan spasi ke kata pertama.
4. P2: hilangkan header global sebelum pemotongan bookmark, perbaiki analisis
   multikolom agar tidak menganggap indentasi narasi sebagai kolom.
5. P2: gunakan fallback pemenggalan URL/kata panjang di CSS EPUB; uji ulang
   13 kasus overflow tanpa mengubah teks kode/alamat.
6. P2: OCR per zona, deskew, pemeriksaan kode/nama lokal, dan tinjau huruf
   beraksen; jangan mengganti otomatis berdasarkan keyakinan model saja.
7. P3: tinjau metadata viewport deprecated dengan uji kompatibilitas pembaca
   lama agar penghapusan warning tidak mengembalikan masalah halaman kosong.

## Artefak dan pengulangan

- `simulasi-pdf-kompleks.html`: pembanding offline sumber/EPUB aktual, semua
  48 halaman, pilihan reflow/halaman asli/HTML acuan, lebar 320/480/528/540 dan font.
- `quality-results.json`, `page-checks.json`, `ringkasan-per-halaman.csv`:
  hasil pengukuran dan rincian kegagalan, bukan koreksi isi.
- `browser-results.json` dan `*-process.log`: jalur, preset, waktu, serta log OCR.
- `layout-results.json`: seluruh 864 pemeriksaan, termasuk yang gagal.
- `*-epubcheck.json`: hasil validator mentah.
- Source PDF/HTML dan `ground-truth.json` berada di `output/pdf/stress-lab/`.

Jalankan `tests/generate-complex-pdf.py`, `tests/complex-pdf-browser.cjs`,
`tests/evaluate-complex-pdf.py`, lalu `tests/complex-pdf-preview.cjs` dan
`tests/report-complex-pdf.py`. Python memerlukan reportlab, Pillow, pypdf serta
pdftoppm pada PATH. Harness browser memerlukan Playwright, browser, dan helper
aplikasi; gunakan `READMAKER_RUNTIME_MODULES` dan `BROWSER_BIN` bila diperlukan.
Evaluator memakai EPUBCheck lokal pada lokasi yang dicatat dalam skrip.

Preview browser tidak mensimulasikan firmware Xteink/ADE, refresh layar,
dithering perangkat, atau ketajaman fisik. Stress test ini mengungkap kegagalan
yang nyata, sehingga tidak boleh diberi label keseluruhan "lulus" hanya karena
file EPUB berhasil dibuat.
'''
text+='\n## Identitas hasil\n\n'
for q in quality:text+=f'- `{q["key"]}.epub`: SHA-256 `{q["sha256"]}`\n'
text+=f'- `index.html` yang diuji: SHA-256 `{hashlib.sha256((ROOT/"index.html").read_bytes()).hexdigest()}`\n'
(OUT/'Laporan-stress-test.md').write_text(text,encoding='utf8')
print('Report complete: four real conversions; semantic and layout failures preserved.')
