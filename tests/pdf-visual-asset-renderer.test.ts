import { describe, expect, it } from "vitest";
import { renderPdfVisualAssets } from "../src/pdf-visual-asset-renderer";
import type { PdfVisualCropGeometry } from "../src/pdf-visual-crop-geometry";
import type { PdfLayoutSensitiveRegionDiagnostic } from "../src/imported-pdf-diagnostic";

type FakePageSpec = { failGetPage?: boolean; failRender?: boolean };

function makeFakePdf(pageSpecs: Record<number, FakePageSpec>) {
  const numPages = Math.max(0, ...Object.keys(pageSpecs).map((key) => Number(key)));
  return {
    numPages,
    getPage: async (pageNumber: number) => {
      if (pageSpecs[pageNumber]?.failGetPage) throw new Error(`falha ao obter página ${pageNumber}`);
      const failRender = pageSpecs[pageNumber]?.failRender ?? false;
      return {
        getViewport: () => ({ width: 100, height: 100 }),
        render: () => ({ promise: failRender ? Promise.reject(new Error(`falha ao renderizar página ${pageNumber}`)) : Promise.resolve() }),
        cleanup: () => {},
      };
    },
    destroy: async () => {},
  };
}

function makeCreateCanvas(failWidthBelow?: number) {
  return (width: number, _height: number) => {
    if (failWidthBelow != null && width < failWidthBelow) throw new Error("canvas pequeno indisponível");
    return {
      width,
      height: _height,
      getContext: () => ({ drawImage() {} }),
      convertToBlob: async () => new Blob([new Uint8Array([1, 2, 3, 4])], { type: "image/png" }),
    };
  };
}

function crop(partial: Partial<PdfVisualCropGeometry> & {
  regionId: string;
  visualKey: string;
  pageNumber: number;
  normalizedRect: { x: number; y: number; width: number; height: number };
}): PdfVisualCropGeometry {
  return {
    sourceRect: { x: 0, y: 0, width: 100, height: 100 },
    pageWidth: 100,
    pageHeight: 100,
    confidence: "high",
    reasons: [],
    logicalVisualId: partial.visualKey,
    ...partial,
  } as PdfVisualCropGeometry;
}

function region(id: string, kind: PdfLayoutSensitiveRegionDiagnostic["kind"], visualKey: string): PdfLayoutSensitiveRegionDiagnostic {
  return {
    id,
    pageStart: 1,
    pageEnd: 1,
    startLineIndex: 1,
    endLineIndex: 2,
    kind,
    caption: `${visualKey}`,
    confidence: "high",
    reasons: [],
    logicalVisualId: visualKey,
  };
}

const BIG = { x: 0, y: 0, width: 0.9, height: 0.9 };
const SMALL = { x: 0, y: 0, width: 0.3, height: 0.3 };

