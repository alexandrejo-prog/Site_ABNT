import type {
  PdfBodyLayoutMetrics,
  PdfLayoutSensitiveRegionDiagnostic,
  PdfLineDiagnostic,
  PdfPageDiagnostic,
} from "./imported-pdf-diagnostic";

export interface PdfVisualCropGeometry {
  regionId: string;
  visualKey: string;
  logicalVisualId?: string;
  pageNumber: number;
  sourceRect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  normalizedRect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  pageWidth: number;
  pageHeight: number;
  confidence: "high" | "medium" | "low";
  reasons: string[];
}

export interface PdfVisualCropSkip {
  regionId: string;
  pageNumber?: number;
  reason:
    | "page-not-found"
    | "invalid-page-size"
    | "no-valid-lines"
    | "invalid-line-range"
    | "empty-crop"
    | "implausible-crop-height"
    | "implausible-crop-aspect-ratio"
    | "caption-only-region";
}

export interface PdfVisualCropGeometryResult {
  crops: PdfVisualCropGeometry[];
  skipped: PdfVisualCropSkip[];
}

const GRAPHIC_LIKE_KINDS: ReadonlySet<PdfLayoutSensitiveRegionDiagnostic["kind"]> = new Set([
  "quadro",
  "tabela",
  "figura",
  "grafico",
  "imagem",
  "mapa",
  "ilustracao",
  "multicolumn",
]);

const MIN_PAD = 6;
const MIN_PLAUSIBLE_CROP_HEIGHT = 40;
const MAX_CROP_ASPECT_RATIO = 25;
const CROP_EDGE_GAP = 2;

const CAPTION_RE = /^(Quadro|Tabela|Figura|Gr[áa]fico|Imagem|Mapa|Ilustra[çc][ãa]o)\s+(\d+)\s*[-–—.:]/iu;
const SOURCE_RE = /^Fonte\s*:/iu;

function isCaptionOrSourceLine(text: string, region: PdfLayoutSensitiveRegionDiagnostic): boolean {
  const trimmed = text.trim();
  if (region.caption != null && trimmed === region.caption) return true;
  if (region.source != null && trimmed === region.source) return true;
  if (CAPTION_RE.test(trimmed)) return true;
  if (SOURCE_RE.test(trimmed)) return true;
  return false;
}

