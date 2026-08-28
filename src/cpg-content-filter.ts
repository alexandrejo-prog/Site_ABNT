import type { EditorBlock } from "./export-docx";
import { cleanMojibakeText } from "./text-utils";

const FORBIDDEN_CPG_HEADINGS = new Map<string, string>([
  ["CAPA", "CAPA"],
  ["FOLHA DE ROSTO", "FOLHA DE ROSTO"],
  ["SUMARIO", "SUMÁRIO"],
  ["FICHA CATALOGRAFICA", "FICHA CATALOGRÁFICA"],
  ["FOLHA DE APROVACAO", "FOLHA DE APROVAÇÃO"],
  ["DEDICATORIA", "DEDICATÓRIA"],
  ["AGRADECIMENTOS", "AGRADECIMENTOS"],
  ["EPIGRAFE", "EPÍGRAFE"],
  ["INDICADORES DE IMPACTO", "INDICADORES DE IMPACTO"],
  ["IMPACT INDICATORS", "IMPACT INDICATORS"],
  ["APENDICE", "APÊNDICE"],
  ["APENDICES", "APÊNDICES"],
  ["ANEXO", "ANEXO"],
  ["ANEXOS", "ANEXOS"],
]);

function normalizeHeading(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/^#{1,6}\s*/, "")
    .replace(/^\[\s*/, "")
    .replace(/\s*\]$/, "")
    .replace(/^\d+(?:\.\d+)*\s+/, "")
    .replace(/[:.\-–—]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isLikelyHeadingLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  const withoutMarkdown = trimmed.replace(/^#{1,6}\s*/, "");
  if (/^#{1,6}\s+/.test(trimmed)) return true;
  if (/^\d+(?:\.\d+)*\s+\S+/.test(withoutMarkdown)) return true;
  if (/^\[?[A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9\s:.\-–—]+\]?$/.test(withoutMarkdown) && withoutMarkdown.length <= 90) return true;
  return false;
}

function isTopLevelNumberedHeading(line: string): boolean {
  return /^\s*(?:#{1,6}\s*)?\d+\s+\S+/.test(line) && !/^\s*(?:#{1,6}\s*)?\d+\.\d+/.test(line);
}

function renumberTopLevelHeadings(text: string): string {
  let nextNumber = 1;
  return text
    .split(/\r?\n/)
    .map((line) => {
      if (!isTopLevelNumberedHeading(line)) return line;
      return line.replace(/^(\s*(?:#{1,6}\s*)?)\d+(\s+\S.*)$/u, (_match, prefix: string, rest: string) => {
        const updated = `${prefix}${nextNumber}${rest}`;
        nextNumber += 1;
        return updated;
      });
    })
    .join("\n");
}

export function cpgForbiddenHeadingLabel(line: string): string | null {
  if (!isLikelyHeadingLine(line)) return null;
  return FORBIDDEN_CPG_HEADINGS.get(normalizeHeading(line)) ?? null;
}

export function stripCpgForbiddenSections(editorText: string): string {
  const lines = editorText.split(/\r?\n/);
  const kept: string[] = [];
  let skippingForbiddenSection = false;

  for (const line of lines) {
    const forbiddenLabel = cpgForbiddenHeadingLabel(line);
    if (forbiddenLabel) {
      skippingForbiddenSection = true;
      continue;
    }

    if (skippingForbiddenSection) {
      if (isLikelyHeadingLine(line)) {
        skippingForbiddenSection = false;
        kept.push(line);
      }
      continue;
    }

    kept.push(line);
  }

  return renumberTopLevelHeadings(kept.join("\n").replace(/\n{3,}/g, "\n\n").trim());
}

export function hasCpgForbiddenSections(editorText: string): boolean {
  return editorText.split(/\r?\n/).some((line) => cpgForbiddenHeadingLabel(line) !== null);
}

// Marcador de afiliação no início da linha do template CPG: sobrescrito unicode
// (¹²³⁴…), números circulados, asteriscos/óbitos e numeral arábico "1.", "1)" ou
// "1 " (o template grava "1Departamento…", sem separador).
const AFFILIATION_MARKER_PATTERN = /^(?:[\u00B9\u00B2\u00B3\u2070\u2074\u2075\u2076\u2077\u2078\u2079\u2460-\u24FF*†‡]+\s*|\d+(?:\.|\)|-)?\s*)(?=\S)/u;

function affiliationIdentity(line: string): string {
  return line
    .replace(AFFILIATION_MARKER_PATTERN, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Remove linhas de afiliação duplicadas no modo CPG. O template repete a mesma
 * instituição uma vez por autor (¹…²…³…); quando o texto é idêntico após
 * ignorar o marcador de sobrescrito, mantém apenas a primeira ocorrência.
 */
export function dedupeCpgAffiliations(value: string): string {
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const line of value.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const key = affiliationIdentity(trimmed);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(trimmed);
  }
  return deduped.join("\n");
}

const REFERENCE_SECTION_TITLES = new Set([
  "REFERENCIAS",
  "REFERENCIA",
  "BIBLIOGRAFICAS",
  "BIBLIOGRAFIA",
  "REFERENCIAS BIBLIOGRAFICAS",
  "REFERENCIA BIBLIOGRAFICA",
  "BIBLIOGRAFICAS REFERENCIAS",
]);

export interface CpgReferenceSplit {
  bodyBlocks: EditorBlock[];
  referenceTitle?: string;
  references: string[];
}

/**
 * Separa a seção de referências presente no fim do texto do editor (título +
 * parágrafos de referência) dos blocos de corpo. Evita que referências entradas
 * tanto no campo quanto no editor sejam renderizadas em duas seções.
 */
export function splitCpgReferences(blocks: EditorBlock[]): CpgReferenceSplit {
  const sectionIndex = blocks.findIndex(
    (block) =>
      (block.type === "heading1" ||
        block.type === "heading2" ||
        block.type === "heading3" ||
        block.type === "paragraph") &&
      REFERENCE_SECTION_TITLES.has(normalizeHeading(block.text)),
  );

  if (sectionIndex === -1) {
    return {
      bodyBlocks: blocks.filter((block) => block.type !== "reference" && block.type !== "importedImage"),
      references: blocks.filter((block) => block.type === "reference").map((block) => block.text),
    };
  }

  const titleBlock = blocks[sectionIndex];
  return {
    bodyBlocks: blocks
      .slice(0, sectionIndex)
      .filter((block) => block.type !== "reference" && block.type !== "importedImage"),
    referenceTitle: cleanMojibakeText(titleBlock.text).trim(),
    references: [
      ...blocks
        .slice(sectionIndex + 1)
        .filter((block) => block.type === "paragraph" || block.type === "reference")
        .map((block) => block.text),
      ...blocks.filter((block) => block.type === "reference").map((block) => block.text),
    ],
  };
}
