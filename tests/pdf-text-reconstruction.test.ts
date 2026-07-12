import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import type {
  ImportedPdfDocument,
  PdfSemanticBlock,
  PdfTextItem,
  PdfRegion,
  RenderedPdfRegion,
} from "../src/imported-pdf";
import { reconstructPdfSemanticBlocks, applyPreTextualFilter } from "../src/pdf-text-reconstruction";
import { buildPdfTextDraftDocxBlob } from "../src/export-docx";
import { emptyAcademicFields } from "../src/ufla-rules";

function lineItem(text: string, pageNumber: number, y: number, x = 72, fontName = "Times"): PdfTextItem {
  return { text, pageNumber, x, y, width: text.length * 6, height: 12, fontName };
}

function pdfDoc(pages: { pageNumber: number; items: PdfTextItem[]; blocks?: ImportedPdfDocument["blocks"] }[]): ImportedPdfDocument {
  return {
    source: { fileName: "exemplo.pdf", pageCount: pages.length },
    pages: pages.map((p) => ({
      pageNumber: p.pageNumber,
      width: 800,
      height: 1000,
      items: p.items,
      normalizedText: p.items.map((it) => it.text).join("\n"),
    })),
    blocks: pages.flatMap((p) => p.blocks ?? []),
    diagnostics: [],
    quality: { textConfidence: "high", layoutConfidence: "medium", requiresManualReview: false },
  };
}

