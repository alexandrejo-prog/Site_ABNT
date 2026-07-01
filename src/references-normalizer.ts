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

function cleanReference(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function fold(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

function splitReferenceItems(value: string): string[] {
  return value
    .split(/\n+/)
    .map(cleanReference)
    .filter(Boolean);
}

function hasYear(value: string): boolean {
  return /\b(19|20)\d{2}\b/u.test(value);
}

function isLikelyLegislation(value: string): boolean {
  const text = fold(value);
  return /^(brasil|minas gerais|lavras)\./u.test(text) ||
    /\b(lei|decreto|portaria|resolucao|instrucao normativa|norma|nbr)\b/u.test(text);
}

function isLikelyAcademicWork(value: string): boolean {
  return /\b(dissertacao|tese|monografia|trabalho de conclusao de curso)\b/u.test(fold(value));
}

function isLikelyElectronic(value: string): boolean {
  return /(https?:\/\/|doi\b|disponivel em:|acesso em:)/u.test(fold(value));
}

function isLikelyInstitutionalDocument(value: string): boolean {
  const text = fold(value);
  return /^(universidade|instituto|ministerio|associacao|fundacao|conselho|ufla|abnt)\b/u.test(text);
}

function sentenceBreakIndexes(value: string): number[] {
  const indexes: number[] = [];
  const pattern = /\.\s+/gu;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(value)) !== null) {
    indexes.push(match.index);
  }
  return indexes;
}

function firstBeforeComma(value: string): string {
  return value.split(",")[0]?.trim() ?? "";
}

function looksLikeAuthorSegment(segment: string): boolean {
  const text = segment.trim();
  if (!text.includes(",")) return false;
  if (!/^\p{Lu}/u.test(text)) return false;
  const surname = firstBeforeComma(text);
  return surname.length >= 2 && /^\p{Lu}/u.test(surname);
}

function splitAuthorAndRemainder(reference: string): { author: string; remainder: string } | undefined {
  for (const index of sentenceBreakIndexes(reference)) {
    const author = reference.slice(0, index).trim();
    const remainder = cleanReference(reference.slice(index + 1));
    if (/^et\s+al\./iu.test(remainder)) continue;
    if (looksLikeAuthorSegment(author) && remainder.length > 3) {
      return { author, remainder };
    }
  }
  return undefined;
}

function looksLikeArticleTail(value: string): boolean {
  const commaIndex = value.indexOf(",");
  if (commaIndex < 0) return false;

  const periodical = value.slice(0, commaIndex).trim();
  const tail = value.slice(commaIndex);
  if (periodical.length < 4 || !/^\p{Lu}/u.test(periodical)) return false;

  return /,\s*[^,]{2,},\s*(?:v|n|p)\.\s*/iu.test(tail) ||
    /,\s*(?:v|n|p)\.\s*/iu.test(tail);
}

function detectArticleHighlight(remainder: string): string | undefined {
  for (const index of sentenceBreakIndexes(remainder)) {
    const tail = cleanReference(remainder.slice(index + 1));
    if (!looksLikeArticleTail(tail)) continue;

    const periodical = firstBeforeComma(tail);
    if (periodical.length > 3) return periodical;
  }
  return undefined;
}

function stripTrailingAcademicData(value: string): string {
  let title = value.trim();
  let previous = "";
  while (title && title !== previous) {
    previous = title;
    title = title.replace(/\.\s*\d+\s*p\.?\s*$/iu, "").trim();
    title = title.replace(/\.\s*(?:19|20)\d{2}\s*$/u, "").trim();
  }
  return title.replace(/\.$/u, "").trim();
}

