import { normalizeReferencesText } from "../../src/references-normalizer";
import { validateReferencesText } from "../../src/references-validator";
import { hasBlockingErrors, validateWork, type ValidationIssue } from "../../src/validators";
import type { AcademicFields } from "../../src/ufla-rules";
import type { ReferenceRuleIssue } from "./types";

const essential = (code: string, message: string, item?: string, position?: number, rule = "NBR 6023/UFLA", action?: string): ReferenceRuleIssue => ({
  code,
  message,
  severity: "error",
  rule,
  item,
  position,
  action: action ?? "Complete o dado essencial da referência conforme a fonte bibliográfica original.",
});

const nonBlocking = (code: string, message: string, item?: string, position?: number, rule = "NBR 6023/UFLA", action?: string): ReferenceRuleIssue => ({
  code,
  message,
  severity: "warning",
  rule,
  item,
  position,
  action: action ?? "Revise manualmente antes da versão final.",
});

const AUTHOR_HEAD_RE = /^[\p{L}\p{M}'’.\-]+\s*,\s*/u;
const ENTITY_HEAD_RE = /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9\s'.-]+\./u;
const YEAR_RE = /\b(?:19|20)\d{2}\b/u;
const COLON_RE = /:\s*[^.]+,\s*(?:19|20)\d{2}/u;
const ONLINE_RE = /(?:https?:\/\/|dispon[ií]vel\s+em:)/iu;
const ACCESS_RE = /acesso\s+em:/iu;

function hasAuthorHead(text: string): boolean {
  return AUTHOR_HEAD_RE.test(text.trim()) || ENTITY_HEAD_RE.test(text.trim());
}

function severityOf(code: string): "error" | "warning" {
  const blockers = new Set([
    "reference-author-missing",
    "reference-year-missing",
    "reference-publisher-missing",
    "reference-location-missing",
    "reference-incomplete",
    "citation-year-missing",
    "citation-page-missing",
  ]);
  return blockers.has(code) ? "error" : "warning";
}

// ---------------------------------------------------------------------------
// Validação de referências por item (cada item reporta código, mensagem,
// referência afetada, posição, regra, severidade e ação recomendada).
// ---------------------------------------------------------------------------
export function runReferenceRules(fields: AcademicFields, editorText: string): ReferenceRuleIssue[] {
  const issues: ReferenceRuleIssue[] = [];

  const entries = fields.referencias
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (entries.length === 0) {
    issues.push(essential("references-empty", "O bloco de referências está vazio; a seção pós-textual exige referências.", "referências", 1, "Manual UFLA 9.1"));
    return issues;
  }

  const normalizedEntries = normalizeReferencesText(fields.referencias);

  entries.forEach((entry, index) => {
    const position = index + 1;
    const matches = normalizedEntries.filter((n) => n.text === entry || n.original === entry);
    const detectedType = matches[0]?.detectedType ?? findTypeLike(entry);

    if (entry.length < 25) {
      issues.push(
        essential("reference-incomplete", "Referência curta demais — provavelmente incompleta.", entry, position, "NBR 6023", "Informe autor, título, local, editora e ano completos."),
      );
    }

    if (!hasAuthorHead(entry)) {
      issues.push(
        essential("reference-author-missing", "Não foi possível identificar o autor (sobrenome seguido de vírgula ou entidade responsável).", entry, position, "NBR 6023: autor primeira palavra", "Inicie a referência pelo sobrenome do autor em maiúsculas ou pela entidade responsável."),
      );
    }

    if (!YEAR_RE.test(entry)) {
      issues.push(
        essential("reference-year-missing", "Ano de publicação não detectado.", entry, position, "NBR 6023: ano", "Informe o ano de publicação."),
      );
    }

    const needsPublisher = detectedType === "livro" || detectedType === "legislacao" || detectedType === "documento-institucional" || detectedType === "desconhecido";
    if (needsPublisher) {
      if (!COLON_RE.test(entry)) {
        issues.push(
          essential("reference-location-missing", "Local de publicação não detectado no formato 'Local: Editora, ano'.", entry, position, "NBR 6023: local", "Informe a cidade de publicação antes da editora."),
        );
        issues.push(
          essential("reference-publisher-missing", "Editora/órgão responsável não detectado no formato 'Local: Editora, ano'.", entry, position, "NBR 6023: editora", "Informe a editora ou o órgão responsável após o local."),
        );
      } else {
        const afterColon = entry.split(/:\s*/, 2)[1] ?? "";
        if (!afterColon || afterColon.trim().length < 2 || /^[,.\s]*(?:19|20)\d{2}/u.test(afterColon)) {
          issues.push(
            essential("reference-publisher-missing", "Após o local há marcador de dois-pontos, mas nenhuma editora/órgão antes do ano.", entry, position, "NBR 6023: editora", "Preencha a editora ou o órgão responsável após o local."),
          );
        }
      }
    } else if (detectedType === "evento") {
      if (!COLON_RE.test(entry)) {
        issues.push(nonBlocking("reference-location-missing", "Evento sem local/editora no formato 'Local: Editora, ano'.", entry, position, "NBR 6023 (evento)"));
      }
    }

    if (ONLINE_RE.test(entry) && !ACCESS_RE.test(entry)) {
      issues.push(
        nonBlocking("reference-access-missing", "Referência online sem 'Acesso em: <data>' detectada.", entry, position, "NBR 6023: acesso", "Adicione 'Disponível em: <url>. Acesso em: <dia> <mês>. <ano>'."),
      );
    }
  });

  // -------------------------------------------------------------------------
  // Citações: ano e página (NBR 10520:2023)
  // -------------------------------------------------------------------------
  const citationIssues = collectCitationIssues(editorText);
  for (const cit of citationIssues) {
    issues.push({
      code: cit.code,
      message: cit.message,
      severity: severityOf(cit.code),
      rule: cit.rule,
      item: cit.what,
      action: cit.action,
    });
  }

  return issues;
}

interface CitationHit {
  code: string;
  message: string;
  rule: string;
  what: string;
  action: string;
}

function collectCitationIssues(editorText: string): CitationHit[] {
  const hits: CitationHit[] = [];
  const paragraphs = editorText.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  for (const paragraph of paragraphs) {
    const citeRe = /\(([^()]*?(?:\b(?:19|20)\d{2}\b)?[^()]*?)\)/g;
    let m: RegExpExecArray | null;
    while ((m = citeRe.exec(paragraph)) !== null) {
      const inner = m[1].trim();
      if (inner.length > 60) continue;
      const yearMatch = inner.match(/\b(19|20)\d{2}\b/);
      const authorPart = yearMatch ? inner.slice(0, inner.indexOf(yearMatch[0])).trim() : "";
      const hasAuthor = /[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/i.test(authorPart.replace(/[,;]\s*$/, ""));

      if (/,\s*p\.?\s*\)?$/i.test(inner) || /p\.\s*$/.test(inner)) {
        hits.push({
          code: "citation-page-missing",
          message: "Citação indica página, mas não informa o número.",
          rule: "NBR 10520:2023 (página obrigatória)",
          what: `Citação "(${inner})"`,
          action: "Informe o número da página após 'p.'.",
        });
        continue;
      }
      if (!yearMatch) {
        hits.push({
          code: "citation-year-missing",
          message: "Citação sem ano — toda citação deve indicar o ano da fonte.",
          rule: "NBR 6023/UFLA 8.8 (ano obrigatório)",
          what: `Citação "(${inner})"`,
          action: "Informe o ano da publicação na citação.",
        });
        continue;
      }
      if (!hasAuthor) {
        hits.push({
          code: "citation-author-missing",
          message: "Citação sem autor identificável antes do ano.",
          rule: "NBR 10520:2023",
          what: `Citação "(${inner})"`,
          action: "Informe o autor da fonte na citação.",
        });
        continue;
      }
      const hasPage = /\b(p\.?|pag\.?|f\.?|página[s]?)\s*[.:]?\s*\d+/i.test(inner);
      if (/["'\u201c\u201d\u00ab\u00bb]/.test(paragraph) && !hasPage) {
        hits.push({
          code: "citation-direct-locator",
          message: "Citação direta (parágrafo com aspas) sem indicação de página — exigido pela NBR 10520:2023.",
          rule: "NBR 10520:2023 (citação direta: página obrigatória)",
          what: `Citação "(${inner})"`,
          action: "Adicione a página após o ano na citação direta.",
        });
      }
    }
  }
  return hits;
}

function findTypeLike(entry: string): string {
  const t = entry.toLowerCase();
  if (/\bin:\s+\w+.*(?:congresso|simposio|seminario|encontro|conferencia|anais|workshop|reuniao)/.test(t)) return "evento";
  if (/^lei|^decreto|^instrucao|constituicao|ministerio|portaria|resolucao/i.test(t)) return "legislacao";
  if (/universidade|instituto|ibict|oecd|unesco|fao/.test(t)) return "documento-institucional";
  if (/(tese|dissertacao|monografia)/i.test(t)) return "tese-dissertacao";
  if (/^[a-z\u00e0-\u00ffÀ-ÿ]+,\s+/i.test(entry)) return "livro";
  return "desconhecido";
}

// ---------------------------------------------------------------------------
// Pré-validação dos dados de entrada via validação oficial do sistema.
// ---------------------------------------------------------------------------
export function runPreValidation(fields: AcademicFields, editorText: string): { issues: ValidationIssue[]; blockers: ReferenceRuleIssue[] } {
  const issues = validateWork(fields, editorText);
  const blockers: ReferenceRuleIssue[] = [];
  const expectedFormats = new Set([
    "reference-author-missing",
    "reference-year-missing",
    "reference-publisher-missing",
    "reference-location-missing",
    "reference-access-missing",
    "reference-incomplete",
    "reference-too-short",
    "citation-year-missing",
    "citation-page-missing",
  ]);
  for (const unique of validateReferencesText(fields.referencias)) {
    if (unique.code === "reference-too-short") {
      blockers.push({
        code: "reference-incomplete",
        message: unique.message,
        severity: "error",
        rule: "NBR 6023",
        action: "Complete a referência com dados essenciais.",
      });
      continue;
    }
    if (expectedFormats.has(unique.code)) {
      blockers.push({
        code: unique.code,
        message: unique.message,
        severity: unique.code.includes("access") ? "warning" : "error",
        rule: "NBR 6023/UFLA",
        action: "Revise a referência conforme a fonte bibliográfica.",
      });
    }
  }
  void hasBlockingErrors;
  return { issues, blockers };
}