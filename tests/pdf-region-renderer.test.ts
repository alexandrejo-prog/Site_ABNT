import { describe, expect, it } from "vitest";
import type {
  ImportedPdfDocument,
  PdfDocumentBlock,
  PdfPageText,
  PdfTextItem,
} from "../src/imported-pdf";
import {
  computeRegionCropRect,
  detectPdfVisualRegionCandidates,
} from "../src/pdf-region-renderer";

function page(pageNumber: number, width = 800, height = 1000): PdfPageText {
  return { pageNumber, width, height, items: [] as PdfTextItem[], normalizedText: "" };
}

function block(input: {
  id: string;
  kind: PdfDocumentBlock["kind"];
  pageNumber: number;
  text: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}): PdfDocumentBlock {
  return {
    id: input.id,
    kind: input.kind,
    pageNumber: input.pageNumber,
    text: input.text,
    x: input.x ?? 0,
    y: input.y ?? 0,
    width: input.width ?? 100,
    height: input.height ?? 20,
    confidence: "high",
  };
}

function docWith(pages: PdfPageText[], blocks: PdfDocumentBlock[]): ImportedPdfDocument {
  return {
    source: { fileName: "exemplo.pdf", pageCount: pages.length },
    pages,
    blocks,
    diagnostics: [],
    quality: { textConfidence: "high", layoutConfidence: "medium", requiresManualReview: false },
  };
}

describe("detectPdfVisualRegionCandidates", () => {
  it("detecta região entre 'Quadro 1 – ...' e 'Fonte: ...' como table-visual", () => {
    const document = docWith(
      [page(1)],
      [
        block({ id: "c1", kind: "caption", pageNumber: 1, text: "Quadro 1 – Vantagens do teletrabalho.", x: 0, y: 800, height: 20 }),
        block({ id: "s1", kind: "source", pageNumber: 1, text: "Fonte: Autor (2025).", x: 0, y: 600 }),
      ],
    );
    const regions = detectPdfVisualRegionCandidates(document);
    expect(regions).toHaveLength(1);
    expect(regions[0].kind).toBe("table-visual");
    expect(regions[0].caption).toContain("Quadro 1");
    expect(regions[0].source).toContain("Fonte:");
    expect(regions[0].confidence).toBe("high");
  });

  it("detecta 'Gráfico 1 – ...' como chart-visual", () => {
    const document = docWith(
      [page(1)],
      [
        block({ id: "c1", kind: "image-candidate", pageNumber: 1, text: "Gráfico 1 – Evolução.", x: 0, y: 800, height: 20 }),
        block({ id: "s1", kind: "source", pageNumber: 1, text: "Fonte: IBGE (2024).", x: 0, y: 600 }),
      ],
    );
    const regions = detectPdfVisualRegionCandidates(document);
    expect(regions[0].kind).toBe("chart-visual");
  });

  it("detecta 'Figura 1 – ...' como figure-visual", () => {
    const document = docWith(
      [page(1)],
      [
        block({ id: "c1", kind: "image-candidate", pageNumber: 1, text: "Figura 1 – Fluxograma.", x: 0, y: 800, height: 20 }),
        block({ id: "s1", kind: "source", pageNumber: 1, text: "Fonte: Autor (2025).", x: 0, y: 600 }),
      ],
    );
    const regions = detectPdfVisualRegionCandidates(document);
    expect(regions[0].kind).toBe("figure-visual");
  });

  it("aplica margem e mantém a região dentro dos limites da página", () => {
    const document = docWith(
      [page(1, 800, 1000)],
      [
        block({ id: "c1", kind: "caption", pageNumber: 1, text: "Quadro 1 – Teste.", x: 0, y: 800, height: 20 }),
        block({ id: "s1", kind: "source", pageNumber: 1, text: "Fonte: X.", x: 0, y: 600 }),
      ],
    );
    const [region] = detectPdfVisualRegionCandidates(document);
    expect(region.x).toBeGreaterThanOrEqual(0);
    expect(region.y).toBeGreaterThanOrEqual(0);
    expect(region.width).toBeLessThanOrEqual(800);
    expect(region.height).toBeLessThanOrEqual(1000);
    expect(region.width).toBe(800);
  });

  it("região muito grande gera warning e reduz confiança para low", () => {
    const document = docWith(
      [page(1, 800, 1000)],
      [
        block({ id: "c1", kind: "caption", pageNumber: 1, text: "Quadro 1 – Teste.", x: 0, y: 990, height: 20 }),
        block({ id: "s1", kind: "source", pageNumber: 1, text: "Fonte: X.", x: 0, y: 10 }),
      ],
    );
    const [region] = detectPdfVisualRegionCandidates(document);
    expect(region.confidence).toBe("low");
    expect(region.warnings?.some((w) => w.includes("muito grande"))).toBe(true);
    expect(region.y).toBeGreaterThanOrEqual(0);
    expect(region.height).toBeLessThanOrEqual(1000);
  });

  it("região sem fonte abaixo gera warning e confiança medium", () => {
    const document = docWith(
      [page(1)],
      [block({ id: "c1", kind: "caption", pageNumber: 1, text: "Quadro 1 – Teste.", x: 0, y: 800, height: 20 })],
    );
    const [region] = detectPdfVisualRegionCandidates(document);
    expect(region.source).toBeUndefined();
    expect(region.confidence).toBe("medium");
    expect(region.warnings?.some((w) => w.includes("Fonte"))).toBe(true);
  });

  it("não cria região quando não há legenda", () => {
    const document = docWith(
      [page(1)],
      [block({ id: "t1", kind: "text", pageNumber: 1, text: "Parágrafo comum.", x: 0, y: 800, height: 20 })],
    );
    expect(detectPdfVisualRegionCandidates(document)).toHaveLength(0);
  });

  it("não quebra quando a página não tem itens/blocos", () => {
    const document = docWith([page(1)], []);
    expect(detectPdfVisualRegionCandidates(document)).toHaveLength(0);
    const emptyDoc = docWith([], []);
    expect(detectPdfVisualRegionCandidates(emptyDoc)).toHaveLength(0);
  });
});

describe("computeRegionCropRect", () => {
  it("converte região em coordenadas de dispositivo com a escala", () => {
    const region = { pageNumber: 1, x: 0, y: 170, width: 800, height: 240, kind: "table-visual", caption: "Quadro 1", confidence: "high" } as const;
    const rect = computeRegionCropRect(region, 800, 1000, 2);
    expect(rect.sx).toBe(0);
    expect(rect.sw).toBe(1600);
    expect(rect.sh).toBe(480);
    expect(rect.sy).toBeGreaterThan(0);
  });

  it("mantém o recorte dentro dos limites da página", () => {
    const region = { pageNumber: 1, x: -50, y: -20, width: 900, height: 1100, kind: "table-visual", caption: "Quadro 1", confidence: "high" } as const;
    const rect = computeRegionCropRect(region, 800, 1000, 2);
    expect(rect.sx).toBe(0);
    expect(rect.sy).toBe(0);
    expect(rect.sw).toBeLessThanOrEqual(1600);
    expect(rect.sh).toBeLessThanOrEqual(2000);
  });
});
