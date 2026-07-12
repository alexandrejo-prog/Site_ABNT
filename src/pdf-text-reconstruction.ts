import type {
  ImportedPdfDocument,
  PdfRegion,
  PdfSemanticBlock,
  PdfParagraphBlock,
  PdfHeadingBlock,
  PdfListItemBlock,
  PdfCaptionBlock,
  PdfSourceBlock,
  PdfVisualBlock,
  PdfPageText,
  PdfBoundingBox,
} from "./imported-pdf";
import { buildPageLines } from "./import-pdf-text";
import type { PdfTextLine } from "./import-pdf-text";
import { detectPdfVisualRegionCandidates } from "./pdf-region-renderer";
import { looksLikeImageSource } from "./imported-images";

// Evita dependência circular com pdf-to-imported-blocks (que por sua vez importa
// esta reconstrução). Mantém a mesma mensagem de aviso do rascunho.
const PDF_DRAFT_WARNING =
  "Rascunho gerado a partir de PDF (experimental, sem OCR). Revise estrutura, tabelas, quadros, gráficos, imagens, paginação, sumário e referências antes de usar.";

const CAPTION_PATTERN = /^(Quadro|Tabela|Figura|Gráfico)\s+\d+/i;
const LIST_MARKER_PATTERN = /^\s*([a-z]\)|\d+[.)]|[ivx]+[.)]|[IVX]+[.)]|[-•*]\s)/;
// Entrada de sumário/índice: texto seguido de linha de pontos e número de página.
const TOC_ENTRY_PATTERN = /[.\u2026•·-]{3,}\s*\d{1,4}\s*$/;
// Número de página isolado (1 a 4 dígitos).
const PAGE_NUMBER_PATTERN = /^\d{1,4}$/;

function isTocEntry(text: string): boolean {
  return TOC_ENTRY_PATTERN.test(text.trim());
}

function isPageNumberCandidate(text: string, xRatio: number): boolean {
  return PAGE_NUMBER_PATTERN.test(text.trim()) && xRatio > 0.45;
}

function headingLevel(text: string): number | null {
  const numbered = text.match(/^(\d+(?:\.\d+)*)\s/);
  if (numbered) return Math.min(4, numbered[1].split(".").length);
  if (/^[IVXLC]+\s+[A-ZÀ-Þ]/.test(text)) return 1;
  return null;
}

function isCaptionLine(text: string): boolean {
  return CAPTION_PATTERN.test(text.trim());
}

function listMarker(line: PdfTextLine): string | null {
  const match = line.text.match(LIST_MARKER_PATTERN);
  return match ? match[1].trim() : null;
}

function lineInRegion(line: PdfTextLine, region: { x: number; y: number; width: number; height: number }): boolean {
  if (!line.bbox) return false;
  const pad = 4;
  return (
    line.bbox.x >= region.x - pad &&
    line.bbox.x + line.bbox.width <= region.x + region.width + pad &&
    line.bbox.y >= region.y - pad &&
    line.bbox.y + line.bbox.height <= region.y + region.height + pad
  );
}

