import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import JSZip from "jszip";
import {
  buildPdfTextDraftDocxBlob,
  pdfTextDraftFileName,
  validatePdfTextDraftExport,
} from "../src/export-pdf-text-draft-docx";
import type { PdfTextDraftExportInput, PdfTextDraftVisualAsset } from "../src/pdf-text-draft-contract";
import { pdfRegionCropKey } from "../src/pdf-visual-asset-integration";
import { documentText, loadDocxParts, paragraphTexts } from "./test-utils/ooxml";

function baseInput(overrides: Partial<PdfTextDraftExportInput> = {}): PdfTextDraftExportInput {
  const logo = readFileSync(join(process.cwd(), "public", "assets", "ufla-logo.jpeg"));
  return {
    sourceKind: "pdf",
    documentMode: "pdf-text-draft",
    fileName: "Andrade_2025.pdf",
    pageCount: 139,
    logo: { data: logo, width: 170, height: 69 },
    pretextual: {
      cover: {
        institution: "UNIVERSIDADE FEDERAL DE LAVRAS",
        author: "Alexandre Andrade",
        title: "TELETRABALHO NA ADMINISTRAÇÃO PÚBLICA FEDERAL",
        city: "Lavras - MG",
        year: "2025",
        confidence: "high",
        sourceLines: [{ pageNumber: 1, lineIndex: 0 }],
      },
      titlePage: {
        author: "Alexandre Andrade",
        title: "TELETRABALHO NA ADMINISTRAÇÃO PÚBLICA FEDERAL",
        natureText: "Dissertação apresentada à Universidade Federal de Lavras, como parte das exigências do Programa de Pós-Graduação.",
        program: "Programa de Pós-Graduação em Administração Pública",
        institution: "Universidade Federal de Lavras",
        advisor: "Orientador: Prof. João Silva",
        city: "Lavras - MG",
        year: "2025",
        confidence: "high",
        sourceLines: [{ pageNumber: 2, lineIndex: 0 }],
      },
      resumo: {
        title: "RESUMO",
        text: "Este resumo veio em várias linhas no PDF e foi reconstruído como um único parágrafo lógico preservado.",
        keywordsLabel: "Palavras-chave:",
        keywords: "Teletrabalho. Administração pública. UFLA",
        pageNumber: 6,
        confidence: "high",
        sourceLines: [{ pageNumber: 6, lineIndex: 1 }],
      },
      abstract: {
        title: "ABSTRACT",
        text: "This abstract came from multiple PDF lines and was rebuilt as one logical paragraph.",
        keywordsLabel: "Keywords:",
        keywords: "Remote work. Public administration. UFLA",
        pageNumber: 7,
        confidence: "high",
        sourceLines: [{ pageNumber: 7, lineIndex: 1 }],
      },
      warnings: [],
    },
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
        logicalVisualId: "quadro-1-page-25",
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
        logicalVisualId: "tabela-1-page-26",
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
        { type: "heading", text: "2 REFERENCIAL TEÓRICO", pageStart: 20, pageEnd: 20, sourceLines: [{ pageNumber: 20, lineIndex: 1 }], confidence: "high", reasons: [] },
        { type: "list-item", text: "a) item preservado como texto normal.", pageStart: 19, pageEnd: 19, sourceLines: [{ pageNumber: 19, lineIndex: 3 }], confidence: "medium", reasons: [] },
        { type: "caption", text: "Quadro 1 – Pontos críticos.", pageStart: 25, pageEnd: 25, sourceLines: [{ pageNumber: 25, lineIndex: 2 }], confidence: "high", reasons: [] },
        { type: "unresolved", text: "TEXTO INTERNO DO QUADRO QUE NAO PODE APARECER", pageStart: 25, pageEnd: 25, sourceLines: Array.from({ length: 10 }, (_, index) => ({ pageNumber: 25, lineIndex: index + 3 })), confidence: "low", reasons: [], layoutRegionId: "layout-25-1" },
        { type: "unresolved", text: "OUTRA LINHA INTERNA DO MESMO QUADRO", pageStart: 25, pageEnd: 25, sourceLines: [{ pageNumber: 25, lineIndex: 13 }], confidence: "low", reasons: [], layoutRegionId: "layout-25-1" },
        { type: "source", text: "Fonte: Alves (2020).", pageStart: 25, pageEnd: 25, sourceLines: [{ pageNumber: 25, lineIndex: 14 }], confidence: "high", reasons: [] },
        { type: "unresolved", text: "TEXTO INTERNO DA TABELA QUE NAO PODE APARECER", pageStart: 26, pageEnd: 27, sourceLines: [{ pageNumber: 26, lineIndex: 2 }], confidence: "low", reasons: [], layoutRegionId: "layout-26-1" },
        { type: "unresolved", text: "CONTEUDO VISUAL GENERICO NAO DEVE ENTRAR", pageStart: 30, pageEnd: 30, sourceLines: [{ pageNumber: 30, lineIndex: 4 }], confidence: "low", reasons: [] },
        { type: "heading", text: "REFERÊNCIAS", pageStart: 110, pageEnd: 110, sourceLines: [{ pageNumber: 110, lineIndex: 1 }], confidence: "high", reasons: [] },
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

  it("gera capa, folha de rosto, nota, resumo, abstract, sumario e corpo sem numero antigo", async () => {
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(baseInput()));
    const text = documentText(documentXml);

    expect(text).not.toContain("Rascunho textual extraído de PDF");
    expect(text.indexOf("UNIVERSIDADE FEDERAL DE LAVRAS")).toBeLessThan(text.indexOf("NOTA DE REVISÃO"));
    expect(text).toContain("Alexandre Andrade");
    expect(text).toContain("TELETRABALHO NA ADMINISTRAÇÃO PÚBLICA FEDERAL");
    expect(text).toContain("Dissertação apresentada à Universidade Federal de Lavras");
    expect(text).toContain("NOTA DE REVISÃO");
    expect(text).toContain("RESUMO");
    expect(text).toContain("Palavras-chave:");
    expect(text).toContain("ABSTRACT");
    expect(text).toContain("Keywords:");
    expect(text).toContain("SUMÁRIO");
    expect(text).toContain("1 INTRODUÇÃO");
    expect(text).toContain("REFERÊNCIAS");
    expect(text).toContain("O teletrabalho na administração pública federal tem evoluído");
    expect(text).not.toContain("Ficha catalográfica");
    expect(text).not.toContain("16\n1 INTRODUÇÃO");
  });

  it("mantem resumo e abstract em um unico w:p e separa palavras-chave", async () => {
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(baseInput()));
    const paragraphs = paragraphTexts(documentXml);

    expect(paragraphs.filter((text) => text.includes("Este resumo veio em várias linhas"))).toHaveLength(1);
    expect(paragraphs.filter((text) => text.includes("This abstract came from multiple PDF lines"))).toHaveLength(1);
    expect(paragraphs.some((text) => text.startsWith("Palavras-chave: Teletrabalho"))).toBe(true);
    expect(paragraphs.some((text) => text.startsWith("Keywords: Remote work"))).toBe(true);
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

  it("insere somente a logo institucional e nao cria tabelas, outline ou listas multinivel", async () => {
    const blob = await buildPdfTextDraftDocxBlob(baseInput());
    const { documentXml, settingsXml } = await loadDocxParts(blob);
    const entries = await zipEntries(blob);
    const allXml = `${documentXml}\n${settingsXml}`;

    expect(entries.filter((entry) => entry.startsWith("word/media/") && !entry.endsWith("/"))).toHaveLength(1);
    expect(allXml).not.toContain("<w:tbl");
    expect(allXml).toContain("<w:drawing");
    expect(allXml).not.toContain("<w:pict");
    expect(allXml).not.toContain("outlineLvl");
    expect(allXml).not.toContain("HeadingLevel");
    expect(allXml).not.toContain("<w:numPr");
  });

  it("gera sumario visivel com bookmarks e campos PAGEREF atualizaveis", async () => {
    const { documentXml, settingsXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(baseInput()));
    const text = documentText(documentXml);

    expect(text).toContain("SUMÁRIO");
    expect(text).toContain("1 INTRODUÇÃO");
    expect(text).toContain("2 REFERENCIAL TEÓRICO");
    expect(text).toContain("REFERÊNCIAS");
    expect(documentXml).toContain("PAGEREF PDFBM001");
    expect(documentXml).toContain("<w:bookmarkStart");
    expect(settingsXml).toContain("updateFields");
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

  it("texto interno de regiao visual nao aparece como prosa no DOCX", async () => {
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(baseInput()));
    expect(documentXml).not.toContain("TEXTO INTERNO DO QUADRO");
    expect(documentXml).not.toContain("TEXTO INTERNO DA TABELA");
  });

  it("dois quadros diferentes geram dois marcadores mesmo com multiplos blocos unresolved", async () => {
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(baseInput()));
    const marker = "Elemento visual não inserido neste rascunho textual";
    const matches = documentXml.match(new RegExp(marker, "g"));
    expect(matches).toHaveLength(2);
  });

  it("quadro com mesma regiao logica em paginas diferentes gera um unico marcador", async () => {
    const regions = [
      { id: "layout-27-1", pageStart: 27, pageEnd: 27, startLineIndex: 1, endLineIndex: 3, kind: "quadro" as const, caption: "Quadro 2 – Síntese (continua).", confidence: "high" as const, reasons: [], logicalVisualId: "quadro-2-page-27" },
      { id: "layout-28-1", pageStart: 28, pageEnd: 28, startLineIndex: 0, endLineIndex: 2, kind: "quadro" as const, caption: "Quadro 2 – Síntese (conclusão).", confidence: "high" as const, reasons: [], logicalVisualId: "quadro-2-page-27" },
    ];
    const blocks = [
      { type: "unresolved" as const, text: "Linha A", pageStart: 27, pageEnd: 27, sourceLines: [{ pageNumber: 27, lineIndex: 1 }], confidence: "low" as const, reasons: [], layoutRegionId: "layout-27-1" },
      { type: "unresolved" as const, text: "Linha B", pageStart: 27, pageEnd: 27, sourceLines: [{ pageNumber: 27, lineIndex: 2 }], confidence: "low" as const, reasons: [], layoutRegionId: "layout-27-1" },
      { type: "unresolved" as const, text: "Linha C", pageStart: 28, pageEnd: 28, sourceLines: [{ pageNumber: 28, lineIndex: 0 }], confidence: "low" as const, reasons: [], layoutRegionId: "layout-28-1" },
      { type: "paragraph" as const, text: "Texto normal depois do quadro.", pageStart: 28, pageEnd: 28, sourceLines: [{ pageNumber: 28, lineIndex: 4 }], confidence: "medium" as const, reasons: [] },
    ];
    const input = baseInput({
      reconstruction: {
        ...baseInput().reconstruction,
        layoutRegions: regions,
        blocks,
        statistics: { ...baseInput().reconstruction.statistics, layoutRegionCount: 2, unresolvedCount: 3, paragraphCount: 1 },
      },
    });
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(input));
    const marker = "Elemento visual não inserido neste rascunho textual";
    const matches = documentXml.match(new RegExp(marker, "g"));
    expect(matches).toHaveLength(1);
    expect(documentXml).toContain("páginas originais 27-28");
    expect(documentXml).not.toContain("Linha A");
    expect(documentXml).not.toContain("Linha B");
    expect(documentXml).not.toContain("Linha C");
    expect(documentXml).toContain("Texto normal depois do quadro");
  });

  it("headings dentro de regiao visual nao aparecem como titulo", async () => {
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(baseInput()));
    expect(documentXml).not.toContain("CONTEUDO VISUAL GENERICO");
  });

  function graphicTestBlocks(extraBlocks: PdfTextDraftExportInput["reconstruction"]["blocks"]): PdfTextDraftExportInput["reconstruction"]["blocks"] {
    return [
      { type: "paragraph", text: "Texto antes do grafico para validacao.", pageStart: 1, pageEnd: 1, sourceLines: [{ pageNumber: 1, lineIndex: 0 }], confidence: "medium", reasons: [] },
      ...extraBlocks,
    ];
  }

  it("marcador de grafico fica entre legenda e fonte no DOCX", async () => {
    const input = baseInput({
      reconstruction: {
        ...baseInput().reconstruction,
        blocks: graphicTestBlocks([
          { type: "caption", text: "Gráfico 1 – Vendas.", pageStart: 40, pageEnd: 40, sourceLines: [{ pageNumber: 40, lineIndex: 0 }], confidence: "high", reasons: [], layoutRegionId: "layout-40-1" },
          { type: "source", text: "Fonte: Autor.", pageStart: 40, pageEnd: 40, sourceLines: [{ pageNumber: 40, lineIndex: 1 }], confidence: "high", reasons: [], layoutRegionId: "layout-40-1" },
        ]),
        layoutRegions: [{
          id: "layout-40-1",
          pageStart: 40,
          pageEnd: 40,
          startLineIndex: 0,
          endLineIndex: 1,
          kind: "grafico",
          caption: "Gráfico 1 – Vendas.",
          source: "Fonte: Autor.",
          confidence: "high",
          reasons: [],
        }],
        statistics: { ...baseInput().reconstruction.statistics, layoutRegionCount: 1, captionCount: 1, sourceCount: 1, unresolvedCount: 0, paragraphCount: 1 },
      },
    });
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(input));
    const captionIndex = documentXml.indexOf("Gráfico 1 – Vendas.");
    const sourceIndex = documentXml.indexOf("Fonte: Autor.");
    const marker = "Elemento visual não inserido neste rascunho textual";
    const markerIndex = documentXml.indexOf(marker);
    expect(markerIndex).toBeGreaterThan(-1);
    expect(captionIndex).toBeLessThan(markerIndex);
    expect(markerIndex).toBeLessThan(sourceIndex);
  });

  it("legenda e fonte de grafico aparecem uma vez", async () => {
    const input = baseInput({
      reconstruction: {
        ...baseInput().reconstruction,
        blocks: graphicTestBlocks([
          { type: "caption", text: "Gráfico 1 – Vendas.", pageStart: 40, pageEnd: 40, sourceLines: [{ pageNumber: 40, lineIndex: 0 }], confidence: "high", reasons: [], layoutRegionId: "layout-40-1" },
          { type: "source", text: "Fonte: Autor.", pageStart: 40, pageEnd: 40, sourceLines: [{ pageNumber: 40, lineIndex: 1 }], confidence: "high", reasons: [], layoutRegionId: "layout-40-1" },
        ]),
        layoutRegions: [{
          id: "layout-40-1",
          pageStart: 40,
          pageEnd: 40,
          startLineIndex: 0,
          endLineIndex: 1,
          kind: "grafico",
          caption: "Gráfico 1 – Vendas.",
          source: "Fonte: Autor.",
          confidence: "high",
          reasons: [],
        }],
        statistics: { ...baseInput().reconstruction.statistics, layoutRegionCount: 1, captionCount: 1, sourceCount: 1, unresolvedCount: 0, paragraphCount: 1 },
      },
    });
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(input));
    expect((documentXml.match(/Gráfico 1 – Vendas\./g) || []).length).toBe(1);
    expect((documentXml.match(/Fonte: Autor\./g) || []).length).toBe(1);
  });

  it("dois graficos geram dois marcadores", async () => {
    const input = baseInput({
      reconstruction: {
        ...baseInput().reconstruction,
        blocks: graphicTestBlocks([
          { type: "caption", text: "Gráfico 1 – Vendas.", pageStart: 40, pageEnd: 40, sourceLines: [{ pageNumber: 40, lineIndex: 0 }], confidence: "high", reasons: [], layoutRegionId: "layout-40-1" },
          { type: "source", text: "Fonte: Autor.", pageStart: 40, pageEnd: 40, sourceLines: [{ pageNumber: 40, lineIndex: 1 }], confidence: "high", reasons: [], layoutRegionId: "layout-40-1" },
          { type: "caption", text: "Gráfico 2 – Custos.", pageStart: 41, pageEnd: 41, sourceLines: [{ pageNumber: 41, lineIndex: 0 }], confidence: "high", reasons: [], layoutRegionId: "layout-41-1" },
          { type: "source", text: "Fonte: Autor.", pageStart: 41, pageEnd: 41, sourceLines: [{ pageNumber: 41, lineIndex: 1 }], confidence: "high", reasons: [], layoutRegionId: "layout-41-1" },
        ]),
        layoutRegions: [{
          id: "layout-40-1",
          pageStart: 40,
          pageEnd: 40,
          startLineIndex: 0,
          endLineIndex: 1,
          kind: "grafico",
          caption: "Gráfico 1 – Vendas.",
          source: "Fonte: Autor.",
          confidence: "high",
          reasons: [],
        }, {
          id: "layout-41-1",
          pageStart: 41,
          pageEnd: 41,
          startLineIndex: 0,
          endLineIndex: 1,
          kind: "grafico",
          caption: "Gráfico 2 – Custos.",
          source: "Fonte: Autor.",
          confidence: "high",
          reasons: [],
        }],
        statistics: { ...baseInput().reconstruction.statistics, layoutRegionCount: 2, captionCount: 2, sourceCount: 2, unresolvedCount: 0, paragraphCount: 1 },
      },
    });
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(input));
    const marker = "Elemento visual não inserido neste rascunho textual";
    expect((documentXml.match(new RegExp(marker, "g")) || []).length).toBe(2);
  });

  it("mesmo logicalVisualId gera um marcador unico", async () => {
    const input = baseInput({
      reconstruction: {
        ...baseInput().reconstruction,
        blocks: graphicTestBlocks([
          { type: "caption", text: "Gráfico 1 – Vendas.", pageStart: 40, pageEnd: 40, sourceLines: [{ pageNumber: 40, lineIndex: 0 }], confidence: "high", reasons: [], layoutRegionId: "layout-40-1" },
          { type: "source", text: "Fonte: Autor.", pageStart: 40, pageEnd: 40, sourceLines: [{ pageNumber: 40, lineIndex: 1 }], confidence: "high", reasons: [], layoutRegionId: "layout-40-1" },
          { type: "caption", text: "Gráfico 1 – Vendas (conclusão).", pageStart: 42, pageEnd: 42, sourceLines: [{ pageNumber: 42, lineIndex: 0 }], confidence: "high", reasons: [], layoutRegionId: "layout-42-1" },
          { type: "source", text: "Fonte: Autor.", pageStart: 42, pageEnd: 42, sourceLines: [{ pageNumber: 42, lineIndex: 1 }], confidence: "high", reasons: [], layoutRegionId: "layout-42-1" },
        ]),
        layoutRegions: [{
          id: "layout-40-1",
          pageStart: 40,
          pageEnd: 40,
          startLineIndex: 0,
          endLineIndex: 1,
          kind: "grafico",
          caption: "Gráfico 1 – Vendas.",
          source: "Fonte: Autor.",
          confidence: "high",
          reasons: [],
          logicalVisualId: "grafico-1-page-40",
        }, {
          id: "layout-42-1",
          pageStart: 42,
          pageEnd: 42,
          startLineIndex: 0,
          endLineIndex: 1,
          kind: "grafico",
          caption: "Gráfico 1 – Vendas (conclusão).",
          source: "Fonte: Autor.",
          confidence: "high",
          reasons: [],
          logicalVisualId: "grafico-1-page-40",
        }],
        statistics: { ...baseInput().reconstruction.statistics, layoutRegionCount: 2, captionCount: 2, sourceCount: 2, unresolvedCount: 0, paragraphCount: 1 },
      },
    });
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(input));
    const marker = "Elemento visual não inserido neste rascunho textual";
    expect((documentXml.match(new RegExp(marker, "g")) || []).length).toBe(1);
    expect(documentXml).toContain("páginas originais 40-42");
  });

  it("contagem do resumo coincide com marcadores emitidos", async () => {
    const input = baseInput({
      reconstruction: {
        ...baseInput().reconstruction,
        blocks: graphicTestBlocks([
          { type: "caption", text: "Gráfico 1 – Vendas.", pageStart: 40, pageEnd: 40, sourceLines: [{ pageNumber: 40, lineIndex: 0 }], confidence: "high", reasons: [], layoutRegionId: "layout-40-1" },
          { type: "source", text: "Fonte: Autor.", pageStart: 40, pageEnd: 40, sourceLines: [{ pageNumber: 40, lineIndex: 1 }], confidence: "high", reasons: [], layoutRegionId: "layout-40-1" },
        ]),
        layoutRegions: [{
          id: "layout-40-1",
          pageStart: 40,
          pageEnd: 40,
          startLineIndex: 0,
          endLineIndex: 1,
          kind: "grafico",
          caption: "Gráfico 1 – Vendas.",
          source: "Fonte: Autor.",
          confidence: "high",
          reasons: [],
        }],
        statistics: { ...baseInput().reconstruction.statistics, layoutRegionCount: 1, captionCount: 1, sourceCount: 1, unresolvedCount: 0, paragraphCount: 1 },
      },
    });
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(input));
    const marker = "Elemento visual não inserido neste rascunho textual";
    const markerCount = (documentXml.match(new RegExp(marker, "g")) || []).length;
    expect(documentXml).toContain("Elementos visuais representados por marcadores:");
    expect(documentXml).toContain(`Elementos visuais representados por marcadores: ${markerCount}`);
  });

  it("nao existe w:tbl no documento", async () => {
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(baseInput()));
    expect(documentXml).not.toContain("w:tbl");
  });

  it("marcador mostra pagina correta para regiao sem continuacao", async () => {
    const input = baseInput({
      reconstruction: {
        ...baseInput().reconstruction,
        layoutRegions: [{
          id: "layout-50-1",
          pageStart: 50,
          pageEnd: 50,
          startLineIndex: 0,
          endLineIndex: 1,
          kind: "grafico" as const,
          caption: "Gráfico 5 – Isolado.",
          source: "Fonte: Autor.",
          confidence: "high" as const,
          reasons: [],
          logicalVisualId: "grafico-5-page-50",
        }],
        blocks: [
          { type: "paragraph" as const, text: "Parágrafo válido para validação.", pageStart: 17, pageEnd: 17, sourceLines: [{ pageNumber: 17, lineIndex: 2 }], confidence: "medium" as const, reasons: [] },
          { type: "unresolved" as const, text: "Conteúdo interno.", pageStart: 50, pageEnd: 50, sourceLines: [{ pageNumber: 50, lineIndex: 1 }], confidence: "low" as const, reasons: [], layoutRegionId: "layout-50-1" },
        ],
      },
    });
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(input));
    expect(documentXml).toContain("página original 50");
    expect(documentXml).not.toContain("páginas originais");
  });

  it("nao cola numero de pagina ao texto do paragrafo no DOCX", async () => {
    const input = baseInput({
      reconstruction: {
        ...baseInput().reconstruction,
        blocks: [
          { type: "paragraph" as const, text: "Este parágrafo termina com de.", pageStart: 33, pageEnd: 33, sourceLines: [{ pageNumber: 33, lineIndex: 1 }], confidence: "medium" as const, reasons: [] },
          { type: "paragraph" as const, text: "A consulta ano. foi preservada.", pageStart: 31, pageEnd: 31, sourceLines: [{ pageNumber: 31, lineIndex: 1 }], confidence: "medium" as const, reasons: [] },
        ],
      },
    });
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(input));
    expect(documentXml).not.toContain("de33");
    expect(documentXml).not.toContain("ano.31");
    expect(documentXml).toContain("Este parágrafo termina com de.");
    expect(documentXml).toContain("A consulta ano. foi preservada.");
  });
});

