import type {
  PdfTextItem,
  PdfDocumentBlock,
  PdfBlockKind,
  PdfBoundingBox,
  PdfPageText,
} from "./imported-pdf";

export interface PdfTextLine {
  pageNumber: number;
  y: number;
  x: number;
  width: number;
  height: number;
  text: string;
  items: PdfTextItem[];
  // Metadados de reconstrução (preenchidos por buildPageLines).
  fontSize?: number;
  fontName?: string;
  isBold?: boolean;
  bbox?: PdfBoundingBox;
}

function cleanWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizePdfTextItems(items: PdfTextItem[]): PdfTextItem[] {
  return items
    .map((item) => ({ ...item, text: cleanWhitespace(item.text) }))
    .filter((item) => item.text.length > 0);
}

// Caixas delimitadoras em PDF compartilham a mesma origem (canto inferior
// esquerdo, y crescente para cima). Dois itens iguais só são considerados
// duplicados quando o texto coincide E as caixas se sobrepõem de fato.
function boxesOverlap(a: PdfBoundingBox, b: PdfBoundingBox): boolean {
  const ax2 = a.x + a.width;
  const ay2 = a.y + a.height;
  const bx2 = b.x + b.width;
  const by2 = b.y + b.height;
  const overlapX = Math.min(ax2, bx2) - Math.max(a.x, b.x);
  const overlapY = Math.min(ay2, by2) - Math.max(a.y, b.y);
  return overlapX > 0 && overlapY > 0;
}

function dedupePdfItems(items: PdfTextItem[]): PdfTextItem[] {
  const seen: Array<{ text: string; box: PdfBoundingBox }> = [];
  const result: PdfTextItem[] = [];
  for (const item of items) {
    const box: PdfBoundingBox = { x: item.x, y: item.y, width: item.width, height: item.height };
    const duplicate = seen.find(
      (entry) => entry.text === item.text && boxesOverlap(entry.box, box),
    );
    if (duplicate) continue;
    seen.push({ text: item.text, box });
    result.push(item);
  }
  return result;
}

function isMostlyUpper(text: string): boolean {
  const letters = text.match(/[a-zA-ZÀ-Þà-þ]/g);
  if (!letters) return false;
  const upper = text.match(/[A-ZÀ-Þ]/g) ?? [];
  return upper.length / letters.length >= 0.8;
}

function looksTabular(text: string): boolean {
  const segments = text.split(/\s{2,}/).filter(Boolean);
  if (segments.length >= 3) return true;
  const digitColumns = text.split(/\s{2,}/).filter((s) => /\d/.test(s));
  return digitColumns.length >= 2 && segments.length >= 2;
}

const CAPTION_PATTERN = /^(Quadro|Tabela|Figura|Gráfico)\s+\d+/i;
const SOURCE_PATTERN = /^Fonte\s*:/i;
const IMAGE_LABELS = /^(Figura|Gráfico)/i;

