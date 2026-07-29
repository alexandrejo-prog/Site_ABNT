import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  PageOrientation,
  Paragraph,
  Table,
  TableOfContents,
  TextRun,
} from "docx";
import { parseEditorContent, importedTableParagraph, type DocxGenerationInput, type EditorBlock, loadDefaultLogoAsset } from "./export-docx";
import type { ImportedTable } from "./imported-tables";
import { AUTHOR_SIZE, BLACK, BODY_SIZE, ONE_AND_HALF_LINE, SINGLE_LINE, TITLE_SIZE, centered, ibgeTable, logoParagraph, pageBreak, pageMargins, pageNumberHeader, paragraph, run, unnumberedTitle } from "./docx-shared";
import { repairHeadingFragments } from "./heading-fragment-repair";
import { normalizeUflaManualInTextCitations } from "./in-text-citation-normalizer";
import { isResearchProjectProvisionalText, normalizeKeywordSentence, normalizeResearchProjectEditorText } from "./research-project-cleaner";
import { normalizeReferences, type ReferenceRun } from "./references-normalizer";
import { UFLA_RULES } from "./ufla-rules";
import { normalizeFieldsForSelectedModel } from "./work-type-field-normalizer";
import { cleanMojibakeText, sourceParagraph, splitParagraphs as coreSplitParagraphs, tabbedTableBlock, textRunsFromMarkup } from "./docx-render-core";

const PROJECT_TEXTUAL_START_PAGE = 5;

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
  INTRODUCAO: "Introdução",
  "CONTEXTUALIZACAO E DELIMITACAO DO TEMA": "Contextualização e delimitação do tema",
  "PROBLEMA DE PESQUISA": "Problema de pesquisa",
  OBJETIVOS: "Objetivos",
  "OBJETIVO GERAL": "Objetivo geral",
  "OBJETIVOS ESPECIFICOS": "Objetivos específicos",
  JUSTIFICATIVA: "Justificativa",
  "ESTRUTURA DO PROJETO": "Estrutura do projeto",
  "REFERENCIAL TEORICO": "Referencial teórico",
  METODOLOGIA: "Metodologia",
  CRONOGRAMA: "Cronograma",
  "RECURSOS/ORCAMENTO": "Recursos/orçamento",
  "RESULTADOS ESPERADOS": "Resultados esperados",
  "RESULTADOS ESPERADOS, IMPACTO SOCIAL E LIMITACOES": "Resultados esperados, impacto social e limitações",
  "IMPACTO SOCIAL E INSTITUCIONAL": "Impacto social e institucional",
  "CONTRIBUICOES PARA O DEBATE ACADEMICO E PUBLICO": "Contribuições para o debate acadêmico e público",
  "LIMITACOES PREVISTAS E ESTRATEGIAS DE MITIGACAO": "Limitações previstas e estratégias de mitigação",
  "CRONOGRAMA DE EXECUCAO": "Cronograma de execução",
  "DETALHAMENTO DAS ETAPAS": "Detalhamento das etapas",
  "PRODUTOS INTERMEDIARIOS": "Produtos intermediários",
  "CONSIDERACOES FINAIS": "Considerações finais",
  CONCLUSAO: "Conclusão",
  REFERENCIAS: "Referências",
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

