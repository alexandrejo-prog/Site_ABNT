import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { importDocumentFile } from "../src/import-docx";
import { emptyAcademicFields } from "../src/ufla-rules";

function buildSyntheticPdf(pages: string[]): ArrayBuffer {
  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pages.map((_, index) => `${3 + index * 2} 0 R`).join(" ")}] /Count ${pages.length} >>`,
  ];

  pages.forEach((text, index) => {
    const pageObject = 3 + index * 2;
    const contentObject = pageObject + 1;
    const stream = `BT /F1 18 Tf 72 720 Td (${text.replace(/[()\\]/g, "")}) Tj ET`;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${3 + pages.length * 2} 0 R >> >> /Contents ${contentObject} 0 R >>`);
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });

  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  const bytes = new TextEncoder().encode(pdf);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function makeSyntheticDocx(): Promise<ArrayBuffer> {
  const zip = new JSZip();
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>1 INTRODUCAO</w:t></w:r></w:p></w:body></w:document>`,
  );
  zip.file("word/styles.xml", `<?xml version="1.0" encoding="UTF-8"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>`);
  zip.file("word/_rels/document.xml.rels", `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`);
  return zip.generateAsync({ type: "arraybuffer" });
}

describe("importacao diagnostica de PDF", () => {
  it("roteia PDF como sourceKind pdf e documentMode pdf-diagnostic", async () => {
    const file = new File([buildSyntheticPdf(["Primeira pagina"])], "teste.pdf", { type: "application/pdf" });
    const result = await importDocumentFile(file);

    expect(result.sourceKind).toBe("pdf");
    expect(result.documentMode).toBe("pdf-diagnostic");
    expect(result.pdfDiagnostic?.fileName).toBe("teste.pdf");
  });

  it("mantem DOCX, TXT e Markdown em ufla-structured", async () => {
    const docx = await importDocumentFile(new File([await makeSyntheticDocx()], "teste.docx"));
    const txt = await importDocumentFile(new File(["texto simples"], "teste.txt", { type: "text/plain" }));
    const markdown = await importDocumentFile(new File(["# Titulo"], "teste.md", { type: "text/markdown" }));

    expect(docx.sourceKind).toBe("docx");
    expect(docx.documentMode).toBe("ufla-structured");
    expect(txt.sourceKind).toBe("txt");
    expect(txt.documentMode).toBe("ufla-structured");
    expect(markdown.sourceKind).toBe("markdown");
    expect(markdown.documentMode).toBe("ufla-structured");
  });

  it("retorna numero correto de paginas e texto bruto separado por pagina", async () => {
    const file = new File([buildSyntheticPdf(["Texto da pagina um", "Texto da pagina dois"])], "duas-paginas.pdf", {
      type: "application/pdf",
    });

    const result = await importDocumentFile(file);

    expect(result.pdfDiagnostic?.pageCount).toBe(2);
    expect(result.pdfDiagnostic?.pages).toHaveLength(2);
    expect(result.pdfDiagnostic?.pages[0].rawText).toContain("Texto da pagina um");
    expect(result.pdfDiagnostic?.pages[1].rawText).toContain("Texto da pagina dois");
    expect(result.pdfDiagnostic?.pages[0].textItemCount).toBeGreaterThan(0);
    expect(result.pdfDiagnostic?.pages[0].items.length).toBeGreaterThan(0);
    expect(result.pdfDiagnostic?.pages[0].lines.length).toBeGreaterThan(0);
    expect(result.pdfDiagnostic?.pages[0].width).toBeGreaterThan(0);
    expect(result.pdfDiagnostic?.pages[0].height).toBeGreaterThan(0);
    expect(result.pdfDiagnostic?.bodyStart.found).toBe(false);
    expect(result.pdfDiagnostic?.pretextual.warnings.length).toBeGreaterThan(0);
  });

  it("PDF invalido gera mensagem controlada", async () => {
    const file = new File(["nao e pdf"], "invalido.pdf", { type: "application/pdf" });

    await expect(importDocumentFile(file)).rejects.toThrow("Não foi possível ler o PDF");
  });

  it("importar PDF nao altera campos academicos nem insere texto no editor", async () => {
    const result = await importDocumentFile(new File([buildSyntheticPdf(["Autor Maria Titulo qualquer"])], "diagnostico.pdf", {
      type: "application/pdf",
    }));
    const empty = emptyAcademicFields();

    expect(result.fields).toEqual(empty);
    expect(result.editorText).toBe("");
    expect(result.importedImages).toEqual([]);
    expect(result.importedTables).toEqual([]);
    expect(result.messages.join(" ")).toContain("rascunho DOCX estruturado");
  });
});
