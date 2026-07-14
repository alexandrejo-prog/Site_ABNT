// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act, waitFor } from "@testing-library/react";
import { readFileSync } from "fs";
import { join } from "path";
import { emptyAcademicFields, emptyConfidenceMap } from "../src/ufla-rules";
import { loadDocxParts } from "./test-utils/ooxml";
import type { ImportedPdfDiagnostic } from "../src/imported-pdf-diagnostic";
import type { PdfVisualCropGeometry } from "../src/pdf-visual-crop-geometry";
import type { PdfTextDraftVisualAsset } from "../src/pdf-text-draft-contract";

const LOGO_BYTES = readFileSync(join(process.cwd(), "public", "assets", "ufla-logo.jpeg"));

const { saveAsMock } = vi.hoisted(() => ({ saveAsMock: vi.fn() }));

vi.mock("file-saver", () => ({ saveAs: saveAsMock }));

const importDocumentFileMock = vi.hoisted(() => vi.fn());
vi.mock("../src/import-docx", () => ({ importDocumentFile: importDocumentFileMock }));

const computePdfVisualCropGeometryMock = vi.hoisted(() => vi.fn());
vi.mock("../src/pdf-visual-crop-geometry", () => ({ computePdfVisualCropGeometry: computePdfVisualCropGeometryMock }));

const renderPdfVisualAssetsMock = vi.hoisted(() => vi.fn());
vi.mock("../src/pdf-visual-asset-integration", async (importActual) => {
  const actual = await importActual<typeof import("../src/pdf-visual-asset-integration")>();
  return { ...actual, renderPdfVisualAssets: renderPdfVisualAssetsMock };
});

import App from "../src/App";

let lastRender: { pdfData?: Uint8Array; crops?: PdfVisualCropGeometry[] } | null = null;

function makeAsset(): PdfTextDraftVisualAsset {
  return { data: LOGO_BYTES, width: 200, height: 100, altText: { title: "t", description: "d", name: "n" } };
}

