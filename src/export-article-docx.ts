import {
  AlignmentType,
  Document,
  Header,
  HeadingLevel,
  InternalHyperlink,
  Packer,
  PageNumber,
  PageOrientation,
  Paragraph,
  Table,
  TextRun,
} from "docx";
import type { IParagraphOptions } from "docx";
import { parseEditorContent, importedTableParagraph, importedImageParagraph, buildFootnoteIdMap, buildFootnotes, textRunsWithFootnotes, buildReferenceFootnoteDefinitions, appendFootnoteMarkers, buildXrefResolver, type DocxGenerationInput, type EditorBlock } from "./export-docx";
import { registerXrefResolver, clearXrefRegistry } from "./docx-render-core";
import type { ImportedTable } from "./imported-tables";
import { DOCUMENT_STYLES } from "./docx-styles";
import type { ImportedDocumentImage } from "./imported-images";
import { UFLA_RULES, cmToTwip } from "./ufla-rules";
import { normalizeReferences, type ReferenceRun } from "./references-normalizer";
import { cleanMojibakeText, longQuoteParagraph, rawOmmlMarkerParagraph, sourceParagraph, splitParagraphs as coreSplitParagraphs, textRunsFromMarkup as coreTextRunsFromMarkup, tabbedTableBlock } from "./docx-render-core";

const BLACK = "000000";
const BODY_SIZE = UFLA_RULES.typography.bodyFontSizePt * 2;
const SINGLE_LINE = UFLA_RULES.spacing.singleLineTwip;
const ONE_AND_HALF_LINE = UFLA_RULES.spacing.bodyLineTwip;

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

function normalizeSemicolonKeywords(value: string): string {
  return value.replace(/\s*;\s*/g, "; ").replace(/;\s*$/, "").trim();
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

  let rest = blocks.slice(firstBodyIndex);

  const skipHeadings = new Set(["RESUMO", "ABSTRACT", "PALAVRAS-CHAVE", "KEYWORDS"]);
  while (rest.length > 0) {
    const first = rest[0];
    if (first.type !== "heading1" && first.type !== "heading2") break;
    if (!skipHeadings.has(normalizeComparable(first.text))) break;
    let sectionEnd = 1;
    while (sectionEnd < rest.length) {
      const block = rest[sectionEnd];
      if (block.type === "heading1" || block.type === "heading2") break;
      sectionEnd += 1;
    }
    rest = rest.slice(sectionEnd);
  }

  return rest;
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

function textRunsFromMarkup(text: string): Array<TextRun | InternalHyperlink> {
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
    spacing: { after: UFLA_RULES.spacing.afterPrimaryTitleTwip, line: ONE_AND_HALF_LINE },
    children: [run(text, { bold, size })],
  });
}

function simpleParagraph(text: string): Paragraph {
  return new Paragraph({
    style: "ufla_corpo_texto",
    alignment: AlignmentType.LEFT,
    spacing: { line: SINGLE_LINE, after: UFLA_RULES.spacing.afterParagraphTwip },
    indent: {},
    children: textRunsFromMarkup(text || " "),
  });
}

function sectionTitle(text: string, level: DocxHeadingLevel = HeadingLevel.HEADING_1): Paragraph {
  const displayText = level === HeadingLevel.HEADING_1 ? text.toUpperCase() : text;
  const style = level === HeadingLevel.HEADING_1 ? "ufla_titulo_primario" : level === HeadingLevel.HEADING_2 ? "ufla_titulo_secundario" : "ufla_titulo_terciario";
  return new Paragraph({
    style,
    alignment: AlignmentType.LEFT,
    spacing: { before: UFLA_RULES.spacing.beforePrimaryTitleTwip, after: UFLA_RULES.spacing.afterPrimaryTitleTwip, line: ONE_AND_HALF_LINE },
    children: [run(displayText, { bold: level !== HeadingLevel.HEADING_3 })],
  });
}

function labeledSection(label: string, value: string): Paragraph[] {
  if (!hasText(value)) return [];
  return [
    centered(label.toUpperCase(), true),
    ...splitParagraphs(value).map((line) =>
      paragraph(line, {
        spacing: { line: SINGLE_LINE, after: UFLA_RULES.spacing.afterParagraphTwip },
        indent: { firstLine: 0 },
      }),
    ),
  ];
}