function preTextualParagraphs(value: string): string[] {
  const cleaned = cleanMojibakeText(value).replace(/\r\n?/g, "\n").trim();
  if (!cleaned) return [];

  return cleaned
    .split(/\n{2,}/)
    .map((item) => item.split(/\n+/).map((line) => line.trim()).filter(Boolean).join(" "))
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter(Boolean);
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

function projectTableOfContents(): TableOfContents {
  return new TableOfContents("", {
    headingStyleRange: "1-3",
    hyperlink: true,
    hideTabAndPageNumbersInWebView: false,
    useAppliedParagraphOutlineLevel: true,
  });
}

function preTextualChildren(fields: DocxGenerationInput["fields"]): Array<Paragraph | TableOfContents> {
  const palavrasChave = normalizeKeywordSentence(fields.palavrasChave);
  const keywords = normalizeKeywordSentence(fields.keywords);
  return [
    pageBreak(),
    unnumberedTitle("Resumo"),
    ...preTextualParagraphs(fields.resumo).map((line) => paragraph(line)),
    ...(palavrasChave ? [paragraph(`Palavras-chave: ${palavrasChave}`)] : []),
    pageBreak(),
    unnumberedTitle("Abstract"),
    ...preTextualParagraphs(fields.abstractText).map((line) => paragraph(line)),
    ...(keywords ? [paragraph(`Keywords: ${keywords}`)] : []),
    pageBreak(),
    unnumberedTitle("Sumário"),
    // O Projeto de pesquisa usa sumário atualizável para evitar paginação falsa.
    // Abra no Word/LibreOffice e atualize os campos para preencher páginas reais.
    projectTableOfContents(),
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

function tableChildrenFromRows(rows: string[][], caption?: string, source?: string): Array<Paragraph | Table> {
  const normalizedRows = paddedRows(rows.filter((row) => row.length >= 2));
  if (!normalizedRows.length) return [];

  const headerLabels = normalizedRows[0];
  const bodyRows = normalizedRows.slice(1);
  const columnWidths = Array.from({ length: headerLabels.length }, () => Math.floor(100 / headerLabels.length));
  const table = ibgeTable({ headerLabels, rows: bodyRows, columnWidths });

  const children: Array<Paragraph | Table> = [];
  if (caption) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 240, after: 120, line: SINGLE_LINE },
        children: [new TextRun({ text: cleanMojibakeText(caption), bold: true, font: UFLA_RULES.typography.fontFamily, size: BODY_SIZE, color: BLACK })],
      }),
    );
  }
  children.push(table);
  if (source) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { before: 120, after: 240, line: SINGLE_LINE },
        children: [new TextRun({ text: cleanMojibakeText(source), font: UFLA_RULES.typography.fontFamily, size: 20, color: BLACK })],
      }),
    );
  }
  return children;
}

function markdownTableChildren(text: string): Array<Paragraph | Table> {
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  let explicitSource: string | undefined;
  const dataLines = lines.filter((line) => {
    if (/^Fonte:/i.test(line)) {
      explicitSource = line;
      return false;
    }
    return !isMarkdownTableSeparator(line);
  });

  const rows = dataLines
    .map(splitMarkdownCells)
    .filter((cells) => cells.length >= 2);

  const table = tableChildrenFromRows(rows, undefined, explicitSource);
  return table.length ? table : [markupParagraph(text)];
}

function tabularBlockChildren(text: string): Array<Paragraph | Table> {
  const captionLines: string[] = [];
  const rows: string[][] = [];
  let explicitSource: string | undefined;

  for (const line of text.split(/\n+/).map((item) => item.trim()).filter(Boolean)) {
    if (/^Fonte:/i.test(line)) {
      explicitSource = line;
      continue;
    }
    if (line.includes("\t")) rows.push(splitTabCells(line));
    else if (!rows.length) captionLines.push(line);
  }

  const caption = captionLines[0];
  const source = explicitSource ?? "Fonte: elaborado pelo autor.";
  const children = tableChildrenFromRows(rows, caption, source);
  return children.length ? children : splitParagraphs(text).map((line) => markupParagraph(line));
}

function isTabularParagraph(block: EditorBlock): boolean {
  return block.type === "paragraph" && splitTabCells(block.text).length >= 2;
}

