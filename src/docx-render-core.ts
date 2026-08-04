import {
  AlignmentType,
  BorderStyle,
  IParagraphOptions,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { UFLA_RULES } from "./ufla-rules";

export function cleanMojibakeText(value: string): string {
  return value
    .replace(/([\p{L}\p{N}])[\u00ad\ufeff\ufffe\uffff\u2060]([\p{L}\p{N}])/gu, "$1-$2")
    .replace(/[\u00ad\ufeff\ufffe\uffff\u2060\u200b]/g, "")
    // eslint-disable-next-line no-control-regex -- remove deliberadamente caracteres de controle do texto importado
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/Ã¡/g, "á")
    .replace(/Ã /g, "à")
    .replace(/Ã¢/g, "â")
    .replace(/Ã£/g, "ã")
    .replace(/Ã©/g, "é")
    .replace(/Ãª/g, "ê")
    .replace(/Ã­/g, "í")
    .replace(/Ã³/g, "ó")
    .replace(/Ã´/g, "ô")
    .replace(/Ãµ/g, "õ")
    .replace(/Ãº/g, "ú")
    .replace(/Ã§/g, "ç")
    .replace(/Ã\u0080/g, "À")
    .replace(/Ã/g, "Á")
    .replace(/Ã\u0082/g, "Â")
    .replace(/Ã\u0083/g, "Ã")
    .replace(/Ã‰/g, "É")
    .replace(/Ã\u008D/g, "Í")
    .replace(/Ã“/g, "Ó")
    .replace(/Ã\u0094/g, "Ô")
    .replace(/Ã\u0095/g, "Õ")
    .replace(/Ã\u009A/g, "Ú")
    .replace(/Ã‡/g, "Ç");
}

export function splitParagraphs(value: string): string[] {
  return value
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function hasText(value: string): boolean {
  return value.trim().length > 0;
}

export function plainRun(
  text: string,
  size = 24,
  font = "Times New Roman",
  color = "000000",
): TextRun {
  return new TextRun({
    text: cleanMojibakeText(text),
    font,
    size,
    color,
  });
}

export interface ParsedRun {
  text: string;
  bold?: boolean;
  italics?: boolean;
}

export function tokenizeMarkup(text: string): ParsedRun[] {
  const runs: ParsedRun[] = [];
  const tokenPattern = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(text)) !== null) {
    if (match.index > cursor) {
      runs.push({ text: text.slice(cursor, match.index) });
    }

    const token = match[0];
    const bold = token.startsWith("**");
    const content = bold ? token.slice(2, -2) : token.slice(1, -1);
    runs.push({ text: content, bold, italics: !bold });
    cursor = match.index + token.length;
  }

  if (cursor < text.length) {
    runs.push({ text: text.slice(cursor) });
  }

  return applyEtAlItalic(runs.length ? runs : [{ text: "" }]);
}

function applyEtAlItalic(runs: ParsedRun[]): ParsedRun[] {
  const etAlPattern = /(et\s+al\.)/giu;
  const expanded = runs.flatMap((run) => {
    const pieces: ParsedRun[] = [];
    let cursor = 0;
    let m: RegExpExecArray | null;
    while ((m = etAlPattern.exec(run.text)) !== null) {
      if (m.index > cursor) pieces.push({ text: run.text.slice(cursor, m.index), bold: run.bold, italics: run.italics });
      pieces.push({ text: m[0], bold: run.bold, italics: true });
      cursor = m.index + m[0].length;
    }
    if (cursor < run.text.length) pieces.push({ text: run.text.slice(cursor), bold: run.bold, italics: run.italics });
    return pieces.length ? pieces : [{ ...run }];
  });
  const merged: ParsedRun[] = [];
  for (const run of expanded.filter((item) => item.text.length > 0)) {
    const last = merged[merged.length - 1];
    if (last && last.bold === run.bold && last.italics === run.italics) last.text += run.text;
    else merged.push({ ...run });
  }
  return merged.length ? merged : runs;
}

