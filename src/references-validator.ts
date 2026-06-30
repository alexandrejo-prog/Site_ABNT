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

  for (const reference of references) {
    if (reference.text.length < 25) {
      issues.push({
        code: "reference-too-short",
        message: "Há item de referência muito curto para validação ABNT/UFLA segura.",
        reference: reference.text,
      });
    }

    if (!/\b(19|20)\d{2}\b/.test(reference.text)) {
      issues.push({
        code: "reference-year-missing",
        message: "Há referência sem ano detectável.",
        reference: reference.text,
      });
    }

    if (/(https?:\/\/|dispon[ií]vel em:)/i.test(reference.text) && !/acesso em:/i.test(reference.text)) {
      issues.push({
        code: "reference-access-missing",
        message: "Há referência online sem 'Acesso em:' detectado.",
        reference: reference.text,
      });
    }

    if (!reference.detectedHighlight) {
      issues.push({
        code: "reference-highlight-missing",
        message:
          "Há referência em que o sistema não conseguiu identificar com segurança o título da obra ou periódico para aplicar negrito.",
        reference: reference.text,
      });
    }

    for (const warning of reference.warnings) {
      if (/baixa confiança|sem negrito|normativa preservada/i.test(warning)) {
        issues.push({
          code: "reference-preserved-low-confidence",
          message: warning,
          reference: reference.text,
        });
      }
    }
  }

  return issues;
}
