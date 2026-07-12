import type { PdfTextItem, PdfDocumentBlock, PdfBlockKind } from "./imported-pdf";

export interface PdfTextLine {
  pageNumber: number;
  y: number;
  x: number;
  width: number;
  height: number;
  text: string;
  items: PdfTextItem[];
}

function cleanWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizePdfTextItems(items: PdfTextItem[]): PdfTextItem[] {
  return items
    .map((item) => ({ ...item, text: cleanWhitespace(item.text) }))
    .filter((item) => item.text.length > 0);
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

export function groupPdfTextIntoLines(items: PdfTextItem[], lineTolerance = 6): PdfTextLine[] {
  const cleaned = normalizePdfTextItems(items);
  const sorted = [...cleaned].sort((a, b) => {
    if (a.pageNumber !== b.pageNumber) return a.pageNumber - b.pageNumber;
    if (Math.abs(a.y - b.y) > lineTolerance) return a.y - b.y;
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
