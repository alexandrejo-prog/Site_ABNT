export type ReferenceConfidence = "alta" | "media" | "baixa";

export interface ReferenceRun {
  text: string;
  bold?: boolean;
  italics?: boolean;
}

export interface NormalizedReference {
  original: string;
  text: string;
  runs: ReferenceRun[];
  confidence: ReferenceConfidence;
  warnings: string[];
  detectedHighlight?: string;
  detectedType:
    | "artigo"
    | "livro"
    | "tese-dissertacao"
    | "documento-institucional"
    | "legislacao"
    | "site"
    | "desconhecido";
}

function clean(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function fold(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

function splitItems(value: string): string[] {
  return value.split(/\n+/).map(clean).filter(Boolean);
}

function hasYear(value: string): boolean {
  return /\b(19|20)\d{2}\b/u.test(value);
}

function isInstitutional(value: string): boolean {
  return /^(universidade|instituto|ministerio|associacao|fundacao|conselho|ufla|abnt)\b/u.test(fold(value));
}

function isLegislation(value: string): boolean {
  const text = fold(value);
  return /^(brasil|minas gerais|lavras)\./u.test(text) || /\b(lei|decreto|portaria|resolucao|instrucao normativa|norma|nbr)\b/u.test(text);
}

function sentenceIndexes(value: string): number[] {
  const indexes: number[] = [];
  const pattern = /\.\s+/gu;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(value)) !== null) indexes.push(match.index);
  return indexes;
}

function splitAuthor(value: string): { author: string; remainder: string } | undefined {
  for (const index of sentenceIndexes(value)) {
    const author = value.slice(0, index).trim();
    let remainder = clean(value.slice(index + 1));
    if (!author.includes(",")) continue;
    if (/^et\s+al\./iu.test(remainder)) remainder = clean(remainder.replace(/^et\s+al\.\s*/iu, ""));
    if (remainder.length > 3) return { author, remainder };
  }
  return undefined;
}

function pubInfo(value: string): boolean {
  return /^[\p{Lu}][\p{L}\s.'-]*(?:,\s*\p{Lu}{2})?\s*:\s*.+,\s*(?:19|20)\d{2}/u.test(value);
}

function bookTitle(remainder: string): string | undefined {
  for (const index of sentenceIndexes(remainder)) {
    const title = remainder.slice(0, index).trim();
    const tail = clean(remainder.slice(index + 1));
    if (title.length > 3 && pubInfo(tail)) return title.replace(/\.$/u, "").trim();
  }
  return undefined;
}

function articleJournal(remainder: string): string | undefined {
  for (const index of sentenceIndexes(remainder)) {
    const tail = clean(remainder.slice(index + 1));
    const comma = tail.indexOf(",");
    if (comma < 0) continue;
    const journal = tail.slice(0, comma).trim();
    if (journal.length > 3 && /,\s*(?:[^,]{2,},\s*)?(?:v|n|p)\.\s*/iu.test(tail)) return journal;
  }
  return undefined;
}

function academicTitle(remainder: string): string | undefined {
  const marker = fold(remainder).search(/\b(tese|dissertacao|monografia|trabalho de conclusao de curso)\s*\(/u);
  if (marker < 0) return undefined;
  return remainder.slice(0, marker).replace(/\.\s*\d+\s*p\.?\s*$/iu, "").replace(/\.\s*(?:19|20)\d{2}\s*$/u, "").replace(/\.$/u, "").trim();
}

function legislationTitle(value: string): string | undefined {
  return value.split(/\.\s+/u).map((part) => part.trim()).find((part) => /^(Lei|Decreto|Portaria|Resolu|Instru|Norma|NBR)/iu.test(part));
}

function parseManual(text: string): { runs: ReferenceRun[]; highlighted?: string; hasManual: boolean } {
  const runs: ReferenceRun[] = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*)/gu;
  let cursor = 0;
  let highlighted: string | undefined;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) runs.push({ text: text.slice(cursor, match.index) });
    const token = match[0];
    const bold = token.startsWith("**");
    const content = bold ? token.slice(2, -2) : token.slice(1, -1);
    if (!highlighted && content.trim()) highlighted = content.trim();
    runs.push({ text: content, bold, italics: !bold });
    cursor = match.index + token.length;
  }
  if (cursor < text.length) runs.push({ text: text.slice(cursor) });
  return { runs: mergeRuns(runs.flatMap(splitEtAl)), highlighted, hasManual: Boolean(highlighted) };
}

