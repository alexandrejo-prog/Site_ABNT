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
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import type { IParagraphOptions, IStylesOptions } from "docx";
import { AcademicFields, UFLA_RULES } from "./ufla-rules";
import { normalizeReferences, type ReferenceRun } from "./references-normalizer";
import { normalizeForDetection } from "./word-structure-extractor";

export type EditorBlockType =
  | "paragraph"
  | "heading1"
  | "heading2"
  | "heading3"
  | "longQuote"
  | "scheduleTable"
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
}

interface SummaryEntry {
  title: string;
  level: 1 | 2 | 3;
  page: number;
}

interface ScheduleRow {
  etapa: string;
  meses: string;
  periodo: string;
  atividades: string;
}

export const DEFAULT_UFLA_LOGO_PATH = "/assets/ufla-logo.jpeg";

const BODY_SIZE = UFLA_RULES.typography.bodyFontSizePt * 2;
const LONG_QUOTE_SIZE = UFLA_RULES.typography.longQuoteFontSizePt * 2;
const COVER_AUTHOR_SIZE = UFLA_RULES.typography.coverAuthorFontSizePt * 2;
const COVER_TITLE_SIZE = UFLA_RULES.typography.coverTitleFontSizePt * 2;
const ONE_AND_HALF_LINE = UFLA_RULES.spacing.bodyLineTwip;
const SINGLE_LINE = UFLA_RULES.spacing.singleLineTwip;
const BLACK = "000000";
const REFERENCE_FONT = "Times New Roman";
const REFERENCE_SIZE = 12 * 2;
const UFLA_LOGO_WIDTH_PX = 265;
const UFLA_LOGO_HEIGHT_PX = 108;
const ESTIMATED_CHARS_PER_PAGE = 2550;

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

export function parseEditorContent(editorText: string): EditorBlock[] {
  const lines = editorText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const blocks: EditorBlock[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index];

    if (shouldStartScheduleTable(trimmed)) {
      const tableLines = [trimmed];
      let cursor = index + 1;

      while (cursor < lines.length) {
        const nextLine = lines[cursor];
        tableLines.push(nextLine);
        cursor += 1;
        if (/^Fonte:/i.test(nextLine)) break;
        if (/^5\.2\s+/i.test(lines[cursor] ?? "")) break;
      }

      blocks.push({ type: "scheduleTable", text: tableLines.join("\n") });
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
    text: run.text,
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

function tableTextParagraph(text: string, bold = false): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { line: SINGLE_LINE, after: 0 },
    children: [
      new TextRun({
        text,
        bold,
        font: UFLA_RULES.typography.fontFamily,
        size: 20,
        color: BLACK,
      }),
    ],
  });
}

function tableCell(text: string, width: number, bold = false): TableCell {
  return new TableCell({
    width: { size: width, type: WidthType.PERCENTAGE },
    margins: { top: 80, bottom: 80, left: 80, right: 80 },
    children: [tableTextParagraph(text, bold)],
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

function scheduleTableBlock(text: string): Array<Paragraph | Table> {
  const { caption, rows, source } = scheduleRowsFromBlock(text);
  const header = new TableRow({
    children: [
      tableCell("Etapa", 17, true),
      tableCell("Meses", 13, true),
      tableCell("Período", 24, true),
      tableCell("Atividades principais", 46, true),
    ],
  });

  const tableRows = rows.map(
    (row) =>
      new TableRow({
        children: [
          tableCell(row.etapa, 17),
          tableCell(row.meses, 13),
          tableCell(row.periodo, 24),
          tableCell(row.atividades, 46),
        ],
      }),
  );

  return [
    scheduleCaptionParagraph(caption),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1, color: BLACK },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: BLACK },
        left: { style: BorderStyle.SINGLE, size: 1, color: BLACK },
        right: { style: BorderStyle.SINGLE, size: 1, color: BLACK },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: BLACK },
        insideVertical: { style: BorderStyle.SINGLE, size: 1, color: BLACK },
      },
      rows: [header, ...tableRows],
    }),
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