function syntheticDiagnostic(): ImportedPdfDiagnostic {
  return {
    fileName: "Andrade_2025.pdf",
    pageCount: 30,
    pages: Array.from({ length: 30 }, (_, index) => ({
      pageNumber: index + 1,
      width: 1000,
      height: 1000,
      rotation: 0,
      rawText: "",
      textItemCount: 0,
      items: [],
      lines: [],
    })),
    pretextual: {
      cover: { institution: "UNIVERSIDADE FEDERAL DE LAVRAS", author: "Autor", title: "Título", city: "Lavras", year: "2025", confidence: "high", sourceLines: [{ pageNumber: 1, lineIndex: 0 }] },
      titlePage: { author: "Autor", title: "Título", natureText: "Natureza.", program: "Programa", institution: "UFLA", advisor: "Orientador", city: "Lavras", year: "2025", confidence: "high", sourceLines: [{ pageNumber: 2, lineIndex: 0 }] },
      resumo: { title: "RESUMO", text: "Resumo de exemplo para validação.", keywordsLabel: "Palavras-chave:", keywords: "A. B.", pageNumber: 6, confidence: "high", sourceLines: [{ pageNumber: 6, lineIndex: 0 }] },
      abstract: { title: "ABSTRACT", text: "Abstract example.", keywordsLabel: "Keywords:", keywords: "A. B.", pageNumber: 7, confidence: "high", sourceLines: [{ pageNumber: 7, lineIndex: 0 }] },
      warnings: [],
    },
    bodyStart: { found: true, pageNumber: 17, lineIndex: 1, text: "1 INTRODUÇÃO" },
    reconstruction: {
      blocks: [
        { type: "heading", text: "1 INTRODUÇÃO", pageStart: 17, pageEnd: 17, sourceLines: [{ pageNumber: 17, lineIndex: 1 }], confidence: "high", reasons: [] },
        { type: "paragraph", text: "Parágrafo reconstruído suficiente para validação de exportação do rascunho textual.", pageStart: 17, pageEnd: 17, sourceLines: [{ pageNumber: 17, lineIndex: 2 }], confidence: "medium", reasons: [] },
        { type: "caption", text: "Quadro 1 – Exemplo.", pageStart: 25, pageEnd: 25, sourceLines: [{ pageNumber: 25, lineIndex: 2 }], confidence: "high", reasons: [], layoutRegionId: "layout-25-1" },
        { type: "unresolved", text: "INTERNO QUADRO", pageStart: 25, pageEnd: 25, sourceLines: [{ pageNumber: 25, lineIndex: 3 }], confidence: "low", reasons: [], layoutRegionId: "layout-25-1" },
        { type: "source", text: "Fonte: Autor.", pageStart: 25, pageEnd: 25, sourceLines: [{ pageNumber: 25, lineIndex: 4 }], confidence: "high", reasons: [], layoutRegionId: "layout-25-1" },
        { type: "caption", text: "Conteúdo 1 – Exemplo.", pageStart: 26, pageEnd: 26, sourceLines: [{ pageNumber: 26, lineIndex: 2 }], confidence: "high", reasons: [], layoutRegionId: "layout-26-1" },
        { type: "source", text: "Fonte: Autor.", pageStart: 26, pageEnd: 26, sourceLines: [{ pageNumber: 26, lineIndex: 3 }], confidence: "high", reasons: [], layoutRegionId: "layout-26-1" },
        { type: "heading", text: "REFERÊNCIAS", pageStart: 110, pageEnd: 110, sourceLines: [{ pageNumber: 110, lineIndex: 1 }], confidence: "high", reasons: [] },
      ],
      ignoredLines: [],
      bodyStart: { found: true, pageNumber: 17, lineIndex: 1, text: "1 INTRODUÇÃO" },
      bodyLayoutMetrics: { dominantLeft: 84, dominantRight: 540, medianLineHeight: 12, medianLineGap: 8, probableFirstLineIndent: 36, probableBodyFontHeight: 12, confidence: "high" },
      layoutRegions: [
        { id: "layout-25-1", pageStart: 25, pageEnd: 25, startLineIndex: 2, endLineIndex: 4, kind: "quadro", caption: "Quadro 1 – Exemplo.", source: "Fonte: Autor.", confidence: "high", reasons: [], logicalVisualId: "quadro-1-page-25" },
        { id: "layout-26-1", pageStart: 26, pageEnd: 26, startLineIndex: 2, endLineIndex: 3, kind: "multicolumn", caption: "Conteúdo 1 – Exemplo.", source: "Fonte: Autor.", confidence: "high", reasons: [], logicalVisualId: "multicolumn-1-page-26" },
      ],
      hyphenation: [],
      alerts: [],
      statistics: {
        paragraphCount: 1, headingCount: 2, listItemCount: 0, captionCount: 2, sourceCount: 2, unresolvedCount: 1,
        removedPageNumberCount: 0, removedHeaderCount: 0, removedFooterCount: 0, averageLinesPerParagraph: 1, medianLinesPerParagraph: 1,
        singleLineParagraphCount: 0, multiPageParagraphCount: 0, lowConfidenceBlockCount: 0, uncertainHyphenationCount: 0,
        layoutRegionCount: 2, mixedCaseHeadingCount: 0, combinedHeadingCount: 0,
      },
    },
    warnings: [],
  };
}

function bothCrops(): PdfVisualCropGeometry[] {
  return [
    { regionId: "layout-25-1", visualKey: "quadro-1-page-25", pageNumber: 25, sourceRect: { x: 0, y: 0, width: 100, height: 100 }, normalizedRect: { x: 0, y: 0, width: 0.5, height: 0.5 }, pageWidth: 1000, pageHeight: 1000, confidence: "high", reasons: [] },
    { regionId: "layout-26-1", visualKey: "multicolumn-1-page-26", pageNumber: 26, sourceRect: { x: 0, y: 0, width: 100, height: 100 }, normalizedRect: { x: 0, y: 0, width: 0.5, height: 0.5 }, pageWidth: 1000, pageHeight: 1000, confidence: "high", reasons: [] },
  ];
}

function pdfFile(bytes: number[] = [9, 8, 7, 6]): File {
  return new File([new Uint8Array(bytes)], "Andrade_2025.pdf");
}

