import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  PageOrientation,
  Paragraph,
  TextRun,
} from "docx";
import type { IParagraphOptions } from "docx";
import { parseEditorContent, type DocxGenerationInput, type EditorBlock } from "./export-docx";
import { CPG_RULES, UFLA_RULES } from "./ufla-rules";
import { normalizeReferences, type ReferenceRun } from "./references-normalizer";

const BLACK = "000000";
const BODY_SIZE = CPG_RULES.typography.bodyFontSizePt * 2;
const TITLE_SIZE = CPG_RULES.typography.titleFontSizePt * 2;
const SECTION_SIZE = CPG_RULES.typography.sectionTitleFontSizePt * 2;
const SUBSECTION_SIZE = CPG_RULES.typography.subsectionTitleFontSizePt * 2;
const EMAIL_SIZE = CPG_RULES.typography.emailFontSizePt * 2;
const SINGLE_LINE = 240;
const SIX_PT = 120;
const TWELVE_PT = 240;

interface RunOptions {
  bold?: boolean;
  italics?: boolean;
  size?: number;
  font?: string;
}

type DocxHeadingLevel = (typeof HeadingLevel)[keyof typeof HeadingLevel];

function hasText(value: string): boolean {
  return value.trim().length > 0;
}

function splitParagraphs(value: string): string[] {
  return value
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function run(text: string, options: RunOptions = {}): TextRun {
  return new TextRun({
    text,
    font: CPG_RULES.typography.fontFamily,
    size: BODY_SIZE,
    color: BLACK,
    ...options,
  });
}

function textRunsFromMarkup(text: string, size = BODY_SIZE, font: string = CPG_RULES.typography.fontFamily): TextRun[] {
  const runs: TextRun[] = [];
  const tokenPattern = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(text)) !== null) {
    if (match.index > cursor) {
      runs.push(run(text.slice(cursor, match.index), { size, font }));
    }

    const token = match[0];
    const bold = token.startsWith("**");
    runs.push(run(bold ? token.slice(2, -2) : token.slice(1, -1), { bold, italics: !bold, size, font }));
    cursor = match.index + token.length;
  }

  if (cursor < text.length) runs.push(run(text.slice(cursor), { size, font }));
  return runs.length ? runs : [run(" ", { size, font })];
}

function paragraph(text: string, options: Partial<IParagraphOptions> = {}): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.BOTH,
    spacing: { before: SIX_PT, after: 0, line: SINGLE_LINE },
    indent: { firstLine: CPG_RULES.typography.paragraphFirstLineCm * 1440 / 2.54 },
    children: textRunsFromMarkup(text || " "),
    ...options,
  });
}

function titleParagraph(text: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: TWELVE_PT, after: TWELVE_PT, line: SINGLE_LINE },
    children: [run(text || "Titulo do trabalho", { bold: true, size: TITLE_SIZE })],
  });
}

function centered(text: string, bold = false, size = BODY_SIZE, font: string = CPG_RULES.typography.fontFamily): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: TWELVE_PT, line: SINGLE_LINE },
    children: [run(text, { bold, size, font })],
  });
}

function abstractParagraph(label: string, value: string): Paragraph[] {
  if (!hasText(value)) return [];
  return splitParagraphs(value).map(
    (line, index) =>
      new Paragraph({
        alignment: AlignmentType.BOTH,
        spacing: { before: SIX_PT, after: 0, line: SINGLE_LINE },
        indent: {
          left: CPG_RULES.typography.abstractSideIndentCm * 1440 / 2.54,
          right: CPG_RULES.typography.abstractSideIndentCm * 1440 / 2.54,
        },
        children:
          index === 0
            ? [run(`${label}. `, { bold: true }), ...textRunsFromMarkup(line)]
            : textRunsFromMarkup(line),
      }),
  );
}

function sectionTitle(text: string, level: DocxHeadingLevel = HeadingLevel.HEADING_1): Paragraph {
  return new Paragraph({
    heading: level,
    alignment: AlignmentType.LEFT,
    spacing: { before: TWELVE_PT, after: 0, line: SINGLE_LINE },
    children: [
      run(text, {
        bold: level !== HeadingLevel.HEADING_3,
        size: level === HeadingLevel.HEADING_1 ? SECTION_SIZE : SUBSECTION_SIZE,
      }),
    ],
  });
}

