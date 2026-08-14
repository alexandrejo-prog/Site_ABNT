import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const root = join(__dirname, "..", "..");

const inputPath = join(root, "artifacts", "ufla-compliance", "input-structure.json");
const candidatesPath = join(root, "artifacts", "ufla-compliance", "heading-candidates.json");
const reportPath = join(root, "artifacts", "ufla-compliance", "heading-confusion-report.md");

const data = JSON.parse(readFileSync(inputPath, "utf8"));
const paragraphs = data.paragraphs || [];
const headings = data.headings || [];

const knownPrimaryExact = new Set([
  "INTRODUCAO",
  "REFERENCIAL TEORICO",
  "METODOLOGIA",
  "RESULTADOS",
  "CONSIDERACOES FINAIS",
  "REFERENCIAS",
  "APENDICES",
  "ANEXOS",
]);

const knownSecondaryExact = new Set([
  "OBJETIVOS",
  "OBJETIVO GERAL",
  "OBJETIVOS ESPECIFICOS",
  "JUSTIFICATIVA",
  "POLITICA PUBLICA: NOÇÃO GERAL",
  "POLITICA PUBLICA: NOÇÃO GERAL",
  "CICLO DE POLITICA PUBLICA",
  "FORMULACAO",
  "IMPLEMENTACAO",
  "POLITICA DE INFORMACAO EM CIENCIA E TECNOLOGIA (ICT)",
  "POLITICA INSTITUCIONAL DE INFORMACAO",
  "REPOSITORIO INSTITUCIONAL",
  "SOFTWARE",
  "POLITICAS PARA REPOSITORIOS",
  "TIPO DE PESQUISA",
  "METODO DE PESQUISA",
  "COLETA DE DADOS",
  "TRATAMENTO E ANALISE DOS DADOS",
]);

const referencePatterns = [
  /^[A-ZÀ-Ú][A-ZÀ-Ú\s,.;:'()-]+\.\s+\d{4}$/,
  /^[A-ZÀ-Ú][A-ZÀ-Ú\s,.;:'()-]+\.\s+[A-ZÀ-Ú][a-zà-ú]+\./,
  /^[A-ZÀ-Ú][A-ZÀ-Ú\s,.;:'()-]+\.\s+[A-ZÀ-Ú][a-zà-ú]+\./,
];

const captionPatterns = [
  /^(FIGURA|TABELA|QUADRO|GRAFICO|MAPA|ILUSTRAÇÃO|ILUSTRACAO)\s+\d+/i,
];

const listPatterns = [
  /^\d+\.\s/,
  /^[a-z]\)\s/,
  /^[•–-]\s/,
];

const urlPattern = /https?:\/\//i;

const pageNumberPattern = /^\d+$/;

function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\d+$/, "")
    .trim();
}

function context(index: number): { before: string; after: string } {
  const before = paragraphs.slice(Math.max(0, index - 2), index).map((p: any) => (p.text || "").trim()).filter(Boolean).join(" | ");
  const after = paragraphs.slice(index + 1, index + 3).map((p: any) => (p.text || "").trim()).filter(Boolean).join(" | ");
  return { before, after };
}

function classify(heading: any): { classification: string; accepted: boolean; level: number | null; reason: string; action: string } {
  const text = (heading.text || "").trim();
  const normalized = normalizeText(text);
  const { before, after } = context(heading.index);

  if (!text) {
    return { classification: "false-positive", accepted: false, level: null, reason: "empty-text", action: "preserve-as-paragraph" };
  }

  if (pageNumberPattern.test(text.trim())) {
    return { classification: "page-number", accepted: false, level: null, reason: "numeric-page-number", action: "preserve-as-paragraph" };
  }

  if (urlPattern.test(text)) {
    return { classification: "false-positive", accepted: false, level: null, reason: "url", action: "preserve-as-paragraph" };
  }

  if (captionPatterns.some((p) => p.test(text))) {
    return { classification: "caption", accepted: false, level: null, reason: "figure-table-caption-pattern", action: "preserve-as-paragraph" };
  }

  if (listPatterns.some((p) => p.test(text))) {
    return { classification: "list-item", accepted: false, level: null, reason: "numbered-list-item-pattern", action: "preserve-as-paragraph" };
  }

  if (knownPrimaryExact.has(normalized)) {
    return { classification: "primary-heading", accepted: true, level: 1, reason: "known-primary-section-exact-match", action: "promote-to-heading" };
  }

  if (knownSecondaryExact.has(normalized)) {
    return { classification: "secondary-heading", accepted: true, level: 2, reason: "known-secondary-section-exact-match", action: "promote-to-heading" };
  }

  if (/^(APÊNDICE|APENDICE)\s+[A-Z]/i.test(text) && text.length < 40) {
    return { classification: "appendix-heading", accepted: true, level: 2, reason: "appendix-marker-pattern", action: "promote-to-heading" };
  }

  if (/^(ANEXO)\s+[A-Z]/i.test(text) && text.length < 40) {
    return { classification: "annex-heading", accepted: true, level: 2, reason: "annex-marker-pattern", action: "promote-to-heading" };
  }

  if (/^REFERÊNCIAS$/i.test(text) || /^REFERENCIAS$/i.test(text)) {
    return { classification: "reference-heading", accepted: true, level: 1, reason: "references-section-marker", action: "promote-to-heading" };
  }

  if (/^(INTRODUCAO|INTRODUÇÃO)$/i.test(text)) {
    return { classification: "primary-heading", accepted: true, level: 1, reason: "introduction-marker", action: "promote-to-heading" };
  }

  if (/^(REFERENCIAL TEORICO|REFERENCIAL TEÓRICO)$/i.test(text)) {
    return { classification: "primary-heading", accepted: true, level: 1, reason: "theoretical-framework-marker", action: "promote-to-heading" };
  }

  if (/^(METODOLOGIA)$/i.test(text)) {
    return { classification: "primary-heading", accepted: true, level: 1, reason: "methodology-marker", action: "promote-to-heading" };
  }

  if (/^(RESULTADOS)$/i.test(text)) {
    return { classification: "primary-heading", accepted: true, level: 1, reason: "results-marker", action: "promote-to-heading" };
  }

  if (/^(CONSIDERACOES FINAIS|CONSIDERAÇÕES FINAIS)$/i.test(text)) {
    return { classification: "primary-heading", accepted: true, level: 1, reason: "final-considerations-marker", action: "promote-to-heading" };
  }

  if (/^(OBJETIVOS|OBJETIVO GERAL|OBJETIVOS ESPECIFICOS|JUSTIFICATIVA)$/i.test(text)) {
    return { classification: "secondary-heading", accepted: true, level: 2, reason: "introduction-subsection-marker", action: "promote-to-heading" };
  }

  const headingCount = headings.length;
  const headingFraction = headingCount > 0 ? headings.filter((h: any) => h.text === text).length / headingCount : 0;

  if (text.split(/\s+/).length <= 8 && text === text.toUpperCase() && /[A-Z]/.test(text) && text.length > 3 && headingFraction < 0.05) {
    return { classification: "ambiguous", accepted: false, level: null, reason: "uppercase-short-line-low-repetition", action: "preserve-as-paragraph" };
  }

  if (text.split(/\s+/).length <= 8 && text.length > 3 && headingFraction < 0.02) {
    return { classification: "ambiguous", accepted: false, level: null, reason: "short-line-low-repetition", action: "preserve-as-paragraph" };
  }

  return { classification: "false-positive", accepted: false, level: null, reason: "no-strong-heading-signals", action: "preserve-as-paragraph" };
}

