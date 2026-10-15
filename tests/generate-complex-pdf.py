"""Create original, deterministic PDF conversion fixtures (no book excerpts).
Run with Python containing reportlab, pypdf and Pillow; pdftoppm must be on PATH.
"""
from pathlib import Path
from io import BytesIO
from html import escape
import json, subprocess, os
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader
from PIL import Image, ImageFilter, ImageOps, ImageDraw
from pypdf import PdfReader, PdfWriter

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'output/pdf/stress-lab'; OUT.mkdir(parents=True,exist_ok=True)
TMP=ROOT/'tmp/pdfs/stress-lab'; TMP.mkdir(parents=True,exist_ok=True)
fonts=Path(os.environ.get('READMAKER_TEST_FONTS','C:/Windows/Fonts'))
for name,file in [('Body','arial.ttf'),('Bold','arialbd.ttf'),('Italic','ariali.ttf'),('Display','segoepr.ttf')]:
 path=fonts/file
 if not path.exists():path=fonts/'arial.ttf'
 pdfmetrics.registerFont(TTFont(name,str(path)))
W,H=432,648
manifest={'description':'Original synthetic test data inspired by the layout failure modes in HELLO and Sore; no book text copied.','documents':[]}
art=Image.new('RGB',(600,360),'#e9eff3'); draw=ImageDraw.Draw(art)
for x in range(30,600,70):draw.line((x,330,x,30),fill='#53636b',width=3)
draw.ellipse((190,30,400,240),outline='#143f52',width=8);draw.polygon([(80,300),(260,100),(540,300)],fill='#809ca6')
art.save(TMP/'illustration.png')

def wrap(text,width,size=10,font='Body'):
 lines=[];line=''
 for word in text.split():
  trial=(line+' '+word).strip()
  if line and pdfmetrics.stringWidth(trial,font,size)>width:lines.append(line);line=word
  else:line=trial
 if line:lines.append(line)
 return lines

def text(c,value,x,y,width,size=10,font='Body',leading=None,center=False,color=0):
 c.setFont(font,size);c.setFillGray(color)
 for line in wrap(value,width,size,font):
  if center:c.drawCentredString(x+width/2,y,line)
  else:c.drawString(x,y,line)
  y-=leading or size*1.5
 return y

def base(c,n,title,w,h):
 c.setFillGray(0);c.setFont('Body',7);c.drawString(36,h-24,'READMAKER LAB - DOKUMEN UJI SINTETIS')
 c.drawRightString(w-36,20,str(n));c.setStrokeGray(.7);c.line(36,h-30,w-36,h-30)
 return text(c,title,36,h-65,w-72,15,'Bold')-12

