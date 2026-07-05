import type { WorkType } from "./ufla-rules";

export interface WorkTypeOutputPolicy {
  workType: WorkType;
  label: string;
  usesFullUflaPreTextual: boolean;
  usesCpgTemplate: boolean;
  hasCover: boolean;
  hasTitlePage: boolean;
  hasCatalogCard: boolean;
  hasApprovalPage: boolean;
  hasSummary: boolean;
  hasImpactIndicators: boolean;
  hasPageHeader: boolean;
  expectedNatureStart?: string;
  finalCheck: string[];
}

export const WORK_TYPE_OUTPUT_POLICIES: Record<WorkType, WorkTypeOutputPolicy> = {
  artigo: {
    workType: "artigo",
    label: "Artigo acadêmico simples",
    usesFullUflaPreTextual: false,
    usesCpgTemplate: false,
    hasCover: false,
    hasTitlePage: false,
    hasCatalogCard: false,
    hasApprovalPage: false,
    hasSummary: false,
    hasImpactIndicators: false,
    hasPageHeader: false,
    finalCheck: ["Resumo", "palavras-chave", "corpo", "referências"],
  },
  resumo_cpg: {
    workType: "resumo_cpg",
    label: "Resumo CPG/UFLA",
    usesFullUflaPreTextual: false,
    usesCpgTemplate: true,
    hasCover: false,
    hasTitlePage: false,
    hasCatalogCard: false,
    hasApprovalPage: false,
    hasSummary: false,
    hasImpactIndicators: false,
    hasPageHeader: false,
    finalCheck: ["limite de 1 página", "autores", "resumo", "palavras-chave"],
  },
  resumo_expandido_cpg: {
    workType: "resumo_expandido_cpg",
    label: "Resumo expandido CPG/UFLA",
    usesFullUflaPreTextual: false,
    usesCpgTemplate: true,
    hasCover: false,
    hasTitlePage: false,
    hasCatalogCard: false,
    hasApprovalPage: false,
    hasSummary: false,
    hasImpactIndicators: false,
    hasPageHeader: false,
    finalCheck: ["faixa de 4 a 6 páginas", "autores", "abstract/resumo", "referências"],
  },
  artigo_completo_cpg: {
    workType: "artigo_completo_cpg",
    label: "Artigo completo CPG/UFLA",
    usesFullUflaPreTextual: false,
    usesCpgTemplate: true,
    hasCover: false,
    hasTitlePage: false,
    hasCatalogCard: false,
    hasApprovalPage: false,
    hasSummary: false,
    hasImpactIndicators: false,
    hasPageHeader: false,
    finalCheck: ["faixa de 8 a 14 páginas", "autores", "abstract/resumo", "referências"],
  },
  monografia: {
    workType: "monografia",
    label: "Monografia",
    usesFullUflaPreTextual: true,
    usesCpgTemplate: false,
    hasCover: true,
    hasTitlePage: true,
    hasCatalogCard: true,
    hasApprovalPage: true,
    hasSummary: true,
    hasImpactIndicators: false,
    hasPageHeader: true,
    expectedNatureStart: "Monografia apresentada à Universidade Federal de Lavras",
    finalCheck: ["ficha catalográfica", "folha de aprovação", "sumário", "referências"],
  },
  dissertacao: {
    workType: "dissertacao",
    label: "Dissertação",
    usesFullUflaPreTextual: true,
    usesCpgTemplate: false,
    hasCover: true,
    hasTitlePage: true,
    hasCatalogCard: true,
    hasApprovalPage: true,
    hasSummary: true,
    hasImpactIndicators: true,
    hasPageHeader: true,
    expectedNatureStart: "Dissertação apresentada à Universidade Federal de Lavras",
    finalCheck: ["ficha catalográfica", "folha de aprovação", "indicadores de impacto", "sumário"],
  },
  tese: {
    workType: "tese",
    label: "Tese",
    usesFullUflaPreTextual: true,
    usesCpgTemplate: false,
    hasCover: true,
    hasTitlePage: true,
    hasCatalogCard: true,
    hasApprovalPage: true,
    hasSummary: true,
    hasImpactIndicators: true,
    hasPageHeader: true,
    expectedNatureStart: "Tese apresentada à Universidade Federal de Lavras",
    finalCheck: ["ficha catalográfica", "folha de aprovação", "indicadores de impacto", "sumário"],
  },
  projeto_pesquisa: {
    workType: "projeto_pesquisa",
    label: "Projeto de pesquisa",
    usesFullUflaPreTextual: true,
    usesCpgTemplate: false,
    hasCover: true,
    hasTitlePage: true,
    hasCatalogCard: false,
    hasApprovalPage: false,
    hasSummary: true,
    hasImpactIndicators: false,
    hasPageHeader: true,
    expectedNatureStart: "Projeto de pesquisa apresentado à Universidade Federal de Lavras",
    finalCheck: ["natureza de projeto", "sumário", "cronograma", "referências"],
  },
  outro: {
    workType: "outro",
    label: "Outro",
    usesFullUflaPreTextual: true,
    usesCpgTemplate: false,
    hasCover: true,
    hasTitlePage: true,
    hasCatalogCard: false,
    hasApprovalPage: false,
    hasSummary: true,
    hasImpactIndicators: false,
    hasPageHeader: true,
    finalCheck: ["tipo correto", "natureza do trabalho", "sumário", "referências"],
  },
};

export function outputPolicyFor(workType: WorkType): WorkTypeOutputPolicy {
  return WORK_TYPE_OUTPUT_POLICIES[workType];
}

export function shouldShowCatalogCard(workType: WorkType): boolean {
  return outputPolicyFor(workType).hasCatalogCard;
}

export function shouldShowApprovalPage(workType: WorkType): boolean {
  return outputPolicyFor(workType).hasApprovalPage;
}

export function shouldShowImpactIndicators(workType: WorkType): boolean {
  return outputPolicyFor(workType).hasImpactIndicators;
}
