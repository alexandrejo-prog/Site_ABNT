import type {
  ImportedPdfDocument,
  PdfDocumentBlock,
  PdfPageText,
  PdfRegion,
  PdfRegionCropRect,
  PdfRegionKind,
  RenderedPdfRegion,
} from "./imported-pdf";
import { loadPdfJs } from "./import-pdf";

const REGION_MARGIN_PT = 10;
const MAX_REGION_HEIGHT_RATIO = 0.8;
const MIN_REGION_HEIGHT_PT = 20;

function captionKindToRegionKind(caption: string): PdfRegionKind {
  const text = caption.toLowerCase();
  if (text.startsWith("gráfico") || text.startsWith("grafico")) return "chart-visual";
  if (text.startsWith("figura")) return "figure-visual";
  return "table-visual";
}

const LIST_OR_SUMMARY_HEADING = /(^|\n)\s*(LISTA DE (QUADROS|FIGURAS|GR[ÁA]FICOS|ILUSTRA[ÇC][ÕO]ES)|SUM[ÁA]RIO|ÍNDICE)\b/i;
const LIST_ENTRY_CAPTION = /^(Quadro|Tabela|Figura|Gr[áa]fico)\s+\d+[^\n]*\.{2,}\s*\d+\s*$/i;

function isListOrSummaryPage(page: PdfPageText): boolean {
  const head = page.normalizedText.split("\n").slice(0, 8).join("\n");
  return LIST_OR_SUMMARY_HEADING.test(head);
}

function isListEntryCaption(text: string): boolean {
  return LIST_ENTRY_CAPTION.test(text.trim());
}

function blockScreenSpan(pageHeight: number, block: PdfDocumentBlock): { top: number; bottom: number } {
  const y = block.y ?? 0;
  const h = block.height ?? 0;
  const top = pageHeight - (y + h);
  const bottom = pageHeight - y;
  return { top, bottom };
}

function clampRegionToPage(region: PdfRegion, page: PdfPageText): { region: PdfRegion; warnings: string[] } {
  const warnings = [...(region.warnings ?? [])];
  const maxX = page.width;
  const maxY = page.height;
  let x = Math.max(0, Math.min(region.x, maxX));
  let y = Math.max(0, Math.min(region.y, maxY));
  let width = Math.min(region.width, maxX - x);
  let height = Math.min(region.height, maxY - y);
  if (width <= 0) {
    width = Math.max(1, Math.min(region.width, maxX));
    x = 0;
  }
  if (height <= 0) {
    height = Math.max(1, Math.min(region.height, maxY - y));
  }
  if (x !== region.x || y !== region.y || width !== region.width || height !== region.height) {
    warnings.push("região ajustada aos limites da página");
  }
  return { region: { ...region, x, y, width, height, warnings }, warnings };
}

function assessRegionQuality(
  region: PdfRegion,
  page: PdfPageText,
  hasSource: boolean,
): { confidence: PdfRegion["confidence"]; warnings: string[] } {
  const warnings = [...(region.warnings ?? [])];
  let confidence: PdfRegion["confidence"] = "high";

  if (!hasSource) {
    confidence = "medium";
    warnings.push("sem fonte ('Fonte:') abaixo da legenda");
  }

  const tooLarge = region.height > page.height * MAX_REGION_HEIGHT_RATIO;
  const tooSmall = region.height < MIN_REGION_HEIGHT_PT;
  if (tooLarge || tooSmall) {
    confidence = "low";
    if (tooLarge) warnings.push("região muito grande, pode conter conteúdo além da figura/quadro");
    if (tooSmall) warnings.push("região muito pequena, pode não conter a figura/quadro inteira");
  }

  return { confidence, warnings };
}

