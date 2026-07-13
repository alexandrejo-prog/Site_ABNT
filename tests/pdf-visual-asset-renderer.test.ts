import { describe, expect, it } from "vitest";
import {
  pdfVisualCropKey,
  renderPdfVisualAssets,
} from "../src/pdf-visual-asset-renderer";
import type { PdfVisualCropGeometry } from "../src/pdf-visual-crop-geometry";

function crop(
  overrides: Partial<PdfVisualCropGeometry> = {},
): PdfVisualCropGeometry {
  return {
    regionId: "region-1",
    visualKey: "visual-1",
    pageNumber: 1,
    sourceRect: { x: 100, y: 100, width: 200, height: 100 },
    normalizedRect: { x: 0.1, y: 0.2, width: 0.4, height: 0.25 },
    pageWidth: 1000,
    pageHeight: 1000,
    confidence: "high",
    reasons: [],
    ...overrides,
  };
}

class FakeCanvas {
  width: number;
  height: number;
  drawCalls: unknown[][] = [];
  blobType?: string;
  blobQuality?: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  getContext(type: "2d") {
    if (type !== "2d") return null;
    return {
      drawImage: (...args: unknown[]) => {
        this.drawCalls.push(args);
      },
    };
  }

  async convertToBlob(options?: { type?: string; quality?: number }): Promise<Blob> {
    this.blobType = options?.type;
    this.blobQuality = options?.quality;
    return new Blob([`canvas:${this.width}x${this.height}`], { type: options?.type });
  }
}

interface FakePageOptions {
  baseWidth?: number;
  baseHeight?: number;
  renderError?: Error;
}

class FakePage {
  readonly viewportScales: number[] = [];
  renderCount = 0;
  cleanupCount = 0;
  private readonly baseWidth: number;
  private readonly baseHeight: number;
  private readonly renderError?: Error;

  constructor(options: FakePageOptions = {}) {
    this.baseWidth = options.baseWidth ?? 500;
    this.baseHeight = options.baseHeight ?? 1000;
    this.renderError = options.renderError;
  }

  getViewport({ scale }: { scale: number }) {
    this.viewportScales.push(scale);
    return { width: this.baseWidth * scale, height: this.baseHeight * scale };
  }

  render() {
    this.renderCount += 1;
    return {
      promise: this.renderError ? Promise.reject(this.renderError) : Promise.resolve(),
    };
  }

  cleanup() {
    this.cleanupCount += 1;
  }
}

class FakeDocument {
  readonly numPages: number;
  destroyCount = 0;
  private readonly pages: Map<number, FakePage>;

  constructor(pages: Record<number, FakePage>) {
    this.pages = new Map(Object.entries(pages).map(([key, value]) => [Number(key), value]));
    this.numPages = Math.max(0, ...this.pages.keys());
  }

  async getPage(pageNumber: number): Promise<FakePage> {
    const page = this.pages.get(pageNumber);
    if (!page) throw new Error("página ausente");
    return page;
  }

  async destroy(): Promise<void> {
    this.destroyCount += 1;
  }
}

function harness(pages: Record<number, FakePage>) {
  const document = new FakeDocument(pages);
  const canvases: FakeCanvas[] = [];
  let openedBytes: Uint8Array | undefined;
  const dependencies = {
    openPdfDocument: async (data: Uint8Array) => {
      openedBytes = data;
      return document;
    },
    createCanvas: (width: number, height: number) => {
      const canvas = new FakeCanvas(width, height);
      canvases.push(canvas);
      return canvas;
    },
  };
  return {
    document,
    canvases,
    dependencies,
    openedBytes: () => openedBytes,
  };
}

