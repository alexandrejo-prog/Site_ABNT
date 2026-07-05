import type { AcademicFields } from "./ufla-rules";

export interface ModelRuleSource {
  primary: string;
  fallback: string;
  note: string;
}

const UFLA_MANUAL = "Manual de Normalização e Estrutura de Trabalhos Acadêmicos da UFLA";
const CPG_TEMPLATES = "Templates do Congresso de Pós-Graduação da UFLA";
const ABNT_FALLBACK = "ABNT aplicável quando o manual ou template não trouxer regra específica";

export function ruleSourceForWorkType(workType: AcademicFields["workType"]): ModelRuleSource {
  if (workType === "resumo_cpg" || workType === "resumo_expandido_cpg" || workType === "artigo_completo_cpg") {
    return {
      primary: CPG_TEMPLATES,
      fallback: ABNT_FALLBACK,
      note: "Modelos CPG usam o template do congresso como regra principal; pontos omissos seguem ABNT.",
    };
  }

  if (workType === "artigo") {
    return {
      primary: "Estrutura de artigo acadêmico conforme regra institucional disponível",
      fallback: ABNT_FALLBACK,
      note: "Artigo simples não recebe capa, folha de rosto, ficha catalográfica, folha de aprovação, indicadores de impacto ou sumário.",
    };
  }

  if (workType === "projeto_pesquisa") {
    return {
      primary: "ABNT NBR 15287:2025 para projeto de pesquisa",
      fallback: UFLA_MANUAL,
      note: "Projeto de pesquisa usa estrutura própria; não deve ser convertido em tese, dissertação ou monografia sem trocar a natureza do trabalho.",
    };
  }

  return {
    primary: UFLA_MANUAL,
    fallback: ABNT_FALLBACK,
    note: "Monografia, dissertação e tese seguem o manual UFLA; pontos omissos seguem ABNT.",
  };
}
