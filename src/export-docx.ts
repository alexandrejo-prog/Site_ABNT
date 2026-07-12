import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Header,
  ImageRun,
  Packer,
  PageBreak,
  PageNumber,
  PageOrientation,
  Paragraph,
  Table,
  TableCell,
  TableOfContents,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import type { IParagraphOptions, IStylesOptions } from "docx";
import "./docx-toc-field-patch";
import { pageMargins, ibgeTable, BODY_SIZE, SINGLE_LINE, ONE_AND_HALF_LINE, BLACK, AUTHOR_SIZE as COVER_AUTHOR_SIZE, TITLE_SIZE as COVER_TITLE_SIZE } from "./docx-shared";
import { AcademicFields, UFLA_RULES } from "./ufla-rules";
import { getWorkTypeRequirements } from "./work-type-requirements";
import { normalizeReferences, type ReferenceRun } from "./references-normalizer";
import { buildFlowingImpactText } from "./impact-indicators";
import { normalizeForDetection } from "./word-structure-extractor";
import { captionParagraph, cleanMojibakeText, detectCaption, tabbedTableBlock } from "./docx-render-core";
import { ImportedDocumentImage, IMPORTED_IMAGE_MARKER_PATTERN } from "./imported-images";
import { ImportedTable, IMPORTED_TABLE_MARKER_PATTERN, buildStructuredTextFromTable } from "./imported-tables";

export type EditorBlockType =
  | "paragraph"
  | "heading1"
  | "heading2"
  | "heading3"
  | "longQuote"
  | "scheduleTable"
  | "markdownTable"
  | "plainScheduleTable"
  | "tabbedTable"
  | "importedImage"
  | "importedTable"
  | "reference";

export interface EditorBlock {
  type: EditorBlockType;
  text: string;
}

export interface DocxLogoAsset {
  data: ArrayBuffer | Uint8Array;
  width?: number;
  height?: number;
}

export interface DocxGenerationInput {
  fields: AcademicFields;
  editorText: string;
  logo?: DocxLogoAsset;
  importedImages?: ImportedDocumentImage[];
  importedTables?: ImportedTable[];
}

interface ScheduleRow {
  etapa: string;
  meses: string;
  periodo: string;
  atividades: string;
}

export const DEFAULT_UFLA_LOGO_PATH = "/assets/ufla-logo.jpeg";

const LONG_QUOTE_SIZE = UFLA_RULES.typography.longQuoteFontSizePt * 2;
const REFERENCE_FONT = "Times New Roman";
const REFERENCE_SIZE = 12 * 2;
const UFLA_LOGO_WIDTH_PX = 265;
const UFLA_LOGO_HEIGHT_PX = 108;

const DOCUMENT_STYLES: IStylesOptions = {
  paragraphStyles: [
    {
      id: "TOC1",
      name: "toc 1",
      basedOn: "Normal",
      next: "Normal",
      quickFormat: true,
      run: {
        font: "Times New Roman",
        size: 24,
        bold: true,
        color: BLACK,
      },
      paragraph: {
        spacing: { before: 0, after: 0 },
      },
    },
    {
      id: "TOC2",
      name: "toc 2",
      basedOn: "Normal",
      next: "Normal",
      quickFormat: true,
      run: {
        font: "Times New Roman",
        size: 24,
        bold: true,
        color: BLACK,
      },
      paragraph: {
        spacing: { before: 0, after: 0 },
      },
    },
    {
      id: "TOC3",
      name: "toc 3",
      basedOn: "Normal",
      next: "Normal",
      quickFormat: true,
      run: {
        font: "Times New Roman",
        size: 24,
        bold: false,
        color: BLACK,
      },
      paragraph: {
        spacing: { before: 0, after: 0 },
      },
    },
    {
      id: "Heading1",
      name: "Heading 1",
      basedOn: "Normal",
      next: "Normal",
      quickFormat: true,
      run: {
        font: "Times New Roman",
        size: 24,
        bold: true,
        color: BLACK,
      },
      paragraph: {
        spacing: { before: 0, after: 0 },
      },
    },
    {
      id: "Heading2",
      name: "Heading 2",
      basedOn: "Normal",
      next: "Normal",
      quickFormat: true,
      run: {
        font: "Times New Roman",
        size: 24,
        bold: true,
        color: BLACK,
      },
      paragraph: {
        spacing: { before: 0, after: 0 },
      },
    },
    {
      id: "Heading3",
      name: "Heading 3",
      basedOn: "Normal",
      next: "Normal",
      quickFormat: true,
      run: {
        font: "Times New Roman",
        size: 24,
        bold: false,
        color: BLACK,
      },
      paragraph: {
        spacing: { before: 0, after: 0 },
      },
    },
  ],
};

function headingTypeFromNumberedTitle(text: string, fallback: EditorBlockType): EditorBlockType {
  const normalized = text.trim();

  if (/^\d+(?:\.\d+){2,}(?:\s|$)/.test(normalized)) return "heading3";
  if (/^\d+\.\d+(?:\s|$)/.test(normalized)) return "heading2";
  if (/^\d+(?:\s|$)/.test(normalized)) return "heading1";

  return fallback;
}

function looksLikeScheduleRow(value: string): boolean {
  return /^[1-4][ºª]?\s+semestre\b/i.test(value.trim());
}

function shouldStartScheduleTable(value: string): boolean {
  return /^Quadro\s+\d+\s+-\s+Cronograma/i.test(value.trim());
}

function looksLikeMarkdownTableRow(value: string): boolean {
  const normalized = value.trim();
  if (!normalized.includes("|")) return false;
  const cells = normalized.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|");
  return cells.filter((cell) => cell.trim().length > 0).length >= 2;
}

function isMarkdownTableSeparator(value: string): boolean {
  return /^\s*\|?[\s:|-]+\|?\s*$/.test(value) && value.includes("-");
}

function shouldStartMarkdownTable(value: string): boolean {
  return looksLikeMarkdownTableRow(value) && !shouldStartScheduleTable(value);
}

function splitScheduleColumns(line: string): string[] {
  if (line.includes("\t")) return line.split("\t").map((cell) => cell.trim()).filter(Boolean);
  // Mantém "Mês N" como uma única coluna (evita quebra em espaço simples).
  const merged = line.replace(/\b(m[eê]s)\s+(\d+)/gi, "$1$2");
  const splitter = / {2,}/.test(line) ? / {2,}/ : /\s+/;
  return merged
    .split(splitter)
    .map((cell) => cell.replace(/\b(m[eê]s)(\d+)/gi, "$1 $2").trim())
    .filter(Boolean);
}

function isPlainScheduleHeader(value: string): boolean {
  const cells = splitScheduleColumns(value.trim());
  if (cells.length < 3) return false;
  const first = cells[0].toLocaleLowerCase("pt-BR");
  const monthColumns = cells.filter((cell) => /^m[eê]s\s*\d+/i.test(cell)).length;
  return /^etapa\b/i.test(first) && monthColumns >= 2;
}

function shouldStartPlainScheduleTable(value: string): boolean {
  return isPlainScheduleHeader(value);
}

function isMarkdownTableLine(value: string): boolean {
  return /^\|.+\|$/.test(value.trim());
}

function shouldStartTabbedTable(value: string, lines: string[], index: number): boolean {
  const trimmed = value.trim();
  if (!/^(quadro|tabela)\s+\d+/i.test(trimmed)) return false;
  const next = lines[index + 1]?.trim() ?? "";
  return next.includes("\t") || / {2,}/.test(next) || isMarkdownTableLine(next);
}

