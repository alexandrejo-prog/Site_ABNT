import {
  AcademicFields,
  WorkTypeValue,
  isAdvisorRequired,
} from "./ufla-rules";
import { validateReferencesText } from "./references-validator";

export type ValidationSeverity = "error" | "warning";

export interface ValidationIssue {
  severity: ValidationSeverity;
  code: string;
  message: string;
}

function hasValue(value: string | WorkTypeValue): boolean {
  return value.trim().length > 0;
}

function normalizeForValidation(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function looksInstitutionalAuthor(value: string): boolean {
  const normalized = normalizeForValidation(value);
  return /\b(UNIVERSIDADE|UFLA|INSTITUTO|PROGRAMA|POS-GRADUACAO|PÓS-GRADUAÇÃO|CURSO|DEPARTAMENTO|FACULDADE|ESCOLA|LAVRAS|MINAS GERAIS|\bMG\b)\b/.test(
    normalized,
  );
}

function hasLikelyImageWithoutCaption(text: string): boolean {
  const hasImageMarker = /!\[[^\]]*\]\(|<img\b|\bimagem\b|\[Imagem detectada:/i.test(text);
  const hasCaption = /\b(figura|imagem)\s+\d+|\blegenda\b/i.test(text);
  return hasImageMarker && !hasCaption;
}

function hasLikelyUnmarkedLongQuote(text: string): boolean {
  return text
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .some((paragraph) => {
      const looksLong = paragraph.length > 450;
      const alreadyMarked = paragraph.startsWith(">");
      const hasCitationClue = /\([A-ZÁÉÍÓÚÂÊÔÃÕÇ][^)]*,\s*(19|20)\d{2}/.test(
        paragraph,
      );
      return looksLong && hasCitationClue && !alreadyMarked;
    });
}

export function validateWork(
  fields: AcademicFields,
  editorText = "",
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!hasValue(fields.workType)) {
    issues.push({
      severity: "error",
      code: "work-type-required",
      message: "Selecione o tipo de trabalho.",
    });
  }

  if (!hasValue(fields.title)) {
    issues.push({
      severity: "error",
      code: "title-required",
      message: "Informe o título do trabalho.",
    });
  }

  if (!hasValue(fields.author)) {
    issues.push({
      severity: "error",
      code: "author-required",
      message: "Informe o autor do trabalho.",
    });
  } else if (looksInstitutionalAuthor(fields.author)) {
    issues.push({
      severity: "error",
      code: "author-institutional",
      message:
        "O campo autor parece conter uma instituição, programa, unidade ou localidade, não um nome de pessoa. Revise a identificação automática.",
    });
  }

  if (isAdvisorRequired(fields.workType) && !hasValue(fields.advisor)) {
    issues.push({
      severity: "warning",
      code: "advisor-required",
      message: "Informe o orientador para monografia, dissertação ou tese.",
    });
  }

  if (!hasValue(fields.resumo)) {
    issues.push({
      severity: "warning",
      code: "resumo-required",
      message: "Inclua o resumo antes da versão final.",
    });
  }

  if (!hasValue(fields.referencias)) {
    issues.push({
      severity: "warning",
      code: "references-required",
      message: "Inclua as referências do trabalho.",
    });
  } else {
    for (const referenceIssue of validateReferencesText(fields.referencias)) {
      issues.push({
        severity: "warning",
        code: referenceIssue.code,
        message: `${referenceIssue.message} Documento ainda não está plenamente conforme o Manual UFLA enquanto houver alertas normativos fortes.`,
      });
    }
  }

  if (!hasValue(fields.introducao)) {
    issues.push({
      severity: "warning",
      code: "intro-required",
      message: "A introdução não foi detectada ou está vazia.",
    });
  }

  if (!hasValue(fields.abstractText)) {
    issues.push({
      severity: "warning",
      code: "abstract-recommended",
      message: "Inclua o abstract quando exigido pelo trabalho.",
    });
  }

  if (hasLikelyImageWithoutCaption(editorText)) {
    issues.push({
      severity: "warning",
      code: "image-caption-warning",
      message: "Há possível imagem sem legenda.",
    });
  }

  if (hasLikelyUnmarkedLongQuote(editorText)) {
    issues.push({
      severity: "warning",
      code: "long-quote-warning",
      message: "Há possível citação longa não marcada como citação longa.",
    });
  }

  if (hasValue(fields.imageWarnings)) {
    issues.push({
      severity: "warning",
      code: "imported-image-warning",
      message: fields.imageWarnings,
    });
  }

  if (hasValue(fields.anexos) && /\[Imagem detectada:/i.test(fields.anexos)) {
    issues.push({
      severity: "warning",
      code: "annex-image-partial",
      message: "Há imagem detectada em anexos; confira o arquivo gerado.",
    });
  }

  if (hasValue(fields.apendices) && /\[Imagem detectada:/i.test(fields.apendices)) {
    issues.push({
      severity: "warning",
      code: "appendix-image-partial",
      message: "Há imagem detectada em apêndices; confira o arquivo gerado.",
    });
  }

  return issues;
}

export function hasBlockingErrors(issues: ValidationIssue[]): boolean {
  return issues.some((issue) => issue.severity === "error");
}