function docxFile(): File {
  return new File([new Uint8Array([1, 2, 3])], "documento.docx");
}

async function importFile(file: File) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement | null;
  if (!input) throw new Error("input de arquivo ausente");
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  await act(async () => {
    fireEvent.change(input, { target: { files: [file] } });
  });
}

function setupImportMock() {
  importDocumentFileMock.mockImplementation(async (file: File) => {
    if (file.name.toLowerCase().endsWith(".pdf")) {
      return {
        sourceKind: "pdf",
        documentMode: "pdf-diagnostic",
        fields: emptyAcademicFields(),
        confidence: emptyConfidenceMap(),
        editorText: "",
        messages: [],
        fileName: file.name,
        pdfDiagnostic: syntheticDiagnostic(),
      };
    }
    return {
      sourceKind: "docx",
      documentMode: "ufla-structured",
      fields: emptyAcademicFields(),
      confidence: emptyConfidenceMap(),
      editorText: "Texto importado.",
      messages: [],
      fileName: file.name,
    };
  });
}

function setupRenderMock(assets: Record<string, PdfTextDraftVisualAsset>, warnings: string[] = []) {
  renderPdfVisualAssetsMock.mockImplementation(async (pdfData: Uint8Array, crops: PdfVisualCropGeometry[]) => {
    lastRender = { pdfData, crops: [...crops] };
    return { assets, warnings };
  });
}

