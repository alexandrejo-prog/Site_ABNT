import {
  AlignmentType,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  PageBreak,
  PageOrientation,
  Paragraph,
  SectionType,
  TextRun,
  Header,
  PageNumber,
} from "docx";
import type { IParagraphOptions } from "docx";
import { AcademicFields, UFLA_RULES } from "./ufla-rules";
import { normalizeReferences, type ReferenceRun } from "./references-normalizer";
import { normalizeForDetection } from "./word-structure-extractor";

export type EditorBlockType =
  | "paragraph"
  | "heading1"
  | "heading2"
  | "longQuote"
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

export const DEFAULT_UFLA_LOGO_PATH = "/assets/ufla-logo.jpeg";

const BODY_SIZE = UFLA_RULES.typography.bodyFontSizePt * 2;
const LONG_QUOTE_SIZE = UFLA_RULES.typography.longQuoteFontSizePt * 2;
const ONE_AND_HALF_LINE = 360;
const SINGLE_LINE = 240;
const BLACK = "000000";
const REFERENCE_FONT = "Times New Roman";
const REFERENCE_SIZE = 12 * 2;

export function parseEditorContent(editorText: string): EditorBlock[] {
  return editorText
    .split(/\r?\n/)
    .map((line): EditorBlock | null => {
      const trimmed = line.trim();
      if (!trimmed) return null;
      if (trimmed.startsWith("## ")) {
        return { type: "heading2", text: trimmed.replace(/^##\s+/, "") };
      }
      if (trimmed.startsWith("# ")) {
        return { type: "heading1", text: trimmed.replace(/^#\s+/, "") };
      }
      if (trimmed.startsWith("> ")) {
        return { type: "longQuote", text: trimmed.replace(/^>\s+/, "") };
      }
      if (/^\[REF\]\s+/i.test(trimmed)) {
        return { type: "reference", text: trimmed.replace(/^\[REF\]\s+/i, "") };
      }
      return { type: "paragraph", text: trimmed };
    })
    .filter((block): block is EditorBlock => Boolean(block));
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
    spacing: { line: ONE_AND_HALF_LINE, after: 120 },
    indent: { firstLine: UFLA_RULES.typography.paragraphFirstLineTwip },
    children: textRunsFromMarkup(text || " "),
    ...options,
  });
}

function simpleParagraph(text: string, options: Partial<IParagraphOptions> = {}): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.BOTH,
    spacing: { line: SINGLE_LINE, after: 120 },
    children: textRunsFromMarkup(text || " "),
    ...options,
  });
}

function centeredParagraph(text: string, bold = false): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 240 },
    children: [
      new TextRun({
        text,
        bold,
        font: UFLA_RULES.typography.fontFamily,
        size: BODY_SIZE,
        color: BLACK,
      }),
    ],
  });
}

