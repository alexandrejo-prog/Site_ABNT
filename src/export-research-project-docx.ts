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
import { parseEditorContent, type DocxGenerationInput, type EditorBlock, loadDefaultLogoAsset } from "./export-docx";
import { AUTHOR_SIZE, BLACK, BODY_SIZE, ONE_AND_HALF_LINE, SINGLE_LINE, TITLE_SIZE, centered, ibgeTable, logoParagraph, pageBreak, pageMargins, pageNumberHeader, paragraph, run, unnumberedTitle } from "./docx-shared";
import { repairHeadingFragments } from "./heading-fragment-repair";
import { normalizeUflaManualInTextCitations } from "./in-text-citation-normalizer";
import { isResearchProjectProvisionalText, normalizeKeywordSentence, normalizeResearchProjectEditorText } from "./research-project-cleaner";
import { normalizeReferences, type ReferenceRun } from "./references-normalizer";
import { UFLA_RULES } from "./ufla-rules";
import { normalizeFieldsForSelectedModel } from "./work-type-field-normalizer";
import { cleanMojibakeText, splitParagraphs as coreSplitParagraphs, textRunsFromMarkup } from "./docx-render-core";

interface SummaryEntry {
  text: string;
  level: 1 | 2 | 3;
}

function hasValue(value: string): boolean {
  return value.trim().length > 0;
}

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toUpperCase()
    .trim();
}

const COMMON_PROJECT_HEADINGS: Record<string, string> = {
  INTRODUCAO: "INTRODUÇÃO",
  "CONTEXTUALIZACAO E DELIMITACAO DO TEMA": "Contextualização e delimitação do tema",
  "PROBLEMA DE PESQUISA": "PROBLEMA DE PESQUISA",
  OBJETIVOS: "OBJETIVOS",
  "OBJETIVO GERAL": "Objetivo geral",
  "OBJETIVOS ESPECIFICOS": "OBJETIVOS ESPECÍFICOS",
  JUSTIFICATIVA: "JUSTIFICATIVA",
  "ESTRUTURA DO PROJETO": "Estrutura do projeto",
  "REFERENCIAL TEORICO": "REFERENCIAL TEÓRICO",
  METODOLOGIA: "METODOLOGIA",
  CRONOGRAMA: "CRONOGRAMA",
  "RECURSOS/ORCAMENTO": "RECURSOS/ORÇAMENTO",
  "RESULTADOS ESPERADOS": "RESULTADOS ESPERADOS",
  "CONSIDERACOES FINAIS": "CONSIDERAÇÕES FINAIS",
  CONCLUSAO: "CONCLUSÃO",
  REFERENCIAS: "REFERÊNCIAS",
};

function normalizeProjectHeadingText(value: string): string {
  const cleaned = cleanMojibakeText(value).replace(/\s+/g, " ").trim();
  const match = cleaned.match(/^(\d+(?:\.\d+)*\s+)?(.+)$/);
  if (!match) return cleaned;

  const prefix = match[1] ?? "";
  const title = match[2].trim();
  const normalizedTitle = COMMON_PROJECT_HEADINGS[fold(title)];
  return normalizedTitle ? `${prefix}${normalizedTitle}` : cleaned;
}

function normalizeProjectBodyText(value: string): string {
  return normalizeUflaManualInTextCitations(cleanMojibakeText(value));
}

function splitParagraphs(value: string): string[] {
  return coreSplitParagraphs(normalizeProjectBodyText(value));
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
  const advisor = cleanMojibakeText(fields.advisor).trim();
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
    ...(advisor && !isResearchProjectProvisionalText(advisor) ? [paragraph(`Orientador: ${advisor}`)] : []),
    centered(cleanMojibakeText((fields.location || "LAVRAS - MG").toUpperCase()), false, BODY_SIZE, 1800, 120),
    centered(cleanMojibakeText(fields.year || new Date().getFullYear().toString()), false, BODY_SIZE, 0, 0),
  ];
}

function summaryLevelForBlock(block: EditorBlock): SummaryEntry["level"] | null {
  if (block.type === "heading1") return 1;
  if (block.type === "heading2") return 2;
  if (block.type === "heading3") return 3;
  return null;
}

function summaryEntryParagraph(entry: SummaryEntry): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { line: SINGLE_LINE, after: 0 },
    indent: { left: (entry.level - 1) * 360 },
    children: [
      run(cleanMojibakeText(entry.text), entry.level < 3),
    ],
  });
}