describe("estabilizacao de paginacao e folha de rosto", () => {
  it("titulo do corpo possui keepNext no document.xml", async () => {
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(baseInput()));
    const headingParagraph = (documentXml.match(/<w:p\b[\s\S]*?<\/w:p>/g) ?? []).find((p) => p.includes("1 INTRODUÇÃO") && !p.includes("PAGEREF"));
    expect(headingParagraph).toBeDefined();
    expect(headingParagraph).toContain("<w:keepNext/>");
  });

  it("titulo do corpo possui keepLines", async () => {
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(baseInput()));
    const headingParagraph = (documentXml.match(/<w:p\b[\s\S]*?<\/w:p>/g) ?? []).find((p) => p.includes("1 INTRODUÇÃO") && !p.includes("PAGEREF"));
    expect(headingParagraph).toBeDefined();
    expect(headingParagraph).toContain("<w:keepLines/>");
  });

  it("titulo do corpo nao possui outlineLvl, pStyle de Heading nem numPr", async () => {
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(baseInput()));
    const headingParagraph = (documentXml.match(/<w:p\b[\s\S]*?<\/w:p>/g) ?? []).find((p) => p.includes("1 INTRODUÇÃO") && !p.includes("PAGEREF"));
    expect(headingParagraph).toBeDefined();
    expect(headingParagraph).not.toContain("outlineLvl");
    expect(headingParagraph).not.toContain("Heading");
    expect(headingParagraph).not.toContain("<w:numPr");
  });

  it("paragrafo comum posterior nao recebe keepNext", async () => {
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(baseInput()));
    const bodyParagraph = (documentXml.match(/<w:p\b[\s\S]*?<\/w:p>/g) ?? []).find((p) => p.includes("O teletrabalho na administração pública federal"));
    expect(bodyParagraph).toBeDefined();
    expect(bodyParagraph).not.toContain("<w:keepNext/>");
    expect(bodyParagraph).not.toContain("<w:keepLines/>");
  });

  it("natureText possui recuo esperado, firstLine zero, espacamento simples, justificado e antes 900", async () => {
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(baseInput()));
    const natureParagraph = (documentXml.match(/<w:p\b[\s\S]*?<\/w:p>/g) ?? []).find((p) => p.includes("Dissertação apresentada à Universidade Federal de Lavras"));
    expect(natureParagraph).toBeDefined();
    expect(natureParagraph).toContain('<w:ind w:left="4535"');
    expect(natureParagraph).not.toContain('w:firstLine="');
    expect(natureParagraph).toContain('<w:spacing w:before="900" w:after="0" w:line="240"');
    expect(natureParagraph).toContain('w:val="both"');
    expect(natureParagraph).not.toContain("<w:b/>");
  });

  it("natureText, program e institution nao estao em negrito e usam justificado", async () => {
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(baseInput()));
    const paragraphs = (documentXml.match(/<w:p\b[\s\S]*?<\/w:p>/g) ?? []);
    const natureParagraph = paragraphs.find((p) => p.includes("Dissertação apresentada à Universidade Federal de Lavras"));
    const programParagraph = paragraphs.find((p) => p.includes("Programa de Pós-Graduação em Administração Pública"));
    const institutionParagraph = paragraphs.find((p) => p.includes("Universidade Federal de Lavras") && !p.includes("Dissertação apresentada") && !p.includes("Logo UFLA"));
    expect(natureParagraph).toBeDefined();
    expect(programParagraph).toBeDefined();
    expect(institutionParagraph).toBeDefined();
    expect(natureParagraph).not.toContain("<w:b/>");
    expect(programParagraph).not.toContain("<w:b/>");
    expect(institutionParagraph).not.toContain("<w:b/>");
    expect(natureParagraph).toContain('w:val="both"');
    expect(programParagraph).toContain('w:val="both"');
    expect(institutionParagraph).toContain('w:val="both"');
  });

  it("program e institution possuem antes zero e mesmo recuo", async () => {
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(baseInput()));
    const paragraphs = (documentXml.match(/<w:p\b[\s\S]*?<\/w:p>/g) ?? []);
    const programParagraph = paragraphs.find((p) => p.includes("Programa de Pós-Graduação em Administração Pública"));
    const institutionParagraph = paragraphs.find((p) => p.includes("Universidade Federal de Lavras") && !p.includes("Dissertação apresentada") && !p.includes("Logo UFLA"));
    expect(programParagraph).toBeDefined();
    expect(institutionParagraph).toBeDefined();
    expect(programParagraph).toContain('<w:ind w:left="4535"');
    expect(institutionParagraph).toContain('<w:ind w:left="4535"');
    expect(programParagraph).toContain('<w:spacing w:before="0" w:after="0" w:line="240"');
    expect(institutionParagraph).toContain('<w:spacing w:before="0" w:after="0" w:line="240"');
  });

  it("advisor possui antes 240 e alinhamento esquerdo", async () => {
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(baseInput()));
    const paragraphs = (documentXml.match(/<w:p\b[\s\S]*?<\/w:p>/g) ?? []);
    const advisorParagraph = paragraphs.find((p) => p.includes("Orientador: Prof. João Silva"));
    expect(advisorParagraph).toBeDefined();
    expect(advisorParagraph).toContain('<w:ind w:left="4535"');
    expect(advisorParagraph).toContain('<w:spacing w:before="240" w:after="0" w:line="240"');
    expect(advisorParagraph).toContain('w:val="left"');
    expect(advisorParagraph).not.toContain("<w:b/>");
  });

  it("coadvisor possui antes zero, alinhamento esquerdo e nao esta em negrito", async () => {
    const input = baseInput({
      pretextual: {
        ...baseInput().pretextual!,
        titlePage: {
          ...baseInput().pretextual!.titlePage!,
          coadvisor: "Coorientador: Prof. Maria Souza",
        },
      },
    });
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(input));
    const paragraphs = (documentXml.match(/<w:p\b[\s\S]*?<\/w:p>/g) ?? []);
    const coadvisorParagraph = paragraphs.find((p) => p.includes("Coorientador: Prof. Maria Souza"));
    expect(coadvisorParagraph).toBeDefined();
    expect(coadvisorParagraph).toContain('<w:ind w:left="4535"');
    expect(coadvisorParagraph).toContain('<w:spacing w:before="0" w:after="0" w:line="240"');
    expect(coadvisorParagraph).toContain('w:val="left"');
    expect(coadvisorParagraph).not.toContain("<w:b/>");
  });

  it("titulo principal da folha de rosto continua em negrito", async () => {
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(baseInput()));
    const titleParagraph = (documentXml.match(/<w:p\b[\s\S]*?<\/w:p>/g) ?? []).find((p) => p.includes("TELETRABALHO NA ADMINISTRAÇÃO PÚBLICA FEDERAL") && p.includes('w:val="center"'));
    expect(titleParagraph).toBeDefined();
    expect(titleParagraph).toContain("<w:b/>");
  });

  it("bloco de natureza nao usa tabela, caixa de texto nem recuo de primeira linha", async () => {
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(baseInput()));
    const paragraphs = (documentXml.match(/<w:p\b[\s\S]*?<\/w:p>/g) ?? []);
    for (const needle of ["Dissertação apresentada à Universidade Federal de Lavras", "Programa de Pós-Graduação em Administração Pública", "Universidade Federal de Lavras", "Orientador: Prof. João Silva"]) {
      const p = paragraphs.find((x) => x.includes(needle));
      expect(p).toBeDefined();
      expect(p).not.toContain('w:firstLine="');
      expect(p).not.toContain("<w:tbl");
      expect(p).not.toContain("<w:txbxContent");
    }
  });

  it("program e institution usam o mesmo recuo", async () => {
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(baseInput()));
    const paragraphs = (documentXml.match(/<w:p\b[\s\S]*?<\/w:p>/g) ?? []);
    const programParagraph = paragraphs.find((p) => p.includes("Programa de Pós-Graduação em Administração Pública"));
    const institutionParagraph = paragraphs.find((p) => p.includes("Universidade Federal de Lavras") && !p.includes("Dissertação apresentada") && !p.includes("Logo UFLA"));
    expect(programParagraph).toBeDefined();
    expect(institutionParagraph).toBeDefined();
    expect(programParagraph).toContain('<w:ind w:left="4535"');
    expect(institutionParagraph).toContain('<w:ind w:left="4535"');
  });

  it("advisor e coadvisor usam o mesmo recuo estrutural", async () => {
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(baseInput()));
    const paragraphs = (documentXml.match(/<w:p\b[\s\S]*?<\/w:p>/g) ?? []);
    const advisorParagraph = paragraphs.find((p) => p.includes("Orientador: Prof. João Silva"));
    const coadvisorParagraph = paragraphs.find((p) => p.includes("Coorientador"));
    expect(advisorParagraph).toBeDefined();
    expect(advisorParagraph).toContain('<w:ind w:left="4535"');
    if (coadvisorParagraph) {
      expect(coadvisorParagraph).toContain('<w:ind w:left="4535"');
    }
  });

  it("autor e titulo continuam centralizados", async () => {
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(baseInput()));
    const authorParagraph = (documentXml.match(/<w:p\b[\s\S]*?<\/w:p>/g) ?? []).find((p) => p.includes("Alexandre Andrade") && !p.includes("TELETRABALHO"));
    const titleParagraph = (documentXml.match(/<w:p\b[\s\S]*?<\/w:p>/g) ?? []).find((p) => p.includes("TELETRABALHO NA ADMINISTRAÇÃO PÚBLICA FEDERAL") && p.includes('w:val="center"'));
    expect(authorParagraph).toBeDefined();
    expect(authorParagraph).toContain('w:val="center"');
    expect(titleParagraph).toBeDefined();
    expect(titleParagraph).toContain('w:val="center"');
  });

  it("cidade e ano continuam centralizados", async () => {
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(baseInput()));
    const paragraphs = (documentXml.match(/<w:p\b[\s\S]*?<\/w:p>/g) ?? []);
    const cityParagraph = paragraphs.find((p) => p.includes("Lavras - MG") && p.includes('w:val="center"'));
    const yearParagraph = paragraphs.find((p) => p.includes("2025") && p.includes('w:val="center"'));
    expect(cityParagraph).toBeDefined();
    expect(yearParagraph).toBeDefined();
  });

  it("margens permanecem 3 cm superior, 3 cm esquerda, 2 cm inferior, 2 cm direita", async () => {
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(baseInput()));
    expect(documentXml).toContain('<w:pgSz w:w="11906" w:h="16838"');
    expect(documentXml).toContain('<w:pgMar w:top="1701" w:right="1134" w:bottom="1134" w:left="1701"');
  });

  it("nao ha w:tbl criado pela correcao", async () => {
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(baseInput()));
    expect(documentXml).not.toContain("<w:tbl");
  });

  it("nao ha w:numPr", async () => {
    const blob = await buildPdfTextDraftDocxBlob(baseInput());
    const { documentXml, settingsXml, stylesXml } = await loadDocxParts(blob);
    const allXml = `${documentXml}\n${settingsXml}\n${stylesXml}`;
    expect(allXml).not.toContain("<w:numPr");
  });

  it("bookmarks e PAGEREF do sumario continuam presentes", async () => {
    const { documentXml, settingsXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(baseInput()));
    expect(documentXml).toContain("SUMÁRIO");
    expect(documentXml).toContain("1 INTRODUÇÃO");
    expect(documentXml).toContain("PAGEREF PDFBM001");
    expect(documentXml).toContain("<w:bookmarkStart");
    expect(settingsXml).toContain("updateFields");
  });

  it("corpo comum continua justificado, recuo primeira linha 1,5 cm e espacamento 1,5", async () => {
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(baseInput()));
    const bodyParagraph = (documentXml.match(/<w:p\b[\s\S]*?<\/w:p>/g) ?? []).find((p) => p.includes("O teletrabalho na administração pública federal"));
    expect(bodyParagraph).toBeDefined();
    expect(bodyParagraph).toContain('w:val="both"');
    expect(bodyParagraph).toContain('w:firstLine="850"');
    expect(bodyParagraph).toContain('<w:spacing w:before="0" w:after="0" w:line="360"');
  });
});

describe("formatacao de itens de lista no rascunho textual pdf", () => {
  function listInput(): PdfTextDraftExportInput {
    return baseInput({
      reconstruction: {
        ...baseInput().reconstruction,
        blocks: [
          { type: "paragraph" as const, text: "Parágrafo comum antes da lista para validar recuo de primeira linha.", pageStart: 17, pageEnd: 17, sourceLines: [{ pageNumber: 17, lineIndex: 2 }], confidence: "medium" as const, reasons: [] },
          { type: "list-item" as const, text: "a) Primeiro objetivo", pageStart: 19, pageEnd: 19, sourceLines: [{ pageNumber: 19, lineIndex: 3 }], confidence: "medium" as const, reasons: [] },
          { type: "list-item" as const, text: "b) Segundo objetivo", pageStart: 19, pageEnd: 19, sourceLines: [{ pageNumber: 19, lineIndex: 4 }], confidence: "medium" as const, reasons: [] },
          { type: "list-item" as const, text: "I – Item", pageStart: 19, pageEnd: 19, sourceLines: [{ pageNumber: 19, lineIndex: 5 }], confidence: "medium" as const, reasons: [] },
          { type: "list-item" as const, text: "1. Item numerado", pageStart: 19, pageEnd: 19, sourceLines: [{ pageNumber: 19, lineIndex: 6 }], confidence: "medium" as const, reasons: [] },
        ],
        statistics: { ...baseInput().reconstruction.statistics, paragraphCount: 1, listItemCount: 4 },
      },
    });
  }

  function listItemParagraphsXml(documentXml: string): string[] {
    return (documentXml.match(/<w:p\b[\s\S]*?<\/w:p>/g) ?? []).filter((paragraph) =>
      /a\) Primeiro objetivo|b\) Segundo objetivo|I – Item|1\. Item numerado/.test(paragraph),
    );
  }

  it("preserva o marcador textual original no XML", async () => {
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(listInput()));
    const text = documentText(documentXml);
    expect(text).toContain("a) Primeiro objetivo");
    expect(text).toContain("b) Segundo objetivo");
    expect(text).toContain("I – Item");
    expect(text).toContain("1. Item numerado");
  });

  it("itens de lista contem recuo esquerdo 850 e recuo pendente 425", async () => {
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(listInput()));
    const items = listItemParagraphsXml(documentXml);
    expect(items).toHaveLength(4);
    for (const item of items) {
      expect(item).toContain('<w:ind w:left="850"');
      expect(item).toContain('w:hanging="425"');
    }
  });

  it("itens de lista nao contem recuo de primeira linha", async () => {
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(listInput()));
    const items = listItemParagraphsXml(documentXml);
    for (const item of items) {
      expect(item).not.toContain('w:firstLine');
    }
  });

  it("itens de lista usam espacamento 360 e zero antes/depois", async () => {
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(listInput()));
    const items = listItemParagraphsXml(documentXml);
    for (const item of items) {
      expect(item).toContain('<w:spacing w:before="0" w:after="0" w:line="360"');
    }
  });

  it("paragrafo comum mantem recuo de primeira linha 850", async () => {
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(listInput()));
    const paragraph = (documentXml.match(/<w:p\b[\s\S]*?<\/w:p>/g) ?? []).find((p) =>
      p.includes("Parágrafo comum antes da lista para validar recuo de primeira linha"),
    );
    expect(paragraph).toBeDefined();
    expect(paragraph).toContain('w:firstLine="850"');
    expect(paragraph).not.toContain('w:hanging');
  });

  it("itens de lista nao usam numeracao automatica do Word", async () => {
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(listInput()));
    const items = listItemParagraphsXml(documentXml);
    for (const item of items) {
      expect(item).not.toContain("<w:numPr");
    }
  });

  it("documento nao referencia numeracao automatica", async () => {
    const blob = await buildPdfTextDraftDocxBlob(listInput());
    const { documentXml, settingsXml, stylesXml } = await loadDocxParts(blob);
    const allXml = `${documentXml}\n${settingsXml}\n${stylesXml}`;
    expect(allXml).not.toContain("<w:numPr");
    expect(allXml).not.toContain("numbering.xml");
  });
});

