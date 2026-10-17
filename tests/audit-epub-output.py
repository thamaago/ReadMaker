"""Independent package/resource audit; EPUBCheck and accessibility remain separate.

Requires Pillow for strict image integrity and decode checks. Does not edit EPUBs.
Run with --phase baseline/final to preserve both sets of evidence.
CSS URL/import scanning is conservative, not a complete CSS parser (escaped URLs
require separate review). EPUBCheck remains the structural validation authority.
"""
from pathlib import Path
from datetime import date
from zipfile import ZipFile, ZIP_STORED
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urlsplit, unquote
from xml.etree import ElementTree as ET
from PIL import Image
import argparse, hashlib, io, json, posixpath, re, struct, subprocess

ROOT=Path(__file__).resolve().parents[1]
NS={'o':'http://www.idpf.org/2007/opf','h':'http://www.w3.org/1999/xhtml','dc':'http://purl.org/dc/elements/1.1/','n':'http://www.daisy.org/z3986/2005/ncx/'}
EPUB='http://www.idpf.org/2007/ops'
XML='http://www.w3.org/XML/1998/namespace'

def sha(data):return hashlib.sha256(data).hexdigest()
def css_references(text):
    text=re.sub(r'/\*.*?\*/','',text,flags=re.S)
    refs=[match.group(2).strip() for match in re.finditer(r'url\(\s*([\'"]?)(.*?)\1\s*\)',text,re.I|re.S)]
    refs.extend(match.group(2) for match in re.finditer(r'@import\s+([\'"])(.*?)\1',text,re.I|re.S))
    return refs

def audit_failed(results):
    return not results or any(r.get('errors') or r.get('epubcheck',{}).get('exitCode',0)!=0 for r in results)

