import { normalizeReferencesText } from "./references-normalizer";

export interface ReferenceValidationIssue {
  code: string;
  message: string;
  reference?: string;
}

function hasAcademicPageCount(value: string): boolean {
  return /\b\d+\s*p\.?\b/iu.test(value) || /\[[sn]\.?\s*p\.?\]/iu.test(value);
}

function hasPublisherAfterLocation(value: string): boolean {
  return /\b[A-ZÁÉÍÓÚÂÊÔÃÕÇ][\p{L}\s.'-]*(?:,\s*[A-Z]{2})?\s*:\s*[^.]+,\s*(?:19|20)\d{2}\b/u.test(value);
}

function hasPublisherBeforeYear(value: string): boolean {
  return /:\s*[^.]+,\s*(?:19|20)\d{2}\b/u.test(value);
}

function hasLikelyRawDoiUrl(value: string): boolean {
  return /\bDOI\s*:\s*https?:\/\/(?:dx\.)?doi\.org\//iu.test(value);
}

function hasMarkdownOrAngleUrl(value: string): boolean {
  return /\[[^\]]*https?:\/\/[^\]]+\]\(https?:\/\/[^)]+\)/iu.test(value) || /<\s*https?:\/\/[^>]+\s*>/iu.test(value);
}

function hasKnownAuthorSpellingRisk(value: string): boolean {
  return /\bDEJOURS,\s*Christophe\b/iu.test(value) || /\bGUBA,\s*Egon\s+G\.\b/iu.test(value);
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
    academicPagesMissing: 0,
    legalPublisherMissing: 0,
    institutionalPublisherMissing: 0,
    rawDoiUrl: 0,
    markdownOrAngleUrl: 0,
    authorSpellingRisk: 0,
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
    } else if (
      !reference.detectedHighlight &&
      (reference.detectedType === "artigo" || reference.detectedType === "livro" || reference.detectedType === "capitulo" || reference.detectedType === "tese-dissertacao")
    ) {
      counts.highlightMissing += 1;
    }

    if (reference.detectedType === "tese-dissertacao" && !hasAcademicPageCount(reference.text)) {
      counts.academicPagesMissing += 1;
    }

    if (reference.detectedType === "legislacao" && !hasPublisherAfterLocation(reference.text)) {
      counts.legalPublisherMissing += 1;
    }

    if (reference.detectedType === "documento-institucional" && !hasPublisherBeforeYear(reference.text)) {
      counts.institutionalPublisherMissing += 1;
    }

    if (hasLikelyRawDoiUrl(reference.original)) {
      counts.rawDoiUrl += 1;
    }

    if (hasMarkdownOrAngleUrl(reference.original)) {
      counts.markdownOrAngleUrl += 1;
    }

    if (hasKnownAuthorSpellingRisk(reference.original)) {
      counts.authorSpellingRisk += 1;
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

  if (counts.academicPagesMissing) {
    issues.push({
      code: "reference-academic-pages-missing",
      message: `Há ${counts.academicPagesMissing} tese(s), dissertação(ões) ou monografia(s) sem número de páginas detectável.`,
    });
  }

  if (counts.legalPublisherMissing) {
    issues.push({
      code: "reference-legal-publisher-missing",
      message: `Há ${counts.legalPublisherMissing} documento(s) jurídico(s) sem órgão/editora após o local de publicação.`,
    });
  }

  if (counts.institutionalPublisherMissing) {
    issues.push({
      code: "reference-institutional-publisher-missing",
      message: `Há ${counts.institutionalPublisherMissing} documento(s) institucional(is) sem editora/órgão responsável após o local.`,
    });
  }

  if (counts.rawDoiUrl) {
    issues.push({
      code: "reference-doi-url-normalized",
      message: `Há ${counts.rawDoiUrl} DOI(s) informado(s) como URL; o DOCX tentará normalizar para 'DOI: 10...'.`,
    });
  }

  if (counts.markdownOrAngleUrl) {
    issues.push({
      code: "reference-url-markup-normalized",
      message: `Há ${counts.markdownOrAngleUrl} URL(s) em markdown ou entre sinais < >; o DOCX tentará normalizar para 'Disponível em: ...'.`,
    });
  }

  if (counts.authorSpellingRisk) {
    issues.push({
      code: "reference-author-spelling-review",
      message: `Há ${counts.authorSpellingRisk} referência(s) com grafia de autor que merece conferência bibliográfica.`,
    });
  }

  return issues;
}