function blockToParagraph(
  block: EditorBlock,
  importedImages: ImportedDocumentImage[] = [],
  importedTables: ImportedTable[] = [],
  footnoteIdMap: ReadonlyMap<number, number> | null = null,
): ArticleChild[] {
  if (block.type === "heading1") return [sectionTitle(block.text, HeadingLevel.HEADING_1)];
  if (block.type === "heading2") return [sectionTitle(block.text, HeadingLevel.HEADING_2)];
  if (block.type === "heading3") return [sectionTitle(block.text, HeadingLevel.HEADING_3)];
  if (block.type === "longQuote") {
    return [longQuoteParagraph(block.text)];
  }
  if (block.type === "scheduleTable") return splitParagraphs(block.text).map((line) => paragraph(line));
  if (block.type === "tabbedTable") return tabbedTableBlock(block.text);
  if (block.type === "importedTable") {
    const table = importedTables.find((item) => item.id === block.text);
    if (!table) return [simpleParagraph("[Tabela importada: dados originais indisponiveis — reinsira manualmente]")];
    return importedTableParagraph(table);
  }
  if (block.type === "importedImage") {
    const image = importedImages.find((item) => item.id === block.text);
    if (!image) return [simpleParagraph("[Imagem importada: dados originais indisponiveis — reinsira manualmente]")];
    return importedImageParagraph(image);
  }
  if (block.type === "source") {
    return [sourceParagraph(block.text)];
  }
  if (block.type === "equation") {
    return [rawOmmlMarkerParagraph(block.text, block.ommlXml)];
  }
  if (block.type === "reference" || normalizeComparable(block.text) === "REFERENCIAS") return [];
  const runs = textRunsWithFootnotes(block.text, footnoteIdMap, BODY_SIZE);
  return [new Paragraph({ style: "ufla_corpo_texto", alignment: AlignmentType.BOTH, spacing: { line: ONE_AND_HALF_LINE, after: UFLA_RULES.spacing.afterParagraphTwip }, indent: { firstLine: cmToTwip(1.25) }, children: runs })];
}

function stripTrailingReferenceSection(blocks: EditorBlock[]): EditorBlock[] {
  const refIndex = blocks.findIndex((block) => {
    const normalized = normalizeComparable(block.text);
    return normalized === "REFERENCIAS" || normalized.startsWith("REFERENCIAS");
  });
  return refIndex === -1 ? blocks : blocks.slice(0, refIndex);
}

function referenceRunToTextRun(referenceRun: ReferenceRun): TextRun {
  return run(referenceRun.text, {
    bold: referenceRun.bold,
    italics: referenceRun.italics,
  });
}