export function detectPdfVisualRegionCandidates(document: ImportedPdfDocument): PdfRegion[] {
  const regions: PdfRegion[] = [];
  const pagesByNumber = new Map<number, PdfPageText>();
  for (const page of document.pages) pagesByNumber.set(page.pageNumber, page);

  const blocksByPage = new Map<number, PdfDocumentBlock[]>();
  for (const block of document.blocks) {
    if (!blocksByPage.has(block.pageNumber)) blocksByPage.set(block.pageNumber, []);
    blocksByPage.get(block.pageNumber)!.push(block);
  }

  for (const [pageNumber, blocks] of blocksByPage) {
    const page = pagesByNumber.get(pageNumber);
    if (!page) continue;

    // Páginas de Lista de Quadros/Figuras/Gráficos/Sumário não contêm figuras reais;
    // pulamos para não sugerir recortes dos itens de índice.
    if (isListOrSummaryPage(page)) continue;

    const captions = blocks.filter(
      (b) =>
        (b.kind === "caption" || b.kind === "image-candidate") && !isListEntryCaption(b.text),
    );
    const sources = blocks
      .filter((b) => b.kind === "source")
      .sort((a, b) => (b.y ?? 0) - (a.y ?? 0));

    for (const caption of captions) {
      const captionSpan = blockScreenSpan(page.height, caption);

      const sourceBelow = sources.find((s) => (s.y ?? 0) < (caption.y ?? 0));
      const hasSource = Boolean(sourceBelow);
      const sourceSpan = sourceBelow ? blockScreenSpan(page.height, sourceBelow) : null;

      const top = Math.max(0, captionSpan.top - REGION_MARGIN_PT);
      const bottom = sourceSpan
        ? sourceSpan.bottom + REGION_MARGIN_PT
        : captionSpan.bottom + REGION_MARGIN_PT;

      const baseRegion: PdfRegion = {
        pageNumber,
        x: 0,
        y: top,
        width: page.width,
        height: Math.max(0, bottom - top),
        kind: captionKindToRegionKind(caption.text),
        caption: caption.text,
        source: sourceBelow?.text,
        confidence: "high",
        warnings: [],
      };

      const clamped = clampRegionToPage(baseRegion, page);
      const assessed = assessRegionQuality(clamped.region, page, hasSource);
      regions.push({
        ...clamped.region,
        confidence: assessed.confidence,
        warnings: assessed.warnings,
      });
    }
  }

  return regions;
}

export function computeRegionCropRect(
  region: PdfRegion,
  pageWidthPts: number,
  pageHeightPts: number,
  scale: number,
): PdfRegionCropRect {
  const yBottomTop = pageHeightPts - region.y;
  const yBottomBottom = pageHeightPts - (region.y + region.height);
  const tlX = region.x * scale;
  const tlY = yBottomTop * scale;
  const brX = (region.x + region.width) * scale;
  const brY = yBottomBottom * scale;

  const sx = Math.max(0, Math.min(tlX, brX));
  const sy = Math.max(0, Math.min(tlY, brY));
  const sw = Math.max(0, Math.min(Math.abs(brX - tlX), pageWidthPts * scale - sx));
  const sh = Math.max(0, Math.min(Math.abs(brY - tlY), pageHeightPts * scale - sy));
  return { sx, sy, sw, sh };
}

export async function renderPdfRegionToPng(input: {
  file: File | ArrayBuffer;
  region: PdfRegion;
  scale?: number;
}): Promise<RenderedPdfRegion> {
  if (typeof document === "undefined" || typeof document.createElement !== "function") {
    throw new Error("A renderização de região de PDF requer um navegador (document indisponível).");
  }
  const pdfjsLib = await loadPdfJs();
  const data = input.file instanceof ArrayBuffer ? input.file : await input.file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data }).promise;
  const page = await doc.getPage(input.region.pageNumber);
  const scale = input.scale ?? 2;
  const viewport = page.getViewport({ scale });
  const pageWidthPts = viewport.width / scale;
  const pageHeightPts = viewport.height / scale;

  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível obter o contexto 2D do canvas.");
  await page.render({ canvas, canvasContext: ctx, viewport }).promise;

  const crop = computeRegionCropRect(input.region, pageWidthPts, pageHeightPts, scale);
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(crop.sw));
  out.height = Math.max(1, Math.round(crop.sh));
  const octx = out.getContext("2d");
  if (!octx) throw new Error("Não foi possível obter o contexto 2D do canvas.");
  octx.drawImage(canvas, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, out.width, out.height);

  return {
    pageNumber: input.region.pageNumber,
    region: input.region,
    mimeType: "image/png",
    dataUrl: out.toDataURL("image/png"),
    widthPx: out.width,
    heightPx: out.height,
  };
}
