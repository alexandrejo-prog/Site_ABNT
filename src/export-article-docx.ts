import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  PageOrientation,
  Paragraph,
  Table,
  TextRun,
} from "docx";
import type { IParagraphOptions } from "docx";
import { parseEditorContent, type DocxGenerationInput, type EditorBlock } from "./export-docx";
import { UFLA_RULES } from "./ufla-rules";
import { normalizeReferences, type ReferenceRun } from "./references-normalizer";
import { cleanMojibakeText, splitParagraphs as coreSplitParagraphs, textRunsFromMarkup as coreTextRunsFromMarkup, tabbedTableBlock } from "./docx-render-core";

const BLACK = "000000";
const BODY_SIZE = 24;
const SINGLE_LINE = 240;
const ONE_AND_HALF_LINE = 360;

interface RunOptions {
  bold?: boolean;
  italics?: boolean;
  size?: number;
}
type DocxHeadingLevel = (typeof HeadingLevel)[keyof typeof HeadingLevel];
type ArticleChild = Paragraph | Table;

function hasText(value: string): boolean {
  return value.trim().length > 0;
}

function splitParagraphs(value: string): string[] {
  return coreSplitParagraphs(cleanMojibakeText(value));
}

function normalizeComparable(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function stripLeadingArticleMetadataBlocks(blocks: EditorBlock[], input: DocxGenerationInput): EditorBlock[] {
  const metadata = new Set(
    [input.fields.title, input.fields.subtitle, input.fields.author]
      .map(normalizeComparable)
      .filter(Boolean),
  );

  if (!metadata.size) return blocks;

  let firstBodyIndex = 0;
  while (firstBodyIndex < blocks.length && metadata.has(normalizeComparable(blocks[firstBodyIndex].text))) {
    firstBodyIndex += 1;
  }

  return blocks.slice(firstBodyIndex);
}

function run(text: string, options: RunOptions = {}): TextRun {
  return new TextRun({
    text: cleanMojibakeText(text),
    font: UFLA_RULES.typography.fontFamily,
    size: BODY_SIZE,
    color: BLACK,
    ...options,
  });
}

function textRunsFromMarkup(text: string): TextRun[] {
  return coreTextRunsFromMarkup(cleanMojibakeText(text || " "), BODY_SIZE, UFLA_RULES.typography.fontFamily, BLACK);
}

function paragraph(text: string, options: Partial<IParagraphOptions> = {}): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.BOTH,
    spacing: { line: ONE_AND_HALF_LINE, after: 0 },
    indent: { firstLine: UFLA_RULES.typography.paragraphFirstLineTwip },
    children: textRunsFromMarkup(text || " "),
    ...options,
  });
}

function centered(text: string, bold = false, size = BODY_SIZE): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 240, line: SINGLE_LINE },
    children: [run(text, { bold, size })],
  });
}

function sectionTitle(text: string, level: DocxHeadingLevel = HeadingLevel.HEADING_1): Paragraph {
  return new Paragraph({
    heading: level,
    alignment: AlignmentType.LEFT,
    spacing: { before: 240, after: 120, line: SINGLE_LINE },
    children: [run(text, { bold: level !== HeadingLevel.HEADING_3 })],
  });
}

function labeledSection(label: string, value: string): Paragraph[] {
  if (!hasText(value)) return [];
  return [
    sectionTitle(label),
    ...splitParagraphs(value).map((line) =>
      paragraph(line, {
        spacing: { line: SINGLE_LINE, after: 120 },
        indent: { firstLine: 0 },
      }),
    ),
  ];
}

function blockToParagraph(block: EditorBlock): ArticleChild[] {
  if (block.type === "heading1") return [sectionTitle(block.text, HeadingLevel.HEADING_1)];
  if (block.type === "heading2") return [sectionTitle(block.text, HeadingLevel.HEADING_2)];
  if (block.type === "heading3") return [sectionTitle(block.text, HeadingLevel.HEADING_3)];
  if (block.type === "longQuote") {
    return [
      paragraph(block.text, {
        spacing: { line: SINGLE_LINE, after: 120 },
        indent: { left: UFLA_RULES.typography.longQuoteLeftIndentTwip },
      }),
    ];
  }
  if (block.type === "scheduleTable") return splitParagraphs(block.text).map((line) => paragraph(line));
  if (block.type === "tabbedTable") return tabbedTableBlock(block.text);
  return [paragraph(block.text)];
}

function referenceRunToTextRun(referenceRun: ReferenceRun): TextRun {
  return run(referenceRun.text, {
    bold: referenceRun.bold,
    italics: referenceRun.italics,
  });
}

function referenceParagraphs(references: string[]): Paragraph[] {
  if (!references.length) return [];

  return [
    sectionTitle("Referencias"),
    ...normalizeReferences(references)
      .sort((a, b) => a.text.localeCompare(b.text, "pt-BR", { sensitivity: "base" }))
      .map(
        (reference) =>
          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { line: SINGLE_LINE, after: 240 },
            indent: { firstLine: 0 },
            children: reference.runs.length
              ? reference.runs.map(referenceRunToTextRun)
              : [run(reference.text || " ")],
          }),
      ),
  ];
}

function createArticleDocument(input: DocxGenerationInput): Document {
  const blocks = parseEditorContent(input.editorText);
  const bodyBlocks = stripLeadingArticleMetadataBlocks(
    blocks.filter((block) => block.type !== "reference"),
    input,
  );
  const references = [
    ...splitParagraphs(input.fields.referencias),
    ...blocks.filter((block) => block.type === "reference").map((block) => block.text),
  ];

  return new Document({
    creator: "UFLA DOCX Academico",
    title: input.fields.title || "Artigo academico",
    description: "Artigo academico simples sem estrutura pre-textual de monografia.",
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
              top: UFLA_RULES.margins.topTwip,
              left: UFLA_RULES.margins.leftTwip,
              bottom: UFLA_RULES.margins.bottomTwip,
              right: UFLA_RULES.margins.rightTwip,
            },
          },
        },
        children: [
          centered((input.fields.title || "Titulo do artigo").toUpperCase(), true, 28),
          ...(hasText(input.fields.subtitle) ? [centered(input.fields.subtitle, false)] : []),
          centered(input.fields.author || "Autor", false),
          ...labeledSection("Resumo", input.fields.resumo),
          ...(hasText(input.fields.palavrasChave)
            ? [paragraph(`Palavras-chave: ${input.fields.palavrasChave}`, { indent: { firstLine: 0 } })]
            : []),
          ...labeledSection("Abstract", input.fields.abstractText),
          ...(hasText(input.fields.keywords)
            ? [paragraph(`Keywords: ${input.fields.keywords}`, { indent: { firstLine: 0 } })]
            : []),
          ...bodyBlocks.flatMap(blockToParagraph),
          ...referenceParagraphs(references),
        ],
      },
    ],
  });
}

export async function generateArticleDocxBlob(input: DocxGenerationInput): Promise<Blob> {
  return Packer.toBlob(createArticleDocument(input));
}
