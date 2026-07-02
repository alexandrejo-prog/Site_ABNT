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
import { CPG_RULES, UFLA_RULES, cmToTwip } from "./ufla-rules";

const BLACK = "000000";
const BODY_SIZE = CPG_RULES.typography.bodyFontSizePt * 2;
const TITLE_SIZE = CPG_RULES.typography.titleFontSizePt * 2;
const SECTION_SIZE = CPG_RULES.typography.sectionTitleFontSizePt * 2;
const SUBSECTION_SIZE = CPG_RULES.typography.subsectionTitleFontSizePt * 2;
const EMAIL_SIZE = CPG_RULES.typography.emailFontSizePt * 2;
const CAPTION_SIZE = 20;
const SINGLE_LINE = 240;
const SIX_PT = 120;
const TWELVE_PT = 240;
const ABSTRACT_INDENT = cmToTwip(CPG_RULES.typography.abstractSideIndentCm);
const BODY_FIRST_LINE = cmToTwip(CPG_RULES.typography.paragraphFirstLineCm);
const REFERENCE_HANGING = cmToTwip(CPG_RULES.typography.referenceHangingCm);

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

function stripMarkup(value: string): string {
  return value.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1");
}

function run(text: string, options: RunOptions = {}): TextRun {
  return new TextRun({
    text,
    font: options.font ?? CPG_RULES.typography.fontFamily,
    size: options.size ?? BODY_SIZE,
    color: BLACK,
    bold: options.bold,
    italics: options.italics,
  });
}

function textRunsFromMarkup(text: string, size = BODY_SIZE, font = CPG_RULES.typography.fontFamily): TextRun[] {
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
    indent: { firstLine: BODY_FIRST_LINE },
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

function centered(
  text: string,
  bold = false,
  size = BODY_SIZE,
  font: string = CPG_RULES.typography.fontFamily,
  spacing: NonNullable<IParagraphOptions["spacing"]> = { after: TWELVE_PT, line: SINGLE_LINE },
): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing,
    children: [run(text, { bold, size, font })],
  });
}

function affiliationParagraphs(value: string): Paragraph[] {
  return splitParagraphs(value).map((line) =>
    centered(line, false, BODY_SIZE, CPG_RULES.typography.fontFamily, { after: 0, line: SINGLE_LINE }),
  );
}

function emailParagraph(value: string): Paragraph[] {
  if (!hasText(value)) return [];
  return [
    centered(value, false, EMAIL_SIZE, CPG_RULES.typography.emailFontFamily, {
      before: SIX_PT,
      after: SIX_PT,
      line: SINGLE_LINE,
    }),
  ];
}

function insetLabeledParagraph(label: string, text: string, separator: "." | ":" = "."): Paragraph[] {
  if (!hasText(text)) return [];
  return splitParagraphs(text).map(
    (line, index) =>
      new Paragraph({
        alignment: AlignmentType.BOTH,
        spacing: { before: SIX_PT, after: 0, line: SINGLE_LINE },
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
    spacing: { before: TWELVE_PT, after: 0, line: SINGLE_LINE },
    children: [
      run(text, {
        bold: level !== HeadingLevel.HEADING_3,
        size: level === HeadingLevel.HEADING_1 ? SECTION_SIZE : SUBSECTION_SIZE,
      }),
    ],
  });
}

function captionParagraph(text: string, tableCaption: boolean): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: SIX_PT, after: SIX_PT, line: SINGLE_LINE },
    indent: { left: ABSTRACT_INDENT, right: ABSTRACT_INDENT },
    children: [
      run(text, {
        bold: true,
        size: CAPTION_SIZE,
        font: "Helvetica",
      }),
    ],
    ...(tableCaption ? {} : {}),
  });
}

function isCaption(text: string): "figure" | "table" | null {
  if (/^(figura|imagem)\s+\d+/i.test(text.trim())) return "figure";
  if (/^(tabela|quadro)\s+\d+/i.test(text.trim())) return "table";
  return null;
}

