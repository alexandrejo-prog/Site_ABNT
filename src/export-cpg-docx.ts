import {
  AlignmentType,
  BorderStyle,
  Document,
  Header,
  HeadingLevel,
  Packer,
  PageNumber,
  PageOrientation,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";
import type { IParagraphOptions } from "docx";
import { BLACK as SHARED_BLACK } from "./docx-shared";
import { DOCUMENT_STYLES } from "./docx-styles";
import { cleanMojibakeText, clearRawOmmlRegistry, rawOmmlMarkerParagraph, sourceParagraph, splitParagraphs as coreSplitParagraphs, textRunsFromMarkup as coreTextRunsFromMarkup, hasText, detectCaption, tabbedTableBlock } from "./docx-render-core";
import { parseEditorContent, importedTableParagraph, type DocxGenerationInput, type EditorBlock } from "./export-docx";
import type { ImportedTable } from "./imported-tables";
import { CPG_RULES, UFLA_RULES, cmToTwip } from "./ufla-rules";
import { stripCpgForbiddenSections } from "./cpg-content-filter";
import { normalizeReferences, type ReferenceRun } from "./references-normalizer";

const BLACK = SHARED_BLACK;
const BODY_SIZE = CPG_RULES.typography.bodyFontSizePt * 2;
const TITLE_SIZE = CPG_RULES.typography.titleFontSizePt * 2;
const SECTION_SIZE = CPG_RULES.typography.sectionTitleFontSizePt * 2;
const SUBSECTION_SIZE = CPG_RULES.typography.subsectionTitleFontSizePt * 2;
const CAPTION_SIZE = UFLA_RULES.typography.sourceFontSizePt * 2;
const SINGLE_LINE = UFLA_RULES.spacing.singleLineTwip;
const BODY_LINE = UFLA_RULES.spacing.bodyLineTwip;
const SIX_PT = UFLA_RULES.spacing.beforePrimaryTitleTwip / 2;
const TWELVE_PT = UFLA_RULES.spacing.beforePrimaryTitleTwip;
const ABSTRACT_INDENT = cmToTwip(CPG_RULES.typography.abstractSideIndentCm);
const BODY_FIRST_LINE = cmToTwip(CPG_RULES.typography.paragraphFirstLineCm);
const REFERENCE_HANGING = cmToTwip(CPG_RULES.typography.referenceHangingCm);

type CpgChild = Paragraph | Table;

interface RunOptions {
  bold?: boolean;
  italics?: boolean;
  size?: number;
  font?: string;
}

type DocxHeadingLevel = (typeof HeadingLevel)[keyof typeof HeadingLevel];

function run(text: string, options: RunOptions = {}): TextRun {
  return new TextRun({
    text: cleanMojibakeText(text),
    font: options.font ?? CPG_RULES.typography.fontFamily,
    size: options.size ?? BODY_SIZE,
    color: BLACK,
    bold: options.bold,
    italics: options.italics,
  });
}

function referenceRunToTextRun(item: ReferenceRun): TextRun {
  return new TextRun({
    text: cleanMojibakeText(item.text),
    font: CPG_RULES.typography.fontFamily,
    size: BODY_SIZE,
    color: BLACK,
    bold: item.bold,
    italics: item.italics,
  });
}

function splitParagraphs(value: string): string[] {
  return coreSplitParagraphs(cleanMojibakeText(value))
    .map((line) => line.trim())
    .filter(Boolean);
}

function stripMarkup(value: string): string {
  return cleanMojibakeText(value).replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1");
}

function ensureTerminalPeriod(value: string): string {
  const text = cleanMojibakeText(value).trim();
  if (!text) return text;
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function textRunsFromMarkup(text: string, size = BODY_SIZE, font = CPG_RULES.typography.fontFamily): TextRun[] {
  return coreTextRunsFromMarkup(cleanMojibakeText(text), size, font);
}

function paragraph(text: string, options: Partial<IParagraphOptions> = {}): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.BOTH,
    spacing: { before: SIX_PT, after: 0, line: BODY_LINE },
    indent: { firstLine: BODY_FIRST_LINE },
    children: textRunsFromMarkup(text || " "),
    ...options,
  });
}

function titleParagraph(text: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: TWELVE_PT, after: TWELVE_PT, line: BODY_LINE },
    children: [run(cleanMojibakeText(text || "Titulo do trabalho").toUpperCase(), { bold: true, size: TITLE_SIZE })],
  });
}

function centered(
  text: string,
  bold = false,
  size = BODY_SIZE,
  font: string = CPG_RULES.typography.fontFamily,
  spacing: NonNullable<IParagraphOptions["spacing"]> = { after: TWELVE_PT, line: BODY_LINE },
): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing,
    children: [run(cleanMojibakeText(text), { bold, size, font })],
  });
}

