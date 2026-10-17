"""In-memory controls for the EPUB resource auditor; leaves book artifacts intact."""
import importlib.util
import io
import sys
from pathlib import Path
import unittest
from unittest.mock import patch
from zipfile import ZipFile, ZIP_STORED
from PIL import Image

sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('epub_audit',Path(__file__).with_name('audit-epub-output.py'))
auditor=importlib.util.module_from_spec(spec)
spec.loader.exec_module(auditor)


def package(image=None,mime='image/png',css='',body_style='',head_style=''):
    if image is None:
        output=io.BytesIO();Image.new('RGB',(24,16),'white').save(output,format='PNG');image=output.getvalue()
    output=io.BytesIO()
    with ZipFile(output,'w') as z:
        z.writestr('mimetype','application/epub+zip',compress_type=ZIP_STORED)
        z.writestr('META-INF/container.xml','<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf"/></rootfiles></container>')
        z.writestr('OEBPS/content.opf',f'''<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Auditor control</dc:title><dc:identifier id="book-id">urn:test:auditor</dc:identifier><dc:language>en</dc:language><meta property="dcterms:modified">2026-10-17T00:00:00Z</meta></metadata><manifest><item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="image" href="diagram.png" media-type="{mime}"/><item id="style" href="style.css" media-type="text/css"/></manifest><spine><itemref idref="chapter"/></spine></package>''')
        z.writestr('OEBPS/chapter.xhtml',f'''<html xmlns="http://www.w3.org/1999/xhtml" lang="en"><head><title>Control</title><style>{head_style}</style></head><body style="{body_style}"><h1>Chapter</h1><p>Readable text.</p><img src="diagram.png" alt="Control diagram"/></body></html>''')
        z.writestr('OEBPS/nav.xhtml','<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="en"><head><title>Contents</title></head><body><nav epub:type="toc"><ol><li><a href="chapter.xhtml">Chapter</a></li></ol></nav></body></html>')
        z.writestr('OEBPS/style.css',css)
        z.writestr('OEBPS/diagram.png',image)
    return output.getvalue()


def audit_bytes(data):
    with patch.object(Path,'read_bytes',return_value=data):
        return auditor.audit(auditor.ROOT/'virtual-control.epub','in-memory-control')


class AuditorControls(unittest.TestCase):
    def test_valid_self_contained_package(self):
        result=audit_bytes(package(css='/* url(https://ignored.invalid/image) */ body { color: black; }'))
        self.assertEqual(result['errors'],[])
        self.assertTrue(result['selfContainedResources'])
        self.assertEqual(result['images'][0]['integrity'],'pass')

    def test_corrupt_png_crc_is_rejected_even_if_decode_succeeds(self):
        output=io.BytesIO();Image.new('RGB',(24,16),'white').save(output,format='PNG')
        image=bytearray(output.getvalue());start=image.index(b'IDAT');length=int.from_bytes(image[start-4:start],'big');image[start+4+length]^=1
        result=audit_bytes(package(image=bytes(image)))
        self.assertIn('image-integrity',[e['kind'] for e in result['errors']])
        self.assertEqual(result['images'][0]['decode'],'pass')

    def test_png_declared_as_jpeg_is_rejected(self):
        result=audit_bytes(package(mime='image/jpeg'))
        self.assertIn('image-mime-mismatch',[e['kind'] for e in result['errors']])

    def test_external_css_references_are_not_self_contained(self):
        controls=[{'css':'body { background: url(https://example.invalid/panel.png); }'},
                  {'css':'@import "https://example.invalid/book.css";'},
                  {'body_style':"background: url('https://example.invalid/panel.png')"},
                  {'head_style':'body { background: url(//example.invalid/panel.png); }'}]
        for control in controls:
            with self.subTest(control=control):
                result=audit_bytes(package(**control))
                self.assertEqual(result['errors'],[])
                self.assertFalse(result['selfContainedResources'])
                self.assertEqual(len(result['externalResources']),1)

    def test_missing_css_local_resource_is_rejected(self):
        result=audit_bytes(package(css='body { background: url(missing.png); }'))
        self.assertIn('broken-css-reference',[e['kind'] for e in result['errors']])

    def test_exit_policy_reports_errors_and_validator_failures(self):
        self.assertFalse(auditor.audit_failed([{'errors':[],'epubcheck':{'exitCode':0}}]))
        self.assertTrue(auditor.audit_failed([{'errors':[{'kind':'image-integrity'}]}]))
        self.assertTrue(auditor.audit_failed([{'errors':[],'epubcheck':{'exitCode':1}}]))
        self.assertTrue(auditor.audit_failed([]))


if __name__=='__main__':unittest.main()
