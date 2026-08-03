import type { AcademicFields, AcademicFieldKey, Confidence } from "./ufla-rules";
import { emptyAcademicFields, emptyConfidenceMap } from "./ufla-rules";

export interface DemoExample {
  workType: AcademicFields["workType"];
  fields: Partial<AcademicFields>;
  confidence: Record<AcademicFieldKey, Confidence>;
  editorText: string;
}

export const DEMO_EXAMPLE: DemoExample = {
  workType: "dissertacao",
  fields: {
    workType: "dissertacao" as AcademicFields["workType"],
    author: "Maria da Silva",
    title: "Influência do espaçamento e da adubação nitrogenada na produção de cana-de-açúcar",
    subtitle: "Um estudo de caso na região de Lavras",
    advisor: "Prof. Dr. José Cardoso",
    program: "Agronomia",
    location: "Lavras - MG",
    year: "2026",
    resumo:
      "Este presente a o papel do espaçamento e da adubação nitrogenada sobre a produtividade da cana-de-açúcar. Empregaram-se ensaios em blocos casualizados com análise estatística. Os resultados indicaram maior produtividade no espaçamento intermediário. Conclui-se que as práticas avaliadas podem reduzir custos de manejo na região de Lavras.",
    palavrasChave: "cana-de-açúcar; adubação; produtividade",
    abstractText:
      "This study examines the effect of row spacing and nitrogen fertilization on sugarcane yield. A randomized block experiment with statistical analysis was conducted. Results indicated higher productivity under intermediate spacing. It is concluded that the evaluated practices can reduce field management costs in the Lavras region.",
    keywords: "sugarcane; fertilization; yield",
    introducao:
      "# 1 Introdução\n\nA cana-de-açúcar é uma das principais culturas do agronegócio brasileiro. O manejo de espaçamento e de nutrição é determinante para o rendimento. Este estudo avalia esses fatores no contexto local.",
    conclusao:
      "# 6 Conclusão\n\nOs resultados indicam que o espaçamento intermediário, combinado à adubação adequada, maximizou a produtividade observada, com possibilidade de ganhos práticos de manejo.",
    referencias:
      "EMBRAPA. Cana-de-açúcar: manual de manejo. Brasília, DF: Embrapa, 2021.\nFERREIRA, M. Adubação nitrogenada em cana-de-açúcar. Lavras: UFLA, 2020.",
  },
  confidence: Object.fromEntries(
    ["author", "title", "abstractText", "keywords", "resumo", "palavrasChave"].map((k) => [k, "alta"]),
  ) as Record<AcademicFieldKey, Confidence>,
  editorText:
    "# 2 Objetivo\n\nO objetivo deste trabalho é avaliar o impacto de espaçamento e adubação nitrogenada na produtividade da cana-de-açúcar.\n\n# 3 Metodologia\n\nOs ensaios foram conduzidos em blocos ao acaso, com três repetições, na região de Lavras. Os dados passaram por análise de variância.\n\n# 4 Resultados e Discussão\n\nObservou-se maior produtividade no tratamento de espaçamento intermediário, coerente com a literatura.\n\n# 5 Conclusões\n\nConcluem-se ganhos de manejo com as práticas avaliadas.\n",
};

export function demoFieldsWithWorkType(): AcademicFields {
  return { ...emptyAcademicFields(), ...DEMO_EXAMPLE.fields, workType: DEMO_EXAMPLE.workType };
}

export function demoConfidenceMap(): Record<AcademicFieldKey, Confidence> {
  return { ...emptyConfidenceMap(), ...DEMO_EXAMPLE.confidence };
}