export function parseEditorContent(editorText: string): EditorBlock[] {
  const lines = editorText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const blocks: EditorBlock[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index];

    if (shouldStartMarkdownTable(trimmed)) {
      const tableLines = [trimmed];
      let cursor = index + 1;

      while (cursor < lines.length) {
        const nextLine = lines[cursor];
        if (!looksLikeMarkdownTableRow(nextLine) && !isMarkdownTableSeparator(nextLine)) break;
        tableLines.push(nextLine);
        cursor += 1;
      }

      blocks.push({ type: "markdownTable", text: tableLines.join("\n") });
      index = cursor - 1;
      continue;
    }

    if (shouldStartScheduleTable(trimmed)) {
      const tableLines = [trimmed];
      let cursor = index + 1;

      while (cursor < lines.length) {
        const nextLine = lines[cursor];
        if (/^Fonte:/i.test(nextLine)) break;
        if (/^5\.2\s+/i.test(nextLine)) break;
        if (/^#\s+/i.test(nextLine)) break;
        if (/^##\s+/i.test(nextLine)) break;
        if (/^\d+(?:\.\d+)*\s+/.test(nextLine.trim())) break;
        if (/^(REFERÊNCIAS|REFERENCIAS|APÊNDICE|APENDICE|ANEXO)\b/i.test(nextLine.trim())) break;
        tableLines.push(nextLine);
        cursor += 1;
      }

      blocks.push({ type: "scheduleTable", text: tableLines.join("\n") });
      index = cursor - 1;
      continue;
    }

    if (shouldStartPlainScheduleTable(trimmed)) {
      const tableLines: string[] = [trimmed];
      let cursor = index + 1;

      while (cursor < lines.length) {
        const nextLine = lines[cursor];
        if (!nextLine.trim()) break;
        if (/^Fonte:/i.test(nextLine)) break;
        if (/^#\s+/i.test(nextLine)) break;
        if (/^##\s+/i.test(nextLine)) break;
        if (/^\d+(?:\.\d+)*\s+/.test(nextLine.trim())) break;
        if (/^(REFERÊNCIAS|REFERENCIAS|APÊNDICE|APENDICE|ANEXO)\b/i.test(nextLine.trim())) break;
        tableLines.push(nextLine);
        cursor += 1;
      }

      blocks.push({ type: "plainScheduleTable", text: tableLines.join("\n") });
      index = cursor - 1;
      continue;
    }

    if (shouldStartTabbedTable(trimmed, lines, index)) {
      const tableLines = [trimmed];
      let cursor = index + 1;

      while (cursor < lines.length) {
        const nextLine = lines[cursor];
        if (/^Fonte:/i.test(nextLine)) {
          tableLines.push(nextLine);
          cursor += 1;
          break;
        }
        if (/^#\s+/i.test(nextLine)) break;
        if (/^##\s+/i.test(nextLine)) break;
        if (/^\d+(?:\.\d+)*\s+/.test(nextLine.trim())) break;
        if (/^(REFERÊNCIAS|REFERENCIAS|APÊNDICE|APENDICE|ANEXO)\b/i.test(nextLine.trim())) break;
        if (!nextLine.includes("\t") && !/ {2,}/.test(nextLine) && !isMarkdownTableLine(nextLine) && !isMarkdownTableSeparator(nextLine)) break;
        tableLines.push(nextLine);
        cursor += 1;
      }

      blocks.push({ type: "tabbedTable", text: tableLines.join("\n") });
      index = cursor - 1;
      continue;
    }

    if (trimmed.startsWith("### ")) {
      const text = trimmed.replace(/^###\s+/, "");
      blocks.push({ type: headingTypeFromNumberedTitle(text, "heading3"), text });
      continue;
    }

    if (trimmed.startsWith("## ")) {
      const text = trimmed.replace(/^##\s+/, "");
      blocks.push({ type: headingTypeFromNumberedTitle(text, "heading2"), text });
      continue;
    }

    if (trimmed.startsWith("# ")) {
      const text = trimmed.replace(/^#\s+/, "");
      blocks.push({ type: headingTypeFromNumberedTitle(text, "heading1"), text });
      continue;
    }

    if (trimmed.startsWith("> ")) {
      blocks.push({ type: "longQuote", text: trimmed.replace(/^>\s+/, "") });
      continue;
    }

    if (/^\[REF\]\s+/i.test(trimmed)) {
      blocks.push({ type: "reference", text: trimmed.replace(/^\[REF\]\s+/i, "") });
      continue;
    }

    const importedImageMatch = trimmed.match(IMPORTED_IMAGE_MARKER_PATTERN);
    if (importedImageMatch?.[1]) {
      blocks.push({ type: "importedImage", text: importedImageMatch[1] });
      continue;
    }

    const importedTableMatch = trimmed.match(IMPORTED_TABLE_MARKER_PATTERN);
    if (importedTableMatch?.[1]) {
      blocks.push({ type: "importedTable", text: importedTableMatch[1] });
      continue;
    }

    blocks.push({ type: "paragraph", text: trimmed });
  }

  return blocks;
}

function plainRun(text: string, size = BODY_SIZE): TextRun {
  return new TextRun({
    text,
    font: UFLA_RULES.typography.fontFamily,
    size,
    color: BLACK,
  });
}

function referenceRunToTextRun(run: ReferenceRun): TextRun {
  return new TextRun({
    text: cleanMojibakeText(run.text),
    bold: run.bold,
    italics: run.italics,
    font: REFERENCE_FONT,
    size: REFERENCE_SIZE,
    color: BLACK,
  });
}

function textRunsForSingleLine(text: string, size = BODY_SIZE): TextRun[] {
  const runs: TextRun[] = [];
  const tokenPattern = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(text)) !== null) {
    if (match.index > cursor) {
      runs.push(plainRun(text.slice(cursor, match.index), size));
    }

    const token = match[0];
    const bold = token.startsWith("**");
    const content = bold ? token.slice(2, -2) : token.slice(1, -1);
    runs.push(
      new TextRun({
        text: content,
        bold,
        italics: !bold,
        font: UFLA_RULES.typography.fontFamily,
        size,
        color: BLACK,
      }),
    );
    cursor = match.index + token.length;
  }

  if (cursor < text.length) {
    runs.push(plainRun(text.slice(cursor), size));
  }

  return runs.length ? runs : [plainRun("", size)];
}

function textRunsFromMarkup(text: string, size = BODY_SIZE): TextRun[] {
  return text.split(/\n/).flatMap((line, index) => {
    const runs = textRunsForSingleLine(line, size);
    if (index === 0) return runs;
    return [new TextRun({ break: 1 }), ...runs];
  });
}

function textParagraph(text: string, options: Partial<IParagraphOptions> = {}): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.BOTH,
    spacing: { line: ONE_AND_HALF_LINE, after: UFLA_RULES.spacing.afterParagraphTwip },
    indent: { firstLine: UFLA_RULES.typography.paragraphFirstLineTwip },
    children: textRunsFromMarkup(text || " "),
    ...options,
  });
}

function simpleParagraph(text: string, options: Partial<IParagraphOptions> = {}): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.BOTH,
    spacing: { line: SINGLE_LINE, after: UFLA_RULES.spacing.afterParagraphTwip },
    children: textRunsFromMarkup(text || " "),
    ...options,
  });
}

function centeredParagraph(
  text: string,
  bold = false,
  size = BODY_SIZE,
  spacing: NonNullable<IParagraphOptions["spacing"]> = { after: 240 },
): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing,
    children: [
      new TextRun({
        text,
        bold,
        font: UFLA_RULES.typography.fontFamily,
        size,
        color: BLACK,
      }),
    ],
  });
}

function logoParagraph(logo?: DocxLogoAsset): Paragraph[] {
  if (!logo) {
    return [
      centeredParagraph("UNIVERSIDADE FEDERAL DE LAVRAS", true, COVER_AUTHOR_SIZE, {
        after: 0,
        line: SINGLE_LINE,
      }),
    ];
  }

  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 0 },
      children: [
        new ImageRun({
          data: logo.data,
          transformation: {
            width: logo.width ?? UFLA_LOGO_WIDTH_PX,
            height: logo.height ?? UFLA_LOGO_HEIGHT_PX,
          },
          altText: {
            title: "Logo UFLA",
            description: "Universidade Federal de Lavras",
            name: "Logo UFLA",
          },
        }),
      ],
    }),
  ];
}

function sectionTitle(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.CENTER,
    spacing: { before: 240, after: 240, line: ONE_AND_HALF_LINE },
    children: [
      new TextRun({
        text: text.toUpperCase(),
        bold: true,
        font: UFLA_RULES.typography.fontFamily,
        size: BODY_SIZE,
        color: BLACK,
      }),
    ],
  });
}

function unnumberedTitle(text: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 240, after: 240, line: ONE_AND_HALF_LINE },
    children: [
      new TextRun({
        text: text.toUpperCase(),
        bold: true,
        font: UFLA_RULES.typography.fontFamily,
        size: BODY_SIZE,
        color: BLACK,
      }),
    ],
  });
}

function pageBreak(): Paragraph {
  return new Paragraph({ children: [new PageBreak()] });
}

