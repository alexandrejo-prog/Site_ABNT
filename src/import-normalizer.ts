import {
  DocxStructure,
  ImportedBlock,
  normalizeForDetection,
} from "./word-structure-extractor";

export interface ImportNormalizationResult {
  structure: DocxStructure;
  text: string;
  messages: string[];
}

interface InlineMarker {
  index: number;
  length: number;
  heading: string;
  level: number;
  kind: "pre-textual" | "textual" | "post-textual";
  insertPageBreakBefore?: boolean;
}

const SECTION_LABELS = [
  "Introdução",
  "Tema",
  "Delimitação do Tema",
  "Problema de Pesquisa",
  "Hipótese",
  "Hipóteses",
  "Objetivos",
  "Objetivo Geral",
  "Objetivos Específicos",
  "Justificativa",
  "Referencial Teórico",
  "FUNDAMENTAÇÃO TEÓRICA",
  "Metodologia",
  "Abordagem",
  "Procedimentos Metodológicos",
  "Cronograma",
  "Recursos",
  "Orçamento",
  "Resultados Esperados",
  "Referências",
  "Apêndice",
  "Apêndices",
  "Anexo",
  "Anexos",
  "Do Paternalismo ao Gerencialismo na Gestão Pública",
  "A Coisificação do Trabalho Técnico-Administrativo",
  "A Pedagogia Histórico-Crítica e o Contrapunto ao Modelo Vigente",
  "O Diálogo Sindical e a Resistência",
  "Técnicas de Coleta de Dados",
  "Análise de Dados",
  "Contribuições e Impacto Social do Estudo",
  "Para os Servidores Técnico-Administrativos",
  "Para a Gestão Universitária",
  "Para a Comunidade Interna",
  "Para a Função Social da UFLA",
];

const UNNUMBERED_RESEARCH_HEADINGS: Array<{
  labels: string[];
  heading: string;
  kind: InlineMarker["kind"];
  insertPageBreakBefore?: boolean;
}> = [
  { labels: ["TEMA"], heading: "TEMA", kind: "textual" },
  { labels: ["DELIMITAÇÃO DO TEMA", "DELIMITACAO DO TEMA"], heading: "DELIMITAÇÃO DO TEMA", kind: "textual" },
  { labels: ["PROBLEMA DE PESQUISA", "PROBLEMA"], heading: "PROBLEMA DE PESQUISA", kind: "textual" },
  { labels: ["HIPÓTESE", "HIPOTESE", "HIPÓTESES", "HIPOTESES"], heading: "HIPÓTESE", kind: "textual" },
  { labels: ["OBJETIVO GERAL"], heading: "OBJETIVO GERAL", kind: "textual" },
  { labels: ["OBJETIVOS ESPECÍFICOS", "OBJETIVOS ESPECIFICOS"], heading: "OBJETIVOS ESPECÍFICOS", kind: "textual" },
  { labels: ["JUSTIFICATIVA"], heading: "JUSTIFICATIVA", kind: "textual" },
  { labels: ["REFERENCIAL TEÓRICO", "REFERENCIAL TEORICO", "FUNDAMENTAÇÃO TEÓRICA", "FUNDAMENTACAO TEORICA"], heading: "REFERENCIAL TEÓRICO", kind: "textual" },
  { labels: ["METODOLOGIA", "PROCEDIMENTOS METODOLÓGICOS", "PROCEDIMENTOS METODOLOGICOS"], heading: "METODOLOGIA", kind: "textual" },
  { labels: ["CRONOGRAMA"], heading: "CRONOGRAMA", kind: "textual" },
  { labels: ["RECURSOS", "ORÇAMENTO", "ORCAMENTO"], heading: "RECURSOS/ORÇAMENTO", kind: "textual" },
  { labels: ["RESULTADOS ESPERADOS"], heading: "RESULTADOS ESPERADOS", kind: "textual" },
  { labels: ["REFERÊNCIAS", "REFERENCIAS"], heading: "REFERÊNCIAS", kind: "post-textual", insertPageBreakBefore: true },
];

