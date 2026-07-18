import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { importDocumentFile } from "../src/import-docx";
import { buildPdfCopyDocxBlob } from "../src/pdf-to-copy-docx";

function filePolyfill(buffer: Uint8Array, name: string): File {
  return {
    name,
    size: buffer.length,
    arrayBuffer: async () => buffer.slice(0).buffer,
    text: async () => "",
    stream: () => null as never,
    type: "application/pdf",
    lastModified: 0,
    slice: () => null as never,
  } as unknown as File;
}

async function docxBlobToBuffer(blob: Blob): Promise<Uint8Array> {
  const buf = await blob.arrayBuffer();
  return new Uint8Array(buf);
}

describe("PDF → DOCX cópia → reimportação (round-trip para normalização)", () => {
  const pdfPath = resolve("tmp", "DISSERTACAO_Redes e propriedade intelectual ....pdf");

  it("preserva figuras e tabelas ao gerar cópia e reimportar como DOCX", async () => {
    const pdfBuffer = new Uint8Array(readFileSync(pdfPath));
    const pdfResult = await importDocumentFile(filePolyfill(pdfBuffer, "redes.pdf"));

    expect(pdfResult.sourceKind).toBe("pdf");
    const originalFigures = pdfResult.importedImages.filter((i) => i.data && i.data.byteLength);
    const originalTables = pdfResult.importedTables.filter((t) => t.rows.length > 0);

    const copy = await buildPdfCopyDocxBlob({
      editorText: pdfResult.editorText,
      importedImages: pdfResult.importedImages,
      importedTables: pdfResult.importedTables,
      fileName: "redes.pdf",
    });

    const copyBuffer = await docxBlobToBuffer(copy.blob);
    const reimport = await importDocumentFile(filePolyfill(copyBuffer, "redes-copia.docx"));

    const reimportedFigures = reimport.importedImages.filter((i) => i.data && i.data.byteLength);
    const reimportedTables = reimport.importedTables.filter((t) => t.rows.length > 0);
    console.log(
      `figuras originais=${originalFigures.length} copia=${copy.figureCount} reimportadas=${reimportedFigures.length}`,
    );
    console.log(
      `tabelas originais=${originalTables.length} copia=${copy.tableCount} reimportadas=${reimportedTables.length}`,
    );

    expect(copy.figureCount).toBe(originalFigures.length);
    expect(reimportedFigures.length).toBe(originalFigures.length);
    expect(reimportedTables.length).toBe(originalTables.length);
  }, 120000);
});