function scheduleCaptionParagraph(text: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 120, after: 120, line: SINGLE_LINE },
    children: [
      new TextRun({
        text,
        font: UFLA_RULES.typography.fontFamily,
        size: BODY_SIZE,
        color: BLACK,
      }),
    ],
  });
}

function parseScheduleRow(line: string): ScheduleRow | null {
  const normalized = line.replace(/\s+/g, " ").trim();
  const match = normalized.match(
    /^(1º semestre|2º semestre|3º semestre|4º semestre)\s+(\d+\s+a\s+\d+)\s+(.+?\/\d{4}\s+a\s+.+?\/\d{4})(.*)$/i,
  );

  if (!match) return null;

  return {
    etapa: match[1],
    meses: match[2],
    periodo: match[3].trim(),
    atividades: match[4].trim(),
  };
}

function scheduleRowsFromBlock(text: string): { caption: string; rows: ScheduleRow[]; source: string } {
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const caption = lines[0] || "Quadro 1 - Cronograma de execução da pesquisa";
  const rows: ScheduleRow[] = [];
  let source = "Fonte: elaborado pelo autor (2026).";

  for (const line of lines.slice(1)) {
    if (/^Fonte:/i.test(line)) {
      source = line;
      continue;
    }

    if (/^Etapa\s+Meses\s+Per/i.test(line)) continue;

    if (looksLikeScheduleRow(line)) {
      const row = parseScheduleRow(line);
      if (row) rows.push(row);
      continue;
    }

    if (rows.length) {
      rows[rows.length - 1].atividades = `${rows[rows.length - 1].atividades} ${line}`.trim();
    }
  }

  return { caption, rows, source };
}

function markdownTableBlock(text: string): Array<Paragraph | Table> {
  const rawLines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const rows = rawLines
    .filter((line) => !isMarkdownTableSeparator(line))
    .map((line) =>
      line
        .replace(/^\s*\|/, "")
        .replace(/\|\s*$/, "")
        .split("|")
        .map((cell) => cell.trim()),
    )
    .filter((cells) => cells.length >= 2);

  if (!rows.length) return [simpleParagraph(text)];

  const columnCount = rows.reduce((max, cells) => Math.max(max, cells.length), 0);

  const tableRows = rows.map((cells, rowIndex) => {
    const tableCells = Array.from({ length: columnCount }, (_, columnIndex) => {
      const cellText = cells[columnIndex] ?? "";
      return new TableCell({
        margins: { top: 40, bottom: 40, left: 80, right: 80 },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { line: SINGLE_LINE, after: 0 },
            children: [
              new TextRun({
                text: cellText,
                bold: rowIndex === 0,
                font: UFLA_RULES.typography.fontFamily,
                size: BODY_SIZE,
                color: BLACK,
              }),
            ],
          }),
        ],
      });
    });

    return new TableRow({ children: tableCells });
  });

  return [
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      columnWidths: Array.from({ length: columnCount }, () => Math.floor(100 / columnCount)),
      rows: tableRows,
    }),
  ];
}

function plainScheduleTableBlock(text: string): Array<Paragraph | Table> {
  const rawLines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!rawLines.length) return [simpleParagraph(text)];

  // Colunas múltiplas só quando o bloco usa tab ou múltiplos espaços como separador.
  // Caso contrário (espaço simples), cada linha vira uma única célula (quadro de 1 coluna),
  // preservando o texto corrido original (ex.: "Importar documento X").
  const multiColumn = /[\t]| {2,}/.test(text);
  const toCells = (line: string): string[] => (multiColumn ? splitScheduleColumns(line) : [line]);

  const headerCells = toCells(rawLines[0]);
  const columnCount = Math.max(headerCells.length, 1);

  const tableRows = rawLines.map((line, rowIndex) => {
    const cells = toCells(line);
    const padded = Array.from({ length: columnCount }, (_, columnIndex) => cells[columnIndex] ?? "");
    const tableCells = padded.map((cellText) => {
      const cleaned = cleanMojibakeText(cellText);
      return new TableCell({
        margins: { top: 40, bottom: 40, left: 80, right: 80 },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { line: SINGLE_LINE, after: 0 },
            children: [
              new TextRun({
                text: cleaned,
                bold: rowIndex === 0,
                font: UFLA_RULES.typography.fontFamily,
                size: BODY_SIZE,
                color: BLACK,
              }),
            ],
          }),
        ],
      });
    });

    return new TableRow({ children: tableCells });
  });

  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 120, line: SINGLE_LINE },
      children: [
        new TextRun({ text: "Quadro - Cronograma de execução da pesquisa", font: UFLA_RULES.typography.fontFamily, size: BODY_SIZE, color: BLACK }),
      ],
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      columnWidths: Array.from({ length: columnCount }, () => Math.floor(100 / columnCount)),
      rows: tableRows,
    }),
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { before: 120, after: 120, line: SINGLE_LINE },
      children: [new TextRun({ text: "Fonte: elaborado pelo autor.", font: UFLA_RULES.typography.fontFamily, size: 20, color: BLACK })],
    }),
  ];
}

function scheduleTableBlock(text: string): Array<Paragraph | Table> {
  const { caption, rows, source } = scheduleRowsFromBlock(text);
  const ibge = ibgeTable({
    headerLabels: ["Etapa", "Meses", "Período", "Atividades principais"],
    columnWidths: [17, 13, 24, 46],
    rows: rows.map((row) => [row.etapa, row.meses, row.periodo, row.atividades]),
  });

  return [
    scheduleCaptionParagraph(caption),
    ibge,
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { before: 120, after: 120, line: SINGLE_LINE },
      children: [
        new TextRun({
          text: source,
          font: UFLA_RULES.typography.fontFamily,
          size: 20,
          color: BLACK,
        }),
      ],
    }),
  ];
}

function importedImageParagraph(image: ImportedDocumentImage | undefined): Paragraph[] {
  if (!image) return [];

  if (image.data?.byteLength) {
    return [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 120, after: 120, line: SINGLE_LINE },
        children: [
          new ImageRun({
            data: image.data,
            transformation: {
              width: image.width ?? 420,
              height: image.height ?? 260,
            },
            altText: {
              title: image.caption || image.fileName || image.id,
              description: image.source || "Imagem importada do DOCX original",
              name: image.fileName || image.id,
            },
          }),
        ],
      }),
    ];
  }

  return [
    simpleParagraph(
      `[IMAGEM DETECTADA] ${image.caption ? image.caption + ". " : ""}Reinsira manualmente esta imagem no documento final.`,
    ),
  ];
}

function normalizeConsecutiveRestarts(
  merges: ImportedTable["cellMerges"],
): ImportedTable["cellMerges"] {
  if (!merges?.length) return merges;

  const byColumn = new Map<number, Array<{ row: number; type: string }>>();
  for (const m of merges) {
    if (m.type !== "vMerge-restart") continue;
    const list = byColumn.get(m.col) || [];
    list.push({ row: m.row, type: m.type });
    byColumn.set(m.col, list);
  }

  const result = [...merges];
  for (const [col, restarts] of byColumn) {
    if (restarts.length <= 1) continue;
    restarts.sort((a, b) => a.row - b.row);
    for (let i = 1; i < restarts.length; i++) {
      const idx = result.findIndex((m) => m.row === restarts[i].row && m.col === col && m.type === "vMerge-restart");
      if (idx >= 0) {
        result[idx] = { ...result[idx], type: "vMerge-continue" };
      }
    }
  }

  return result;
}

function reconstructedColumnWidths(table: ImportedTable): number[] {
  const reconstructed = table.reconstructedTable;
  const count = reconstructed?.headers.length ?? 1;
  if (reconstructed?.pattern === "grouped-with-authors" || reconstructed?.pattern === "advantages-disadvantages" || reconstructed?.pattern === "critical-points" || reconstructed?.pattern === "generic-academic") {
    return count === 3 ? [20, 50, 30] : Array.from({ length: count }, () => Math.floor(100 / count));
  }
  if (reconstructed?.pattern === "chronological") {
    return count === 3 ? [15, 30, 55] : Array.from({ length: count }, () => Math.floor(100 / count));
  }
  return Array.from({ length: count }, () => Math.floor(100 / count));
}