function splitEtAl(run: ReferenceRun): ReferenceRun[] {
  return run.text.split(/(et\s+al\.)/giu).filter(Boolean).map((part) => ({ text: part, bold: run.bold, italics: /et\s+al\./iu.test(part) ? true : run.italics }));
}

function mergeRuns(runs: ReferenceRun[]): ReferenceRun[] {
  const merged: ReferenceRun[] = [];
  for (const run of runs.filter((item) => item.text.length > 0)) {
    const last = merged[merged.length - 1];
    if (last && last.bold === run.bold && last.italics === run.italics) last.text += run.text;
    else merged.push({ ...run });
  }
  return merged;
}

function detect(value: string): { highlight?: string; confidence: ReferenceConfidence; detectedType: NormalizedReference["detectedType"] } {
  if (isLegislation(value)) return { highlight: legislationTitle(value), confidence: "media", detectedType: "legislacao" };
  const parsed = splitAuthor(value);
  if (!parsed) {
    if (isInstitutional(value)) return { confidence: "baixa", detectedType: "documento-institucional" };
    return { confidence: "baixa", detectedType: "livro" };
  }
  const article = articleJournal(parsed.remainder);
  if (article) return { highlight: article, confidence: "media", detectedType: "artigo" };
  const academic = academicTitle(parsed.remainder);
  if (academic || /\b(dissertacao|tese|monografia)\b/u.test(fold(value))) return { highlight: academic, confidence: academic ? "media" : "baixa", detectedType: "tese-dissertacao" };
  if (isInstitutional(value)) return { highlight: bookTitle(parsed.remainder), confidence: "baixa", detectedType: "documento-institucional" };
  const book = bookTitle(parsed.remainder);
  if (book) return { highlight: book, confidence: "media", detectedType: "livro" };
  return { confidence: "baixa", detectedType: "desconhecido" };
}

function applyHighlight(text: string, highlight?: string): ReferenceRun[] {
  if (!highlight) return mergeRuns(splitEtAl({ text }));
  const start = fold(text).indexOf(fold(highlight));
  if (start < 0) return mergeRuns(splitEtAl({ text }));
  const end = start + highlight.length;
  return mergeRuns([{ text: text.slice(0, start) }, { text: text.slice(start, end), bold: true }, { text: text.slice(end) }].flatMap(splitEtAl));
}

export function normalizeReference(reference: string): NormalizedReference {
  const original = clean(reference);
  const manual = parseManual(original);
  const text = clean(manual.runs.map((run) => run.text).join(""));
  const warnings: string[] = [];
  if (!text) return { original: reference, text, runs: [], confidence: "baixa", warnings: ["empty"], detectedType: "desconhecido" };
  if (!hasYear(text)) warnings.push("missing year");
  const detected = detect(text);
  if (!detected.highlight && !manual.hasManual) warnings.push("review title");
  const detectedHighlight = manual.highlighted ?? detected.highlight;
  return { original: reference, text, runs: manual.hasManual ? manual.runs : applyHighlight(text, detected.highlight), confidence: manual.hasManual ? "alta" : detected.confidence, warnings, detectedHighlight, detectedType: detected.detectedType };
}

export function normalizeReferencesText(value: string): NormalizedReference[] {
  return splitItems(value).map(normalizeReference);
}
