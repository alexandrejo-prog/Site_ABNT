import {
  AlignmentType,
  Document,
  Header,
  HeadingLevel,
  ImageRun,
  Packer,
  PageBreak,
  PageNumber,
  PageOrientation,
  Paragraph,
  TableOfContents,
  TextRun,
} from "docx";
import { parseEditorContent, type DocxGenerationInput, type DocxLogoAsset, type EditorBlock, loadDefaultLogoAsset } from "./export-docx";
import { repairHeadingFragments } from "./heading-fragment-repair";
import { normalizeReferences, type ReferenceRun } from "./references-normalizer";
import { UFLA_RULES } from "./ufla-rules";
import { normalizeFieldsForSelectedModel } from "./work-type-field-normalizer";

const BODY_SIZE = UFLA_RULES.typography.bodyFontSizePt * 2;
const TITLE_SIZE = UFLA_RULES.typography.coverTitleFontSizePt * 2;
const AUTHOR_SIZE = UFLA_RULES.typography.coverAuthorFontSizePt * 2;
const SINGLE_LINE = UFLA_RULES.spacing.singleLineTwip;
const ONE_AND_HALF_LINE = UFLA_RULES.spacing.bodyLineTwip;
const BLACK = "000000";

function hasValue(value: string): boolean {
  return value.trim().length > 0;
}

function splitParagraphs(value: string): string[] {
  return value.split(/\n+/).map((line) => line.trim()).filter(Boolean);
}

function pageBreak(): Paragraph {
  return new Paragraph({ children: [new PageBreak()] });
}

function run(text: string, bold = false, size = BODY_SIZE): TextRun {
  return new TextRun({ text, bold, size, font: UFLA_RULES.typography.fontFamily, color: BLACK });
}

function paragraph(text: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.BOTH,
    spacing: { line: ONE_AND_HALF_LINE, after: UFLA_RULES.spacing.afterParagraphTwip },
    indent: { firstLine: UFLA_RULES.typography.paragraphFirstLineTwip },
    children: [run(text || " ")],
  });
}

function centered(text: string, bold = false, size = BODY_SIZE, before = 0, after = 240): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before, after, line: SINGLE_LINE },
    children: [run(text || " ", bold, size)],
  });
}

function unnumberedTitle(text: string): Paragraph {
  return centered(text.toUpperCase(), true, BODY_SIZE, 240, 240);
}

function logoParagraph(logo?: DocxLogoAsset): Paragraph[] {
  if (!logo) return [centered("UNIVERSIDADE FEDERAL DE LAVRAS", true, AUTHOR_SIZE, 0, 0)];

  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 0 },
      children: [
        new ImageRun({
          data: logo.data,
          transformation: { width: logo.width ?? 265, height: logo.height ?? 108 },
          altText: { title: "Logo UFLA", description: "Universidade Federal de Lavras", name: "Logo UFLA" },
        }),
      ],
    }),
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

function coverChildren(input: DocxGenerationInput): Paragraph[] {
  const { fields, logo } = input;
  return [
    ...logoParagraph(logo),
    centered(fields.author || "Autor", true, AUTHOR_SIZE, 1250, 1600),
    centered((fields.title || "Título do trabalho").toUpperCase(), true, TITLE_SIZE, 0, 240),
    ...(fields.subtitle ? [centered(fields.subtitle, false, BODY_SIZE, 0, 240)] : []),
    centered((fields.location || "LAVRAS - MG").toUpperCase(), true, AUTHOR_SIZE, 2500, 120),
    centered(fields.year || new Date().getFullYear().toString(), true, AUTHOR_SIZE, 0, 0),
  ];
}

function titlePageChildren(fields: DocxGenerationInput["fields"]): Paragraph[] {
  return [
    pageBreak(),
    centered(fields.author || "Autor", false, BODY_SIZE, 0, 520),
    centered((fields.title || "Título do trabalho").toUpperCase(), false, BODY_SIZE, 0, 520),
    new Paragraph({
      alignment: AlignmentType.BOTH,
      indent: { left: UFLA_RULES.typography.longQuoteLeftIndentTwip },
      spacing: { line: SINGLE_LINE, after: 180 },
      children: [run(fields.workNature || "Projeto de pesquisa apresentado à Universidade Federal de Lavras.")],
    }),
    ...(fields.advisor ? [paragraph(`Orientador: ${fields.advisor}`)] : [paragraph("Orientador: Prof. Dr. [nome do orientador]")]),
    centered((fields.location || "LAVRAS - MG").toUpperCase(), false, BODY_SIZE, 1800, 120),
    centered(fields.year || new Date().getFullYear().toString(), false, BODY_SIZE, 0, 0),
  ];
}

