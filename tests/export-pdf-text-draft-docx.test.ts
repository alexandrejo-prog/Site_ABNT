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

  it("natureText possui recuo esperado, firstLine zero, espacamento simples e alinhamento justificado", async () => {
    const { documentXml } = await loadDocxParts(await buildPdfTextDraftDocxBlob(baseInput()));
    const natureParagraph = (documentXml.match(/<w:p\b[\s\S]*?<\/w:p>/g) ?? []).find((p) => p.includes("Dissertação apresentada à Universidade Federal de Lavras"));
    expect(natureParagraph).toBeDefined();
    expect(natureParagraph).toContain('<w:ind w:left="4535"');
    expect(natureParagraph).not.toContain('w:firstLine="');
    expect(natureParagraph).toContain('<w:spacing w:before="0" w:after="0" w:line="240"');
    expect(natureParagraph).toContain('w:val="both"');
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
    const regions: Region[] = [{
      id: "layout-11-9", pageStart: 11, pageEnd: 11, startLineIndex: 3, endLineIndex: 4, kind: "quadro",
      caption: "Quadro 9 – Quadro multipágina sintético.", source: "Fonte: Autor (2021).", confidence: "high", reasons: [], logicalVisualId: "quadro-9-page-11",
    }];
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
});