function semanticReconstructedTableParagraph(table: ImportedTable): Array<Paragraph | Table> {
  const reconstructed = table.reconstructedTable;
  if (!reconstructed || !reconstructed.rows.length) return [];

  const widths = reconstructedColumnWidths(table);
  const result: Array<Paragraph | Table> = [];

  if (table.caption || reconstructed.caption) {
    result.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 120, after: 120, line: SINGLE_LINE },
        children: [
          new TextRun({
            text: cleanMojibakeText(table.caption || reconstructed.caption || ""),
            bold: true,
            font: "Times New Roman",
            size: BODY_SIZE,
            color: BLACK,
          }),
        ],
      }),
    );
  }

  const headerRow = new TableRow({
    children: reconstructed.headers.map((header, index) => new TableCell({
      width: { size: widths[index] ?? Math.floor(100 / reconstructed.headers.length), type: WidthType.PERCENTAGE },
      margins: { top: 40, bottom: 40, left: 80, right: 80 },
      children: [
        new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { line: SINGLE_LINE, after: 0 },
          children: [new TextRun({ text: cleanMojibakeText(header), bold: true, font: "Times New Roman", size: BODY_SIZE, color: BLACK })],
        }),
      ],
    })),
  });

  const bodyRows = reconstructed.rows.map((row, rowIndex) => {
    const cells = Array.from({ length: reconstructed.headers.length }, (_, index) => row.cells[index] ?? "");
    return new TableRow({
      children: cells.map((cellText, columnIndex) => {
        let displayText = cellText;
        if (columnIndex === 0 && rowIndex > 0 && cellText && reconstructed.rows[rowIndex - 1]?.cells[0] === cellText) {
          displayText = "";
        }
        return new TableCell({
          width: { size: widths[columnIndex] ?? Math.floor(100 / reconstructed.headers.length), type: WidthType.PERCENTAGE },
          margins: { top: 40, bottom: 40, left: 80, right: 80 },
          children: [
            new Paragraph({
              alignment: AlignmentType.LEFT,
              spacing: { line: SINGLE_LINE, after: 0 },
              children: [new TextRun({ text: cleanMojibakeText(displayText), font: "Times New Roman", size: BODY_SIZE, color: BLACK })],
            }),
          ],
        });
      }),
    });
  });

  result.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 4, color: BLACK },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: BLACK },
        left: { style: BorderStyle.SINGLE, size: 4, color: BLACK },
        right: { style: BorderStyle.SINGLE, size: 4, color: BLACK },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: BLACK },
        insideVertical: { style: BorderStyle.SINGLE, size: 4, color: BLACK },
      },
      rows: [headerRow, ...bodyRows],
    }),
  );

  if (table.source || reconstructed.source) {
    result.push(
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { before: 120, after: 120, line: SINGLE_LINE },
        children: [new TextRun({ text: cleanMojibakeText(table.source || reconstructed.source || ""), font: "Times New Roman", size: BODY_SIZE, color: BLACK })],
      }),
    );
  }

  const warning = reconstructed.warnings[0] || table.layoutWarning;
  if (warning) {
    result.push(
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { before: 120, after: 120, line: SINGLE_LINE },
        children: [new TextRun({ text: cleanMojibakeText(warning), italics: true, font: "Times New Roman", size: BODY_SIZE, color: BLACK })],
      }),
    );
  }

  return result;
}

function importedTableParagraph(table: ImportedTable | undefined): Array<Paragraph | Table> {
  if (!table || !table.rows.length) return [];

  if (table.renderMode === "semantic-reconstructed-table") {
    return semanticReconstructedTableParagraph(table);
  }

  if (table.status === "rendered-as-structured-text") {
    const result: Array<Paragraph | Table> = [];
    if (table.caption) {
      result.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 120, after: 120, line: SINGLE_LINE },
          children: [
            new TextRun({
              text: cleanMojibakeText(table.caption),
              bold: true,
              font: "Times New Roman",
              size: BODY_SIZE,
              color: BLACK,
            }),
          ],
        }),
      );
    }

    const structuredText = buildStructuredTextFromTable(table);
    for (const line of structuredText.split("\n")) {
      if (!line.trim()) continue;
      result.push(
        new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { line: SINGLE_LINE, after: 120 },
          children: [
            new TextRun({
              text: cleanMojibakeText(line),
              font: "Times New Roman",
              size: BODY_SIZE,
              color: BLACK,
            }),
          ],
        }),
      );
    }

    if (table.source) {
      result.push(
        new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { before: 120, after: 120, line: SINGLE_LINE },
          children: [
            new TextRun({
              text: cleanMojibakeText(table.source),
              font: "Times New Roman",
              size: BODY_SIZE,
              color: BLACK,
            }),
          ],
        }),
      );
    }

    if (table.layoutWarning) {
      result.push(
        new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { before: 120, after: 120, line: SINGLE_LINE },
          children: [
            new TextRun({
              text: cleanMojibakeText(table.layoutWarning),
              italics: true,
              font: "Times New Roman",
              size: BODY_SIZE,
              color: BLACK,
            }),
          ],
        }),
      );
    }

    return result;
  }

  const columnCount = Math.max(table.columnCount, 1);
  const widths = table.estimatedColumnWidths ?? Array.from({ length: columnCount }, () => Math.floor(100 / columnCount));
  const safeWidths = widths.map((w) => Math.max(5, w));
  const widthTotal = safeWidths.reduce((sum, w) => sum + w, 0);
  const normalizedWidths = safeWidths.map((w) => Math.round((w / widthTotal) * 100));

  const normalizedMerges = normalizeConsecutiveRestarts(table.cellMerges);

  const tableRows = table.rows.map((cells, rowIndex) => {
    const padded = Array.from({ length: columnCount }, (_, i) => (cells[i]?.text ?? "").trim());
    return new TableRow({
      children: padded.map((cellText, columnIndex) => {
        const originalMerge = normalizedMerges?.find(
          (m) => m.row === rowIndex && m.col === columnIndex,
        );
        let verticalMerge: "continue" | "restart" | undefined;
        if (originalMerge) {
          if (originalMerge.type === "vMerge-restart") verticalMerge = "restart";
          else if (originalMerge.type === "vMerge-continue") verticalMerge = "continue";
        } else if (
          table.groupColumnIndex === 0 &&
          columnIndex === 0 &&
          table.groupSpans &&
          table.hasReconstructedVerticalMerge
        ) {
          const inSpan = table.groupSpans.find((s) => rowIndex >= s.rowStart && rowIndex <= s.rowEnd);
          if (inSpan) {
            verticalMerge = rowIndex === inSpan.rowStart ? "restart" : "continue";
          }
        }

        return new TableCell({
          width: { size: normalizedWidths[columnIndex] ?? Math.floor(100 / columnCount), type: WidthType.PERCENTAGE },
          margins: { top: 40, bottom: 40, left: 80, right: 80 },
          ...(verticalMerge ? { verticalMerge } : {}),
          children: [
            new Paragraph({
              alignment: AlignmentType.LEFT,
              spacing: { line: SINGLE_LINE, after: 0 },
              children: [
                new TextRun({
                  text: cleanMojibakeText(cellText),
                  bold: rowIndex === 0,
                  font: "Times New Roman",
                  size: BODY_SIZE,
                  color: BLACK,
                }),
              ],
            }),
          ],
        });
      }),
    });
  });

  const result: Array<Paragraph | Table> = [];
  if (table.caption) {
    result.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 120, after: 120, line: SINGLE_LINE },
        children: [
          new TextRun({
            text: cleanMojibakeText(table.caption),
            bold: true,
            font: "Times New Roman",
            size: BODY_SIZE,
            color: BLACK,
          }),
        ],
      }),
    );
  }

  result.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 4, color: BLACK },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: BLACK },
        left: { style: BorderStyle.SINGLE, size: 4, color: BLACK },
        right: { style: BorderStyle.SINGLE, size: 4, color: BLACK },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: BLACK },
        insideVertical: { style: BorderStyle.SINGLE, size: 4, color: BLACK },
      },
      rows: tableRows,
    }),
  );

  if (table.source) {
    result.push(
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { before: 120, after: 120, line: SINGLE_LINE },
        children: [
          new TextRun({
            text: cleanMojibakeText(table.source),
            font: "Times New Roman",
            size: BODY_SIZE,
            color: BLACK,
          }),
        ],
      }),
    );
  }

  return result;
}