describe("renderizador de recortes visuais pdf", () => {
  it("gera chave composta unica por pagina e regiao", () => {
    expect(pdfVisualCropKey(crop())).toBe("visual-1::p1::rregion-1");
    expect(pdfVisualCropKey(crop({ pageNumber: 2, regionId: "r2" }))).toBe("visual-1::p2::rr2");
  });

  it("nao abre o PDF quando nao ha recortes", async () => {
    let opened = false;
    const result = await renderPdfVisualAssets(new Uint8Array([1]), [], {}, {
      openPdfDocument: async () => {
        opened = true;
        return new FakeDocument({ 1: new FakePage() });
      },
    });
    expect(opened).toBe(false);
    expect(result).toEqual({ assets: {}, warnings: [] });
  });

  it("renderiza um recorte como ativo visual", async () => {
    const h = harness({ 1: new FakePage() });
    const result = await renderPdfVisualAssets(new Uint8Array([1, 2, 3]), [crop()], {}, h.dependencies);
    const key = pdfVisualCropKey(crop());
    expect(Object.keys(result.assets)).toEqual([key]);
    expect(result.assets[key].data).toBeInstanceOf(ArrayBuffer);
    expect(result.assets[key].width).toBeGreaterThan(0);
    expect(result.assets[key].height).toBeGreaterThan(0);
    expect(result.assets[key].altText?.name).toBe(key);
    expect(result.warnings).toEqual([]);
  });

  it("nao sobrescreve paginas com o mesmo visualKey", async () => {
    const h = harness({ 1: new FakePage(), 2: new FakePage() });
    const crops = [
      crop({ pageNumber: 1, regionId: "r1", visualKey: "quadro-3" }),
      crop({ pageNumber: 2, regionId: "r2", visualKey: "quadro-3" }),
    ];
    const result = await renderPdfVisualAssets(new Uint8Array([1]), crops, {}, h.dependencies);
    expect(Object.keys(result.assets)).toEqual([
      "quadro-3::p1::rr1",
      "quadro-3::p2::rr2",
    ]);
  });

  it("renderiza uma pagina apenas uma vez quando ela contem varios recortes", async () => {
    const page = new FakePage();
    const h = harness({ 1: page });
    await renderPdfVisualAssets(new Uint8Array([1]), [
      crop({ regionId: "r1" }),
      crop({ regionId: "r2", normalizedRect: { x: 0.2, y: 0.5, width: 0.3, height: 0.2 } }),
    ], {}, h.dependencies);
    expect(page.renderCount).toBe(1);
    expect(h.canvases).toHaveLength(3);
  });

  it("mapeia normalizedRect para pixels do mesmo viewport", async () => {
    const h = harness({ 1: new FakePage({ baseWidth: 500, baseHeight: 1000 }) });
    await renderPdfVisualAssets(new Uint8Array([1]), [crop()], { scale: 2 }, h.dependencies);
    const outputCanvas = h.canvases[1];
    const call = outputCanvas.drawCalls[0];
    expect(call.slice(1, 5)).toEqual([100, 400, 400, 500]);
  });

  it("preserva a rotacao padrao ao nao forcar rotation zero", async () => {
    const page = new FakePage();
    const h = harness({ 1: page });
    await renderPdfVisualAssets(new Uint8Array([1]), [crop()], { scale: 1.5 }, h.dependencies);
    expect(page.viewportScales).toEqual([1.5]);
  });

  it("limita a largura da imagem de saida preservando proporcao", async () => {
    const h = harness({ 1: new FakePage({ baseWidth: 1000, baseHeight: 1000 }) });
    await renderPdfVisualAssets(new Uint8Array([1]), [crop({ normalizedRect: { x: 0, y: 0, width: 1, height: 0.5 } })], {
      scale: 2,
      maxOutputWidth: 800,
      maxOutputHeight: 2000,
      docxMaxWidth: 800,
    }, h.dependencies);
    const outputCanvas = h.canvases[1];
    expect(outputCanvas.width).toBe(800);
    expect(outputCanvas.height).toBe(400);
  });

  it("limita a largura de exibicao no DOCX sem reduzir os bytes renderizados", async () => {
    const h = harness({ 1: new FakePage({ baseWidth: 1000, baseHeight: 1000 }) });
    const result = await renderPdfVisualAssets(new Uint8Array([1]), [crop({ normalizedRect: { x: 0, y: 0, width: 1, height: 0.5 } })], {
      scale: 2,
      maxOutputWidth: 1600,
      docxMaxWidth: 600,
    }, h.dependencies);
    const asset = result.assets[pdfVisualCropKey(crop())];
    expect(h.canvases[1].width).toBe(1600);
    expect(asset.width).toBe(600);
    expect(asset.height).toBe(300);
  });

  it("respeita o limite maximo de ativos e registra aviso", async () => {
    const h = harness({ 1: new FakePage() });
    const result = await renderPdfVisualAssets(new Uint8Array([1]), [
      crop({ regionId: "r1" }),
      crop({ regionId: "r2" }),
    ], { maxAssets: 1 }, h.dependencies);
    expect(Object.keys(result.assets)).toHaveLength(1);
    expect(result.warnings.some((warning) => warning.includes("limite de 1 ativos"))).toBe(true);
  });

  it("mantem marcador futuro ao recusar geometria normalizada invalida", async () => {
    const h = harness({ 1: new FakePage() });
    const invalid = crop({ normalizedRect: { x: 0.9, y: 0.2, width: 0.4, height: 0.2 } });
    const result = await renderPdfVisualAssets(new Uint8Array([1]), [invalid], {}, h.dependencies);
    expect(result.assets).toEqual({});
    expect(result.warnings[0]).toContain("geometria normalizada inválida");
  });

  it("registra pagina inexistente sem abortar", async () => {
    const h = harness({ 1: new FakePage() });
    const result = await renderPdfVisualAssets(new Uint8Array([1]), [crop({ pageNumber: 2 })], {}, h.dependencies);
    expect(result.assets).toEqual({});
    expect(result.warnings[0]).toContain("página inexistente");
  });

  it("continua em outra pagina quando uma renderizacao falha", async () => {
    const h = harness({
      1: new FakePage({ renderError: new Error("falha de render") }),
      2: new FakePage(),
    });
    const result = await renderPdfVisualAssets(new Uint8Array([1]), [
      crop({ pageNumber: 1, regionId: "r1" }),
      crop({ pageNumber: 2, regionId: "r2" }),
    ], { concurrency: 1 }, h.dependencies);
    expect(Object.keys(result.assets)).toEqual(["visual-1::p2::rr2"]);
    expect(result.warnings.some((warning) => warning.includes("falha de render"))).toBe(true);
  });

  it("libera documento, paginas e canvases", async () => {
    const page = new FakePage();
    const h = harness({ 1: page });
    await renderPdfVisualAssets(new Uint8Array([1]), [crop()], {}, h.dependencies);
    expect(h.document.destroyCount).toBe(1);
    expect(page.cleanupCount).toBe(1);
    expect(h.canvases.every((canvas) => canvas.width === 0 && canvas.height === 0)).toBe(true);
  });

  it("copia os bytes antes de entrega-los ao PDF.js", async () => {
    const original = new Uint8Array([1, 2, 3]);
    const h = harness({ 1: new FakePage() });
    h.dependencies.openPdfDocument = async (data: Uint8Array) => {
      data[0] = 99;
      return h.document;
    };
    await renderPdfVisualAssets(original, [crop()], {}, h.dependencies);
    expect(original).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("retorna chaves em ordem deterministica", async () => {
    const h = harness({ 1: new FakePage(), 2: new FakePage() });
    const result = await renderPdfVisualAssets(new Uint8Array([1]), [
      crop({ pageNumber: 2, regionId: "z", visualKey: "b" }),
      crop({ pageNumber: 1, regionId: "a", visualKey: "a" }),
    ], { concurrency: 2 }, h.dependencies);
    expect(Object.keys(result.assets)).toEqual([
      "a::p1::ra",
      "b::p2::rz",
    ]);
  });

  it("encaminha tipo e qualidade JPEG ao canvas", async () => {
    const h = harness({ 1: new FakePage() });
    await renderPdfVisualAssets(new Uint8Array([1]), [crop()], {
      imageType: "image/jpeg",
      jpegQuality: 0.75,
    }, h.dependencies);
    const outputCanvas = h.canvases[1];
    expect(outputCanvas.blobType).toBe("image/jpeg");
    expect(outputCanvas.blobQuality).toBe(0.75);
  });

  it("reduz a escala quando a pagina ultrapassa maxPagePixels", async () => {
    const page = new FakePage({ baseWidth: 2000, baseHeight: 2000 });
    const h = harness({ 1: page });
    await renderPdfVisualAssets(new Uint8Array([1]), [crop()], {
      scale: 3,
      maxPagePixels: 4_000_000,
    }, h.dependencies);
    expect(page.viewportScales[0]).toBe(3);
    expect(page.viewportScales[1]).toBeCloseTo(1, 6);
  });

  it("ignora recorte duplicado pela chave composta", async () => {
    const h = harness({ 1: new FakePage() });
    const duplicated = crop();
    const result = await renderPdfVisualAssets(new Uint8Array([1]), [duplicated, { ...duplicated }], {}, h.dependencies);
    expect(Object.keys(result.assets)).toHaveLength(1);
    expect(result.warnings.some((warning) => warning.includes("duplicidade"))).toBe(true);
  });

  it("retorna aviso controlado quando o PDF nao abre", async () => {
    const result = await renderPdfVisualAssets(new Uint8Array([1]), [crop()], {}, {
      openPdfDocument: async () => {
        throw new Error("arquivo protegido");
      },
    });
    expect(result.assets).toEqual({});
    expect(result.warnings[0]).toContain("arquivo protegido");
  });
});