function blockToParagraph(block: EditorBlock, isFirstParagraphAfterTitle: boolean): Paragraph[] {
  if (block.type === "heading1") return [sectionTitle(block.text, HeadingLevel.HEADING_1)];
  if (block.type === "heading2") return [sectionTitle(block.text, HeadingLevel.HEADING_2)];
  if (block.type === "heading3") return [sectionTitle(block.text, HeadingLevel.HEADING_3)];
  if (block.type === "longQuote") {
    return [
      paragraph(block.text, {
        indent: { left: UFLA_RULES.typography.longQuoteLeftIndentTwip },
      }),
    ];
  }
  if (block.type === "scheduleTable") return splitParagraphs(block.text).map((line) => paragraph(line));
  return [
    paragraph(block.text, {
      indent: { firstLine: isFirstParagraphAfterTitle ? 0 : CPG_RULES.typography.paragraphFirstLineCm * 1440 / 2.54 },
    }),
  ];
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
            spacing: { before: SIX_PT, after: 0, line: SINGLE_LINE },
            indent: {
              left: CPG_RULES.typography.referenceHangingCm * 1440 / 2.54,
              hanging: CPG_RULES.typography.referenceHangingCm * 1440 / 2.54,
            },
            children: reference.runs.length
              ? reference.runs.map(referenceRunToTextRun)
              : [run(reference.text || " ")],
          }),
      ),
  ];
}

function cpgResumoChildren(input: DocxGenerationInput): Paragraph[] {
  return [
    titleParagraph(input.fields.title),
    centered(input.fields.author || "Autores", true),
    ...(hasText(input.fields.program) ? [centered(input.fields.program)] : []),
    ...(hasText(input.fields.course)
      ? [centered(input.fields.course, false, EMAIL_SIZE, CPG_RULES.typography.emailFontFamily)]
      : []),
    ...(hasText(input.fields.palavrasChave)
      ? [paragraph(`Palavras-chave: ${input.fields.palavrasChave}`, { indent: { firstLine: 0 } })]
      : []),
    ...splitParagraphs(input.fields.resumo || input.editorText).map((line, index) =>
      paragraph(line, { indent: { firstLine: index === 0 ? 0 : CPG_RULES.typography.paragraphFirstLineCm * 1440 / 2.54 } }),
    ),
    ...(hasText(input.fields.agradecimentos)
      ? [sectionTitle("Agradecimentos"), ...splitParagraphs(input.fields.agradecimentos).map((line) => paragraph(line))]
      : []),
  ];
}

function cpgFullChildren(input: DocxGenerationInput): Paragraph[] {
  const blocks = parseEditorContent(input.editorText);
  const bodyBlocks = blocks.filter((block) => block.type !== "reference");
  const references = [
    ...splitParagraphs(input.fields.referencias),
    ...blocks.filter((block) => block.type === "reference").map((block) => block.text),
  ];
  let firstBodyParagraph = true;

  return [
    titleParagraph(input.fields.title),
    centered(input.fields.author || "Autores", true),
    ...(hasText(input.fields.program) ? [centered(input.fields.program)] : []),
    ...(hasText(input.fields.course)
      ? [centered(input.fields.course, false, EMAIL_SIZE, CPG_RULES.typography.emailFontFamily)]
      : []),
    ...abstractParagraph("Abstract", input.fields.abstractText),
    ...(hasText(input.fields.keywords)
      ? [paragraph(`Keywords: ${input.fields.keywords}`, { indent: { firstLine: 0 } })]
      : []),
    ...abstractParagraph("Resumo", input.fields.resumo),
    ...(hasText(input.fields.palavrasChave)
      ? [paragraph(`Palavras-chave: ${input.fields.palavrasChave}`, { indent: { firstLine: 0 } })]
      : []),
    ...bodyBlocks.flatMap((block) => {
      const paragraphs = blockToParagraph(block, firstBodyParagraph);
      if (block.type === "paragraph") firstBodyParagraph = false;
      return paragraphs;
    }),
    ...referenceParagraphs(references),
  ];
}

function createCpgDocument(input: DocxGenerationInput): Document {
  const isResumo = input.fields.workType === "resumo_cpg";
  return new Document({
    creator: "UFLA DOCX Academico",
    title: input.fields.title || "Trabalho CPG UFLA",
    description: "Documento CPG/UFLA sem capa, sumario, cabecalho, rodape ou numeracao.",
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
        },
        children: isResumo ? cpgResumoChildren(input) : cpgFullChildren(input),
      },
    ],
  });
}

export async function generateCpgDocxBlob(input: DocxGenerationInput): Promise<Blob> {
  return Packer.toBlob(createCpgDocument(input));
}
