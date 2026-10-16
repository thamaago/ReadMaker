"""Report current measurements and preserve failed quality checks."""
from pathlib import Path
from collections import defaultdict
from zipfile import ZipFile, ZIP_DEFLATED
import json,csv,hashlib
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'output/epub/stress-lab'
BEFORE=ROOT/'output/epub/stress-lab-before'
def read(folder,name):return json.loads((folder/name).read_text(encoding='utf8'))
quality=read(OUT,'quality-results.json'); browser=read(OUT,'browser-results.json')
pages=read(OUT,'page-checks.json'); layouts=read(OUT,'layout-results.json')
assert len(browser['results'])==4 and all(r.get('ready') for r in browser['results'])
assert len(layouts)==864
app_hash=hashlib.sha256((ROOT/'index.html').read_bytes()).hexdigest()
assert browser['appSha256']==app_hash, 'Rerun browser benchmark for current app source'
for name,digest in browser.get('assetSha256',{}).items():
 assert digest==hashlib.sha256((ROOT/name).read_bytes()).hexdigest(), 'Rerun benchmark for current '+name
for q in quality:assert q['sha256']==hashlib.sha256((OUT/(q['key']+'.epub')).read_bytes()).hexdigest()
current={r['key']:r for r in quality}; timing={r['key']:r for r in browser['results']}
base={r['key']:r for r in read(BEFORE,'quality-results.json')} if (BEFORE/'quality-results.json').exists() else {}
oldpages=read(BEFORE,'page-checks.json') if (BEFORE/'page-checks.json').exists() else []
oldlayouts=read(BEFORE,'layout-results.json') if (BEFORE/'layout-results.json').exists() else []
def column_score(q):
 checks=q.get('columnChecks',[])
 return str(sum(c['passed'] for c in checks))+'/'+str(len(checks))
def drop_score(rows):
 checks=[c for p in rows if p['run']=='complex-reflow' for c in p['checks'] if c['phrase'].startswith('Jana menerima')]
 return str(sum(c['passed'] for c in checks))+'/'+str(len(checks))
text='''# Evaluasi ulang PDF dan EPUB ReadMaker

Pemeriksaan: 16 Oktober 2026. Empat jalur ekspor selesai, tetapi hasil OCR
kompleks belum sempurna. Tidak ada koreksi manual pada EPUB yang dinilai.
Angka di bawah hanya berlaku untuk fixture sintetis, bukan semua PDF atau
perbandingan mutu melawan aplikasi lain.

## Metode

48 halaman: 12 layout dalam bentuk digital, scan bersih 180 dpi, scan rusak
125 dpi, dan scan miring 2,2 derajat. Kasus mencakup dua kolom, tabel, drop cap,
ilustrasi, catatan kaki, lanskap, aksen, kode ambigu, dan teks putih di panel gelap.
Ada pula PDF digital berulang 1.200 halaman dan HTML semantik sebagai kontrol.
Dokumen ditulis baru dan tidak menyalin isi buku pengguna.

Edge headless menjalankan aplikasi localhost, pemilih file, PDF.js 3.11.174,
Tesseract.js 5.1.0 (ind+eng), canvas, tombol build, dan unduhan sebenarnya.
Harness membekukan source aplikasi saat mulai dan mencatat SHA-256.
WER dihitung dengan edit token terhadap ground truth independen: tanda baca
dan kapitalisasi tidak dinilai. WER bukan persentase akurasi OCR umum.

## Hasil terbaru

| Jalur | Halaman sumber / bagian EPUB | Ukuran | Waktu satu run | Frasa | WER | EPUBCheck 5.4.0 |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
'''
for q in quality:
 check=q['epubcheck']; phrase=f"{q['phraseChecksPassed']}/{q['phraseChecksExpected']}" if q.get('phraseChecksExpected') else '-'
 wer=str(q['normalizedWerPercent'])+'%' if 'normalizedWerPercent' in q else 'gambar'
 text+=f"| {q['key']} | {q['sourcePages']} / {q['spineItems']} | {q['bytes']:,} B | {timing[q['key']]['totalMs']/1000:.2f} dtk | {phrase} | {wer} | {check.get('nFatal','?')} fatal, {check.get('nError','?')} error, {check.get('nWarning','?')} warning |\n"
text+='''
Waktu bukan jaminan performa; pemuatan model, cache, dan pekerjaan komputer lain
berpengaruh. Volume 1.200 halaman hanya sekitar 1,3 MB, teksnya berulang; bukan
pengganti stress test scan 100 MB atau ponsel RAM rendah. Hasil halaman asli
memuat 48 gambar halaman, bukan teks yang dapat mengikuti ukuran font pembaca.

## Sebelum dan sesudah prioritas perbaikan

'''
q=current['complex-reflow']; b=base.get('complex-reflow')
if b:
 text+='| Pemeriksaan | Sebelum | Sesudah |\n| --- | ---: | ---: |\n'
 for label,old,new in [
  ('Urutan kolom',column_score(b),column_score(q)),
  ('Drop cap: frasa Jana menerima',drop_score(oldpages),drop_score(pages)),
  ('Aset ilustrasi reflow',str(b['images']),str(q['images'])),
  ('Frasa lokal',f"{b['phraseChecksPassed']}/{b['phraseChecksExpected']}",f"{q['phraseChecksPassed']}/{q['phraseChecksExpected']}"),
  ('WER token kompleks',str(b['normalizedWerPercent'])+'%',str(q['normalizedWerPercent'])+'%'),
  ('Penanda kode cocok persis',f"{b['markersRetained']}/{b['markersExpected']}",f"{q['markersRetained']}/{q['markersExpected']}"),
  ('Overflow horizontal',str(sum(r['overflow'] for r in oldlayouts)),str(sum(r['overflow'] for r in layouts))),
  ('Warning EPUB halaman asli',str(base['complex-layout']['epubcheck']['nWarning']),str(current['complex-layout']['epubcheck']['nWarning']))
 ]:text+=f'| {label} | {old} | {new} |\n'