function blockToParagraph(
  block: EditorBlock,
  isFirstTextualBlock: boolean = false,
  importedImages: ImportedDocumentImage[] = [],
  importedTables: ImportedTable[] = [],
): Array<Paragraph | Table> {
  if (block.type === "heading1") {
    const title = new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 0, after: 240, line: ONE_AND_HALF_LINE },
      children: [
        new TextRun({
          text: block.text.toUpperCase(),
          bold: true,
          font: UFLA_RULES.typography.fontFamily,
          size: BODY_SIZE,
          color: BLACK,
        }),
      ],
    });

    return isFirstTextualBlock ? [title] : [pageBreak(), title];
  }

  if (block.type === "heading2") {
    return [
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 240, after: 240, line: ONE_AND_HALF_LINE },
        children: [
          new TextRun({
            text: block.text,
            bold: true,
            font: UFLA_RULES.typography.fontFamily,
            size: BODY_SIZE,
            color: BLACK,
          }),
        ],
      }),
    ];
  }

  if (block.type === "heading3") {
    return [
      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 240, after: 240, line: ONE_AND_HALF_LINE },
        children: [
          new TextRun({
            text: block.text,
            bold: false,
            font: UFLA_RULES.typography.fontFamily,
            size: BODY_SIZE,
            color: BLACK,
          }),
        ],
      }),
    ];
  }

  if (block.type === "longQuote") {
    return [
      new Paragraph({
        alignment: AlignmentType.BOTH,
        spacing: { line: SINGLE_LINE, after: 120 },
        indent: { left: UFLA_RULES.typography.longQuoteLeftIndentTwip },
        children: textRunsFromMarkup(block.text, LONG_QUOTE_SIZE),
      }),
    ];
  }

  if (block.type === "scheduleTable") {
    return scheduleTableBlock(block.text);
  }

  if (block.type === "plainScheduleTable") {
    return plainScheduleTableBlock(block.text);
  }

  if (block.type === "markdownTable") {
    return markdownTableBlock(block.text);
  }

  if (block.type === "tabbedTable") {
    return tabbedTableBlock(block.text);
  }

  if (block.type === "importedImage") {
    return importedImageParagraph(importedImages.find((image) => image.id === block.text));
  }

  if (block.type === "importedTable") {
    const table = importedTables.find((item) => item.id === block.text);
    return importedTableParagraph(table);
  }

  const cleanedText = cleanMojibakeText(block.text);
  const caption = detectCaption(cleanedText);
  if (caption) {
    return [captionParagraph(cleanedText, caption.kind)];
  }

  return [textParagraph(cleanedText)];
}

function splitParagraphs(value: string): string[] {
  return value
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function buildSimpleParagraphs(value: string): Paragraph[] {
  return splitParagraphs(value).map((line) => simpleParagraph(line));
}

interface SummaryEntry {
  text: string;
  level: 1 | 2 | 3;
}

function summaryLevelForBlock(block: EditorBlock): SummaryEntry["level"] | null {
  if (block.type === "heading1") return 1;
  if (block.type === "heading2") return 2;
  if (block.type === "heading3") return 3;
  return null;
}

function summaryEntryParagraph(entry: SummaryEntry): Paragraph {
  return new Paragraph({
    style: `TOC${entry.level}`,
    spacing: { before: 0, after: 0, line: SINGLE_LINE },
    indent: { left: (entry.level - 1) * 360 },
    children: [
      new TextRun({
        text: cleanMojibakeText(entry.text),
        font: UFLA_RULES.typography.fontFamily,
        size: BODY_SIZE,
        color: BLACK,
        bold: entry.level < 3,
      }),
    ],
  });
}

function addSummaryEntry(entries: SummaryEntry[], seen: Set<string>, text: string, level: SummaryEntry["level"]): void {
  const cleaned = cleanMojibakeText(text).trim();
  const key = normalizeForDetection(cleaned);
  if (!cleaned || key === "SUMARIO" || seen.has(key)) return;
  seen.add(key);
  entries.push({ text: cleaned, level });
}

function collectSummaryEntries(bodyBlocks: EditorBlock[], references: string[], fields: AcademicFields): SummaryEntry[] {
  const entries: SummaryEntry[] = [];
  const seen = new Set<string>();

  for (const block of bodyBlocks) {
    const level = summaryLevelForBlock(block);
    if (level) addSummaryEntry(entries, seen, level === 1 ? block.text.toUpperCase() : block.text, level);
  }

  if (references.length > 0) addSummaryEntry(entries, seen, "REFERÊNCIAS", 1);
  if (fields.anexos) addSummaryEntry(entries, seen, "ANEXOS", 1);
  if (fields.apendices) addSummaryEntry(entries, seen, appendixTitle(fields), 1);

  return entries;
}

function buildReferences(references: string[]): Paragraph[] {
  return normalizeReferences(references)
    .sort((a, b) => a.text.localeCompare(b.text, "pt-BR", { sensitivity: "base" }))
    .map(
      (reference) =>
        new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { line: SINGLE_LINE, after: SINGLE_LINE },
          indent: { firstLine: 0, left: 0 },
          children: reference.runs.length
            ? reference.runs.map(referenceRunToTextRun)
            : [referenceRunToTextRun({ text: reference.text || " " })],
        }),
    );
}

function hasEditorHeading(blocks: EditorBlock[], heading: string): boolean {
  const target = normalizeForDetection(heading);
  return blocks.some(
    (block) =>
      (block.type === "heading1" || block.type === "heading2") &&
      normalizeForDetection(block.text).includes(target),
  );
}

function normalizedHeadingBase(text: string): string {
  return normalizeForDetection(text).replace(/^\d+(?:\.\d+)*\s*/, "");
}

function isConclusionEquivalentHeading(text: string): boolean {
  return ["CONCLUSAO", "CONSIDERACOES FINAIS"].includes(normalizedHeadingBase(text));
}

function hasEditorConclusionHeading(blocks: EditorBlock[]): boolean {
  return blocks.some(
    (block) =>
      (block.type === "heading1" || block.type === "heading2") &&
      isConclusionEquivalentHeading(block.text),
  );
}

function usesFinalConsiderationsHeading(blocks: EditorBlock[]): boolean {
  return blocks.some(
    (block) =>
      (block.type === "heading1" || block.type === "heading2") &&
      normalizedHeadingBase(block.text) === "CONSIDERACOES FINAIS",
  );
}

function fieldSectionBlocks(fields: AcademicFields, bodyBlocks: EditorBlock[]): EditorBlock[] {
  const nextBlocks = [...bodyBlocks];

  if (fields.introducao && !hasEditorHeading(nextBlocks, "INTRODUCAO")) {
    nextBlocks.unshift(
      { type: "heading1", text: "1 INTRODUÇÃO" },
      ...splitParagraphs(fields.introducao).map((text) => ({ type: "paragraph" as const, text })),
    );
  }

  if (fields.conclusao && !hasEditorConclusionHeading(nextBlocks)) {
    nextBlocks.push(
      {
        type: "heading1",
        text: usesFinalConsiderationsHeading(nextBlocks) ? "5 CONSIDERAÇÕES FINAIS" : "5 CONCLUSÃO",
      },
      ...splitParagraphs(fields.conclusao).map((text) => ({ type: "paragraph" as const, text })),
    );
  }

  return nextBlocks;
}

function isImpactIndicatorsHeading(block: EditorBlock): boolean {
  if (block.type !== "heading1" && block.type !== "heading2") return false;
  return normalizeForDetection(block.text).includes("INDICADORES DE IMPACTO");
}

// Tese/dissertação já geram os indicadores como bloco pré-textual (parágrafo único).
// Para não duplicar em lista no corpo textual, removemos a seção "INDICADORES DE IMPACTO"
// importada/escrita no editor quando o bloco pré-textual é gerado.
function renumberBodySections(blocks: EditorBlock[], removedImpactNumber?: number): EditorBlock[] {
  if (!removedImpactNumber) return blocks;

  return blocks.map((block) => {
    if (block.type === "heading1") {
      const match = block.text.match(/^(\d+)\s+(.*)$/);
      if (match && Number(match[1]) > removedImpactNumber) {
        return { ...block, text: `${Number(match[1]) - 1} ${match[2]}` };
      }
    }
    if (block.type === "heading2") {
      const match = block.text.match(/^(\d+)\.(\d+)\s+(.*)$/);
      if (match && Number(match[1]) > removedImpactNumber) {
        return { ...block, text: `${Number(match[1]) - 1}.${match[2]} ${match[3]}` };
      }
    }
    return block;
  });
}