describe("supressao de conteudo interno de regioes visuais pdf", () => {
  type Block = PdfTextDraftExportInput["reconstruction"]["blocks"][number];
  type Region = PdfTextDraftExportInput["reconstruction"]["layoutRegions"][number];

  function visualInput(blocks: Block[], layoutRegions: Region[], overrides: Partial<PdfTextDraftExportInput["reconstruction"]["statistics"]> = {}): PdfTextDraftExportInput {
    return baseInput({
      reconstruction: {
        ...baseInput().reconstruction,
        blocks,
        layoutRegions,
        statistics: { ...baseInput().reconstruction.statistics, ...overrides },
      },
    });
  }

  const MARKER = "Elemento visual não inserido";

  it("legenda + marcador + linhas internas + fonte (linhas internas ausentes)", async () => {
    const blocks: Block[] = [
      { type: "paragraph", text: "Parágrafo anterior que deve permanecer no documento.", pageStart: 10, pageEnd: 10, sourceLines: [{ pageNumber: 10, lineIndex: 1 }], confidence: "medium", reasons: [] },
      { type: "caption", text: "Quadro 1 – Exemplo sintético para validação.", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 2 }], confidence: "high", reasons: [] },
      { type: "unresolved", text: "Cabeçalho Coluna A Coluna B", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 3 }], confidence: "low", reasons: [], layoutRegionId: "layout-11-1" },
      { type: "paragraph", text: "Linha interna um conteúdo da célula esquerda e direita.", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 4 }], confidence: "medium", reasons: [] },
      { type: "paragraph", text: "Linha interna dois conteúdo da célula esquerda e direita.", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 5 }], confidence: "medium", reasons: [] },
      { type: "source", text: "Fonte: Autor (2020).", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 6 }], confidence: "high", reasons: [] },
      { type: "paragraph", text: "Parágrafo posterior que deve permanecer no documento.", pageStart: 12, pageEnd: 12, sourceLines: [{ pageNumber: 12, lineIndex: 1 }], confidence: "medium", reasons: [] },
    ];
    const regions: Region[] = [{
      id: "layout-11-1", pageStart: 11, pageEnd: 11, startLineIndex: 3, endLineIndex: 5, kind: "quadro",
      caption: "Quadro 1 – Exemplo sintético para validação.", source: "Fonte: Autor (2020).", confidence: "high", reasons: [], logicalVisualId: "quadro-1-page-11",
    }];
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(visualInput(blocks, regions, { paragraphCount: 3, captionCount: 1, sourceCount: 1, unresolvedCount: 1 })));
    const text = documentText(documentXml);

    expect(text).toContain("Quadro 1 – Exemplo sintético para validação.");
    expect(text).toContain(MARKER);
    expect(text).toContain("Fonte: Autor (2020).");
    expect(text).not.toContain("Linha interna um conteúdo");
    expect(text).not.toContain("Linha interna dois conteúdo");
    expect(text).not.toContain("Cabeçalho Coluna A Coluna B");
  });

  it("linhas internas nao aparecem no DOCX", async () => {
    const blocks: Block[] = [
      { type: "caption", text: "Quadro 1 – Exemplo sintético para validação.", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 2 }], confidence: "high", reasons: [] },
      { type: "unresolved", text: "Cabeçalho Coluna A Coluna B", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 3 }], confidence: "low", reasons: [], layoutRegionId: "layout-11-1" },
      { type: "paragraph", text: "Linha interna um conteúdo da célula esquerda e direita.", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 4 }], confidence: "medium", reasons: [] },
      { type: "paragraph", text: "Linha interna dois conteúdo da célula esquerda e direita.", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 5 }], confidence: "medium", reasons: [] },
      { type: "source", text: "Fonte: Autor (2020).", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 6 }], confidence: "high", reasons: [] },
    ];
    const regions: Region[] = [{
      id: "layout-11-1", pageStart: 11, pageEnd: 11, startLineIndex: 3, endLineIndex: 5, kind: "quadro",
      caption: "Quadro 1 – Exemplo sintético para validação.", source: "Fonte: Autor (2020).", confidence: "high", reasons: [], logicalVisualId: "quadro-1-page-11",
    }];
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(visualInput(blocks, regions, { captionCount: 1, sourceCount: 1, unresolvedCount: 1 })));
    expect(documentXml).not.toContain("Linha interna um");
    expect(documentXml).not.toContain("Linha interna dois");
  });

  it("legenda aparece uma vez", async () => {
    const blocks: Block[] = [
      { type: "caption", text: "Quadro 1 – Exemplo sintético para validação.", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 2 }], confidence: "high", reasons: [] },
      { type: "unresolved", text: "Cabeçalho Coluna A Coluna B", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 3 }], confidence: "low", reasons: [], layoutRegionId: "layout-11-1" },
      { type: "paragraph", text: "Linha interna um conteúdo da célula esquerda e direita.", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 4 }], confidence: "medium", reasons: [] },
      { type: "source", text: "Fonte: Autor (2020).", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 6 }], confidence: "high", reasons: [] },
    ];
    const regions: Region[] = [{
      id: "layout-11-1", pageStart: 11, pageEnd: 11, startLineIndex: 3, endLineIndex: 5, kind: "quadro",
      caption: "Quadro 1 – Exemplo sintético para validação.", source: "Fonte: Autor (2020).", confidence: "high", reasons: [], logicalVisualId: "quadro-1-page-11",
    }];
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(visualInput(blocks, regions, { captionCount: 1, sourceCount: 1, unresolvedCount: 1 })));
    expect((documentXml.match(/Quadro 1 – Exemplo sintético para validação\./g) ?? []).length).toBe(1);
  });

  it("marcador aparece uma vez", async () => {
    const blocks: Block[] = [
      { type: "caption", text: "Quadro 1 – Exemplo sintético para validação.", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 2 }], confidence: "high", reasons: [] },
      { type: "unresolved", text: "Cabeçalho Coluna A Coluna B", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 3 }], confidence: "low", reasons: [], layoutRegionId: "layout-11-1" },
      { type: "paragraph", text: "Linha interna um conteúdo da célula esquerda e direita.", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 4 }], confidence: "medium", reasons: [] },
      { type: "source", text: "Fonte: Autor (2020).", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 6 }], confidence: "high", reasons: [] },
    ];
    const regions: Region[] = [{
      id: "layout-11-1", pageStart: 11, pageEnd: 11, startLineIndex: 3, endLineIndex: 5, kind: "quadro",
      caption: "Quadro 1 – Exemplo sintético para validação.", source: "Fonte: Autor (2020).", confidence: "high", reasons: [], logicalVisualId: "quadro-1-page-11",
    }];
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(visualInput(blocks, regions, { captionCount: 1, sourceCount: 1, unresolvedCount: 1 })));
    expect((documentXml.match(new RegExp(MARKER, "g")) ?? []).length).toBe(1);
  });

  it("fonte aparece uma vez", async () => {
    const blocks: Block[] = [
      { type: "caption", text: "Quadro 1 – Exemplo sintético para validação.", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 2 }], confidence: "high", reasons: [] },
      { type: "unresolved", text: "Cabeçalho Coluna A Coluna B", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 3 }], confidence: "low", reasons: [], layoutRegionId: "layout-11-1" },
      { type: "paragraph", text: "Linha interna um conteúdo da célula esquerda e direita.", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 4 }], confidence: "medium", reasons: [] },
      { type: "source", text: "Fonte: Autor (2020).", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 6 }], confidence: "high", reasons: [] },
    ];
    const regions: Region[] = [{
      id: "layout-11-1", pageStart: 11, pageEnd: 11, startLineIndex: 3, endLineIndex: 5, kind: "quadro",
      caption: "Quadro 1 – Exemplo sintético para validação.", source: "Fonte: Autor (2020).", confidence: "high", reasons: [], logicalVisualId: "quadro-1-page-11",
    }];
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(visualInput(blocks, regions, { captionCount: 1, sourceCount: 1, unresolvedCount: 1 })));
    expect((documentXml.match(/Fonte: Autor \(2020\)\./g) ?? []).length).toBe(1);
  });

  it("paragrafo anterior permanece", async () => {
    const blocks: Block[] = [
      { type: "paragraph", text: "Parágrafo anterior que deve permanecer no documento.", pageStart: 10, pageEnd: 10, sourceLines: [{ pageNumber: 10, lineIndex: 1 }], confidence: "medium", reasons: [] },
      { type: "caption", text: "Quadro 1 – Exemplo sintético para validação.", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 2 }], confidence: "high", reasons: [] },
      { type: "unresolved", text: "Cabeçalho Coluna A Coluna B", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 3 }], confidence: "low", reasons: [], layoutRegionId: "layout-11-1" },
      { type: "paragraph", text: "Linha interna um conteúdo da célula esquerda e direita.", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 4 }], confidence: "medium", reasons: [] },
      { type: "source", text: "Fonte: Autor (2020).", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 6 }], confidence: "high", reasons: [] },
    ];
    const regions: Region[] = [{
      id: "layout-11-1", pageStart: 11, pageEnd: 11, startLineIndex: 3, endLineIndex: 5, kind: "quadro",
      caption: "Quadro 1 – Exemplo sintético para validação.", source: "Fonte: Autor (2020).", confidence: "high", reasons: [], logicalVisualId: "quadro-1-page-11",
    }];
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(visualInput(blocks, regions, { paragraphCount: 2, captionCount: 1, sourceCount: 1, unresolvedCount: 1 })));
    expect(documentText(documentXml)).toContain("Parágrafo anterior que deve permanecer no documento.");
  });

  it("paragrafo posterior permanece", async () => {
    const blocks: Block[] = [
      { type: "caption", text: "Quadro 1 – Exemplo sintético para validação.", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 2 }], confidence: "high", reasons: [] },
      { type: "unresolved", text: "Cabeçalho Coluna A Coluna B", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 3 }], confidence: "low", reasons: [], layoutRegionId: "layout-11-1" },
      { type: "paragraph", text: "Linha interna um conteúdo da célula esquerda e direita.", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 4 }], confidence: "medium", reasons: [] },
      { type: "source", text: "Fonte: Autor (2020).", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 6 }], confidence: "high", reasons: [] },
      { type: "paragraph", text: "Parágrafo posterior que deve permanecer no documento.", pageStart: 12, pageEnd: 12, sourceLines: [{ pageNumber: 12, lineIndex: 1 }], confidence: "medium", reasons: [] },
    ];
    const regions: Region[] = [{
      id: "layout-11-1", pageStart: 11, pageEnd: 11, startLineIndex: 3, endLineIndex: 5, kind: "quadro",
      caption: "Quadro 1 – Exemplo sintético para validação.", source: "Fonte: Autor (2020).", confidence: "high", reasons: [], logicalVisualId: "quadro-1-page-11",
    }];
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(visualInput(blocks, regions, { paragraphCount: 2, captionCount: 1, sourceCount: 1, unresolvedCount: 1 })));
    expect(documentText(documentXml)).toContain("Parágrafo posterior que deve permanecer no documento.");
  });

  it("texto normal na mesma pagina mas fora da regiao permanece", async () => {
    const blocks: Block[] = [
      { type: "paragraph", text: "Texto normal na mesma página fora da região visual que permanece.", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 0 }], confidence: "medium", reasons: [] },
      { type: "caption", text: "Quadro 1 – Exemplo sintético para validação.", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 2 }], confidence: "high", reasons: [] },
      { type: "unresolved", text: "Cabeçalho Coluna A Coluna B", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 3 }], confidence: "low", reasons: [], layoutRegionId: "layout-11-1" },
      { type: "paragraph", text: "Linha interna um conteúdo da célula esquerda e direita.", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 4 }], confidence: "medium", reasons: [] },
      { type: "source", text: "Fonte: Autor (2020).", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 6 }], confidence: "high", reasons: [] },
    ];
    const regions: Region[] = [{
      id: "layout-11-1", pageStart: 11, pageEnd: 11, startLineIndex: 3, endLineIndex: 5, kind: "quadro",
      caption: "Quadro 1 – Exemplo sintético para validação.", source: "Fonte: Autor (2020).", confidence: "high", reasons: [], logicalVisualId: "quadro-1-page-11",
    }];
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(visualInput(blocks, regions, { paragraphCount: 2, captionCount: 1, sourceCount: 1, unresolvedCount: 1 })));
    const text = documentText(documentXml);
    expect(text).toContain("Texto normal na mesma página fora da região visual que permanece.");
    expect(text).not.toContain("Linha interna um");
  });

  it("duas regioes visuais na mesma pagina nao interferem entre si", async () => {
    const blocks: Block[] = [
      { type: "caption", text: "Quadro 1 – Primeiro quadro sintético.", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 2 }], confidence: "high", reasons: [] },
      { type: "unresolved", text: "Cabeçalho A", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 3 }], confidence: "low", reasons: [], layoutRegionId: "layout-11-1" },
      { type: "paragraph", text: "Linha interna do primeiro quadro sintético.", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 4 }], confidence: "medium", reasons: [] },
      { type: "source", text: "Fonte: Autor (2020).", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 5 }], confidence: "high", reasons: [] },
      { type: "caption", text: "Quadro 2 – Segundo quadro sintético.", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 8 }], confidence: "high", reasons: [] },
      { type: "unresolved", text: "Cabeçalho B", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 9 }], confidence: "low", reasons: [], layoutRegionId: "layout-11-2" },
      { type: "paragraph", text: "Linha interna do segundo quadro sintético.", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 10 }], confidence: "medium", reasons: [] },
      { type: "source", text: "Fonte: Autor (2021).", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 11 }], confidence: "high", reasons: [] },
    ];
    const regions: Region[] = [
      { id: "layout-11-1", pageStart: 11, pageEnd: 11, startLineIndex: 3, endLineIndex: 4, kind: "quadro", caption: "Quadro 1 – Primeiro quadro sintético.", source: "Fonte: Autor (2020).", confidence: "high", reasons: [], logicalVisualId: "quadro-1-page-11" },
      { id: "layout-11-2", pageStart: 11, pageEnd: 11, startLineIndex: 9, endLineIndex: 10, kind: "quadro", caption: "Quadro 2 – Segundo quadro sintético.", source: "Fonte: Autor (2021).", confidence: "high", reasons: [], logicalVisualId: "quadro-2-page-11" },
    ];
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(visualInput(blocks, regions, { paragraphCount: 2, captionCount: 2, sourceCount: 2, unresolvedCount: 2 })));
    const text = documentText(documentXml);
    expect(text).not.toContain("Linha interna do primeiro quadro");
    expect(text).not.toContain("Linha interna do segundo quadro");
    expect((documentXml.match(new RegExp(MARKER, "g")) ?? []).length).toBe(2);
    expect((documentXml.match(/Quadro 1 – Primeiro quadro sintético\./g) ?? []).length).toBe(1);
    expect((documentXml.match(/Quadro 2 – Segundo quadro sintético\./g) ?? []).length).toBe(1);
    expect((documentXml.match(/Fonte: Autor \(2020\)\./g) ?? []).length).toBe(1);
    expect((documentXml.match(/Fonte: Autor \(2021\)\./g) ?? []).length).toBe(1);
  });

  it("regiao multipagina nao elimina texto intermediario sem vinculo", async () => {
    const blocks: Block[] = [
      { type: "caption", text: "Quadro 9 – Quadro multipágina sintético.", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 2 }], confidence: "high", reasons: [] },
      { type: "unresolved", text: "Cabeçalho Quadro", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 3 }], confidence: "low", reasons: [], layoutRegionId: "layout-11-9" },
      { type: "paragraph", text: "Linha interna da primeira página do quadro.", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 4 }], confidence: "medium", reasons: [] },
      { type: "paragraph", text: "Texto acadêmico normal intermediário que deve ser preservado porque não pertence ao quadro e possui conteúdo substancial longo.", pageStart: 12, pageEnd: 12, sourceLines: [{ pageNumber: 12, lineIndex: 5 }], confidence: "medium", reasons: [] },
      { type: "paragraph", text: "Linha interna da página final do quadro conclusão.", pageStart: 13, pageEnd: 13, sourceLines: [{ pageNumber: 13, lineIndex: 1 }], confidence: "medium", reasons: [] },
      { type: "source", text: "Fonte: Autor (2021).", pageStart: 13, pageEnd: 13, sourceLines: [{ pageNumber: 13, lineIndex: 2 }], confidence: "high", reasons: [] },
    ];
    const regions: Region[] = [
      { id: "layout-11-9", pageStart: 11, pageEnd: 11, startLineIndex: 3, endLineIndex: 4, kind: "quadro",
        caption: "Quadro 9 – Quadro multipágina sintético.", source: "Fonte: Autor (2021).", confidence: "high", reasons: [], logicalVisualId: "quadro-9-page-11" },
      { id: "layout-13-9", pageStart: 13, pageEnd: 13, startLineIndex: 1, endLineIndex: 1, kind: "quadro",
        caption: "Quadro 9 – Quadro multipágina sintético.", source: "Fonte: Autor (2021).", confidence: "high", reasons: [], logicalVisualId: "quadro-9-page-11" },
    ];
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(visualInput(blocks, regions, { paragraphCount: 3, captionCount: 1, sourceCount: 1, unresolvedCount: 1 })));
    const text = documentText(documentXml);
    expect(text).not.toContain("Linha interna da primeira página do quadro.");
    expect(text).not.toContain("Linha interna da página final do quadro conclusão.");
    expect(text).toContain("Texto acadêmico normal intermediário que deve ser preservado porque não pertence ao quadro e possui conteúdo substancial longo.");
    expect((documentXml.match(new RegExp(MARKER, "g")) ?? []).length).toBe(1);
  });

  it("blocos sem regiao visual continuam inalterados", async () => {
    const blocks: Block[] = [
      { type: "paragraph", text: "Parágrafo isolado sem região visual associada que deve aparecer no documento final.", pageStart: 20, pageEnd: 20, sourceLines: [{ pageNumber: 20, lineIndex: 1 }], confidence: "medium", reasons: [] },
      { type: "list-item", text: "a) Item de lista isolado sem região visual que deve aparecer.", pageStart: 20, pageEnd: 20, sourceLines: [{ pageNumber: 20, lineIndex: 2 }], confidence: "medium", reasons: [] },
    ];
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(visualInput(blocks, [], { paragraphCount: 1, listItemCount: 1 })));
    const text = documentText(documentXml);
    expect(text).toContain("Parágrafo isolado sem região visual associada que deve aparecer no documento final.");
    expect(text).toContain("a) Item de lista isolado sem região visual que deve aparecer.");
  });

  it("FALHA 5: legenda de quadro multipagina aparece uma unica vez (continuacoes suprimidas)", async () => {
    const lid = "quadro-16-page-100";
    const blocks: Block[] = [
      { type: "paragraph", text: "Parágrafo de contexto antes do quadro multipágina.", pageStart: 99, pageEnd: 99, sourceLines: [{ pageNumber: 99, lineIndex: 1 }], confidence: "medium", reasons: [] },
      { type: "caption", text: "Quadro 16 – Título.", pageStart: 100, pageEnd: 100, sourceLines: [{ pageNumber: 100, lineIndex: 2 }], confidence: "high", reasons: [] },
      { type: "unresolved", text: "Cabeçalho A", pageStart: 100, pageEnd: 100, sourceLines: [{ pageNumber: 100, lineIndex: 3 }], confidence: "low", reasons: [], layoutRegionId: "layout-100-16" },
      { type: "caption", text: "Quadro 16 – (continuação).", pageStart: 101, pageEnd: 101, sourceLines: [{ pageNumber: 101, lineIndex: 2 }], confidence: "high", reasons: [] },
      { type: "unresolved", text: "Célula B", pageStart: 101, pageEnd: 101, sourceLines: [{ pageNumber: 101, lineIndex: 3 }], confidence: "low", reasons: [], layoutRegionId: "layout-101-16" },
      { type: "caption", text: "Quadro 16 – (continuação).", pageStart: 102, pageEnd: 102, sourceLines: [{ pageNumber: 102, lineIndex: 2 }], confidence: "high", reasons: [] },
      { type: "unresolved", text: "Célula C", pageStart: 102, pageEnd: 102, sourceLines: [{ pageNumber: 102, lineIndex: 3 }], confidence: "low", reasons: [], layoutRegionId: "layout-102-16" },
      { type: "caption", text: "Quadro 16 – (conclusão).", pageStart: 104, pageEnd: 104, sourceLines: [{ pageNumber: 104, lineIndex: 2 }], confidence: "high", reasons: [] },
      { type: "unresolved", text: "Célula D", pageStart: 104, pageEnd: 104, sourceLines: [{ pageNumber: 104, lineIndex: 3 }], confidence: "low", reasons: [], layoutRegionId: "layout-104-16" },
    ];
    const regions: Region[] = [
      { id: "layout-100-16", pageStart: 100, pageEnd: 100, startLineIndex: 3, endLineIndex: 3, kind: "quadro", caption: "Quadro 16 – Título.", confidence: "high", reasons: [], logicalVisualId: lid },
      { id: "layout-101-16", pageStart: 101, pageEnd: 101, startLineIndex: 3, endLineIndex: 3, kind: "quadro", caption: "Quadro 16 – (continuação).", confidence: "high", reasons: [], logicalVisualId: lid },
      { id: "layout-102-16", pageStart: 102, pageEnd: 102, startLineIndex: 3, endLineIndex: 3, kind: "quadro", caption: "Quadro 16 – (continuação).", confidence: "high", reasons: [], logicalVisualId: lid },
      { id: "layout-104-16", pageStart: 104, pageEnd: 104, startLineIndex: 3, endLineIndex: 3, kind: "quadro", caption: "Quadro 16 – (conclusão).", confidence: "high", reasons: [], logicalVisualId: lid },
    ];
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(visualInput(blocks, regions, { paragraphCount: 1, captionCount: 4, unresolvedCount: 4 })));
    const text = documentText(documentXml);
    expect((text.match(/Quadro 16 – Título\./g) ?? []).length).toBe(1);
    expect(text).not.toContain("Quadro 16 – (continuação).");
    expect(text).not.toContain("Quadro 16 – (conclusão).");
    expect((documentXml.match(new RegExp(MARKER, "g")) ?? []).length).toBe(1);
  });

  it("FALHA 6: fonte do quadro multipagina aparece uma unica vez", async () => {
    const lid = "quadro-16-fonte-page-100";
    const blocks: Block[] = [
      { type: "paragraph", text: "Parágrafo de contexto antes do quadro multipágina.", pageStart: 99, pageEnd: 99, sourceLines: [{ pageNumber: 99, lineIndex: 1 }], confidence: "medium", reasons: [] },
      { type: "caption", text: "Quadro 16 – Título.", pageStart: 100, pageEnd: 100, sourceLines: [{ pageNumber: 100, lineIndex: 2 }], confidence: "high", reasons: [] },
      { type: "unresolved", text: "Cabeçalho A", pageStart: 100, pageEnd: 100, sourceLines: [{ pageNumber: 100, lineIndex: 3 }], confidence: "low", reasons: [], layoutRegionId: "layout-100-16f" },
      { type: "source", text: "Fonte: Autor (2025).", pageStart: 100, pageEnd: 100, sourceLines: [{ pageNumber: 100, lineIndex: 5 }], confidence: "high", reasons: [] },
      { type: "unresolved", text: "Célula B", pageStart: 101, pageEnd: 101, sourceLines: [{ pageNumber: 101, lineIndex: 3 }], confidence: "low", reasons: [], layoutRegionId: "layout-101-16f" },
      { type: "source", text: "Fonte: Autor (2025).", pageStart: 101, pageEnd: 101, sourceLines: [{ pageNumber: 101, lineIndex: 5 }], confidence: "high", reasons: [] },
      { type: "unresolved", text: "Célula C", pageStart: 102, pageEnd: 102, sourceLines: [{ pageNumber: 102, lineIndex: 3 }], confidence: "low", reasons: [], layoutRegionId: "layout-102-16f" },
      { type: "source", text: "Fonte: Autor (2025).", pageStart: 102, pageEnd: 102, sourceLines: [{ pageNumber: 102, lineIndex: 5 }], confidence: "high", reasons: [] },
    ];
    const regions: Region[] = [
      { id: "layout-100-16f", pageStart: 100, pageEnd: 100, startLineIndex: 3, endLineIndex: 4, kind: "quadro", caption: "Quadro 16 – Título.", source: "Fonte: Autor (2025).", confidence: "high", reasons: [], logicalVisualId: lid },
      { id: "layout-101-16f", pageStart: 101, pageEnd: 101, startLineIndex: 3, endLineIndex: 4, kind: "quadro", caption: "Quadro 16 – Título.", source: "Fonte: Autor (2025).", confidence: "high", reasons: [], logicalVisualId: lid },
      { id: "layout-102-16f", pageStart: 102, pageEnd: 102, startLineIndex: 3, endLineIndex: 4, kind: "quadro", caption: "Quadro 16 – Título.", source: "Fonte: Autor (2025).", confidence: "high", reasons: [], logicalVisualId: lid },
    ];
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(visualInput(blocks, regions, { paragraphCount: 1, captionCount: 1, sourceCount: 3, unresolvedCount: 3 })));
    const text = documentText(documentXml);
    expect((text.match(/Fonte: Autor \(2025\)\./g) ?? []).length).toBe(1);
  });

  it("FALHA 7: conteudo interno do grupo multipagina e suprimido; texto externo ao intervalo permanece", async () => {
    const lid = "quadro-mp-page-100";
    const blocks: Block[] = [
      { type: "caption", text: "Quadro MP – Multipágina.", pageStart: 100, pageEnd: 100, sourceLines: [{ pageNumber: 100, lineIndex: 2 }], confidence: "high", reasons: [] },
      { type: "unresolved", text: "Célula início", pageStart: 100, pageEnd: 100, sourceLines: [{ pageNumber: 100, lineIndex: 3 }], confidence: "low", reasons: [], layoutRegionId: "layout-100-mp" },
      { type: "paragraph", text: "Texto interno da primeira página que deve ser suprimido.", pageStart: 100, pageEnd: 100, sourceLines: [{ pageNumber: 100, lineIndex: 4 }], confidence: "medium", reasons: [] },
      { type: "paragraph", text: "Texto acadêmico estritamente fora do intervalo do quadro preservado.", pageStart: 101, pageEnd: 101, sourceLines: [{ pageNumber: 101, lineIndex: 5 }], confidence: "medium", reasons: [] },
      { type: "caption", text: "Quadro MP – (conclusão).", pageStart: 102, pageEnd: 102, sourceLines: [{ pageNumber: 102, lineIndex: 0 }], confidence: "high", reasons: [] },
      { type: "unresolved", text: "Célula fim", pageStart: 102, pageEnd: 102, sourceLines: [{ pageNumber: 102, lineIndex: 1 }], confidence: "low", reasons: [], layoutRegionId: "layout-102-mp" },
      { type: "paragraph", text: "Texto interno da página final que deve ser suprimido.", pageStart: 102, pageEnd: 102, sourceLines: [{ pageNumber: 102, lineIndex: 2 }], confidence: "medium", reasons: [] },
    ];
    const regions: Region[] = [
      { id: "layout-100-mp", pageStart: 100, pageEnd: 100, startLineIndex: 3, endLineIndex: 4, kind: "quadro", caption: "Quadro MP – Multipágina.", confidence: "high", reasons: [], logicalVisualId: lid },
      { id: "layout-102-mp", pageStart: 102, pageEnd: 102, startLineIndex: 1, endLineIndex: 2, kind: "quadro", caption: "Quadro MP – (conclusão).", confidence: "high", reasons: [], logicalVisualId: lid },
    ];
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(visualInput(blocks, regions, { paragraphCount: 2, captionCount: 2, unresolvedCount: 2 })));
    const text = documentText(documentXml);
    expect(text).not.toContain("Texto interno da primeira página que deve ser suprimido.");
    expect(text).not.toContain("Texto interno da página final que deve ser suprimido.");
    expect(text).toContain("Texto acadêmico estritamente fora do intervalo do quadro preservado.");
    expect((documentXml.match(new RegExp(MARKER, "g")) ?? []).length).toBe(1);
  });

  it("FALHA 9: contagem de marcadores na nota de revisao igual a marcadores no corpo", async () => {
    const blocks: Block[] = [
      { type: "paragraph", text: "Parágrafo de contexto antes dos quadros.", pageStart: 10, pageEnd: 10, sourceLines: [{ pageNumber: 10, lineIndex: 1 }], confidence: "medium", reasons: [] },
      { type: "caption", text: "Quadro 1 – A.", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 2 }], confidence: "high", reasons: [] },
      { type: "unresolved", text: "Célula A", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 3 }], confidence: "low", reasons: [], layoutRegionId: "layout-11-a" },
      { type: "caption", text: "Quadro 2 – B.", pageStart: 12, pageEnd: 12, sourceLines: [{ pageNumber: 12, lineIndex: 2 }], confidence: "high", reasons: [] },
      { type: "unresolved", text: "Célula B", pageStart: 12, pageEnd: 12, sourceLines: [{ pageNumber: 12, lineIndex: 3 }], confidence: "low", reasons: [], layoutRegionId: "layout-12-b" },
      { type: "caption", text: "Quadro 3 – C.", pageStart: 13, pageEnd: 13, sourceLines: [{ pageNumber: 13, lineIndex: 2 }], confidence: "high", reasons: [] },
      { type: "unresolved", text: "Célula C", pageStart: 13, pageEnd: 13, sourceLines: [{ pageNumber: 13, lineIndex: 3 }], confidence: "low", reasons: [], layoutRegionId: "layout-13-c" },
    ];
    const regions: Region[] = [
      { id: "layout-11-a", pageStart: 11, pageEnd: 11, startLineIndex: 3, endLineIndex: 3, kind: "quadro", caption: "Quadro 1 – A.", confidence: "high", reasons: [], logicalVisualId: "quadro-a" },
      { id: "layout-12-b", pageStart: 12, pageEnd: 12, startLineIndex: 3, endLineIndex: 3, kind: "quadro", caption: "Quadro 2 – B.", confidence: "high", reasons: [], logicalVisualId: "quadro-b" },
      { id: "layout-13-c", pageStart: 13, pageEnd: 13, startLineIndex: 3, endLineIndex: 3, kind: "quadro", caption: "Quadro 3 – C.", confidence: "high", reasons: [], logicalVisualId: "quadro-c" },
    ];
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(visualInput(blocks, regions, { paragraphCount: 1, captionCount: 3, unresolvedCount: 3 })));
    const text = documentText(documentXml);
    const noteMatch = text.match(/Elementos visuais representados por marcadores:\s*(\d+)/);
    expect(noteMatch).not.toBeNull();
    const noteCount = Number(noteMatch![1]);
    const bodyCount = (documentXml.match(new RegExp(MARKER, "g")) ?? []).length;
    expect(noteCount).toBe(bodyCount);
    expect(bodyCount).toBe(3);
  });
});

