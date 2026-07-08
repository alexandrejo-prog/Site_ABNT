import { normalizeForDetection } from "./word-structure-extractor";

function normalizeHeadingFragment(value: string): string {
  return normalizeForDetection(value).replace(/^\d+(?:\.\d+)*\s+/, "").replace(/\s*-\s*$/, "");
}

function stripMarkdownHeading(value: string): string {
  return value.replace(/^#{1,6}\s*/, "").trim();
}

interface HeadingFragmentPair {
  currentHeadings: string[];
  nextFragment: string;
}

const HEADING_FRAGMENT_PAIRS: HeadingFragmentPair[] = [
  { currentHeadings: ["OBJETIVOS"], nextFragment: "ESPECIFICOS" },
  { currentHeadings: ["CRONOGRAMA"], nextFragment: "DE EXECUCAO" },
  { currentHeadings: ["CONSIDERACOES"], nextFragment: "FINAIS" },
  { currentHeadings: ["REFERENCIAS"], nextFragment: "BIBLIOGRAFICAS" },
  { currentHeadings: ["FUNDAMENTACAO"], nextFragment: "TEORICA" },
  { currentHeadings: ["REVISAO"], nextFragment: "BIBLIOGRAFICA" },
  { currentHeadings: ["RESULTADOS"], nextFragment: "ESPERADOS" },
  { currentHeadings: ["MATERIAL E"], nextFragment: "METODOS" },
  { currentHeadings: ["RECURSOS"], nextFragment: "E ORCAMENTO" },
  { currentHeadings: ["METODOLOGIA"], nextFragment: "DE TESTE" },
];

const COMMON_HEADING_STARTS = [
  "INTRODUCAO",
  "REFERENCIAL",
  "FUNDAMENTACAO",
  "REVISAO",
  "MATERIAL",
  "METODOLOGIA",
  "METODOS",
  "RESULTADOS",
  "DISCUSSAO",
  "CONCLUSAO",
  "CONSIDERACOES",
  "CRONOGRAMA",
  "RECURSOS",
  "ORCAMENTO",
  "REFERENCIAS",
  "APENDICE",
  "ANEXO",
  "OBJETIVO",
  "OBJETIVOS",
  "JUSTIFICATIVA",
  "PROBLEMA",
  "HIPOTESE",
];

const FRAGMENT_STARTERS = new Set([
  "A",
  "AS",
  "AO",
  "AOS",
  "DA",
  "DAS",
  "DE",
  "DO",
  "DOS",
  "E",
  "EM",
  "NA",
  "NAS",
  "NO",
  "NOS",
  "PARA",
  "POR",
  "SOBRE",
]);

function isKnownHeadingFragment(currentLine: string, nextLine: string): boolean {
  const current = normalizeHeadingFragment(stripMarkdownHeading(currentLine));
  const next = normalizeHeadingFragment(nextLine);

  for (const pair of HEADING_FRAGMENT_PAIRS) {
    const normalizedHeadings = pair.currentHeadings.map((h) => normalizeHeadingFragment(h));
    const headingPattern = new RegExp(`^(${normalizedHeadings.join("|")})$`);

    if (headingPattern.test(current) && next === normalizeHeadingFragment(pair.nextFragment)) {
      return true;
    }
  }

  return false;
}

function isMarkdownOrNumberedHeading(line: string): boolean {
  const trimmed = line.trim();
  const plain = stripMarkdownHeading(trimmed);
  return /^#{1,6}\s+/.test(trimmed) || /^\d+(?:\.\d+)*\s+\S+/.test(plain);
}

function firstToken(value: string): string {
  return normalizeHeadingFragment(value).split(/\s+/)[0] ?? "";
}

function isShortHeadingContinuation(nextLine: string): boolean {
  const trimmed = nextLine.trim();
  const normalized = normalizeHeadingFragment(trimmed);
  if (!normalized) return false;
  if (trimmed.length > 70) return false;
  if (/^#{1,6}\s+/.test(trimmed)) return false;
  if (/^\d+(?:\.\d+)*\s+\S+/.test(trimmed)) return false;
  if (/[.!?;]$/.test(trimmed)) return false;

  const words = normalized.split(/\s+/).filter(Boolean);
  if (!words.length || words.length > 6) return false;
  if (FRAGMENT_STARTERS.has(words[0])) return true;

  const hasLowercase = /[a-záéíóúâêôãõç]/.test(trimmed);
  const allUppercaseLike = trimmed === trimmed.toUpperCase();
  return allUppercaseLike || !hasLowercase;
}

function isLikelyBrokenHeading(currentLine: string, nextLine: string): boolean {
  const current = normalizeHeadingFragment(stripMarkdownHeading(currentLine));
  if (!isMarkdownOrNumberedHeading(currentLine)) return false;
  if (!isShortHeadingContinuation(nextLine)) return false;

  const currentFirstToken = firstToken(current);
  return COMMON_HEADING_STARTS.includes(currentFirstToken) || /^\d+(?:\.\d+)*\s+/.test(stripMarkdownHeading(currentLine));
}

function shouldRepairHeadingFragment(currentLine: string, nextLine: string): boolean {
  return isKnownHeadingFragment(currentLine, nextLine) || isLikelyBrokenHeading(currentLine, nextLine);
}

function nextNonEmptyLineIndex(lines: string[], startIndex: number): number | undefined {
  for (let index = startIndex; index < lines.length; index += 1) {
    if (lines[index].trim()) return index;
  }

  return undefined;
}

export function repairHeadingFragments(text: string): string {
  const lines = text.split(/\r?\n/);
  const repaired: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const current = lines[index];
    const nextIndex = nextNonEmptyLineIndex(lines, index + 1);

    if (current.trim() && nextIndex !== undefined) {
      const next = lines[nextIndex];

      if (shouldRepairHeadingFragment(current.trim(), next.trim())) {
        repaired.push(`${current.trim()} ${next.trim()}`);
        index = nextIndex;
        continue;
      }
    }

    repaired.push(current);
  }

  return repaired.join("\n");
}

export function repairRecordHeadingFragments<T extends object>(record: T): T {
  const repairedEntries = Object.entries(record as Record<string, unknown>).map(([key, value]) => [
    key,
    typeof value === "string" ? repairHeadingFragments(value) : value,
  ]);

  return Object.fromEntries(repairedEntries) as T;
}
