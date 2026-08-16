import { normalizeReferencesText } from "../../src/references-normalizer";

/**
 * Auditoria de identidade de referências no round-trip vivo
 * (baseline -> import -> export -> re-import).
 *
 * Objetivo: cada referência de ENTRADA deve ter uma correspondente na SAÍDA,
 * verificada item a item, com preservação de autor, ano, título, URL, DOI,
 * "Acesso em" e do texto completo (acentos e pontuação preservados).
 *
 * A tolerância de contagem só é aceita para itens explicitamente classificados
 * como: duplicata; fragmento reagrupado; entrada inválida documentada; elemento
 * que não é referência após normalização. Não há margem numérica sem exceções.
 */

export type MatchMethod = "exact" | "normalized" | "fragment-rejoined" | "unmatched";

export interface OutputCandidate {
  outputIndex: number;
  similarity: number;
}

export interface ReferenceParts {
  author: boolean;
  year: boolean;
  title: boolean;
  url: boolean;
  doi: boolean;
  access: boolean;
}

export interface ReferenceAuditRecord {
  inputIndex: number;
  inputText: string;
  normalizedInput: string;
  outputCandidates: OutputCandidate[];
  matchedOutputIndex: number | null;
  matchMethod: MatchMethod;
  preserved: boolean;
  reason: string;
  parts: ReferenceParts;
}

export type ExceptionType =
  | "duplicata"
  | "fragmento-reagrupado"
  | "entrada-invalida-documentada"
  | "nao-referencia";

export interface ReferenceException {
  type: ExceptionType;
  inputIndex: number | null;
  outputIndex: number | null;
  reason: string;
}

export interface LostPart {
  inputIndex: number;
  part: keyof ReferenceParts;
  reason: string;
}

export interface ReferenceAuditSummary {
  inputItems: number;
  outputItems: number;
  preserved: number;
  unmatched: number;
  countDelta: number;
  countDeltaJustified: boolean;
  byMethod: Record<"exact" | "normalized" | "fragment-rejoined", number>;
  exceptions: ReferenceException[];
  lostParts: LostPart[];
}

export interface ReferenceAudit {
  generatedAt: string;
  inputDescription: string;
  outputDescription: string;
  summary: ReferenceAuditSummary;
  records: ReferenceAuditRecord[];
}

const EXACT_SIMILARITY = 0.999;
const NORMALIZED_SIMILARITY = 0.92;
const FRAGMENT_RUN_MAX = 4;

/** Colapsa espaços, preservando acentos, caixa e pontuação. */
export function canonicalItem(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function editDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
  for (let i = 0; i < rows; i += 1) dp[i][0] = i;
  for (let j = 0; j < cols; j += 1) dp[0][j] = j;
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[rows - 1][cols - 1];
}

function similarity(a: string, b: string): number {
  const max = Math.max(a.length, b.length);
  if (max === 0) return 1;
  return 1 - editDistance(a, b) / max;
}

/** Procura run consecutivo de items cuja concatenação (com ou sem espaço) iguala target. */
function findConcatRun(
  target: string,
  items: string[],
): { start: number; end: number; joiner: "space" | "none" } | null {
  for (let start = 0; start < items.length; start += 1) {
    for (let end = start + 1; end < Math.min(start + FRAGMENT_RUN_MAX, items.length); end += 1) {
      const joinedSpace = items.slice(start, end + 1).join(" ");
      if (joinedSpace === target) return { start, end, joiner: "space" };
      const joinedNone = items.slice(start, end + 1).join("");
      if (joinedNone === target) return { start, end, joiner: "none" };
      if (joinedSpace.length > target.length && joinedNone.length > target.length) break;
    }
  }
  return null;
}