function addSummaryEntry(entries: SummaryEntry[], seen: Set<string>, text: string, level: SummaryEntry["level"]): void {
  const cleaned = normalizeProjectHeadingText(text);
  const key = fold(cleaned);
  if (!cleaned || key === "SUMARIO" || seen.has(key)) return;
  seen.add(key);
  entries.push({ text: cleaned, level });
}

function collectSummaryEntries(bodyBlocks: EditorBlock[], references: string[]): SummaryEntry[] {
  const entries: SummaryEntry[] = [];
  const seen = new Set<string>();

  for (const block of bodyBlocks) {
    const level = summaryLevelForBlock(block);
    if (level) addSummaryEntry(entries, seen, level === 1 ? block.text.toUpperCase() : block.text, level);
  }

  if (references.length > 0) addSummaryEntry(entries, seen, "REFERÊNCIAS", 1);
  return entries;
}

function preTextualChildren(fields: DocxGenerationInput["fields"], summaryEntries: SummaryEntry[]): Paragraph[] {
  const palavrasChave = normalizeKeywordSentence(fields.palavrasChave);
  const keywords = normalizeKeywordSentence(fields.keywords);
  return [
    pageBreak(),
    unnumberedTitle("Resumo"),
    ...coreSplitParagraphs(cleanMojibakeText(fields.resumo)).map((line) => paragraph(line)),
    ...(palavrasChave ? [paragraph(`Palavras-chave: ${palavrasChave}`)] : []),
    pageBreak(),
    unnumberedTitle("Abstract"),
    ...coreSplitParagraphs(cleanMojibakeText(fields.abstractText)).map((line) => paragraph(line)),
    ...(keywords ? [paragraph(`Keywords: ${keywords}`)] : []),
    pageBreak(),
    unnumberedTitle("Sumário"),
    ...summaryEntries.map(summaryEntryParagraph),
  ];
}

function projectEditorText(input: DocxGenerationInput): string {
  if (input.editorText.trim()) return repairHeadingFragments(normalizeResearchProjectEditorText(input.editorText));

  const sections: Array<[string, string]> = [
    ["TEMA", input.fields.tema],
    ["DELIMITAÇÃO DO TEMA", input.fields.delimitacaoTema],
    ["PROBLEMA DE PESQUISA", input.fields.problemaPesquisa],
    ["HIPÓTESE", input.fields.hipotese],
    ["OBJETIVO GERAL", input.fields.objetivoGeral],
    ["OBJETIVOS ESPECÍFICOS", input.fields.objetivosEspecificos],
    ["JUSTIFICATIVA", input.fields.justificativa],
    ["REFERENCIAL TEÓRICO", input.fields.referencialTeorico],
    ["METODOLOGIA", input.fields.metodologia],
    ["CRONOGRAMA", input.fields.cronograma],
    ["RECURSOS/ORÇAMENTO", input.fields.recursosOrcamento],
    ["RESULTADOS ESPERADOS", input.fields.resultadosEsperados],
  ];

  return repairHeadingFragments(
    normalizeResearchProjectEditorText(
      sections
        .filter(([, value]) => hasValue(value))
        .flatMap(([title, value]) => [`# ${title}`, coreSplitParagraphs(cleanMojibakeText(value)).join("\n")])
        .join("\n\n"),
    ),
  );
}

function headingParagraph(block: EditorBlock, first: boolean): Paragraph[] {
  const level = block.type === "heading1" ? HeadingLevel.HEADING_1 : block.type === "heading2" ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3;
  const headingText = normalizeProjectHeadingText(block.text);
  const title = new Paragraph({
    heading: level,
    spacing: { before: first ? 0 : 240, after: 240, line: ONE_AND_HALF_LINE },
    children: [run(block.type === "heading1" ? headingText.toUpperCase() : headingText, block.type !== "heading3")],
  });
  return first || block.type !== "heading1" ? [title] : [pageBreak(), title];
}

function markupParagraph(text: string, singleLine = false, indent = UFLA_RULES.typography.paragraphFirstLineTwip): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.BOTH,
    spacing: { line: singleLine ? SINGLE_LINE : ONE_AND_HALF_LINE, after: singleLine ? 120 : UFLA_RULES.spacing.afterParagraphTwip },
    indent: { firstLine: indent },
    children: textRunsFromMarkup(normalizeProjectBodyText(text || " "), BODY_SIZE, UFLA_RULES.typography.fontFamily, BLACK),
  });
}

function isMarkdownTableSeparator(value: string): boolean {
  return /^\s*\|?[\s:|-]+\|?\s*$/.test(value) && value.includes("-");
}

function splitMarkdownCells(line: string): string[] {
  return line
    .replace(/^\s*\|/, "")
    .replace(/\|\s*$/, "")
    .split("|")
    .map((cell) => normalizeProjectBodyText(cell).trim());
}