function isBoldFontName(name?: string): boolean {
  if (!name) return false;
  return /(?:^|[-\s])(bold|black|heavy|semibold|medium)/i.test(name) || /\bb$/i.test(name);
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Agrupa os itens de uma página em linhas visuais, enriquecendo cada linha com
// metadados de fonte/tamanho/caixa para a reconstrução semântica. A tolerância
// de linha é adaptativa (mediana da altura das letras), evitando quebras falsas
// em documentos com espaçamento irregular.
export function buildPageLines(page: PdfPageText): PdfTextLine[] {
  const medianHeight = median(page.items.map((item) => item.height)) || 12;
  const lineTolerance = Math.max(3, medianHeight * 0.6);
  const minX = 0;
  const maxX = page.width || Number.POSITIVE_INFINITY;
  const lines = groupPdfTextIntoLines(page.items, lineTolerance);
  return lines.map((line) => enrichLine(line, minX, maxX));
}

function enrichLine(line: PdfTextLine, minX: number, maxX: number): PdfTextLine {
  const heights = line.items.map((item) => item.height).filter((h) => h > 0);
  const fontSize = heights.length ? median(heights) : line.height;
  const fontName = line.items.find((item) => item.fontName)?.fontName;
  const isBold = isBoldFontName(fontName) || line.items.some((item) => isBoldFontName(item.fontName));
  const lineMinX = Math.min(...line.items.map((item) => item.x));
  const lineMaxX = Math.max(...line.items.map((item) => item.x + item.width));
  const lineMinY = Math.min(...line.items.map((item) => item.y));
  const lineMaxY = Math.max(...line.items.map((item) => item.y + item.height));
  const bbox: PdfBoundingBox = {
    x: lineMinX,
    y: lineMinY,
    width: lineMaxX - lineMinX,
    height: lineMaxY - lineMinY,
  };
  return {
    ...line,
    fontSize,
    fontName,
    isBold,
    bbox,
    // Mantém x/width consistentes com a caixa real (recorte de margem).
    x: Math.max(minX, lineMinX),
    width: Math.min(maxX, lineMaxX) - Math.max(minX, lineMinX),
  };
}

export function groupPdfTextIntoLines(items: PdfTextItem[], lineTolerance = 6): PdfTextLine[] {
  const cleaned = dedupePdfItems(normalizePdfTextItems(items));
  const sorted = [...cleaned].sort((a, b) => {
    if (a.pageNumber !== b.pageNumber) return a.pageNumber - b.pageNumber;
    // PDF Y é medido de baixo para cima: maior Y = topo da página.
    // Ordenamos de cima para baixo (Y decrescente) e, na mesma linha, da esquerda para a direita (X crescente).
    if (Math.abs(a.y - b.y) > lineTolerance) return b.y - a.y;
    return a.x - b.x;
  });

  const lines: PdfTextLine[] = [];
  for (const item of sorted) {
    const last = lines[lines.length - 1];
    if (
      last &&
      last.pageNumber === item.pageNumber &&
      Math.abs(last.y - item.y) <= lineTolerance
    ) {
      last.items.push(item);
      last.text = cleanWhitespace(`${last.text} ${item.text}`);
      last.width = Math.max(last.width, item.x + item.width - last.x);
      last.height = Math.max(last.height, item.height);
      continue;
    }
    lines.push({
      pageNumber: item.pageNumber,
      y: item.y,
      x: item.x,
      width: item.width,
      height: item.height,
      text: item.text,
      items: [item],
    });
  }
  return lines;
}

export function buildPageNormalizedText(items: PdfTextItem[]): string {
  return groupPdfTextIntoLines(items)
    .map((line) => line.text)
    .join("\n");
}

export function classifyPdfLine(text: string): PdfBlockKind {
  const trimmed = text.trim();
  if (SOURCE_PATTERN.test(trimmed)) return "source";
  if (CAPTION_PATTERN.test(trimmed)) {
    return IMAGE_LABELS.test(trimmed) ? "image-candidate" : "caption";
  }
  if (looksTabular(trimmed)) return "table-candidate";
  if (isMostlyUpper(trimmed) && trimmed.length <= 60 && /[A-ZÀ-Þ]{3,}/.test(trimmed)) {
    return "heading";
  }
  return "text";
}

export function detectPdfBlockCandidates(lines: PdfTextLine[]): PdfDocumentBlock[] {
  return lines.map((line, index) => {
    const kind = classifyPdfLine(line.text);
    const warnings: string[] = [];
    if (kind === "table-candidate" || kind === "image-candidate") {
      warnings.push(
        "Bloco detectado por estrutura visual do PDF. Revisão manual de layout pode ser necessária.",
      );
    }
    const confidence: PdfDocumentBlock["confidence"] =
      kind === "heading" || kind === "caption" || kind === "source" ? "high" : "medium";
    return {
      id: `${line.pageNumber}-${index}`,
      kind,
      pageNumber: line.pageNumber,
      text: line.text,
      x: line.x,
      y: line.y,
      width: line.width,
      height: line.height,
      confidence,
      warnings: warnings.length ? warnings : undefined,
    };
  });
}
