import {
  DocxStructure,
  ImportedBlock,
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
  "Problema de Pesquisa",
  "Objetivos",
  "Objetivo Geral",
  "Objetivos Específicos",
  "Justificativa",
  "Referencial Teórico",
  "Do Paternalismo ao Gerencialismo na Gestão Pública",
  "A Coisificação do Trabalho Técnico-Administrativo",
  "A Pedagogia Histórico-Crítica e o Contraponto ao Modelo Vigente",
  "O Diálogo Sindical e a Resistência",
  "Metodologia",
  "Abordagem",
  "Técnicas de Coleta de Dados",
  "Análise de Dados",
  "Contribuições e Impacto Social do Estudo",
  "Para os Servidores Técnico-Administrativos",
  "Para a Gestão Universitária",
  "Para a Comunidade Interna",
  "Para a Função Social da UFLA",
];

const SECTION_LABEL_PATTERN = SECTION_LABELS.map(escapeRegExp).join("|");
const NUMBERED_HEADING_PATTERN = new RegExp(
  `(^|\\s)(\\d+(?:\\.\\d+)*)(?:\\.)?\\s+(${SECTION_LABEL_PATTERN})(?=\\s|$|[:.])`,
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

function findNextMarker(text: string): InlineMarker | undefined {
  const candidates: InlineMarker[] = [];

  const resumo = text.match(/\bResumo\b\s*[:.\-]?\s*/i);
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

  const abstract = text.match(/\bAbstract\b\s*[:.\-]?\s*/i);
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

  const referencias = text.match(/\bRefer[êe]ncias\b\s*[:.\-]?\s*/i);
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

function shouldForcePageBreakBefore(block: ImportedBlock): boolean {
  if (block.type !== "heading") return false;
  return /^(RESUMO|ABSTRACT|REFERÊNCIAS|REFERENCIAS)$/i.test(block.text) || /^1\s+Introdu/i.test(block.text);
}

function normalizeBlocks(blocks: ImportedBlock[]): ImportedBlock[] {
  const split = blocks.flatMap(normalizeBlock);
  const normalized: ImportedBlock[] = [];

  for (const block of split) {
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
          "Documento mal segmentado: título, resumo e seções foram separados automaticamente para revisão.",
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
          "Documento mal segmentado: título, resumo e seções foram separados automaticamente para revisão.",
        ]
      : [],
  };
}
