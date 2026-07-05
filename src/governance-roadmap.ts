import { NORMATIVE_COVERAGE_MATRIX, type CoveragePriority } from "./normative-coverage";

export interface RoadmapMilestone {
  id: string;
  title: string;
  focus: string;
  priority: CoveragePriority;
  coverageIds: string[];
}

export const GOVERNANCE_ROADMAP: RoadmapMilestone[] = [
  {
    id: "m1-core-correctness",
    title: "Milestone 1 - Correção do fluxo essencial",
    focus: "Importação, edição, validação bloqueante e exportação DOCX com sumário atualizável.",
    priority: "alta",
    coverageIds: ["docx-import-regression", "docx-export-flow", "summary-abstract-validation", "transparency-score"],
  },
  {
    id: "m2-required-manual-elements",
    title: "Milestone 2 - Elementos manuais obrigatórios",
    focus: "Ficha catalográfica, folha de aprovação, conferência de imagens e instruções pós-geração.",
    priority: "alta",
    coverageIds: ["catalog-card", "pretextual-lists", "impact-indicators"],
  },
  {
    id: "m3-interface-quality",
    title: "Milestone 3 - Qualidade de interface",
    focus: "Blocos dobráveis, responsividade, acessibilidade e redução de carga cognitiva.",
    priority: "alta",
    coverageIds: ["review-ux", "responsive-audit", "accessibility-audit"],
  },
  {
    id: "m4-continuous-quality",
    title: "Milestone 4 - Qualidade contínua",
    focus: "CI, testes e2e, Lighthouse, axe e orçamento de performance.",
    priority: "media",
    coverageIds: ["continuous-quality", "docx-performance", "governance-roadmap"],
  },
];

export function unresolvedCoverageIds(): string[] {
  return NORMATIVE_COVERAGE_MATRIX
    .filter((item) => item.currentStatus !== "implemented")
    .map((item) => item.id);
}

export function roadmapCoverageIsValid(): boolean {
  const knownIds = new Set(NORMATIVE_COVERAGE_MATRIX.map((item) => item.id));
  return GOVERNANCE_ROADMAP.every((milestone) =>
    milestone.coverageIds.every((coverageId) => knownIds.has(coverageId)),
  );
}
