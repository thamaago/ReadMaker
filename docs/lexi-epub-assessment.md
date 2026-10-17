# Penilaian independen EPUB oleh Lexi

Tanggal inspeksi: **17 Oktober 2026**, Asia/Jakarta. Lexi adalah agen penilai
dalam sesi ini, bukan lembaga sertifikasi EPUB atau penguji perangkat eksternal.
Penilaian memisahkan kelayakan paket, ketepatan isi, rendering, aksesibilitas,
dan kompatibilitas perangkat.

## Kesimpulan

**Paket EPUB representatif layak diteruskan ke uji baca, tetapi kualitas isi OCR,
aksesibilitas, dan dukungan perangkat fisik belum boleh dinyatakan sempurna.**
Keberhasilan EPUBCheck membuktikan aturan yang diperiksa validator tersebut;
hasil itu tidak menjamin ejaan benar, gambar bermakna memiliki deskripsi, atau
firmware tertentu akan merender hasil dengan benar.

## Bukti dan keterkinian

Inspeksi independen membaca sembilan EPUB pada `output/epub/stress-lab`,
`output/epub/pdf-review`, dan `output/epub/validation`. Manifest, spine, judul
navigasi, XHTML, serta aset gambar diperiksa langsung dari ZIP. Seluruh gambar
dalam sembilan paket dapat didekode penuh dengan Pillow tanpa kegagalan.
Namun pemeriksaan integritas terpisah dengan `Image.verify()` menemukan CRC
chunk IDAT rusak pada PNG stub tiga fixture validation. Decoder yang toleran
dapat membaca gambar tersebut, sehingga keberhasilan decode tidak membuktikan
integritas gambar. CRC ini dikonfirmasi Lexi secara independen; kelima EPUB
korpus/browser tidak menunjukkan masalah integritas tersebut. Perbaikan fixture
dan pemeriksaan ulang ditangani agen utama dalam sesi ini.

Hash SHA-256 kelima aset aplikasi saat inspeksi cocok dengan catatan konversi
browser dan pengujian editor tanggal 16 Oktober. Karena itu artefak utama
merepresentasikan source yang tersedia saat audit; perubahan implementasi
setelah hash ini memerlukan generasi dan validasi ulang.

| Aset | SHA-256 |
| --- | --- |
| index.html | `5d13fab0293828a2aaf7d3315e6dc0c09fafc0f1a8c639ca9892b8c7002701b8` |
| pdf-review.js | `5ef63babfeeb59d9e4746d2e5d103f8561aec59905accd9bd9e756344280cfb7` |
| responsive.css | `cb0cf4cd702e8ae9c7c667a9bed8cd981604d60a014f08355de25bf458f049ec` |
| device-compatibility.js | `568b324b951ad1e12f6a92be803ec8e0346dd8eefee9459096db38f01e95d86f` |
| jszip.min.js | `acc7e41455a80765b5fd9c7ee1b8078a6d160bbbca455aeae854de65c947d59e` |

## Penilaian per keluaran

| EPUB | Navigasi / spine | Penilaian isi |
| --- | --- | --- |
| complex-reflow | 48 / 48 | Urutan dua kolom dan empat ilustrasi acuan dipertahankan; OCR tetap memerlukan proofreading. |
| complex-layout | 48 / 48 | Seluruh halaman berupa gambar. Mempertahankan tampilan sumber, tetapi teks tidak dapat mengikuti pembesaran font. |
| volume-reflow | 60 / 60 | Korpus digital repetitif mempertahankan 3.600 penanda dan urutan 1.200 halaman. Bukan bukti untuk scan besar. |
| semantic-reference | 48 / 48 | Seluruh 80 frasa dan 144 penanda acuan cocok pada korpus sintetis. Ini jalur HTML terstruktur, bukan OCR. |
| ReadMaker-X4-Pro-uji-koreksi | 48 / 48 | Koreksi teks masuk ke ekspor, tetapi paket juga memuat 37 gambar dari jalur PDF tanpa OCR. Tidak seluruh halaman menjadi teks reflow. |
| corrected-reflow | 1 / 1 | Fixture koreksi literal dengan emphasis dan aset dipertahankan. |
| rtl-reflow | 1 / 1 | Fixture paket RTL; belum menjadi bukti pembentukan huruf Arab pada panel CrossPoint. |
| fixed-pages | 1 / 1 | Fixture struktur halaman asli; gambar 1×1 hanya stub pengujian paket. |
| comic-pages | 2 / 2 | Fixture struktur dua halaman komik; gambar 1×1 tidak mewakili kualitas ilustrasi komik. |

Judul navigasi pada korpus utama unik dan jumlahnya selaras dengan spine.
Daftar isi berupa NAV EPUB 3 serta NCX untuk fallback. NCX tambahan tidak
mengubah paket OPF versi 3.0 menjadi publikasi EPUB 2 terpisah.

## Mutu isi dan keterbacaan

Korpus OCR kompleks mencatat **129 galat token dari 2.364 token acuan (5,46%)**,
**69/80 frasa**, serta **79/144 penanda persis**. Kapitalisasi dan tanda baca
dinormalisasi dalam metrik token, sehingga angka tersebut tidak mengukur semua
kesalahan tipografi. Kode acak memang sukar bagi OCR, tetapi itu juga menunjukkan
risiko nyata pada nomor identitas, tanggal, ISBN, dan kode produk.