function blockToParagraph(block: EditorBlock, firstParagraphInSection: boolean): Paragraph[] {
  if (block.type === "heading1") return [sectionTitle(block.text, HeadingLevel.HEADING_1)];
  if (block.type === "heading2") return [sectionTitle(block.text, HeadingLevel.HEADING_2)];
  if (block.type === "heading3") return [sectionTitle(block.text, HeadingLevel.HEADING_3)];
  if (block.type === "longQuote") {
    return [
      paragraph(block.text, {
        indent: { left: UFLA_RULES.typography.longQuoteLeftIndentTwip, firstLine: 0 },
      }),
    ];
  }
  if (block.type === "scheduleTable") {
    return splitParagraphs(block.text).map((line) => paragraph(line, { indent: { firstLine: 0 } }));
  }

  const caption = isCaption(block.text);
  if (caption) return [captionParagraph(block.text, caption === "table")];

  return [
    paragraph(block.text, {
      indent: { firstLine: firstParagraphInSection ? 0 : BODY_FIRST_LINE },
    }),
  ];
}

function isReferenceTitleNoise(text: string): boolean {
  const normalized = text.trim().toUpperCase();
  return /^(REFERENCIAS|REFERÊNCIAS|BIBLIOGRÁFICAS|BIBLIOGRAFICAS)$/.test(normalized);
}

function referenceTitleFor(references: string[]): string {
  const upper = references.map((r) => r.trim().toUpperCase());
  const hasRef = upper.some((r) => /^(REFERENCIAS|REFERÊNCIAS)$/.test(r));
  const hasBiblio = upper.some((r) => /^(BIBLIOGRÁFICAS|BIBLIOGRAFICAS)$/.test(r));
  if (hasRef && hasBiblio) return "REFERÊNCIAS BIBLIOGRÁFICAS";
  if (hasBiblio) return "REFERÊNCIAS BIBLIOGRÁFICAS";
  return "Referencias";
}

function filterReferenceNoise(reference: string): boolean {
  return !isReferenceTitleNoise(reference);
}

function referenceParagraphs(references: string[]): Paragraph[] {
  const cleanReferences = references
    .map((item) => stripMarkup(item).trim())
    .filter(Boolean)
    .filter(filterReferenceNoise);
  if (!cleanReferences.length) return [];

  const title = referenceTitleFor(references);
  return [
    sectionTitle(title),
    ...cleanReferences
      .sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }))
      .map(
        (reference) =>
          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { before: SIX_PT, after: 0, line: SINGLE_LINE },
            indent: {
              left: REFERENCE_HANGING,
              hanging: REFERENCE_HANGING,
            },
            children: textRunsFromMarkup(reference),
          }),
      ),
  ];
}

function cpgResumoChildren(input: DocxGenerationInput): Paragraph[] {
  return [
    titleParagraph(input.fields.title),
    centered(input.fields.author || "Autores", true),
    ...affiliationParagraphs(input.fields.program),
    ...emailParagraph(input.fields.course),
    ...(hasText(input.fields.abstractText)
      ? insetLabeledParagraph("Abstract", input.fields.abstractText, ".")
      : []),
    ...(hasText(input.fields.keywords)
      ? insetLabeledParagraph("Keywords", input.fields.keywords, ":")
      : []),
    ...(hasText(input.fields.resumo)
      ? insetLabeledParagraph("Resumo", input.fields.resumo, ".")
      : []),
    ...(hasText(input.fields.palavrasChave)
      ? insetLabeledParagraph("Palavras-chave", input.fields.palavrasChave, ":")
      : []),
    ...(hasText(input.fields.agradecimentos)
      ? [
          sectionTitle("Agradecimentos"),
          ...splitParagraphs(input.fields.agradecimentos).map((line) =>
            paragraph(line, { indent: { firstLine: 0 } }),
          ),
        ]
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
  let firstParagraphInSection = true;

  return [
    titleParagraph(input.fields.title),
    centered(input.fields.author || "Autores", true),
    ...affiliationParagraphs(input.fields.program),
    ...emailParagraph(input.fields.course),
    ...insetLabeledParagraph("Abstract", input.fields.abstractText, "."),
    ...insetLabeledParagraph("Keywords", input.fields.keywords, ":"),
    ...insetLabeledParagraph("Resumo", input.fields.resumo, "."),
    ...insetLabeledParagraph("Palavras-chave", input.fields.palavrasChave, ":"),
    ...bodyBlocks.flatMap((block) => {
      if (block.type === "heading1" || block.type === "heading2" || block.type === "heading3") {
        firstParagraphInSection = true;
        return blockToParagraph(block, true);
      }

      const paragraphs = blockToParagraph(block, firstParagraphInSection);
      if (block.type === "paragraph") firstParagraphInSection = false;
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