describe("span visual incompleto sem fonte no pdf", () => {
  type Block = PdfTextDraftExportInput["reconstruction"]["blocks"][number];
  type Region = PdfTextDraftExportInput["reconstruction"]["layoutRegions"][number];

  function incompleteInput(blocks: Block[], layoutRegions: Region[] = [], overrides: Partial<PdfTextDraftExportInput["reconstruction"]["statistics"]> = {}): PdfTextDraftExportInput {
    return baseInput({
      reconstruction: {
        ...baseInput().reconstruction,
        blocks,
        layoutRegions,
        statistics: { ...baseInput().reconstruction.statistics, ...overrides },
      },
    });
  }

  const MARKER = "Elemento visual não inserido";

  it("legenda sem fonte seguida de paragrafo normal mantem o paragrafo", async () => {
    const blocks: Block[] = [
      { type: "caption", text: "Figura 1 – Elemento sem fonte detectada.", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 2 }], confidence: "high", reasons: [] },
      { type: "paragraph", text: "Parágrafo normal após figura sem fonte que deve permanecer no documento.", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 4 }], confidence: "medium", reasons: [] },
    ];
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(incompleteInput(blocks, [], { captionCount: 1, paragraphCount: 1 })));
    const text = documentText(documentXml);
    expect(text).toContain("Figura 1 – Elemento sem fonte detectada.");
    expect(text).toContain("Parágrafo normal após figura sem fonte que deve permanecer no documento.");
  });

  it("legenda sem fonte no final do documento nao remove paragrafos anterior ou posterior", async () => {
    const blocks: Block[] = [
      { type: "paragraph", text: "Parágrafo antes da legenda final sem fonte que permanece.", pageStart: 10, pageEnd: 10, sourceLines: [{ pageNumber: 10, lineIndex: 1 }], confidence: "medium", reasons: [] },
      { type: "caption", text: "Quadro 5 – Sem fonte no fim do documento.", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 2 }], confidence: "high", reasons: [] },
      { type: "paragraph", text: "Parágrafo depois da legenda final sem fonte que permanece.", pageStart: 12, pageEnd: 12, sourceLines: [{ pageNumber: 12, lineIndex: 1 }], confidence: "medium", reasons: [] },
    ];
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(incompleteInput(blocks, [], { captionCount: 1, paragraphCount: 2 })));
    const text = documentText(documentXml);
    expect(text).toContain("Parágrafo antes da legenda final sem fonte que permanece.");
    expect(text).toContain("Parágrafo depois da legenda final sem fonte que permanece.");
  });

  it("duas legendas consecutivas com apenas a segunda seguida de fonte", async () => {
    const blocks: Block[] = [
      { type: "caption", text: "Quadro 6 – Sem fonte correspondente.", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 2 }], confidence: "high", reasons: [] },
      { type: "paragraph", text: "Parágrafo entre as duas legendas que não deve ser suprimido.", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 4 }], confidence: "medium", reasons: [] },
      { type: "caption", text: "Quadro 7 – Com fonte correspondente.", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 6 }], confidence: "high", reasons: [] },
      { type: "unresolved", text: "Cabeçalho Q7", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 7 }], confidence: "low", reasons: [], layoutRegionId: "layout-11-7" },
      { type: "paragraph", text: "Linha interna da segunda legenda que deve ser suprimida.", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 8 }], confidence: "medium", reasons: [] },
      { type: "source", text: "Fonte: Autor (2022).", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 9 }], confidence: "high", reasons: [] },
      { type: "paragraph", text: "Parágrafo posterior às duas legendas que permanece.", pageStart: 12, pageEnd: 12, sourceLines: [{ pageNumber: 12, lineIndex: 1 }], confidence: "medium", reasons: [] },
    ];
    const regions: Region[] = [{
      id: "layout-11-7", pageStart: 11, pageEnd: 11, startLineIndex: 7, endLineIndex: 8, kind: "quadro",
      caption: "Quadro 7 – Com fonte correspondente.", source: "Fonte: Autor (2022).", confidence: "high", reasons: [], logicalVisualId: "quadro-7-page-11",
    }];
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(incompleteInput(blocks, regions, { captionCount: 2, paragraphCount: 3, sourceCount: 1, unresolvedCount: 1 })));
    const text = documentText(documentXml);
    expect(text).toContain("Parágrafo entre as duas legendas que não deve ser suprimido.");
    expect(text).not.toContain("Linha interna da segunda legenda que deve ser suprimida.");
    expect(text).toContain("Parágrafo posterior às duas legendas que permanece.");
    expect((documentXml.match(new RegExp(MARKER, "g")) ?? []).length).toBe(1);
  });

  it("legenda e fonte completas continuam suprimindo conteudo interno", async () => {
    const blocks: Block[] = [
      { type: "caption", text: "Quadro 1 – Completo com fonte.", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 2 }], confidence: "high", reasons: [] },
      { type: "unresolved", text: "Cabeçalho Completo", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 3 }], confidence: "low", reasons: [], layoutRegionId: "layout-11-1" },
      { type: "paragraph", text: "Linha interna completa que deve ser suprimida.", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 4 }], confidence: "medium", reasons: [] },
      { type: "source", text: "Fonte: Autor (2020).", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 6 }], confidence: "high", reasons: [] },
      { type: "paragraph", text: "Parágrafo após fonte completa que permanece.", pageStart: 12, pageEnd: 12, sourceLines: [{ pageNumber: 12, lineIndex: 1 }], confidence: "medium", reasons: [] },
    ];
    const regions: Region[] = [{
      id: "layout-11-1", pageStart: 11, pageEnd: 11, startLineIndex: 3, endLineIndex: 5, kind: "quadro",
      caption: "Quadro 1 – Completo com fonte.", source: "Fonte: Autor (2020).", confidence: "high", reasons: [], logicalVisualId: "quadro-1-page-11",
    }];
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(incompleteInput(blocks, regions, { captionCount: 1, paragraphCount: 2, sourceCount: 1, unresolvedCount: 1 })));
    const text = documentText(documentXml);
    expect(text).not.toContain("Linha interna completa que deve ser suprimida.");
    expect(text).toContain("Parágrafo após fonte completa que permanece.");
    expect((documentXml.match(new RegExp(MARKER, "g")) ?? []).length).toBe(1);
  });

  it("caso sintetico existente de Quadro 1 continua passando", async () => {
    const blocks: Block[] = [
      { type: "caption", text: "Quadro 1 – Exemplo sintético para validação.", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 2 }], confidence: "high", reasons: [] },
      { type: "unresolved", text: "Cabeçalho Coluna A Coluna B", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 3 }], confidence: "low", reasons: [], layoutRegionId: "layout-11-1" },
      { type: "paragraph", text: "Linha interna um conteúdo da célula esquerda e direita.", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 4 }], confidence: "medium", reasons: [] },
      { type: "source", text: "Fonte: Autor (2020).", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 6 }], confidence: "high", reasons: [] },
    ];
    const regions: Region[] = [{
      id: "layout-11-1", pageStart: 11, pageEnd: 11, startLineIndex: 3, endLineIndex: 5, kind: "quadro",
      caption: "Quadro 1 – Exemplo sintético para validação.", source: "Fonte: Autor (2020).", confidence: "high", reasons: [], logicalVisualId: "quadro-1-page-11",
    }];
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(incompleteInput(blocks, regions, { captionCount: 1, sourceCount: 1, unresolvedCount: 1 })));
    const text = documentText(documentXml);
    expect(text).toContain("Quadro 1 – Exemplo sintético para validação.");
    expect(text).toContain(MARKER);
    expect(text).toContain("Fonte: Autor (2020).");
    expect(text).not.toContain("Linha interna um");
  });

  it("legenda sem fonte nao gera marcador duplicado nem altera a legenda", async () => {
    const blocks: Block[] = [
      { type: "caption", text: "Figura 3 – Sem fonte nem marcador.", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 2 }], confidence: "high", reasons: [] },
      { type: "paragraph", text: "Texto normal após figura sem fonte que permanece.", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 4 }], confidence: "medium", reasons: [] },
    ];
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(incompleteInput(blocks, [], { captionCount: 1, paragraphCount: 1 })));
    const text = documentText(documentXml);
    expect((documentXml.match(new RegExp(MARKER, "g")) ?? []).length).toBe(0);
    expect((documentXml.match(/Figura 3 – Sem fonte nem marcador\./g) ?? []).length).toBe(1);
    expect(text).toContain("Texto normal após figura sem fonte que permanece.");
  });
});

