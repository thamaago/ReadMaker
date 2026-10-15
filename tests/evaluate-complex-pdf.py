"""Evaluate benchmark EPUBs against independently generated source truth."""
from pathlib import Path, PurePosixPath
from zipfile import ZipFile
from collections import defaultdict
from urllib.parse import unquote
from concurrent.futures import ThreadPoolExecutor
import json,re,unicodedata,posixpath,subprocess,hashlib
from xml.etree import ElementTree as E
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'output/epub/stress-lab'
truth=json.loads((ROOT/'output/pdf/stress-lab/ground-truth.json').read_text(encoding='utf8'))
X={'opf':'http://www.idpf.org/2007/opf','h':'http://www.w3.org/1999/xhtml'}
def norm(s):return re.sub(r'[\W_]+',' ',unicodedata.normalize('NFKC',s).casefold()).strip()
def edits(a,b):
 if a==b:return 0
 row=list(range(len(b)+1))
 for i,x in enumerate(a,1):
  new=[i]
  for j,y in enumerate(b,1):new.append(min(new[-1]+1,row[j]+1,row[j-1]+(x!=y)))
  row=new
 return row[-1]
def package(file):
 with ZipFile(file) as z:
  names=set(z.namelist());issues=[]
  if z.namelist()[0]!='mimetype' or z.read('mimetype')!=b'application/epub+zip' or z.getinfo('mimetype').compress_type!=0:issues.append('mimetype')
  container=E.fromstring(z.read('META-INF/container.xml'));opfpath=next(n.attrib['full-path'] for n in container.iter() if n.tag.endswith('rootfile'))
  opf=E.fromstring(z.read(opfpath));items={n.attrib['id']:n.attrib for n in opf.findall('opf:manifest/opf:item',X)}
  chapters=[]
  for ref in opf.findall('opf:spine/opf:itemref',X):
   item=items[ref.attrib['idref']];name=posixpath.normpath(posixpath.join(posixpath.dirname(opfpath),item['href']));doc=E.fromstring(z.read(name))
   body=doc.find('h:body',X);h=doc.find('.//h:h1',X);title=doc.find('h:head/h:title',X)
   chapters.append(dict(name=name,title=''.join((h if h is not None else title).itertext()),text=' '.join(body.itertext()),images=len(body.findall('.//h:img',X)),bytes=len(z.read(name))))
  for name in names:
   if name.endswith(('.xml','.opf','.ncx','.xhtml')):
    doc=E.fromstring(z.read(name))
    for node in doc.iter():
     for attr in ['src','href']:
      value=node.get(attr)
      if value and ':' not in value and value.split('#')[0]:
       resolved=posixpath.normpath(posixpath.join(posixpath.dirname(name),unquote(value.split('#')[0])))
       if resolved not in names:issues.append(name+' -> '+value)
  return dict(chapters=chapters,text=' '.join(c['text'] for c in chapters),images=sum(i.get('media-type','').startswith('image/') for i in items.values()),structuralIssues=issues,largestXhtml=max(c['bytes'] for c in chapters))