function removeDuplicateIndicatorsSection(blocks: EditorBlock[], fields: AcademicFields): { blocks: EditorBlock[]; removedImpactNumber?: number } {
  const isGraduateThesis = fields.workType === "dissertacao" || fields.workType === "tese";
  const hasPreTextualIndicators =
    isGraduateThesis || hasText(fields.indicadoresImpacto) || hasText(fields.impactoSocial) || hasText(fields.impactoCientifico);
  if (!hasPreTextualIndicators) return { blocks };

  const result: EditorBlock[] = [];
  let skipping = false;
  let removedImpactNumber: number | undefined;
  for (const block of blocks) {
    if (isImpactIndicatorsHeading(block)) {
      const match = block.text.match(/^(\d+)\s+/);
      if (match) removedImpactNumber = Number(match[1]);
      skipping = true;
      continue;
    }
    if (skipping) {
      const isNextHeading = block.type === "heading1" || block.type === "heading2";
      if (isNextHeading) skipping = false;
      else continue;
    }
    result.push(block);
  }
  return { blocks: result, removedImpactNumber };
}

function appendixTitle(fields: AcademicFields): string {
  const normalized = normalizeForDetection(fields.apendices);
  if (normalized.includes("ROTEIRO") && normalized.includes("ENTREVISTA")) {
    return "APÊNDICE A - ROTEIRO PRELIMINAR DE ENTREVISTA";
  }
  return "APÊNDICE A";
}

function buildSummary(
  bodyBlocks: EditorBlock[],
  references: string[],
  fields: AcademicFields,
  textualStartPage: number,
): Array<Paragraph | TableOfContents> {
  void textualStartPage;

  const entries = collectSummaryEntries(bodyBlocks, references, fields);
  if (!entries.length) return [];

  const isGraduateThesis = fields.workType === "dissertacao" || fields.workType === "tese";

  if (isGraduateThesis) {
    return [
      pageBreak(),
      unnumberedTitle("Sumário"),
      new TableOfContents("", {
        headingStyleRange: "1-3",
        hyperlink: true,
        hideTabAndPageNumbersInWebView: true,
        useAppliedParagraphOutlineLevel: true,
      }),
    ];
  }

  return [
    pageBreak(),
    unnumberedTitle("Sumário"),
    ...entries.map(summaryEntryParagraph),
  ];
}

function hasText(value: string): boolean {
  return value.trim().length > 0;
}

export function ensureTrailingPeriod(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.endsWith(".")) return trimmed;
  return `${trimmed.replace(/[;\s]+$/, "")}.`;
}

function hasApprovalPage(fields: AcademicFields): boolean {
  return fields.workType === "monografia" || fields.workType === "dissertacao" || fields.workType === "tese";
}

export function calculateTextualStartPage(
  fields: AcademicFields,
  hasSummary: boolean,
): number {
  const impactRequired = fields.workType === "dissertacao" || fields.workType === "tese";
  let countedPreTextualPages = 1; // Folha de rosto. Capa e ficha catalográfica não contam.

  if (hasApprovalPage(fields)) countedPreTextualPages += 1;
  if (hasText(fields.dedicatoria)) countedPreTextualPages += 1;
  if (hasText(fields.agradecimentos)) countedPreTextualPages += 1;
  if (hasText(fields.epigrafe)) countedPreTextualPages += 1;

  countedPreTextualPages += 1; // Resumo gerado pelo exportador.
  countedPreTextualPages += 1; // Abstract gerado pelo exportador.

  if (hasText(fields.indicadoresImpacto) || impactRequired) countedPreTextualPages += 1;
  if (hasText(fields.impactIndicators) || impactRequired) countedPreTextualPages += 1;
  if (hasSummary) countedPreTextualPages += 1;

  return countedPreTextualPages + 1;
}

function natureParagraph(text: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.BOTH,
    indent: { left: UFLA_RULES.typography.longQuoteLeftIndentTwip },
    spacing: { line: SINGLE_LINE, after: 180 },
    children: textRunsFromMarkup(text || " "),
  });
}

function normalizeNatureForWorkType(nature: string, fields: AcademicFields): string {
  const provided = cleanMojibakeText(nature).trim();
  if (!provided || isInternalWorkNature(provided)) {
    return fallbackWorkNature(fields);
  }
  return provided;
}

function coverChildren(fields: AcademicFields, logo?: DocxLogoAsset): Paragraph[] {
  return [
    ...logoParagraph(logo),
    new Paragraph({ spacing: { before: 1100 } }),
    centeredParagraph(cleanMojibakeText((fields.author || "AUTOR").toUpperCase()), true, COVER_AUTHOR_SIZE, {
      after: 0,
      line: SINGLE_LINE,
    }),
    new Paragraph({ spacing: { before: 1700 } }),
    centeredParagraph(cleanMojibakeText((fields.title || "TÍTULO DO TRABALHO").toUpperCase()), true, COVER_TITLE_SIZE, {
      after: 0,
      line: ONE_AND_HALF_LINE,
    }),
    ...(fields.subtitle
      ? [
          centeredParagraph(cleanMojibakeText(fields.subtitle.toUpperCase()), false, COVER_TITLE_SIZE, {
            after: 0,
            line: ONE_AND_HALF_LINE,
          }),
        ]
      : []),
    new Paragraph({ spacing: { before: 2200 } }),
    centeredParagraph(cleanMojibakeText((fields.location || "LAVRAS - MG").toUpperCase()), true, COVER_AUTHOR_SIZE, {
      after: 120,
      line: SINGLE_LINE,
    }),
    centeredParagraph(cleanMojibakeText(fields.year || new Date().getFullYear().toString()), true, COVER_AUTHOR_SIZE, {
      after: 0,
      line: SINGLE_LINE,
    }),
  ];
}

function buildTitlePageSupplementalLines(fields: AcademicFields, nature: string): string[] {
  const normalizedNature = normalizeForDetection(nature);
  const isGraduateThesis = fields.workType === "dissertacao" || fields.workType === "tese";

  return [
    !isGraduateThesis && fields.course && !normalizedNature.includes("CURSO")
      ? cleanMojibakeText(`Curso: ${fields.course}`)
      : "",
    fields.program && !normalizedNature.includes("PROGRAMA") ? cleanMojibakeText(`Programa: ${fields.program}`) : "",
    fields.advisor && !normalizedNature.includes("ORIENTADOR") ? cleanMojibakeText(`Orientador(a): ${fields.advisor}`) : "",
    fields.coadvisor && !normalizedNature.includes("COORIENTADOR")
      ? cleanMojibakeText(`Coorientador(a): ${fields.coadvisor}`)
      : "",
  ].filter(Boolean);
}

function isInternalWorkNature(value: string): boolean {
  const normalized = normalizeForDetection(cleanMojibakeText(value));
  return (
    normalized.includes("COLECAO PRODUCAO ACADEMICA") ||
    normalized.includes("SUPORTE INICIAL NO SISTEMA") ||
    normalized.includes("SOFTWARE E APLICATIVOS UFLA")
  );
}

function stripTrailingAdvisorLocationYear(value: string): string {
  const cleaned = cleanMojibakeText(value).trim();
  if (!cleaned) return cleaned;

  const normalized = normalizeForDetection(cleaned);
  const advisorPatterns = [
    /prof\.?\s*dr\.?\s+[a-zà-úç\s]+orientador(?:a)?(?:\s*uf)?(?:\s*-?\s*ufla)?/i,
    /dra\.?\s+[a-zà-úç\s]+uf(?:c?g|mg)/i,
    /dr\.?\s+[a-zà-úç\s]+uf(?:c?g|mg)/i,
    /orientador(?:a)?\s*[:\-]?\s*[a-zà-úç\s]+/i,
    /lavras\s*-\s*mg\s*\d{4}/i,
    /\b(?:19|20)\d{2}\b/,
  ];

  let earliestMatch: number | undefined;
  for (const pattern of advisorPatterns) {
    const match = normalized.match(pattern);
    if (match && match.index !== undefined) {
      const startIndex = cleaned.slice(0, match.index).trim().length;
      if (earliestMatch === undefined || startIndex < earliestMatch) {
        earliestMatch = startIndex;
      }
    }
  }

  if (earliestMatch !== undefined && earliestMatch > 20) {
    return cleaned.slice(0, earliestMatch).trim();
  }

  return cleaned;
}