function affiliationParagraphs(value: string): Paragraph[] {
  return splitParagraphs(value).map((line) =>
    centered(line, false, CAPTION_SIZE, CPG_RULES.typography.fontFamily, { after: 0, line: BODY_LINE }),
  );
}

function emailParagraph(value: string): Paragraph[] {
  if (!hasText(value)) return [];
  return [
    centered(value, false, BODY_SIZE, CPG_RULES.typography.fontFamily, {
      before: SIX_PT,
      after: SIX_PT,
      line: BODY_LINE,
    }),
  ];
}

function insetLabeledParagraph(label: string, text: string, separator: "." | ":" = ".", normalizeTerminalPeriod = false): Paragraph[] {
  if (!hasText(text)) return [];
  const normalizedText = normalizeTerminalPeriod ? ensureTerminalPeriod(text) : text;
  return splitParagraphs(normalizedText).map(
    (line, index) =>
      new Paragraph({
        alignment: AlignmentType.BOTH,
        spacing: { before: SIX_PT, after: 0, line: UFLA_RULES.spacing.singleLineTwip },
        indent: { left: ABSTRACT_INDENT, right: ABSTRACT_INDENT, firstLine: 0 },
        children:
          index === 0
            ? [run(`${label}${separator} `, { bold: true }), ...textRunsFromMarkup(line)]
            : textRunsFromMarkup(line),
      }),
  );
}

function sectionTitle(text: string, level: DocxHeadingLevel = HeadingLevel.HEADING_1): Paragraph {
  return new Paragraph({
    heading: level,
    alignment: AlignmentType.LEFT,
    spacing: { before: TWELVE_PT, after: 0, line: BODY_LINE },
    children: [
      run(cleanMojibakeText(level === HeadingLevel.HEADING_1 ? text.toUpperCase() : text), {
        bold: level !== HeadingLevel.HEADING_3,
        size: level === HeadingLevel.HEADING_1 ? SECTION_SIZE : SUBSECTION_SIZE,
      }),
    ],
  });
}

function cpgCaptionParagraph(text: string, tableCaption: boolean): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: SIX_PT, after: SIX_PT, line: SINGLE_LINE },
    indent: { left: ABSTRACT_INDENT, right: ABSTRACT_INDENT },
    children: [
      run(cleanMojibakeText(text), {
        bold: true,
        size: CAPTION_SIZE,
        font: CPG_RULES.typography.fontFamily,
      }),
    ],
    ...(tableCaption ? {} : {}),
  });
}

function isCaption(text: string): "figure" | "table" | null {
  const result = detectCaption(cleanMojibakeText(text).trim());
  if (!result) return null;
  return result.kind === "table" ? "table" : "figure";
}

function splitTableRow(line: string): string[] {
  const trimmed = cleanMojibakeText(line).trim();
  if (/^\|?\s*[-:]+(?:\s*\|\s*[-:]+)+\s*\|?$/.test(trimmed)) return [];
  if (trimmed.includes("|")) {
    return trimmed.replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim()).filter(Boolean);
  }
  if (trimmed.includes("\t")) return trimmed.split("\t").map((cell) => cell.trim()).filter(Boolean);
  if (/ {2,}/.test(trimmed)) return trimmed.split(/ {2,}/).map((cell) => cell.trim()).filter(Boolean);
  return [trimmed];
}

function tableFromBlock(block: EditorBlock): Table {
  const rows = block.text
    .split(/\r?\n/)
    .map(splitTableRow)
    .filter((row) => row.length > 0);
  const columnCount = Math.max(1, ...rows.map((row) => row.length));
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: BLACK },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: BLACK },
      left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: BLACK },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    },
    rows: rows.map((row, rowIndex) =>
      new TableRow({
        ...(rowIndex === 0 ? { tableHeader: true } : {}),
        children: Array.from({ length: columnCount }, (_, cellIndex) =>
          new TableCell({
            width: { size: Math.floor(100 / columnCount), type: WidthType.PERCENTAGE },
            margins: { top: 80, bottom: 80, left: 80, right: 80 },
            children: [
              new Paragraph({
                alignment: AlignmentType.LEFT,
                spacing: { before: 0, after: 0, line: SINGLE_LINE },
                children: [run(row[cellIndex] ?? "", { bold: rowIndex === 0 })],
              }),
            ],
          }),
        ),
      }),
    ),
  });
}

