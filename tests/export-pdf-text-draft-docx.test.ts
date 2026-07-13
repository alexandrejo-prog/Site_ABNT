import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import JSZip from "jszip";
import {
  buildPdfTextDraftDocxBlob,
  pdfTextDraftFileName,
  validatePdfTextDraftExport,
} from "../src/export-pdf-text-draft-docx";
import type { PdfTextDraftExportInput } from "../src/pdf-text-draft-contract";
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
});
