import type { PdfTextDraftVisualAsset } from "./pdf-text-draft-contract";
import type { PdfVisualCropGeometry } from "./pdf-visual-crop-geometry";

export type PdfVisualAssetImageType = "image/png" | "image/jpeg";

export interface PdfVisualAssetRenderOptions {
  scale?: number;
  maxOutputWidth?: number;
  maxOutputHeight?: number;
  docxMaxWidth?: number;
  imageType?: PdfVisualAssetImageType;
  jpegQuality?: number;
  concurrency?: number;
  maxAssets?: number;
  maxPagePixels?: number;
}

export interface PdfVisualAssetRenderResult {
  assets: Record<string, PdfTextDraftVisualAsset>;
  warnings: string[];
}

interface PdfViewportLike {
  width: number;
  height: number;
}

interface PdfRenderTaskLike {
  promise: Promise<void>;
}

interface PdfPageLike {
  getViewport(options: { scale: number }): PdfViewportLike;
  render(options: { canvasContext: unknown; viewport: PdfViewportLike }): PdfRenderTaskLike;
  cleanup?: () => void;
}

interface PdfDocumentLike {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfPageLike>;
  destroy?: () => Promise<void> | void;
}

interface CanvasContextLike {
  drawImage(
    image: unknown,
    sourceX: number,
    sourceY: number,
    sourceWidth: number,
    sourceHeight: number,
    destinationX: number,
    destinationY: number,
    destinationWidth: number,
    destinationHeight: number,
  ): void;
}

interface CanvasLike {
  width: number;
  height: number;
  getContext(type: "2d"): CanvasContextLike | null;
  convertToBlob?: (options?: { type?: string; quality?: number }) => Promise<Blob>;
  toBlob?: (callback: (blob: Blob | null) => void, type?: string, quality?: number) => void;
}

export interface PdfVisualAssetRendererDependencies {
  openPdfDocument?: (data: Uint8Array) => Promise<PdfDocumentLike>;
  createCanvas?: (width: number, height: number) => CanvasLike;
}

const DEFAULT_SCALE = 2;
const DEFAULT_MAX_OUTPUT_WIDTH = 1600;
const DEFAULT_MAX_OUTPUT_HEIGHT = 2400;
const DEFAULT_DOCX_MAX_WIDTH = 605;
const DEFAULT_CONCURRENCY = 2;
const DEFAULT_MAX_ASSETS = 80;
const DEFAULT_MAX_PAGE_PIXELS = 20_000_000;
const MIN_SCALE = 0.5;
const MAX_SCALE = 3;

function finitePositive(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

function clampInteger(value: number | undefined, fallback: number, min: number, max: number): number {
  const normalized = typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : fallback;
  return Math.min(max, Math.max(min, normalized));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function copyPdfBytes(data: ArrayBuffer | Uint8Array): Uint8Array {
  if (data instanceof Uint8Array) return new Uint8Array(data);
  return new Uint8Array(data.slice(0));
}

async function loadPdfJs(): Promise<typeof import("pdfjs-dist")> {
  const isBrowser = typeof window !== "undefined" && typeof document !== "undefined";
  if (!isBrowser) return import("pdfjs-dist/legacy/build/pdf.mjs");
  const pdfjs = await import("pdfjs-dist");
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  }
  return pdfjs;
}

async function defaultOpenPdfDocument(data: Uint8Array): Promise<PdfDocumentLike> {
  const pdfjs = await loadPdfJs();
  const task = pdfjs.getDocument({
    data,
    ...(typeof window === "undefined" ? ({ disableWorker: true } as Record<string, unknown>) : {}),
  });
  return task.promise as unknown as Promise<PdfDocumentLike>;
}

function defaultCreateCanvas(width: number, height: number): CanvasLike {
  if (typeof document === "undefined") throw new Error("Canvas indisponível fora do navegador.");
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas as unknown as CanvasLike;
}

async function canvasBlob(
  canvas: CanvasLike,
  imageType: PdfVisualAssetImageType,
  jpegQuality: number,
): Promise<Blob> {
  if (canvas.convertToBlob) {
    return canvas.convertToBlob({ type: imageType, quality: imageType === "image/jpeg" ? jpegQuality : undefined });
  }
  if (canvas.toBlob) {
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob?.(
        (blob) => blob ? resolve(blob) : reject(new Error("Não foi possível converter o recorte em imagem.")),
        imageType,
        imageType === "image/jpeg" ? jpegQuality : undefined,
      );
    });
  }
  throw new Error("O canvas não oferece conversão para Blob.");
}