function logoParagraph(logo?: DocxLogoAsset): Paragraph[] {
  if (!logo) return [centeredParagraph("UNIVERSIDADE FEDERAL DE LAVRAS", true)];

  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [
        new ImageRun({
          data: logo.data,
          transformation: {
            width: logo.width ?? 170,
            height: logo.height ?? 62,
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

function blockToParagraph(block: EditorBlock, isFirstTextualBlock: boolean = false): Paragraph[] {
  if (block.type === "heading1") {
    // Seções primárias (exceto a primeira) devem iniciar em nova página
    if (!isFirstTextualBlock) {
      return [pageBreak(), new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 240, after: 180, line: ONE_AND_HALF_LINE },
        children: [
          new TextRun({
            text: block.text.toUpperCase(),
            bold: true,
            font: UFLA_RULES.typography.fontFamily,
            size: BODY_SIZE,
            color: BLACK,
          }),
        ],
      })];
    }

    return [new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 240, after: 180, line: ONE_AND_HALF_LINE },
      children: [
        new TextRun({
          text: block.text.toUpperCase(),
          bold: true,
          font: UFLA_RULES.typography.fontFamily,
          size: BODY_SIZE,
          color: BLACK,
        }),
      ],
    })];
  }

  if (block.type === "heading2") {
    return [new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 180, after: 120, line: ONE_AND_HALF_LINE },
      children: [
        new TextRun({
          text: block.text,
          bold: true,
          font: UFLA_RULES.typography.fontFamily,
          size: BODY_SIZE,
          color: BLACK,
        }),
      ],
    })];
  }

  if (block.type === "longQuote") {
    return [new Paragraph({
      alignment: AlignmentType.BOTH,
      spacing: { line: SINGLE_LINE, after: 120 },
      indent: { left: UFLA_RULES.typography.longQuoteLeftIndentTwip },
      children: textRunsFromMarkup(block.text, LONG_QUOTE_SIZE),
    })];
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
  return normalizeReferences(references).map((reference) =>
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { line: SINGLE_LINE, after: 120 },
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

function buildSummary(
  bodyBlocks: EditorBlock[],
  references: string[],
  fields: AcademicFields,
): Paragraph[] {
  const entries = bodyBlocks
    .filter((block) => block.type === "heading1" || block.type === "heading2")
    .map((block) => ({
      level: block.type === "heading2" ? 2 : 1,
      text: block.text.toUpperCase(),
    }));

  if (references.length) entries.push({ level: 1, text: "REFERÊNCIAS" });
  if (fields.apendices) entries.push({ level: 1, text: "APÊNDICES" });
  if (fields.anexos) entries.push({ level: 1, text: "ANEXOS" });

  if (!entries.length) return [];

  return [
    pageBreak(),
    unnumberedTitle("Sumário"),
    ...entries.map(
      (entry) =>
        new Paragraph({
          spacing: { line: ONE_AND_HALF_LINE, after: 80 },
          indent: { left: entry.level === 2 ? 360 : 0 },
          children: [
            new TextRun({
              text: entry.text,
              font: UFLA_RULES.typography.fontFamily,
              size: BODY_SIZE,
              color: BLACK,
            }),
          ],
        }),
    ),
  ];
}

function hasText(value: string): boolean {
  return value.trim().length > 0;
}

export function calculateTextualStartPage(
  fields: AcademicFields,
  hasSummary: boolean,
): number {
  const impactRequired = fields.workType === "dissertacao" || fields.workType === "tese";
  let countedPreTextualPages = 1; // Folha de rosto. Capa e ficha catalográfica não contam.

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

function coverChildren(fields: AcademicFields, logo?: DocxLogoAsset): Paragraph[] {
  return [
    ...logoParagraph(logo),
    new Paragraph({ spacing: { before: 1200 } }),
    centeredParagraph(fields.author || "AUTOR"),
    new Paragraph({ spacing: { before: 1800 } }),
    centeredParagraph((fields.title || "TÍTULO DO TRABALHO").toUpperCase(), true),
    ...(fields.subtitle ? [centeredParagraph(fields.subtitle.toUpperCase(), true)] : []),
    new Paragraph({ spacing: { before: 2200 } }),
    centeredParagraph(fields.location || "LAVRAS - MG"),
    centeredParagraph(fields.year || new Date().getFullYear().toString()),
  ];
}

function titlePageChildren(fields: AcademicFields): Paragraph[] {
  const nature =
    fields.workNature ||
    "Trabalho apresentado à Universidade Federal de Lavras como requisito acadêmico, conforme dados revisados pelo usuário.";

  return [
    centeredParagraph(fields.author || "AUTOR"),
    new Paragraph({ spacing: { before: 1500 } }),
    centeredParagraph((fields.title || "TÍTULO DO TRABALHO").toUpperCase(), true),
    ...(fields.subtitle ? [centeredParagraph(fields.subtitle.toUpperCase(), true)] : []),
    new Paragraph({ spacing: { before: 900 } }),
    textParagraph(nature, {
      indent: { left: UFLA_RULES.typography.longQuoteLeftIndentTwip },
      spacing: { line: SINGLE_LINE, after: 180 },
    }),
    ...buildSimpleParagraphs(
      [
        fields.course ? `Curso: ${fields.course}` : "",
        fields.program ? `Programa: ${fields.program}` : "",
        fields.advisor ? `Orientador(a): ${fields.advisor}` : "",
        fields.coadvisor ? `Coorientador(a): ${fields.coadvisor}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    ),
    new Paragraph({ spacing: { before: 1500 } }),
    centeredParagraph(fields.location || "LAVRAS - MG"),
    centeredParagraph(fields.year || new Date().getFullYear().toString()),
  ];
}

function optionalPage(title: string, content: string): Paragraph[] {
  if (!content.trim()) return [];
  return [pageBreak(), sectionTitle(title), ...buildSimpleParagraphs(content)];
}

function preTextualChildren(fields: AcademicFields): Paragraph[] {
  const impactRequired = fields.workType === "dissertacao" || fields.workType === "tese";
  const indicadores =
    fields.indicadoresImpacto ||
    (impactRequired ? "Espaço reservado aos indicadores de impacto." : "");
  const impactIndicators =
    fields.impactIndicators ||
    (impactRequired ? "Reserved space for impact indicators." : "");

  return [
    pageBreak(),
    sectionTitle("Ficha catalográfica"),
    simpleParagraph(
      "Espaço reservado para ficha catalográfica elaborada pela Biblioteca Universitária da UFLA.",
    ),
    ...optionalPage("Dedicatória", fields.dedicatoria),
    ...optionalPage("Agradecimentos", fields.agradecimentos),
    ...optionalPage("Epígrafe", fields.epigrafe),
    pageBreak(),
    sectionTitle("Resumo"),
    simpleParagraph(fields.resumo || " "),
    ...(fields.palavrasChave
      ? [simpleParagraph(`Palavras-chave: ${fields.palavrasChave}`)]
      : []),
    pageBreak(),
    sectionTitle("Abstract"),
    simpleParagraph(fields.abstractText || " "),
    ...(fields.keywords ? [simpleParagraph(`Keywords: ${fields.keywords}`)] : []),
    ...optionalPage("Indicadores de impacto", indicadores),
    ...optionalPage("Impact indicators", impactIndicators),
  ];
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
  const summaryChildren = buildSummary(bodyBlocks, references, fields);
  const textualStartPage = calculateTextualStartPage(fields, summaryChildren.length > 0);

  const preTextualChildrenList: Paragraph[] = [
    ...coverChildren(fields, input.logo),
    pageBreak(),
    ...titlePageChildren(fields),
    ...preTextualChildren(fields),
    ...summaryChildren,
  ];

  const textualAndPostTextualChildren: Paragraph[] = [
    ...bodyBlocks.flatMap((block, index) => blockToParagraph(block, index === 0)),
    pageBreak(),
    sectionTitle("Referências"),
    ...buildReferences(references),
    ...(fields.anexos
      ? [pageBreak(), sectionTitle("Anexos"), ...buildSimpleParagraphs(fields.anexos)]
      : []),
    ...(fields.apendices
      ? [pageBreak(), sectionTitle("Apêndices"), ...buildSimpleParagraphs(fields.apendices)]
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
            margin: {
              top: UFLA_RULES.margins.topTwip,
              left: UFLA_RULES.margins.leftTwip,
              bottom: UFLA_RULES.margins.bottomTwip,
              right: UFLA_RULES.margins.rightTwip,
            },
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
      width: 170,
      height: 62,
    };
  } catch {
    return undefined;
  }
}

export async function generateDocxBlob(input: DocxGenerationInput): Promise<Blob> {
  const logo = input.logo ?? (await loadDefaultLogoAsset());
  return Packer.toBlob(createDocxDocument({ ...input, logo }));
}
