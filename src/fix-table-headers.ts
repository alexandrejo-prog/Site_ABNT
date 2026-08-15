import JSZip from "jszip";

/**
 * Garante que a primeira linha de cada tabela seja repetida quando a tabela
 * atravessa páginas (Manual UFLA §23.3/§23.4 — cabeçalho repetido).
 *
 * O OOXML exige `<w:tblHeader/>` dentro de `<w:trPr>` da linha-cabeçalho
 * (não em `<w:tblPr>`): se nenhuma linha da tabela já declara o atributo,
 * a primeira linha é marcada como cabeçalho repetido.
 */
export function patchTableHeaderRows(documentXml: string): { xml: string; changed: boolean } {
  let changed = false;
  const tblRegex = /<w:tbl\b[^>]*>([\s\S]*?)<\/w:tbl>/g;

  const patchedXml = documentXml.replace(tblRegex, (tableMatch) => {
    if (/<w:tblHeader\b/.test(tableMatch)) {
      return tableMatch;
    }

    const firstRowMatch = tableMatch.match(/<w:tr\b[^>]*>([\s\S]*?)<\/w:tr>/);
    if (!firstRowMatch) {
      return tableMatch;
    }

    const firstRow = firstRowMatch[0];
    const firstRowInner = firstRowMatch[1];
    let patchedRow = firstRow;

    if (/<w:trPr\b[^>]*>/.test(firstRowInner)) {
      patchedRow = firstRow.replace(
        /(<w:trPr\b[^>]*>)/,
        "$1<w:tblHeader/>",
      );
    } else {
      patchedRow = firstRow.replace(/^(<w:tr\b[^>]*>)/, "$1<w:trPr><w:tblHeader/></w:trPr>");
    }

    changed = true;
    return tableMatch.replace(firstRow, patchedRow);
  });

  return { xml: patchedXml, changed };
}

export async function fixTableHeaders(docxBuffer: ArrayBuffer): Promise<ArrayBuffer> {
  const zip = await JSZip.loadAsync(docxBuffer);
  const documentFile = zip.file("word/document.xml");
  if (!documentFile) return docxBuffer;

  const documentXml = await documentFile.async("string");
  const patch = patchTableHeaderRows(documentXml);
  if (!patch.changed) return docxBuffer;

  zip.file("word/document.xml", patch.xml);
  return zip.generateAsync({ type: "arraybuffer" });
}

export async function fixTableHeadersFromBlob(docxBlob: Blob): Promise<Blob> {
  const buffer = await docxBlob.arrayBuffer();
  const fixedBuffer = await fixTableHeaders(buffer);
  return new Blob([fixedBuffer], { type: docxBlob.type });
}