function referenceParagraphs(references: string[]): (Paragraph | Table)[] {
  if (!references.length) return [];

  const children: Array<Paragraph | Table> = [];
  children.push(
    new Paragraph({
      style: "ufla_titulo_sem_indicativo",
      alignment: AlignmentType.CENTER,
      spacing: { before: UFLA_RULES.spacing.beforePrimaryTitleTwip, after: UFLA_RULES.spacing.afterPrimaryTitleTwip, line: ONE_AND_HALF_LINE },
      children: [run("REFERÊNCIAS".toUpperCase(), { bold: true })],
    }),
  );

  const normalized = normalizeReferences(references);
  const seen = new Set<string>();
  const deduped = normalized.filter((ref) => {
    const key = ref.text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  children.push(
    ...deduped
      .sort((a, b) => a.text.localeCompare(b.text, "pt-BR", { sensitivity: "base" }))
      .map(
        (reference) =>
          new Paragraph({
            style: "ufla_referencia",
            alignment: AlignmentType.LEFT,
            spacing: { line: SINGLE_LINE, after: UFLA_RULES.spacing.afterPrimaryTitleTwip },
            indent: { left: cmToTwip(0.5), hanging: cmToTwip(0.5) },
            children: reference.runs.length
              ? reference.runs.map(referenceRunToTextRun)
              : [run(reference.text || " ")],
          }),
      ),
  );
  return children;
}

function createArticleDocument(input: DocxGenerationInput): Document {
  const blocks = parseEditorContent(input.editorText);
  const bodyBlocks = stripTrailingReferenceSection(
    stripLeadingArticleMetadataBlocks(blocks, input),
  );
  const refBlocks = blocks.filter((block) => block.type === "reference").map((block) => block.text);
  let references = refBlocks.length ? refBlocks : splitParagraphs(input.fields.referencias);

  let articleFootnoteDefinitions: EditorBlock[] = [];

  if (input.fields.referencesPlacement === "footnote" && references.length > 0) {
    articleFootnoteDefinitions = buildReferenceFootnoteDefinitions(references);
    const editorTextWithMarkers = appendFootnoteMarkers(input.editorText, references.length);
    const blocksWithMarkers = parseEditorContent(editorTextWithMarkers);
    const bodyBlocksWithMarkers = stripTrailingReferenceSection(
      stripLeadingArticleMetadataBlocks(blocksWithMarkers, input),
    );
    bodyBlocks.length = 0;
    bodyBlocks.push(...bodyBlocksWithMarkers);
    references = [];
  }

  const footnoteIdMap = buildFootnoteIdMap(articleFootnoteDefinitions);
  const footnotes = buildFootnotes(articleFootnoteDefinitions, footnoteIdMap);

  registerXrefResolver(buildXrefResolver(bodyBlocks, input.importedImages ?? [], input.importedTables ?? []));

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

  const document = new Document({
    creator: "UFLA DOCX Academico",
    title: input.fields.title || "Artigo academico",
    description: "Artigo academico simples sem estrutura pre-textual de monografia.",
    features: { updateFields: true },
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
              top: UFLA_RULES.margins.topTwip,
              left: UFLA_RULES.margins.leftTwip,
              bottom: UFLA_RULES.margins.bottomTwip,
              right: UFLA_RULES.margins.rightTwip,
              header: UFLA_RULES.header.distanceFromTopTwip,
              footer: UFLA_RULES.footer.distanceFromBottomTwip,
            },
          },
        },
        headers: {
          default: pageNumberHeader,
        },
        children: [
          centered((input.fields.title || "Titulo do artigo").toUpperCase(), true, 32),
          ...(hasText(input.fields.subtitle) ? [centered(input.fields.subtitle, false, 28)] : []),
          centered((input.fields.author || "Autor").toUpperCase(), false, 28),
          ...labeledSection("Resumo", input.fields.resumo),
          ...(hasText(input.fields.palavrasChave)
            ? [
                new Paragraph({
                  style: "ufla_palavras_chave",
                  alignment: AlignmentType.BOTH,
                  spacing: { line: SINGLE_LINE, after: UFLA_RULES.spacing.afterParagraphTwip },
                  indent: { firstLine: 0 },
                  children: [
                    run("Palavras-chave: ", { bold: true }),
                    run(normalizeSemicolonKeywords(input.fields.palavrasChave) + "."),
                  ],
                }),
              ]
            : []),
          ...labeledSection("Abstract", input.fields.abstractText),
          ...(hasText(input.fields.keywords)
            ? [
                new Paragraph({
                  style: "ufla_keywords",
                  alignment: AlignmentType.BOTH,
                  spacing: { line: SINGLE_LINE, after: UFLA_RULES.spacing.afterParagraphTwip },
                  indent: { firstLine: 0 },
                  children: [
                    run("Keywords: ", { bold: true }),
                    run(normalizeSemicolonKeywords(input.fields.keywords) + "."),
                  ],
                }),
              ]
            : []),
          ...bodyBlocks.flatMap((block) => blockToParagraph(block, input.importedImages ?? [], input.importedTables ?? [], footnoteIdMap)),
          ...referenceParagraphs(references),
        ],
      },
    ],
    footnotes,
  });
  clearXrefRegistry();
  return document;
}

export async function generateArticleDocxBlob(input: DocxGenerationInput): Promise<Blob> {
  // SEM clearRawOmmlRegistry(): marcadores OMML únicos por geração, consumidos
  // pelo patch pós-Packer (A4 do checklist-14).
  return Packer.toBlob(createArticleDocument(input));
}