results=[];page_rows=[]
for key in ['complex-reflow','complex-layout','volume-reflow','semantic-reference']:
 file=OUT/(key+'.epub')
 if not file.exists():results.append(dict(key=key,failed='no EPUB'));continue
 p=package(file);source=next(d for d in truth['documents'] if d['key']==('volume' if key=='volume-reflow' else 'complex'))
 text=norm(p['text']);allmarks=[m for page in source['pages'] for m in page['markers']]
 vocabulary=set(text.split());found=[m for m in allmarks if norm(m) in vocabulary]
 phrases=passed=ordered=eligible=word_edits=reference_words=0;columns=[]
 marker_starts={m:text.find(norm(m)) for m in allmarks}
 if key!='complex-layout':
  for page_index,page in enumerate(source['pages']):
   local=text
   if key=='volume-reflow':
    start=marker_starts[page['markers'][0]]
    end=marker_starts[source['pages'][page_index+1]['markers'][0]] if page_index+1<len(source['pages']) else len(text)
    local=text[start:end] if start>=0 and end>start else ''
    local=re.sub(r'\bcatatan \d{4}\b|\bbagian \d+\b',' ',local)
   elif len(p['chapters'])==source['expectedPages']:
    local=norm(p['chapters'][page_index]['text'])
    if key=='semantic-reference':local=local.removeprefix(norm(page['variant']+': '+page['caseName'])).strip()
   local=local.replace(norm('READMAKER LAB - DOKUMEN UJI SINTETIS'),' ').strip()
   expected=norm(page['expectedText']).split();actual=local.split();distance=edits(expected,actual)
   word_edits+=distance;reference_words+=len(expected)
   marks=page['markers'];positions=[text.find(norm(m)) for m in marks];retained=sum(pos>=0 for pos in positions)
   order=retained==3 and positions==sorted(positions)
   checks=[dict(phrase=phrase,passed=norm(phrase) in local) for phrase in page.get('checks',[])]
   phrases+=len(checks);passed+=sum(c['passed'] for c in checks)
   if retained==3:eligible+=1;ordered+=order
   column_order=None
   if page.get('case') in [3,11]:
    left,right=('KIRI08','KANAN01') if page['case']==3 else ('ISBN uji','Pemasaran Laboratorium')
    labels=re.sub(r'\b(kiri|kanan)([0-9oils]{2})\b',lambda m:m[1]+m[2].translate(str.maketrans('oils','0115')),local)
    a,b=labels.find(norm(left)),labels.find(norm(right));column_order=a>=0 and b>=0 and a<b
    columns.append(dict(page=page['page'],variant=page['variant'],case=page['caseName'],passed=column_order,reason='correct' if column_order else ('wrong-order' if a>=0 and b>=0 else 'label-not-recovered')))
   page_rows.append(dict(run=key,page=page['page'],variant=page['variant'],case=page.get('caseName','volume'),markersRetained=retained,markersExpected=3,markerOrder=order,columnOrder=column_order,normalizedWordEdits=distance,referenceWords=len(expected),normalizedWerPercent=round(100*distance/max(1,len(expected)),2),checks=checks))
 r=dict(key=key,bytes=file.stat().st_size,sourcePages=source['expectedPages'],spineItems=len(p['chapters']),images=p['images'],structuralIssues=p['structuralIssues'],largestXhtml=p['largestXhtml'],sha256=hashlib.sha256(file.read_bytes()).hexdigest())
 if key=='complex-reflow':
  r['illustrationChecks']=[dict(page=n,preserved=p['chapters'][n-1]['images']>0) for n in [6,18,30,42]]
  r['unexpectedIllustrationPages']=[i+1 for i,c in enumerate(p['chapters']) if c['images'] and i+1 not in [6,18,30,42]]
  r['runningHeaderOccurrences']=p['text'].count('READMAKER LAB - DOKUMEN UJI SINTETIS')
 if key=='complex-layout':r.update(markersRetained=None,visualOnly=True,allPageImagesPresent=p['images']==48 and sum(c['images'] for c in p['chapters'])==48)
 else:r.update(markersRetained=len(found),markersExpected=len(allmarks),missingMarkers=[m for m in allmarks if m not in found],phraseChecksPassed=passed,phraseChecksExpected=phrases,orderedPages=ordered,orderEligiblePages=eligible,columnChecks=columns,normalizedWordEdits=word_edits,referenceWords=reference_words,normalizedWerPercent=round(100*word_edits/max(1,reference_words),2))
 results.append(r)
jar=ROOT/'tmp/xteink-conversion/validator/epubcheck-5.4.0/epubcheck.jar'
def validate(r):
 if 'failed' in r:return
 output=OUT/(r['key']+'-epubcheck.json')
 run=subprocess.run(['java','-jar',str(jar),str(OUT/(r['key']+'.epub')),'--json',str(output)],capture_output=True,text=True)
 (OUT/(r['key']+'-epubcheck.log')).write_text(run.stdout+run.stderr,encoding='utf8')
 if output.exists():
  ck=json.loads(output.read_text(encoding='utf8'))['checker'];r['epubcheck']={k:ck[k] for k in ['nFatal','nError','nWarning']}
 else:r['epubcheck']=dict(failed=run.returncode)
with ThreadPoolExecutor(max_workers=2) as pool:list(pool.map(validate,results))
(OUT/'quality-results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf8')
(OUT/'page-checks.json').write_text(json.dumps(page_rows,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps([{k:v for k,v in r.items() if k not in ['missingMarkers','columnChecks','sha256']} for r in results],ensure_ascii=True,indent=2))