def audit(file,group):
    data=file.read_bytes()
    r={'file':file.relative_to(ROOT).as_posix(),'group':group,'bytes':len(data),'sha256':sha(data),'errors':[],'reviewNotes':[],'images':[],'documents':[],'externalResources':[],'externalLinks':[]}
    def error(kind,detail):r['errors'].append({'kind':kind,'detail':detail})
    def note(kind,detail):r['reviewNotes'].append({'kind':kind,'detail':detail})
    try:
      with ZipFile(io.BytesIO(data)) as z:
        entries=z.infolist();names=set(z.namelist());bad=z.testzip()
        if bad:error('zip-crc',bad)
        for name,count in Counter(z.namelist()).items():
          if count>1:error('duplicate-zip-path',name)
          if name.startswith('/') or '\\' in name or '..' in name.split('/'):error('unsafe-zip-path',name)
        if any(e.flag_bits&1 for e in entries):error('encrypted-zip','Password-encrypted archive entry')
        first=min(entries,key=lambda item:item.header_offset)
        header=struct.unpack_from('<4s5H3I2H',data,first.header_offset)
        filename=data[first.header_offset+30:first.header_offset+30+header[-2]]
        r['ocfMimetypeFirstStoredNoExtra']=(first.header_offset==0 and filename==b'mimetype' and first.compress_type==ZIP_STORED and header[-1]==0 and z.read('mimetype')==b'application/epub+zip')
        if not r['ocfMimetypeFirstStoredNoExtra']:error('ocf-mimetype','First local entry must be exact, uncompressed mimetype without extra field')
        container=ET.fromstring(z.read('META-INF/container.xml'))
        opfpath=next(node.attrib['full-path'] for node in container.iter() if node.tag.endswith('rootfile'))
        opf=ET.fromstring(z.read(opfpath));base=posixpath.dirname(opfpath)
        r['packageVersion']=opf.get('version');r['packagePath']=opfpath
        metadata=opf.find('o:metadata',NS)
        def meta(tag):return [''.join(node.itertext()).strip() for node in metadata.findall('dc:'+tag,NS)]
        r['metadata']={tag:meta(tag) for tag in ['title','identifier','language','creator']}
        for key in ['title','identifier','language']:
          if not any(r['metadata'][key]):error('required-metadata',key)
        identifiers={node.get('id'):''.join(node.itertext()).strip() for node in metadata.findall('dc:identifier',NS)}
        if opf.get('unique-identifier') not in identifiers:error('identifier-reference',str(opf.get('unique-identifier')))
        modified=[node.text for node in metadata.findall('o:meta',NS) if node.get('property')=='dcterms:modified']
        if len(modified)!=1 or not re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z',modified[0] or ''):error('modified-date',str(modified))
        properties={node.get('property'):node.text for node in metadata.findall('o:meta',NS)}
        r['accessibilityMetadata']={key:value for key,value in properties.items() if key and ('access' in key.casefold() or key=='dcterms:conformsTo')}
        if not r['accessibilityMetadata']:note('accessibility-discoverability','No accessibility metadata; no EPUB Accessibility conformance inferred')
        items=opf.findall('o:manifest/o:item',NS);ids=[node.get('id') for node in items]
        if len(ids)!=len(set(ids)):error('manifest-id','Duplicate item IDs')
        manifest={node.get('id'):node for node in items}
        def path_of(href):return posixpath.normpath(posixpath.join(base,unquote(urlsplit(href).path)))
        local_items={}
        for item in items:
          href=item.get('href','')
          if urlsplit(href).scheme:r['externalResources'].append({'from':opfpath,'url':href});continue
          name=path_of(href)
          if name not in names:error('missing-manifest-resource',name)
          local_items[name]=item
        documents={}
        for name in sorted(names):
          if name.endswith(('.xhtml','.html','.xml','.opf','.ncx','.svg')):
            try:documents[name]=ET.fromstring(z.read(name))
            except ET.ParseError as exc:error('xml',name+': '+str(exc))
        idsets={}
        for name,doc in documents.items():
          values=[node.get('id') or node.get('{'+XML+'}id') for node in doc.iter() if node.get('id') or node.get('{'+XML+'}id')]
          idsets[name]=set(values)
          if len(values)!=len(set(values)):error('duplicate-document-id',name)
        refs=0;empty_alt=0;missing_alt=0;image_refs=0
        for name,doc in documents.items():
          for node in doc.iter():
            local=node.tag.rsplit('}',1)[-1]
            if local=='img':
              image_refs+=1
              if node.get('alt') is None:missing_alt+=1
              elif not node.get('alt').strip():empty_alt+=1
            if local in ['script','iframe','object','embed']:error('active-content',name+': '+local)
            for attr,value in node.attrib.items():
              if attr.lower().startswith('on'):error('event-handler',name+': '+attr)
              if attr not in ['src','href','{http://www.w3.org/1999/xlink}href']:continue
              parsed=urlsplit(value)
              if parsed.scheme or parsed.netloc:
                field='externalLinks' if local=='a' and attr=='href' else 'externalResources'
                if parsed.scheme!='data':r[field].append({'from':name,'url':value})
                continue
              target=posixpath.normpath(posixpath.join(posixpath.dirname(name),unquote(parsed.path))) if parsed.path else name
              refs+=1
              if target not in names:error('broken-local-reference',name+' -> '+value)
              elif parsed.fragment and unquote(parsed.fragment) not in idsets.get(target,set()):error('broken-fragment',name+' -> '+value)
        css_sources=[(name,z.read(name).decode('utf8',errors='replace')) for name in names if name.lower().endswith('.css')]
        for name,doc in documents.items():
          for node in doc.iter():
            if node.tag.rsplit('}',1)[-1]=='style':css_sources.append((name,''.join(node.itertext())))
            if node.get('style'):css_sources.append((name,node.get('style')))
        for name,css in css_sources:
          if '\\' in css:note('css-syntax-review',name+': CSS escapes require review beyond the conservative URL scanner')
          for value in css_references(css):
            parsed=urlsplit(value)
            if parsed.scheme or parsed.netloc:
              if parsed.scheme!='data':r['externalResources'].append({'from':name,'url':value,'context':'css'})
              continue
            target=posixpath.normpath(posixpath.join(posixpath.dirname(name),unquote(parsed.path))) if parsed.path else name
            refs+=1
            if target not in names:error('broken-css-reference',name+' -> '+value)
            elif parsed.fragment and unquote(parsed.fragment) not in idsets.get(target,set()):error('broken-fragment',name+' -> '+value)
        r['resourceReferenceCoverage']='XML src/href/xlink:href and conservative CSS url/@import; not a full CSS parser or srcset parser'
        r['localReferencesChecked']=refs;r['imageReferences']=image_refs;r['emptyImageAlt']=empty_alt;r['missingImageAlt']=missing_alt
        if empty_alt or missing_alt:note('image-alternatives',f'{empty_alt} empty alt, {missing_alt} absent alt; decorative vs meaningful requires human review')
        for name,item in local_items.items():
          if not item.get('media-type','').startswith('image/') or name not in names:continue
          entry={'path':name,'declaredMime':item.get('media-type'),'sha256':sha(z.read(name)),'integrity':'not-tested','decode':'not-tested'}
          if item.get('media-type')=='image/svg+xml':r['images'].append(entry);continue
          image_bytes=z.read(name)
          try:
            image=Image.open(io.BytesIO(image_bytes));entry.update(format=image.format,width=image.width,height=image.height,mode=image.mode)
            detected=Image.MIME.get(image.format)
            if detected and detected!=item.get('media-type'):error('image-mime-mismatch',name+': '+str(detected)+' vs '+item.get('media-type'))
            try:image.verify();entry['integrity']='pass'
            except Exception as exc:entry['integrity']='fail';entry['integrityError']=str(exc);error('image-integrity',name+': '+str(exc))
            image=Image.open(io.BytesIO(image_bytes));image.load();entry['decode']='pass'
            if image.width<8 or image.height<8:note('tiny-image-fixture',name+': dimensions do not represent readable book artwork')
          except Exception as exc:entry['decode']='fail';entry['decodeError']=str(exc);error('image-decode',name+': '+str(exc))
          r['images'].append(entry)
        spine=opf.find('o:spine',NS);spine_paths=[];r['pageProgressionDirection']=spine.get('page-progression-direction')
        for ref in spine.findall('o:itemref',NS):
          item=manifest.get(ref.get('idref'))
          if item is None:error('spine-idref',str(ref.get('idref')));continue
          spine_paths.append(path_of(item.get('href','')))
        r['spineItems']=len(spine_paths);r['readingOrder']=spine_paths
        raster_only=0;heading_marker=0;replacement_chars=0;languages_missing=[]
        for name in spine_paths:
          doc=documents.get(name)
          if doc is None:continue
          body=doc.find('h:body',NS);body=body if body is not None else doc
          text=' '.join(body.itertext()).strip();images=body.findall('.//h:img',NS)
          if not text and images:raster_only+=1
          replacement_chars+=text.count('\ufffd')
          for node in body.iter():
            if re.fullmatch(r'h[1-6]',node.tag.rsplit('}',1)[-1]) and re.fullmatch(r'RM[O0Il\d]+[ABC]',(''.join(node.itertext())).strip(),re.I):heading_marker+=1
          lang=doc.get('lang') or doc.get('{'+XML+'}lang')
          if not lang:languages_missing.append(name)
          viewport=doc.find('h:head/h:meta[@name="viewport"]',NS)
          r['documents'].append({'path':name,'characters':len(text),'images':len(images),'lang':lang,'viewport':viewport.get('content') if viewport is not None else None})
        r['rasterOnlySpineItems']=raster_only;r['replacementCharacters']=replacement_chars;r['testMarkersUsedAsHeadings']=heading_marker;r['documentsWithoutLanguage']=languages_missing
        if languages_missing:note('document-language',str(len(languages_missing))+' spine documents lack lang/xml:lang')
        if raster_only:note('raster-pages',str(raster_only)+' image-only spine documents cannot reflow text or supply screen-reader text')
        if heading_marker:note('heading-heuristic',str(heading_marker)+' test markers promoted to headings')
        if replacement_chars:note('replacement-character',str(replacement_chars))
        navs=[item for item in items if 'nav' in item.get('properties','').split()]
        if len(navs)!=1:error('nav-manifest',str(len(navs)))
        nav_targets=[];nav_types=[]
        if navs:
          navpath=path_of(navs[0].get('href',''));navdoc=documents.get(navpath)
          if navdoc is not None:
            for nav in navdoc.findall('.//h:nav',NS):
              nav_types.extend(nav.get('{'+EPUB+'}type','').split())
              if 'toc' in nav.get('{'+EPUB+'}type','').split():nav_targets.extend(node.get('href') for node in nav.findall('.//h:a',NS))
        r['navigation']={'tocEntries':len(nav_targets),'types':nav_types,'ncxPresent':any(item.get('media-type')=='application/x-dtbncx+xml' for item in items)}
        if not nav_targets:error('empty-toc','No navigation entries')
        r['selfContainedResources']=not r['externalResources']
        if r['externalResources']:note('network-resources',str(len(r['externalResources']))+' external resource references')
    except Exception as exc:error('audit-exception',type(exc).__name__+': '+str(exc))
    return r

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--phase',default='baseline',choices=['baseline','final','security']);parser.add_argument('--skip-epubcheck',action='store_true');args=parser.parse_args()
    audit_date=date.today().isoformat()
    out=ROOT/('output/epub/standardization-'+audit_date)/args.phase;out.mkdir(parents=True,exist_ok=True)
    selected=[]
    for folder,group in [('output/epub/stress-lab','browser-corpus'),('output/epub/pdf-review','browser-correction'),('output/epub/web-resources','browser-article'),('output/epub/validation','gate-fixture'),('tests','unit-sample')]:
      selected.extend((file,group) for file in sorted((ROOT/folder).glob('*.epub')))
    if args.phase=='security':selected.extend((file,'browser-security') for file in sorted((ROOT/'output/security'/audit_date).glob('*.epub')))
    results=[audit(file,group) for file,group in selected]
    if not args.skip_epubcheck:
      jar=ROOT/'tmp/xteink-conversion/validator/epubcheck-5.4.0/epubcheck.jar'
      def check(entry):
        i,r=entry;report=out/(str(i+1).zfill(2)+'-'+Path(r['file']).stem+'-epubcheck.json')
        run=subprocess.run(['java','-jar',str(jar),str(ROOT/r['file']),'--failonwarnings','--json',str(report)],capture_output=True,text=True)
        report.with_suffix('.log').write_text(run.stdout+run.stderr,encoding='utf8')
        checker=json.loads(report.read_text(encoding='utf8'))['checker'] if report.exists() else {}
        r['epubcheck']={'version':'5.4.0','exitCode':run.returncode,**{k:checker.get(k) for k in ['nFatal','nError','nWarning']}}
      with ThreadPoolExecutor(max_workers=2) as pool:list(pool.map(check,enumerate(results)))
    identity={name:sha((ROOT/name).read_bytes()) for name in ['index.html','pdf-review.js','responsive.css','device-compatibility.js','jszip.min.js']}
    payload={'date':audit_date,'phase':args.phase,'sourceAssets':identity,'scope':'Representative local fixtures; not all user books or hardware certification','results':results}
    (out/'audit-results.json').write_text(json.dumps(payload,ensure_ascii=False,indent=2),encoding='utf8')
    print(json.dumps([{'file':r['file'],'errors':len(r['errors']),'images':len(r['images']),'integrityFailures':sum(im.get('integrity')=='fail' for im in r['images']),'decodeFailures':sum(im.get('decode')=='fail' for im in r['images']),'epubcheck':r.get('epubcheck')} for r in results],indent=2))
    return 1 if audit_failed(results) else 0

if __name__=='__main__':raise SystemExit(main())