names=['Narasi dan dialog','Sinopsis rata tengah','Dua kolom','Tabel angka','Judul dan drop cap','Ilustrasi di antara teks','Catatan kaki dan nomor','Halaman lanskap','Aksen, tanda baca dan kode','Teks putih di latar gelap','Kredit dua kolom dan cetakan kecil','Halaman dengan sedikit teks']
pages=[];master=canvas.Canvas(str(TMP/'master.pdf'),pagesize=(W,H))
for variant in ['digital','scan-clean','scan-degraded','scan-skew']:
 for case in range(1,13):
  n=len(pages)+1;w,h=(648,432) if case==8 else (W,H);master.setPageSize((w,h))
  markers=[f'RM{n:04}{suffix}' for suffix in 'ABC'];blocks=[];checks=[]
  y=base(master,n,f'Bab {n}: {names[case-1]}',w,h)
  y=text(master,markers[0],36,y,w-72,11,'Bold')-14
  def paragraph(value,x=36,width=None,size=10,font='Body',center=False):
   global y
   blocks.append(value);y=text(master,value,x,y,width or w-72,size,font,center=center)-12
  if case==1:
   paragraph('Jana membuka arsip di dermaga tua. Ia memastikan setiap nama, tanggal, dan jumlah barang tetap terbaca setelah berkas dipindahkan ke alat baca kecil. Cerita ini dibuat khusus untuk menguji perubahan format.')
   paragraph(markers[1]+' “Apakah catatannya lengkap?” tanya Bima. “Lengkap, termasuk angka 5 dan angka 17 di dalam kalimat,” jawab Jana.')
   # Deliberately wrapped reduplication, equivalent to the HELLO regression.
   y=text(master,'Tukang-',36,y,w-72);y=text(master,'tukangnya bekerja bersama orang-',36,y,w-72);y=text(master,'orang di halaman.',36,y,w-72)-12
   blocks.append('Tukang-tukangnya bekerja bersama orang-orang di halaman.');checks+=['Tukang-tukangnya','orang-orang']
  elif case==2:
   paragraph('“Besok kita kembali?”',center=True);paragraph('“Ya, setelah semua catatan selesai.”',center=True)
   paragraph(markers[1]+' Jana menemukan satu lembar sinopsis. Baris-barisnya rata tengah, tetapi kalimat panjangnya tetap satu paragraf hingga baris paling pendek.',center=True)
   master.setFillGray(.65);master.setFont('Body',8);master.drawString(w-15,y+25,'5');master.drawString(w-15,y+8,'ar')
   paragraph('Kata terakhir berada tepat di tengah. Tidak ada alasan untuk memecahnya menjadi paragraf baru hanya karena posisi awalnya bergeser.',center=True)
   checks+=['paragraf hingga baris paling pendek','posisi awalnya bergeser']
  elif case==3:
   top=y; left=[];right=[]
   for i in range(1,9):
    left.append(f'KIRI{i:02} Jana memeriksa rak nomor {i}.')
    right.append(f'KANAN{i:02} Bima mencatat paket nomor {i}.')
   yy=top
   for line in left:yy=text(master,line,36,yy,166,9)-10
   yy=text(master,markers[1],36,yy,166,10)-12
   yr=top
   for line in right:yr=text(master,line,230,yr,166,9)-10
   blocks+=left+[markers[1]]+right;y=min(yy,yr)-16
   checks+=['KIRI08 Jana memeriksa rak nomor 8','KANAN01 Bima mencatat paket nomor 1']
  elif case==4:
   paragraph(markers[1]+' Nilai dalam tabel harus tetap berhubungan dengan nama barangnya.')
   cells=[['Barang','Jumlah','Harga'],['Kertas','17','Rp12.500'],['Pena','25','Rp8.750'],['Map','5','Rp3.250'],['Buku','31','Rp42.000'],['Kotak','9','Rp15.750']]
   for row in cells:
    master.setStrokeGray(.4);master.rect(36,y-8,w-72,26)
    for value,x in zip(row,[44,205,285]):text(master,value,x,y,110,10)
    blocks.append(' '.join(row));y-=26
   checks+=['Kertas 17 Rp12.500','Kotak 9 Rp15.750']
  elif case==5:
   y=text(master,'Catatan dari Laut',36,y,w-72,20,'Display')-20;blocks.append('Catatan dari Laut')
   master.setFont('Bold',42);master.setFillGray(0);master.drawString(36,y-25,'J')
   value='ana menerima sebuah surat yang harus dibaca mulai dari huruf pertama. Huruf awal berukuran besar tidak boleh menjadi judul bab baru.'
   y=text(master,value,66,y,w-102,10)-12;blocks.append('J'+value)
   paragraph(markers[1]+' Setelah surat selesai, ia menutup map lalu berjalan ke jendela.')
   checks+=['Jana menerima sebuah surat']
  elif case==6:
   paragraph(markers[1]+' Gambar berikut memperlihatkan penanda pelabuhan. Teks sebelum dan sesudahnya harus tetap ada.')
   master.drawImage(str(TMP/'illustration.png'),36,y-180,width=w-72,height=180);y-=198
   paragraph('Gambar 1. Menara, atap gudang, dan jalur dermaga.');paragraph('Sesudah gambar, Jana memeriksa kesesuaian arah perjalanan dengan catatan di buku.')
   checks+=['Sesudah gambar Jana memeriksa']
  elif case==7:
   paragraph(markers[1]+' Pada percobaan kelima, tersisa 5 kotak. Angka 17 adalah jumlah salinan, bukan nomor halaman.')
   paragraph('Jana memberi tanda [1] untuk keterangan ukuran. Penjelasan itu tetap bagian dari dokumen walau hurufnya lebih kecil.')
   master.line(36,150,160,150);text(master,'[1] Ukuran 13 x 19 cm; berat 250 gram. Nilai ini adalah data uji.',36,134,w-72,7)
   blocks.append('[1] Ukuran 13 x 19 cm; berat 250 gram. Nilai ini adalah data uji.');checks+=['tersisa 5 kotak','jumlah salinan bukan nomor halaman'];y=min(y,100)
  elif case==8:
   paragraph(markers[1]+' Halaman lanskap menyajikan hubungan antarruang. Perangkat kecil perlu menyesuaikan tampilan tanpa memotong kalimat di sisi kanan.')
   for i in range(3):
    master.setStrokeGray(.2);master.rect(40+i*195,y-75,170,70);text(master,['Penerimaan','Pemeriksaan','Pengiriman'][i],50+i*195,y-35,150,11,'Bold')
   blocks+=['Penerimaan Pemeriksaan Pengiriman'];y-=105
   checks+=['tanpa memotong kalimat di sisi kanan']
  elif case==9:
   paragraph(markers[1]+' Bima menulis café, naïve, résumé, dan façade. Ia membandingkan “kutip melengkung” dengan kata beraksen tanpa mengubah ejaan.')
   paragraph('Kode arsip: O0I1l-2026. Nomor telepon uji: +62 812 0000 1234. Tanggal: 15/10/2026. Suhu: 23,5 derajat.')
   checks+=['café naïve résumé','O0I1l-2026','23,5']
  elif case==10:
   master.setFillGray(.12);master.rect(30,y-190,w-60,190,fill=1,stroke=0)
   value=markers[1]+' Tulisan putih pada panel gelap memerlukan pembacaan yang benar. Warna latar tidak boleh menyebabkan teks menghilang dari hasil konversi.'
   text(master,value,44,y-26,w-88,11,color=1);blocks.append(value);y-=215
   paragraph('Panel berakhir di sini. Bagian berikut kembali memakai teks hitam di atas kertas putih.')
   checks+=['Tulisan putih pada panel gelap']
  elif case==11:
   left=['Penulis: Tim Uji ReadMaker','Ide Cerita: Data Sintetis','Penyunting: Jana Pramesti','Hak cipta: materi simulasi','ISBN uji: 000-000-000-000-0']
   right=['Pemasaran: Laboratorium','Alamat: Jalan Contoh No. 57','Jakarta 12630','Email: uji@example.invalid','www.example.invalid/arsip']
   for lines,x in [(left,36),(right,232)]:
    yy=y
    for line in lines:yy=text(master,line,x,yy,165,7.5)-10
   blocks+=left+right;y=yy-20;paragraph(markers[1]+' Cetakan pertama, 2026. Nama dan alamat harus tetap berada pada kolom masing-masing.')
   checks+=['Ide Cerita Data Sintetis','uji@example.invalid']
  else:
   paragraph('Jana kembali ke dermaga.');paragraph(markers[1]+' Ada 5 kotak.');checks+=['Ada 5 kotak']
  paragraph(markers[2],size=11,font='Bold')
  master.showPage()
  expected=' '.join([f'Bab {n} {names[case-1]}',markers[0]]+blocks)
  pages.append(dict(page=n,case=case,caseName=names[case-1],variant=variant,width=w,height=h,markers=markers,checks=checks,expectedText=expected))
