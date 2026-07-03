import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  PageOrientation,
  Paragraph,
  TextRun,
} from "docx";
import { parseEditorContent, type DocxGenerationInput, type EditorBlock } from "./export-docx";
import { UFLA_RULES, cmToTwip } from "./ufla-rules";

const BLACK = "000000";
const BODY_SIZE = UFLA_RULES.typography.bodyFontSizePt * 2;
const SECTION_SIZE = UFLA_RULES.typography.coverTitleFontSizePt * 2;
const ONE_AND_HALF_LINE = UFLA_RULES.spacing.bodyLineTwip;
const SINGLE_LINE = UFLA_RULES.spacing.singleLineTwip;
const TWELVE_PT = 240;
const SIX_PT = 120;

function run(text: string, options: { bold?: boolean; size?: number } = {}): TextRun {
  return new TextRun({
    text,
    font: UFLA_RULES.typography.fontFamily,
    size: options.size ?? BODY_SIZE,
    bold: options.bold,
    color: BLACK,
  });
}

function paragraph(text: string, bold = false, spacing: { before?: number; after?: number; line?: number } = {}): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.BOTH,
    spacing: { line: ONE_AND_HALF_LINE, after: SIX_PT, ...spacing },
    indent: { firstLine: cmToTwip(UFLA_RULES.typography.paragraphFirstLineCm) },
    children: [run(text || " ", { bold })],
  });
}

function sectionTitle(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.LEFT,
    spacing: { before: TWELVE_PT, after: TWELVE_PT, line: ONE_AND_HALF_LINE },
    children: [run(text.toUpperCase(), { size: SECTION_SIZE, bold: true })],
  });
}

function centeredParagraph(text: string, bold = false, size = BODY_SIZE): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [run(text, { bold, size })],
  });
}

function blockToParagraph(block: EditorBlock): Paragraph[] {
  if (block.type === "heading1") {
    return [sectionTitle(block.text)];
  }

  if (block.type === "heading2" || block.type === "heading3") {
    return [
      new Paragraph({
        heading: block.type === "heading2" ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
        spacing: { before: TWELVE_PT, after: TWELVE_PT, line: ONE_AND_HALF_LINE },
        children: [run(block.text, { bold: true })],
      }),
    ];
  }

  if (block.type === "longQuote") {
    return [
      paragraph(block.text, false, { line: SINGLE_LINE }),
    ];
  }

  return [paragraph(block.text)];
}

function referenceParagraph(text: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { line: SINGLE_LINE, after: SINGLE_LINE },
    indent: { hanging: cmToTwip(0.5) },
    children: [run(text)],
  });
}

function splitParagraphs(value: string): string[] {
  return value
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function buildDocument(input: DocxGenerationInput): Document {
  const blocks = parseEditorContent(input.editorText);
  const references = [
    ...splitParagraphs(input.fields.referencias),
    ...blocks.filter((b) => b.type === "reference").map((b) => b.text),
  ];

  return new Document({
    creator: "UFLA DOCX Academico",
    title: input.fields.title || "Projeto de pesquisa",
    description: "Documento de projeto de pesquisa gerado conforme NBR 15287:2025 (suporte inicial).",
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
              top: cmToTwip(3),
              left: cmToTwip(3),
              bottom: cmToTwip(2),
              right: cmToTwip(2),
            },
          },
        },
        children: [
          // Capa simples
          new Paragraph({ spacing: { before: 2400 } }),
          centeredParagraph("UNIVERSIDADE FEDERAL DE LAVRAS", true, BODY_SIZE),
          new Paragraph({ spacing: { before: 480 } }),
          centeredParagraph((input.fields.title || "TÍTULO DO PROJETO").toUpperCase(), true, SECTION_SIZE),
          new Paragraph({ spacing: { before: 960 } }),
          centeredParagraph((input.fields.author || "AUTOR").toUpperCase(), true),
          new Paragraph({ spacing: { before: 480 } }),
          centeredParagraph(input.fields.location || "Lavras - MG", false, BODY_SIZE - 4),
          new Paragraph({ spacing: { before: 480 } }),
          centeredParagraph(input.fields.year || new Date().getFullYear().toString(), false, BODY_SIZE - 4),
          // Corpo do texto
          new Paragraph({ spacing: { before: 720 } }),
          ...blocks.flatMap((block) => blockToParagraph(block)),
          // Referências
          ...(references.length > 0
            ? [
                new Paragraph({ spacing: { before: 480 } }),
                sectionTitle("Referências"),
                ...references.map((ref) => referenceParagraph(ref)),
              ]
            : []),
          // Apêndices/Anexos se houver
          ...(input.fields.apendices
            ? [new Paragraph({ spacing: { before: 480 } }), sectionTitle("Apêndices"), ...splitParagraphs(input.fields.apendices).map((line) => paragraph(line))]
            : []),
          ...(input.fields.anexos
            ? [new Paragraph({ spacing: { before: 480 } }), sectionTitle("Anexos"), ...splitParagraphs(input.fields.anexos).map((line) => paragraph(line))]
            : []),
        ],
      },
    ],
  });
}

export async function generateResearchProjectDocxBlob(input: DocxGenerationInput): Promise<Blob> {
  return Packer.toBlob(buildDocument(input));
}