const SECTION_LABEL_PATTERN = SECTION_LABELS.map(escapeRegExp).join("|");
const NUMBERED_HEADING_PATTERN = new RegExp(
  `(^|\\s)(?:#{1,6}\\s*)?(\\d+(?:\\.\\d+)*)(?:\\.)?\\s+(${SECTION_LABEL_PATTERN})(?=\\s|$|[:.])`,
  "i",
);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cleanText(value: string): string {
  return value
    .replace(/\uFFFE|\uFEFF/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function textBlock(text: string, type: "paragraph" | "longQuote" = "paragraph"): ImportedBlock {
  return {
    type,
    text,
    rawText: text,
    runs: [{ text }],
  };
}

function headingBlock(text: string, level: number): ImportedBlock {
  return {
    type: "heading",
    level,
    text,
    rawText: text,
    runs: [{ text }],
  };
}

function pageBreakBlock(): ImportedBlock {
  return { type: "pageBreak" };
}

function normalizeNumberedHeading(number: string, label: string): { heading: string; level: number } {
  const cleanNumber = number.replace(/\.$/, "");
  return {
    heading: `${cleanNumber} ${cleanText(label)}`,
    level: cleanNumber.split(".").length,
  };
}

function wholeLineHeadingMarker(text: string): InlineMarker | undefined {
  const withoutMarker = cleanText(text.replace(/^#{1,6}\s*/, "").replace(/[:.\-–—]+$/, ""));
  if (!withoutMarker) return undefined;
  const normalized = normalizeForDetection(withoutMarker);

  for (const candidate of UNNUMBERED_RESEARCH_HEADINGS) {
    if (candidate.labels.some((label) => normalizeForDetection(label) === normalized)) {
      return {
        index: 0,
        length: text.length,
        heading: candidate.heading,
        level: 1,
        kind: candidate.kind,
        insertPageBreakBefore: candidate.insertPageBreakBefore,
      };
    }
  }

  return undefined;
}

function findNextMarker(text: string): InlineMarker | undefined {
  const candidates: InlineMarker[] = [];
  const wholeLine = wholeLineHeadingMarker(text);
  if (wholeLine) candidates.push(wholeLine);

  const resumo = text.match(/(?:^|\s)(?:#{1,6}\s*)?(?:RESUMO|Resumo)\b\s*[:.\-]?\s*/);
  if (resumo?.index !== undefined) {
    candidates.push({
      index: resumo.index,
      length: resumo[0].length,
      heading: "RESUMO",
      level: 1,
      kind: "pre-textual",
      insertPageBreakBefore: true,
    });
  }

  const abstract = text.match(/(?:^|\s)(?:#{1,6}\s*)?(?:ABSTRACT|Abstract)\b\s*[:.\-]?\s*/);
  if (abstract?.index !== undefined) {
    candidates.push({
      index: abstract.index,
      length: abstract[0].length,
      heading: "ABSTRACT",
      level: 1,
      kind: "pre-textual",
      insertPageBreakBefore: true,
    });
  }

  const referencias = text.match(/(?:^|\s)(?:#{1,6}\s*)?(?:REFERÊNCIAS|REFERENCIAS|Referências)\b\s*[:.\-]?\s*/);
  if (referencias?.index !== undefined) {
    candidates.push({
      index: referencias.index,
      length: referencias[0].length,
      heading: "REFERÊNCIAS",
      level: 1,
      kind: "post-textual",
      insertPageBreakBefore: true,
    });
  }

  const numbered = text.match(NUMBERED_HEADING_PATTERN);
  if (numbered?.index !== undefined && numbered[2] && numbered[3]) {
    const leading = numbered[1] ?? "";
    const start = numbered.index + leading.length;
    const length = numbered[0].length - leading.length;
    const { heading, level } = normalizeNumberedHeading(numbered[2], numbered[3]);
    candidates.push({
      index: start,
      length,
      heading,
      level,
      kind: "textual",
      insertPageBreakBefore: level === 1,
    });
  }

  return candidates.sort((a, b) => a.index - b.index)[0];
}

function shouldSuppressPageBreak(output: ImportedBlock[]): boolean {
  const previous = output.at(-1);
  return !previous || previous.type === "pageBreak";
}

function splitInlineAcademicText(value: string, originalType: "paragraph" | "heading" | "longQuote"): ImportedBlock[] {
  let remaining = cleanText(value);
  const output: ImportedBlock[] = [];

  while (remaining) {
    const marker = findNextMarker(remaining);

    if (!marker) {
      output.push(
        originalType === "longQuote" ? textBlock(remaining, "longQuote") : textBlock(remaining),
      );
      break;
    }

    const before = cleanText(remaining.slice(0, marker.index));
    if (before) {
      output.push(
        originalType === "longQuote" ? textBlock(before, "longQuote") : textBlock(before),
      );
    }

    if (marker.insertPageBreakBefore && before && !shouldSuppressPageBreak(output)) {
      output.push(pageBreakBlock());
    }

    output.push(headingBlock(marker.heading, marker.level));
    remaining = cleanText(remaining.slice(marker.index + marker.length));
  }

  return output;
}

function normalizeBlock(block: ImportedBlock): ImportedBlock[] {
  if (block.type === "paragraph" || block.type === "longQuote") {
    const text = cleanText(block.text);
    if (!text) return [];
    return splitInlineAcademicText(text, block.type);
  }

  if (block.type === "heading") {
    const text = cleanText(block.text);
    if (!text) return [];
    const split = splitInlineAcademicText(text, "heading");
    if (split.length === 1 && split[0]?.type === "paragraph") {
      return [headingBlock(split[0].text, block.level)];
    }
    return split;
  }

  return [block];
}

function textFromBlock(block: ImportedBlock): string[] {
  if (block.type === "pageBreak" || block.type === "image") return [];
  if (block.type === "table") return block.rows.map((row) => row.join("\t"));
  return [block.text];
}

function blockText(block: ImportedBlock): string {
  return textFromBlock(block).join("\n").trim();
}

function isTocHeading(block: ImportedBlock): boolean {
  return normalizeForDetection(blockText(block)) === "SUMARIO";
}

function isStandalonePageNumber(text: string): boolean {
  return /^\d{1,4}$/.test(cleanText(text));
}

function isTocEntry(text: string): boolean {
  const cleaned = cleanText(text);
  const normalized = normalizeForDetection(cleaned);
  if (!normalized) return false;
  if (isStandalonePageNumber(cleaned)) return true;
  if (/^[\-–—]\s*\d{1,4}$/.test(cleaned)) return true;
  if (/^\d+(?:\.\d+)*\s*$/.test(normalized)) return true;
  if (/^\d+(?:\.\d+)*\s+.+\s+\d{1,4}$/.test(normalized)) return true;
  if (/^(REFERENCIAS|APENDICE|APENDICES|ANEXO|ANEXOS|CONCLUSAO|CONSIDERACOES FINAIS)\b.*\s+\d{1,4}$/.test(normalized)) return true;
  if (/^\d+(?:\.\d+)*\s+(INTRODUCAO|REFERENCIAL TEORICO|METODOLOGIA|CRONOGRAMA|RESULTADOS ESPERADOS|CONSIDERACOES FINAIS)\b/.test(normalized)) return true;
  if (/^\d+(?:\.\d+)*\s+[A-Z0-9]/.test(normalized) && normalized.length < 120) return true;
  return false;
}

function looksLikeRealBodyStart(blocks: ImportedBlock[], index: number): boolean {
  const current = normalizeForDetection(blockText(blocks[index]));
  const isIntro = current === "1 INTRODUCAO" || current === "INTRODUCAO";
  if (!isIntro) return false;

  for (let cursor = index + 1; cursor < Math.min(blocks.length, index + 6); cursor += 1) {
    const candidate = blocks[cursor];
    if (candidate.type === "pageBreak") continue;
    const text = blockText(candidate);
    if (!text || isStandalonePageNumber(text) || isTocEntry(text)) continue;
    const normalized = normalizeForDetection(text);
    if (!/^\d+(?:\.\d+)*\s+/.test(normalized) && text.length > 60) {
      return true;
    }
  }

  return false;
}

function stripTableOfContents(blocks: ImportedBlock[]): ImportedBlock[] {
  const output: ImportedBlock[] = [];
  let insideToc = false;

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    const text = blockText(block);

    if (!insideToc && isTocHeading(block)) {
      insideToc = true;
      continue;
    }

    if (insideToc) {
      if (looksLikeRealBodyStart(blocks, index)) {
        insideToc = false;
        output.push(block);
        continue;
      }

      if (block.type === "pageBreak" || !text || isTocEntry(text) || block.type === "heading") {
        continue;
      }

      if (text.length < 120) {
        continue;
      }

      insideToc = false;
      output.push(block);
      continue;
    }

    output.push(block);
  }

  return output;
}

function shouldForcePageBreakBefore(block: ImportedBlock): boolean {
  if (block.type !== "heading") return false;
  return /^(RESUMO|ABSTRACT|REFERÊNCIAS|REFERENCIAS)$/i.test(block.text) || /^1\s+Introdu/i.test(block.text);
}

function normalizeBlocks(blocks: ImportedBlock[]): ImportedBlock[] {
  const split = blocks.flatMap(normalizeBlock);
  const withoutToc = stripTableOfContents(split);
  const normalized: ImportedBlock[] = [];

  for (const block of withoutToc) {
    if (shouldForcePageBreakBefore(block) && !shouldSuppressPageBreak(normalized)) {
      normalized.push(pageBreakBlock());
    }
    normalized.push(block);
  }

  return normalized;
}

function hasStructuralChange(before: ImportedBlock[], after: ImportedBlock[]): boolean {
  if (before.length !== after.length) return true;
  return before.some(
    (block, index) =>
      block.type !== after[index]?.type ||
      textFromBlock(block).join("\n") !== textFromBlock(after[index] ?? block).join("\n"),
  );
}

export function normalizePlainAcademicText(text: string): ImportNormalizationResult {
  const blocks = text
    .split(/\r?\n+/)
    .map(cleanText)
    .filter(Boolean)
    .map((line) => textBlock(line));
  const normalizedBlocks = normalizeBlocks(blocks);
  const normalizedText = normalizedBlocks.flatMap(textFromBlock).join("\n");

  return {
    text: normalizedText,
    structure: {
      blocks: normalizedBlocks,
      paragraphs: [],
      images: [],
      relationships: {},
      styleNames: {},
      text: normalizedText,
      hasNumbering: false,
    },
    messages: hasStructuralChange(blocks, normalizedBlocks)
      ? [
          "Documento mal segmentado: título, resumo, sumário e seções foram separados automaticamente para revisão.",
        ]
      : [],
  };
}

export function normalizeImportedStructure(structure: DocxStructure): ImportNormalizationResult {
  const normalizedBlocks = normalizeBlocks(structure.blocks);
  const normalizedText = normalizedBlocks.flatMap(textFromBlock).join("\n");

  return {
    text: normalizedText || structure.text,
    structure: {
      ...structure,
      blocks: normalizedBlocks,
      text: normalizedText || structure.text,
    },
    messages: hasStructuralChange(structure.blocks, normalizedBlocks)
      ? [
          "Documento mal segmentado: título, resumo, sumário e seções foram separados automaticamente para revisão.",
        ]
      : [],
  };
}
