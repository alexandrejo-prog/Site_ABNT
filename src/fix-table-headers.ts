import JSZip from 'jszip';

export async function fixTableHeaders(docxBuffer: ArrayBuffer): Promise<ArrayBuffer> {
  const zip = await JSZip.loadAsync(docxBuffer);
  const documentXml = await zip.file('word/document.xml')!.async('text');
  
  const tblRegex = /<w:tbl[^>]*>([\s\S]*?)<\/w:tbl>/g;
  
  const fixedXml = documentXml.replace(tblRegex, (match) => {
    if (/<w:tblHeader/.test(match)) {
      return match;
    }
    
    return match.replace(
      /(<w:tblPr[^>]*>)/,
      '$1<w:tblHeader/>'
    );
  });
  
  zip.file('word/document.xml', fixedXml);
  
  return zip.generateAsync({ type: 'arraybuffer' });
}

export async function fixTableHeadersFromBlob(docxBlob: Blob): Promise<Blob> {
  const buffer = await docxBlob.arrayBuffer();
  const fixedBuffer = await fixTableHeaders(buffer);
  return new Blob([fixedBuffer], { type: docxBlob.type });
}
