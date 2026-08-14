import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const root = join(__dirname, "..", "..");

const inputPath = join(root, "artifacts", "ufla-compliance", "baseline-extraction.json");
const outputPath = join(root, "artifacts", "ufla-compliance", "input-structure.json");

const data = JSON.parse(readFileSync(inputPath, "utf8"));

const paragraphs = data.paragraphs || [];
const knownPrimary = [
  "INTRODUCAO",
  "REFERENCIAL TEORICO",
  "METODOLOGIA",
  "RESULTADOS",
  "CONSIDERACOES FINAIS",
  "REFERENCIAS",
  "APENDICES",
  "ANEXOS",
];

const knownSecondary = [
  "Objetivos",
  "Objetivo geral",
  "Objetivos específicos",
  "Justificativa",
  "Política pública: noção geral",
  "Ciclo de política pública",
  "Formulação",
  "Implementação",
  "Política de Informação em Ciência e Tecnologia (ICT)",
  "Política Institucional de Informação",
  "Repositório institucional",
  "Software",
  "Políticas para repositórios",
  "Tipo de pesquisa",
  "Método de pesquisa",
  "Coleta de dados",
  "Tratamento e análise dos dados",
];

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

function signalsFor(text: string, normalized: string): string[] {
  const s: string[] = [];
  if (text === text.toUpperCase() && /[A-Z]/.test(text)) s.push("uppercase");
  if (/^\d+(\s|\.\s|\.\s?$)|^\d+\.\d+/.test(text.trim())) s.push("numbered");
  if (text.trim().length <= 60) s.push("short-line");
  if (knownPrimary.includes(normalized)) s.push("known-primary-section");
  if (knownSecondary.includes(normalized)) s.push("known-secondary-section");
  if (/^(INTRODUÇÃO|REFERENCIAL TEÓRICO|METODOLOGIA|RESULTADOS|CONSIDERAÇÕES FINAIS|REFERÊNCIAS|APÊNDICES|ANEXOS)$/.test(normalized)) {
    s.push("structural-keyword");
  }
  return s;
}

function confidence(signals: string[]): number {
  const weights: Record<string, number> = {
    "known-primary-section": 0.5,
    "structural-keyword": 0.3,
    "uppercase": 0.2,
    "short-line": 0.1,
    "numbered": 0.15,
    "known-secondary-section": 0.25,
  };
  const score = signals.reduce((acc, s) => acc + (weights[s] || 0), 0);
  return Math.min(1, Math.round(score * 100) / 100);
}

const headings: any[] = [];
const classified = new Set<number>();

for (const p of paragraphs) {
  const text = (p.text || "").trim();
  if (!text) continue;
  const normalized = normalizeText(text);
  const sig = signalsFor(text, normalized);
  if (sig.length === 0) continue;

  const conf = confidence(sig);
  let level: number | null = null;
  if (knownPrimary.includes(normalized)) level = 1;
  else if (knownSecondary.includes(normalized)) level = 2;
  else if (/^\d+(\s|\.\s|\.\s?$)/.test(text.trim())) {
    const m = text.trim().match(/^(\d+)(?:\.(\d+))?/);
    if (m) level = m[2] ? 3 : 2;
  }

  headings.push({
    index: p.index,
    text,
    level,
    confidence: conf,
    signals: sig,
    source: "heuristic",
  });
  classified.add(p.index);
}

const unmatchedPrimary = knownPrimary.filter((k) => !headings.some((h) => normalizeText(h.text) === normalizeText(k)));
const unmatchedSecondary = knownSecondary.filter((k) => !headings.some((h) => normalizeText(h.text) === normalizeText(k)));

const bodyOrder = data.sections.map((s: string) => {
  const idx = paragraphs.findIndex((p: any) => normalizeText(p.text) === normalizeText(s));
  return { section: s, paragraphIndex: idx >= 0 ? idx : null };
});

const output = {
  input: data.file.path,
  totalParagraphs: data.paragraphCount,
  headingCount: headings.length,
  headings,
  unmatchedPrimary,
  unmatchedSecondary,
  classifiedParagraphCount: classified.size,
  bodyOrder,
};

writeFileSync(outputPath, JSON.stringify(output, null, 2));
console.log("RECONSTRUCAO_SEMANTICA_CONCLUIDA");
console.log(JSON.stringify({
  headingCount: headings.length,
  unmatchedPrimary: unmatchedPrimary.length,
  unmatchedSecondary: unmatchedSecondary.length,
  sample: headings.slice(0, 15).map((h) => ({ text: h.text, level: h.level, confidence: h.confidence, signals: h.signals })),
}, null, 2));