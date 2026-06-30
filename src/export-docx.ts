import JSZip from "jszip";
import {
  AlignmentType,
  Document,
  HeadingLevel,
  Header,
  ImageRun,
  Packer,
  PageBreak,
  PageNumber,
  PageOrientation,
  Paragraph,
  TableOfContents,
  TextRun,
} from "docx";
import type { IParagraphOptions } from "docx";
import { AcademicFields, UFLA_RULES } from "./ufla-rules";
import { normalizeReferences, type ReferenceRun } from "./references-normalizer";
import { normalizeForDetection } from "./word-structure-extractor";

export type EditorBlockType =
  | "paragraph"
  | "heading1"
  | "heading2"
  | "heading3"
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
      if (trimmed.startsWith("### ")) {
        return { type: "heading3", text: trimmed.replace(/^###\s+/, "") };
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
    const title = new Paragraph({
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
    });

    return isFirstTextualBlock ? [title] : [pageBreak(), title];
  }

  if (block.type === "heading2") {
    return [
      new Paragraph({
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
      }),
    ];
  }

  if (block.type === "heading3") {
    return [
      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 120, after: 100, line: ONE_AND_HALF_LINE },
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
      { type: "heading1", text: "1 INTRODUÃ‡ÃƒO" },
      ...splitParagraphs(fields.introducao).map((text) => ({ type: "paragraph" as const, text })),
    );
  }

  if (fields.conclusao && !hasEditorConclusionHeading(nextBlocks)) {
    nextBlocks.push(
      {
        type: "heading1",
        text: usesFinalConsiderationsHeading(nextBlocks) ? "6 CONSIDERAÃ‡Ã•ES FINAIS" : "CONCLUSÃƒO",
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
): Array<Paragraph | TableOfContents> {
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
    unnumberedTitle("SumÃ¡rio"),
    new TableOfContents("", {
      headingStyleRange: "1-3",
      hyperlink: true,
      hideTabAndPageNumbersInWebView: true,
      useAppliedParagraphOutlineLevel: true,
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 120 },
      children: [
        new TextRun({
          text: "ApÃ³s abrir no Word, atualize o sumÃ¡rio com F9 para recalcular pÃ¡ginas.",
          font: UFLA_RULES.typography.fontFamily,
          size: UFLA_RULES.typography.noteFontSizePt * 2,
          italics: true,
          color: BLACK,
        }),
      ],
    }),
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
  let countedPreTextualPages = 1; // Folha de rosto. Capa e ficha catalogrÃ¡fica nÃ£o contam.

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
    centeredParagraph((fields.title || "TÃTULO DO TRABALHO").toUpperCase(), true),
    ...(fields.subtitle ? [centeredParagraph(fields.subtitle.toUpperCase(), true)] : []),
    new Paragraph({ spacing: { before: 2200 } }),
    centeredParagraph(fields.location || "LAVRAS - MG"),
    centeredParagraph(fields.year || new Date().getFullYear().toString()),
  ];
}

function titlePageChildren(fields: AcademicFields): Paragraph[] {
  const nature =
    fields.workNature ||
    "Trabalho apresentado Ã  Universidade Federal de Lavras como requisito acadÃªmico, conforme dados revisados pelo usuÃ¡rio.";

  return [
    centeredParagraph(fields.author || "AUTOR"),
    new Paragraph({ spacing: { before: 1500 } }),
    centeredParagraph((fields.title || "TÃTULO DO TRABALHO").toUpperCase(), true),
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
    (impactRequired ? "EspaÃ§o reservado aos indicadores de impacto." : "");
  const impactIndicators =
    fields.impactIndicators ||
    (impactRequired ? "Reserved space for impact indicators." : "");

  return [
    pageBreak(),
    sectionTitle("Ficha catalogrÃ¡fica"),
    simpleParagraph(
      "EspaÃ§o reservado para ficha catalogrÃ¡fica elaborada pela Biblioteca UniversitÃ¡ria da UFLA.",
    ),
    ...optionalPage("DedicatÃ³ria", fields.dedicatoria),
    ...optionalPage("Agradecimentos", fields.agradecimentos),
    ...optionalPage("EpÃ­grafe", fields.epigrafe),
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

  const preTextualChildrenList: Array<Paragraph | TableOfContents> = [
    ...coverChildren(fields, input.logo),
    pageBreak(),
    ...titlePageChildren(fields),
    ...preTextualChildren(fields),
    ...summaryChildren,
  ];

  const textualAndPostTextualChildren: Paragraph[] = [
    ...bodyBlocks.flatMap((block, index) => blockToParagraph(block, index === 0)),
    pageBreak(),
    sectionTitle("ReferÃªncias"),
    ...buildReferences(references),
    ...(fields.anexos
      ? [pageBreak(), sectionTitle("Anexos"), ...buildSimpleParagraphs(fields.anexos)]
      : []),
    ...(fields.apendices
      ? [pageBreak(), sectionTitle("ApÃªndices"), ...buildSimpleParagraphs(fields.apendices)]
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
    creator: "UFLA DOCX AcadÃªmico",
    title: fields.title || "Trabalho acadÃªmico",
    description: "Documento acadÃªmico gerado conforme regras centrais da UFLA.",
    features: {
      updateFields: true,
    },
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

function decodeXmlText(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function escapeXmlText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function textFromParagraphXml(paragraphXml: string): string {
  return [...paragraphXml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)]
    .map((match) => decodeXmlText(match[1]))
    .join("")
    .trim();
}

function headingLevelFromParagraphXml(paragraphXml: string): number | undefined {
  const match = paragraphXml.match(/<w:pStyle\s+w:val="Heading([123])"\s*\/>/);
  return match ? Number(match[1]) : undefined;
}

function removeHeadingMarkup(paragraphXml: string): string {
  return paragraphXml
    .replace(/<w:pStyle\s+w:val="Heading[123]"\s*\/>/g, "")
    .replace(/<w:outlineLvl\s+w:val="[0-9]+"\s*\/>/g, "");
}

function tcFieldXml(title: string, level: number): string {
  const safeTitle = escapeXmlText(title);
  return [
    '<w:r><w:rPr><w:vanish/></w:rPr><w:fldChar w:fldCharType="begin"/></w:r>',
    `<w:r><w:rPr><w:vanish/></w:rPr><w:instrText xml:space="preserve"> TC &quot;${safeTitle}&quot; \\l ${level} </w:instrText></w:r>`,
    '<w:r><w:rPr><w:vanish/></w:rPr><w:fldChar w:fldCharType="separate"/></w:r>',
    '<w:r><w:rPr><w:vanish/></w:rPr><w:fldChar w:fldCharType="end"/></w:r>',
  ].join("");
}

function insertTcField(paragraphXml: string, title: string, level: number): string {
  return paragraphXml.replace(/(<w:p\b[^>]*>)/, `$1${tcFieldXml(title, level)}`);
}

function replaceTocInstruction(documentXml: string): string {
  return documentXml
    .replace(
      /TOC\s+\\h\s+\\o\s+(?:&quot;|")1-3(?:&quot;|")\s+\\u\s+\\z/g,
      "TOC \\f \\h \\z",
    )
    .replace(
      /TOC\s+\\o\s+(?:&quot;|")1-3(?:&quot;|")\s+\\h\s+\\z\s+\\u/g,
      "TOC \\f \\h \\z",
    )
    .replace(
      /TOC\s+\\o\s+(?:&quot;|")1-3(?:&quot;|")\s+\\h\s+\\z/g,
      "TOC \\f \\h \\z",
    );
}

function postProcessDocumentXml(documentXml: string): string {
  let afterSummaryInstruction = false;

  const processed = documentXml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (paragraphXml) => {
    const level = headingLevelFromParagraphXml(paragraphXml);
    const text = textFromParagraphXml(paragraphXml);
    let next = paragraphXml;

    if (level && afterSummaryInstruction && text) {
      next = insertTcField(next, text, level);
    }

    next = removeHeadingMarkup(next);

    if (text.includes("ApÃ³s abrir no Word, atualize o sumÃ¡rio")) {
      afterSummaryInstruction = true;
    }

    return next;
  });

  return replaceTocInstruction(processed);
}

async function postProcessDocxBlob(blob: Blob): Promise<Blob> {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const documentFile = zip.file("word/document.xml");
  if (!documentFile) return blob;

  const documentXml = await documentFile.async("string");
  zip.file("word/document.xml", postProcessDocumentXml(documentXml));

  return zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
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
  const blob = await Packer.toBlob(createDocxDocument({ ...input, logo }));
  return postProcessDocxBlob(blob);
}