function blockToParagraph(
  block: EditorBlock,
  isFirstTextualBlock: boolean = false,
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

  return [textParagraph(block.text)];
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
        text: usesFinalConsiderationsHeading(nextBlocks) ? "6 CONSIDERAÇÕES FINAIS" : "CONCLUSÃO",
      },
      ...splitParagraphs(fields.conclusao).map((text) => ({ type: "paragraph" as const, text })),
    );
  }

  return nextBlocks;
}

function headingLevel(block: EditorBlock): 1 | 2 | 3 | null {
  if (block.type === "heading1") return 1;
  if (block.type === "heading2") return 2;
  if (block.type === "heading3") return 3;
  return null;
}

function blockTextWeight(block: EditorBlock): number {
  if (block.type === "heading1" || block.type === "heading2" || block.type === "heading3") return 160;
  if (block.type === "scheduleTable") return 900;
  if (block.type === "longQuote") return block.text.length * 0.85;
  return block.text.length + 60;
}

function appendixTitle(fields: AcademicFields): string {
  const normalized = normalizeForDetection(fields.apendices);
  if (normalized.includes("ROTEIRO") && normalized.includes("ENTREVISTA")) {
    return "APÊNDICE A - ROTEIRO PRELIMINAR DE ENTREVISTA";
  }
  return "APÊNDICE A";
}

function buildSummaryEntries(
  bodyBlocks: EditorBlock[],
  references: string[],
  fields: AcademicFields,
  textualStartPage: number,
): SummaryEntry[] {
  const entries: SummaryEntry[] = [];
  let currentPage = textualStartPage;
  let pageWeight = 0;
  let hasFirstHeading = false;

  for (const block of bodyBlocks) {
    const level = headingLevel(block);

    if (level === 1 && hasFirstHeading) {
      currentPage += Math.max(1, Math.ceil(pageWeight / ESTIMATED_CHARS_PER_PAGE));
      pageWeight = 0;
    }

    if (level) {
      entries.push({ title: level === 1 ? block.text.toUpperCase() : block.text, level, page: currentPage });
      hasFirstHeading = true;
    }

    pageWeight += blockTextWeight(block);
    while (pageWeight > ESTIMATED_CHARS_PER_PAGE) {
      currentPage += 1;
      pageWeight -= ESTIMATED_CHARS_PER_PAGE;
    }
  }

  const referencesPage = currentPage + Math.max(1, Math.ceil(pageWeight / ESTIMATED_CHARS_PER_PAGE));
  entries.push({ title: "REFERÊNCIAS", level: 1, page: referencesPage });

  const referenceWeight = references.join("\n").length;
  let nextPage = referencesPage + Math.max(1, Math.ceil(referenceWeight / 2200));

  if (fields.anexos) {
    entries.push({ title: "ANEXOS", level: 1, page: nextPage });
    nextPage += Math.max(1, Math.ceil(fields.anexos.length / 2200));
  }

  if (fields.apendices) {
    entries.push({ title: appendixTitle(fields), level: 1, page: nextPage });
  }

  return entries;
}

function summaryEntryParagraph(entry: SummaryEntry): Paragraph {
  const indent = entry.level === 1 ? "" : entry.level === 2 ? "   " : "      ";
  const page = String(entry.page);
  const maxTitleLength = entry.level === 1 ? 62 : entry.level === 2 ? 58 : 54;
  const normalizedTitle = `${indent}${entry.title}`;
  const dots = ".".repeat(Math.max(6, maxTitleLength - normalizedTitle.length));

  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { line: SINGLE_LINE, after: 0 },
    children: [
      new TextRun({
        text: `${normalizedTitle} ${dots} ${page}`,
        font: UFLA_RULES.typography.fontFamily,
        size: BODY_SIZE,
        bold: entry.level < 3,
        color: BLACK,
      }),
    ],
  });
}

function buildSummary(
  bodyBlocks: EditorBlock[],
  references: string[],
  fields: AcademicFields,
  textualStartPage: number,
): Paragraph[] {
  const hasEntries =
    bodyBlocks.some(
      (block) =>
        block.type === "heading1" || block.type === "heading2" || block.type === "heading3",
    ) ||
    references.length > 0 ||
    Boolean(fields.apendices || fields.anexos);

  if (!hasEntries) return [];

  return [
    pageBreak(),
    unnumberedTitle("Sumário"),
    ...buildSummaryEntries(bodyBlocks, references, fields, textualStartPage).map(summaryEntryParagraph),
  ];
}

