import { normalizeReferencesText } from "./references-normalizer";

export interface ReferenceValidationIssue {
  code: string;
  message: string;
  reference?: string;
}

export function validateReferencesText(referencesText: string): ReferenceValidationIssue[] {
  const references = normalizeReferencesText(referencesText);
  const issues: ReferenceValidationIssue[] = [];

  if (!references.length) return issues;

  const counts = {
    tooShort: 0,
    yearMissing: 0,
    accessMissing: 0,
    highlightMissing: 0,
    normativePreserved: 0,
  };

  for (const reference of references) {
    if (reference.text.length < 25) {
      counts.tooShort += 1;
    }

    if (!/\b(19|20)\d{2}\b/.test(reference.text)) {
      counts.yearMissing += 1;
    }

    if (/(https?:\/\/|dispon[ií]vel em:)/i.test(reference.text) && !/acesso em:/i.test(reference.text)) {
      counts.accessMissing += 1;
    }

    if (!reference.detectedHighlight && reference.detectedType === "legislacao") {
      counts.normativePreserved += 1;
    } else if (!reference.detectedHighlight) {
      counts.highlightMissing += 1;
    }
  }

  if (counts.tooShort) {
    issues.push({
      code: "reference-too-short",
      message: `Há ${counts.tooShort} item(ns) de referência muito curto(s) para validação ABNT/UFLA segura.`,
    });
  }

  if (counts.yearMissing) {
    issues.push({
      code: "reference-year-missing",
      message: `Há ${counts.yearMissing} referência(s) sem ano detectável.`,
    });
  }

  if (counts.accessMissing) {
    issues.push({
      code: "reference-access-missing",
      message: `Há ${counts.accessMissing} referência(s) online sem 'Acesso em:' detectado.`,
    });
  }

  if (counts.highlightMissing) {
    issues.push({
      code: "reference-highlight-missing",
      message: `Há ${counts.highlightMissing} referência(s) que precisam de revisão manual de negrito/título.`,
    });
  }

  if (counts.normativePreserved) {
    issues.push({
      code: "reference-normative-preserved",
      message: `Há ${counts.normativePreserved} referência(s) normativas preservadas sem destaque automático.`,
    });
  }

  return issues;
}