function fallbackWorkNature(fields: AcademicFields): string {
  if (fields.workType === "projeto_pesquisa") {
    return "Projeto de pesquisa apresentado à Universidade Federal de Lavras como parte dos requisitos acadêmicos aplicáveis.";
  }
  return "Trabalho acadêmico apresentado à Universidade Federal de Lavras como parte dos requisitos acadêmicos aplicáveis.";
}

function workNature(fields: AcademicFields): string {
  const providedNature = cleanMojibakeText(fields.workNature).trim();
  const safeNature = providedNature && !isInternalWorkNature(providedNature) ? providedNature : fallbackWorkNature(fields);
  const cleaned = stripTrailingAdvisorLocationYear(safeNature);

  return cleanMojibakeText(normalizeNatureForWorkType(cleaned || safeNature, fields));
}

function titlePageChildren(fields: AcademicFields): Paragraph[] {
  const nature = workNature(fields);
  const supplementalLines = buildTitlePageSupplementalLines(fields, nature);

  return [
    centeredParagraph(cleanMojibakeText((fields.author || "AUTOR").toUpperCase()), true, BODY_SIZE, {
      after: 0,
      line: SINGLE_LINE,
    }),
    new Paragraph({ spacing: { before: 1500 } }),
    centeredParagraph(cleanMojibakeText((fields.title || "TÍTULO DO TRABALHO").toUpperCase()), true, BODY_SIZE, {
      after: 0,
      line: ONE_AND_HALF_LINE,
    }),
    ...(fields.subtitle
      ? [
          centeredParagraph(cleanMojibakeText(fields.subtitle.toUpperCase()), false, BODY_SIZE, {
            after: 0,
            line: ONE_AND_HALF_LINE,
          }),
        ]
      : []),
    new Paragraph({ spacing: { before: 900 } }),
    natureParagraph(cleanMojibakeText(nature)),
    ...supplementalLines.map((line) =>
      centeredParagraph(cleanMojibakeText(line), false, BODY_SIZE, { after: 0, line: SINGLE_LINE }),
    ),
    new Paragraph({ spacing: { before: 1500 } }),
    centeredParagraph(cleanMojibakeText((fields.location || "LAVRAS - MG").toUpperCase()), false, BODY_SIZE, {
      after: 120,
      line: SINGLE_LINE,
    }),
    centeredParagraph(cleanMojibakeText(fields.year || new Date().getFullYear().toString()), false, BODY_SIZE, {
      after: 0,
      line: SINGLE_LINE,
    }),
  ];
}

function formatApprovalDate(value: string): string {
  const cleaned = cleanMojibakeText(value).trim();
  if (!cleaned) return "";
  return cleaned.replace(/^Aprovad[ao]\s+em\s*/i, "").replace(/\.$/, "").trim();
}

function splitApprovalMembers(members: string[]): string[] {
  const split: string[] = [];
  for (const member of members) {
    const cleaned = cleanMojibakeText(member).trim();
    if (!cleaned) continue;
    const parts = extractMembersFromString(cleaned);
    if (parts.length > 0) {
      split.push(...parts);
    } else {
      split.push(cleaned);
    }
  }
  return mergeLooseApprovalTitles(split);
}

function isLooseApprovalTitle(value: string): boolean {
  return /^(Prof|Profa|Dr|Dra)\.$/i.test(cleanMojibakeText(value).trim());
}

function mergeLooseApprovalTitles(members: string[]): string[] {
  const merged: string[] = [];

  for (let index = 0; index < members.length; index += 1) {
    const current = cleanMojibakeText(members[index]).trim();
    const next = cleanMojibakeText(members[index + 1] ?? "").trim();

    if (isLooseApprovalTitle(current) && next) {
      merged.push(`${current} ${next}`.trim());
      index += 1;
      continue;
    }

    if (current) merged.push(current);
  }

  return merged.filter((member) => !isLooseApprovalTitle(member));
}

function extractMembersFromString(text: string): string[] {
  const results: string[] = [];
  const titleRegex = /((?:Prof|Dra|Dr)\.(?:\s+(?:Prof|Dra|Dr)\.)?)/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let currentTitle = "";

  while ((match = titleRegex.exec(text)) !== null) {
    if (currentTitle && match.index > lastIndex) {
      const name = text.slice(lastIndex, match.index).trim();
      results.push(`${currentTitle}${name ? " " + name : ""}`.trim());
    }
    currentTitle = match[1].trim();
    lastIndex = match.index + match[0].length;
  }

  if (currentTitle || lastIndex < text.length) {
    const name = text.slice(lastIndex).trim();
    results.push(`${currentTitle}${name ? " " + name : ""}`.trim());
  }

  return results.filter(Boolean);
}

function normalizeApprovalMember(member: string): string {
  const cleaned = cleanMojibakeText(member).trim();
  if (!cleaned) return "";

  const titleMatch = cleaned.match(/^(Prof\.|Dra\.|Dr\.)(?:\s+(Prof\.|Dra\.|Dr\.))?\s*/i);
  const titles = titleMatch ? titleMatch[0].trim() : "";
  const rest = titleMatch ? cleaned.slice(titleMatch[0].length).trim() : cleaned;

  const institutionMatch = rest.match(/\b(UFCG|UFMG|UFLA|UTFPR|UNESP|USP|UFRJ|UFRGS|UFSC|UFPE|UFPEL|UFPB|UFBA|UFC|UFMA|UFPA|UFRR|UFRN|UFAL|UFES|UFG|UFMT|UFRR|UnB|UTF|UNIFESP|FIOCRUZ|EMBRAPA|CNPEN|Instituto|Universidade|Centro|Faculdade|Escola)\b.*$/i);
  const institution = institutionMatch ? institutionMatch[0].trim() : "";

  let name = rest;
  let role = "";
  if (institution) {
    name = rest.slice(0, institutionMatch!.index).trim();
    role = institution;
  } else if (/\bOrientador(a)?\b/i.test(rest)) {
    role = rest.match(/\bOrientador(a)?\b/i)?.[0] ?? "";
    name = rest.replace(new RegExp(`\\s*${role}\\s*`, "i"), "").trim();
  }

  if (role) {
    return `${titles}${name ? " " + name : ""} — ${role}`;
  }
  return `${titles}${name ? " " + name : ""}`;
}

function approvalPageChildren(fields: AcademicFields): Paragraph[] {
  if (!hasApprovalPage(fields)) return [];

  const orientationLines = fields.advisor
    ? [
        centeredParagraph(cleanMojibakeText(fields.advisor), false, BODY_SIZE, { after: 0, line: SINGLE_LINE }),
        centeredParagraph("Orientador(a) - UFLA", false, BODY_SIZE, { after: 360, line: SINGLE_LINE }),
      ]
    : [];

  const formattedDate = formatApprovalDate(fields.aprovalDate || "");
  const bancaLines: Paragraph[] = [
    new Paragraph({ spacing: { before: 360, after: 240, line: SINGLE_LINE } }),
    ...(formattedDate
      ? [
          centeredParagraph(
            cleanMojibakeText(`APROVADO EM: ${formattedDate}.`),
            false,
            BODY_SIZE,
            { after: 240, line: SINGLE_LINE },
          ),
        ]
      : [
          centeredParagraph(
            "APROVADO EM: ____ de ____________________ de ______.",
            false,
            BODY_SIZE,
            { after: 240, line: SINGLE_LINE },
          ),
        ]),
    ...(fields.approvalMembers?.length
      ? splitApprovalMembers(fields.approvalMembers).map((member) =>
          centeredParagraph(cleanMojibakeText(normalizeApprovalMember(member)), false, BODY_SIZE, { after: 120, line: SINGLE_LINE }),
        )
      : [
          centeredParagraph("Prof.(a) Dr.(a) ______________________________", false, BODY_SIZE, {
            after: 0,
            line: SINGLE_LINE,
          }),
          centeredParagraph("Instituição: ________________________________", false, BODY_SIZE, {
            after: 240,
            line: SINGLE_LINE,
          }),
        ]),
  ];

  return [
    pageBreak(),
    centeredParagraph(cleanMojibakeText((fields.author || "AUTOR").toUpperCase()), true, BODY_SIZE, {
      after: 0,
      line: SINGLE_LINE,
    }),
    new Paragraph({ spacing: { before: 900 } }),
    centeredParagraph(cleanMojibakeText((fields.title || "TÍTULO DO TRABALHO").toUpperCase()), true, BODY_SIZE, {
      after: 600,
      line: ONE_AND_HALF_LINE,
    }),
    natureParagraph(cleanMojibakeText(workNature(fields))),
    ...orientationLines,
    ...bancaLines,
  ];
}