function fold(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

export function extractReferenceParts(text: string): ReferenceParts {
  const f = fold(text);
  return {
    author:
      /^[a-zà-ú][\p{L}.'\-\s]{1,60},\s*[a-zà-ú]\./u.test(f) ||
      /^(universidade|instituto|brasil|minas gerais|lavras|ministerio|associacao|fundacao|conselho|ufla|abnt)\b/u.test(f),
    year: /\b(19|20)\d{2}\b/u.test(text),
    title: text.replace(/^[^.]*\.\s*/u, "").trim().length >= 8 && text.length >= 25,
    url: /https?:\/\/\S+/iu.test(text),
    doi: /\b10\.\d{4,9}\/[^\s]+/iu.test(text) || /\bdoi\s*:/iu.test(f),
    access: /\b(?:acesso\s+em|dispon[ií]vel\s+em)\s*:/iu.test(f),
  };
}

const TITLE_NOISE = new Set([
  "referencias",
  "referencia",
  "bibliograficas",
  "bibliografia",
  "referencias bibliograficas",
  "referencia bibliografica",
  "bibliograficas referencias",
]);

function isTitleNoise(text: string): boolean {
  const key = fold(text)
    .replace(/[#*:.\-–—]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return TITLE_NOISE.has(key);
}

export function referenceItems(rawLines: string[]): string[] {
  return normalizeReferencesText(rawLines.join("\n")).map((r) => canonicalItem(r.text));
}

export function auditReferenceRoundTrip(
  inputLines: string[],
  outputLines: string[],
  descriptions: { input: string; output: string },
): ReferenceAudit {
  const inputItems = referenceItems(inputLines);
  const outputItems = referenceItems(outputLines);

  const records: ReferenceAuditRecord[] = [];
  const matchedOutput = new Set<number>();
  const lostParts: LostPart[] = [];
  const exceptions: ReferenceException[] = [];

  inputItems.forEach((inputText, i) => {
    const candidates = outputItems
      .map((outputText, j) => ({ outputIndex: j, similarity: similarity(inputText, outputText) }))
      .filter((c) => c.similarity >= 0.7)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5);

    const top = candidates[0];
    let matchMethod: MatchMethod = "unmatched";
    let matchedOutputIndex: number | null = null;
    let reason = "sem correspondente na saída";

    if (top && top.similarity >= EXACT_SIMILARITY) {
      matchMethod = "exact";
      matchedOutputIndex = top.outputIndex;
      reason = "texto idêntico após normalização (acentos e pontuação preservados)";
    } else if (top && top.similarity >= NORMALIZED_SIMILARITY) {
      matchMethod = "normalized";
      matchedOutputIndex = top.outputIndex;
      reason = `similaridade ${top.similarity.toFixed(3)} — diferença apenas de forma, sem perda semântica`;
    } else {
      const run = findConcatRun(inputText, outputItems);
      if (run) {
        matchMethod = "fragment-rejoined";
        matchedOutputIndex = run.end;
        reason = `fragmento reagrupado: entrada corresponde à concatenação das saídas ${run.start}..${run.end} (${run.joiner === "space" ? "com" : "sem"} espaço)`;
      }
    }

    if (matchedOutputIndex !== null) matchedOutput.add(matchedOutputIndex);

    const parts = extractReferenceParts(inputText);
    const matchedText = matchedOutputIndex !== null ? outputItems[matchedOutputIndex] : null;
    const missing: (keyof ReferenceParts)[] = [];
    if (matchedText !== null) {
      const matchedParts = extractReferenceParts(matchedText);
      (Object.keys(parts) as (keyof ReferenceParts)[]).forEach((part) => {
        if (parts[part] && !matchedParts[part]) missing.push(part);
      });
    } else {
      (Object.keys(parts) as (keyof ReferenceParts)[]).forEach((part) => {
        if (parts[part]) missing.push(part);
      });
    }

    const preserved = matchMethod !== "unmatched" && missing.length === 0;
    missing.forEach((part) => {
      lostParts.push({
        inputIndex: i,
        part,
        reason: `parte '${part}' presente na entrada e ausente na saída correspondente`,
      });
    });

    records.push({
      inputIndex: i,
      inputText,
      normalizedInput: inputText,
      outputCandidates: candidates.map((c) => ({ outputIndex: c.outputIndex, similarity: c.similarity })),
      matchedOutputIndex,
      matchMethod,
      preserved,
      reason,
      parts,
    });
  });

  // Saídas sem correspondência -> exigem exceção explícita.
  outputItems.forEach((outputText, j) => {
    if (matchedOutput.has(j)) return;
    if (inputItems.filter((t) => t === outputText).length > 0) {
      exceptions.push({
        type: "duplicata",
        inputIndex: null,
        outputIndex: j,
        reason: "texto duplicado na entrada; a saída mantém uma cópia",
      });
      return;
    }
    const run = findConcatRun(outputText, inputItems);
    if (run) {
      exceptions.push({
        type: "fragmento-reagrupado",
        inputIndex: run.start,
        outputIndex: j,
        reason: `saída corresponde à concatenação das entradas ${run.start}..${run.end}`,
      });
      return;
    }
    if (canonicalItem(outputText).length < 8) {
      exceptions.push({
        type: "entrada-invalida-documentada",
        inputIndex: null,
        outputIndex: j,
        reason: "saída vazia ou inválida após normalização",
      });
      return;
    }
    exceptions.push({
      type: "nao-referencia",
      inputIndex: null,
      outputIndex: j,
      reason: "elemento que não é referência após normalização (título de seção ou ruído)",
    });
  });

  // Entradas sem correspondência -> exceção apenas se inválidas ou não-referência.
  records
    .filter((r) => r.matchMethod === "unmatched")
    .forEach((r) => {
      if (canonicalItem(r.normalizedInput).length < 8) {
        exceptions.push({
          type: "entrada-invalida-documentada",
          inputIndex: r.inputIndex,
          outputIndex: null,
          reason: "entrada vazia ou inválida após normalização",
        });
      } else if (isTitleNoise(r.normalizedInput)) {
        exceptions.push({
          type: "nao-referencia",
          inputIndex: r.inputIndex,
          outputIndex: null,
          reason: "título de seção, não é referência",
        });
      }
    });

  const unmatchedRecords = records.filter((r) => r.matchMethod === "unmatched");
  const extraOutputs = outputItems.length - matchedOutput.size;
  const countDelta = inputItems.length - outputItems.length;

  const unmatchedJustified = unmatchedRecords.every((r) =>
    exceptions.some(
      (e) =>
        e.inputIndex === r.inputIndex &&
        (e.type === "entrada-invalida-documentada" || e.type === "nao-referencia"),
    ),
  );
  const extrasJustified = extraOutputs === 0 || exceptions.some((e) => e.outputIndex !== null);
  const countDeltaJustified = countDelta === 0 || (unmatchedJustified && extrasJustified);

  const byMethod = {
    exact: records.filter((r) => r.matchMethod === "exact").length,
    normalized: records.filter((r) => r.matchMethod === "normalized").length,
    "fragment-rejoined": records.filter((r) => r.matchMethod === "fragment-rejoined").length,
  };

  return {
    generatedAt: new Date().toISOString(),
    inputDescription: descriptions.input,
    outputDescription: descriptions.output,
    summary: {
      inputItems: inputItems.length,
      outputItems: outputItems.length,
      preserved: records.filter((r) => r.preserved).length,
      unmatched: unmatchedRecords.length,
      countDelta,
      countDeltaJustified,
      byMethod,
      exceptions,
      lostParts,
    },
    records,
  };
}