function blockToParagraph(block: EditorBlock, first: boolean, importedTables: ImportedTable[] = []): Array<Paragraph | Table> {
  if (block.type === "heading1" || block.type === "heading2" || block.type === "heading3") return headingParagraph(block, first);
  if (block.type === "longQuote") {
    return [new Paragraph({ alignment: AlignmentType.BOTH, spacing: { line: SINGLE_LINE, after: 120 }, indent: { left: UFLA_RULES.typography.longQuoteLeftIndentTwip }, children: textRunsFromMarkup(normalizeProjectBodyText(block.text || " "), UFLA_RULES.typography.longQuoteFontSizePt * 2, UFLA_RULES.typography.fontFamily, BLACK) })];
  }
  if (block.type === "markdownTable") return markdownTableChildren(block.text);
  if (block.type === "plainScheduleTable") return tabularBlockChildren(block.text);
  if (block.type === "scheduleTable") return tabularBlockChildren(block.text);
  if (block.type === "tabbedTable") return tabbedTableBlock(block.text, { sourceFallback: "Fonte: elaborado pelo autor." });
  if (block.type === "importedTable") {
    const table = importedTables.find((item) => item.id === block.text);
    return importedTableParagraph(table);
  }
  if (block.type === "source") {
    return [sourceParagraph(block.text)];
  }
  return [markupParagraph(block.text)];
}

function bodyChildrenFromBlocks(blocks: EditorBlock[], importedTables: ImportedTable[] = []): Array<Paragraph | Table> {
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

      let source: string | undefined;
      if (cursor < blocks.length && /^Fonte:/i.test(blocks[cursor].text.trim())) {
        source = blocks[cursor].text.trim();
        cursor += 1;
      }

      children.push(...tableChildrenFromRows(rows, undefined, source ?? "Fonte: elaborado pelo autor."));
      index = cursor - 1;
      continue;
    }

    children.push(...blockToParagraph(block, children.length === 0, importedTables));
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

function hasEditorHeading(blocks: EditorBlock[], text: string): boolean {
  const normalizedTarget = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
  return blocks.some((block) => {
    if (block.type !== "heading1" && block.type !== "heading2" && block.type !== "paragraph") return false;
    const normalizedBlock = block.text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/\s+/g, " ")
      .trim();
    return normalizedBlock === normalizedTarget;
  });
}

function referenceParagraphs(references: string[], bodyBlocks: EditorBlock[] = []): Paragraph[] {
  if (!references.length) return [];
  const children: Array<Paragraph | Table> = [];
  if (!hasEditorHeading(bodyBlocks, "REFERENCIAS") && !hasEditorHeading(bodyBlocks, "REFERÊNCIAS")) {
    children.push(pageBreak());
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 0, after: 240, line: ONE_AND_HALF_LINE }, children: [run("REFERÊNCIAS", true)] }));
  }
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
      .sort((a, b) => cleanMojibakeText(a.text).localeCompare(cleanMojibakeText(b.text), "pt-BR", { sensitivity: "base" }))
      .map((reference) => new Paragraph({ alignment: AlignmentType.LEFT, spacing: { line: SINGLE_LINE, after: SINGLE_LINE }, indent: { left: 720, hanging: 720 }, children: reference.runs.length ? reference.runs.map(referenceRunToTextRun) : [run(cleanMojibakeText(reference.text || " "))] })),
  );
  return children;
}

function createProjectDocument(input: DocxGenerationInput): Document {
  const blocks = parseEditorContent(projectEditorText(input));
  const bodyBlocks = blocks.filter((block) => block.type !== "reference" && block.type !== "importedImage");
  const references = [
    ...splitParagraphs(input.fields.referencias),
    ...blocks.filter((block) => block.type === "reference").map((block) => block.text),
  ];
  const textualChildren = [
    ...bodyChildrenFromBlocks(bodyBlocks, input.importedTables ?? []),
    ...referenceParagraphs(references, bodyBlocks),
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
        properties: { page: { size: { orientation: PageOrientation.PORTRAIT, width: UFLA_RULES.page.widthTwip, height: UFLA_RULES.page.heightTwip }, margin: pageMargins(), pageNumbers: { start: PROJECT_TEXTUAL_START_PAGE } } },
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
