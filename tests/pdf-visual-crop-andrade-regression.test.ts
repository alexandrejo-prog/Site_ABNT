import { describe, expect, it } from "vitest";
import { computePdfVisualCropGeometry } from "../src/pdf-visual-crop-geometry";
import type {
  PdfBodyLayoutMetrics,
  PdfLayoutSensitiveRegionDiagnostic,
  PdfLineDiagnostic,
  PdfPageDiagnostic,
} from "../src/imported-pdf-diagnostic";

function line(
  pageNumber: number,
  opts: Pick<PdfLineDiagnostic, "left" | "right" | "top" | "bottom" | "height"> & Partial<PdfLineDiagnostic>,
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

function page(pageNumber: number, lines: PdfLineDiagnostic[], width = 595, height = 842): PdfPageDiagnostic {
  return { pageNumber, width, height, rotation: 0, rawText: "", textItemCount: 0, items: [], lines };
}

function region(
  opts: Pick<PdfLayoutSensitiveRegionDiagnostic, "id" | "pageStart" | "pageEnd" | "startLineIndex" | "endLineIndex" | "kind">,
): PdfLayoutSensitiveRegionDiagnostic {
  return { confidence: "high", reasons: [], ...opts };
}

const METRICS: PdfBodyLayoutMetrics = {
  dominantLeft: 84,
  dominantRight: 540,
  medianLineHeight: 12,
  medianLineGap: 8,
  probableFirstLineIndent: 36,
  probableBodyFontHeight: 12,
  confidence: "high",
};

function frameWithCaptionAndSource(opts: {
  captionTop: number;
  contentTops: number[];
  sourceTop: number;
  lineHeight?: number;
}): PdfPageDiagnostic {
  const lh = opts.lineHeight ?? 12;
  const lines: PdfLineDiagnostic[] = [];
  lines.push(line(1, { left: 100, right: 540, top: opts.captionTop, bottom: opts.captionTop + lh, height: lh, text: "Quadro N - descricao." }));
  for (const t of opts.contentTops) {
    lines.push(line(1, { left: 100, right: 540, top: t, bottom: t + lh, height: lh }));
  }
  lines.push(line(1, { left: 100, right: 540, top: opts.sourceTop, bottom: opts.sourceTop + lh, height: lh, text: "Fonte: autor (2025)." }));
  return page(1, lines);
}

describe("regressao de recortes visuais do pdf (estrutura dos quadros cortados)", () => {
  it("Quadro 1: borda inferior nao e cortada quando a fonte esta proxima", () => {
    const lh = 12;
    const contentTops = Array.from({ length: 28 }, (_, i) => 116 + i * (lh + 8));
    const maxBottomText = contentTops[contentTops.length - 1] + lh;
    const sourceTop = maxBottomText + 13;
    const p = frameWithCaptionAndSource({ captionTop: 100, contentTops, sourceTop, lineHeight: lh });
    const regions = [region({ id: "r1", pageStart: 1, pageEnd: 1, startLineIndex: 1, endLineIndex: contentTops.length, kind: "quadro" })];
    const { crops } = computePdfVisualCropGeometry([p], regions, METRICS);
    const crop = crops[0];
    const bottom = crop.sourceRect.y + crop.sourceRect.height;
    const baseBottom = maxBottomText + Math.max(6, lh * 0.6);

    // A borda inferior fica alem da caixa do texto selecionado.
    expect(bottom).toBeGreaterThan(baseBottom);
    // A fonte nao entra no recorte.
    expect(bottom).toBeLessThan(sourceTop);
    // A legenda (titulo) nao entra no recorte.
    expect(crop.sourceRect.y).toBeGreaterThan(100 + lh);
  });

  it("Quadro 2: recorte estendido ate a borda inferior sem capturar o paragrafo seguinte", () => {
    const lh = 12;
    const contentTops = [124, 144, 164, 184, 204];
    const maxBottomText = contentTops[contentTops.length - 1] + lh;
    const bodyTop = maxBottomText + 8;
    const p = frameWithCaptionAndSource({ captionTop: 108, contentTops, sourceTop: bodyTop, lineHeight: lh });
    const regions = [region({ id: "r1", pageStart: 1, pageEnd: 1, startLineIndex: 1, endLineIndex: contentTops.length, kind: "quadro" })];
    const { crops } = computePdfVisualCropGeometry([p], regions, METRICS);
    const crop = crops[0];
    const bottom = crop.sourceRect.y + crop.sourceRect.height;

    // Estende alem da ultima linha de texto (captura a borda).
    expect(bottom).toBeGreaterThan(maxBottomText);
    // Nao captura o paragrafo seguinte.
    expect(bottom).toBeLessThan(bodyTop);
  });

  it("Quadro 4: regiao com uma unica linha de texto nao vira faixa horizontal", () => {
    const lh = 12;
    const singleTop = 226;
    const captionTop = singleTop - 9 - lh;
    const nextCaptionTop = singleTop + lh + 9;
    const p = frameWithCaptionAndSource({ captionTop, contentTops: [singleTop], sourceTop: nextCaptionTop, lineHeight: lh });
    const regions = [region({ id: "r1", pageStart: 1, pageEnd: 1, startLineIndex: 1, endLineIndex: 1, kind: "quadro" })];
    const { crops } = computePdfVisualCropGeometry([p], regions, METRICS);
    const crop = crops[0];
    const height = crop.sourceRect.height;

    // Altura muito maior que a linha de texto unica => nao e uma faixa.
    expect(height).toBeGreaterThan(lh * 1.5);
    // Legenda acima e proxima legenda abaixo ficam fora do recorte.
    expect(crop.sourceRect.y).toBeGreaterThan(captionTop + lh);
    expect(crop.sourceRect.y + height).toBeLessThan(nextCaptionTop);
  });

  it("reutilizavel: rompimento de borda so ocorre para regioes graficas", () => {
    const lh = 12;
    const contentTops = [116, 136, 156];
    const sourceTop = 156 + lh + 13;
    const p = frameWithCaptionAndSource({ captionTop: 100, contentTops, sourceTop, lineHeight: lh });
    const graphic = region({ id: "g", pageStart: 1, pageEnd: 1, startLineIndex: 1, endLineIndex: contentTops.length, kind: "tabela" });
    const plain = region({ id: "t", pageStart: 1, pageEnd: 1, startLineIndex: 1, endLineIndex: contentTops.length, kind: "unknown" });
    const { crops } = computePdfVisualCropGeometry([p], [graphic, plain], METRICS);
    const g = crops.find((c) => c.regionId === "g")!;
    const t = crops.find((c) => c.regionId === "t")!;
    expect(g.sourceRect.y + g.sourceRect.height).toBeLessThan(sourceTop);
    expect(t.sourceRect.y + t.sourceRect.height).toBeLessThanOrEqual(sourceTop);
  });
});
