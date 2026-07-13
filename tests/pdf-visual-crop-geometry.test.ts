import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  computePdfVisualCropGeometry,
} from "../src/pdf-visual-crop-geometry";
import type {
  PdfBodyLayoutMetrics,
  PdfLayoutSensitiveRegionDiagnostic,
  PdfLineDiagnostic,
  PdfPageDiagnostic,
} from "../src/imported-pdf-diagnostic";

function line(
  pageNumber: number,
  opts: Partial<PdfLineDiagnostic> & Pick<PdfLineDiagnostic, "left" | "right" | "top" | "bottom" | "height">,
): PdfLineDiagnostic {
  return {
    pageNumber,
    text: opts.text ?? "linha",
    items: opts.items ?? [],
    left: opts.left,
    right: opts.right,
    top: opts.top,
    bottom: opts.bottom,
    height: opts.height,
  };
}

function page(
  pageNumber: number,
  width: number,
  height: number,
  lines: PdfLineDiagnostic[],
  rotation = 0,
): PdfPageDiagnostic {
  return {
    pageNumber,
    width,
    height,
    rotation,
    rawText: "",
    textItemCount: 0,
    items: [],
    lines,
  };
}

function region(
  opts: Partial<PdfLayoutSensitiveRegionDiagnostic> & Pick<PdfLayoutSensitiveRegionDiagnostic, "id" | "pageStart" | "pageEnd" | "startLineIndex" | "endLineIndex" | "kind">,
): PdfLayoutSensitiveRegionDiagnostic {
  return {
    confidence: "high",
    reasons: [],
    ...opts,
  };
}

const PAGE_W = 1000;
const PAGE_H = 1400;