function blockToParagraph(block: EditorBlock, firstParagraphInSection: boolean, importedTables: ImportedTable[] = []): CpgChild[] {
  if (block.type === "heading1") return [sectionTitle(block.text, HeadingLevel.HEADING_1)];
  if (block.type === "heading2") return [sectionTitle(block.text, HeadingLevel.HEADING_2)];
  if (block.type === "heading3") return [sectionTitle(block.text, HeadingLevel.HEADING_3)];
  if (block.type === "longQuote") {
    return [
      new Paragraph({
        alignment: AlignmentType.BOTH,
        spacing: { before: SIX_PT, after: 0, line: SINGLE_LINE },
        indent: { left: UFLA_RULES.typography.longQuoteLeftIndentTwip, firstLine: 0 },
        children: textRunsFromMarkup(block.text, UFLA_RULES.typography.longQuoteFontSizePt * 2),
      }),
    ];
  }
  if (block.type === "scheduleTable" || block.type === "plainScheduleTable" || block.type === "markdownTable") {
    return [tableFromBlock(block)];
  }

  if (block.type === "tabbedTable") {
    return tabbedTableBlock(block.text, { font: CPG_RULES.typography.fontFamily, bodySize: BODY_SIZE });
  }

  if (block.type === "importedTable") {
    const table = importedTables.find((item) => item.id === block.text);
    return importedTableParagraph(table);
  }

  if (block.type === "source") {
    return [sourceParagraph(block.text)];
  }

  if (block.type === "equation") {
    return [rawOmmlMarkerParagraph(block.text, block.ommlXml)];
  }

  const caption = isCaption(block.text);
  if (caption) return [cpgCaptionParagraph(block.text, caption === "table")];

  if (/^Fonte\s*:/i.test(block.text)) {
    return [sourceParagraph(block.text)];
  }

  return [
    paragraph(block.text, {
      indent: { firstLine: firstParagraphInSection ? 0 : BODY_FIRST_LINE },
    }),
  ];
}

function isReferenceTitleNoise(text: string): boolean {
  const normalized = cleanMojibakeText(text).trim().toUpperCase();
  return /^(REFERENCIAS|REFERÊNCIAS|BIBLIOGRÁFICAS|BIBLIOGRAFICAS)$/.test(normalized);
}

function referenceTitleFor(references: string[]): string {
  const upper = references.map((r) => cleanMojibakeText(r).trim().toUpperCase());
  const hasRef = upper.some((r) => /^(REFERENCIAS|REFERÊNCIAS)$/.test(r));
  const hasBiblio = upper.some((r) => /^(BIBLIOGRÁFICAS|BIBLIOGRAFICAS)$/.test(r));
  if (hasRef && hasBiblio) return "REFERÊNCIAS BIBLIOGRÁFICAS";
  if (hasBiblio) return "REFERÊNCIAS BIBLIOGRÁFICAS";
  return "REFERÊNCIAS";
}

function filterReferenceNoise(reference: string): boolean {
  return !isReferenceTitleNoise(reference);
}

function hasEditorHeading(blocks: EditorBlock[], text: string): boolean {
  const normalizedTarget = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
  return blocks.some((block) => {
    if (block.type !== "heading1" && block.type !== "heading2" && block.type !== "paragraph") return false;
    const normalizedBlock = block.text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/\s+/g, " ")
      .trim();
    return normalizedBlock === normalizedTarget;
  });
}

function referenceParagraphs(references: string[], bodyBlocks: EditorBlock[] = []): CpgChild[] {
  const cleanReferences = references
    .map((item) => stripMarkup(item).trim())
    .filter(Boolean)
    .filter(filterReferenceNoise);
  if (!cleanReferences.length) return [];

  const title = referenceTitleFor(references);
  const normalized = normalizeReferences(cleanReferences).filter((reference) => reference.text.trim().length > 0);
  const seen = new Set<string>();
  const normalizedReferences = normalized.filter((ref) => {
    const key = ref.text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => a.text.localeCompare(b.text, "pt-BR", { sensitivity: "base" }));

  const children: Array<Paragraph | Table> = [];
  if (!hasEditorHeading(bodyBlocks, "REFERENCIAS") && !hasEditorHeading(bodyBlocks, "REFERÊNCIAS") && !hasEditorHeading(bodyBlocks, "BIBLIOGRÁFICAS") && !hasEditorHeading(bodyBlocks, "BIBLIOGRAFICAS")) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: TWELVE_PT, after: 0, line: BODY_LINE },
        children: [
          run(cleanMojibakeText(title.toUpperCase()), { bold: true, size: SECTION_SIZE }),
        ],
      }),
    );
  }

  children.push(
    ...normalizedReferences.map(
      (reference) =>
        new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { before: SIX_PT, after: 0, line: SINGLE_LINE },
          indent: {
            left: REFERENCE_HANGING,
            hanging: REFERENCE_HANGING,
          },
          children: reference.runs.map(referenceRunToTextRun),
        }),
    ),
  );
  return children;
}

