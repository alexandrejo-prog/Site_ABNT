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
    | "trabalho-academico"
    | "documento-eletronico"
    | "legislacao"
    | "indefinido";
}

function cleanReference(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function splitReferenceItems(value: string): string[] {
  return value
    .split(/\n+/)
    .map(cleanReference)
    .filter(Boolean);
}

function hasYear(value: string): boolean {
  return /\b(19|20)\d{2}\b/.test(value);
}

function isLikelyLegislation(value: string): boolean {
  return /^(BRASIL|MINAS GERAIS|LAVRAS|UNIVERSIDADE FEDERAL DE LAVRAS)\./i.test(value) ||
    /\b(lei|decreto|portaria|resolu[cç][aã]o|instru[cç][aã]o normativa)\b/i.test(value);
}

function isLikelyAcademicWork(value: string): boolean {
  return /\b(disserta[cç][aã]o|tese|monografia|trabalho de conclus[aã]o de curso)\b/i.test(value);
}

function isLikelyElectronic(value: string): boolean {
  return /(https?:\/\/|doi\b|dispon[ií]vel em:|acesso em:)/i.test(value);
}

function splitSentences(value: string): string[] {
  return value
    .split(/\.\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part, index, parts) => (index < parts.length - 1 ? part : part.replace(/\.$/, "")));
}

function firstBeforeComma(value: string): string {
  return value.split(",")[0]?.trim() ?? "";
}

function looksLikeAuthorSegment(segment: string): boolean {
  return /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ\s.;,'-]+$/.test(segment.trim());
}

function looksLikeArticle(reference: string, sentences: string[]): boolean {
  if (sentences.length < 3) return false;
  const third = sentences[2] ?? "";
  return /,/.test(third) && !/^Dispon[ií]vel em:/i.test(third) && !isLikelyLegislation(reference);
}

function detectHighlight(reference: string): {
  highlight?: string;
  confidence: ReferenceConfidence;
  detectedType: NormalizedReference["detectedType"];
  warning?: string;
} {
  const sentences = splitSentences(reference);

  if (isLikelyLegislation(reference)) {
    return {
      confidence: "baixa",
      detectedType: "legislacao",
      warning: "Referência normativa preservada sem destaque automático por baixa confiança.",
    };
  }

  if (looksLikeArticle(reference, sentences)) {
    const periodical = firstBeforeComma(sentences[2]);
    if (periodical.length > 3) {
      return { highlight: periodical, confidence: "media", detectedType: "artigo" };
    }
  }

  if (isLikelyAcademicWork(reference) && sentences[1]) {
    return {
      highlight: sentences[1],
      confidence: "media",
      detectedType: "trabalho-academico",
    };
  }

  if (isLikelyElectronic(reference) && sentences[1]) {
    return {
      highlight: sentences[1],
      confidence: "baixa",
      detectedType: "documento-eletronico",
    };
  }

  if (sentences.length >= 2 && looksLikeAuthorSegment(sentences[0]) && sentences[1].length > 3) {
    return {
      highlight: sentences[1],
      confidence: "media",
      detectedType: "livro",
    };
  }

  return {
    confidence: "baixa",
    detectedType: "indefinido",
    warning: "Não foi possível identificar com segurança o título da obra ou periódico para aplicar negrito.",
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function splitRunByEtAl(run: ReferenceRun): ReferenceRun[] {
  const parts = run.text.split(/(et\s+al\.)/gi).filter((part) => part.length > 0);
  return parts.map((part) => ({
    text: part,
    bold: run.bold,
    italics: /et\s+al\./i.test(part) ? true : run.italics,
  }));
}

function applyHighlightAndEtAl(text: string, highlight?: string): ReferenceRun[] {
  if (!highlight) return splitRunByEtAl({ text });

  const match = text.match(new RegExp(escapeRegExp(highlight), "i"));
  if (!match || match.index === undefined) return splitRunByEtAl({ text });

  const start = match.index;
  const end = start + match[0].length;
  const runs: ReferenceRun[] = [];

  if (start > 0) runs.push({ text: text.slice(0, start) });
  runs.push({ text: text.slice(start, end), bold: true });
  if (end < text.length) runs.push({ text: text.slice(end) });

  return runs.flatMap(splitRunByEtAl).filter((run) => run.text.length > 0);
}

export function normalizeReference(reference: string): NormalizedReference {
  const text = cleanReference(reference);
  const warnings: string[] = [];

  if (!text) {
    return {
      original: reference,
      text,
      runs: [],
      confidence: "baixa",
      warnings: ["Referência vazia."],
      detectedType: "indefinido",
    };
  }

  if (text.length < 25) warnings.push("Referência muito curta para validação segura.");
  if (!hasYear(text)) warnings.push("Referência sem ano detectável.");
  if (/(https?:\/\/|dispon[ií]vel em:)/i.test(text) && !/acesso em:/i.test(text)) {
    warnings.push("Referência online sem 'Acesso em:' detectado.");
  }

  const detection = detectHighlight(text);
  if (detection.warning) warnings.push(detection.warning);
  if (!detection.highlight) {
    warnings.push("Referência preservada sem negrito automático por baixa confiança.");
  }

  return {
    original: reference,
    text,
    runs: applyHighlightAndEtAl(text, detection.highlight),
    confidence: detection.confidence,
    warnings,
    detectedHighlight: detection.highlight,
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
