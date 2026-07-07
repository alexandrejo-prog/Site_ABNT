import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  PageOrientation,
  Paragraph,
  TableOfContents,
  TextRun,
} from "docx";
import { parseEditorContent, type DocxGenerationInput, type DocxLogoAsset, type EditorBlock, loadDefaultLogoAsset } from "./export-docx";
import { AUTHOR_SIZE, BLACK, BODY_SIZE, ONE_AND_HALF_LINE, SINGLE_LINE, TITLE_SIZE, centered, logoParagraph, pageBreak, pageMargins, pageNumberHeader, paragraph, run, unnumberedTitle } from "./docx-shared";
import { repairHeadingFragments } from "./heading-fragment-repair";
import { normalizeReferences, type ReferenceRun } from "./references-normalizer";
import { UFLA_RULES } from "./ufla-rules";
import { normalizeFieldsForSelectedModel } from "./work-type-field-normalizer";
import { cleanMojibakeText, splitParagraphs as coreSplitParagraphs, textRunsFromMarkup } from "./docx-render-core";

function hasValue(value: string): boolean {
  return value.trim().length > 0;
}

function splitParagraphs(value: string): string[] {
  return coreSplitParagraphs(cleanMojibakeText(value));
}

function coverChildren(input: DocxGenerationInput): Paragraph[] {
  const { fields, logo } = input;
  return [
    ...logoParagraph(logo),
    centered(cleanMojibakeText(fields.author || "Autor"), true, AUTHOR_SIZE, 1250, 1600),
    centered(cleanMojibakeText((fields.title || "Título do trabalho").toUpperCase()), true, TITLE_SIZE, 0, 240),
    ...(fields.subtitle ? [centered(cleanMojibakeText(fields.subtitle), false, BODY_SIZE, 0, 240)] : []),
    centered(cleanMojibakeText((fields.location || "LAVRAS - MG").toUpperCase()), true, AUTHOR_SIZE, 2500, 120),
    centered(cleanMojibakeText(fields.year || new Date().getFullYear().toString()), true, AUTHOR_SIZE, 0, 0),
  ];
}

function titlePageChildren(fields: DocxGenerationInput["fields"]): Paragraph[] {
  return [
    pageBreak(),
    centered(cleanMojibakeText(fields.author || "Autor"), false, BODY_SIZE, 0, 520),
    centered(cleanMojibakeText((fields.title || "Título do trabalho").toUpperCase()), false, BODY_SIZE, 0, 520),
    new Paragraph({
      alignment: AlignmentType.BOTH,
      indent: { left: UFLA_RULES.typography.longQuoteLeftIndentTwip },
      spacing: { line: SINGLE_LINE, after: 180 },
      children: [run(cleanMojibakeText(fields.workNature || "Projeto de pesquisa apresentado à Universidade Federal de Lavras."))],
    }),
    ...(fields.advisor ? [paragraph(`Orientador: ${cleanMojibakeText(fields.advisor)}`)] : []),
    centered(cleanMojibakeText((fields.location || "LAVRAS - MG").toUpperCase()), false, BODY_SIZE, 1800, 120),
    centered(cleanMojibakeText(fields.year || new Date().getFullYear().toString()), false, BODY_SIZE, 0, 0),
  ];
}

function preTextualChildren(fields: DocxGenerationInput["fields"]): Array<Paragraph | TableOfContents> {
  return [
    pageBreak(),
    unnumberedTitle("Resumo"),
    ...coreSplitParagraphs(cleanMojibakeText(fields.resumo)).map((line) => paragraph(line)),
    ...(fields.palavrasChave ? [paragraph(cleanMojibakeText(`Palavras-chave: ${fields.palavrasChave}`))] : []),
    pageBreak(),
    unnumberedTitle("Abstract"),
    ...coreSplitParagraphs(cleanMojibakeText(fields.abstractText)).map((line) => paragraph(line)),
    ...(fields.keywords ? [paragraph(cleanMojibakeText(`Keywords: ${fields.keywords}`))] : []),
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
      .flatMap(([title, value]) => [`# ${title}`, coreSplitParagraphs(cleanMojibakeText(value)).join("\n")])
      .join("\n\n"),
  );
}

function headingParagraph(block: EditorBlock, first: boolean): Paragraph[] {
  const level = block.type === "heading1" ? HeadingLevel.HEADING_1 : block.type === "heading2" ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3;
  const title = new Paragraph({
    heading: level,
    spacing: { before: first ? 0 : 240, after: 240, line: ONE_AND_HALF_LINE },
    children: [run(block.type === "heading1" ? cleanMojibakeText(block.text.toUpperCase()) : cleanMojibakeText(block.text), block.type !== "heading3")],
  });
  return first || block.type !== "heading1" ? [title] : [pageBreak(), title];
}

function markupParagraph(text: string, singleLine = false, indent = UFLA_RULES.typography.paragraphFirstLineTwip): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.BOTH,
    spacing: { line: singleLine ? SINGLE_LINE : ONE_AND_HALF_LINE, after: singleLine ? 120 : UFLA_RULES.spacing.afterParagraphTwip },
    indent: { firstLine: indent },
    children: textRunsFromMarkup(cleanMojibakeText(text || " "), BODY_SIZE, UFLA_RULES.typography.fontFamily, BLACK),
  });
}

function blockToParagraph(block: EditorBlock, first: boolean): Paragraph[] {
  if (block.type === "heading1" || block.type === "heading2" || block.type === "heading3") return headingParagraph(block, first);
  if (block.type === "longQuote") {
    return [new Paragraph({ alignment: AlignmentType.BOTH, spacing: { line: SINGLE_LINE, after: 120 }, indent: { left: UFLA_RULES.typography.longQuoteLeftIndentTwip }, children: textRunsFromMarkup(cleanMojibakeText(block.text || " "), BODY_SIZE, UFLA_RULES.typography.fontFamily, BLACK) })];
  }
  if (block.type === "scheduleTable") return coreSplitParagraphs(cleanMojibakeText(block.text)).map((line) => markupParagraph(line));
  return [markupParagraph(block.text)];
}

function referenceRunToTextRun(referenceRun: ReferenceRun): TextRun {
  return new TextRun({
    text: cleanMojibakeText(referenceRun.text),
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
      .sort((a, b) => cleanMojibakeText(a.text).localeCompare(cleanMojibakeText(b.text), "pt-BR", { sensitivity: "base" }))
      .map((reference) => new Paragraph({ alignment: AlignmentType.LEFT, spacing: { line: SINGLE_LINE, after: SINGLE_LINE }, children: reference.runs.length ? reference.runs.map(referenceRunToTextRun) : [run(cleanMojibakeText(reference.text || " "))] })),
  ];
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
