import { inflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { generateDocxBlob } from "../src/export-docx";
import { buildPdfDraftInput } from "../src/pdf-to-imported-blocks";
import { emptyAcademicFields } from "../src/ufla-rules";
import type { ImportedPdfDocument, PdfTextItem } from "../src/imported-pdf";

function pdfDoc(normalizedText: string): ImportedPdfDocument {
  const lines = normalizedText.split("\n").filter((l) => l.trim().length > 0);
  const items: PdfTextItem[] = lines.map((text, index) => ({
    text,
    pageNumber: 1,
    x: 72,
    y: 900 - index * 14,
    width: text.length * 6,
    height: 12,
    fontName: "Times",
  }));
  return {
    source: { fileName: "exemplo.pdf", pageCount: 1 },
    pages: [{ pageNumber: 1, width: 800, height: 1000, items, normalizedText }],
    blocks: [],
    diagnostics: [],
    quality: { textConfidence: "high", layoutConfidence: "medium", requiresManualReview: false },
  };
}

function readUInt16(buffer: Buffer, offset: number): number {
  return buffer.readUInt16LE(offset);
}

function readUInt32(buffer: Buffer, offset: number): number {
  return buffer.readUInt32LE(offset);
}

function extractFileFromZip(buffer: Buffer, fileName: string): string {
  let offset = 0;
  while (offset < buffer.length - 30) {
    if (readUInt32(buffer, offset) !== 0x04034b50) {
      offset += 1;
      continue;
    }
    const compression = readUInt16(buffer, offset + 8);
    const compressedSize = readUInt32(buffer, offset + 18);
    const fileNameLength = readUInt16(buffer, offset + 26);
    const extraLength = readUInt16(buffer, offset + 28);
    const nameStart = offset + 30;
    const name = buffer.subarray(nameStart, nameStart + fileNameLength).toString("utf8");
    const dataStart = nameStart + fileNameLength + extraLength;
    const dataEnd = dataStart + compressedSize;
    if (name === fileName) {
      const data = buffer.subarray(dataStart, dataEnd);
      if (compression === 0) return data.toString("utf8");
      if (compression === 8) return inflateRawSync(data).toString("utf8");
      throw new Error(`Compactacao nao suportada: ${compression}.`);
    }
    offset = dataEnd;
  }
  throw new Error(`Arquivo nao encontrado no DOCX: ${fileName}.`);
}

describe("DOCX de rascunho a partir de PDF", () => {
  it("gera DOCX contendo o aviso de revisão e o texto reconstruído", async () => {
    const doc = pdfDoc("Secao importante com texto extraido de exemplo para o rascunho.");
    const input = buildPdfDraftInput(doc, "exemplo.pdf", "monografia");
    const blob = await generateDocxBlob({
      fields: input.fields,
      editorText: input.editorText,
      sourceKind: input.sourceKind,
      documentMode: input.documentMode,
      semanticBlocks: input.semanticBlocks,
    });
    const xml = extractFileFromZip(Buffer.from(await blob.arrayBuffer()), "word/document.xml");
    expect(xml).toContain("Rascunho gerado a partir de PDF");
    expect(xml).toContain("texto extraido de exemplo");
    expect(xml).not.toContain("[PREENCHER");
  });

  it("não insere recortes visuais automaticamente sem regiões (apenas texto)", async () => {
    const doc = pdfDoc("Conteudo unico de teste para rascunho textual.");
    const input = buildPdfDraftInput(doc, "exemplo.pdf", "monografia");
    expect(input.editorText).not.toMatch(/w:drawing/);
    const blob = await generateDocxBlob({
      fields: input.fields,
      editorText: input.editorText,
      sourceKind: input.sourceKind,
      documentMode: input.documentMode,
      semanticBlocks: input.semanticBlocks,
    });
    const xml = extractFileFromZip(Buffer.from(await blob.arrayBuffer()), "word/document.xml");
    expect(xml).not.toContain("<w:drawing>");
  });

  it("Modo B não gera capa com placeholders AUTOR/TÍTULO DO TRABALHO", async () => {
    const doc = pdfDoc("Introducao com conteudo de exemplo para o rascunho.");
    const input = buildPdfDraftInput(doc, "exemplo.pdf", "monografia");
    const blob = await generateDocxBlob({
      fields: input.fields,
      editorText: input.editorText,
      sourceKind: input.sourceKind,
      documentMode: input.documentMode,
      semanticBlocks: input.semanticBlocks,
    });
    const xml = extractFileFromZip(Buffer.from(await blob.arrayBuffer()), "word/document.xml");
    expect(xml).not.toContain("AUTOR");
    expect(xml).not.toContain("TÍTULO DO TRABALHO");
    expect(xml).toContain("Introducao com conteudo de exemplo");
  });

  it("gera DOCX mesmo com campos vazios (sem bloqueio de capa)", async () => {
    const doc = pdfDoc("Texto de exemplo para rascunho de PDF.");
    const input = buildPdfDraftInput(doc, "exemplo.pdf");
    const blob = await generateDocxBlob({
      fields: input.fields,
      editorText: input.editorText,
      sourceKind: input.sourceKind,
      documentMode: input.documentMode,
      semanticBlocks: input.semanticBlocks,
    });
    const xml = extractFileFromZip(Buffer.from(await blob.arrayBuffer()), "word/document.xml");
    expect(xml).toContain("Rascunho gerado a partir de PDF");
    expect(xml).toContain("Texto de exemplo");
  });

  it("texto comum contendo a frase não é classificado como PDF (modo ufla-structured)", async () => {
    const blob = await generateDocxBlob({
      fields: emptyAcademicFields(),
      editorText: "Rascunho gerado a partir de PDF é só um texto comum de exemplo.",
      documentMode: "ufla-structured",
    });
    const xml = extractFileFromZip(Buffer.from(await blob.arrayBuffer()), "word/document.xml");
    expect(xml).toContain("TÍTULO DO TRABALHO");
    expect(xml).toContain("AUTOR");
  });
});