function stripCaptionAndSourceLines(
  lines: PdfLineDiagnostic[],
  region: PdfLayoutSensitiveRegionDiagnostic,
): PdfLineDiagnostic[] {
  if (region.caption == null && region.source == null) return lines;
  return lines.filter((line) => !isCaptionOrSourceLine(line.text, region));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function medianValue(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2;
  return sorted[mid];
}

function clampRange(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

function clampUnit(value: number): number {
  return clampRange(value, 0, 1);
}

function hasValidCoords(line: PdfLineDiagnostic): boolean {
  return (
    isFiniteNumber(line.left) &&
    isFiniteNumber(line.right) &&
    isFiniteNumber(line.top) &&
    isFiniteNumber(line.bottom) &&
    isFiniteNumber(line.height) &&
    line.right > line.left &&
    line.bottom > line.top &&
    line.height > 0
  );
}

function manchaIsValid(metrics: PdfBodyLayoutMetrics | undefined, pageWidth: number): boolean {
  if (!metrics) return false;
  const { dominantLeft, dominantRight } = metrics;
  if (!isFiniteNumber(dominantLeft) || !isFiniteNumber(dominantRight)) return false;
  if (dominantRight <= dominantLeft) return false;
  if (dominantLeft < 0 || dominantRight > pageWidth) return false;
  return true;
}

function selectedIndexRange(
  region: PdfLayoutSensitiveRegionDiagnostic,
  pageNumber: number,
  lineCount: number,
): { start: number; end: number } | null {
  const lastLineIndex = lineCount - 1;
  let rawStart: number;
  let rawEnd: number;
  if (region.pageStart === region.pageEnd) {
    rawStart = region.startLineIndex;
    rawEnd = region.endLineIndex;
  } else if (pageNumber === region.pageStart) {
    rawStart = region.startLineIndex;
    rawEnd = lastLineIndex;
  } else if (pageNumber === region.pageEnd) {
    rawStart = 0;
    rawEnd = region.endLineIndex;
  } else {
    rawStart = 0;
    rawEnd = lastLineIndex;
  }
  const safeStart = Math.max(0, rawStart);
  const safeEnd = Math.min(lastLineIndex, rawEnd);
  if (safeStart > safeEnd) return null;
  return { start: safeStart, end: safeEnd };
}

export function computePdfVisualCropGeometry(
  pages: PdfPageDiagnostic[],
  regions: PdfLayoutSensitiveRegionDiagnostic[],
  bodyLayoutMetrics?: PdfBodyLayoutMetrics,
): PdfVisualCropGeometryResult {
  const crops: PdfVisualCropGeometry[] = [];
  const skipped: PdfVisualCropSkip[] = [];
  const pageByNumber = new Map(pages.map((page) => [page.pageNumber, page]));
  const regionStartLineById = new Map(regions.map((region) => [region.id, region.startLineIndex]));

  for (const region of regions) {
    if (region.pageStart > region.pageEnd) {
      skipped.push({ regionId: region.id, reason: "invalid-line-range" });
      continue;
    }
    if (region.pageStart === region.pageEnd && region.startLineIndex > region.endLineIndex) {
      skipped.push({ regionId: region.id, reason: "invalid-line-range" });
      continue;
    }

    const visualKey = region.logicalVisualId ?? region.id;
    const pageNumbers: number[] = [];
    for (let page = region.pageStart; page <= region.pageEnd; page++) pageNumbers.push(page);

    for (const pageNumber of pageNumbers) {
      const page = pageByNumber.get(pageNumber);
      if (!page) {
        skipped.push({ regionId: region.id, pageNumber, reason: "page-not-found" });
        continue;
      }
      if (!isFiniteNumber(page.width) || !isFiniteNumber(page.height) || page.width <= 0 || page.height <= 0) {
        skipped.push({ regionId: region.id, pageNumber, reason: "invalid-page-size" });
        continue;
      }

      const indices = selectedIndexRange(region, pageNumber, page.lines.length);
      if (!indices) {
        skipped.push({ regionId: region.id, pageNumber, reason: "no-valid-lines" });
        continue;
      }
      const selected = page.lines.filter(
        (line, idx) => idx >= indices.start && idx <= indices.end && hasValidCoords(line),
      );
      if (selected.length === 0) {
        skipped.push({ regionId: region.id, pageNumber, reason: "no-valid-lines" });
        continue;
      }

      const graphicLines = stripCaptionAndSourceLines(selected, region);
      if (graphicLines.length === 0) {
        skipped.push({ regionId: region.id, pageNumber, reason: "caption-only-region" });
        continue;
      }

      const minTop = Math.min(...graphicLines.map((line) => line.top));
      const maxBottom = Math.max(...graphicLines.map((line) => line.bottom));
      const medianLineHeight = medianValue(graphicLines.map((line) => line.height));
      const verticalPadding = Math.max(MIN_PAD, medianLineHeight * 0.6);
      let top = minTop - verticalPadding;
      let bottom = maxBottom + verticalPadding;

      if (region.caption != null) {
        const captionLine = page.lines.find((line) => line.text.trim() === region.caption);
        if (captionLine && captionLine.bottom + CROP_EDGE_GAP > top) {
          top = captionLine.bottom + CROP_EDGE_GAP;
        }
      }
      if (region.source != null) {
        const sourceLine = page.lines.find((line) => line.text.trim() === region.source);
        if (sourceLine && sourceLine.top - CROP_EDGE_GAP < bottom) {
          bottom = sourceLine.top - CROP_EDGE_GAP;
        }
      }

      const horizontalPadding = Math.max(MIN_PAD, page.width * 0.01);
      const manchaValid = manchaIsValid(bodyLayoutMetrics, page.width);
      const graphicLike = GRAPHIC_LIKE_KINDS.has(region.kind);

      let left: number;
      let right: number;
      if (manchaValid && graphicLike) {
        left = bodyLayoutMetrics!.dominantLeft;
        right = bodyLayoutMetrics!.dominantRight;
      } else if (manchaValid && region.kind === "unknown") {
        left = Math.min(...selected.map((line) => line.left));
        right = Math.max(...selected.map((line) => line.right));
        const manchaWidth = bodyLayoutMetrics!.dominantRight - bodyLayoutMetrics!.dominantLeft;
        const minWidth = manchaWidth * 0.5;
        let width = right - left;
        if (width < minWidth) {
          width = minWidth;
          left = Math.min(left, page.width - width);
          left = Math.max(0, left);
          right = left + width;
        }
      } else if (manchaValid) {
        left = bodyLayoutMetrics!.dominantLeft;
        right = bodyLayoutMetrics!.dominantRight;
      } else {
        left = Math.min(...selected.map((line) => line.left));
        right = Math.max(...selected.map((line) => line.right));
      }
      left -= horizontalPadding;
      right += horizontalPadding;

      const x = clampRange(left, 0, page.width);
      const rightEdge = clampRange(right, x, page.width);
      if (rightEdge <= x) {
        skipped.push({ regionId: region.id, pageNumber, reason: "empty-crop" });
        continue;
      }
      const y = clampRange(top, 0, page.height);
      const bottomEdge = clampRange(bottom, y, page.height);
      if (bottomEdge <= y) {
        skipped.push({ regionId: region.id, pageNumber, reason: "empty-crop" });
        continue;
      }
      const width = rightEdge - x;
      const height = bottomEdge - y;

      if (height < MIN_PLAUSIBLE_CROP_HEIGHT) {
        skipped.push({ regionId: region.id, pageNumber, reason: "implausible-crop-height" });
        continue;
      }
      if (width / height > MAX_CROP_ASPECT_RATIO) {
        skipped.push({ regionId: region.id, pageNumber, reason: "implausible-crop-aspect-ratio" });
        continue;
      }

      const reasons = [...region.reasons];
      if (isFiniteNumber(page.rotation) && page.rotation !== 0) {
        reasons.push(
          "Geometria calculada no sistema de coordenadas diagnóstico; rotação será tratada pelo renderizador.",
        );
      }

      crops.push({
        regionId: region.id,
        visualKey,
        logicalVisualId: region.logicalVisualId,
        pageNumber,
        sourceRect: { x, y, width, height },
        normalizedRect: {
          x: clampUnit(x / page.width),
          y: clampUnit(y / page.height),
          width: clampUnit(width / page.width),
          height: clampUnit(height / page.height),
        },
        pageWidth: page.width,
        pageHeight: page.height,
        confidence: region.confidence,
        reasons,
      });
    }
  }

  crops.sort(
    (a, b) =>
      a.pageNumber - b.pageNumber ||
      (regionStartLineById.get(a.regionId) ?? 0) - (regionStartLineById.get(b.regionId) ?? 0) ||
      a.regionId.localeCompare(b.regionId),
  );

  skipped.sort(
    (a, b) =>
      (a.pageNumber ?? -1) - (b.pageNumber ?? -1) ||
      a.regionId.localeCompare(b.regionId) ||
      a.reason.localeCompare(b.reason),
  );

  return { crops, skipped };
}
