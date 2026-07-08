import { cleanMojibakeText } from "./docx-render-core";
import { normalizeUflaManualInTextCitations } from "./in-text-citation-normalizer";

const HEADING_ALIASES: Record<string, string> = {
  SUMRIO: "SUMÁRIO",
  SUMARIO: "SUMÁRIO",
  REFERENCIAL TERICO: "REFERENCIAL TEÓRICO",
  REFERENCIAL TEORICO: "REFERENCIAL TEÓRICO",
  DELIMITACAO DO TEMA: "DELIMITAÇÃO DO TEMA",
  DELIMITAÇÃO DO TEMA: "DELIMITAÇÃO DO TEMA",
  HIPOTESE: "HIPÓTESE",
  HIPÓTESE: "HIPÓTESE",
  OBJETIVOS ESPECIFICOS: "OBJETIVOS ESPECÍFICOS",
  OBJETIVOS ESPECÍFICOS: "OBJETIVOS ESPECÍFICOS",
  RECURSOS ORCAMENTO: "RECURSOS/ORÇAMENTO",
  RECURSOS/ORCAMENTO: "RECURSOS/ORÇAMENTO",
  RECURSOS/ORÇAMENTO: "RECURSOS/ORÇAMENTO",
  CONSIDERACOES FINAIS: "CONSIDERAÇÕES FINAIS",
  CONSIDERAÇÕES FINAIS: "CONSIDERAÇÕES FINAIS",
  REFERENCIAS: "REFERÊNCIAS",
  REFERÊNCIAS: "REFERÊNCIAS",
};

const STRUCTURAL_HEADING_LABELS = new Set([
  "TEMA",
  "DELIMITACAO DO TEMA",
  "DELIMITAÇÃO DO TEMA",
  "PROBLEMA DE PESQUISA",
  "PROBLEMA",
  "HIPOTESE",
  "HIPÓTESE",
  "OBJETIVO GERAL",
  "OBJETIVOS ESPECIFICOS",
  "OBJETIVOS ESPECÍFICOS",
  "JUSTIFICATIVA",
  "REFERENCIAL TERICO",
  "REFERENCIAL TEORICO",
  "REFERENCIAL TEÓRICO",
  "METODOLOGIA",
  "CRONOGRAMA",
  "RECURSOS ORCAMENTO",
  "RECURSOS/ORCAMENTO",
  "RECURSOS/ORÇAMENTO",
  "RESULTADOS ESPERADOS",
  "CONSIDERACOES FINAIS",
  "CONSIDERAÇÕES FINAIS",
  "REFERENCIAS",
  "REFERÊNCIAS",
]);

export function stripTocArtifacts(value: string): string {
  return value.replace(/\bToc\d+\b/gi, "").replace(/\s{2,}/g, " ").trim();
}

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[.:;–—-]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitNumericPrefix(value: string): { prefix: string; label: string } {
  const match = value.trim().match(/^(\d+(?:\.\d+)*)\s+(.+)$/);
  if (!match) return { prefix: "", label: value.trim() };
  return { prefix: `${match[1]} `, label: match[2].trim() };
}

export function normalizeResearchProjectHeading(value: string): string {
  const withoutToc = stripTocArtifacts(cleanMojibakeText(value));
  const { prefix, label } = splitNumericPrefix(withoutToc);
  const folded = fold(label);
  return `${prefix}${HEADING_ALIASES[folded] ?? label}`.trim();
}

function markdownHeadingPrefix(level: string): string {
  if (level === "2") return "##";
  if (level === "3") return "###";
  return "#";
}

function isBareProjectHeading(value: string): boolean {
  const clean = stripTocArtifacts(value).replace(/^\d+(?:\.\d+)*\s+/, "");
  return STRUCTURAL_HEADING_LABELS.has(fold(clean));
}

function normalizeEditorLine(line: string): string {
  const cleaned = stripTocArtifacts(cleanMojibakeText(line));
  if (!cleaned) return "";

  const titleMatch = cleaned.match(/^TITLE\s*([123])\s+(.+)$/i);
  if (titleMatch) {
    return `${markdownHeadingPrefix(titleMatch[1])} ${normalizeResearchProjectHeading(titleMatch[2])}`;
  }

  const markdownMatch = cleaned.match(/^(#{1,3})\s+(.+)$/);
  if (markdownMatch) {
    return `${markdownMatch[1]} ${normalizeResearchProjectHeading(markdownMatch[2])}`;
  }

  if (isBareProjectHeading(cleaned)) {
    return `# ${normalizeResearchProjectHeading(cleaned)}`;
  }

  return normalizeUflaManualInTextCitations(cleaned);
}

export function normalizeResearchProjectEditorText(value: string): string {
  return value
    .split(/\r?\n/)
    .map(normalizeEditorLine)
    .filter(Boolean)
    .join("\n");
}

export function hasResearchProjectTechnicalNoise(value: string): boolean {
  return /^\s*TITLE\s*[123]\s+/im.test(value) || /\bToc\d+\b/i.test(value) || /\b(SUMRIO|REFERENCIAL TERICO)\b/i.test(value);
}

export function normalizeKeywordSentence(value: string): string {
  const items = value
    .replace(/[，]/g, ";")
    .split(/[;\.]+/)
    .map((item) => cleanMojibakeText(item).trim())
    .filter(Boolean);
  if (!items.length) return "";
  return `${items.join(". ")}.`;
}