Contoh hasil halaman 33: kata beraksen kehilangan aksen atau berubah huruf;
kode ambigu menjadi `O0111-2026`; tanggal menjadi `15/1012026`. Ini kegagalan
ketepatan isi, walaupun XHTML dan ZIP sah. Tidak ditemukan karakter pengganti
Unicode U+FFFD literal pada keempat EPUB korpus.

Inspeksi screenshot 480 piksel pada halaman 3, 6, 18, 29, dan 42 menunjukkan
teks yang terbaca, urutan kolom terjaga, serta ilustrasi dengan caption pada
posisi masuk akal. Catatan pengujian browser memuat 864 pemeriksaan tanpa
overflow atau kegagalan decode; ini pengujian geometri browser, bukan
pengukuran ketajaman panel e-ink atau akurasi gambar terhadap setiap sumber.

Masih terdapat **27 heading yang hanya berisi penanda uji** pada hasil OCR
kompleks. Screenshot halaman 18 dan 42 memperlihatkan marker tersebut menjadi
judul besar. Heuristik heading masih perlu disempurnakan dan tidak boleh
dianggap telah menghasilkan tipografi penerbitan yang bersih untuk semua PDF.

Tabel angka halaman 4 masih memiliki nama, jumlah, dan harga dalam urutan
bacaan, tetapi berupa paragraf, bukan tabel HTML semantik. Tabel yang lebih
rumit perlu pemeriksaan tersendiri sebelum dianggap mempertahankan hubungan
baris-kolom dengan andal.

## Aksesibilitas dasar

Temuan berikut tidak ditangkap hanya dengan menyatakan EPUBCheck lulus:

- `dc:language` tersedia dalam OPF, tetapi XHTML isi dan NAV belum memiliki
  `lang`/`xml:lang`. Bahasa perlu ditetapkan pada dokumen agar teknologi bantu
  dapat menentukan pelafalan secara andal.
- Empat ilustrasi pada reflow dan 48 halaman raster pada mode halaman asli
  memiliki `alt` kosong. Gambar bermakna dan halaman berisi teks tidak layak
  diperlakukan sebagai dekorasi tanpa alternatif yang memadai.
- Paket belum menyediakan metadata discoverability aksesibilitas seperti
  `schema:accessMode`, `schema:accessibilityFeature`, dan
  `schema:accessibilityHazard`, maupun ringkasan batas aksesibilitas.
- Belum tersedia landmarks, page-list, atau penanda pagebreak sumber untuk
  navigasi tingkat lanjut. Daftar isi bab sudah ada; jangan menyamakan
  ketiadaan fitur tambahan ini dengan rusaknya daftar isi.

Tidak ada dasar untuk mengklaim **EPUB Accessibility 1.1 atau WCAG AA** sudah
dipenuhi. W3C membedakan persyaratan aksesibilitas dan metadata dari keberhasilan
validasi format umum. Rujukan: [EPUB Accessibility 1.1](https://www.w3.org/TR/epub-a11y/)
dan [teknik aksesibilitas](https://www.w3.org/TR/epub-a11y-tech-11/).

## Batas CrossPoint X4 Pro dan tindak lanjut

Perangkat pengguna belum siap. Belum ada bukti transfer, pembukaan buku,
pagination, pergantian font, resume, RTL, ketajaman grayscale, atau konsumsi
memori pada firmware CrossPoint yang benar-benar dipakai pengguna. Preview
480 piksel dan nama file X4 Pro tidak menggantikan pengujian tersebut.

Prioritas perbaikan yang disarankan Lexi:

1. Nyatakan bahasa pada setiap XHTML dan NAV; berikan metadata aksesibilitas
   yang jujur tanpa mengarang sertifikasi atau deskripsi gambar.
2. Pertahankan peringatan OCR dan koreksi pengguna; prioritaskan kode, tanggal,
   aksen, heading palsu, serta tabel yang kehilangan semantik.
3. Gunakan diagram dan halaman komik nyata dalam uji visual tambahan;
   pertahankan stub 1×1 hanya sebagai fixture struktur.
4. Uji paket reflow dan raster pada X4 Pro setelah perangkat siap, lalu catat
   versi CrossPoint dan hasil yang benar-benar diamati.

Penerimaan Lexi bersifat **bersyarat untuk uji baca**, bukan pengesahan bahwa
seluruh PDF dapat dikonversi sempurna atau ReadMaker sudah mengungguli aplikasi
pembanding.

## Catatan tindak lanjut agen utama — 17 Oktober 2026

Bagian di atas merekam penilaian Lexi atas sembilan artefak awal. Review lanjutan
Lexi menggunakan profil kanonik lokal `agents/lexi/agent.md`, mode `publishing`,
menegaskan kelayakan bersyarat dan memprioritaskan integritas gambar, artikel
mandiri, OCR serta aksesibilitas. Regenerasi fixture dan hasil validasi akhir
oleh agen utama dicatat terpisah di
[audit standardisasi 17 berkas](epub-standardization-2026-10-17.md).
Angka akhir tersebut bukan klaim bahwa Lexi menguji perangkat fisik atau
meninjau independen setiap perubahan fixture.