const classified = headings.map((h: any) => {
  const result = classify(h);
  const { before, after } = context(h.index);
  return {
    sourceIndex: h.index,
    text: h.text,
    classification: result.classification,
    accepted: result.accepted,
    level: result.level,
    confidence: h.confidence,
    signals: h.signals,
    reason: result.reason,
    action: result.action,
    contextBefore: before,
    contextAfter: after,
  };
});

const summary = {
  total: classified.length,
  accepted: classified.filter((c: any) => c.accepted).length,
  primaryHeading: classified.filter((c: any) => c.classification === "primary-heading").length,
  secondaryHeading: classified.filter((c: any) => c.classification === "secondary-heading").length,
  tertiaryHeading: classified.filter((c: any) => c.classification === "tertiary-heading").length,
  frontmatterHeading: classified.filter((c: any) => c.classification === "frontmatter-heading").length,
  referenceHeading: classified.filter((c: any) => c.classification === "reference-heading").length,
  appendixHeading: classified.filter((c: any) => c.classification === "appendix-heading").length,
  annexHeading: classified.filter((c: any) => c.classification === "annex-heading").length,
  caption: classified.filter((c: any) => c.classification === "caption").length,
  listItem: classified.filter((c: any) => c.classification === "list-item").length,
  tableText: classified.filter((c: any) => c.classification === "table-text").length,
  headerFooter: classified.filter((c: any) => c.classification === "header-footer").length,
  pageNumber: classified.filter((c: any) => c.classification === "page-number").length,
  referenceEntry: classified.filter((c: any) => c.classification === "reference-entry").length,
  footnote: classified.filter((c: any) => c.classification === "footnote").length,
  ambiguous: classified.filter((c: any) => c.classification === "ambiguous").length,
  falsePositive: classified.filter((c: any) => c.classification === "false-positive").length,
};

const writeJson = () => writeFileSync(candidatesPath, JSON.stringify({ summary, candidates: classified }, null, 2));

const writeReport = () => {
  const md = `# Heading Confusion Report

Input: ${data.input}

## Summary

| Category | Count |
|----------|-------|
| Total candidates | ${summary.total} |
| Accepted | ${summary.accepted} |
| Primary heading | ${summary.primaryHeading} |
| Secondary heading | ${summary.secondaryHeading} |
| Tertiary heading | ${summary.tertiaryHeading} |
| Frontmatter heading | ${summary.frontmatterHeading} |
| Reference heading | ${summary.referenceHeading} |
| Appendix heading | ${summary.appendixHeading} |
| Annex heading | ${summary.annexHeading} |
| Caption | ${summary.caption} |
| List item | ${summary.listItem} |
| Table text | ${summary.tableText} |
| Header/footer | ${summary.headerFooter} |
| Page number | ${summary.pageNumber} |
| Reference entry | ${summary.referenceEntry} |
| Footnote | ${summary.footnote} |
| Ambiguous | ${summary.ambiguous} |
| False positive | ${summary.falsePositive} |

## Accepted headings

${classified.filter((c: any) => c.accepted).map((c: any) => `- ${c.text} (${c.classification}, level=${c.level}, confidence=${c.confidence})`).join("\n") || "none"}

## Ambiguous candidates (sample)

${classified.filter((c: any) => c.classification === "ambiguous").slice(0, 20).map((c: any) => `- ${c.text} — ${c.reason}`).join("\n") || "none"}

## False positives (sample)

${classified.filter((c: any) => c.classification === "false-positive").slice(0, 20).map((c: any) => `- ${c.text} — ${c.reason}`).join("\n") || "none"}
`;
  writeFileSync(reportPath, md);
};

writeJson();
writeReport();
console.log("CLASSIFICACAO_TITULOS_CONCLUIDA");
console.log(JSON.stringify(summary, null, 2));