text+=f"\nHeader uji yang tersisa dalam teks reflow: **{q['runningHeaderOccurrences']}**. "
text+=f"Ilustrasi pada halaman acuan: **{sum(c['preserved'] for c in q['illustrationChecks'])}/{len(q['illustrationChecks'])}**; halaman gambar tambahan tak diharapkan: **{len(q['unexpectedIllustrationPages'])}**.\n"
text+=f"Pemeriksaan preview: **{len(layouts)}**, overflow **{sum(r['overflow'] for r in layouts)}**, decode gambar gagal **{sum(not r['images'] for r in layouts)}**.\n"
text+='''
Perbaikan memakai geometri kolom dan drop cap, bukti header/footer antarsumber
halaman sebelum pemisahan bookmark, decoding bitmap PDF.js, crop ilustrasi
konservatif, segmentasi OCR otomatis/rotasi, retry terbatas per zona, pemenggalan
token panjang, serta penghapusan metadata viewport OPF deprecated. Viewport
XHTML per halaman tetap ada. Tidak ada penggantian teks berdasarkan jawaban fixture.

## Kesalahan yang masih ditemukan

| Halaman PDF kompleks | Frasa yang belum cocok setelah normalisasi |
| --- | --- |
'''
for p in pages:
 if p['run']!='complex-reflow':continue
 for c in p['checks']:
  if not c['passed']:text+=f"| {p['page']} | {c['phrase']} |\n"
text+='''
Urutan kolom dapat benar meskipun kode labelnya salah baca. Probe urutan
menormalkan O/I pada label KIRI/KANAN saja; penilaian teks dan kecocokan kode
tetap ketat. Penanda yang salah tidak berarti seluruh paragraf hilang.

## Batas dan prioritas berikutnya

- OCR memerlukan peninjauan kode, aksen, nama, dan cetakan kecil. Retry zona
  bukan jaminan perbaikan; tidak ada klaim seluruh teks bebas salah.
- Empat ilustrasi berhasil dipertahankan pada fixture ini; crop heuristik
  belum membuktikan semua ilustrasi atau diagram akan utuh.
- Pemeriksaan visual menunjukkan kontras ilustrasi scan yang lemah dan
  penanda OCR yang kadang dipromosikan menjadi heading. Ini belum tercakup
  oleh hitungan retensi gambar atau pemeriksaan overflow.
- Tabel yang diuji belum mewakili tabel bertingkat, rumus, atau bahasa RTL.
- Preview browser bukan emulator Xteink/ADE. Belum ada uji perangkat fisik.
- EPUBCheck menilai paket dan standar, bukan kebenaran bacaan atau ketajaman layar.
- Benchmark bersama Calibre/CloudConvert belum dilakukan. Tidak ada dasar
  untuk mengklaim ReadMaker paling tajam atau paling akurat.

Langkah berikut yang paling berdampak: preview sumber/hasil dan editor OCR
terarah, korpus dunia nyata yang berizin, benchmark pembanding dengan mode
identik, gate EPUBCheck saat rilis, serta uji perangkat/firmware fisik.

## Artefak

- `simulasi-pdf-kompleks.html`: sumber dan hasil EPUB aktual, pilihan halaman,
  mode, lebar layar, dan ukuran font.
- `quality-results.json`, `page-checks.json`, `ringkasan-per-halaman.csv`:
  metrik dan seluruh pemeriksaan termasuk yang gagal.
- `browser-results.json`, `layout-results.json`, `*-epubcheck.json`: bukti mentah.
- Baseline tetap di folder tetangga `stress-lab-before`; EPUB terbaru tidak diedit.
- `docs/app-review-2026-10.md`: pro/kontra aplikasi pembanding dan prioritas produk.

## Identitas hasil

'''
text+=f'- Aplikasi yang dilayani browser: SHA-256 `{app_hash}`\n'
for q in quality:text+=f"- `{q['key']}.epub`: SHA-256 `{q['sha256']}`\n"
log=ROOT/'tmp/pdfs/stress-lab/regression-review-final.log'
if log.exists() and 'all suites passed' in log.read_text(encoding='utf8',errors='replace'):
 text+=f"- Regression runner: seluruh {len(list((ROOT/'tests').glob('*.test.js')))} suite lolos.\n"
(OUT/'Laporan-stress-test.md').write_text(text,encoding='utf8')
with (OUT/'ringkasan-per-halaman.csv').open('w',encoding='utf-8-sig',newline='') as f:
 fields=['run','page','variant','case','markersRetained','markersExpected','markerOrder','columnOrder','normalizedWordEdits','referenceWords','normalizedWerPercent','failedPhrases']
 writer=csv.DictWriter(f,fieldnames=fields);writer.writeheader()
 for p in pages:writer.writerow({**{k:p[k] for k in fields if k in p},'failedPhrases':' | '.join(c['phrase'] for c in p['checks'] if not c['passed'])})
with ZipFile(OUT/'Paket-uji-ReadMaker.zip','w',ZIP_DEFLATED) as z:
 for p in (ROOT/'output/pdf/stress-lab').iterdir():
  if p.is_file():z.write(p,'pdf/'+p.name)
 for p in OUT.iterdir():
  if p.is_file() and p.suffix in ['.epub','.json','.md','.html','.csv','.log']:z.write(p,'hasil/'+p.name)
 z.write(ROOT/'docs/app-review-2026-10.md','Penelaahan-app.md')
print('Current report and bundle regenerated; remaining quality failures retained.')