function releaseCanvas(canvas: CanvasLike): void {
  canvas.width = 0;
  canvas.height = 0;
}

function validNormalizedCrop(crop: PdfVisualCropGeometry): boolean {
  const rect = crop.normalizedRect;
  return [rect.x, rect.y, rect.width, rect.height].every(Number.isFinite)
    && rect.x >= 0
    && rect.y >= 0
    && rect.width > 0
    && rect.height > 0
    && rect.x <= 1
    && rect.y <= 1
    && rect.x + rect.width <= 1.000001
    && rect.y + rect.height <= 1.000001;
}

export function pdfVisualCropKey(crop: PdfVisualCropGeometry): string {
  return `${crop.visualKey}::p${crop.pageNumber}::r${crop.regionId}`;
}

function sortCrops(crops: PdfVisualCropGeometry[]): PdfVisualCropGeometry[] {
  return [...crops].sort((left, right) =>
    left.pageNumber - right.pageNumber
    || left.regionId.localeCompare(right.regionId)
    || pdfVisualCropKey(left).localeCompare(pdfVisualCropKey(right))
  );
}

function groupCropsByPage(crops: PdfVisualCropGeometry[]): Array<[number, PdfVisualCropGeometry[]]> {
  const groups = new Map<number, PdfVisualCropGeometry[]>();
  for (const crop of crops) {
    const pageCrops = groups.get(crop.pageNumber) ?? [];
    pageCrops.push(crop);
    groups.set(crop.pageNumber, pageCrops);
  }
  return [...groups.entries()].sort((left, right) => left[0] - right[0]);
}

function viewportForLimits(page: PdfPageLike, requestedScale: number, maxPagePixels: number): PdfViewportLike {
  let scale = clamp(requestedScale, MIN_SCALE, MAX_SCALE);
  let viewport = page.getViewport({ scale });
  const area = viewport.width * viewport.height;
  if (Number.isFinite(area) && area > maxPagePixels) {
    scale *= Math.sqrt(maxPagePixels / area);
    viewport = page.getViewport({ scale });
  }
  return viewport;
}

function cropPixels(crop: PdfVisualCropGeometry, viewport: PdfViewportLike): {
  x: number;
  y: number;
  width: number;
  height: number;
} | null {
  const rect = crop.normalizedRect;
  const x = clamp(Math.floor(rect.x * viewport.width), 0, Math.max(0, Math.ceil(viewport.width) - 1));
  const y = clamp(Math.floor(rect.y * viewport.height), 0, Math.max(0, Math.ceil(viewport.height) - 1));
  const right = clamp(Math.ceil((rect.x + rect.width) * viewport.width), x + 1, Math.ceil(viewport.width));
  const bottom = clamp(Math.ceil((rect.y + rect.height) * viewport.height), y + 1, Math.ceil(viewport.height));
  const width = right - x;
  const height = bottom - y;
  return width > 0 && height > 0 ? { x, y, width, height } : null;
}

function outputDimensions(
  sourceWidth: number,
  sourceHeight: number,
  maxOutputWidth: number,
  maxOutputHeight: number,
): { width: number; height: number } {
  const factor = Math.min(1, maxOutputWidth / sourceWidth, maxOutputHeight / sourceHeight);
  return {
    width: Math.max(1, Math.round(sourceWidth * factor)),
    height: Math.max(1, Math.round(sourceHeight * factor)),
  };
}

async function runWorkers<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>): Promise<void> {
  let index = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      const current = items[index];
      index += 1;
      await worker(current);
    }
  });
  await Promise.all(runners);
}

