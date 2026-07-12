import type { ImportedPdfDiagnostic, PdfBodyStartDiagnostic, PdfLineDiagnostic, PdfPageDiagnostic, PdfTextItemDiagnostic } from "./imported-pdf-diagnostic";

type PdfJsModule = typeof import("pdfjs-dist");
type PdfViewportLike = {
  width: number;
  height: number;
  rotation?: number;
  transform: readonly number[];
};

type PdfTextItemLike = {
  str?: string;
  width?: number;
  height?: number;
  fontName?: string;
  hasEOL?: boolean;
  transform?: readonly number[];
};

async function loadPdfJs(): Promise<PdfJsModule & { GlobalWorkerOptions: { workerSrc?: string } }> {
  const isBrowser = typeof window !== "undefined" && typeof document !== "undefined";
  if (!isBrowser) {
    return (await import("pdfjs-dist/legacy/build/pdf.mjs")) as PdfJsModule & {
      GlobalWorkerOptions: { workerSrc?: string };
    };
  }

  const pdfjs = (await import("pdfjs-dist")) as PdfJsModule & {
    GlobalWorkerOptions: { workerSrc?: string };
  };
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  }
  return pdfjs;
}

function normalizeRawText(parts: string[]): string {
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function matrixTransform(first: readonly number[], second: readonly number[]): number[] {
  return [
    first[0] * second[0] + first[2] * second[1],
    first[1] * second[0] + first[3] * second[1],
    first[0] * second[2] + first[2] * second[3],
    first[1] * second[2] + first[3] * second[3],
    first[0] * second[4] + first[2] * second[5] + first[4],
    first[1] * second[4] + first[3] * second[5] + first[5],
  ];
}

function median(values: number[]): number {
  const sorted = values.filter((value) => value > 0 && Number.isFinite(value)).sort((left, right) => left - right);
  if (!sorted.length) return 1;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function textKey(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function boxOverlapRatio(first: PdfTextItemDiagnostic, second: PdfTextItemDiagnostic): number {
  const left = Math.max(first.x, second.x);
  const right = Math.min(first.x + first.width, second.x + second.width);
  const top = Math.max(first.y, second.y);
  const bottom = Math.min(first.y + first.height, second.y + second.height);
  const overlapWidth = Math.max(0, right - left);
  const overlapHeight = Math.max(0, bottom - top);
  const overlapArea = overlapWidth * overlapHeight;
  const firstArea = Math.max(1, first.width * first.height);
  const secondArea = Math.max(1, second.width * second.height);
  return overlapArea / Math.min(firstArea, secondArea);
}

function boxesNearlyEqual(first: PdfTextItemDiagnostic, second: PdfTextItemDiagnostic): boolean {
  const tolerance = Math.max(1, Math.min(first.height || 1, second.height || 1) * 0.35);
  return Math.abs(first.x - second.x) <= tolerance
    && Math.abs(first.y - second.y) <= tolerance
    && Math.abs(first.width - second.width) <= tolerance
    && Math.abs(first.height - second.height) <= tolerance;
}

export function normalizePdfTextItem(item: PdfTextItemLike, viewport: PdfViewportLike): PdfTextItemDiagnostic | null {
  const text = typeof item.str === "string" ? item.str : "";
  if (!text || !item.transform || item.transform.length < 6 || viewport.transform.length < 6) return null;
  if (![viewport.width, viewport.height, ...viewport.transform, ...item.transform].every(isFiniteNumber)) return null;

  const transform = matrixTransform(viewport.transform, item.transform);
  if (!transform.every(isFiniteNumber)) return null;

  const x = transform[4];
  const y = transform[5];
  const width = Math.abs(isFiniteNumber(item.width) && item.width > 0 ? item.width : Math.hypot(transform[0], transform[1]));
  const height = Math.abs(isFiniteNumber(item.height) && item.height > 0 ? item.height : Math.hypot(transform[2], transform[3]));
  if (![x, y, width, height].every(isFiniteNumber)) return null;

  const normalized: PdfTextItemDiagnostic = {
    text,
    x: Math.max(0, Math.min(viewport.width, x)),
    y: Math.max(0, Math.min(viewport.height, y)),
    width,
    height: height || 1,
    transform,
  };
  if (item.fontName) normalized.fontName = item.fontName;
  if (typeof item.hasEOL === "boolean") normalized.hasEol = item.hasEOL;
  return normalized;
}

export function dedupePdfTextItems(items: PdfTextItemDiagnostic[]): PdfTextItemDiagnostic[] {
  const kept: PdfTextItemDiagnostic[] = [];
  for (const item of items) {
    const key = textKey(item.text);
    const duplicate = kept.some((candidate) => (
      textKey(candidate.text) === key
      && (boxesNearlyEqual(candidate, item) || boxOverlapRatio(candidate, item) >= 0.85)
    ));
    if (!duplicate) kept.push(item);
  }
  return kept;
}

function shouldInsertSpace(previous: PdfTextItemDiagnostic | undefined, current: PdfTextItemDiagnostic, medianHeight: number): boolean {
  if (!previous) return false;
  if (/^[,.;:)]/.test(current.text)) return false;
  if (/\s$/.test(previous.text) || /^\s/.test(current.text)) return false;
  const gap = current.x - (previous.x + previous.width);
  return gap > Math.max(1.5, medianHeight * 0.18);
}

export function buildPdfDiagnosticLines(items: PdfTextItemDiagnostic[], pageNumber: number): PdfLineDiagnostic[] {
  const deduped = dedupePdfTextItems(items).sort((left, right) => left.y - right.y || left.x - right.x);
  const itemHeight = median(deduped.map((item) => item.height));
  const verticalTolerance = Math.max(1.5, itemHeight * 0.55);
  const grouped: PdfTextItemDiagnostic[][] = [];

  for (const item of deduped) {
    const line = grouped.find((candidate) => Math.abs(median(candidate.map((lineItem) => lineItem.y)) - item.y) <= verticalTolerance);
    if (line) line.push(item);
    else grouped.push([item]);
  }

  return grouped
    .map((lineItems) => {
      const sortedItems = [...lineItems].sort((left, right) => left.x - right.x);
      const height = median(sortedItems.map((item) => item.height));
      const left = Math.min(...sortedItems.map((item) => item.x));
      const right = Math.max(...sortedItems.map((item) => item.x + item.width));
      const top = Math.min(...sortedItems.map((item) => item.y));
      const bottom = Math.max(...sortedItems.map((item) => item.y + item.height));
      const text = sortedItems.reduce((lineText, item, index) => (
        `${lineText}${shouldInsertSpace(sortedItems[index - 1], item, height) ? " " : ""}${item.text}`
      ), "").replace(/\s+/g, " ").trim();
      return { pageNumber, text, items: sortedItems, left, right, top, bottom, height };
    })
    .sort((left, right) => left.top - right.top || left.left - right.left);
}

export function detectPdfBodyStart(pages: PdfPageDiagnostic[]): PdfBodyStartDiagnostic {
  const numberedIntroduction = /^\s*1(?:\.)?\s+INTRODU[CÇ][AÃ]O\s*$/iu;
  const unnumberedIntroduction = /^\s*INTRODU[CÇ][AÃ]O\s*$/iu;

  for (const page of pages) {
    for (const [lineIndex, line] of page.lines.entries()) {
      if (numberedIntroduction.test(line.text)) {
        return { found: true, pageNumber: page.pageNumber, lineIndex, text: line.text, matchType: "numbered-introduction" };
      }
      if (unnumberedIntroduction.test(line.text)) {
        return { found: true, pageNumber: page.pageNumber, lineIndex, text: line.text, matchType: "unnumbered-introduction" };
      }
    }
  }

  return { found: false };
}

export async function importPdfDiagnostic(file: File): Promise<ImportedPdfDiagnostic> {
  const warnings = [
    "O PDF foi lido para diagnóstico. A conversão para DOCX ainda não está habilitada nesta etapa.",
  ];

  try {
    const pdfjs = await loadPdfJs();
    const data = await file.arrayBuffer();
    const documentTask = pdfjs.getDocument({
      data,
      ...(typeof window === "undefined" ? ({ disableWorker: true } as Record<string, unknown>) : {}),
    });
    const pdf = await documentTask.promise;
    const pages: PdfPageDiagnostic[] = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const items = content.items
        .map((item) => normalizePdfTextItem(item as PdfTextItemLike, viewport))
        .filter((item): item is PdfTextItemDiagnostic => item !== null);
      const lines = buildPdfDiagnosticLines(items, pageNumber);
      const textItems = items.map((item) => item.text).filter(Boolean);
      pages.push({
        pageNumber,
        width: viewport.width,
        height: viewport.height,
        rotation: viewport.rotation,
        rawText: normalizeRawText(textItems),
        textItemCount: textItems.length,
        items,
        lines,
      });
    }

    if (!pages.some((page) => page.rawText.trim())) {
      warnings.push("Nenhum texto bruto extraível foi encontrado. O PDF pode estar digitalizado, protegido ou exigir OCR, que não é usado nesta etapa.");
    }

    return {
      fileName: file.name,
      pageCount: pdf.numPages,
      pages,
      bodyStart: detectPdfBodyStart(pages),
      warnings,
    };
  } catch {
    throw new Error("Não foi possível ler o PDF. O arquivo pode estar inválido, protegido, corrompido ou ilegível sem OCR.");
  }
}