function splitTabCells(line: string): string[] {
  return line
    .split("\t")
    .map((cell) => normalizeProjectBodyText(cell).trim())
    .filter(Boolean);
}

function paddedRows(rows: string[][]): string[][] {
  const columnCount = Math.max(1, ...rows.map((row) => row.length));
  return rows.map((row) => Array.from({ length: columnCount }, (_, index) => row[index] ?? ""));
}

function tableChildrenFromRows(rows: string[][]): Array<Paragraph | Table> {
  const normalizedRows = paddedRows(rows.filter((row) => row.length >= 2));
  if (!normalizedRows.length) return [];

  const headerLabels = normalizedRows[0];
  const bodyRows = normalizedRows.slice(1);
  const columnWidths = Array.from({ length: headerLabels.length }, () => Math.floor(100 / headerLabels.length));

  return [ibgeTable({ headerLabels, rows: bodyRows, columnWidths })];
}

function markdownTableChildren(text: string): Array<Paragraph | Table> {
  const rows = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !isMarkdownTableSeparator(line))
    .map(splitMarkdownCells)
    .filter((cells) => cells.length >= 2);

  const table = tableChildrenFromRows(rows);
  return table.length ? table : [markupParagraph(text)];
}

function tabularBlockChildren(text: string): Array<Paragraph | Table> {
  const captionLines: string[] = [];
  const rows: string[][] = [];

  for (const line of text.split(/\n+/).map((item) => item.trim()).filter(Boolean)) {
    if (line.includes("\t")) rows.push(splitTabCells(line));
    else if (!rows.length) captionLines.push(line);
  }

  const children: Array<Paragraph | Table> = captionLines.map((line) => markupParagraph(line, true, 0));
  const table = tableChildrenFromRows(rows);
  return table.length ? [...children, ...table] : splitParagraphs(text).map((line) => markupParagraph(line));
}

function isTabularParagraph(block: EditorBlock): boolean {
  return block.type === "paragraph" && splitTabCells(block.text).length >= 2;
}

function blockToParagraph(block: EditorBlock, first: boolean): Array<Paragraph | Table> {
  if (block.type === "heading1" || block.type === "heading2" || block.type === "heading3") return headingParagraph(block, first);
  if (block.type === "longQuote") {
    return [new Paragraph({ alignment: AlignmentType.BOTH, spacing: { line: SINGLE_LINE, after: 120 }, indent: { left: UFLA_RULES.typography.longQuoteLeftIndentTwip }, children: textRunsFromMarkup(normalizeProjectBodyText(block.text || " "), BODY_SIZE, UFLA_RULES.typography.fontFamily, BLACK) })];
  }
  if (block.type === "markdownTable") return markdownTableChildren(block.text);
  if (block.type === "plainScheduleTable") return tabularBlockChildren(block.text);
  if (block.type === "scheduleTable") return tabularBlockChildren(block.text);
  return [markupParagraph(block.text)];
}

function bodyChildrenFromBlocks(blocks: EditorBlock[]): Array<Paragraph | Table> {
  const children: Array<Paragraph | Table> = [];

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];

    if (isTabularParagraph(block)) {
      const rows: string[][] = [];
      let cursor = index;
      while (cursor < blocks.length && isTabularParagraph(blocks[cursor])) {
        rows.push(splitTabCells(blocks[cursor].text));
        cursor += 1;
      }
      children.push(...tableChildrenFromRows(rows));
      index = cursor - 1;
      continue;
    }

    children.push(...blockToParagraph(block, children.length === 0));
  }

  return children;
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
      .map((reference) => new Paragraph({ alignment: AlignmentType.LEFT, spacing: { line: SINGLE_LINE, after: SINGLE_LINE }, indent: { left: 720, hanging: 720 }, children: reference.runs.length ? reference.runs.map(referenceRunToTextRun) : [run(cleanMojibakeText(reference.text || " "))] })),
  ];
}

function createProjectDocument(input: DocxGenerationInput): Document {
  const blocks = parseEditorContent(projectEditorText(input));
  const bodyBlocks = blocks.filter((block) => block.type !== "reference");
  const references = [
    ...splitParagraphs(input.fields.referencias),
    ...blocks.filter((block) => block.type === "reference").map((block) => block.text),
  ];
  const summaryEntries = collectSummaryEntries(bodyBlocks, references);
  const textualChildren = [
    ...bodyChildrenFromBlocks(bodyBlocks),
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
        children: [...coverChildren(input), ...titlePageChildren(input.fields), ...preTextualChildren(input.fields, summaryEntries)],
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