master.save()
subprocess.run(['pdftoppm','-f','13','-l','48','-r','180','-gray','-png',str(TMP/'master.pdf'),str(TMP/'render')],check=True)
source=PdfReader(TMP/'master.pdf'); writer=PdfWriter()
for item in pages:
 n=item['page'];w,h=item['width'],item['height']
 if item['variant']=='digital':writer.add_page(source.pages[n-1])
 else:
  im=Image.open(TMP/f'render-{n:02}.png').convert('L')
  if item['variant']=='scan-degraded':
   im=im.resize((int(w*125/72),int(h*125/72)),Image.Resampling.LANCZOS)
   im=ImageOps.autocontrast(im).point(lambda p:150+int(p*.38)).filter(ImageFilter.GaussianBlur(.35))
   buf=BytesIO();im.save(buf,'JPEG',quality=50);buf.seek(0);im=Image.open(buf).copy()
  if item['variant']=='scan-skew':im=im.rotate(2.2,Image.Resampling.BICUBIC,expand=False,fillcolor=255)
  image_file=TMP/f'page-{n:03}.png';im.save(image_file)
  b=BytesIO();c=canvas.Canvas(b,pagesize=(w,h));c.drawImage(ImageReader(im),0,0,width=w,height=h);c.showPage();c.save();b.seek(0)
  writer.add_page(PdfReader(b).pages[0])
 writer.add_outline_item(f'{item["variant"]}: {item["caseName"]}',n-1)