async function clickGenerateDraft() {
  const button = screen.getByText("Gerar rascunho textual DOCX");
  await act(async () => {
    fireEvent.click(button);
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  // Aguarda a geracao assincrona concluir para nao vazar geracoes pendentes
  // para o teste seguinte (causa de saveAs ser chamado multiplas vezes).
  await waitFor(() => expect(saveAsMock).toHaveBeenCalledTimes(1), { timeout: 8000 });
}

describe("fluxo de ativos visuais do PDF no App", () => {
  beforeEach(() => {
    saveAsMock.mockClear();
    lastRender = null;
    importDocumentFileMock.mockReset();
    computePdfVisualCropGeometryMock.mockReset();
    renderPdfVisualAssetsMock.mockReset();
    setupImportMock();
  });

  afterEach(() => {
    cleanup();
  });

  it("PDF envia bytes preservados na importacao", async () => {
    setupRenderMock({ "quadro-1-page-25::p25::rlayout-25-1": makeAsset() });
    computePdfVisualCropGeometryMock.mockReturnValue({ crops: bothCrops(), skipped: [] });
    render(<App />);
    await importFile(pdfFile([9, 8, 7, 6]));
    await clickGenerateDraft();
    expect(lastRender).not.toBeNull();
    expect(Array.from(lastRender!.pdfData!)).toEqual([9, 8, 7, 6]);
  });

  it("geometria de recorte e chamada a partir do diagnostico", async () => {
    setupRenderMock({ "quadro-1-page-25::p25::rlayout-25-1": makeAsset() });
    computePdfVisualCropGeometryMock.mockReturnValue({ crops: bothCrops(), skipped: [] });
    render(<App />);
    await importFile(pdfFile());
    await clickGenerateDraft();
    expect(computePdfVisualCropGeometryMock).toHaveBeenCalledTimes(1);
    const args = computePdfVisualCropGeometryMock.mock.calls[0];
    expect(args[0]).toBeInstanceOf(Array);
    expect(args[1]).toHaveLength(2);
    expect(args[2]).toBeDefined();
  });

  it("renderer recebe apenas crops permitidos (exclui multicolumn)", async () => {
    setupRenderMock({ "quadro-1-page-25::p25::rlayout-25-1": makeAsset() });
    computePdfVisualCropGeometryMock.mockReturnValue({ crops: bothCrops(), skipped: [] });
    render(<App />);
    await importFile(pdfFile());
    await clickGenerateDraft();
    expect(lastRender!.crops!.map((c) => c.regionId)).toEqual(["layout-25-1"]);
  });

  it("assets chegam ao exportador e viram desenhos no DOCX", async () => {
    setupRenderMock({ "quadro-1-page-25::p25::rlayout-25-1": makeAsset() });
    computePdfVisualCropGeometryMock.mockReturnValue({ crops: bothCrops(), skipped: [] });
    render(<App />);
    await importFile(pdfFile());
    await clickGenerateDraft();
    await waitFor(() => expect(saveAsMock).toHaveBeenCalledTimes(1), { timeout: 8000 });
    const blob = saveAsMock.mock.calls[0][0] as Blob;
    const { documentXml } = await loadDocxParts(blob);
    expect(documentXml).toContain("<w:drawing");
    expect(documentXml).not.toContain("Elemento visual não inserido");
  }, 20_000);

  it("erro do renderer nao bloqueia a geracao do DOCX", async () => {
    renderPdfVisualAssetsMock.mockRejectedValue(new Error("falha do renderer"));
    computePdfVisualCropGeometryMock.mockReturnValue({ crops: bothCrops(), skipped: [] });
    render(<App />);
    await importFile(pdfFile());
    await clickGenerateDraft();
    await waitFor(() => expect(saveAsMock).toHaveBeenCalledTimes(1), { timeout: 8000 });
    const blob = saveAsMock.mock.calls[0][0] as Blob;
    const { documentXml } = await loadDocxParts(blob);
    expect(documentXml).toContain("Elemento visual não inserido");
  });

  it("warnings do renderer nao bloqueiam a geracao", async () => {
    setupRenderMock({ "quadro-1-page-25::p25::rlayout-25-1": makeAsset() }, ["aviso de teste"]);
    computePdfVisualCropGeometryMock.mockReturnValue({ crops: bothCrops(), skipped: [] });
    render(<App />);
    await importFile(pdfFile());
    await clickGenerateDraft();
    await waitFor(() => expect(screen.getByText(/aviso\(s\)/)).toBeTruthy());
  });

  it("ausencia de bytes preserva os marcadores no DOCX", async () => {
    // Sem crops rasterizáveis, o renderer não é chamado e os marcadores permanecem.
    computePdfVisualCropGeometryMock.mockReturnValue({ crops: [], skipped: [] });
    render(<App />);
    await importFile(pdfFile());
    await clickGenerateDraft();
    expect(renderPdfVisualAssetsMock).not.toHaveBeenCalled();
    await waitFor(() => expect(saveAsMock).toHaveBeenCalledTimes(1), { timeout: 8000 });
    const blob = saveAsMock.mock.calls[0][0] as Blob;
    const { documentXml } = await loadDocxParts(blob);
    expect(documentXml).toContain("Elemento visual não inserido");
  });

  it("status informa a quantidade de elementos visuais inseridos", async () => {
    setupRenderMock({ "quadro-1-page-25::p25::rlayout-25-1": makeAsset() });
    computePdfVisualCropGeometryMock.mockReturnValue({ crops: bothCrops(), skipped: [] });
    render(<App />);
    await importFile(pdfFile());
    await clickGenerateDraft();
    await waitFor(() => expect(screen.getByText(/elemento\(s\) visual\(is\) inserido\(s\)/)).toBeTruthy());
  });

  it("importar arquivo nao PDF limpa os bytes do PDF", async () => {
    setupRenderMock({});
    computePdfVisualCropGeometryMock.mockReturnValue({ crops: bothCrops(), skipped: [] });
    render(<App />);
    await importFile(pdfFile());
    expect(screen.queryByText("Gerar rascunho textual DOCX")).not.toBeNull();
    await importFile(docxFile());
    expect(screen.queryByText("Gerar rascunho textual DOCX")).toBeNull();
  });

  it("remover a importacao limpa os bytes do PDF", async () => {
    setupRenderMock({});
    computePdfVisualCropGeometryMock.mockReturnValue({ crops: bothCrops(), skipped: [] });
    render(<App />);
    await importFile(pdfFile());
    expect(screen.queryByText("Gerar rascunho textual DOCX")).not.toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByText("Remover importação"));
    });
    expect(screen.queryByText("Gerar rascunho textual DOCX")).toBeNull();
  });
});