describe("renderPdfVisualAssets: resiliência de rasterização", () => {
  it("dois crops na mesma página, o primeiro falha e o segundo é produzido", async () => {
    const crops = [
      crop({ regionId: "layout-a", visualKey: "grafico-a-page-1", pageNumber: 1, normalizedRect: SMALL }),
      crop({ regionId: "layout-b", visualKey: "grafico-b-page-1", pageNumber: 1, normalizedRect: BIG }),
    ];
    const { assets, warnings } = await renderPdfVisualAssets(
      new Uint8Array([1, 2, 3]),
      crops,
      { scale: 1, maxOutputWidth: 1000, maxOutputHeight: 1000, concurrency: 1 },
      { openPdfDocument: async () => makeFakePdf({ 1: {} }) as never, createCanvas: makeCreateCanvas(50) as never },
    );
    expect(Object.keys(assets)).toEqual(["grafico-b-page-1::p1::rlayout-b"]);
    expect(warnings.some((w) => w.includes("cropKey=grafico-a-page-1::p1::rlayout-a") && w.includes("estagio=canvas-export"))).toBe(true);
  });

  it("o segundo crop falha e o primeiro permanece", async () => {
    const crops = [
      crop({ regionId: "layout-a", visualKey: "grafico-a-page-1", pageNumber: 1, normalizedRect: BIG }),
      crop({ regionId: "layout-b", visualKey: "grafico-b-page-1", pageNumber: 1, normalizedRect: SMALL }),
    ];
    const { assets, warnings } = await renderPdfVisualAssets(
      new Uint8Array([1, 2, 3]),
      crops,
      { scale: 1, maxOutputWidth: 1000, maxOutputHeight: 1000, concurrency: 1 },
      { openPdfDocument: async () => makeFakePdf({ 1: {} }) as never, createCanvas: makeCreateCanvas(50) as never },
    );
    expect(Object.keys(assets)).toEqual(["grafico-a-page-1::p1::rlayout-a"]);
    expect(warnings.some((w) => w.includes("cropKey=grafico-b-page-1::p1::rlayout-b") && w.includes("estagio=canvas-export"))).toBe(true);
  });

  it("falha de renderização da página produz warning para todos os crops daquela página", async () => {
    const crops = [
      crop({ regionId: "layout-a", visualKey: "grafico-a-page-1", pageNumber: 1, normalizedRect: BIG }),
      crop({ regionId: "layout-b", visualKey: "grafico-b-page-1", pageNumber: 1, normalizedRect: BIG }),
    ];
    const { assets, warnings } = await renderPdfVisualAssets(
      new Uint8Array([1, 2, 3]),
      crops,
      { scale: 1, maxOutputWidth: 1000, maxOutputHeight: 1000, concurrency: 1 },
      { openPdfDocument: async () => makeFakePdf({ 1: { failRender: true } }) as never, createCanvas: makeCreateCanvas() as never },
    );
    expect(Object.keys(assets)).toHaveLength(0);
    expect(warnings.filter((w) => w.includes("estagio=page-render")).length).toBe(2);
    expect(warnings.some((w) => w.includes("cropKey=grafico-a-page-1::p1::rlayout-a"))).toBe(true);
    expect(warnings.some((w) => w.includes("cropKey=grafico-b-page-1::p1::rlayout-b"))).toBe(true);
  });

  it("falha de uma página não impede ativos de outra página", async () => {
    const crops = [
      crop({ regionId: "layout-a", visualKey: "grafico-a-page-1", pageNumber: 1, normalizedRect: BIG }),
      crop({ regionId: "layout-b", visualKey: "grafico-b-page-2", pageNumber: 2, normalizedRect: BIG }),
    ];
    const { assets, warnings } = await renderPdfVisualAssets(
      new Uint8Array([1, 2, 3]),
      crops,
      { scale: 1, maxOutputWidth: 1000, maxOutputHeight: 1000, concurrency: 1 },
      { openPdfDocument: async () => makeFakePdf({ 1: { failRender: true }, 2: {} }) as never, createCanvas: makeCreateCanvas() as never },
    );
    expect(Object.keys(assets)).toEqual(["grafico-b-page-2::p2::rlayout-b"]);
    expect(warnings.filter((w) => w.includes("estagio=page-render")).length).toBe(1);
  });

  it("warning contém pageNumber, cropKey, logicalVisualId, kind e estágio", async () => {
    const crops = [
      crop({ regionId: "layout-a", visualKey: "grafico-a-page-1", pageNumber: 1, normalizedRect: BIG }),
    ];
    const regions = [region("layout-a", "grafico", "grafico-a-page-1")];
    const { warnings } = await renderPdfVisualAssets(
      new Uint8Array([1, 2, 3]),
      crops,
      { scale: 1, maxOutputWidth: 1000, maxOutputHeight: 1000, concurrency: 1 },
      { openPdfDocument: async () => makeFakePdf({ 1: { failRender: true } }) as never, createCanvas: makeCreateCanvas() as never },
      regions,
    );
    const warning = warnings.find((w) => w.includes("cropKey=grafico-a-page-1::p1::rlayout-a"));
    expect(warning).toBeDefined();
    expect(warning).toContain("pagina=1");
    expect(warning).toContain("id=grafico-a-page-1");
    expect(warning).toContain("tipo=grafico");
    expect(warning).toContain("estagio=page-render");
  });

  it("ativos permanecem em ordem determinística", async () => {
    const crops = [
      crop({ regionId: "layout-b", visualKey: "grafico-b-page-2", pageNumber: 2, normalizedRect: BIG }),
      crop({ regionId: "layout-a", visualKey: "grafico-a-page-1", pageNumber: 1, normalizedRect: BIG }),
      crop({ regionId: "layout-c", visualKey: "grafico-c-page-3", pageNumber: 3, normalizedRect: BIG }),
    ];
    const { assets } = await renderPdfVisualAssets(
      new Uint8Array([1, 2, 3]),
      crops,
      { scale: 1, maxOutputWidth: 1000, maxOutputHeight: 1000, concurrency: 1 },
      { openPdfDocument: async () => makeFakePdf({ 1: {}, 2: {}, 3: {} }) as never, createCanvas: makeCreateCanvas() as never },
    );
    expect(Object.keys(assets)).toEqual([
      "grafico-a-page-1::p1::rlayout-a",
      "grafico-b-page-2::p2::rlayout-b",
      "grafico-c-page-3::p3::rlayout-c",
    ]);
  });

  it("warnings permanecem em ordem determinística", async () => {
    const crops = [
      crop({ regionId: "layout-a", visualKey: "grafico-a-page-1", pageNumber: 1, normalizedRect: SMALL }),
      crop({ regionId: "layout-b", visualKey: "grafico-b-page-2", pageNumber: 2, normalizedRect: SMALL }),
    ];
    const opts = { scale: 1, maxOutputWidth: 1000, maxOutputHeight: 1000, concurrency: 1 } as const;
    const deps = { openPdfDocument: async () => makeFakePdf({ 1: {}, 2: {} }) as never, createCanvas: makeCreateCanvas(50) as never };
    const first = await renderPdfVisualAssets(new Uint8Array([1, 2, 3]), crops, opts, deps);
    const second = await renderPdfVisualAssets(new Uint8Array([1, 2, 3]), crops, opts, deps);
    expect(first.warnings).toEqual(second.warnings);
  });

  it("exceção é normalizada sem quebrar o fluxo", async () => {
    const crops = [
      crop({ regionId: "layout-a", visualKey: "grafico-a-page-1", pageNumber: 1, normalizedRect: SMALL }),
    ];
    const { assets, warnings } = await renderPdfVisualAssets(
      new Uint8Array([1, 2, 3]),
      crops,
      { scale: 1, maxOutputWidth: 1000, maxOutputHeight: 1000, concurrency: 1 },
      { openPdfDocument: async () => makeFakePdf({ 1: {} }) as never, createCanvas: makeCreateCanvas(50) as never },
    );
    expect(Object.keys(assets)).toHaveLength(0);
    expect(warnings.some((w) => w.includes("mensagem=canvas pequeno indisponível") && !w.includes("at\n") && !w.includes("stack"))).toBe(true);
  });

  it("crop inválido gera warning e não ativo", async () => {
    const crops = [
      crop({ regionId: "layout-a", visualKey: "grafico-a-page-1", pageNumber: 1, normalizedRect: { x: 0, y: 0, width: 0, height: 0.5 } }),
    ];
    const { assets, warnings } = await renderPdfVisualAssets(
      new Uint8Array([1, 2, 3]),
      crops,
      { scale: 1, maxOutputWidth: 1000, maxOutputHeight: 1000, concurrency: 1 },
      { openPdfDocument: async () => makeFakePdf({ 1: {} }) as never, createCanvas: makeCreateCanvas() as never },
    );
    expect(Object.keys(assets)).toHaveLength(0);
    expect(warnings.some((w) => w.includes("estagio=crop-validation") && w.includes("cropKey=grafico-a-page-1::p1::rlayout-a"))).toBe(true);
  });

  it("funciona sem pacote de canvas externo (usa dependências falsas)", async () => {
    const crops = [
      crop({ regionId: "layout-a", visualKey: "grafico-a-page-1", pageNumber: 1, normalizedRect: BIG }),
    ];
    const { assets } = await renderPdfVisualAssets(
      new Uint8Array([1, 2, 3]),
      crops,
      { scale: 1, maxOutputWidth: 1000, maxOutputHeight: 1000, concurrency: 1 },
      { openPdfDocument: async () => makeFakePdf({ 1: {} }) as never, createCanvas: makeCreateCanvas() as never },
    );
    expect(Object.keys(assets)).toHaveLength(1);
  });
});