function hasText(value: string): boolean {
  return value.trim().length > 0;
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
  if (fields.workType === "tese") {
    return nature
      .replace(/obtenção do título de Mestre/gi, "obtenção do título de Doutor")
      .replace(/título de Mestre/gi, "título de Doutor")
      .replace(/Mestre em/gi, "Doutor em")
      .replace(/Mestrado/gi, "Doutorado")
      .replace(/dissertação/gi, "tese");
  }

  if (fields.workType === "dissertacao") {
    return nature
      .replace(/obtenção do título de Doutor/gi, "obtenção do título de Mestre")
      .replace(/título de Doutor/gi, "título de Mestre")
      .replace(/Doutor em/gi, "Mestre em")
      .replace(/Doutorado/gi, "Mestrado")
      .replace(/tese/gi, "dissertação");
  }

  return nature;
}

function coverChildren(fields: AcademicFields, logo?: DocxLogoAsset): Paragraph[] {
  return [
    ...logoParagraph(logo),
    new Paragraph({ spacing: { before: 1100 } }),
    centeredParagraph((fields.author || "AUTOR").toUpperCase(), true, COVER_AUTHOR_SIZE, {
      after: 0,
      line: SINGLE_LINE,
    }),
    new Paragraph({ spacing: { before: 1700 } }),
    centeredParagraph((fields.title || "TÍTULO DO TRABALHO").toUpperCase(), true, COVER_TITLE_SIZE, {
      after: 0,
      line: ONE_AND_HALF_LINE,
    }),
    ...(fields.subtitle
      ? [
          centeredParagraph(fields.subtitle.toUpperCase(), false, COVER_TITLE_SIZE, {
            after: 0,
            line: ONE_AND_HALF_LINE,
          }),
        ]
      : []),
    new Paragraph({ spacing: { before: 2200 } }),
    centeredParagraph((fields.location || "LAVRAS - MG").toUpperCase(), true, COVER_AUTHOR_SIZE, {
      after: 120,
      line: SINGLE_LINE,
    }),
    centeredParagraph(fields.year || new Date().getFullYear().toString(), true, COVER_AUTHOR_SIZE, {
      after: 0,
      line: SINGLE_LINE,
    }),
  ];
}

function buildTitlePageSupplementalLines(fields: AcademicFields, nature: string): string[] {
  const normalizedNature = normalizeForDetection(nature);
  return [
    fields.course && !normalizedNature.includes("CURSO") ? `Curso: ${fields.course}` : "",
    fields.program && !normalizedNature.includes("PROGRAMA") ? `Programa: ${fields.program}` : "",
    fields.advisor && !normalizedNature.includes("ORIENTADOR") ? `Orientador(a): ${fields.advisor}` : "",
    fields.coadvisor && !normalizedNature.includes("COORIENTADOR")
      ? `Coorientador(a): ${fields.coadvisor}`
      : "",
  ].filter(Boolean);
}

function workNature(fields: AcademicFields): string {
  return normalizeNatureForWorkType(
    fields.workNature ||
      "Trabalho apresentado à Universidade Federal de Lavras como requisito acadêmico, conforme dados revisados pelo usuário.",
    fields,
  );
}

function titlePageChildren(fields: AcademicFields): Paragraph[] {
  const nature = workNature(fields);
  const supplementalLines = buildTitlePageSupplementalLines(fields, nature);

  return [
    centeredParagraph((fields.author || "AUTOR").toUpperCase(), true, BODY_SIZE, {
      after: 0,
      line: SINGLE_LINE,
    }),
    new Paragraph({ spacing: { before: 1500 } }),
    centeredParagraph((fields.title || "TÍTULO DO TRABALHO").toUpperCase(), true, BODY_SIZE, {
      after: 0,
      line: ONE_AND_HALF_LINE,
    }),
    ...(fields.subtitle
      ? [
          centeredParagraph(fields.subtitle.toUpperCase(), false, BODY_SIZE, {
            after: 0,
            line: ONE_AND_HALF_LINE,
          }),
        ]
      : []),
    new Paragraph({ spacing: { before: 900 } }),
    natureParagraph(nature),
    ...supplementalLines.map((line) =>
      centeredParagraph(line, false, BODY_SIZE, { after: 0, line: SINGLE_LINE }),
    ),
    new Paragraph({ spacing: { before: 1500 } }),
    centeredParagraph((fields.location || "LAVRAS - MG").toUpperCase(), false, BODY_SIZE, {
      after: 120,
      line: SINGLE_LINE,
    }),
    centeredParagraph(fields.year || new Date().getFullYear().toString(), false, BODY_SIZE, {
      after: 0,
      line: SINGLE_LINE,
    }),
  ];
}