function preTextualChildren(fields: DocxGenerationInput["fields"]): Paragraph[] {
  return [
    pageBreak(),
    unnumberedTitle("Resumo"),
    ...splitParagraphs(fields.resumo).map(paragraph),
    ...(fields.palavrasChave ? [paragraph(`Palavras-chave: ${fields.palavrasChave}`)] : []),
    pageBreak(),
    unnumberedTitle("Abstract"),
    ...splitParagraphs(fields.abstractText).map(paragraph),
    ...(fields.keywords ? [paragraph(`Keywords: ${fields.keywords}`)] : []),
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

function projectEditorText(input: DocxGenerationInput): string {
  if (input.editorText.trim()) return repairHeadingFragments(input.editorText);

  const sections: Array<[string, string]> = [
    ["TEMA", input.fields.tema],
    ["DELIMITACAO DO TEMA", input.fields.delimitacaoTema],
    ["PROBLEMA DE PESQUISA", input.fields.problemaPesquisa],
    ["HIPOTESE", input.fields.hipotese],
    ["OBJETIVO GERAL", input.fields.objetivoGeral],
    ["OBJETIVOS ESPECIFICOS", input.fields.objetivosEspecificos],
    ["JUSTIFICATIVA", input.fields.justificativa],
    ["REFERENCIAL TEORICO", input.fields.referencialTeorico],
    ["METODOLOGIA", input.fields.metodologia],
    ["CRONOGRAMA", input.fields.cronograma],
    ["RECURSOS/ORCAMENTO", input.fields.recursosOrcamento],
    ["RESULTADOS ESPERADOS", input.fields.resultadosEsperados],
  ];

  return repairHeadingFragments(
    sections
      .filter(([, value]) => hasValue(value))
      .flatMap(([title, value]) => [`# ${title}`, value.trim()])
      .join("\n\n"),
  );
}

function headingParagraph(block: EditorBlock, first: boolean): Paragraph[] {
  const level = block.type === "heading1" ? HeadingLevel.HEADING_1 : block.type === "heading2" ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3;
  const title = new Paragraph({
    heading: level,
    spacing: { before: first ? 0 : 240, after: 240, line: ONE_AND_HALF_LINE },
    children: [run(block.type === "heading1" ? block.text.toUpperCase() : block.text, block.type !== "heading3")],
  });
  return first || block.type !== "heading1" ? [title] : [pageBreak(), title];
}

function blockToParagraph(block: EditorBlock, first: boolean): Paragraph[] {
  if (block.type === "heading1" || block.type === "heading2" || block.type === "heading3") return headingParagraph(block, first);
  if (block.type === "longQuote") {
    return [new Paragraph({ alignment: AlignmentType.BOTH, spacing: { line: SINGLE_LINE, after: 120 }, indent: { left: UFLA_RULES.typography.longQuoteLeftIndentTwip }, children: [run(block.text)] })];
  }
  if (block.type === "scheduleTable") return splitParagraphs(block.text).map(paragraph);
  return [paragraph(block.text)];
}

function referenceRunToTextRun(referenceRun: ReferenceRun): TextRun {
  return new TextRun({
    text: referenceRun.text,
    bold: referenceRun.bold,
    italics: referenceRun.italics,
    font: UFLA_RULES.typography.fontFamily,
    size: BODY_SIZE,
    color: BLACK,
  });
}

function referenceParagraphs(references: string[]): Paragraph[] {
  if (!references.length) return [];
  return [
    pageBreak(),
    new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 0, after: 240, line: ONE_AND_HALF_LINE }, children: [run("REFERÊNCIAS", true)] }),
    ...normalizeReferences(references)
      .sort((a, b) => a.text.localeCompare(b.text, "pt-BR", { sensitivity: "base" }))
      .map((reference) => new Paragraph({ alignment: AlignmentType.LEFT, spacing: { line: SINGLE_LINE, after: SINGLE_LINE }, children: reference.runs.length ? reference.runs.map(referenceRunToTextRun) : [run(reference.text)] })),
  ];
}

function pageNumberHeader(): Header {
  return new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [new TextRun({ children: [PageNumber.CURRENT], font: UFLA_RULES.typography.fontFamily, size: UFLA_RULES.typography.pageNumberFontSizePt * 2, color: BLACK })],
      }),
    ],
  });
}

function createProjectDocument(input: DocxGenerationInput): Document {
  const blocks = parseEditorContent(projectEditorText(input));
  const bodyBlocks = blocks.filter((block) => block.type !== "reference");
  const references = [
    ...splitParagraphs(input.fields.referencias),
    ...blocks.filter((block) => block.type === "reference").map((block) => block.text),
  ];
  const textualChildren = [
    ...bodyBlocks.flatMap((block, index) => blockToParagraph(block, index === 0)),
    ...referenceParagraphs(references),
  ];

  return new Document({
    creator: "UFLA DOCX Academico",
    title: input.fields.title || "Projeto de pesquisa",
    description: "Projeto de pesquisa sem ficha catalografica nem folha de aprovacao.",
    features: { updateFields: true },
    sections: [
      {
        properties: { page: { size: { orientation: PageOrientation.PORTRAIT, width: UFLA_RULES.page.widthTwip, height: UFLA_RULES.page.heightTwip }, margin: pageMargins() } },
        children: [...coverChildren(input), ...titlePageChildren(input.fields), ...preTextualChildren(input.fields)],
      },
      {
        properties: { page: { size: { orientation: PageOrientation.PORTRAIT, width: UFLA_RULES.page.widthTwip, height: UFLA_RULES.page.heightTwip }, margin: pageMargins(), pageNumbers: { start: 5 } } },
        headers: { default: pageNumberHeader() },
        children: textualChildren,
      },
    ],
  });
}

export async function generateResearchProjectDocxBlob(input: DocxGenerationInput): Promise<Blob> {
  const fields = normalizeFieldsForSelectedModel(input.fields);
  const logo = input.logo ?? (await loadDefaultLogoAsset());
  return Packer.toBlob(createProjectDocument({ ...input, fields, logo }));
}