describe("camada de geometria de recorte visual pdf", () => {
  it("regiao simples em uma pagina gera um recorte", () => {
    const pages = [page(1, PAGE_W, PAGE_H, [
      line(1, { left: 100, right: 900, top: 200, bottom: 230, height: 30 }),
      line(1, { left: 100, right: 900, top: 240, bottom: 270, height: 30 }),
    ])];
    const regions = [region({ id: "r1", pageStart: 1, pageEnd: 1, startLineIndex: 0, endLineIndex: 1, kind: "figura" })];
    const result = computePdfVisualCropGeometry(pages, regions);
    expect(result.crops).toHaveLength(1);
    expect(result.crops[0].pageNumber).toBe(1);
    expect(result.skipped).toHaveLength(0);
  });

  it("calcula sourceRect corretamente a partir das linhas", () => {
    const pages = [page(1, PAGE_W, PAGE_H, [
      line(1, { left: 100, right: 900, top: 200, bottom: 230, height: 30 }),
      line(1, { left: 100, right: 900, top: 240, bottom: 270, height: 30 }),
    ])];
    const regions = [region({ id: "r1", pageStart: 1, pageEnd: 1, startLineIndex: 0, endLineIndex: 1, kind: "figura" })];
    const { crops } = computePdfVisualCropGeometry(pages, regions);
    // vPad = max(6, median(30,30)*0.6) = 18; hPad = max(6, 1000*0.01) = 10
    expect(crops[0].sourceRect).toEqual({ x: 90, y: 182, width: 820, height: 106 });
  });

  it("calcula normalizedRect dividindo pela pagina", () => {
    const pages = [page(1, PAGE_W, PAGE_H, [
      line(1, { left: 100, right: 900, top: 200, bottom: 230, height: 30 }),
      line(1, { left: 100, right: 900, top: 240, bottom: 270, height: 30 }),
    ])];
    const regions = [region({ id: "r1", pageStart: 1, pageEnd: 1, startLineIndex: 0, endLineIndex: 1, kind: "figura" })];
    const { crops } = computePdfVisualCropGeometry(pages, regions);
    expect(crops[0].normalizedRect).toEqual({
      x: 90 / PAGE_W,
      y: 182 / PAGE_H,
      width: 820 / PAGE_W,
      height: 106 / PAGE_H,
    });
  });

  it("usa dominantLeft/dominantRight validos quando a mancha e valida", () => {
    const pages = [page(1, PAGE_W, PAGE_H, [
      line(1, { left: 100, right: 900, top: 200, bottom: 230, height: 30 }),
    ])];
    const metrics: PdfBodyLayoutMetrics = {
      dominantLeft: 150,
      dominantRight: 850,
      medianLineHeight: 30,
      medianLineGap: 10,
      probableFirstLineIndent: 36,
      probableBodyFontHeight: 12,
      confidence: "high",
    };
    const regions = [region({ id: "r1", pageStart: 1, pageEnd: 1, startLineIndex: 0, endLineIndex: 0, kind: "figura" })];
    const { crops } = computePdfVisualCropGeometry(pages, regions, metrics);
    expect(crops[0].sourceRect.x).toBe(140);
    expect(crops[0].sourceRect.width).toBe(720);
  });

  it("faz fallback para left/right das linhas quando a mancha e invalida", () => {
    const pages = [page(1, PAGE_W, PAGE_H, [
      line(1, { left: 300, right: 320, top: 200, bottom: 230, height: 30 }),
    ])];
    const metrics: PdfBodyLayoutMetrics = {
      dominantLeft: 850,
      dominantRight: 150,
      medianLineHeight: 30,
      medianLineGap: 10,
      probableFirstLineIndent: 36,
      probableBodyFontHeight: 12,
      confidence: "high",
    };
    const regions = [region({ id: "r1", pageStart: 1, pageEnd: 1, startLineIndex: 0, endLineIndex: 0, kind: "figura" })];
    const { crops } = computePdfVisualCropGeometry(pages, regions, metrics);
    expect(crops[0].sourceRect.x).toBe(290);
    expect(crops[0].sourceRect.width).toBe(40);
  });

  it("aplica padding vertical derivado da mediana das linhas", () => {
    const pages = [page(1, PAGE_W, PAGE_H, [
      line(1, { left: 100, right: 900, top: 200, bottom: 230, height: 30 }),
      line(1, { left: 100, right: 900, top: 400, bottom: 430, height: 30 }),
    ])];
    const regions = [region({ id: "r1", pageStart: 1, pageEnd: 1, startLineIndex: 0, endLineIndex: 1, kind: "figura" })];
    const { crops } = computePdfVisualCropGeometry(pages, regions);
    // median(30,30)*0.6 = 18; minTop=200 -> y=182; maxBottom=430 -> y+height=448
    expect(crops[0].sourceRect.y).toBe(182);
    expect(crops[0].sourceRect.height).toBe(266);
  });

  it("aplica padding horizontal moderado (1% da largura com minimo 6)", () => {
    const narrow = page(1, 200, PAGE_H, [line(1, { left: 100, right: 120, top: 200, bottom: 230, height: 30 })]);
    const wide = page(2, 1000, PAGE_H, [line(2, { left: 100, right: 120, top: 200, bottom: 230, height: 30 })]);
    const regions = [
      region({ id: "r1", pageStart: 1, pageEnd: 1, startLineIndex: 0, endLineIndex: 0, kind: "figura" }),
      region({ id: "r2", pageStart: 2, pageEnd: 2, startLineIndex: 0, endLineIndex: 0, kind: "figura" }),
    ];
    const { crops } = computePdfVisualCropGeometry([narrow, wide], regions);
    const c1 = crops.find((c) => c.pageNumber === 1)!;
    const c2 = crops.find((c) => c.pageNumber === 2)!;
    expect(c1.sourceRect.x).toBe(94); // hPad = max(6, 2) = 6 -> 100-6
    expect(c2.sourceRect.x).toBe(90); // hPad = max(6, 10) = 10 -> 100-10
  });

  it("faz clamp no topo da pagina", () => {
    const pages = [page(1, PAGE_W, PAGE_H, [
      line(1, { left: 100, right: 900, top: 2, bottom: 32, height: 30 }),
    ])];
    const regions = [region({ id: "r1", pageStart: 1, pageEnd: 1, startLineIndex: 0, endLineIndex: 0, kind: "figura" })];
    const { crops } = computePdfVisualCropGeometry(pages, regions);
    expect(crops[0].sourceRect.y).toBe(0);
  });

  it("faz clamp no rodape da pagina", () => {
    const pages = [page(1, PAGE_W, PAGE_H, [
      line(1, { left: 100, right: 900, top: 1370, bottom: 1395, height: 25 }),
    ])];
    const regions = [region({ id: "r1", pageStart: 1, pageEnd: 1, startLineIndex: 0, endLineIndex: 0, kind: "figura" })];
    const { crops } = computePdfVisualCropGeometry(pages, regions);
    expect(crops[0].sourceRect.y + crops[0].sourceRect.height).toBe(PAGE_H);
  });

  it("faz clamp na lateral esquerda", () => {
    const pages = [page(1, PAGE_W, PAGE_H, [
      line(1, { left: 2, right: 20, top: 200, bottom: 230, height: 30 }),
    ])];
    const regions = [region({ id: "r1", pageStart: 1, pageEnd: 1, startLineIndex: 0, endLineIndex: 0, kind: "figura" })];
    const { crops } = computePdfVisualCropGeometry(pages, regions);
    expect(crops[0].sourceRect.x).toBe(0);
  });

  it("faz clamp na lateral direita", () => {
    const pages = [page(1, PAGE_W, PAGE_H, [
      line(1, { left: 980, right: 998, top: 200, bottom: 230, height: 30 }),
    ])];
    const regions = [region({ id: "r1", pageStart: 1, pageEnd: 1, startLineIndex: 0, endLineIndex: 0, kind: "figura" })];
    const { crops } = computePdfVisualCropGeometry(pages, regions);
    const crop = crops[0];
    expect(crop.sourceRect.x + crop.sourceRect.width).toBe(PAGE_W);
  });

  it("regiao de quadro usa largura da mancha textual", () => {
    const pages = [page(1, PAGE_W, PAGE_H, [
      line(1, { left: 300, right: 320, top: 200, bottom: 230, height: 30 }),
    ])];
    const metrics: PdfBodyLayoutMetrics = {
      dominantLeft: 150, dominantRight: 850, medianLineHeight: 30, medianLineGap: 10,
      probableFirstLineIndent: 36, probableBodyFontHeight: 12, confidence: "high",
    };
    const regions = [region({ id: "r1", pageStart: 1, pageEnd: 1, startLineIndex: 0, endLineIndex: 0, kind: "quadro" })];
    const { crops } = computePdfVisualCropGeometry(pages, regions, metrics);
    expect(crops[0].sourceRect.x).toBe(140);
    expect(crops[0].sourceRect.width).toBe(720);
  });

  it("regiao de tabela usa largura da mancha textual", () => {
    const pages = [page(1, PAGE_W, PAGE_H, [
      line(1, { left: 300, right: 320, top: 200, bottom: 230, height: 30 }),
    ])];
    const metrics: PdfBodyLayoutMetrics = {
      dominantLeft: 150, dominantRight: 850, medianLineHeight: 30, medianLineGap: 10,
      probableFirstLineIndent: 36, probableBodyFontHeight: 12, confidence: "high",
    };
    const regions = [region({ id: "r1", pageStart: 1, pageEnd: 1, startLineIndex: 0, endLineIndex: 0, kind: "tabela" })];
    const { crops } = computePdfVisualCropGeometry(pages, regions, metrics);
    expect(crops[0].sourceRect.width).toBe(720);
  });

  it("regiao de figura usa largura da mancha textual", () => {
    const pages = [page(1, PAGE_W, PAGE_H, [
      line(1, { left: 300, right: 320, top: 200, bottom: 230, height: 30 }),
    ])];
    const metrics: PdfBodyLayoutMetrics = {
      dominantLeft: 150, dominantRight: 850, medianLineHeight: 30, medianLineGap: 10,
      probableFirstLineIndent: 36, probableBodyFontHeight: 12, confidence: "high",
    };
    const regions = [region({ id: "r1", pageStart: 1, pageEnd: 1, startLineIndex: 0, endLineIndex: 0, kind: "figura" })];
    const { crops } = computePdfVisualCropGeometry(pages, regions, metrics);
    expect(crops[0].sourceRect.width).toBe(720);
  });

  it("kind unknown mantem largura minima de 50% da mancha", () => {
    const pages = [page(1, 500, PAGE_H, [
      line(1, { left: 260, right: 280, top: 200, bottom: 230, height: 30 }),
    ])];
    const metrics: PdfBodyLayoutMetrics = {
      dominantLeft: 100, dominantRight: 400, medianLineHeight: 30, medianLineGap: 10,
      probableFirstLineIndent: 36, probableBodyFontHeight: 12, confidence: "high",
    };
    const regions = [region({ id: "r1", pageStart: 1, pageEnd: 1, startLineIndex: 0, endLineIndex: 0, kind: "unknown" })];
    const { crops } = computePdfVisualCropGeometry(pages, regions, metrics);
    // hPad = max(6, 500*0.01=5) = 6; linha=20 < 150 -> width=150; x = 260-6 = 254; width = 150+12 = 162
    expect(crops[0].sourceRect.x).toBe(254);
    expect(crops[0].sourceRect.width).toBe(162);
  });

  it("regiao com logicalVisualId preserva visualKey", () => {
    const pages = [page(1, PAGE_W, PAGE_H, [line(1, { left: 100, right: 900, top: 200, bottom: 230, height: 30 })])];
    const regions = [region({ id: "r1", pageStart: 1, pageEnd: 1, startLineIndex: 0, endLineIndex: 0, kind: "figura", logicalVisualId: "visual-1" })];
    const { crops } = computePdfVisualCropGeometry(pages, regions);
    expect(crops[0].visualKey).toBe("visual-1");
    expect(crops[0].logicalVisualId).toBe("visual-1");
  });

  it("regiao sem logicalVisualId usa o id como visualKey", () => {
    const pages = [page(1, PAGE_W, PAGE_H, [line(1, { left: 100, right: 900, top: 200, bottom: 230, height: 30 })])];
    const regions = [region({ id: "r1", pageStart: 1, pageEnd: 1, startLineIndex: 0, endLineIndex: 0, kind: "figura" })];
    const { crops } = computePdfVisualCropGeometry(pages, regions);
    expect(crops[0].visualKey).toBe("r1");
  });

  it("duas regioes com mesmo logicalVisualId geram recortes separados por pagina", () => {
    const pages = [page(1, PAGE_W, PAGE_H, [line(1, { left: 100, right: 900, top: 200, bottom: 230, height: 30 })])];
    const regions = [
      region({ id: "r1", pageStart: 1, pageEnd: 1, startLineIndex: 0, endLineIndex: 0, kind: "figura", logicalVisualId: "visual-comum" }),
      region({ id: "r2", pageStart: 1, pageEnd: 1, startLineIndex: 0, endLineIndex: 0, kind: "figura", logicalVisualId: "visual-comum" }),
    ];
    const { crops } = computePdfVisualCropGeometry(pages, regions);
    expect(crops).toHaveLength(2);
    expect(crops.map((c) => c.regionId).sort()).toEqual(["r1", "r2"]);
    expect(crops.every((c) => c.visualKey === "visual-comum")).toBe(true);
  });

  it("regiao multipagina gera um recorte por pagina", () => {
    const pages = [
      page(1, PAGE_W, PAGE_H, [line(1, { left: 100, right: 900, top: 200, bottom: 230, height: 30 })]),
      page(2, PAGE_W, PAGE_H, [line(2, { left: 100, right: 900, top: 200, bottom: 230, height: 30 })]),
      page(3, PAGE_W, PAGE_H, [line(3, { left: 100, right: 900, top: 200, bottom: 230, height: 30 })]),
    ];
    const regions = [region({ id: "r1", pageStart: 1, pageEnd: 3, startLineIndex: 0, endLineIndex: 0, kind: "figura" })];
    const { crops } = computePdfVisualCropGeometry(pages, regions);
    expect(crops.map((c) => c.pageNumber)).toEqual([1, 2, 3]);
  });

  it("primeira pagina multipagina respeita startLineIndex", () => {
    const pages = [
      page(1, PAGE_W, PAGE_H, [
        line(1, { left: 100, right: 900, top: 50, bottom: 80, height: 30 }),
        line(1, { left: 100, right: 900, top: 200, bottom: 230, height: 30 }),
        line(1, { left: 100, right: 900, top: 400, bottom: 430, height: 30 }),
      ]),
      page(2, PAGE_W, PAGE_H, [line(2, { left: 100, right: 900, top: 200, bottom: 230, height: 30 })]),
      page(3, PAGE_W, PAGE_H, [line(3, { left: 100, right: 900, top: 200, bottom: 230, height: 30 })]),
    ];
    const regions = [region({ id: "r1", pageStart: 1, pageEnd: 3, startLineIndex: 1, endLineIndex: 1, kind: "figura" })];
    const { crops } = computePdfVisualCropGeometry(pages, regions);
    const first = crops.find((c) => c.pageNumber === 1)!;
    // primeira pagina: [startLineIndex=1, fim] -> linhas 1 e 2
    expect(first.sourceRect.y).toBe(182);
    expect(first.sourceRect.height).toBe(266);
  });

  it("ultima pagina multipagina respeita endLineIndex", () => {
    const pages = [
      page(1, PAGE_W, PAGE_H, [line(1, { left: 100, right: 900, top: 200, bottom: 230, height: 30 })]),
      page(2, PAGE_W, PAGE_H, [line(2, { left: 100, right: 900, top: 200, bottom: 230, height: 30 })]),
      page(3, PAGE_W, PAGE_H, [
        line(3, { left: 100, right: 900, top: 200, bottom: 230, height: 30 }),
        line(3, { left: 100, right: 900, top: 400, bottom: 430, height: 30 }),
        line(3, { left: 100, right: 900, top: 600, bottom: 630, height: 30 }),
      ]),
    ];
    const regions = [region({ id: "r1", pageStart: 1, pageEnd: 3, startLineIndex: 0, endLineIndex: 1, kind: "figura" })];
    const { crops } = computePdfVisualCropGeometry(pages, regions);
    const last = crops.find((c) => c.pageNumber === 3)!;
    // ultima pagina: [0, endLineIndex=1] -> linhas 0 e 1
    expect(last.sourceRect.y).toBe(182);
    expect(last.sourceRect.height).toBe(266);
  });

  it("pagina intermediaria utiliza todas as linhas disponiveis", () => {
    const pages = [
      page(1, PAGE_W, PAGE_H, [line(1, { left: 100, right: 900, top: 200, bottom: 230, height: 30 })]),
      page(2, PAGE_W, PAGE_H, [
        line(2, { left: 100, right: 900, top: 100, bottom: 130, height: 30 }),
        line(2, { left: 100, right: 900, top: 300, bottom: 330, height: 30 }),
        line(2, { left: 100, right: 900, top: 500, bottom: 530, height: 30 }),
      ]),
      page(3, PAGE_W, PAGE_H, [line(3, { left: 100, right: 900, top: 200, bottom: 230, height: 30 })]),
    ];
    const regions = [region({ id: "r1", pageStart: 1, pageEnd: 3, startLineIndex: 0, endLineIndex: 2, kind: "figura" })];
    const { crops } = computePdfVisualCropGeometry(pages, regions);
    const middle = crops.find((c) => c.pageNumber === 2)!;
    // pagina intermediaria: todas as linhas [0, fim]
    expect(middle.sourceRect.y).toBe(82); // 100 - 18
    expect(middle.sourceRect.height).toBe(466); // 530+18 - 82
  });

  it("pagina ausente gera skipped page-not-found", () => {
    const pages = [page(1, PAGE_W, PAGE_H, [line(1, { left: 100, right: 900, top: 200, bottom: 230, height: 30 })])];
    const regions = [region({ id: "r1", pageStart: 5, pageEnd: 5, startLineIndex: 0, endLineIndex: 0, kind: "figura" })];
    const result = computePdfVisualCropGeometry(pages, regions);
    expect(result.crops).toHaveLength(0);
    expect(result.skipped).toEqual([{ regionId: "r1", pageNumber: 5, reason: "page-not-found" }]);
  });

  it("tamanho de pagina zero gera skipped invalid-page-size", () => {
    const pages = [page(1, 0, 0, [line(1, { left: 100, right: 900, top: 200, bottom: 230, height: 30 })])];
    const regions = [region({ id: "r1", pageStart: 1, pageEnd: 1, startLineIndex: 0, endLineIndex: 0, kind: "figura" })];
    const result = computePdfVisualCropGeometry(pages, regions);
    expect(result.skipped).toEqual([{ regionId: "r1", pageNumber: 1, reason: "invalid-page-size" }]);
  });

  it("intervalo de linhas invertido gera skipped invalid-line-range", () => {
    const pages = [page(1, PAGE_W, PAGE_H, [line(1, { left: 100, right: 900, top: 200, bottom: 230, height: 30 })])];
    const regions = [region({ id: "r1", pageStart: 1, pageEnd: 1, startLineIndex: 5, endLineIndex: 0, kind: "figura" })];
    const result = computePdfVisualCropGeometry(pages, regions);
    expect(result.skipped).toEqual([{ regionId: "r1", reason: "invalid-line-range" }]);
  });

  it("pagina sem linhas validas gera skipped no-valid-lines", () => {
    const pages = [page(1, PAGE_W, PAGE_H, [])];
    const regions = [region({ id: "r1", pageStart: 1, pageEnd: 1, startLineIndex: 0, endLineIndex: 0, kind: "figura" })];
    const result = computePdfVisualCropGeometry(pages, regions);
    expect(result.skipped).toEqual([{ regionId: "r1", pageNumber: 1, reason: "no-valid-lines" }]);
  });

  it("indices parcialmente fora da faixa sao tratados com seguranca", () => {
    const pages = [page(1, PAGE_W, PAGE_H, [
      line(1, { left: 100, right: 900, top: 50, bottom: 80, height: 30 }),
      line(1, { left: 100, right: 900, top: 200, bottom: 230, height: 30 }),
      line(1, { left: 100, right: 900, top: 400, bottom: 430, height: 30 }),
    ])];
    const regions = [region({ id: "r1", pageStart: 1, pageEnd: 1, startLineIndex: 1, endLineIndex: 10, kind: "figura" })];
    const result = computePdfVisualCropGeometry(pages, regions);
    expect(result.crops).toHaveLength(1); // indice final 10 ignorado com seguranca, usa linhas 1 e 2
    expect(result.skipped).toHaveLength(0);
  });

  it("normalizedRect permanece entre 0 e 1", () => {
    const pages = [page(1, PAGE_W, PAGE_H, [
      line(1, { left: 2, right: 998, top: 2, bottom: 1380, height: 30 }),
    ])];
    const regions = [region({ id: "r1", pageStart: 1, pageEnd: 1, startLineIndex: 0, endLineIndex: 0, kind: "figura" })];
    const { crops } = computePdfVisualCropGeometry(pages, regions);
    const n = crops[0].normalizedRect;
    for (const value of [n.x, n.y, n.width, n.height]) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it("nao muta as entradas recebidas", () => {
    const pages: PdfPageDiagnostic[] = [page(1, PAGE_W, PAGE_H, [
      line(1, { left: 100, right: 900, top: 200, bottom: 230, height: 30 }),
    ])];
    const regions: PdfLayoutSensitiveRegionDiagnostic[] = [region({ id: "r1", pageStart: 1, pageEnd: 1, startLineIndex: 0, endLineIndex: 0, kind: "figura" })];
    const before = JSON.stringify({ pages, regions });
    computePdfVisualCropGeometry(structuredClone(pages), structuredClone(regions));
    expect(JSON.stringify({ pages, regions })).toBe(before);
  });

  it("resultado e deterministico", () => {
    const pages = [page(1, PAGE_W, PAGE_H, [
      line(1, { left: 100, right: 900, top: 200, bottom: 230, height: 30 }),
      line(1, { left: 100, right: 900, top: 400, bottom: 430, height: 30 }),
    ])];
    const regions = [region({ id: "r1", pageStart: 1, pageEnd: 1, startLineIndex: 0, endLineIndex: 1, kind: "figura" })];
    const a = computePdfVisualCropGeometry(pages, regions);
    const b = computePdfVisualCropGeometry(pages, regions);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("rotacao diferente de zero adiciona reason sem alterar coordenadas", () => {
    const basePages = [page(1, PAGE_W, PAGE_H, [line(1, { left: 100, right: 900, top: 200, bottom: 230, height: 30 })], 0)];
    const rotatedPages = [page(1, PAGE_W, PAGE_H, [line(1, { left: 100, right: 900, top: 200, bottom: 230, height: 30 })], 90)];
    const regions = [region({ id: "r1", pageStart: 1, pageEnd: 1, startLineIndex: 0, endLineIndex: 0, kind: "figura" })];
    const base = computePdfVisualCropGeometry(basePages, regions);
    const rotated = computePdfVisualCropGeometry(rotatedPages, regions);
    expect(rotated.crops[0].sourceRect).toEqual(base.crops[0].sourceRect);
    expect(rotated.crops[0].reasons.some((r) => r.includes("rotação será tratada pelo renderizador"))).toBe(true);
    expect(base.crops[0].reasons.some((r) => r.includes("rotação"))).toBe(false);
  });

  it("nao depende de DOM, canvas, window, document ou PDF.js", () => {
    const source = readFileSync(join(process.cwd(), "src", "pdf-visual-crop-geometry.ts"), "utf8");
    const forbidden = ["window", "document", "canvas", "PDFJS", "pdfjs", "jsdom", "jsPDF", "getContext", "createElement"];
    for (const token of forbidden) {
      expect(source.toLowerCase().includes(token.toLowerCase())).toBe(false);
    }
  });

  it("nao contem dados especificos do PDF Andrade", () => {
    const source = readFileSync(join(process.cwd(), "src", "pdf-visual-crop-geometry.ts"), "utf8");
    const forbidden = ["Andrade", "UFLA", "Lavras", "Teletrabalho", "João", "Silva"];
    for (const token of forbidden) {
      expect(source.includes(token)).toBe(false);
    }
  });
});