function compactFirstPage(children: CpgChild[]): CpgChild[] {
  const firstContentIndex = children.findIndex((child) => JSON.stringify(child).includes("w:t"));
  return firstContentIndex > 0 ? children.slice(firstContentIndex) : children;
}

function cpgResumoChildren(input: DocxGenerationInput): CpgChild[] {
  return compactFirstPage([
    titleParagraph(input.fields.title),
    centered(cleanMojibakeText(input.fields.author || "Autores").toUpperCase(), true),
    ...affiliationParagraphs(input.fields.program),
    ...emailParagraph(input.fields.course),
    ...(hasText(input.fields.resumo)
      ? insetLabeledParagraph("Resumo", input.fields.resumo, ".")
      : []),
    ...(hasText(input.fields.palavrasChave)
      ? insetLabeledParagraph("Palavras-chave", input.fields.palavrasChave, ":", true)
      : []),
    ...(hasText(input.fields.abstractText)
      ? insetLabeledParagraph("Abstract", input.fields.abstractText, ".")
      : []),
    ...(hasText(input.fields.keywords)
      ? insetLabeledParagraph("Keywords", input.fields.keywords, ":", true)
      : []),
    ...(hasText(input.fields.agradecimentos)
      ? [
          sectionTitle("Agradecimentos"),
          ...splitParagraphs(input.fields.agradecimentos).map((line) =>
            paragraph(line, { indent: { firstLine: 0 } }),
          ),
        ]
      : []),
  ]);
}

function cpgFullChildren(input: DocxGenerationInput): CpgChild[] {
  const sanitizedEditorText = stripCpgForbiddenSections(input.editorText);
  const blocks = parseEditorContent(sanitizedEditorText);
  const bodyBlocks = blocks.filter((block) => block.type !== "reference" && block.type !== "importedImage");
  const references = [
    ...splitParagraphs(input.fields.referencias),
    ...blocks.filter((block) => block.type === "reference").map((block) => block.text),
  ];
  let firstParagraphInSection = true;

  return compactFirstPage([
    titleParagraph(input.fields.title),
    centered(cleanMojibakeText(input.fields.author || "Autores").toUpperCase(), true),
    ...affiliationParagraphs(input.fields.program),
    ...emailParagraph(input.fields.course),
    ...insetLabeledParagraph("Resumo", input.fields.resumo, "."),
    ...insetLabeledParagraph("Palavras-chave", input.fields.palavrasChave, ":", true),
    ...insetLabeledParagraph("Abstract", input.fields.abstractText, "."),
    ...insetLabeledParagraph("Keywords", input.fields.keywords, ":", true),
    ...bodyBlocks.flatMap((block) => {
      if (block.type === "heading1" || block.type === "heading2" || block.type === "heading3") {
        firstParagraphInSection = true;
        return blockToParagraph(block, true, input.importedTables ?? []);
      }

      const paragraphs = blockToParagraph(block, firstParagraphInSection, input.importedTables ?? []);
      if (block.type === "paragraph") firstParagraphInSection = false;
      return paragraphs;
    }),
    ...referenceParagraphs(references, bodyBlocks),
  ]);
}

function createCpgDocument(input: DocxGenerationInput): Document {
  const isResumo = input.fields.workType === "resumo_cpg";
  const isMultiPage = input.fields.workType === "resumo_expandido_cpg" || input.fields.workType === "artigo_completo_cpg";

  const pageNumberHeader = isMultiPage
    ? new Header({
        children: [
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({
                children: [PageNumber.CURRENT],
                font: CPG_RULES.typography.fontFamily,
                size: BODY_SIZE,
                color: BLACK,
              }),
            ],
          }),
        ],
      })
    : undefined;

  return new Document({
    creator: "UFLA DOCX Academico",
    title: input.fields.title || "Trabalho CPG UFLA",
    description: "Documento CPG/UFLA conforme modelo do Congresso de Pós-Graduação.",
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
            margin: {
              top: CPG_RULES.margins.topTwip,
              bottom: CPG_RULES.margins.bottomTwip,
              left: CPG_RULES.margins.leftTwip,
              right: CPG_RULES.margins.rightTwip,
            },
          },
          verticalAlign: VerticalAlign.TOP,
          ...(isMultiPage ? { pageNumbers: { start: 1 } } : {}),
        },
        ...(pageNumberHeader ? { headers: { default: pageNumberHeader } } : {}),
        children: isResumo ? cpgResumoChildren(input) : cpgFullChildren(input),
      },
    ],
  });
}

export async function generateCpgDocxBlob(input: DocxGenerationInput): Promise<Blob> {
  clearRawOmmlRegistry();
  return Packer.toBlob(createCpgDocument(input));
}
