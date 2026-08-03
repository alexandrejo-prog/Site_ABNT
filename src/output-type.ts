export type OutputBadge = "blocked" | "draft" | "review";

export interface OutputTypeResult {
  badge: OutputBadge;
  label: string;
  shortLabel: string;
  detail: string;
}

export interface OutputTypeInput {
  hasBlockingErrors: boolean;
  hasFinalPending: boolean;
  generateAnyway: boolean;
}

/**
 * Classifica o tipo de saída atual do documento conforme o estado de
 * validação e pendências de versão final (UX-04).
 */
export function describeOutputType(input: OutputTypeInput): OutputTypeResult {
  if (input.hasBlockingErrors) {
    return {
      badge: "blocked",
      label: "Exportação bloqueada",
      shortLabel: "Bloqueado",
      detail: "Há erros essenciais a corrigir antes de gerar; o DOCX não será produzido como rascunho.",
    };
  }
  if (input.hasFinalPending || input.generateAnyway) {
    return {
      badge: "draft",
      label: "Rascunho editável",
      shortLabel: "Rascunho",
      detail: "Gera um DOCX editável com pendências de versão final (sumário, ficha, folha de aprovação) a conferir no Word/LibreOffice.",
    };
  }
  return {
    badge: "review",
    label: "Versão para revisão",
    shortLabel: "Para revisão",
    detail: "Sem pendências de versão final detectadas. Ainda recomenda-se conferir sumário atualizado, paginação e PDF no Word/LibreOffice.",
  };
}