import { describe, expect, it } from "vitest";
import type { ImportedPdfDocument } from "../src/imported-pdf";
import {
  buildPdfDraftInput,
  pdfDraftStatusMessage,
  PDF_DRAFT_WARNING,
  PDF_DRAFT_STATUS_NOTE,
} from "../src/pdf-to-imported-blocks";
import { getAbsoluteGenerationBlockers } from "../src/generation-blockers";
import { validateWork } from "../src/validators";

function pdfDoc(pages: { pageNumber: number; normalizedText: string }[]): ImportedPdfDocument {
  return {
    source: { fileName: "exemplo.pdf", pageCount: pages.length },
    pages: pages.map((p) => ({
      pageNumber: p.pageNumber,
      width: 800,
      height: 1000,
      items: [],
      normalizedText: p.normalizedText,
    })),
    blocks: [],
    diagnostics: [],
    quality: { textConfidence: "high", layoutConfidence: "medium", requiresManualReview: false },
  };
}

describe("buildPdfDraftInput", () => {
  it("gera editorText com aviso + texto extraído para PDF com conteúdo", () => {
    const doc = pdfDoc([
      { pageNumber: 1, normalizedText: "Texto extraido de exemplo na pagina 1." },
      { pageNumber: 2, normalizedText: "Mais conteudo na pagina 2." },
    ]);
    const input = buildPdfDraftInput(doc, "exemplo.pdf", "monografia");
    expect(input.editorText).toContain(PDF_DRAFT_WARNING);
    expect(input.editorText).toContain("Texto extraido de exemplo na pagina 1.");
    expect(input.editorText).toContain("Mais conteudo na pagina 2.");
    expect(input.messages).toContain(PDF_DRAFT_WARNING);
    expect(input.fields.workType).toBe("monografia");
    expect(input.fileName).toBe("exemplo.pdf");
  });

  it("define explicitamente origem PDF e modo pdf-text-draft", () => {
    const doc = pdfDoc([{ pageNumber: 1, normalizedText: "Conteudo." }]);
    const input = buildPdfDraftInput(doc, "x.pdf", "monografia");
    expect(input.sourceKind).toBe("pdf");
    expect(input.documentMode).toBe("pdf-text-draft");
  });

  it("preserva texto bruto e texto ordenado separadamente (exclui pré-textuais do ordenado)", () => {
    const doc = pdfDoc([
      { pageNumber: 1, normalizedText: "LISTA DE QUADROS\nQuadro 1 – X ................................ 98" },
      { pageNumber: 2, normalizedText: "Introdução com conteúdo real de exemplo." },
    ]);
    const input = buildPdfDraftInput(doc, "x.pdf");
    expect(input.rawPageText).toContain("LISTA DE QUADROS");
    expect(input.orderedText).not.toContain("LISTA DE QUADROS");
    expect(input.orderedText).toContain("Introdução com conteúdo real");
    expect(input.regionDiagnostics).toEqual([]);
    expect(input.importMetadata?.pageCount).toBe(2);
  });

  it("PDF sem texto extraível gera aviso e mantém pendências de campos", () => {
    const doc = pdfDoc([{ pageNumber: 1, normalizedText: "   " }]);
    const input = buildPdfDraftInput(doc, "vazio.pdf");
    expect(input.editorText).toContain(PDF_DRAFT_WARNING);
    expect(input.editorText).toContain("sem texto extraível");
    expect(input.editorText).not.toContain("PREENCHER");
    const issues = validateWork(input.fields, input.editorText);
    expect(issues.some((i) => i.code === "title-required")).toBe(true);
  });

  it("preserva o tipo de trabalho selecionado e não inventa metadados", () => {
    const doc = pdfDoc([{ pageNumber: 1, normalizedText: "Conteudo." }]);
    const input = buildPdfDraftInput(doc, "x.pdf", "artigo");
    expect(input.fields.workType).toBe("artigo");
    expect(input.fields.author).toBe("");
    expect(input.fields.title).toBe("");
  });

  it("não produz bloqueador absoluto quando o tipo de trabalho está definido", () => {
    const doc = pdfDoc([{ pageNumber: 1, normalizedText: "Conteudo." }]);
    const input = buildPdfDraftInput(doc, "x.pdf", "monografia");
    const issues = validateWork(input.fields, input.editorText);
    expect(getAbsoluteGenerationBlockers(issues, input.fields)).toHaveLength(0);
  });
});

describe("pdfDraftStatusMessage / avisos", () => {
  it("informa que recortes visuais não são inseridos automaticamente no DOCX", () => {
    const msg = pdfDraftStatusMessage("Andrade_2025.pdf", 139);
    expect(msg).toContain("recortes visuais");
    expect(msg).toContain("revisão manual");
    expect(msg).not.toMatch(/100%|perfeita|perfeito/i);
  });

  it("PDF_DRAFT_WARNING orienta revisão de estrutura e elementos visuais", () => {
    expect(PDF_DRAFT_WARNING.toLowerCase()).toMatch(/revise/);
    expect(PDF_DRAFT_WARNING).toMatch(/tabelas|quadros|gráficos|figuras/i);
  });

  it("PDF_DRAFT_STATUS_NOTE não promete conversão perfeita de PDF", () => {
    expect(PDF_DRAFT_STATUS_NOTE).toMatch(/revisão manual/);
    expect(PDF_DRAFT_STATUS_NOTE).not.toMatch(/100%|perfeita|perfeito/i);
  });
});