// Tarefa 5: três linhas visuais de um mesmo parágrafo viram UM parágrafo.
describe("reconstrução semântica de PDF", () => {
  it("junta três linhas de um mesmo parágrafo em um único bloco de parágrafo", () => {
    const doc = pdfDoc([
      {
        pageNumber: 1,
        items: [
          lineItem("Este é o início de um parágrafo que", 1, 700),
          lineItem("continua na linha seguinte e", 1, 686),
          lineItem("termina aqui na terceira linha.", 1, 672),
        ],
      },
    ]);
    const blocks = reconstructPdfSemanticBlocks(doc, { includePreTextualPages: true });
    const paragraphs = blocks.filter((b) => b.kind === "paragraph");
    expect(paragraphs).toHaveLength(1);
    expect(paragraphs[0].text).toBe(
      "Este é o início de um parágrafo que continua na linha seguinte e termina aqui na terceira linha.",
    );
  });

  it("mantém parágrafos distintos separados quando há quebra de bloco", () => {
    const doc = pdfDoc([
      {
        pageNumber: 1,
        items: [
          lineItem("Primeiro parágrafo independente.", 1, 700),
          lineItem("Segundo parágrafo independente.", 1, 600),
        ],
      },
    ]);
    const blocks = reconstructPdfSemanticBlocks(doc, { includePreTextualPages: true });
    const paragraphs = blocks.filter((b) => b.kind === "paragraph");
    expect(paragraphs).toHaveLength(2);
  });

  // Tarefa 6: números de página não viram parágrafos.
  it("descarta números de página repetidos no rodapé", () => {
    const pages = [1, 2, 3].map((pageNumber) => ({
      pageNumber,
      items: [
        lineItem("Texto de corpo do documento nesta página.", pageNumber, 800),
        lineItem(String(pageNumber), pageNumber, 60, 700),
      ],
    }));
    const doc = pdfDoc(pages);
    const blocks = reconstructPdfSemanticBlocks(doc, { includePreTextualPages: true });
    const pageNumbers = blocks.filter((b) => /^\d{1,4}$/.test(b.text.trim()));
    expect(pageNumbers).toHaveLength(0);
    expect(blocks.filter((b) => b.kind === "paragraph")).toHaveLength(3);
  });

  // Tarefa 7: títulos, legendas e fontes viram blocos separados.
  it("separa títulos numerados, legendas e fontes em blocos próprios", () => {
    const doc = pdfDoc([
      {
        pageNumber: 1,
        items: [
          lineItem("1 INTRODUÇÃO", 1, 850),
          lineItem("Texto introdutório de exemplo.", 1, 820),
          lineItem("Quadro 1 - Resultados observados", 1, 700),
          lineItem("Fonte: Dados da pesquisa (2025).", 1, 400),
        ],
      },
    ]);
    const blocks = reconstructPdfSemanticBlocks(doc, { includePreTextualPages: true });
    expect(blocks.some((b) => b.kind === "heading" && b.text.includes("INTRODUÇÃO"))).toBe(true);
    expect(blocks.some((b) => b.kind === "caption" && b.text.includes("Quadro 1"))).toBe(true);
    expect(blocks.some((b) => b.kind === "source" && b.text.includes("Fonte:"))).toBe(true);
    expect(blocks.some((b) => b.kind === "paragraph")).toBe(true);
  });

  // Tarefa 8: região visual vira bloco visual e linhas internas não viram parágrafo.
  it("converte região visual em bloco visual e exclui as linhas internas do corpo", () => {
    const doc = pdfDoc([
      {
        pageNumber: 3,
        items: [
          lineItem("Quadro 1 - Distribuição por categoria", 3, 820),
          lineItem("Categoria A        12", 3, 700),
          lineItem("Categoria B        28", 3, 686),
          lineItem("Categoria C         9", 3, 672),
          lineItem("Fonte: IBGE (2025).", 3, 400),
        ],
        blocks: [
          { id: "3-c", kind: "caption", pageNumber: 3, text: "Quadro 1 - Distribuição por categoria", y: 820, x: 72, width: 300, height: 12, confidence: "high" },
          { id: "3-s", kind: "source", pageNumber: 3, text: "Fonte: IBGE (2025).", y: 400, x: 72, width: 200, height: 12, confidence: "high" },
          { id: "3-t1", kind: "table-candidate", pageNumber: 3, text: "Categoria A        12", y: 700, x: 72, width: 200, height: 12, confidence: "medium" },
          { id: "3-t2", kind: "table-candidate", pageNumber: 3, text: "Categoria B        28", y: 686, x: 72, width: 200, height: 12, confidence: "medium" },
          { id: "3-t3", kind: "table-candidate", pageNumber: 3, text: "Categoria C         9", y: 672, x: 72, width: 200, height: 12, confidence: "medium" },
        ],
      },
    ]);
    const blocks = reconstructPdfSemanticBlocks(doc, { includePreTextualPages: true });
    const visual = blocks.find((b) => b.kind === "visual");
    expect(visual).toBeDefined();
    expect((visual as { visualRegion: PdfRegion }).visualRegion.caption).toContain("Quadro 1");
    // As linhas da tabela NÃO viram parágrafos soltos.
    expect(blocks.some((b) => b.kind === "paragraph" && b.text.includes("Categoria"))).toBe(false);
    expect(blocks.some((b) => b.kind === "caption")).toBe(true);
    expect(blocks.some((b) => b.kind === "source")).toBe(true);
  });

  // Tarefa 9: páginas pré-textuais excluídas por padrão.
  it("exclui por padrão o conteúdo antes do primeiro título de seção (1 INTRODUÇÃO)", () => {
    const doc = pdfDoc([
      {
        pageNumber: 1,
        items: [
          lineItem("UNIVERSIDADE FEDERAL DE LAVRAS", 1, 900),
          lineItem("Título do trabalho de exemplo", 1, 860),
          lineItem(" Folha de rosto com autor e orientador.", 1, 800),
        ],
      },
      {
        pageNumber: 2,
        items: [lineItem("SUMÁRIO", 2, 900), lineItem("1 Introdução .................. 10", 2, 880)],
      },
      {
        pageNumber: 3,
        items: [
          lineItem("1 INTRODUÇÃO", 3, 900),
          lineItem("Texto da introdução de exemplo.", 3, 860),
        ],
      },
    ]);
    const all = reconstructPdfSemanticBlocks(doc, { includePreTextualPages: true });
    const filtered = applyPreTextualFilter(all);
    expect(filtered[0].kind).toBe("heading");
    expect((filtered[0] as { text: string }).text).toContain("INTRODUÇÃO");
    expect(filtered.some((b) => b.text.includes("Folha de rosto"))).toBe(false);
    expect(filtered.some((b) => b.text.includes("SUMÁRIO"))).toBe(false);
  });
});