function optionalPage(title: string, content: string): Paragraph[] {
  if (!content.trim()) return [];
  return [pageBreak(), unnumberedTitle(title), ...buildSimpleParagraphs(content)];
}

function optionalUntitledRightPage(content: string, italics = false): Paragraph[] {
  if (!content.trim()) return [];
  return [
    pageBreak(),
    new Paragraph({ spacing: { before: 4200 } }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      indent: { left: UFLA_RULES.typography.longQuoteLeftIndentTwip },
      spacing: { line: SINGLE_LINE, after: 0 },
      children: [
        new TextRun({
          text: content,
          italics,
          font: UFLA_RULES.typography.fontFamily,
          size: BODY_SIZE,
          color: BLACK,
        }),
      ],
    }),
  ];
}

function preTextualChildren(fields: AcademicFields): Paragraph[] {
  const requirements = getWorkTypeRequirements(fields.workType);
  const consolidated = buildFlowingImpactText(fields);
  const indicadores = consolidated;
  const impactIndicators = cleanMojibakeText(fields.impactIndicators?.trim() || "");

  const children: Paragraph[] = [];

  if (requirements.requiresCatalogCard) {
    children.push(
      pageBreak(),
      unnumberedTitle("Ficha catalográfica"),
      simpleParagraph(
        cleanMojibakeText(
          "Ficha catalográfica detectada no arquivo importado. Preserve ou substitua manualmente pela ficha oficial da Biblioteca Universitária da UFLA.",
        ),
      ),
    );
  }

  children.push(
    ...approvalPageChildren(fields),
    ...optionalUntitledRightPage(cleanMojibakeText(fields.dedicatoria)),
    ...optionalPage("Agradecimentos", cleanMojibakeText(fields.agradecimentos)),
    ...optionalUntitledRightPage(cleanMojibakeText(fields.epigrafe), true),
    pageBreak(),
    unnumberedTitle("Resumo"),
    simpleParagraph(cleanMojibakeText(fields.resumo || " ")),
    ...(fields.palavrasChave
      ? [simpleParagraph(cleanMojibakeText(`Palavras-chave: ${ensureTrailingPeriod(fields.palavrasChave)}`))]
      : []),
    pageBreak(),
    unnumberedTitle("Abstract"),
    simpleParagraph(cleanMojibakeText(fields.abstractText || " ")),
    ...(fields.keywords
      ? [simpleParagraph(cleanMojibakeText(`Keywords: ${ensureTrailingPeriod(fields.keywords)}`))]
      : []),
    ...optionalPage("Indicadores de impacto", cleanMojibakeText(indicadores)),
    ...optionalPage("Impact indicators", impactIndicators),
  );

  if (
    hasText(fields.listaQuadros) ||
    hasText(fields.listaGraficos) ||
    hasText(fields.listaTabelas) ||
    hasText(fields.listaSiglas)
  ) {
    children.push(pageBreak());
  }

  if (hasText(fields.listaQuadros)) {
    children.push(...optionalPage("Lista de quadros", cleanMojibakeText(fields.listaQuadros)));
  }
  if (hasText(fields.listaGraficos)) {
    children.push(...optionalPage("Lista de gráficos", cleanMojibakeText(fields.listaGraficos)));
  }
  if (hasText(fields.listaTabelas)) {
    children.push(...optionalPage("Lista de tabelas", cleanMojibakeText(fields.listaTabelas)));
  }
  if (hasText(fields.listaSiglas)) {
    children.push(...optionalPage("Lista de siglas", cleanMojibakeText(fields.listaSiglas)));
  }

  return children;
}

export function createDocxDocument(input: DocxGenerationInput): Document {
  const { fields } = input;
  const parsedBlocks = parseEditorContent(input.editorText);
  const { blocks: dedupedBlocks, removedImpactNumber } = removeDuplicateIndicatorsSection(
    fieldSectionBlocks(
      fields,
      parsedBlocks.filter((block) => block.type !== "reference"),
    ),
    fields,
  );
  const isGraduateThesis = fields.workType === "dissertacao" || fields.workType === "tese";
  const bodyBlocks = renumberBodySections(
    dedupedBlocks,
    isGraduateThesis ? removedImpactNumber : undefined,
  );
  const editorReferences = parsedBlocks
    .filter((block) => block.type === "reference")
    .map((block) => block.text);
  const references = [...splitParagraphs(fields.referencias), ...editorReferences];
  const hasSummary =
    bodyBlocks.some(
      (block) =>
        block.type === "heading1" || block.type === "heading2" || block.type === "heading3",
    ) ||
    references.length > 0 ||
    Boolean(fields.apendices || fields.anexos);
  const textualStartPage = calculateTextualStartPage(fields, hasSummary);
  const summaryChildren = buildSummary(bodyBlocks, references, fields, textualStartPage);

  const preTextualChildrenList: Array<Paragraph | TableOfContents> = [
    ...coverChildren(fields, input.logo),
    pageBreak(),
    ...titlePageChildren(fields),
    ...preTextualChildren(fields),
    ...summaryChildren,
  ];

  const textualAndPostTextualChildren: Array<Paragraph | Table> = [
    ...bodyBlocks.flatMap((block, index) => blockToParagraph(block, index === 0, input.importedImages ?? [], input.importedTables ?? [])),
    pageBreak(),
    sectionTitle("Referências"),
    ...buildReferences(references),
    ...(fields.anexos
      ? [pageBreak(), sectionTitle("Anexos"), ...buildSimpleParagraphs(fields.anexos)]
      : []),
    ...(fields.apendices
      ? [pageBreak(), sectionTitle(appendixTitle(fields)), ...buildSimpleParagraphs(fields.apendices)]
      : []),
  ];

  const pageNumberHeader = new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [
          new TextRun({
            children: [PageNumber.CURRENT],
            font: UFLA_RULES.typography.fontFamily,
            size: UFLA_RULES.typography.pageNumberFontSizePt * 2,
            color: BLACK,
          }),
        ],
      }),
    ],
  });

  return new Document({
    creator: "UFLA DOCX Acadêmico",
    title: fields.title || "Trabalho acadêmico",
    description: "Documento acadêmico gerado conforme regras centrais da UFLA.",
    features: {
      updateFields: true,
    },
    styles: DOCUMENT_STYLES,
    sections: [
      {
        properties: {
          page: {
            size: {
              orientation: PageOrientation.PORTRAIT,
              width: UFLA_RULES.page.widthTwip,
              height: UFLA_RULES.page.heightTwip,
            },
            margin: pageMargins(),
          },
        },
        children: preTextualChildrenList,
      },
      {
        properties: {
          page: {
            size: {
              orientation: PageOrientation.PORTRAIT,
              width: UFLA_RULES.page.widthTwip,
              height: UFLA_RULES.page.heightTwip,
            },
            margin: pageMargins(),
            pageNumbers: {
              start: textualStartPage,
            },
          },
        },
        headers: {
          default: pageNumberHeader,
        },
        children: textualAndPostTextualChildren,
      },
    ],
  });
}

export async function loadDefaultLogoAsset(): Promise<DocxLogoAsset | undefined> {
  if (typeof fetch !== "function") return undefined;

  // Em ambiente Node/Vitest não há documento nem base URL para resolver o caminho
  // relativo /assets/ufla-logo.jpeg; o fetch lançaria Invalid URL apenas para poluir
  // o stderr. O navegador mantém o carregamento real; fora dele usamos fallback silencioso.
  if (typeof window === "undefined" || import.meta.env.MODE === "test") return undefined;

  try {
    const response = await fetch(DEFAULT_UFLA_LOGO_PATH);
    if (!response.ok) return undefined;
    return {
      data: await response.arrayBuffer(),
      width: UFLA_LOGO_WIDTH_PX,
      height: UFLA_LOGO_HEIGHT_PX,
    };
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error("Falha ao carregar o logo padrão da UFLA.", error);
    }
    return undefined;
  }
}

export async function generateDocxBlob(input: DocxGenerationInput): Promise<Blob> {
  if (input.fields.workType === "artigo") {
    const { generateArticleDocxBlob } = await import("./export-article-docx");
    return generateArticleDocxBlob(input);
  }

  const logo = input.logo ?? (await loadDefaultLogoAsset());
  return Packer.toBlob(createDocxDocument({ ...input, logo }));
}
