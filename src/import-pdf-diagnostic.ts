import type { ImportedPdfDiagnostic, PdfBodyStartDiagnostic, PdfLineDiagnostic, PdfPageDiagnostic, PdfTextItemDiagnostic } from "./imported-pdf-diagnostic";
import { detectPdfPretextual } from "./pdf-pretextual-diagnostic";
import { reconstructPdfParagraphBlocks } from "./pdf-text-reconstruction-diagnostic";
import { safeEnv } from "./safe-env";

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

export function shouldInsertSpace(previous: PdfTextItemDiagnostic | undefined, current: PdfTextItemDiagnostic, medianHeight: number): boolean {
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
    "O PDF foi lido para diagnóstico. O rascunho DOCX estruturado pode ser gerado para revisão humana.",
  ];

  type DestroyablePdfDocument = {
    numPages: number;
    getPage(pageNumber: number): Promise<{
      getViewport(options: { scale: number }): PdfViewportLike;
      getTextContent(): Promise<{ items: unknown[] }>;
      getOperatorList(): Promise<{ fnArray: unknown[] }>;
    }>;
    destroy?(): Promise<void> | void;
  };

  let pdf: DestroyablePdfDocument | null = null;

  try {
    const pdfjs = await loadPdfJs();
    const data = await file.arrayBuffer();
    const documentTask = pdfjs.getDocument({
      data,
      ...(typeof window === "undefined" ? ({ disableWorker: true } as Record<string, unknown>) : {}),
    });
    pdf = (await documentTask.promise) as DestroyablePdfDocument;
    const numPages = pdf.numPages;
    const pages: PdfPageDiagnostic[] = [];

    let detectedImageCount = 0;
    const ocrEnabled = safeEnv.flag("PDF_OCR", true);
    const ocrPerPage: import("./imported-pdf-diagnostic").PdfOcrPageStat[] = [];
    let ocrPagesScanned = 0;
    let ocrPagesSuccess = 0;
    let ocrBackend = "none";
    const dataBuffer = new Uint8Array(await file.arrayBuffer());
    for (let pageNumber = 1; pageNumber <= numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const items = content.items
        .map((item) => normalizePdfTextItem(item as PdfTextItemLike, viewport))
        .filter((item): item is PdfTextItemDiagnostic => item !== null);
      let lines = buildPdfDiagnosticLines(items, pageNumber);
      const textItems = items.map((item) => item.text).filter(Boolean);

      // R-OCR-3: PDF digitalizado (sem camada de texto) → aplica OCR na página
      // inteira e funde o texto reconhecido para que o restante do pipeline
      // (corpo, legendas, pretextual) funcione. Só quando há quase nenhum texto.
      let ocrAppliedThisPage = false;
      if (ocrEnabled && textItems.length < 3) {
        ocrPagesScanned += 1;
        try {
          const { recognizePdfPage } = await import("./ocr");
          const ocr = await recognizePdfPage(dataBuffer, pageNumber - 1, { lang: safeEnv.string("OCR_LANG", "por+eng") });
          ocrBackend = ocr.backend;
          if (ocr.available && ocr.text.trim()) {
            ocrPagesSuccess += 1;
            ocrAppliedThisPage = true;
            const ocrLines = ocr.text.split(/\r?\n+/).map((l) => l.trim()).filter(Boolean);
            // Injeta como itens/linhas sintéticas (y crescente) para reaproveitar
            // toda a lógica de reconstrução já existente.
            const syntheticItems: PdfTextItemDiagnostic[] = ocrLines.map((text, i) => ({
              text,
              x: 0,
              y: (i + 1) * 20,
              width: text.length * 6,
              height: 14,
              transform: [1, 0, 0, 1, 0, (i + 1) * 20],
            }));
            items.push(...syntheticItems);
            lines = lines.concat(buildPdfDiagnosticLines(syntheticItems, pageNumber));
          }
          ocrPerPage.push({
            pageNumber,
            backend: ocr.backend,
            available: ocr.available,
            confidence: ocr.confidence,
            charCount: ocr.text.trim().length,
          });
        } catch {
          ocrPerPage.push({ pageNumber, backend: "none", available: false, confidence: 0, charCount: 0 });
        }
      }

      let pageImages = 0;
      try {
        const operatorList = await page.getOperatorList();
        const fnArray = operatorList.fnArray as unknown as number[];
        pageImages = fnArray.filter((op) => op === 85 || op === 83).length;
        detectedImageCount += pageImages;
      } catch {
        pageImages = 0;
      }
      pages.push({
        pageNumber,
        width: viewport.width,
        height: viewport.height,
        rotation: viewport.rotation ?? 0,
        rawText: normalizeRawText(items.map((i) => i.text)),
        textItemCount: items.length,
        items,
        lines,
        imageCount: pageImages,
      });
      if (ocrAppliedThisPage) {/* marcado em ocrPerPage */}
    }

    if (detectedImageCount > 0) {
      warnings.push(
        `IMAGENS NÃO PRESERVADAS: foram detectadas ${detectedImageCount} imagem(ns)/figura(s) no PDF original. O DOCX gerado NÃO reconstrói figuras, gráficos ou quadros do PDF — eles ficam ausentes. Reinsira manualmente cada imagem, com legenda e fonte, no editor antes da versão final.`,
      );
    }

    let detectedTableCaptions = 0;
    for (const page of pages) {
      for (const line of page.lines) {
        if (/^(TABELA|QUADRO|QUADROS|GRAFICO|GR[AÁ]FICO)\b/i.test(line.text.trim())) {
          detectedTableCaptions += 1;
        }
      }
    }
    if (detectedTableCaptions > 0) {
      warnings.push(
        `TABELAS DETECTADAS: ${detectedTableCaptions} referência(s) a Tabela/Quadro/Gráfico no PDF. O sistema tenta reconstruir tabelas detectáveis por coordenadas de texto (reconstrução mínima, sujeita a limitações de layout); tabelas não reconstruídas exigem revisão manual no editor antes da versão final.`,
      );
    }

    if (!pages.some((page) => page.rawText.trim())) {
      warnings.push("Nenhum texto bruto extraível foi encontrado. O PDF pode estar digitalizado, protegido ou exigir OCR, que não é usado nesta etapa.");
    }

    const reconstruction = reconstructPdfParagraphBlocks(pages);
    const pretextual = detectPdfPretextual(pages, reconstruction.bodyStart.pageNumber);

    const ocrApplied = ocrPagesScanned > 0;
    const avgConfidence = ocrPerPage.length
      ? Math.round(ocrPerPage.reduce((s, p) => s + p.confidence, 0) / ocrPerPage.length)
      : 0;
    if (ocrApplied) {
      warnings.push(
        `OCR APLICADO: ${ocrPagesSuccess}/${ocrPagesScanned} página(s) digitalizada(s) processada(s) por OCR (backend ${ocrBackend}, confiança média ${avgConfidence}%). O texto reconhecido foi fundido ao documento; revise a fidelidade, pois OCR pode conter erros.`,
      );
    }

    return {
      fileName: file.name,
      pageCount: numPages,
      pages,
      pretextual,
      bodyStart: reconstruction.bodyStart,
      reconstruction,
      warnings: [...warnings, ...pretextual.warnings],
      ocrApplied,
      ocrStats: ocrApplied
        ? {
            pagesScanned: ocrPagesScanned,
            pagesOcrSuccess: ocrPagesSuccess,
            backend: ocrBackend,
            avgConfidence,
            perPage: ocrPerPage,
          }
        : undefined,
    };
  } catch {
    throw new Error("Não foi possível ler o PDF. O arquivo pode estar inválido, protegido, corrompido ou ilegível sem OCR.");
  } finally {
    if (pdf) {
      try {
        await pdf.destroy?.();
      } catch {
        // Falha ao liberar o documento não deve substituir o diagnóstico construído com sucesso.
      }
    }
  }
}