// Tarefa 8 (DOCX) + Tarefa 10 (formatação ABNT/UFLA).
describe("DOCX de rascunho a partir de blocos semânticos", () => {
  const ONE_PX_PNG =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC";

  it("gera DOCX com formatação ABNT (justificado, Times 12, recuo, 1,5) e imagem para bloco visual", async () => {
    const caption = "Quadro 1 - Exemplo";
    const region: PdfRegion = {
      pageNumber: 1,
      x: 0,
      y: 400,
      width: 800,
      height: 300,
      kind: "table-visual",
      caption,
      source: "Fonte: IBGE.",
      confidence: "high",
    };
    const rendered: RenderedPdfRegion = {
      pageNumber: 1,
      region,
      mimeType: "image/png",
      dataUrl: ONE_PX_PNG,
      widthPx: 400,
      heightPx: 150,
    };
    const blocks: PdfSemanticBlock[] = [
      {
        id: "h1",
        kind: "heading",
        level: 1,
        pageNumber: 1,
        y: 900,
        text: "1 INTRODUÇÃO",
        lines: [],
        confidence: "high",
      },
      {
        id: "p1",
        kind: "paragraph",
        pageNumber: 1,
        y: 800,
        text: "Este parágrafo exercita a formatação do rascunho gerado a partir do PDF reconstruído.",
        lines: [],
        confidence: "high",
      },
      {
        id: "v1",
        kind: "visual",
        pageNumber: 1,
        y: 400,
        text: "Quadro 1 - Exemplo Fonte: IBGE.",
        lines: [],
        visualRegion: region,
        confidence: "high",
      },
    ];
    const blob = await buildPdfTextDraftDocxBlob({
      fields: emptyAcademicFields(),
      editorText: "",
      documentMode: "pdf-text-draft",
      sourceKind: "pdf",
      semanticBlocks: blocks,
      renderedRegions: [rendered],
      pdfDraftOptions: { includeVisuals: true, includePreTextualPages: true },
    });
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const xml = await zip.file("word/document.xml")!.async("string");
    expect(xml).toContain("<w:drawing>");
    expect(xml).toContain('w:jc w:val="both"');
    expect(xml).toContain('w:ind w:firstLine');
    expect(xml).toContain('w:sz w:val="24"');
    expect(xml).toContain('w:spacing w:line="360"');
    const media = Object.keys(zip.files).filter((name) => name.startsWith("word/media"));
    expect(media.length).toBeGreaterThan(0);
  });

  it("não insere imagem quando includeVisuals é false (vira nota de revisão)", async () => {
    const region: PdfRegion = {
      pageNumber: 1,
      x: 0,
      y: 400,
      width: 800,
      height: 300,
      kind: "table-visual",
      caption: "Quadro 1 - Exemplo",
      confidence: "high",
    };
    const blocks: PdfSemanticBlock[] = [
      {
        id: "v1",
        kind: "visual",
        pageNumber: 1,
        y: 400,
        text: "Quadro 1 - Exemplo",
        lines: [],
        visualRegion: region,
        confidence: "high",
      },
    ];
    const blob = await buildPdfTextDraftDocxBlob({
      fields: emptyAcademicFields(),
      editorText: "",
      documentMode: "pdf-text-draft",
      sourceKind: "pdf",
      semanticBlocks: blocks,
      renderedRegions: [],
      pdfDraftOptions: { includeVisuals: false, includePreTextualPages: true },
    });
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const xml = await zip.file("word/document.xml")!.async("string");
    expect(xml).not.toContain("<w:drawing>");
    expect(xml).toContain("IMAGEM DETECTADA");
  });
});