export async function renderPdfVisualAssets(
  pdfData: ArrayBuffer | Uint8Array,
  crops: PdfVisualCropGeometry[],
  options: PdfVisualAssetRenderOptions = {},
  dependencies: PdfVisualAssetRendererDependencies = {},
): Promise<PdfVisualAssetRenderResult> {
  const warnings: string[] = [];
  const rendered = new Map<string, PdfTextDraftVisualAsset>();
  if (crops.length === 0) return { assets: {}, warnings };

  const requestedScale = finitePositive(options.scale, DEFAULT_SCALE);
  const maxOutputWidth = finitePositive(options.maxOutputWidth, DEFAULT_MAX_OUTPUT_WIDTH);
  const maxOutputHeight = finitePositive(options.maxOutputHeight, DEFAULT_MAX_OUTPUT_HEIGHT);
  const docxMaxWidth = finitePositive(options.docxMaxWidth, DEFAULT_DOCX_MAX_WIDTH);
  const maxPagePixels = finitePositive(options.maxPagePixels, DEFAULT_MAX_PAGE_PIXELS);
  const maxAssets = clampInteger(options.maxAssets, DEFAULT_MAX_ASSETS, 1, 500);
  const concurrency = clampInteger(options.concurrency, DEFAULT_CONCURRENCY, 1, 4);
  const imageType = options.imageType ?? "image/png";
  const jpegQuality = clamp(options.jpegQuality ?? 0.9, 0.1, 1);
  const createCanvas = dependencies.createCanvas ?? defaultCreateCanvas;
  const openPdfDocument = dependencies.openPdfDocument ?? defaultOpenPdfDocument;

  const sorted = sortCrops(crops);
  const selected = sorted.slice(0, maxAssets);
  for (const omitted of sorted.slice(maxAssets)) {
    warnings.push(`Recorte ${pdfVisualCropKey(omitted)} não renderizado: limite de ${maxAssets} ativos atingido.`);
  }

  let pdf: PdfDocumentLike | undefined;
  try {
    pdf = await openPdfDocument(copyPdfBytes(pdfData));
    const groups = groupCropsByPage(selected);
    await runWorkers(groups, concurrency, async ([pageNumber, pageCrops]) => {
      if (pageNumber < 1 || pageNumber > pdf!.numPages) {
        for (const crop of pageCrops) warnings.push(`Recorte ${pdfVisualCropKey(crop)} não renderizado: página inexistente.`);
        return;
      }

      let page: PdfPageLike | undefined;
      let pageCanvas: CanvasLike | undefined;
      try {
        page = await pdf!.getPage(pageNumber);
        const viewport = viewportForLimits(page, requestedScale, maxPagePixels);
        const pageWidth = Math.max(1, Math.ceil(viewport.width));
        const pageHeight = Math.max(1, Math.ceil(viewport.height));
        pageCanvas = createCanvas(pageWidth, pageHeight);
        const pageContext = pageCanvas.getContext("2d");
        if (!pageContext) throw new Error("Contexto 2D indisponível.");
        await page.render({ canvasContext: pageContext, viewport }).promise;

        for (const crop of pageCrops) {
          const key = pdfVisualCropKey(crop);
          if (rendered.has(key)) {
            warnings.push(`Recorte ${key} ignorado por duplicidade.`);
            continue;
          }
          if (!validNormalizedCrop(crop)) {
            warnings.push(`Recorte ${key} não renderizado: geometria normalizada inválida.`);
            continue;
          }

          const source = cropPixels(crop, viewport);
          if (!source) {
            warnings.push(`Recorte ${key} não renderizado: área vazia.`);
            continue;
          }
          const output = outputDimensions(source.width, source.height, maxOutputWidth, maxOutputHeight);
          const outputCanvas = createCanvas(output.width, output.height);
          try {
            const outputContext = outputCanvas.getContext("2d");
            if (!outputContext) throw new Error("Contexto 2D do recorte indisponível.");
            outputContext.drawImage(
              pageCanvas,
              source.x,
              source.y,
              source.width,
              source.height,
              0,
              0,
              output.width,
              output.height,
            );
            const blob = await canvasBlob(outputCanvas, imageType, jpegQuality);
            const data = await blob.arrayBuffer();
            const displayFactor = Math.min(1, docxMaxWidth / output.width);
            rendered.set(key, {
              data,
              width: Math.max(1, Math.round(output.width * displayFactor)),
              height: Math.max(1, Math.round(output.height * displayFactor)),
              altText: {
                title: `Elemento visual da página ${pageNumber}`,
                description: `Recorte ${key} do PDF original`,
                name: key,
              },
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : "falha desconhecida";
            warnings.push(`Recorte ${key} não renderizado: ${message}`);
          } finally {
            releaseCanvas(outputCanvas);
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "falha desconhecida";
        for (const crop of pageCrops) {
          const key = pdfVisualCropKey(crop);
          if (!rendered.has(key)) warnings.push(`Recorte ${key} não renderizado: ${message}`);
        }
      } finally {
        page?.cleanup?.();
        if (pageCanvas) releaseCanvas(pageCanvas);
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "falha desconhecida";
    warnings.push(`Não foi possível abrir o PDF para renderizar os elementos visuais: ${message}`);
  } finally {
    try {
      await pdf?.destroy?.();
    } catch {
      warnings.push("O documento PDF foi processado, mas a liberação final de recursos falhou.");
    }
  }

  const assets: Record<string, PdfTextDraftVisualAsset> = {};
  for (const key of [...rendered.keys()].sort()) assets[key] = rendered.get(key)!;
  warnings.sort();
  return { assets, warnings };
}