describe("ativos visuais de regioes pdf", () => {
  type Block = PdfTextDraftExportInput["reconstruction"]["blocks"][number];
  type Region = PdfTextDraftExportInput["reconstruction"]["layoutRegions"][number];

  const logo = readFileSync(join(process.cwd(), "public", "assets", "ufla-logo.jpeg"));

  function asset(key: string, width = 170, height = 69): PdfTextDraftVisualAsset {
    return { data: logo, width, height, altText: { title: `Imagem ${key}`, description: `Descrição ${key}`, name: key } };
  }

  function visualInput(blocks: Block[], layoutRegions: Region[], overrides: Partial<PdfTextDraftExportInput> & { statistics?: Partial<PdfTextDraftExportInput["reconstruction"]["statistics"]> } = {}): PdfTextDraftExportInput {
    return baseInput({
      reconstruction: {
        ...baseInput().reconstruction,
        blocks,
        layoutRegions,
        statistics: { ...baseInput().reconstruction.statistics, ...overrides.statistics },
      },
      ...overrides,
    });
  }

  it("regiao com ativo insere imagem, mantem legenda e fonte, e nao insere marcador", async () => {
    const input = visualInput([
      { type: "paragraph", text: "Parágrafo anterior.", pageStart: 10, pageEnd: 10, sourceLines: [{ pageNumber: 10, lineIndex: 1 }], confidence: "medium", reasons: [] },
      { type: "caption", text: "Figura 1 – Exemplo.", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 2 }], confidence: "high", reasons: [], layoutRegionId: "layout-11-1" },
      { type: "source", text: "Fonte: Autor.", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 3 }], confidence: "high", reasons: [], layoutRegionId: "layout-11-1" },
      { type: "paragraph", text: "Parágrafo posterior.", pageStart: 12, pageEnd: 12, sourceLines: [{ pageNumber: 12, lineIndex: 1 }], confidence: "medium", reasons: [] },
    ], [{
      id: "layout-11-1", pageStart: 11, pageEnd: 11, startLineIndex: 2, endLineIndex: 3, kind: "figura",
      caption: "Figura 1 – Exemplo.", source: "Fonte: Autor.", confidence: "high", reasons: [], logicalVisualId: "figura-1-page-11",
    }], {
      visualAssets: { "figura-1-page-11": asset("figura-1-page-11") },
      statistics: { paragraphCount: 2, captionCount: 1, sourceCount: 1, layoutRegionCount: 1 },
    });
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(input));
    expect(documentXml).toContain("<w:drawing");
    expect(documentXml).toContain("Figura 1 – Exemplo.");
    expect(documentXml).toContain("Fonte: Autor.");
    expect(documentXml).not.toContain("Elemento visual não inserido");
    expect(documentXml).toContain("Parágrafo anterior.");
    expect(documentXml).toContain("Parágrafo posterior.");
  });

  it("FALHA 8: grafico com ativo e inserido como imagem (nao como marcador)", async () => {
    const input = visualInput([
      { type: "paragraph", text: "Parágrafo anterior.", pageStart: 10, pageEnd: 10, sourceLines: [{ pageNumber: 10, lineIndex: 1 }], confidence: "medium", reasons: [] },
      { type: "caption", text: "Gráfico 10 – Exemplo.", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 2 }], confidence: "high", reasons: [], layoutRegionId: "layout-11-g" },
      { type: "source", text: "Fonte: Autor.", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 3 }], confidence: "high", reasons: [], layoutRegionId: "layout-11-g" },
      { type: "paragraph", text: "Parágrafo posterior.", pageStart: 12, pageEnd: 12, sourceLines: [{ pageNumber: 12, lineIndex: 1 }], confidence: "medium", reasons: [] },
    ], [{
      id: "layout-11-g", pageStart: 11, pageEnd: 11, startLineIndex: 2, endLineIndex: 3, kind: "grafico",
      caption: "Gráfico 10 – Exemplo.", source: "Fonte: Autor.", confidence: "high", reasons: [], logicalVisualId: "grafico-10-page-11",
    }], {
      visualAssets: { "grafico-10-page-11": asset("grafico-10-page-11") },
      statistics: { paragraphCount: 2, captionCount: 1, sourceCount: 1, layoutRegionCount: 1 },
    });
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(input));
    expect(documentXml).toContain("<w:drawing");
    expect(documentXml).toContain("Gráfico 10 – Exemplo.");
    expect(documentXml).toContain("Fonte: Autor.");
    expect(documentXml).not.toContain("Elemento visual não inserido");
    expect(documentXml).toContain("Parágrafo anterior.");
    expect(documentXml).toContain("Parágrafo posterior.");
  });

  it("regiao sem ativo mantem marcador textual", async () => {
    const input = visualInput([
      { type: "paragraph", text: "Parágrafo anterior.", pageStart: 10, pageEnd: 10, sourceLines: [{ pageNumber: 10, lineIndex: 1 }], confidence: "medium", reasons: [] },
      { type: "caption", text: "Figura 2 – Sem ativo.", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 2 }], confidence: "high", reasons: [], layoutRegionId: "layout-11-2" },
      { type: "source", text: "Fonte: Autor.", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 3 }], confidence: "high", reasons: [], layoutRegionId: "layout-11-2" },
    ], [{
      id: "layout-11-2", pageStart: 11, pageEnd: 11, startLineIndex: 2, endLineIndex: 3, kind: "figura",
      caption: "Figura 2 – Sem ativo.", source: "Fonte: Autor.", confidence: "high", reasons: [], logicalVisualId: "figura-2-page-11",
    }], {
      logo: undefined,
      statistics: { paragraphCount: 1, captionCount: 1, sourceCount: 1, layoutRegionCount: 1 },
    });
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(input));
    expect(documentXml).toContain("Elemento visual não inserido");
    expect(documentXml).not.toContain("<w:drawing");
  });

  it("dois blocos com o mesmo logicalVisualId geram somente uma imagem", async () => {
    const input = visualInput([
      { type: "paragraph", text: "Texto antes.", pageStart: 10, pageEnd: 10, sourceLines: [{ pageNumber: 10, lineIndex: 1 }], confidence: "medium", reasons: [] },
      { type: "caption", text: "Figura 3 – Continua.", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 2 }], confidence: "high", reasons: [], layoutRegionId: "layout-11-3" },
      { type: "source", text: "Fonte: Autor.", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 3 }], confidence: "high", reasons: [], layoutRegionId: "layout-11-3" },
      { type: "caption", text: "Figura 3 – Continuação.", pageStart: 12, pageEnd: 12, sourceLines: [{ pageNumber: 12, lineIndex: 0 }], confidence: "high", reasons: [], layoutRegionId: "layout-12-3" },
      { type: "source", text: "Fonte: Autor.", pageStart: 12, pageEnd: 12, sourceLines: [{ pageNumber: 12, lineIndex: 1 }], confidence: "high", reasons: [], layoutRegionId: "layout-12-3" },
    ], [{
      id: "layout-11-3", pageStart: 11, pageEnd: 11, startLineIndex: 2, endLineIndex: 3, kind: "figura",
      caption: "Figura 3 – Continua.", source: "Fonte: Autor.", confidence: "high", reasons: [], logicalVisualId: "figura-3-page-11",
    }, {
      id: "layout-12-3", pageStart: 12, pageEnd: 12, startLineIndex: 0, endLineIndex: 1, kind: "figura",
      caption: "Figura 3 – Continuação.", source: "Fonte: Autor.", confidence: "high", reasons: [], logicalVisualId: "figura-3-page-11",
    }], {
      includeReconstructedPretextuals: false,
      visualAssets: { "figura-3-page-11": asset("figura-3-page-11") },
      statistics: { paragraphCount: 1, captionCount: 2, sourceCount: 2, layoutRegionCount: 2 },
    });
    const zip = await JSZip.loadAsync(await buildPdfTextDraftDocxBlob(input).then((blob) => blob.arrayBuffer()));
    const mediaFiles = Object.keys(zip.files).filter((entry) => entry.startsWith("word/media/") && !entry.endsWith("/"));
    expect(mediaFiles).toHaveLength(1);
  });

  it("duas regioes diferentes com ativos geram duas imagens", async () => {
    const input = visualInput([
      { type: "paragraph", text: "Texto antes.", pageStart: 10, pageEnd: 10, sourceLines: [{ pageNumber: 10, lineIndex: 1 }], confidence: "medium", reasons: [] },
      { type: "caption", text: "Figura 4 – Primeira.", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 2 }], confidence: "high", reasons: [], layoutRegionId: "layout-11-4" },
      { type: "source", text: "Fonte: Autor A.", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 3 }], confidence: "high", reasons: [], layoutRegionId: "layout-11-4" },
      { type: "caption", text: "Figura 5 – Segunda.", pageStart: 12, pageEnd: 12, sourceLines: [{ pageNumber: 12, lineIndex: 0 }], confidence: "high", reasons: [], layoutRegionId: "layout-12-5" },
      { type: "source", text: "Fonte: Autor B.", pageStart: 12, pageEnd: 12, sourceLines: [{ pageNumber: 12, lineIndex: 1 }], confidence: "high", reasons: [], layoutRegionId: "layout-12-5" },
    ], [{
      id: "layout-11-4", pageStart: 11, pageEnd: 11, startLineIndex: 2, endLineIndex: 3, kind: "figura",
      caption: "Figura 4 – Primeira.", source: "Fonte: Autor A.", confidence: "high", reasons: [], logicalVisualId: "figura-4-page-11",
    }, {
      id: "layout-12-5", pageStart: 12, pageEnd: 12, startLineIndex: 0, endLineIndex: 1, kind: "figura",
      caption: "Figura 5 – Segunda.", source: "Fonte: Autor B.", confidence: "high", reasons: [], logicalVisualId: "figura-5-page-12",
    }], {
      includeReconstructedPretextuals: false,
      visualAssets: { "figura-4-page-11": asset("figura-4-page-11"), "figura-5-page-12": asset("figura-5-page-12", 80, 60) },
      statistics: { paragraphCount: 1, captionCount: 2, sourceCount: 2, layoutRegionCount: 2 },
    });
    const zip = await JSZip.loadAsync(await buildPdfTextDraftDocxBlob(input).then((blob) => blob.arrayBuffer()));
    const mediaFiles = Object.keys(zip.files).filter((entry) => entry.startsWith("word/media/") && !entry.endsWith("/"));
    expect(mediaFiles).toHaveLength(2);
  });

  it("imagem visual e logotipo coexistem no mesmo documento", async () => {
    const logo = readFileSync(join(process.cwd(), "public", "assets", "ufla-logo.jpeg"));
    const input = visualInput([
      { type: "paragraph", text: "Texto antes.", pageStart: 10, pageEnd: 10, sourceLines: [{ pageNumber: 10, lineIndex: 1 }], confidence: "medium", reasons: [] },
      { type: "caption", text: "Figura 6 – Com logo.", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 2 }], confidence: "high", reasons: [], layoutRegionId: "layout-11-6" },
      { type: "source", text: "Fonte: Autor.", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 3 }], confidence: "high", reasons: [], layoutRegionId: "layout-11-6" },
    ], [{
      id: "layout-11-6", pageStart: 11, pageEnd: 11, startLineIndex: 2, endLineIndex: 3, kind: "figura",
      caption: "Figura 6 – Com logo.", source: "Fonte: Autor.", confidence: "high", reasons: [], logicalVisualId: "figura-6-page-11",
    }], {
      logo: { data: logo, width: 170, height: 69 },
      visualAssets: { "figura-6-page-11": asset("figura-6-page-11") },
      statistics: { paragraphCount: 1, captionCount: 1, sourceCount: 1, layoutRegionCount: 1 },
    });
    const zip = await JSZip.loadAsync(await buildPdfTextDraftDocxBlob(input).then((blob) => blob.arrayBuffer()));
    const mediaFiles = Object.keys(zip.files).filter((entry) => entry.startsWith("word/media/") && !entry.endsWith("/"));
    expect(mediaFiles.length).toBeGreaterThanOrEqual(2);
  });

  it("texto anterior e posterior a imagem visual permanece", async () => {
    const input = visualInput([
      { type: "paragraph", text: "Texto anterior que deve permanecer.", pageStart: 10, pageEnd: 10, sourceLines: [{ pageNumber: 10, lineIndex: 1 }], confidence: "medium", reasons: [] },
      { type: "caption", text: "Figura 7 – Meio.", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 2 }], confidence: "high", reasons: [], layoutRegionId: "layout-11-7" },
      { type: "source", text: "Fonte: Autor.", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 3 }], confidence: "high", reasons: [], layoutRegionId: "layout-11-7" },
      { type: "paragraph", text: "Texto posterior que deve permanecer.", pageStart: 12, pageEnd: 12, sourceLines: [{ pageNumber: 12, lineIndex: 1 }], confidence: "medium", reasons: [] },
    ], [{
      id: "layout-11-7", pageStart: 11, pageEnd: 11, startLineIndex: 2, endLineIndex: 3, kind: "figura",
      caption: "Figura 7 – Meio.", source: "Fonte: Autor.", confidence: "high", reasons: [], logicalVisualId: "figura-7-page-11",
    }], {
      visualAssets: { "figura-7-page-11": asset("figura-7-page-11") },
      statistics: { paragraphCount: 2, captionCount: 1, sourceCount: 1, layoutRegionCount: 1 },
    });
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(input));
    expect(documentXml).toContain("Texto anterior que deve permanecer.");
    expect(documentXml).toContain("Texto posterior que deve permanecer.");
  });

  it("documento com imagem visual nao contem w:tbl nem w:numPr", async () => {
    const input = visualInput([
      { type: "paragraph", text: "Texto antes.", pageStart: 10, pageEnd: 10, sourceLines: [{ pageNumber: 10, lineIndex: 1 }], confidence: "medium", reasons: [] },
      { type: "caption", text: "Figura 8 – Simples.", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 2 }], confidence: "high", reasons: [], layoutRegionId: "layout-11-8" },
      { type: "source", text: "Fonte: Autor.", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 3 }], confidence: "high", reasons: [], layoutRegionId: "layout-11-8" },
    ], [{
      id: "layout-11-8", pageStart: 11, pageEnd: 11, startLineIndex: 2, endLineIndex: 3, kind: "figura",
      caption: "Figura 8 – Simples.", source: "Fonte: Autor.", confidence: "high", reasons: [], logicalVisualId: "figura-8-page-11",
    }], {
      includeReconstructedPretextuals: false,
      visualAssets: { "figura-8-page-11": asset("figura-8-page-11") },
      statistics: { paragraphCount: 1, captionCount: 1, sourceCount: 1, layoutRegionCount: 1 },
    });
    const { documentXml, settingsXml, stylesXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(input));
    const allXml = `${documentXml}\n${settingsXml}\n${stylesXml}`;
    expect(allXml).not.toContain("<w:tbl");
    expect(allXml).not.toContain("<w:numPr");
  });

  it("docx gerado com imagem visual e zip ooxml valido", async () => {
    const input = visualInput([
      { type: "paragraph", text: "Texto antes.", pageStart: 10, pageEnd: 10, sourceLines: [{ pageNumber: 10, lineIndex: 1 }], confidence: "medium", reasons: [] },
      { type: "caption", text: "Figura 9 – Validação.", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 2 }], confidence: "high", reasons: [], layoutRegionId: "layout-11-9" },
      { type: "source", text: "Fonte: Autor.", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 3 }], confidence: "high", reasons: [], layoutRegionId: "layout-11-9" },
    ], [{
      id: "layout-11-9", pageStart: 11, pageEnd: 11, startLineIndex: 2, endLineIndex: 3, kind: "figura",
      caption: "Figura 9 – Validação.", source: "Fonte: Autor.", confidence: "high", reasons: [], logicalVisualId: "figura-9-page-11",
    }], {
      includeReconstructedPretextuals: false,
      visualAssets: { "figura-9-page-11": asset("figura-9-page-11") },
      statistics: { paragraphCount: 1, captionCount: 1, sourceCount: 1, layoutRegionCount: 1 },
    });
    const blob = await buildPdfTextDraftDocxBlob(input);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    expect(zip.file("word/document.xml")).toBeDefined();
    expect(await zip.file("word/document.xml")!.async("string")).toContain("<w:drawing");
  });

  it("quadro com ativo insere imagem, mantem legenda e fonte, e nao insere marcador", async () => {
    const input = visualInput([
      { type: "paragraph", text: "Parágrafo anterior.", pageStart: 10, pageEnd: 10, sourceLines: [{ pageNumber: 10, lineIndex: 1 }], confidence: "medium", reasons: [] },
      { type: "caption", text: "Quadro 1 – Exemplo.", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 2 }], confidence: "high", reasons: [], layoutRegionId: "layout-11-q" },
      { type: "source", text: "Fonte: Autor.", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 3 }], confidence: "high", reasons: [], layoutRegionId: "layout-11-q" },
      { type: "paragraph", text: "Parágrafo posterior.", pageStart: 12, pageEnd: 12, sourceLines: [{ pageNumber: 12, lineIndex: 1 }], confidence: "medium", reasons: [] },
    ], [{
      id: "layout-11-q", pageStart: 11, pageEnd: 11, startLineIndex: 2, endLineIndex: 3, kind: "quadro",
      caption: "Quadro 1 – Exemplo.", source: "Fonte: Autor.", confidence: "high", reasons: [], logicalVisualId: "quadro-1-page-11",
    }], {
      visualAssets: { "quadro-1-page-11": asset("quadro-1-page-11") },
      statistics: { paragraphCount: 2, captionCount: 1, sourceCount: 1, layoutRegionCount: 1 },
    });
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(input));
    expect(documentXml).toContain("<w:drawing");
    expect(documentXml).toContain("Quadro 1 – Exemplo.");
    expect(documentXml).toContain("Fonte: Autor.");
    expect(documentXml).not.toContain("Elemento visual não inserido");
    expect(documentXml).toContain("Parágrafo anterior.");
    expect(documentXml).toContain("Parágrafo posterior.");
  });

  it("quadro sem ativo mantem marcador textual", async () => {
    const input = visualInput([
      { type: "paragraph", text: "Parágrafo anterior.", pageStart: 10, pageEnd: 10, sourceLines: [{ pageNumber: 10, lineIndex: 1 }], confidence: "medium", reasons: [] },
      { type: "caption", text: "Quadro 2 – Sem ativo.", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 2 }], confidence: "high", reasons: [], layoutRegionId: "layout-11-q2" },
      { type: "unresolved", text: "TEXTO INTERNO DO QUADRO", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 3 }], confidence: "low", reasons: [], layoutRegionId: "layout-11-q2" },
      { type: "source", text: "Fonte: Autor.", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 4 }], confidence: "high", reasons: [], layoutRegionId: "layout-11-q2" },
    ], [{
      id: "layout-11-q2", pageStart: 11, pageEnd: 11, startLineIndex: 2, endLineIndex: 4, kind: "quadro",
      caption: "Quadro 2 – Sem ativo.", source: "Fonte: Autor.", confidence: "high", reasons: [], logicalVisualId: "quadro-2-page-11",
    }], {
      logo: undefined,
      statistics: { paragraphCount: 1, captionCount: 1, sourceCount: 1, layoutRegionCount: 1 },
    });
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(input));
    expect(documentXml).toContain("Elemento visual não inserido");
    expect(documentXml).not.toContain("<w:drawing");
  });

  it("tabela com ativo insere imagem, mantem legenda e fonte, e nao insere marcador", async () => {
    const input = visualInput([
      { type: "paragraph", text: "Parágrafo anterior.", pageStart: 10, pageEnd: 10, sourceLines: [{ pageNumber: 10, lineIndex: 1 }], confidence: "medium", reasons: [] },
      { type: "caption", text: "Tabela 1 – Exemplo.", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 2 }], confidence: "high", reasons: [], layoutRegionId: "layout-11-t" },
      { type: "source", text: "Fonte: Autor.", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 3 }], confidence: "high", reasons: [], layoutRegionId: "layout-11-t" },
      { type: "paragraph", text: "Parágrafo posterior.", pageStart: 12, pageEnd: 12, sourceLines: [{ pageNumber: 12, lineIndex: 1 }], confidence: "medium", reasons: [] },
    ], [{
      id: "layout-11-t", pageStart: 11, pageEnd: 11, startLineIndex: 2, endLineIndex: 3, kind: "tabela",
      caption: "Tabela 1 – Exemplo.", source: "Fonte: Autor.", confidence: "high", reasons: [], logicalVisualId: "tabela-1-page-11",
    }], {
      visualAssets: { "tabela-1-page-11": asset("tabela-1-page-11") },
      statistics: { paragraphCount: 2, captionCount: 1, sourceCount: 1, layoutRegionCount: 1 },
    });
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(input));
    expect(documentXml).toContain("<w:drawing");
    expect(documentXml).toContain("Tabela 1 – Exemplo.");
    expect(documentXml).toContain("Fonte: Autor.");
    expect(documentXml).not.toContain("Elemento visual não inserido");
    expect(documentXml).toContain("Parágrafo anterior.");
    expect(documentXml).toContain("Parágrafo posterior.");
  });

  it("tabela sem ativo mantem marcador textual", async () => {
    const input = visualInput([
      { type: "paragraph", text: "Parágrafo anterior.", pageStart: 10, pageEnd: 10, sourceLines: [{ pageNumber: 10, lineIndex: 1 }], confidence: "medium", reasons: [] },
      { type: "caption", text: "Tabela 2 – Sem ativo.", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 2 }], confidence: "high", reasons: [], layoutRegionId: "layout-11-t2" },
      { type: "unresolved", text: "TEXTO INTERNO DA TABELA", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 3 }], confidence: "low", reasons: [], layoutRegionId: "layout-11-t2" },
      { type: "source", text: "Fonte: Autor.", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 4 }], confidence: "high", reasons: [], layoutRegionId: "layout-11-t2" },
    ], [{
      id: "layout-11-t2", pageStart: 11, pageEnd: 11, startLineIndex: 2, endLineIndex: 4, kind: "tabela",
      caption: "Tabela 2 – Sem ativo.", source: "Fonte: Autor.", confidence: "high", reasons: [], logicalVisualId: "tabela-2-page-11",
    }], {
      logo: undefined,
      statistics: { paragraphCount: 1, captionCount: 1, sourceCount: 1, layoutRegionCount: 1 },
    });
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(input));
    expect(documentXml).toContain("Elemento visual não inserido");
    expect(documentXml).not.toContain("<w:drawing");
  });

  it("multicolumn com ativo insere imagem e nao insere marcador", async () => {
    const input = visualInput([
      { type: "paragraph", text: "Parágrafo anterior.", pageStart: 10, pageEnd: 10, sourceLines: [{ pageNumber: 10, lineIndex: 1 }], confidence: "medium", reasons: [] },
      { type: "caption", text: "Conteúdo 1 – Exemplo.", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 2 }], confidence: "high", reasons: [], layoutRegionId: "layout-11-m" },
      { type: "source", text: "Fonte: Autor.", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 3 }], confidence: "high", reasons: [], layoutRegionId: "layout-11-m" },
      { type: "paragraph", text: "Parágrafo posterior.", pageStart: 12, pageEnd: 12, sourceLines: [{ pageNumber: 12, lineIndex: 1 }], confidence: "medium", reasons: [] },
    ], [{
      id: "layout-11-m", pageStart: 11, pageEnd: 11, startLineIndex: 2, endLineIndex: 3, kind: "multicolumn",
      caption: "Conteúdo 1 – Exemplo.", source: "Fonte: Autor.", confidence: "high", reasons: [], logicalVisualId: "multicolumn-1-page-11",
    }], {
      visualAssets: { "multicolumn-1-page-11": asset("multicolumn-1-page-11") },
      statistics: { paragraphCount: 2, captionCount: 1, sourceCount: 1, layoutRegionCount: 1 },
    });
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(input));
    expect(documentXml).toContain("<w:drawing");
    expect(documentXml).not.toContain("Elemento visual não inserido");
    expect(documentXml).toContain("Parágrafo anterior.");
    expect(documentXml).toContain("Parágrafo posterior.");
  });

  it("multicolumn sem ativo mantem marcador textual", async () => {
    const input = visualInput([
      { type: "paragraph", text: "Parágrafo anterior.", pageStart: 10, pageEnd: 10, sourceLines: [{ pageNumber: 10, lineIndex: 1 }], confidence: "medium", reasons: [] },
      { type: "caption", text: "Conteúdo 2 – Sem ativo.", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 2 }], confidence: "high", reasons: [], layoutRegionId: "layout-11-m2" },
      { type: "unresolved", text: "TEXTO INTERNO MULTICOLUMN", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 3 }], confidence: "low", reasons: [], layoutRegionId: "layout-11-m2" },
      { type: "source", text: "Fonte: Autor.", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 4 }], confidence: "high", reasons: [], layoutRegionId: "layout-11-m2" },
    ], [{
      id: "layout-11-m2", pageStart: 11, pageEnd: 11, startLineIndex: 2, endLineIndex: 4, kind: "multicolumn",
      caption: "Conteúdo 2 – Sem ativo.", source: "Fonte: Autor.", confidence: "high", reasons: [], logicalVisualId: "multicolumn-2-page-11",
    }], {
      logo: undefined,
      statistics: { paragraphCount: 1, captionCount: 1, sourceCount: 1, layoutRegionCount: 1 },
    });
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(input));
    expect(documentXml).toContain("Elemento visual não inserido");
    expect(documentXml).not.toContain("<w:drawing");
  });

  it("regiao com kind desconhecido e ativo insere imagem e nao insere marcador", async () => {
    const input = visualInput([
      { type: "paragraph", text: "Parágrafo anterior.", pageStart: 10, pageEnd: 10, sourceLines: [{ pageNumber: 10, lineIndex: 1 }], confidence: "medium", reasons: [] },
      { type: "caption", text: "Elemento 1 – Exemplo.", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 2 }], confidence: "high", reasons: [], layoutRegionId: "layout-11-u" },
      { type: "source", text: "Fonte: Autor.", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 3 }], confidence: "high", reasons: [], layoutRegionId: "layout-11-u" },
      { type: "paragraph", text: "Parágrafo posterior.", pageStart: 12, pageEnd: 12, sourceLines: [{ pageNumber: 12, lineIndex: 1 }], confidence: "medium", reasons: [] },
    ], [{
      id: "layout-11-u", pageStart: 11, pageEnd: 11, startLineIndex: 2, endLineIndex: 3, kind: "unknown",
      caption: "Elemento 1 – Exemplo.", source: "Fonte: Autor.", confidence: "high", reasons: [], logicalVisualId: "unknown-1-page-11",
    }], {
      visualAssets: { "unknown-1-page-11": asset("unknown-1-page-11") },
      statistics: { paragraphCount: 2, captionCount: 1, sourceCount: 1, layoutRegionCount: 1 },
    });
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(input));
    expect(documentXml).toContain("<w:drawing");
    expect(documentXml).not.toContain("Elemento visual não inserido");
    expect(documentXml).toContain("Parágrafo anterior.");
    expect(documentXml).toContain("Parágrafo posterior.");
  });

  it("dois blocos de quadro com o mesmo logicalVisualId geram somente uma imagem", async () => {
    const input = visualInput([
      { type: "paragraph", text: "Texto antes.", pageStart: 10, pageEnd: 10, sourceLines: [{ pageNumber: 10, lineIndex: 1 }], confidence: "medium", reasons: [] },
      { type: "caption", text: "Quadro 3 – Continua.", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 2 }], confidence: "high", reasons: [], layoutRegionId: "layout-11-q3" },
      { type: "source", text: "Fonte: Autor.", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 3 }], confidence: "high", reasons: [], layoutRegionId: "layout-11-q3" },
      { type: "caption", text: "Quadro 3 – Continuação.", pageStart: 12, pageEnd: 12, sourceLines: [{ pageNumber: 12, lineIndex: 0 }], confidence: "high", reasons: [], layoutRegionId: "layout-12-q3" },
      { type: "source", text: "Fonte: Autor.", pageStart: 12, pageEnd: 12, sourceLines: [{ pageNumber: 12, lineIndex: 1 }], confidence: "high", reasons: [], layoutRegionId: "layout-12-q3" },
    ], [{
      id: "layout-11-q3", pageStart: 11, pageEnd: 11, startLineIndex: 2, endLineIndex: 3, kind: "quadro",
      caption: "Quadro 3 – Continua.", source: "Fonte: Autor.", confidence: "high", reasons: [], logicalVisualId: "quadro-3-page-11",
    }, {
      id: "layout-12-q3", pageStart: 12, pageEnd: 12, startLineIndex: 0, endLineIndex: 1, kind: "quadro",
      caption: "Quadro 3 – Continuação.", source: "Fonte: Autor.", confidence: "high", reasons: [], logicalVisualId: "quadro-3-page-11",
    }], {
      includeReconstructedPretextuals: false,
      visualAssets: { "quadro-3-page-11": asset("quadro-3-page-11") },
      statistics: { paragraphCount: 1, captionCount: 2, sourceCount: 2, layoutRegionCount: 2 },
    });
    const zip = await JSZip.loadAsync(await buildPdfTextDraftDocxBlob(input).then((blob) => blob.arrayBuffer()));
    const mediaFiles = Object.keys(zip.files).filter((entry) => entry.startsWith("word/media/") && !entry.endsWith("/"));
    expect(mediaFiles).toHaveLength(1);
  });

  it("contagem de marcadores considera ativo emitido e coincide com o documento", async () => {
    const input = visualInput([
      { type: "paragraph", text: "Texto.", pageStart: 10, pageEnd: 10, sourceLines: [{ pageNumber: 10, lineIndex: 1 }], confidence: "medium", reasons: [] },
      { type: "unresolved", text: "INTERNO QUADRO", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 2 }], confidence: "low", reasons: [], layoutRegionId: "layout-11-qt" },
      { type: "unresolved", text: "INTERNO TABELA", pageStart: 12, pageEnd: 12, sourceLines: [{ pageNumber: 12, lineIndex: 2 }], confidence: "low", reasons: [], layoutRegionId: "layout-12-tt" },
    ], [{
      id: "layout-11-qt", pageStart: 11, pageEnd: 11, startLineIndex: 2, endLineIndex: 2, kind: "quadro",
      confidence: "high", reasons: [], logicalVisualId: "quadro-t-page-11",
    }, {
      id: "layout-12-tt", pageStart: 12, pageEnd: 12, startLineIndex: 2, endLineIndex: 2, kind: "tabela",
      confidence: "high", reasons: [], logicalVisualId: "tabela-t-page-12",
    }], {
      includeReconstructedPretextuals: false,
      visualAssets: { "quadro-t-page-11": asset("quadro-t-page-11") },
      statistics: { paragraphCount: 1, unresolvedCount: 2, layoutRegionCount: 2 },
    });
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(input));
    const markerMatches = documentXml.match(/Elemento visual não inserido/g) ?? [];
    const summaryMatch = documentXml.match(/Elementos visuais representados por marcadores: (\d+)/);
    expect(summaryMatch).not.toBeNull();
    const expected = Number(summaryMatch![1]);
    expect(markerMatches.length).toBe(expected);
    expect(expected).toBe(1);
  });

  it("unresolved com layoutRegionId sem região e com ativo gera marcador e contagem 1", async () => {
    const input = visualInput([
      { type: "paragraph", text: "Texto.", pageStart: 10, pageEnd: 10, sourceLines: [{ pageNumber: 10, lineIndex: 1 }], confidence: "medium", reasons: [] },
      { type: "unresolved", text: "INTERNO SEM REGIAO", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 2 }], confidence: "low", reasons: [], layoutRegionId: "missing-region" },
    ], [], {
      includeReconstructedPretextuals: false,
      visualAssets: { "missing-region": asset("missing-region") },
      statistics: { paragraphCount: 1, unresolvedCount: 1, layoutRegionCount: 0 },
    });
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(input));
    const markerMatches = documentXml.match(/Conteúdo com estrutura visual não resolvida/g) ?? [];
    const summaryMatch = documentXml.match(/Elementos visuais representados por marcadores: (\d+)/);
    expect(summaryMatch).not.toBeNull();
    const expected = Number(summaryMatch![1]);
    expect(markerMatches.length).toBe(expected);
    expect(expected).toBe(1);
  });

  it("unresolved com região correspondente e ativo nao gera marcador e contagem 0", async () => {
    const input = visualInput([
      { type: "paragraph", text: "Texto.", pageStart: 10, pageEnd: 10, sourceLines: [{ pageNumber: 10, lineIndex: 1 }], confidence: "medium", reasons: [] },
      { type: "unresolved", text: "INTERNO COM REGIAO E ATIVO", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 2 }], confidence: "low", reasons: [], layoutRegionId: "layout-11-a" },
    ], [{
      id: "layout-11-a", pageStart: 11, pageEnd: 11, startLineIndex: 2, endLineIndex: 2, kind: "figura",
      confidence: "high", reasons: [], logicalVisualId: "figura-a-page-11",
    }], {
      includeReconstructedPretextuals: false,
      visualAssets: { "figura-a-page-11": asset("figura-a-page-11") },
      statistics: { paragraphCount: 1, unresolvedCount: 1, layoutRegionCount: 1 },
    });
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(input));
    expect(documentXml).toContain("<w:drawing");
    expect(documentXml).not.toContain("Elemento visual não inserido");
    expect(documentXml).not.toContain("Conteúdo com estrutura visual não resolvida");
    const summaryMatch = documentXml.match(/Elementos visuais representados por marcadores: (\d+)/);
    expect(summaryMatch).not.toBeNull();
    expect(Number(summaryMatch![1])).toBe(0);
  });

  it("unresolved sem região e sem ativo gera marcador e contagem 1", async () => {
    const input = visualInput([
      { type: "paragraph", text: "Texto.", pageStart: 10, pageEnd: 10, sourceLines: [{ pageNumber: 10, lineIndex: 1 }], confidence: "medium", reasons: [] },
      { type: "unresolved", text: "INTERNO SEM REGIAO NEM ATIVO", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 2 }], confidence: "low", reasons: [], layoutRegionId: "missing-region-2" },
    ], [], {
      includeReconstructedPretextuals: false,
      statistics: { paragraphCount: 1, unresolvedCount: 1, layoutRegionCount: 0 },
    });
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(input));
    const markerMatches = documentXml.match(/Conteúdo com estrutura visual não resolvida/g) ?? [];
    const summaryMatch = documentXml.match(/Elementos visuais representados por marcadores: (\d+)/);
    expect(summaryMatch).not.toBeNull();
    const expected = Number(summaryMatch![1]);
    expect(markerMatches.length).toBe(expected);
    expect(expected).toBe(1);
  });

  it("imagem de quadro nao gera tabela nem numeracao e figura continua funcionando", async () => {
    const input = visualInput([
      { type: "paragraph", text: "Texto antes.", pageStart: 10, pageEnd: 10, sourceLines: [{ pageNumber: 10, lineIndex: 1 }], confidence: "medium", reasons: [] },
      { type: "caption", text: "Quadro 9 – Quadro.", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 2 }], confidence: "high", reasons: [], layoutRegionId: "layout-11-q9" },
      { type: "source", text: "Fonte: Autor.", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 3 }], confidence: "high", reasons: [], layoutRegionId: "layout-11-q9" },
      { type: "caption", text: "Figura 9 – Figura.", pageStart: 12, pageEnd: 12, sourceLines: [{ pageNumber: 12, lineIndex: 2 }], confidence: "high", reasons: [], layoutRegionId: "layout-12-f9" },
      { type: "source", text: "Fonte: Autor.", pageStart: 12, pageEnd: 12, sourceLines: [{ pageNumber: 12, lineIndex: 3 }], confidence: "high", reasons: [], layoutRegionId: "layout-12-f9" },
    ], [{
      id: "layout-11-q9", pageStart: 11, pageEnd: 11, startLineIndex: 2, endLineIndex: 3, kind: "quadro",
      caption: "Quadro 9 – Quadro.", source: "Fonte: Autor.", confidence: "high", reasons: [], logicalVisualId: "quadro-9-page-11",
    }, {
      id: "layout-12-f9", pageStart: 12, pageEnd: 12, startLineIndex: 2, endLineIndex: 3, kind: "figura",
      caption: "Figura 9 – Figura.", source: "Fonte: Autor.", confidence: "high", reasons: [], logicalVisualId: "figura-9-page-12",
    }], {
      includeReconstructedPretextuals: false,
      visualAssets: { "quadro-9-page-11": asset("quadro-9-page-11"), "figura-9-page-12": asset("figura-9-page-12") },
      statistics: { paragraphCount: 1, captionCount: 2, sourceCount: 2, layoutRegionCount: 2 },
    });
    const { documentXml, settingsXml, stylesXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(input));
    const allXml = `${documentXml}\n${settingsXml}\n${stylesXml}`;
    expect(allXml).toContain("<w:drawing");
    expect(allXml).toContain("Quadro 9 – Quadro.");
    expect(allXml).toContain("Figura 9 – Figura.");
    expect(allXml).not.toContain("<w:tbl");
    expect(allXml).not.toContain("<w:numPr");
  });

  describe("formatacao da secao de referencias do rascunho pdf", () => {
    type Block = PdfTextDraftExportInput["reconstruction"]["blocks"][number];
    type Region = PdfTextDraftExportInput["reconstruction"]["layoutRegions"][number];

    const logoRef = readFileSync(join(process.cwd(), "public", "assets", "ufla-logo.jpeg"));

    function asset(key: string, width = 170, height = 69): PdfTextDraftVisualAsset {
      return { data: logoRef, width, height, altText: { title: `Imagem ${key}`, description: `Descrição ${key}`, name: key } };
    }

    function referencesInput(
      blocks: Block[],
      options: {
        layoutRegions?: Region[];
        visualAssets?: Record<string, PdfTextDraftVisualAsset>;
        includeReconstructedPretextuals?: boolean;
        statistics?: Partial<PdfTextDraftExportInput["reconstruction"]["statistics"]>;
      } = {},
    ): PdfTextDraftExportInput {
      return baseInput({
        reconstruction: {
          ...baseInput().reconstruction,
          blocks,
          layoutRegions: options.layoutRegions ?? baseInput().reconstruction.layoutRegions,
          statistics: { ...baseInput().reconstruction.statistics, ...options.statistics },
        },
        visualAssets: options.visualAssets,
        includeReconstructedPretextuals: options.includeReconstructedPretextuals,
      });
    }

    function paraWithText(documentXml: string, needle: string): string {
      const seg = documentXml.split("</w:p>").find((s) => s.includes(needle));
      return seg ? `${seg}</w:p>` : "";
    }

    function headingPara(documentXml: string, needle: string): string {
      const seg = documentXml.split("</w:p>").find((s) => s.includes(needle) && s.includes("bookmarkStart"));
      return seg ? `${seg}</w:p>` : "";
    }

    it("paragrafo normal antes de REFERENCIAS mantem justificado, primeira linha 1,5cm e espacamento 1,5", async () => {
      const input = referencesInput([
        { type: "paragraph", text: "Parágrafo antes de REFERÊNCIAS com formatação de corpo.", pageStart: 10, pageEnd: 10, sourceLines: [{ pageNumber: 10, lineIndex: 1 }], confidence: "medium", reasons: [] },
        { type: "heading", text: "REFERÊNCIAS", pageStart: 110, pageEnd: 110, sourceLines: [{ pageNumber: 110, lineIndex: 1 }], confidence: "high", reasons: [] },
        { type: "paragraph", text: "Autor, A. (2020). Obra uma. Editora.", pageStart: 111, pageEnd: 111, sourceLines: [{ pageNumber: 111, lineIndex: 1 }], confidence: "high", reasons: [] },
      ]);
      const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(input));
      const para = paraWithText(documentXml, "Parágrafo antes de REFERÊNCIAS");
      expect(para).toContain('w:jc w:val="both"');
      expect(para).toContain('w:firstLine="850"');
      expect(para).toContain('w:line="360"');
    });

    it("heading REFERENCIAS continua em negrito", async () => {
      const input = referencesInput([
        { type: "heading", text: "REFERÊNCIAS", pageStart: 110, pageEnd: 110, sourceLines: [{ pageNumber: 110, lineIndex: 1 }], confidence: "high", reasons: [] },
        { type: "paragraph", text: "Autor, A. (2020). Obra uma. Editora.", pageStart: 111, pageEnd: 111, sourceLines: [{ pageNumber: 111, lineIndex: 1 }], confidence: "high", reasons: [] },
      ]);
      const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(input));
      const heading = headingPara(documentXml, "REFERÊNCIAS");
      expect(heading).toMatch(/<w:b(?!ookmark)/);
    });

    it("primeiro paragrafo apos REFERENCIAS alinhado a esquerda, sem firstLine, espacamento simples e espaco pos", async () => {
      const input = referencesInput([
        { type: "heading", text: "REFERÊNCIAS", pageStart: 110, pageEnd: 110, sourceLines: [{ pageNumber: 110, lineIndex: 1 }], confidence: "high", reasons: [] },
        { type: "paragraph", text: "Autor, A. (2020). Obra uma. Editora.", pageStart: 111, pageEnd: 111, sourceLines: [{ pageNumber: 111, lineIndex: 1 }], confidence: "high", reasons: [] },
        { type: "paragraph", text: "Autor, B. (2019). Obra duas. Editora.", pageStart: 112, pageEnd: 112, sourceLines: [{ pageNumber: 112, lineIndex: 1 }], confidence: "high", reasons: [] },
      ]);
      const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(input));
      const ref1 = paraWithText(documentXml, "Autor, A. (2020). Obra uma. Editora.");
      expect(ref1).toContain('w:jc w:val="left"');
      expect(ref1).not.toContain('w:firstLine="850"');
      expect(ref1).toContain('w:after="240" w:line="240"');
    });

    it("segundo paragrafo de referencia recebe o mesmo formato", async () => {
      const input = referencesInput([
        { type: "heading", text: "REFERÊNCIAS", pageStart: 110, pageEnd: 110, sourceLines: [{ pageNumber: 110, lineIndex: 1 }], confidence: "high", reasons: [] },
        { type: "paragraph", text: "Autor, A. (2020). Obra uma. Editora.", pageStart: 111, pageEnd: 111, sourceLines: [{ pageNumber: 111, lineIndex: 1 }], confidence: "high", reasons: [] },
        { type: "paragraph", text: "Autor, B. (2019). Obra duas. Editora.", pageStart: 112, pageEnd: 112, sourceLines: [{ pageNumber: 112, lineIndex: 1 }], confidence: "high", reasons: [] },
      ]);
      const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(input));
      const ref2 = paraWithText(documentXml, "Autor, B. (2019). Obra duas. Editora.");
      expect(ref2).toContain('w:jc w:val="left"');
      expect(ref2).not.toContain('w:firstLine="850"');
      expect(ref2).toContain('w:after="240" w:line="240"');
    });

    it("list-item dentro de REFERENCIAS nao recebe hanging indent", async () => {
      const input = referencesInput([
        { type: "paragraph", text: "Parágrafo antes de REFERÊNCIAS para validação.", pageStart: 10, pageEnd: 10, sourceLines: [{ pageNumber: 10, lineIndex: 1 }], confidence: "medium", reasons: [] },
        { type: "heading", text: "REFERÊNCIAS", pageStart: 110, pageEnd: 110, sourceLines: [{ pageNumber: 110, lineIndex: 1 }], confidence: "high", reasons: [] },
        { type: "list-item", text: "Autor, C. (2018). Obra classificada como item por engano. Editora.", pageStart: 113, pageEnd: 113, sourceLines: [{ pageNumber: 113, lineIndex: 1 }], confidence: "high", reasons: [] },
      ]);
      const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(input));
      const ref = paraWithText(documentXml, "Autor, C. (2018). Obra classificada como item por engano. Editora.");
      expect(ref).toContain('w:jc w:val="left"');
      expect(ref).not.toContain("w:hanging");
      expect(ref).not.toContain('w:left="850"');
    });

    it("APENDICE encerra o modo de referencias", async () => {
      const input = referencesInput([
        { type: "heading", text: "REFERÊNCIAS", pageStart: 110, pageEnd: 110, sourceLines: [{ pageNumber: 110, lineIndex: 1 }], confidence: "high", reasons: [] },
        { type: "paragraph", text: "Autor, A. (2020). Obra uma. Editora.", pageStart: 111, pageEnd: 111, sourceLines: [{ pageNumber: 111, lineIndex: 1 }], confidence: "high", reasons: [] },
        { type: "heading", text: "APÊNDICE", pageStart: 120, pageEnd: 120, sourceLines: [{ pageNumber: 120, lineIndex: 1 }], confidence: "high", reasons: [] },
        { type: "paragraph", text: "Parágrafo após APÊNDICE volta ao corpo.", pageStart: 121, pageEnd: 121, sourceLines: [{ pageNumber: 121, lineIndex: 1 }], confidence: "medium", reasons: [] },
      ]);
      const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(input));
      const ref = paraWithText(documentXml, "Autor, A. (2020). Obra uma. Editora.");
      expect(ref).toContain('w:jc w:val="left"');
      const after = paraWithText(documentXml, "Parágrafo após APÊNDICE volta ao corpo.");
      expect(after).toContain('w:jc w:val="both"');
      expect(after).toContain('w:firstLine="850"');
    });

    it("paragrafo apos APENDICE volta ao formato normal do corpo", async () => {
      const input = referencesInput([
        { type: "heading", text: "REFERÊNCIAS", pageStart: 110, pageEnd: 110, sourceLines: [{ pageNumber: 110, lineIndex: 1 }], confidence: "high", reasons: [] },
        { type: "paragraph", text: "Autor, A. (2020). Obra uma. Editora.", pageStart: 111, pageEnd: 111, sourceLines: [{ pageNumber: 111, lineIndex: 1 }], confidence: "high", reasons: [] },
        { type: "heading", text: "APÊNDICE A", pageStart: 120, pageEnd: 120, sourceLines: [{ pageNumber: 120, lineIndex: 1 }], confidence: "high", reasons: [] },
        { type: "paragraph", text: "Texto de corpo normal após apêndice com recuo de primeira linha.", pageStart: 121, pageEnd: 121, sourceLines: [{ pageNumber: 121, lineIndex: 1 }], confidence: "medium", reasons: [] },
      ]);
      const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(input));
      const after = paraWithText(documentXml, "Texto de corpo normal após apêndice com recuo de primeira linha.");
      expect(after).toContain('w:jc w:val="both"');
      expect(after).toContain('w:firstLine="850"');
      expect(after).toContain('w:line="360"');
    });

    it("ANEXO tambem encerra o modo de referencias", async () => {
      const input = referencesInput([
        { type: "heading", text: "REFERÊNCIAS", pageStart: 110, pageEnd: 110, sourceLines: [{ pageNumber: 110, lineIndex: 1 }], confidence: "high", reasons: [] },
        { type: "paragraph", text: "Autor, A. (2020). Obra uma. Editora.", pageStart: 111, pageEnd: 111, sourceLines: [{ pageNumber: 111, lineIndex: 1 }], confidence: "high", reasons: [] },
        { type: "heading", text: "ANEXO", pageStart: 130, pageEnd: 130, sourceLines: [{ pageNumber: 130, lineIndex: 1 }], confidence: "high", reasons: [] },
        { type: "paragraph", text: "Parágrafo após ANEXO volta ao corpo.", pageStart: 131, pageEnd: 131, sourceLines: [{ pageNumber: 131, lineIndex: 1 }], confidence: "medium", reasons: [] },
      ]);
      const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(input));
      const ref = paraWithText(documentXml, "Autor, A. (2020). Obra uma. Editora.");
      expect(ref).toContain('w:jc w:val="left"');
      const after = paraWithText(documentXml, "Parágrafo após ANEXO volta ao corpo.");
      expect(after).toContain('w:jc w:val="both"');
      expect(after).toContain('w:firstLine="850"');
    });

    it("REFERENCIAS sem acento ativa o modo de referencias", async () => {
      const input = referencesInput([
        { type: "heading", text: "REFERENCIAS", pageStart: 110, pageEnd: 110, sourceLines: [{ pageNumber: 110, lineIndex: 1 }], confidence: "high", reasons: [] },
        { type: "paragraph", text: "Autor, A. (2020). Obra uma. Editora.", pageStart: 111, pageEnd: 111, sourceLines: [{ pageNumber: 111, lineIndex: 1 }], confidence: "high", reasons: [] },
      ]);
      const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(input));
      const ref = paraWithText(documentXml, "Autor, A. (2020). Obra uma. Editora.");
      expect(ref).toContain('w:jc w:val="left"');
      expect(ref).not.toContain('w:firstLine="850"');
    });

    it("texto com a palavra referencias no meio de paragrafo nao ativa o modo", async () => {
      const input = referencesInput([
        { type: "paragraph", text: "Veja as referências importantes listadas no final do documento.", pageStart: 10, pageEnd: 10, sourceLines: [{ pageNumber: 10, lineIndex: 1 }], confidence: "medium", reasons: [] },
        { type: "paragraph", text: "Outro parágrafo de corpo que deve permanecer justificado.", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 1 }], confidence: "medium", reasons: [] },
      ]);
      const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(input));
      const p2 = paraWithText(documentXml, "Outro parágrafo de corpo que deve permanecer justificado.");
      expect(p2).toContain('w:jc w:val="both"');
      expect(p2).toContain('w:firstLine="850"');
    });

    it("bookmark do heading REFERENCIAS permanece", async () => {
      const input = referencesInput([
        { type: "heading", text: "REFERÊNCIAS", pageStart: 110, pageEnd: 110, sourceLines: [{ pageNumber: 110, lineIndex: 1 }], confidence: "high", reasons: [] },
        { type: "paragraph", text: "Autor, A. (2020). Obra uma. Editora.", pageStart: 111, pageEnd: 111, sourceLines: [{ pageNumber: 111, lineIndex: 1 }], confidence: "high", reasons: [] },
      ]);
      const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(input));
      const heading = headingPara(documentXml, "REFERÊNCIAS");
      expect(heading).toContain("<w:bookmarkStart");
      expect(heading).toContain("PDFBM");
    });

    it("PAGEREF do sumario permanece", async () => {
      const input = referencesInput([
        { type: "heading", text: "REFERÊNCIAS", pageStart: 110, pageEnd: 110, sourceLines: [{ pageNumber: 110, lineIndex: 1 }], confidence: "high", reasons: [] },
        { type: "paragraph", text: "Autor, A. (2020). Obra uma. Editora.", pageStart: 111, pageEnd: 111, sourceLines: [{ pageNumber: 111, lineIndex: 1 }], confidence: "high", reasons: [] },
      ]);
      const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(input));
      expect(documentXml).toContain("PAGEREF");
    });

    it("nao ha w:numPr criado", async () => {
      const input = referencesInput([
        { type: "heading", text: "REFERÊNCIAS", pageStart: 110, pageEnd: 110, sourceLines: [{ pageNumber: 110, lineIndex: 1 }], confidence: "high", reasons: [] },
        { type: "paragraph", text: "Autor, A. (2020). Obra uma. Editora.", pageStart: 111, pageEnd: 111, sourceLines: [{ pageNumber: 111, lineIndex: 1 }], confidence: "high", reasons: [] },
      ]);
      const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(input));
      expect(documentXml).not.toContain("<w:numPr");
    });

    it("nao ha w:tbl criado", async () => {
      const input = referencesInput([
        { type: "heading", text: "REFERÊNCIAS", pageStart: 110, pageEnd: 110, sourceLines: [{ pageNumber: 110, lineIndex: 1 }], confidence: "high", reasons: [] },
        { type: "paragraph", text: "Autor, A. (2020). Obra uma. Editora.", pageStart: 111, pageEnd: 111, sourceLines: [{ pageNumber: 111, lineIndex: 1 }], confidence: "high", reasons: [] },
      ]);
      const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(input));
      expect(documentXml).not.toContain("<w:tbl");
    });

    it("marcadores visuais continuam iguais com referencias", async () => {
      const input = referencesInput([
        { type: "heading", text: "REFERÊNCIAS", pageStart: 110, pageEnd: 110, sourceLines: [{ pageNumber: 110, lineIndex: 1 }], confidence: "high", reasons: [] },
        { type: "paragraph", text: "Autor, A. (2020). Obra uma. Editora.", pageStart: 111, pageEnd: 111, sourceLines: [{ pageNumber: 111, lineIndex: 1 }], confidence: "high", reasons: [] },
        { type: "unresolved", text: "TEXTO INTERNO DO QUADRO", pageStart: 25, pageEnd: 25, sourceLines: [{ pageNumber: 25, lineIndex: 3 }], confidence: "low", reasons: [], layoutRegionId: "layout-25-1" },
      ], {
        statistics: { paragraphCount: 1, unresolvedCount: 1, layoutRegionCount: 1 },
      });
      const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(input));
      expect(documentXml).toContain("Elemento visual não inserido");
      const ref = paraWithText(documentXml, "Autor, A. (2020). Obra uma. Editora.");
      expect(ref).toContain('w:jc w:val="left"');
    });

    it("ativos visuais continuam iguais com referencias", async () => {
      const input = referencesInput([
        { type: "heading", text: "REFERÊNCIAS", pageStart: 110, pageEnd: 110, sourceLines: [{ pageNumber: 110, lineIndex: 1 }], confidence: "high", reasons: [] },
        { type: "paragraph", text: "Autor, A. (2020). Obra uma. Editora.", pageStart: 111, pageEnd: 111, sourceLines: [{ pageNumber: 111, lineIndex: 1 }], confidence: "high", reasons: [] },
        { type: "caption", text: "Figura 1 – Exemplo.", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 2 }], confidence: "high", reasons: [], layoutRegionId: "layout-11-f" },
        { type: "source", text: "Fonte: Autor.", pageStart: 11, pageEnd: 11, sourceLines: [{ pageNumber: 11, lineIndex: 3 }], confidence: "high", reasons: [], layoutRegionId: "layout-11-f" },
      ], {
        layoutRegions: [{ id: "layout-11-f", pageStart: 11, pageEnd: 11, startLineIndex: 2, endLineIndex: 3, kind: "figura", caption: "Figura 1 – Exemplo.", source: "Fonte: Autor.", confidence: "high", reasons: [], logicalVisualId: "figura-1-page-11" }],
        visualAssets: { "figura-1-page-11": asset("figura-1-page-11") },
        statistics: { paragraphCount: 1, captionCount: 1, sourceCount: 1, layoutRegionCount: 1 },
      });
      const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(input));
      expect(documentXml).toContain("<w:drawing");
      const ref = paraWithText(documentXml, "Autor, A. (2020). Obra uma. Editora.");
      expect(ref).toContain('w:jc w:val="left"');
    });

    it("nenhum texto bibliografico e removido ou reescrito", async () => {
      const input = referencesInput([
        { type: "paragraph", text: "Parágrafo antes de REFERÊNCIAS com formatação de corpo.", pageStart: 10, pageEnd: 10, sourceLines: [{ pageNumber: 10, lineIndex: 1 }], confidence: "medium", reasons: [] },
        { type: "heading", text: "REFERÊNCIAS", pageStart: 110, pageEnd: 110, sourceLines: [{ pageNumber: 110, lineIndex: 1 }], confidence: "high", reasons: [] },
        { type: "paragraph", text: "SOUZA, Maria de (2021). Título com acento e pontuação: subtítulo. Editora.", pageStart: 111, pageEnd: 111, sourceLines: [{ pageNumber: 111, lineIndex: 1 }], confidence: "high", reasons: [] },
        { type: "paragraph", text: "PEREIRA, João (2017). Outra referência com DOI 10.1000/xyz. Editora.", pageStart: 112, pageEnd: 112, sourceLines: [{ pageNumber: 112, lineIndex: 1 }], confidence: "high", reasons: [] },
      ]);
      const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(input));
      expect(documentXml).toContain("Parágrafo antes de REFERÊNCIAS com formatação de corpo.");
      expect(documentXml).toContain("SOUZA, Maria de (2021). Título com acento e pontuação: subtítulo. Editora.");
      expect(documentXml).toContain("PEREIRA, João (2017). Outra referência com DOI 10.1000/xyz. Editora.");
      expect(documentXml).toContain("REFERÊNCIAS");
    });
  });
});