function detectAcademicHighlight(remainder: string): string | undefined {
  const markerIndex = fold(remainder).search(/\b(tese|dissertacao|monografia|trabalho de conclusao de curso)\s*\(/u);
  if (markerIndex < 0) return undefined;

  const title = stripTrailingAcademicData(remainder.slice(0, markerIndex));
  return title.length > 3 ? title : undefined;
}

function looksLikePublicationInfo(value: string): boolean {
  return /^[\p{Lu}][\p{L}\s.'-]*(?:,\s*\p{Lu}{2})?\s*:\s*.+,\s*(?:19|20)\d{2}/u.test(value);
}

function detectBookHighlight(remainder: string): string | undefined {
  for (const index of sentenceBreakIndexes(remainder)) {
    const title = remainder.slice(0, index).trim();
    const publicationInfo = cleanReference(remainder.slice(index + 1));
    if (title.length > 3 && looksLikePublicationInfo(publicationInfo)) {
      return title;
    }
  }
  return undefined;
}

function detectLegislationHighlight(reference: string): string | undefined {
  const sentences = reference
    .split(/\.\s+/u)
    .map((part) => part.trim())
    .filter(Boolean);

  return sentences.find((sentence) => {
    const text = fold(sentence);
    return /^(constituicao|emenda constitucional|lei|lei complementar|decreto|decreto-lei|portaria|resolucao|instrucao normativa|instrucao normativa conjunta|norma|nbr)\b/u.test(text);
  });
}

function detectHighlight(reference: string): {
  highlight?: string;
  confidence: ReferenceConfidence;
  detectedType: NormalizedReference["detectedType"];
  warning?: string;
} {
  if (isLikelyLegislation(reference)) {
    const legislation = detectLegislationHighlight(reference);

    if (legislation) {
      return {
        highlight: legislation,
        confidence: "media",
        detectedType: "legislacao",
      };
    }

    return {
      confidence: "baixa",
      detectedType: "legislacao",
      warning: "Referência normativa preservada sem destaque automático por baixa confiança.",
    };
  }

  const parsed = splitAuthorAndRemainder(reference);
  if (!parsed) {
    return {
      confidence: "baixa",
      detectedType: "desconhecido",
      warning: "Não foi possível identificar com segurança o título da obra ou periódico para aplicar negrito.",
    };
  }

  const article = detectArticleHighlight(parsed.remainder);
  if (article) {
    return { highlight: article, confidence: "media", detectedType: "artigo" };
  }

  const academic = detectAcademicHighlight(parsed.remainder);
  if (academic || isLikelyAcademicWork(reference)) {
    return {
      highlight: academic,
      confidence: academic ? "media" : "baixa",
      detectedType: "tese-dissertacao",
      warning: academic ? undefined : "Referência acadêmica preservada sem destaque automático por baixa confiança.",
    };
  }

  if (isLikelyInstitutionalDocument(reference)) {
    const documentTitle = detectBookHighlight(parsed.remainder);
    return {
      highlight: documentTitle,
      confidence: documentTitle ? "media" : "baixa",
      detectedType: "documento-institucional",
      warning: documentTitle ? undefined : "Documento institucional preservado sem destaque automático por baixa confiança.",
    };
  }

  if (isLikelyElectronic(reference)) {
    const electronicTitle = detectBookHighlight(parsed.remainder);
    return {
      highlight: electronicTitle,
      confidence: electronicTitle ? "baixa" : "baixa",
      detectedType: "site",
    };
  }

  const book = detectBookHighlight(parsed.remainder);
  if (book) {
    return { highlight: book, confidence: "media", detectedType: "livro" };
  }

  return {
    confidence: "baixa",
    detectedType: "desconhecido",
    warning: "Não foi possível identificar com segurança o título da obra ou periódico para aplicar negrito.",
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function splitRunByEtAl(run: ReferenceRun): ReferenceRun[] {
  const parts = run.text.split(/(et\s+al\.)/giu).filter((part) => part.length > 0);
  return parts.map((part) => ({
    text: part,
    bold: run.bold,
    italics: /et\s+al\./iu.test(part) ? true : run.italics,
  }));
}

function mergeRuns(runs: ReferenceRun[]): ReferenceRun[] {
  const merged: ReferenceRun[] = [];
  for (const run of runs.filter((item) => item.text.length > 0)) {
    const previous = merged[merged.length - 1];
    if (previous && previous.bold === run.bold && previous.italics === run.italics) {
      previous.text += run.text;
    } else {
      merged.push({ ...run });
    }
  }
  return merged;
}

function parseManualMarkup(text: string): { runs: ReferenceRun[]; highlighted?: string; hasManual: boolean } {
  const runs: ReferenceRun[] = [];
  const tokenPattern = /(\*\*[^*]+\*\*|\*[^*]+\*)/gu;
  let cursor = 0;
  let highlighted: string | undefined;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(text)) !== null) {
    if (match.index > cursor) runs.push({ text: text.slice(cursor, match.index) });

    const token = match[0];
    const bold = token.startsWith("**");
    const content = bold ? token.slice(2, -2) : token.slice(1, -1);
    if (!highlighted && content.trim()) highlighted = content.trim();
    runs.push({ text: content, bold, italics: !bold });
    cursor = match.index + token.length;
  }

  if (cursor < text.length) runs.push({ text: text.slice(cursor) });

  return {
    runs: mergeRuns(runs.flatMap(splitRunByEtAl)),
    highlighted,
    hasManual: Boolean(highlighted),
  };
}

function plainTextFromRuns(runs: ReferenceRun[]): string {
  return runs.map((run) => run.text).join("");
}

function applyHighlightAndEtAl(text: string, highlight?: string): ReferenceRun[] {
  if (!highlight) return mergeRuns(splitRunByEtAl({ text }));

  const match = text.match(new RegExp(escapeRegExp(highlight), "iu"));
  if (!match || match.index === undefined) return mergeRuns(splitRunByEtAl({ text }));

  const start = match.index;
  const end = start + match[0].length;
  const runs: ReferenceRun[] = [];

  if (start > 0) runs.push({ text: text.slice(0, start) });
  runs.push({ text: text.slice(start, end), bold: true });
  if (end < text.length) runs.push({ text: text.slice(end) });

  return mergeRuns(runs.flatMap(splitRunByEtAl));
}

export function normalizeReference(reference: string): NormalizedReference {
  const originalText = cleanReference(reference);
  const manual = parseManualMarkup(originalText);
  const text = cleanReference(plainTextFromRuns(manual.runs));
  const warnings: string[] = [];

  if (!text) {
    return {
      original: reference,
      text,
      runs: [],
      confidence: "baixa",
      warnings: ["Referência vazia."],
      detectedType: "desconhecido",
    };
  }

  if (text.length < 25) warnings.push("Referência muito curta para validação segura.");
  if (!hasYear(text)) warnings.push("Referência sem ano detectável.");
  if (/(https?:\/\/|disponivel em:)/u.test(fold(text)) && !/acesso em:/u.test(fold(text))) {
    warnings.push("Referência online sem 'Acesso em:' detectado.");
  }

  const detection = detectHighlight(text);
  if (detection.warning) warnings.push(detection.warning);
  if (!detection.highlight && !manual.hasManual) {
    warnings.push("Referência preservada sem negrito automático por baixa confiança.");
  }

  const detectedHighlight = manual.highlighted ?? detection.highlight;
  const runs = manual.hasManual ? manual.runs : applyHighlightAndEtAl(text, detection.highlight);

  return {
    original: reference,
    text,
    runs,
    confidence: manual.hasManual ? "alta" : detection.confidence,
    warnings,
    detectedHighlight,
    detectedType: detection.detectedType,
  };
}

export function normalizeReferences(references: string[]): NormalizedReference[] {
  return references.map(normalizeReference);
}

export function normalizeReferencesText(referencesText: string): NormalizedReference[] {
  return splitReferenceItems(referencesText).map(normalizeReference);
}

export function hasDetectedHighlight(reference: string): boolean {
  return Boolean(normalizeReference(reference).detectedHighlight);
}