function approvalPageChildren(fields: AcademicFields): Paragraph[] {
  if (!hasApprovalPage(fields)) return [];

  return [
    pageBreak(),
    centeredParagraph((fields.author || "AUTOR").toUpperCase(), true, BODY_SIZE, {
      after: 0,
      line: SINGLE_LINE,
    }),
    new Paragraph({ spacing: { before: 900 } }),
    centeredParagraph((fields.title || "TÍTULO DO TRABALHO").toUpperCase(), true, BODY_SIZE, {
      after: 0,
      line: ONE_AND_HALF_LINE,
    }),
    new Paragraph({ spacing: { before: 600 } }),
    natureParagraph(workNature(fields)),
    simpleParagraph("Aprovado em: ____ de ____________________ de ______.", {
      alignment: AlignmentType.CENTER,
      spacing: { before: 480, after: 240, line: SINGLE_LINE },
    }),
    centeredParagraph("BANCA EXAMINADORA", true, BODY_SIZE, { after: 480, line: SINGLE_LINE }),
    centeredParagraph("________________________________________", false, BODY_SIZE, { after: 0, line: SINGLE_LINE }),
    centeredParagraph(fields.advisor || "Prof. Dr. [nome do orientador]", false, BODY_SIZE, {
      after: 0,
      line: SINGLE_LINE,
    }),
    centeredParagraph("Orientador(a) - UFLA", false, BODY_SIZE, { after: 360, line: SINGLE_LINE }),
    centeredParagraph("________________________________________", false, BODY_SIZE, { after: 0, line: SINGLE_LINE }),
    centeredParagraph("Prof. Dr. [nome do membro da banca]", false, BODY_SIZE, {
      after: 0,
      line: SINGLE_LINE,
    }),
    centeredParagraph("Instituição", false, BODY_SIZE, { after: 360, line: SINGLE_LINE }),
    centeredParagraph("________________________________________", false, BODY_SIZE, { after: 0, line: SINGLE_LINE }),
    centeredParagraph("Prof. Dr. [nome do membro da banca]", false, BODY_SIZE, {
      after: 0,
      line: SINGLE_LINE,
    }),
    centeredParagraph("Instituição", false, BODY_SIZE, { after: 600, line: SINGLE_LINE }),
    centeredParagraph((fields.location || "LAVRAS - MG").toUpperCase(), false, BODY_SIZE, {
      after: 120,
      line: SINGLE_LINE,
    }),
    centeredParagraph(fields.year || new Date().getFullYear().toString(), false, BODY_SIZE, {
      after: 0,
      line: SINGLE_LINE,
    }),
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

function defaultImpactIndicators(fields: AcademicFields): string {
  const topic = fields.title || "a pesquisa proposta";
  return `Esta pesquisa apresenta impacto social e institucional ao analisar ${topic} no contexto da Universidade Federal de Lavras, considerando relações entre gestão, trabalho, saúde, participação e produção do conhecimento. Ao investigar percepções dos Servidores Técnico-Administrativos em Educação sobre o Programa de Gestão e Desempenho, o estudo poderá subsidiar práticas de avaliação mais democráticas, sensíveis à complexidade do trabalho real e comprometidas com a função pública da universidade. Seus resultados poderão contribuir para o aprimoramento de políticas de gestão de pessoas, para a valorização dos saberes técnico-administrativos e para a prevenção de processos de sobrecarga e adoecimento relacionados à organização do trabalho. O impacto esperado alcança a comunidade universitária, gestores, trabalhadores, pesquisadores da área de Educação Ambiental Crítica e instituições públicas que adotam modelos de gestão por desempenho. A pesquisa também dialoga com os Objetivos de Desenvolvimento Sustentável relacionados à saúde e bem-estar, trabalho decente, educação de qualidade e instituições eficazes, ao tratar o ambiente universitário como espaço socioambiental de vida, trabalho e formação humana.`;
}

function defaultImpactIndicatorsEnglish(fields: AcademicFields): string {
  const topic = fields.title || "the proposed research";
  return `This research has social and institutional impact by analyzing ${topic} in the context of the Federal University of Lavras, considering relations among management, work, health, participation and knowledge production. By investigating the perceptions of Technical-Administrative Education Staff regarding the Management and Performance Program, the study may support more democratic evaluation practices, sensitive to the complexity of real work and committed to the public role of the university. Its results may contribute to improving people management policies, valuing technical-administrative knowledge and preventing overload and illness processes related to work organization. The expected impact reaches the university community, managers, workers, researchers in Critical Environmental Education and public institutions that adopt performance-based management models. The research also dialogues with the Sustainable Development Goals related to health and well-being, decent work, quality education and effective institutions, by understanding the university environment as a socio-environmental space of life, work and human formation.`;
}

function preTextualChildren(fields: AcademicFields): Paragraph[] {
  const impactRequired = fields.workType === "dissertacao" || fields.workType === "tese";
  const indicadores = fields.indicadoresImpacto || (impactRequired ? defaultImpactIndicators(fields) : "");
  const impactIndicators = fields.impactIndicators || (impactRequired ? defaultImpactIndicatorsEnglish(fields) : "");

  return [
    pageBreak(),
    unnumberedTitle("Ficha catalográfica"),
    simpleParagraph(
      "Inserir aqui a ficha catalográfica oficial gerada pela Biblioteca Universitária da UFLA. Não substitua por texto manual na versão final.",
    ),
    ...approvalPageChildren(fields),
    ...optionalUntitledRightPage(fields.dedicatoria),
    ...optionalPage("Agradecimentos", fields.agradecimentos),
    ...optionalUntitledRightPage(fields.epigrafe, true),
    pageBreak(),
    unnumberedTitle("Resumo"),
    simpleParagraph(fields.resumo || " "),
    ...(fields.palavrasChave
      ? [simpleParagraph(`Palavras-chave: ${fields.palavrasChave}`)]
      : []),
    pageBreak(),
    unnumberedTitle("Abstract"),
    simpleParagraph(fields.abstractText || " "),
    ...(fields.keywords ? [simpleParagraph(`Keywords: ${fields.keywords}`)] : []),
    ...optionalPage("Indicadores de impacto", indicadores),
    ...optionalPage("Impact indicators", impactIndicators),
  ];
}

function pageMargins() {
  return {
    top: UFLA_RULES.margins.topTwip,
    left: UFLA_RULES.margins.leftTwip,
    bottom: UFLA_RULES.margins.bottomTwip,
    right: UFLA_RULES.margins.rightTwip,
    header: UFLA_RULES.header.distanceFromTopTwip,
    footer: UFLA_RULES.footer.distanceFromBottomTwip,
  };
}

export function createDocxDocument(input: DocxGenerationInput): Document {
  const { fields } = input;
  const parsedBlocks = parseEditorContent(input.editorText);
  const bodyBlocks = fieldSectionBlocks(
    fields,
    parsedBlocks.filter((block) => block.type !== "reference"),
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

  const preTextualChildrenList: Paragraph[] = [
    ...coverChildren(fields, input.logo),
    pageBreak(),
    ...titlePageChildren(fields),
    ...preTextualChildren(fields),
    ...summaryChildren,
  ];

  const textualAndPostTextualChildren: Array<Paragraph | Table> = [
    ...bodyBlocks.flatMap((block, index) => blockToParagraph(block, index === 0)),
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

  try {
    const response = await fetch(DEFAULT_UFLA_LOGO_PATH);
    if (!response.ok) return undefined;
    return {
      data: await response.arrayBuffer(),
      width: UFLA_LOGO_WIDTH_PX,
      height: UFLA_LOGO_HEIGHT_PX,
    };
  } catch {
    return undefined;
  }
}

export async function generateDocxBlob(input: DocxGenerationInput): Promise<Blob> {
  const logo = input.logo ?? (await loadDefaultLogoAsset());
  return Packer.toBlob(createDocxDocument({ ...input, logo }));
}