describe("ativos visuais compostos por recorte (chave multipagina)", () => {
  type Block = PdfTextDraftExportInput["reconstruction"]["blocks"][number];
  type Region = PdfTextDraftExportInput["reconstruction"]["layoutRegions"][number];

  function compositeAsset(key: string, bytes: number[] = [1, 2, 3], width = 120, height = 80): PdfTextDraftVisualAsset {
    return { data: new Uint8Array(bytes), width, height, altText: { title: `Imagem ${key}`, description: `Descrição ${key}`, name: key } };
  }

  function compositeInput(blocks: Block[], regions: Region[], assets: Record<string, PdfTextDraftVisualAsset>, opts: { includePretextuals?: boolean; statistics?: Partial<PdfTextDraftExportInput["reconstruction"]["statistics"]> } = {}): PdfTextDraftExportInput {
    return baseInput({
      reconstruction: {
        ...baseInput().reconstruction,
        blocks,
        layoutRegions: regions,
        statistics: { ...baseInput().reconstruction.statistics, ...opts.statistics },
      },
      visualAssets: assets,
      includeReconstructedPretextuals: opts.includePretextuals ?? false,
    });
  }

  function region(id: string, logicalVisualId: string, kind: Region["kind"], pageStart: number, pageEnd: number): Region {
    return {
      id, pageStart, pageEnd, startLineIndex: 2, endLineIndex: 4, kind,
      caption: "Quadro 1 – Exemplo.", source: "Fonte: Autor.", confidence: "high", reasons: [], logicalVisualId,
    };
  }

  function singleRegionBlocks(regionId: string, pages: number[]): Block[] {
    const first = pages[0];
    const blocks: Block[] = [
      { type: "paragraph", text: "Texto antes do elemento visual.", pageStart: 10, pageEnd: 10, sourceLines: [{ pageNumber: 10, lineIndex: 1 }], confidence: "medium", reasons: [] },
      { type: "caption", text: "Quadro 1 – Exemplo.", pageStart: first, pageEnd: first, sourceLines: [{ pageNumber: first, lineIndex: 2 }], confidence: "high", reasons: [], layoutRegionId: regionId },
    ];
    for (const page of pages) {
      blocks.push({ type: "unresolved", text: `INTERNO ${page}`, pageStart: page, pageEnd: page, sourceLines: [{ pageNumber: page, lineIndex: 3 }], confidence: "low", reasons: [], layoutRegionId: regionId });
    }
    blocks.push({ type: "source", text: "Fonte: Autor.", pageStart: first, pageEnd: first, sourceLines: [{ pageNumber: first, lineIndex: 4 }], confidence: "high", reasons: [], layoutRegionId: regionId });
    blocks.push({ type: "paragraph", text: "Texto depois do elemento visual.", pageStart: pages[pages.length - 1] + 1, pageEnd: pages[pages.length - 1] + 1, sourceLines: [{ pageNumber: pages[pages.length - 1] + 1, lineIndex: 1 }], confidence: "medium", reasons: [] });
    return blocks;
  }

  function regionStats(unresolvedCount: number, layoutRegionCount: number): Partial<PdfTextDraftExportInput["reconstruction"]["statistics"]> {
    return { paragraphCount: 2, captionCount: 1, sourceCount: 1, unresolvedCount, layoutRegionCount };
  }

  it("chave composta cria drawing no documento", async () => {
    const input = compositeInput(
      singleRegionBlocks("layout-25-1", [25]),
      [region("layout-25-1", "quadro-1-page-25", "quadro", 25, 25)],
      { "quadro-1-page-25::p25::rlayout-25-1": compositeAsset("quadro-1-page-25::p25::rlayout-25-1") },
      { statistics: regionStats(1, 1) },
    );
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(input));
    expect(documentXml).toContain("<w:drawing");
    expect(documentXml).not.toContain("Elemento visual não inserido");
  });

  it("cria word/media com a imagem do recorte", async () => {
    const input = compositeInput(
      singleRegionBlocks("layout-25-1", [25]),
      [region("layout-25-1", "quadro-1-page-25", "quadro", 25, 25)],
      { "quadro-1-page-25::p25::rlayout-25-1": compositeAsset("quadro-1-page-25::p25::rlayout-25-1") },
      { statistics: regionStats(1, 1) },
    );
    const blob = await buildPdfTextDraftDocxBlob(input);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const mediaFiles = Object.keys(zip.files).filter((entry) => entry.startsWith("word/media/") && !entry.endsWith("/"));
    expect(mediaFiles).toHaveLength(1);
  });

  it("dois crops criam dois drawings", async () => {
    const input = compositeInput(
      singleRegionBlocks("layout-25-1", [25, 26]),
      [region("layout-25-1", "quadro-1-page-25", "quadro", 25, 26)],
      {
        "quadro-1-page-25::p25::rlayout-25-1": compositeAsset("a", [11, 12]),
        "quadro-1-page-25::p26::rlayout-25-1": compositeAsset("b", [13, 14]),
      },
      { statistics: regionStats(2, 1) },
    );
    const blob = await buildPdfTextDraftDocxBlob(input);
    const { documentXml } = await loadDocxParts(blob);
    const drawings = (documentXml.match(/<w:drawing/g) ?? []).length;
    expect(drawings).toBe(2);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const mediaFiles = Object.keys(zip.files).filter((entry) => entry.startsWith("word/media/") && !entry.endsWith("/"));
    expect(mediaFiles).toHaveLength(2);
  });

  it("dois crops mantem a ordem numerica das paginas", async () => {
    const input = compositeInput(
      singleRegionBlocks("layout-25-1", [26, 25]),
      [region("layout-25-1", "quadro-1-page-25", "quadro", 25, 26)],
      {
        "quadro-1-page-25::p25::rlayout-25-1": compositeAsset("a", [11]),
        "quadro-1-page-25::p26::rlayout-25-1": compositeAsset("b", [22]),
      },
      { statistics: regionStats(2, 1) },
    );
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(input));
    const embeds = [...documentXml.matchAll(/r:embed="(rId\d+)"/g)].map((match) => Number(match[1].slice(3)));
    expect(embeds.length).toBeGreaterThanOrEqual(2);
    expect(embeds[0]).toBeLessThan(embeds[1]);
  });

  it("logicalVisualId compartilhado nao mistura regioes", async () => {
    const blocks: Block[] = [
      { type: "paragraph", text: "Texto antes.", pageStart: 10, pageEnd: 10, sourceLines: [{ pageNumber: 10, lineIndex: 1 }], confidence: "medium", reasons: [] },
      { type: "caption", text: "Figura A.", pageStart: 25, pageEnd: 25, sourceLines: [{ pageNumber: 25, lineIndex: 2 }], confidence: "high", reasons: [], layoutRegionId: "layout-25-1" },
      { type: "unresolved", text: "INT A", pageStart: 25, pageEnd: 25, sourceLines: [{ pageNumber: 25, lineIndex: 3 }], confidence: "low", reasons: [], layoutRegionId: "layout-25-1" },
      { type: "source", text: "Fonte A.", pageStart: 25, pageEnd: 25, sourceLines: [{ pageNumber: 25, lineIndex: 4 }], confidence: "high", reasons: [], layoutRegionId: "layout-25-1" },
      { type: "caption", text: "Figura B.", pageStart: 26, pageEnd: 26, sourceLines: [{ pageNumber: 26, lineIndex: 2 }], confidence: "high", reasons: [], layoutRegionId: "layout-26-1" },
      { type: "unresolved", text: "INT B", pageStart: 26, pageEnd: 26, sourceLines: [{ pageNumber: 26, lineIndex: 3 }], confidence: "low", reasons: [], layoutRegionId: "layout-26-1" },
      { type: "source", text: "Fonte B.", pageStart: 26, pageEnd: 26, sourceLines: [{ pageNumber: 26, lineIndex: 4 }], confidence: "high", reasons: [], layoutRegionId: "layout-26-1" },
      { type: "paragraph", text: "Texto depois.", pageStart: 27, pageEnd: 27, sourceLines: [{ pageNumber: 27, lineIndex: 1 }], confidence: "medium", reasons: [] },
    ];
    const regions: Region[] = [
      region("layout-25-1", "shared", "figura", 25, 25),
      region("layout-26-1", "shared", "figura", 26, 26),
    ];
    const input = compositeInput(blocks, regions, {
      "shared::p25::rlayout-25-1": compositeAsset("a", [91, 92, 93]),
      "shared::p26::rlayout-26-1": compositeAsset("b", [94, 95, 96]),
    }, { statistics: { paragraphCount: 2, captionCount: 2, sourceCount: 2, unresolvedCount: 2, layoutRegionCount: 2 } });
    const blob = await buildPdfTextDraftDocxBlob(input);
    const { documentXml } = await loadDocxParts(blob);
    expect((documentXml.match(/<w:drawing/g) ?? []).length).toBe(2);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const mediaEntries = Object.keys(zip.files).filter((entry) => entry.startsWith("word/media/") && !entry.endsWith("/"));
    const contents = await Promise.all(mediaEntries.map((entry) => zip.file(entry)!.async("uint8array")));
    const signatures = contents.map((bytes) => Array.from(bytes).join(","));
    expect(signatures).toContain("91,92,93");
    expect(signatures).toContain("94,95,96");
  });

  it("caption aparece antes da imagem", async () => {
    const input = compositeInput(
      singleRegionBlocks("layout-25-1", [25]),
      [region("layout-25-1", "quadro-1-page-25", "quadro", 25, 25)],
      { "quadro-1-page-25::p25::rlayout-25-1": compositeAsset("quadro-1-page-25::p25::rlayout-25-1") },
      { statistics: regionStats(1, 1) },
    );
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(input));
    const captionIndex = documentXml.indexOf("Quadro 1 – Exemplo.");
    const drawingIndex = documentXml.indexOf("<w:drawing");
    expect(captionIndex).toBeGreaterThan(-1);
    expect(drawingIndex).toBeGreaterThan(captionIndex);
  });

  it("source aparece depois da imagem", async () => {
    const input = compositeInput(
      singleRegionBlocks("layout-25-1", [25]),
      [region("layout-25-1", "quadro-1-page-25", "quadro", 25, 25)],
      { "quadro-1-page-25::p25::rlayout-25-1": compositeAsset("quadro-1-page-25::p25::rlayout-25-1") },
      { statistics: regionStats(1, 1) },
    );
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(input));
    const drawingIndex = documentXml.indexOf("<w:drawing");
    const sourceIndex = documentXml.indexOf("Fonte: Autor.");
    expect(drawingIndex).toBeGreaterThan(-1);
    expect(sourceIndex).toBeGreaterThan(drawingIndex);
  });

  it("unresolved com ativo nao gera marcador", async () => {
    const input = compositeInput(
      singleRegionBlocks("layout-25-1", [25]),
      [region("layout-25-1", "quadro-1-page-25", "quadro", 25, 25)],
      { "quadro-1-page-25::p25::rlayout-25-1": compositeAsset("quadro-1-page-25::p25::rlayout-25-1") },
      { statistics: regionStats(1, 1) },
    );
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(input));
    expect(documentXml).toContain("<w:drawing");
    expect(documentXml).not.toContain("Elemento visual não inserido");
  });

  it("unresolved sem ativo gera marcador", async () => {
    const input = compositeInput(
      singleRegionBlocks("layout-25-1", [25]),
      [region("layout-25-1", "quadro-1-page-25", "quadro", 25, 25)],
      {},
      { statistics: regionStats(1, 1) },
    );
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(input));
    expect(documentXml).toContain("Elemento visual não inserido");
    expect(documentXml).not.toContain("<w:drawing");
  });

  it("ativo legado pela chave visualId continua funcionando", async () => {
    const input = compositeInput(
      singleRegionBlocks("layout-25-1", [25]),
      [region("layout-25-1", "quadro-1-page-25", "quadro", 25, 25)],
      { "quadro-1-page-25": compositeAsset("quadro-1-page-25") },
      { statistics: regionStats(1, 1) },
    );
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(input));
    expect(documentXml).toContain("<w:drawing");
    expect(documentXml).not.toContain("Elemento visual não inserido");
  });

  it("caption e unresolved nao duplicam a imagem", async () => {
    const input = compositeInput(
      singleRegionBlocks("layout-25-1", [25]),
      [region("layout-25-1", "quadro-1-page-25", "quadro", 25, 25)],
      { "quadro-1-page-25::p25::rlayout-25-1": compositeAsset("quadro-1-page-25::p25::rlayout-25-1") },
      { statistics: regionStats(1, 1) },
    );
    const blob = await buildPdfTextDraftDocxBlob(input);
    const { documentXml } = await loadDocxParts(blob);
    expect((documentXml.match(/<w:drawing/g) ?? []).length).toBe(1);
    expect(documentXml).not.toContain("Elemento visual não inserido");
  });

  it("quadro aceita ativo composto", async () => {
    const input = compositeInput(
      singleRegionBlocks("layout-25-1", [25]),
      [region("layout-25-1", "quadro-1-page-25", "quadro", 25, 25)],
      { "quadro-1-page-25::p25::rlayout-25-1": compositeAsset("q") },
      { statistics: regionStats(1, 1) },
    );
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(input));
    expect(documentXml).toContain("<w:drawing");
    expect(documentXml).not.toContain("Elemento visual não inserido");
  });

  it("tabela aceita ativo composto", async () => {
    const input = compositeInput(
      singleRegionBlocks("layout-25-1", [25]),
      [region("layout-25-1", "tabela-1-page-25", "tabela", 25, 25)],
      { "tabela-1-page-25::p25::rlayout-25-1": compositeAsset("t") },
      { statistics: regionStats(1, 1) },
    );
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(input));
    expect(documentXml).toContain("<w:drawing");
    expect(documentXml).not.toContain("Elemento visual não inserido");
  });

  it("multicolumn sem ativo mantem marcador", async () => {
    const input = compositeInput(
      singleRegionBlocks("layout-25-1", [25]),
      [region("layout-25-1", "multicolumn-1-page-25", "multicolumn", 25, 25)],
      {},
      { statistics: regionStats(1, 1) },
    );
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(input));
    expect(documentXml).toContain("Elemento visual não inserido");
    expect(documentXml).not.toContain("<w:drawing");
  });

  it("contagem de marcadores diminui com o ativo presente", async () => {
    const blocks = singleRegionBlocks("layout-25-1", [25]);
    const regions = [region("layout-25-1", "quadro-1-page-25", "quadro", 25, 25)];
    const without = compositeInput(blocks, regions, {}, { statistics: regionStats(1, 1) });
    const withAsset = compositeInput(blocks, regions, { "quadro-1-page-25::p25::rlayout-25-1": compositeAsset("q") }, { statistics: regionStats(1, 1) });
    const markerWithout = Number((await loadDocxParts(await buildPdfTextDraftDocxBlob(without))).documentXml.match(/Elementos visuais representados por marcadores: (\d+)/)![1]);
    const markerWith = Number((await loadDocxParts(await buildPdfTextDraftDocxBlob(withAsset))).documentXml.match(/Elementos visuais representados por marcadores: (\d+)/)![1]);
    expect(markerWith).toBeLessThan(markerWithout);
  });

  it("bookmarks e PAGEREF permanecem com ativos compostos", async () => {
    const blocks: Block[] = [
      { type: "heading", text: "1 INTRODUÇÃO", pageStart: 17, pageEnd: 17, sourceLines: [{ pageNumber: 17, lineIndex: 1 }], confidence: "high", reasons: [] },
      { type: "paragraph", text: "Texto antes do elemento visual.", pageStart: 10, pageEnd: 10, sourceLines: [{ pageNumber: 10, lineIndex: 1 }], confidence: "medium", reasons: [] },
      { type: "caption", text: "Quadro 1 – Exemplo.", pageStart: 25, pageEnd: 25, sourceLines: [{ pageNumber: 25, lineIndex: 2 }], confidence: "high", reasons: [], layoutRegionId: "layout-25-1" },
      { type: "unresolved", text: "INTERNO 25", pageStart: 25, pageEnd: 25, sourceLines: [{ pageNumber: 25, lineIndex: 3 }], confidence: "low", reasons: [], layoutRegionId: "layout-25-1" },
      { type: "source", text: "Fonte: Autor.", pageStart: 25, pageEnd: 25, sourceLines: [{ pageNumber: 25, lineIndex: 4 }], confidence: "high", reasons: [], layoutRegionId: "layout-25-1" },
      { type: "paragraph", text: "Texto depois do elemento visual.", pageStart: 27, pageEnd: 27, sourceLines: [{ pageNumber: 27, lineIndex: 1 }], confidence: "medium", reasons: [] },
      { type: "heading", text: "REFERÊNCIAS", pageStart: 110, pageEnd: 110, sourceLines: [{ pageNumber: 110, lineIndex: 1 }], confidence: "high", reasons: [] },
    ];
    const input = compositeInput(
      blocks,
      [region("layout-25-1", "quadro-1-page-25", "quadro", 25, 25)],
      { "quadro-1-page-25::p25::rlayout-25-1": compositeAsset("q") },
      { statistics: { paragraphCount: 2, headingCount: 2, captionCount: 1, sourceCount: 1, unresolvedCount: 1, layoutRegionCount: 1 } },
    );
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(input));
    expect(documentXml).toContain("PAGEREF");
    expect(documentXml).toContain("<w:bookmarkStart");
  });

  it("sem w:numPr com ativos compostos", async () => {
    const input = compositeInput(
      singleRegionBlocks("layout-25-1", [25]),
      [region("layout-25-1", "quadro-1-page-25", "quadro", 25, 25)],
      { "quadro-1-page-25::p25::rlayout-25-1": compositeAsset("q") },
      { statistics: regionStats(1, 1) },
    );
    const { documentXml, settingsXml, stylesXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(input));
    const allXml = `${documentXml}\n${settingsXml}\n${stylesXml}`;
    expect(allXml).not.toContain("<w:numPr");
  });

  it("sem w:tbl introduzido com ativos compostos", async () => {
    const input = compositeInput(
      singleRegionBlocks("layout-25-1", [25]),
      [region("layout-25-1", "quadro-1-page-25", "quadro", 25, 25)],
      { "quadro-1-page-25::p25::rlayout-25-1": compositeAsset("q") },
      { statistics: regionStats(1, 1) },
    );
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(input));
    expect(documentXml).not.toContain("<w:tbl");
  });

  it("texto do corpo nao desaparece com ativos compostos", async () => {
    const input = compositeInput(
      singleRegionBlocks("layout-25-1", [25]),
      [region("layout-25-1", "quadro-1-page-25", "quadro", 25, 25)],
      { "quadro-1-page-25::p25::rlayout-25-1": compositeAsset("q") },
      { statistics: regionStats(1, 1) },
    );
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(input));
    expect(documentText(documentXml)).toContain("Texto antes do elemento visual.");
    expect(documentText(documentXml)).toContain("Texto depois do elemento visual.");
  });

  describe("sumario aceita titulo numerado colado", () => {
    function gluedInput(headingText: string): PdfTextDraftExportInput {
      return baseInput({
        includeReconstructedPretextuals: false,
        reconstruction: {
          ...baseInput().reconstruction,
          bodyStart: { found: true, pageNumber: 17, lineIndex: 1, text: headingText },
          blocks: [
            { type: "heading", text: "1 INTRODUÇÃO", pageStart: 17, pageEnd: 17, sourceLines: [{ pageNumber: 17, lineIndex: 1 }], confidence: "high", reasons: [] },
            { type: "paragraph", text: "Parágrafo de apoio.", pageStart: 18, pageEnd: 18, sourceLines: [{ pageNumber: 18, lineIndex: 1 }], confidence: "medium", reasons: [] },
            { type: "heading", text: headingText, pageStart: 40, pageEnd: 40, sourceLines: [{ pageNumber: 40, lineIndex: 1 }], confidence: "high", reasons: [] },
          ],
          statistics: { ...baseInput().reconstruction.statistics, headingCount: 2, paragraphCount: 1 },
        },
      });
    }

    it("4.3Título aparece no sumario normalizado com bookmark e PAGEREF", async () => {
      const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(gluedInput("4.3Título")));
      const text = documentText(documentXml);
      expect(text).toContain("SUMÁRIO");
      expect(text).toContain("4.3 Título");
      expect(documentXml).toContain("<w:bookmarkStart");
      expect(documentXml).toContain("PAGEREF");
    });

    it("4.3. Título continua valido e aparece no sumario", async () => {
      const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(gluedInput("4.3. Título")));
      const text = documentText(documentXml);
      expect(text).toContain("SUMÁRIO");
      expect(text).toContain("4.3. Título");
      expect(documentXml).toContain("<w:bookmarkStart");
      expect(documentXml).toContain("PAGEREF");
    });
  });

  describe("delimitacao estrutural e paginacao de imagens", () => {
    const logo = readFileSync(join(process.cwd(), "public", "assets", "ufla-logo.jpeg"));

    function graficoInput(opts: { asset?: { width: number; height: number }; pageEnd?: number }): PdfTextDraftExportInput {
      const visualAssets = opts.asset
        ? { "layout-40-1": { data: logo, width: opts.asset.width, height: opts.asset.height, key: "layout-40-1" } }
        : undefined;
      return baseInput({
        visualAssets,
        reconstruction: {
          ...baseInput().reconstruction,
          blocks: [
            { type: "paragraph" as const, text: "Texto antes do grafico para validacao.", pageStart: 1, pageEnd: 1, sourceLines: [{ pageNumber: 1, lineIndex: 0 }], confidence: "medium" as const, reasons: [] },
            { type: "caption" as const, text: "Gráfico 1 – Vendas.", pageStart: 40, pageEnd: 40, sourceLines: [{ pageNumber: 40, lineIndex: 0 }], confidence: "high" as const, reasons: [], layoutRegionId: "layout-40-1" },
            { type: "source" as const, text: "Fonte: Autor.", pageStart: 40, pageEnd: 40, sourceLines: [{ pageNumber: 40, lineIndex: 1 }], confidence: "high" as const, reasons: [], layoutRegionId: "layout-40-1" },
          ],
          layoutRegions: [{
            id: "layout-40-1",
            pageStart: 40,
            pageEnd: opts.pageEnd ?? 40,
            startLineIndex: 0,
            endLineIndex: 1,
            kind: "grafico",
            caption: "Gráfico 1 – Vendas.",
            source: "Fonte: Autor.",
            confidence: "high" as const,
            reasons: [],
          }],
          statistics: { ...baseInput().reconstruction.statistics, layoutRegionCount: 1, captionCount: 1, sourceCount: 1, unresolvedCount: 0, paragraphCount: 1 },
        },
      });
    }

    it("legenda de elemento visual recebe keepNext no document.xml", async () => {
      const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(graficoInput({})));
      const captionParagraph = (documentXml.match(/<w:p\b[\s\S]*?<\/w:p>/g) ?? []).find((p) => p.includes("Gráfico 1 – Vendas."));
      expect(captionParagraph).toBeDefined();
      expect(captionParagraph).toContain("<w:keepNext/>");
    });

    it("imagem alta respeita a altura maxima da mancha do Word", async () => {
      const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(graficoInput({ asset: { width: 800, height: 2000 } })));
      const extent = documentXml.match(/<wp:extent cx="(\d+)" cy="(\d+)"\/>/);
      expect(extent).not.toBeNull();
      const cx = Number(extent![1]);
      const cy = Number(extent![2]);
      const MAX_CY_EMU = 933 * 9525;
      expect(cy).toBeLessThanOrEqual(MAX_CY_EMU);
      expect(cy).toBeLessThan(2000 * 9525);
      expect(cx).toBeGreaterThan(0);
      expect(documentXml).toContain("<w:drawing");
    });

    it("recorte nao confiavel (regiao muito longa) mantem marcador em vez de imagem", async () => {
      const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(graficoInput({ pageEnd: 44 })));
      const marker = "Elemento visual não inserido neste rascunho textual - Gráfico, páginas originais 40-44";
      expect(documentXml).toContain(marker);
      const captionRuns = (documentXml.match(/<w:t[^>]*>Gráfico 1 – Vendas\.<\/w:t>/g) ?? []).length;
      expect(captionRuns).toBe(1);
    });

    it("grafico com recorte valido e inserido como imagem", async () => {
      const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(graficoInput({ asset: { width: 400, height: 300 } })));
      expect(documentXml).toContain("<w:drawing");
      const captionRuns = (documentXml.match(/<w:t[^>]*>Gráfico 1 – Vendas\.<\/w:t>/g) ?? []).length;
      expect(captionRuns).toBe(1);
      expect(documentXml).not.toContain("Elemento visual não inserido neste rascunho textual - Gráfico");
    });
  });

  describe("atomicidade e precisao de recortes estruturais (correcoes)", () => {
    const logo = readFileSync(join(process.cwd(), "public", "assets", "ufla-logo.jpeg"));
    const MARKER = "Elemento visual não inserido";

    function multipageVisualInput(opts: {
      id: string;
      logicalId: string;
      pageStart: number;
      pageEnd: number;
      kind: "quadro" | "grafico" | "tabela";
      caption: string;
      source: string;
      coveredPages: number[];
    }): PdfTextDraftExportInput {
      const region: PdfTextDraftExportInput["reconstruction"]["layoutRegions"][number] = {
        id: opts.id,
        pageStart: opts.pageStart,
        pageEnd: opts.pageEnd,
        startLineIndex: 0,
        endLineIndex: 1,
        kind: opts.kind,
        caption: opts.caption,
        source: opts.source,
        confidence: "high",
        reasons: [],
        logicalVisualId: opts.logicalId,
      };
      const visualAssets: Record<string, PdfTextDraftVisualAsset> = {};
      for (const p of opts.coveredPages) {
        const key = pdfRegionCropKey(opts.logicalId, p, opts.id);
        visualAssets[key] = {
          data: logo,
          width: 400,
          height: 300,
          altText: { title: opts.caption, description: opts.caption, name: opts.caption },
        };
      }
      const blocks: PdfTextDraftExportInput["reconstruction"]["blocks"] = [
        { type: "paragraph", text: "Texto antes do elemento visual para validacao.", pageStart: opts.pageStart, pageEnd: opts.pageStart, sourceLines: [{ pageNumber: opts.pageStart, lineIndex: 0 }], confidence: "medium", reasons: [] },
        { type: "caption", text: opts.caption, pageStart: opts.pageStart, pageEnd: opts.pageStart, sourceLines: [{ pageNumber: opts.pageStart, lineIndex: 0 }], confidence: "high", reasons: [], layoutRegionId: opts.id },
        { type: "source", text: opts.source, pageStart: opts.pageEnd, pageEnd: opts.pageEnd, sourceLines: [{ pageNumber: opts.pageEnd, lineIndex: 1 }], confidence: "high", reasons: [], layoutRegionId: opts.id },
      ];
      return baseInput({
        visualAssets: Object.keys(visualAssets).length ? visualAssets : undefined,
        reconstruction: {
          ...baseInput().reconstruction,
          blocks,
          layoutRegions: [region],
          statistics: { ...baseInput().reconstruction.statistics, layoutRegionCount: 1, captionCount: 1, sourceCount: 1, unresolvedCount: 0, paragraphCount: 1 },
        },
      });
    }

    it("E1 regiao multipagina com uma pagina faltando gera exatamente um marcador (sem imagem)", async () => {
      const input = multipageVisualInput({ id: "layout-40-1", logicalId: "g10", pageStart: 40, pageEnd: 41, kind: "grafico", caption: "Gráfico 10 – Evolução.", source: "Fonte: Autor.", coveredPages: [40] });
      const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(input));
      const markers = documentXml.match(new RegExp(MARKER, "g")) ?? [];
      expect(markers).toHaveLength(1);
      // apenas o logo (1 drawing); nenhuma imagem do elemento visual
      expect((documentXml.match(/<w:drawing/g) ?? []).length).toBe(1);
    });

    it("E2 marcador multipagina mostra o intervalo integral (paginas originais X-Y)", async () => {
      const input = multipageVisualInput({ id: "layout-40-1", logicalId: "g10", pageStart: 40, pageEnd: 42, kind: "grafico", caption: "Gráfico 10 – Evolução.", source: "Fonte: Autor.", coveredPages: [] });
      const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(input));
      expect(documentXml).toContain("páginas originais 40-42");
      expect((documentXml.match(/<w:drawing/g) ?? []).length).toBe(1); // sem imagem do elemento
    });

    it("E3 4.3 aparece no sumario; nenhuma w:tbl; bookmarks e PAGEREF presentes", async () => {
      const input = baseInput({
        reconstruction: {
          ...baseInput().reconstruction,
          blocks: [
            ...baseInput().reconstruction.blocks,
            { type: "heading", text: "4.3 Metodologia", pageStart: 40, pageEnd: 40, sourceLines: [{ pageNumber: 40, lineIndex: 1 }], confidence: "high", reasons: [] },
          ],
        },
      });
      const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(input));
      const text = documentText(documentXml);
      expect(text).toContain("SUMÁRIO");
      expect(text).toContain("4.3 Metodologia");
      expect(documentXml).not.toContain("<w:tbl");
      expect(documentXml).toContain("<w:bookmarkStart");
      expect(documentXml).toContain("PAGEREF");
    });

    it("E4 Grafico 10 com ativos presentes e inserido como imagem; fonte aparece como texto fora da imagem", async () => {
      const input = multipageVisualInput({ id: "layout-40-1", logicalId: "grafico-10-page-40", pageStart: 40, pageEnd: 40, kind: "grafico", caption: "Gráfico 10 – Evolução.", source: "Fonte: Autor.", coveredPages: [40] });
      const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(input));
      // logo (1) + imagem do elemento (1) = 2 drawings
      expect((documentXml.match(/<w:drawing/g) ?? []).length).toBe(2); // imagem inserida
      expect(documentXml).not.toContain(MARKER); // nenhum marcador
      expect(documentText(documentXml)).toContain("Fonte: Autor."); // fonte como texto (fora do PNG)
      expect(documentText(documentXml)).toContain("Gráfico 10 – Evolução."); // legenda como texto
    });

    it("E5 grupo logico parcialmente valido gera zero imagens e um unico marcador (paginas 63-64)", async () => {
      const regions: PdfTextDraftExportInput["reconstruction"]["layoutRegions"] = [
        { id: "rA", pageStart: 63, pageEnd: 63, startLineIndex: 0, endLineIndex: 1, kind: "quadro", caption: "Quadro 8 – X.", source: "Fonte: A.", confidence: "high", reasons: [], logicalVisualId: "q8" },
        { id: "rB", pageStart: 64, pageEnd: 64, startLineIndex: 0, endLineIndex: 1, kind: "quadro", caption: "Quadro 8 – Y.", source: "Fonte: B.", confidence: "high", reasons: [], logicalVisualId: "q8" },
      ];
      const visualAssets: Record<string, PdfTextDraftVisualAsset> = {
        [pdfRegionCropKey("q8", 63, "rA")]: { data: logo, width: 400, height: 300, altText: { title: "Quadro 8 – X.", description: "x", name: "x" } },
      };
      const blocks: PdfTextDraftExportInput["reconstruction"]["blocks"] = [
        { type: "paragraph", text: "Texto antes do elemento visual para validacao.", pageStart: 63, pageEnd: 63, sourceLines: [{ pageNumber: 63, lineIndex: 0 }], confidence: "medium", reasons: [] },
        { type: "caption", text: "Quadro 8 – X.", pageStart: 63, pageEnd: 63, sourceLines: [{ pageNumber: 63, lineIndex: 0 }], confidence: "high", reasons: [], layoutRegionId: "rA" },
        { type: "source", text: "Fonte: A.", pageStart: 63, pageEnd: 63, sourceLines: [{ pageNumber: 63, lineIndex: 1 }], confidence: "high", reasons: [], layoutRegionId: "rA" },
        { type: "caption", text: "Quadro 8 – Y.", pageStart: 64, pageEnd: 64, sourceLines: [{ pageNumber: 64, lineIndex: 0 }], confidence: "high", reasons: [], layoutRegionId: "rB" },
        { type: "source", text: "Fonte: B.", pageStart: 64, pageEnd: 64, sourceLines: [{ pageNumber: 64, lineIndex: 1 }], confidence: "high", reasons: [], layoutRegionId: "rB" },
      ];
      const input = baseInput({
        visualAssets,
        reconstruction: {
          ...baseInput().reconstruction,
          blocks,
          layoutRegions: regions,
          statistics: { ...baseInput().reconstruction.statistics, layoutRegionCount: 2, captionCount: 2, sourceCount: 2, unresolvedCount: 0, paragraphCount: 1 },
        },
      });
      const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(input));
      // zero imagens do q8: apenas o logo (1 drawing)
      expect((documentXml.match(/<w:drawing/g) ?? []).length).toBe(1);
      // exatamente um marcador
      const markers = documentXml.match(new RegExp(MARKER, "g")) ?? [];
      expect(markers).toHaveLength(1);
      // marcador abrange o intervalo integral do grupo (63-64)
      expect(documentXml).toContain("páginas originais 63-64");
      // nao ha marcadores parciais 63-63 nem 64-64
      expect(documentXml).not.toContain("páginas originais 63-63");
      expect(documentXml).not.toContain("páginas originais 64-64");
    });
  });
});