writer.add_metadata({'/Title':'ReadMaker Complex Layout Lab','/Author':'ReadMaker QA - synthetic data'})
complex_path=OUT/'ReadMaker-Complex-48.pdf'
with complex_path.open('wb') as f:writer.write(f)
manifest['documents'].append(dict(key='complex',file=str(complex_path),pages=pages,expectedPages=48))
# More pages and more original prose than the two reference books combined.
volume=OUT/'ReadMaker-Volume-1200.pdf';c=canvas.Canvas(str(volume),pagesize=(W,H));vpages=[]
for n in range(1,1201):
 y=base(c,n,f'Catatan {n:04}',W,H);marks=[f'VL{n:04}{s}' for s in 'ABC'];blocks=[]
 for j,mark in enumerate(marks):
  value=f'{mark} Pada halaman {n}, Jana mencatat pengiriman nomor {n*3+j}. Setiap paket memiliki nama, tanggal, dan tujuan yang berbeda. Bima memeriksa daftar itu dengan teliti agar tidak ada barang tertinggal. Ketika matahari mulai turun, mereka menutup gudang dan menyimpan salinan catatan di tempat aman. Berkas ini dibuat untuk simulasi konversi dokumen panjang.'
  blocks.append(value);y=text(c,value,36,y,W-72,10)-14
 if n%20==1:c.bookmarkPage(f'v{n}');c.addOutlineEntry(f'Bagian {(n-1)//20+1}',f'v{n}')
 vpages.append(dict(page=n,markers=marks,expectedText=' '.join(blocks),variant='digital'))
 c.showPage()
c.setTitle('ReadMaker Volume 1200');c.setAuthor('ReadMaker QA - synthetic data');c.save()
manifest['documents'].append(dict(key='volume',file=str(volume),pages=vpages,expectedPages=1200))
(OUT/'ground-truth.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf8')
html='<!doctype html><html lang="id"><meta charset="utf-8"><title>ReadMaker Complex Semantic Reference</title><body>'
for item in pages:
 html+=f'<h1>{escape(item["variant"]+": "+item["caseName"])}</h1><p>{escape(item["expectedText"])}</p>'
html+='</body></html>'
(OUT/'ReadMaker-Complex-acuan.html').write_text(html,encoding='utf8')
print(json.dumps(dict(documents=[dict(key=d['key'],pages=d['expectedPages'],bytes=Path(d['file']).stat().st_size) for d in manifest['documents']]),indent=2))
