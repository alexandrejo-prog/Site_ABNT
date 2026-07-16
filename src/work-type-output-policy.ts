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
  // Perfil documental explicito (6a ed.): guia da Colecao Producao Academica UFLA
  // e secoes obrigatorias minimas. Ausente para formatos tradicionais.
  sourceGuide?: string;
  requiredSections?: string[];
  // Politica de saida do DOCX para o perfil (ex.: resumo estruturado,
  // palavras-chave, abstract bilíngue). Orienta a revisao final.
  outputPolicy?: string[];
}

export const WORK_TYPE_OUTPUT_POLICIES: Partial<Record<WorkType, WorkTypeOutputPolicy>> = {
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
  artigo_cientifico_ufla: {
    workType: "artigo_cientifico_ufla",
    label: "Artigo científico UFLA",
    usesFullUflaPreTextual: false,
    usesCpgTemplate: false,
    hasCover: false,
    hasTitlePage: false,
    hasCatalogCard: false,
    hasApprovalPage: false,
    hasSummary: false,
    hasImpactIndicators: false,
    hasPageHeader: false,
    finalCheck: ["guia da Coleção Produção Acadêmica UFLA (nº 1)", "estrutura de artigo", "resumo", "palavras-chave", "referências"],
    sourceGuide: "Coleção Produção Acadêmica UFLA — Guia nº 1: Artigo científico (www.tcc.ufla.br)",
    requiredSections: ["Introdução", "Metodologia ou material e métodos", "Resultados e discussão", "Conclusão", "Referências"],
    // Perfil de saida do DOCX (Guia nº 1): resumo estruturado + palavras-chave
    // em PT, titulo bilíngue opcional, abstract em EN, secoes numericas.
    outputPolicy: [
      "Resumo estruturado (propósito, método, resultados, conclusão) com palavras-chave em PT-BR",
      "Abstract bilíngue (EN) correspondente ao resumo",
      "Seções em numeração contínua (1, 1.1, 1.1.1), sem saltos",
      "Referências no padrão ABNT ao final",
    ],
  },
  patente_ufla: {
    workType: "patente_ufla",
    label: "Patente UFLA",
    usesFullUflaPreTextual: false,
    usesCpgTemplate: false,
    hasCover: false,
    hasTitlePage: false,
    hasCatalogCard: false,
    hasApprovalPage: false,
    hasSummary: false,
    hasImpactIndicators: false,
    hasPageHeader: false,
    finalCheck: ["guia da Coleção Produção Acadêmica UFLA (nº 2)", "descrição técnica", "reivindicações", "referências"],
    sourceGuide: "Coleção Produção Acadêmica UFLA — Guia nº 2: Patente (www.tcc.ufla.br)",
    requiredSections: ["Campo da invenção", "Estado da técnica", "Descrição da invenção", "Reivindicações", "Desenhos", "Referências"],
  },
  revisao_sistematica_ufla: {
    workType: "revisao_sistematica_ufla",
    label: "Revisão sistemática e aprofundada UFLA",
    usesFullUflaPreTextual: false,
    usesCpgTemplate: false,
    hasCover: false,
    hasTitlePage: false,
    hasCatalogCard: false,
    hasApprovalPage: false,
    hasSummary: false,
    hasImpactIndicators: false,
    hasPageHeader: false,
    finalCheck: ["guia da Coleção Produção Acadêmica UFLA (nº 3)", "protocolo", "string de busca", "referências"],
    sourceGuide: "Coleção Produção Acadêmica UFLA — Guia nº 3: Revisão sistemática e aprofundada (www.tcc.ufla.br)",
    requiredSections: ["Pergunta de pesquisa", "Critérios de inclusão e exclusão", "Bases de dados", "Estratégia de busca", "Seleção de estudos", "Síntese dos achados"],
    // Perfil de saida (Guia nº 3): protocolo PRISMA, pergunta PICO, fluxo
    // de selecao, tabela de extracao e sintese narrativa/quantitativa.
    outputPolicy: [
      "Protocolo registrado (ex.: PRISMA) e pergunta estruturada (PICO)",
      "Estratégia de busca com string completa e bases consultadas",
      "Fluxo de seleção de estudos (identificados, elegíveis, incluídos)",
      "Síntese dos achados com tabela de extração e limitações",
      "Referências das fontes primárias no padrão ABNT",
    ],
  },
  estudo_caso_ufla: {
    workType: "estudo_caso_ufla",
    label: "Estudo de caso UFLA",
    usesFullUflaPreTextual: false,
    usesCpgTemplate: false,
    hasCover: false,
    hasTitlePage: false,
    hasCatalogCard: false,
    hasApprovalPage: false,
    hasSummary: false,
    hasImpactIndicators: false,
    hasPageHeader: false,
    finalCheck: ["guia da Coleção Produção Acadêmica UFLA (nº 4)", "delimitação do caso", "evidências", "referências"],
    sourceGuide: "Coleção Produção Acadêmica UFLA — Guia nº 4: Estudo de caso (www.tcc.ufla.br)",
    requiredSections: ["Contexto do caso", "Unidade de análise", "Coleta de dados", "Análise de dados", "Resultados e discussão"],
  },
  software_aplicativo_ufla: {
    workType: "software_aplicativo_ufla",
    label: "Software e aplicativos UFLA",
    usesFullUflaPreTextual: false,
    usesCpgTemplate: false,
    hasCover: false,
    hasTitlePage: false,
    hasCatalogCard: false,
    hasApprovalPage: false,
    hasSummary: false,
    hasImpactIndicators: false,
    hasPageHeader: false,
    finalCheck: ["guia da Coleção Produção Acadêmica UFLA (nº 5)", "requisitos", "arquitetura", "referências"],
    sourceGuide: "Coleção Produção Acadêmica UFLA — Guia nº 5: Desenvolvimento de software e aplicativos (www.tcc.ufla.br)",
    requiredSections: ["Requisitos", "Tecnologias utilizadas", "Arquitetura", "Funcionalidades", "Testes", "Manual de uso"],
    // Perfil de saida (Guia nº 5): documentacao tecnica + manual do usuario,
    // diagramas (casos de uso/classes), evidencia de execucao e licenca.
    outputPolicy: [
      "Especificação de requisitos (funcionais e não funcionais)",
      "Diagramas de arquitetura e de casos de uso",
      "Relato de testes (casos, cobertura, resultados)",
      "Manual de uso com capturas de tela e exemplos",
      "Informação de licença e repositório, se aplicável",
    ],
  },
  cultivar_ufla: {
    workType: "cultivar_ufla",
    label: "Cultivar UFLA",
    usesFullUflaPreTextual: false,
    usesCpgTemplate: false,
    hasCover: false,
    hasTitlePage: false,
    hasCatalogCard: false,
    hasApprovalPage: false,
    hasSummary: false,
    hasImpactIndicators: false,
    hasPageHeader: false,
    finalCheck: ["guia da Coleção Produção Acadêmica UFLA (nº 6)", "descritores oficiais", "ensaios", "referências"],
    sourceGuide: "Coleção Produção Acadêmica UFLA — Guia nº 6: Cultivar (www.tcc.ufla.br)",
    requiredSections: ["Origem e desenvolvimento", "Características", "Desempenho agronômico", "Recomendações", "Referências"],
  },
  relatorio_estagio_ufla: {
    workType: "relatorio_estagio_ufla",
    label: "Relatório de estágio UFLA",
    usesFullUflaPreTextual: false,
    usesCpgTemplate: false,
    hasCover: false,
    hasTitlePage: false,
    hasCatalogCard: false,
    hasApprovalPage: false,
    hasSummary: false,
    hasImpactIndicators: false,
    hasPageHeader: false,
    finalCheck: ["guia da Coleção Produção Acadêmica UFLA (nº 7)", "dados do local", "carga horária", "referências"],
    sourceGuide: "Coleção Produção Acadêmica UFLA — Guia nº 7: Relatório de estágio (www.tcc.ufla.br)",
    requiredSections: ["Identificação", "Plano de atividades", "Atividades desenvolvidas", "Aprendizados", "Considerações finais"],
  },
  proposta_intervencao_ufla: {
    workType: "proposta_intervencao_ufla",
    label: "Proposta de intervenção UFLA",
    usesFullUflaPreTextual: false,
    usesCpgTemplate: false,
    hasCover: false,
    hasTitlePage: false,
    hasCatalogCard: false,
    hasApprovalPage: false,
    hasSummary: false,
    hasImpactIndicators: false,
    hasPageHeader: false,
    finalCheck: ["guia da Coleção Produção Acadêmica UFLA (nº 8)", "diagnóstico", "indicadores", "referências"],
    sourceGuide: "Coleção Produção Acadêmica UFLA — Guia nº 8: Proposta de intervenção (www.tcc.ufla.br)",
    requiredSections: ["Diagnóstico situacional", "Justificativa", "Objetivos", "Plano de execução", "Indicadores", "Resultados esperados"],
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

const GENERIC_UFLA_POLICY: WorkTypeOutputPolicy = {
  workType: "outro",
  label: "Formato UFLA com suporte inicial",
  usesFullUflaPreTextual: true,
  usesCpgTemplate: false,
  hasCover: true,
  hasTitlePage: true,
  hasCatalogCard: false,
  hasApprovalPage: false,
  hasSummary: true,
  hasImpactIndicators: false,
  hasPageHeader: true,
  finalCheck: ["guia da Coleção Produção Acadêmica UFLA", "estrutura específica", "sumário", "referências", "validação manual"],
};

export function outputPolicyFor(workType: WorkType): WorkTypeOutputPolicy {
  return WORK_TYPE_OUTPUT_POLICIES[workType] ?? { ...GENERIC_UFLA_POLICY, workType };
}

export function getPolicyRequiredSections(workType: WorkType): string[] {
  return outputPolicyFor(workType).requiredSections ?? [];
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
