import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import {
  buildPdfTextDraftDocxBlob,
  pdfTextDraftFileName,
  validatePdfTextDraftExport,
} from "../src/export-pdf-text-draft-docx";
import type { PdfTextDraftExportInput } from "../src/pdf-text-draft-contract";
import { documentText, loadDocxParts, paragraphTexts } from "./test-utils/ooxml";

function baseInput(overrides: Partial<PdfTextDraftExportInput> = {}): PdfTextDraftExportInput {
  return {
    sourceKind: "pdf",
    documentMode: "pdf-text-draft",
    fileName: "Andrade_2025.pdf",
    pageCount: 139,
    reconstruction: {
      bodyStart: { found: true, pageNumber: 17, lineIndex: 1, text: "1 INTRODUÇÃO" },
      ignoredLines: [{ pageNumber: 17, lineIndex: 0, role: "page-number", text: "16" }],
      bodyLayoutMetrics: {
        dominantLeft: 84,
        dominantRight: 540,
        medianLineHeight: 12,
        medianLineGap: 8,
        probableFirstLineIndent: 36,
        probableBodyFontHeight: 12,
        confidence: "high",
      },
      layoutRegions: [{
        id: "layout-25-1",
        pageStart: 25,
        pageEnd: 25,
        startLineIndex: 2,
        endLineIndex: 12,
        kind: "quadro",
        caption: "Quadro 1 – Pontos críticos.",
        source: "Fonte: Alves (2020).",
        confidence: "high",
        reasons: ["Legenda visual identificada."],
        logicalVisualId: "quadro-1",
      }, {
        id: "layout-26-1",
        pageStart: 26,
        pageEnd: 27,
        startLineIndex: 1,
        endLineIndex: 8,
        kind: "tabela",
        caption: "Tabela 1 – Síntese.",
        confidence: "medium",
        reasons: ["Legenda visual identificada."],
        logicalVisualId: "tabela-1",
      }],
      hyphenation: [{
        pageNumber: 17,
        lineIndex: 5,
        originalEnd: "inter-",
        nextStart: "institucional",
        action: "uncertain",
        reason: "Hífen preservado por incerteza diagnóstica.",
      }],
      alerts: [],
      statistics: {
        paragraphCount: 2,
        headingCount: 1,
        listItemCount: 1,
        captionCount: 1,
        sourceCount: 1,
        unresolvedCount: 2,
        removedPageNumberCount: 1,
        removedHeaderCount: 0,
        removedFooterCount: 0,
        averageLinesPerParagraph: 5,
        medianLinesPerParagraph: 5,
        singleLineParagraphCount: 0,
        multiPageParagraphCount: 0,
        lowConfidenceBlockCount: 1,
        uncertainHyphenationCount: 1,
        layoutRegionCount: 2,
        mixedCaseHeadingCount: 0,
        combinedHeadingCount: 0,
      },
      blocks: [
        { type: "heading", text: "1 INTRODUÇÃO", pageStart: 17, pageEnd: 17, sourceLines: [{ pageNumber: 17, lineIndex: 1 }], confidence: "high", reasons: [] },
        { type: "paragraph", text: "O teletrabalho na administração pública federal tem evoluído significativamente em um único parágrafo reconstruído.", pageStart: 17, pageEnd: 17, sourceLines: [{ pageNumber: 17, lineIndex: 2 }, { pageNumber: 17, lineIndex: 3 }], confidence: "medium", reasons: [] },
        { type: "paragraph", text: "O segundo parágrafo permanece separado e também deve receber formatação básica.", pageStart: 17, pageEnd: 17, sourceLines: [{ pageNumber: 17, lineIndex: 4 }], confidence: "medium", reasons: [] },
        { type: "list-item", text: "a) item preservado como texto normal.", pageStart: 19, pageEnd: 19, sourceLines: [{ pageNumber: 19, lineIndex: 3 }], confidence: "medium", reasons: [] },
        { type: "caption", text: "Quadro 1 – Pontos críticos.", pageStart: 25, pageEnd: 25, sourceLines: [{ pageNumber: 25, lineIndex: 2 }], confidence: "high", reasons: [] },
        { type: "unresolved", text: "TEXTO INTERNO DO QUADRO QUE NAO PODE APARECER", pageStart: 25, pageEnd: 25, sourceLines: Array.from({ length: 10 }, (_, index) => ({ pageNumber: 25, lineIndex: index + 3 })), confidence: "low", reasons: [], layoutRegionId: "layout-25-1" },
        { type: "unresolved", text: "OUTRA LINHA INTERNA DO MESMO QUADRO", pageStart: 25, pageEnd: 25, sourceLines: [{ pageNumber: 25, lineIndex: 13 }], confidence: "low", reasons: [], layoutRegionId: "layout-25-1" },
        { type: "source", text: "Fonte: Alves (2020).", pageStart: 25, pageEnd: 25, sourceLines: [{ pageNumber: 25, lineIndex: 14 }], confidence: "high", reasons: [] },
        { type: "unresolved", text: "TEXTO INTERNO DA TABELA QUE NAO PODE APARECER", pageStart: 26, pageEnd: 27, sourceLines: [{ pageNumber: 26, lineIndex: 2 }], confidence: "low", reasons: [], layoutRegionId: "layout-26-1" },
        { type: "unresolved", text: "CONTEUDO VISUAL GENERICO NAO DEVE ENTRAR", pageStart: 30, pageEnd: 30, sourceLines: [{ pageNumber: 30, lineIndex: 4 }], confidence: "low", reasons: [] },
      ],
    },
    ...overrides,
  };
}

