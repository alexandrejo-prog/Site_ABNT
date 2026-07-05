export type CompletionState = "complete" | "manual-final-check" | "blocked-external";

export interface CompletionStatusItem {
  category: string;
  state: CompletionState;
  evidence: string[];
}

export const COMPLETION_STATUS: CompletionStatusItem[] = [
  { category: "Posicionamento", state: "complete", evidence: ["README", "integration-main-flow"] },
  { category: "Cobertura normativa", state: "complete", evidence: ["normative-coverage", "STATUS_NORMATIVO"] },
  { category: "Ficha catalografica", state: "manual-final-check", evidence: ["catalog-card", "catalog-card tests"] },
  { category: "Resumo/Abstract", state: "complete", evidence: ["summary validators", "summary quality"] },
  { category: "Indicadores de impacto", state: "complete", evidence: ["impact-indicators", "impact tests"] },
  { category: "Listas pre-textuais", state: "complete", evidence: ["pretextual-lists", "pretextual tests"] },
  { category: "Importacao DOCX", state: "complete", evidence: ["import-docx", "heading-fragment-repair"] },
  { category: "Exportacao DOCX", state: "manual-final-check", evidence: ["export-docx", "toc field tests"] },
  { category: "UX de revisao", state: "complete", evidence: ["review-workflow", "static-ui tests"] },
  { category: "Transparencia", state: "complete", evidence: ["document-adherence", "final-readiness"] },
  { category: "Testes", state: "manual-final-check", evidence: ["vitest", "npm run verify", "CI_VERIFY"] },
  { category: "Responsividade", state: "manual-final-check", evidence: ["static-ui breakpoints"] },
  { category: "Acessibilidade", state: "manual-final-check", evidence: ["accessibility-checklist", "accessibility tests"] },
  { category: "Performance", state: "manual-final-check", evidence: ["performance-budget"] },
  { category: "Governanca", state: "complete", evidence: ["governance-roadmap", "STATUS_NORMATIVO"] },
];

export function incompleteTechnicalCategories(): CompletionStatusItem[] {
  return COMPLETION_STATUS.filter((item) => item.state === "blocked-external");
}

export function categoriesRequiringManualFinalCheck(): CompletionStatusItem[] {
  return COMPLETION_STATUS.filter((item) => item.state === "manual-final-check");
}

export function allTechnicalWorkComplete(): boolean {
  return incompleteTechnicalCategories().length === 0;
}