// Identifica números de página e cabeçalhos/rodapés repetitivos (linhas que
// aparecem no topo/rodapé de várias páginas com mesmo texto) para serem
// descartados da reconstrução, evitando ruído no DOCX.
function computeSkipLineIndexes(
  pages: PdfPageText[],
  pageLines: Map<number, PdfTextLine[]>,
): Set<string> {
  const skip = new Set<string>();
  const pagesWithPageNumbers = new Set<number>();
  const topBand = new Map<string, Set<number>>();
  const bottomBand = new Map<string, Set<number>>();

  for (const page of pages) {
    const lines = pageLines.get(page.pageNumber) ?? [];
    const h = page.height || 1;
    const w = page.width || 1;
    for (const line of lines) {
      const norm = line.text.trim();
      if (norm.length === 0) continue;
      const yRatio = (line.y + (line.height || 0) / 2) / h;
      const xRatio = (line.x + line.width / 2) / w;
      if (isPageNumberCandidate(norm, xRatio)) {
        pagesWithPageNumbers.add(page.pageNumber);
      }
      if (yRatio > 0.88) {
        if (!topBand.has(norm)) topBand.set(norm, new Set());
        topBand.get(norm)!.add(page.pageNumber);
      } else if (yRatio < 0.12) {
        if (!bottomBand.has(norm)) bottomBand.set(norm, new Set());
        bottomBand.get(norm)!.add(page.pageNumber);
      }
    }
  }

  // Números de página mudam a cada página; descartamos quando aparecem em
  // várias páginas (mesmo que com valores diferentes).
  if (pagesWithPageNumbers.size >= 3) {
    for (const page of pages) {
      const lines = pageLines.get(page.pageNumber) ?? [];
      lines.forEach((line, i) => {
        if (isPageNumberCandidate(line.text.trim(), (line.x + line.width / 2) / (page.width || 1))) {
          skip.add(`${page.pageNumber}#${i}`);
        }
      });
    }
  }

  const repetitive = [...topBand.entries(), ...bottomBand.entries()].filter(
    ([, pagesSet]) => pagesSet.size >= 3,
  );
  for (const [text] of repetitive) {
    for (const page of pages) {
      const lines = pageLines.get(page.pageNumber) ?? [];
      lines.forEach((line, i) => {
        const norm = line.text.trim();
        if (
          norm === text &&
          !isCaptionLine(norm) &&
          !looksLikeImageSource(norm) &&
          !headingLevel(norm)
        ) {
          skip.add(`${page.pageNumber}#${i}`);
        }
      });
    }
  }

  return skip;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function shouldBreakParagraph(
  prev: PdfTextLine,
  next: PdfTextLine,
  medianGap: number,
): boolean {
  if (prev.pageNumber !== next.pageNumber) return true;
  const baselineGap = prev.y - next.y;
  // Quebra quando o espaçamento é claramente maior que o entrelinha comum do
  // parágrafo (limiar relativo ou absoluto de ~2 linhas).
  if (baselineGap > medianGap * 2.2) return true;
  if (baselineGap > 24) return true;
  const indentJump = next.x - prev.x;
  if (indentJump < -10) return true;
  if (indentJump > 30 && next.x > 10) return true;
  return false;
}

function makeId(pageNumber: number, index: number): string {
  return `blk-${pageNumber}-${index}`;
}

export function reconstructPdfSemanticBlocks(
  document: ImportedPdfDocument,
  options: { includePreTextualPages?: boolean } = {},
): PdfSemanticBlock[] {
  const regions = detectPdfVisualRegionCandidates(document);
  const regionsByPage = new Map<number, PdfRegion[]>();
  for (const region of regions) {
    const list = regionsByPage.get(region.pageNumber) ?? [];
    list.push(region);
    regionsByPage.set(region.pageNumber, list);
  }

  const pages = [...document.pages].sort((a, b) => a.pageNumber - b.pageNumber);
  const pageLines = new Map<number, PdfTextLine[]>();
  for (const page of pages) pageLines.set(page.pageNumber, buildPageLines(page));

  const skip = computeSkipLineIndexes(pages, pageLines);

  const blocks: PdfSemanticBlock[] = [];
  let index = 0;

  for (const page of pages) {
    const lines = pageLines.get(page.pageNumber) ?? [];
    if (lines.length === 0) continue;
    const gaps = lines.slice(1).map((line, i) => lines[i].y - line.y).filter((g) => g > 0);
    const medianGap = median(gaps) || 14;
    const pageRegions = regionsByPage.get(page.pageNumber) ?? [];
    // Regiões detectadas usam coordenadas de tela (origem no topo); as linhas
    // usam coordenadas PDF (origem embaixo). Convertemos para comparar.
    const regionBoxes = pageRegions.map((region) => ({
      region,
      box: {
        x: region.x,
        y: page.height - (region.y + region.height),
        width: region.width,
        height: region.height,
      } as PdfBoundingBox,
    }));
    const emittedRegions = new Set<number>();
    let currentParagraph: PdfTextLine[] = [];
    let currentListItem: { marker: string; lines: PdfTextLine[] } | null = null;

    const flushParagraph = () => {
      if (currentParagraph.length === 0) return;
      blocks.push(paragraphBlock(page.pageNumber, currentParagraph, makeId(page.pageNumber, index++)));
      currentParagraph = [];
    };
    const flushListItem = () => {
      if (!currentListItem || currentListItem.lines.length === 0) {
        currentListItem = null;
        return;
      }
      blocks.push(listItemBlock(page.pageNumber, currentListItem, makeId(page.pageNumber, index++)));
      currentListItem = null;
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const key = `${page.pageNumber}#${i}`;
      if (skip.has(key)) continue;

      const text = line.text.trim();
      if (isTocEntry(text)) continue;

      const marker = listMarker(line);
      if (isCaptionLine(text)) {
        flushParagraph();
        flushListItem();
        blocks.push(captionBlock(page.pageNumber, line, makeId(page.pageNumber, index++)));
        continue;
      }
      if (looksLikeImageSource(text)) {
        flushParagraph();
        flushListItem();
        blocks.push(sourceBlock(page.pageNumber, line, makeId(page.pageNumber, index++)));
        continue;
      }
      const level = headingLevel(text);
      if (level) {
        flushParagraph();
        flushListItem();
        blocks.push(headingBlock(page.pageNumber, line, level, makeId(page.pageNumber, index++)));
        continue;
      }
      if (marker) {
        flushParagraph();
        flushListItem();
        currentListItem = { marker, lines: [line] };
        continue;
      }
      if (currentListItem) {
        const hanging = line.x > currentListItem.lines[0].x + 6;
        if (hanging) {
          currentListItem.lines.push(line);
          continue;
        }
        flushListItem();
      }

      const regionIndex = regionBoxes.findIndex(
        (rb) => (line.bbox ? lineInRegion(line, rb.box) : false),
      );
      if (regionIndex >= 0) {
        // Linhas dentro de uma região visual são absorvidas pelo recorte (a
        // legenda/fonte já viraram blocos próprios). Emitimos o bloco visual
        // uma única vez por região e pulamos as demais linhas internas.
        if (!emittedRegions.has(regionIndex)) {
          flushParagraph();
          flushListItem();
          emittedRegions.add(regionIndex);
          blocks.push(visualBlock(page.pageNumber, regionBoxes[regionIndex].region, makeId(page.pageNumber, index++)));
        }
        continue;
      }

      if (currentParagraph.length === 0) {
        currentParagraph.push(line);
        continue;
      }
      if (shouldBreakParagraph(currentParagraph[currentParagraph.length - 1], line, medianGap)) {
        flushParagraph();
      }
      currentParagraph.push(line);
    }
    flushParagraph();
    flushListItem();
  }

  if (!options.includePreTextualPages) {
    return applyPreTextualFilter(blocks);
  }
  return blocks;
}

function applyPreTextualFilter(blocks: PdfSemanticBlock[]): PdfSemanticBlock[] {
  const start = blocks.findIndex((block) => block.kind === "heading" && block.level <= 1);
  return start > 0 ? blocks.slice(start) : blocks;
}

export { applyPreTextualFilter };

function mergeLines(lines: PdfTextLine[]): string {
  return lines.map((line) => line.text.trim()).join(" ");
}

function paragraphBlock(pageNumber: number, lines: PdfTextLine[], id: string): PdfParagraphBlock {
  return {
    id,
    kind: "paragraph",
    pageNumber,
    y: lines[0].y,
    text: mergeLines(lines),
    lines,
    confidence: "high",
  };
}

function listItemBlock(
  pageNumber: number,
  item: { marker: string; lines: PdfTextLine[] },
  id: string,
): PdfListItemBlock {
  return {
    id,
    kind: "list-item",
    pageNumber,
    y: item.lines[0].y,
    text: `${item.marker} ${mergeLines(item.lines)}`,
    marker: item.marker,
    lines: item.lines,
    confidence: "medium",
  };
}

function captionBlock(pageNumber: number, line: PdfTextLine, id: string): PdfCaptionBlock {
  return { id, kind: "caption", pageNumber, y: line.y, text: line.text.trim(), lines: [line], confidence: "high" };
}

function sourceBlock(pageNumber: number, line: PdfTextLine, id: string): PdfSourceBlock {
  return { id, kind: "source", pageNumber, y: line.y, text: line.text.trim(), lines: [line], confidence: "high" };
}

function headingBlock(pageNumber: number, line: PdfTextLine, level: number, id: string): PdfHeadingBlock {
  return { id, kind: "heading", level, pageNumber, y: line.y, text: line.text.trim(), lines: [line], confidence: "high" };
}

function visualBlock(pageNumber: number, region: PdfRegion, id: string): PdfVisualBlock {
  const text = region.source ? `${region.caption} ${region.source}` : region.caption;
  return {
    id,
    kind: "visual",
    pageNumber,
    y: region.y,
    text: text.trim(),
    lines: [],
    visualRegion: region,
    confidence: region.confidence,
    warnings:
      region.confidence === "low"
        ? ["Região visual de baixa confiança. Reinsira manualmente no DOCX final."]
        : undefined,
  };
}

export function semanticBlocksToEditorText(
  blocks: PdfSemanticBlock[],
  regions: PdfRegion[],
  title: string,
): string {
  const bodyLines: string[] = [PDF_DRAFT_WARNING];
  if (title) bodyLines.push("", `Título sugerido (verificar na capa): ${title}`);
  bodyLines.push("", "Texto reconstruído do PDF (revisar estrutura no DOCX gerado):", "");
  for (const block of blocks) bodyLines.push(block.text);
  if (regions.length > 0) {
    bodyLines.push("", "Elementos visuais detectados (revisão manual):");
    for (const region of regions) {
      const source = region.source ? ` — ${region.source}` : "";
      bodyLines.push(`- p.${region.pageNumber} | ${region.caption ?? region.kind}${source}`);
    }
  }
  return bodyLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export type { PdfBoundingBox };