export function textRunsForSingleLine(
  text: string,
  size = 24,
  font = "Times New Roman",
  color = "000000",
): TextRun[] {
  const runs: TextRun[] = [];
  for (const parsed of tokenizeMarkup(cleanMojibakeText(text))) {
    runs.push(
      new TextRun({
        text: parsed.text,
        bold: parsed.bold,
        italics: parsed.italics,
        font,
        size,
        color,
      }),
    );
  }
  return runs;
}

export function textRunsFromMarkup(
  text: string,
  size = 24,
  font = "Times New Roman",
  color = "000000",
): TextRun[] {
  return text.split(/\n/).flatMap((line, index) => {
    const runs = textRunsForSingleLine(line, size, font, color);
    if (index === 0) return runs;
    return [new TextRun({ break: 1 }), ...runs];
  });
}

export function textParagraph(
  text: string,
  options: Partial<IParagraphOptions> = {},
): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.BOTH,
    spacing: { line: UFLA_RULES.spacing.bodyLineTwip, after: UFLA_RULES.spacing.afterParagraphTwip },
    indent: { firstLine: UFLA_RULES.typography.paragraphFirstLineTwip },
    children: textRunsFromMarkup(text || " "),
    ...options,
  });
}

export function simpleParagraph(
  text: string,
  options: Partial<IParagraphOptions> = {},
): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.BOTH,
    spacing: { line: UFLA_RULES.spacing.singleLineTwip, after: UFLA_RULES.spacing.afterParagraphTwip },
    children: textRunsFromMarkup(text || " "),
    ...options,
  });
}

export function centeredParagraph(
  text: string,
  bold = false,
  size = 24,
  spacing: NonNullable<IParagraphOptions["spacing"]> = { after: 240 },
): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing,
    children: [
      new TextRun({
        text: cleanMojibakeText(text),
        bold,
        font: "Times New Roman",
        size,
        color: "000000",
      }),
    ],
  });
}

export function buildSimpleParagraphs(value: string): Paragraph[] {
  return splitParagraphs(value).map((line) => simpleParagraph(line));
}

export type CaptionKind = "illustration" | "table";

export interface CaptionInfo {
  kind: CaptionKind;
  number?: string;
  label?: string;
}

const CAPTION_PATTERN = /^(figura|quadro|gráfico|mapa|imagem|ilustração|tabela)\s+(\d+)([-:–—]?\s*.*)$/i;

export function detectCaption(text: string): CaptionInfo | null {
  const trimmed = text.trim();
  const match = trimmed.match(CAPTION_PATTERN);
  if (!match) return null;

  const label = match[1].toLowerCase();
  const kind: CaptionKind = label === "tabela" ? "table" : "illustration";

  return {
    kind,
    number: match[2],
    label: match[3].trim() || undefined,
  };
}

export function captionParagraph(
  text: string,
  _kind: CaptionKind = "illustration",
): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 120, after: 120, line: UFLA_RULES.spacing.singleLineTwip },
    indent: { left: 454, right: 454 },
    children: [
      new TextRun({
        text: cleanMojibakeText(text),
        bold: true,
        font: "Times New Roman",
        size: UFLA_RULES.typography.captionFontSizePt * 2,
        color: "000000",
      }),
    ],
  });
}

export function sourceParagraph(text: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { before: 60, after: 120, line: 240 },
    indent: { left: 454, right: 454 },
    children: [
      new TextRun({
        text: cleanMojibakeText(text),
        font: "Times New Roman",
        size: UFLA_RULES.typography.sourceFontSizePt * 2,
        color: "000000",
      }),
    ],
  });
}

export function longQuoteParagraph(text: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.BOTH,
    spacing: { line: UFLA_RULES.spacing.singleLineTwip, after: 120 },
    indent: { left: UFLA_RULES.typography.longQuoteLeftIndentTwip },
    children: textRunsFromMarkup(text, UFLA_RULES.typography.longQuoteFontSizePt * 2),
  });
}

export interface TabbedTableBlockParts {
  caption: string;
  rows: string[][];
  sourceLine?: string;
}

function isSourceLine(line: string): boolean {
  return /^Fonte:/i.test(line.trim());
}

function isMarkdownSeparator(line: string): boolean {
  return /^\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line.trim());
}

function markdownCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim())
    .filter(Boolean);
}

function tabbedCells(line: string, singleSpaceSplit = false): string[] {
  if (line.includes("\t")) return line.split("\t").map((cell) => cell.trim()).filter(Boolean);
  const doubleSpaced = line.split(/ {2,}/).map((cell) => cell.trim()).filter(Boolean);
  if (doubleSpaced.length > 1) return doubleSpaced;
  if (singleSpaceSplit) return line.split(/\s+/).map((cell) => cell.trim()).filter(Boolean);
  return doubleSpaced;
}

/** Checks if consecutive data lines (excluding source lines) all have the same word count. */
function hasConsistentWordCount(lines: string[]): boolean {
  const dataOnly = lines.filter((l) => !isSourceLine(l));
  if (dataOnly.length < 2) return false;
  const wc = dataOnly[0].split(/\s+/).length;
  if (wc < 2) return false;
  return dataOnly.slice(1).every((l) => l.split(/\s+/).length === wc);
}

export function detectTabbedTableBlock(text: string): TabbedTableBlockParts | null {
  const rawLines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (rawLines.length < 2) return null;

  const caption = rawLines[0];
  if (!/^(quadro|tabela)\s+\d+\s*[-:?]?/i.test(caption)) return null;

  const rows: string[][] = [];
  let sourceLine: string | undefined;
  const dataLines = rawLines.slice(1);
  const useSingleSpace = hasConsistentWordCount(dataLines);

  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i];
    if (isSourceLine(line)) {
      sourceLine = line;
      continue;
    }
    if (isMarkdownSeparator(line)) continue;

    const cells = line.includes("|") ? markdownCells(line) : tabbedCells(line, useSingleSpace);
    if (cells.length > 1) rows.push(cells);
  }

  if (rows.length === 0) return null;
  return { caption, rows, sourceLine };
}

export function tabbedTableBlock(
  text: string,
  options: {
    captionPrefix?: string;
    bodySize?: number;
    sourceSize?: number;
    font?: string;
    sourceFallback?: string;
  } = {},
): Array<Paragraph | Table> {
  const { captionPrefix = "", bodySize = 24, sourceSize = UFLA_RULES.typography.sourceFontSizePt * 2, font = "Times New Roman", sourceFallback } = options;
  const detected = detectTabbedTableBlock(text);
  if (!detected) return splitParagraphs(text).map((line) => simpleParagraph(line));

  const columnCount = Math.max(...detected.rows.map((row) => row.length), 1);
  const columnWidth = Math.max(1, Math.floor(100 / columnCount));

  const tableRows = detected.rows.map((cells, rowIndex) => {
    const padded = Array.from({ length: columnCount }, (_, i) => cells[i] ?? "");
    return new TableRow({
      children: padded.map((cellText) => new TableCell({
        width: { size: columnWidth, type: WidthType.PERCENTAGE },
        margins: { top: 40, bottom: 40, left: 80, right: 80 },
        children: [
          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { line: 240, after: 0 },
            children: [
              new TextRun({
                text: cleanMojibakeText(cellText),
                bold: rowIndex === 0,
                font,
                size: bodySize,
                color: "000000",
              }),
            ],
          }),
        ],
      })),
    });
  });

  const SOLID_BORDER = { style: BorderStyle.SINGLE, size: 4, color: "000000" };

  const result: Array<Paragraph | Table> = [
    captionParagraph(captionPrefix + detected.caption),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: SOLID_BORDER,
        bottom: SOLID_BORDER,
        left: SOLID_BORDER,
        right: SOLID_BORDER,
        insideHorizontal: SOLID_BORDER,
        insideVertical: SOLID_BORDER,
      },
      rows: tableRows,
    }),
  ];

  const sourceLine = detected.sourceLine ?? sourceFallback;
  if (sourceLine) {
    result.push(
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { before: 120, after: 120, line: 240 },
        children: [
          new TextRun({
            text: cleanMojibakeText(sourceLine),
            font,
            size: sourceSize,
            color: "000000",
          }),
        ],
      }),
    );
  }

  return result;
}