async function zipEntries(blob: Blob): Promise<string[]> {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  return Object.keys(zip.files);
}

describe("exportacao textual minima de PDF reconstruido", () => {
  it("valida contrato explicito e bloqueadores principais", () => {
    expect(validatePdfTextDraftExport(baseInput()).canExport).toBe(true);
    expect(validatePdfTextDraftExport(baseInput({ documentMode: "pdf-diagnostic" as "pdf-text-draft" })).canExport).toBe(false);
    expect(validatePdfTextDraftExport(baseInput({ reconstruction: { ...baseInput().reconstruction, bodyStart: { found: false } } })).canExport).toBe(false);
    expect(validatePdfTextDraftExport(baseInput({ reconstruction: { ...baseInput().reconstruction, blocks: [] } })).canExport).toBe(false);
    expect(validatePdfTextDraftExport(baseInput({ reconstruction: { ...baseInput().reconstruction, blocks: baseInput().reconstruction.blocks.filter((block) => block.type !== "paragraph") } })).canExport).toBe(false);
    expect(validatePdfTextDraftExport(baseInput({
      reconstruction: {
        ...baseInput().reconstruction,
        blocks: [{ type: "paragraph", text: "Muito longo.", pageStart: 1, pageEnd: 4, sourceLines: [], confidence: "medium", reasons: [] }],
      },
    })).canExport).toBe(false);
  });

  it("gera conteudo textual sem pre-textuais, numero original de pagina ou raw text", async () => {
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(baseInput()));
    const text = documentText(documentXml);

    expect(text).toContain("Rascunho textual extraído de PDF");
    expect(text).toContain("Este arquivo foi reconstruído automaticamente a partir de um PDF");
    expect(text).toContain("1 INTRODUÇÃO");
    expect(text).toContain("O teletrabalho na administração pública federal tem evoluído");
    expect(text).not.toContain("CAPA");
    expect(text).not.toContain("SUMÁRIO");
    expect(text).not.toContain("Ficha catalográfica");
    expect(text).not.toContain("16\n1 INTRODUÇÃO");
  });

  it("mantem paragrafo reconstruido como um unico w:p e nao por linha visual", async () => {
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(baseInput()));
    const paragraphs = paragraphTexts(documentXml);
    expect(paragraphs.filter((text) => text.includes("um único parágrafo reconstruído"))).toHaveLength(1);
    expect(paragraphs.some((text) => text === "O teletrabalho na administração pública federal")).toBe(false);
  });

  it("gera marcadores visuais sem repetir texto interno", async () => {
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(baseInput()));
    const text = documentText(documentXml);
    const marker = "Elemento visual não inserido neste rascunho textual";

    expect((text.match(new RegExp(marker, "g")) ?? []).length).toBe(2);
    expect(text).toContain("Quadro 1 – Pontos críticos.");
    expect((text.match(/Quadro 1 – Pontos críticos\./g) ?? []).length).toBe(1);
    expect(text).toContain("Fonte: Alves (2020).");
    expect((text.match(/Fonte: Alves \(2020\)\./g) ?? []).length).toBe(1);
    expect(text).toContain("Quadro, página original 25");
    expect(text).toContain("Tabela, páginas originais 26-27");
    expect(text).toContain("Conteúdo com estrutura visual não resolvida, página original 30");
    expect(text).not.toContain("TEXTO INTERNO DO QUADRO");
    expect(text).not.toContain("TEXTO INTERNO DA TABELA");
    expect(text.indexOf("Quadro 1 – Pontos críticos.")).toBeLessThan(text.indexOf(marker));
    expect(text.indexOf(marker)).toBeLessThan(text.indexOf("Fonte: Alves (2020)."));
  });

  it("nao cria tabelas, imagens, midia, TOC, outline ou listas multinivel", async () => {
    const blob = await buildPdfTextDraftDocxBlob(baseInput());
    const { documentXml, settingsXml } = await loadDocxParts(blob);
    const entries = await zipEntries(blob);
    const allXml = `${documentXml}\n${settingsXml}`;

    expect(entries.some((entry) => entry.startsWith("word/media/"))).toBe(false);
    expect(allXml).not.toContain("<w:tbl");
    expect(allXml).not.toContain("<w:drawing");
    expect(allXml).not.toContain("<w:pict");
    expect(allXml).not.toContain("TOC");
    expect(allXml).not.toContain("outlineLvl");
    expect(allXml).not.toContain("<w:numPr");
  });

  it("aplica formatacao basica de pagina e paragrafo", async () => {
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(baseInput()));

    expect(documentXml).toContain('<w:pgSz w:w="11906" w:h="16838"');
    expect(documentXml).toContain('<w:pgMar w:top="1701" w:right="1134" w:bottom="1134" w:left="1701"');
    expect(documentXml).toContain("Times New Roman");
    expect(documentXml).toContain('<w:sz w:val="24"');
    expect(documentXml).toContain('w:firstLine="850"');
    expect(documentXml).toContain('<w:spacing w:before="0" w:after="0" w:line="360"');
    expect(documentXml).toContain('<w:sz w:val="20"');
  });

  it("normaliza nome do arquivo", () => {
    expect(pdfTextDraftFileName("Andrade_2025.pdf")).toBe("andrade-2025-rascunho-textual.docx");
    expect(pdfTextDraftFileName(" Meu Relatório Final.PDF")).toBe("meu-relatorio-final-rascunho-textual.docx");
  });
});
