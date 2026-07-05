export type ImpactDimension = "social" | "cientifico" | "economico" | "cultural" | "ambiental" | "institucional";

export interface ImpactDimensionDefinition {
  id: ImpactDimension;
  label: string;
  question: string;
}

export interface ImpactIndicatorAssessment {
  presentDimensions: ImpactDimension[];
  missingDimensions: ImpactDimension[];
  hasMinimumCoverage: boolean;
  message: string;
}

export const IMPACT_DIMENSIONS: ImpactDimensionDefinition[] = [
  { id: "social", label: "Impacto social", question: "Quem é beneficiado socialmente pela pesquisa?" },
  { id: "cientifico", label: "Impacto científico", question: "Que lacuna teórica, metodológica ou empírica é enfrentada?" },
  { id: "economico", label: "Impacto econômico", question: "Há efeitos sobre gestão de recursos, custos, trabalho ou produtividade?" },
  { id: "cultural", label: "Impacto cultural", question: "A pesquisa dialoga com valores, práticas, memória ou formação cultural?" },
  { id: "ambiental", label: "Impacto ambiental", question: "Há relação com sustentabilidade, ambiente, território ou qualidade de vida?" },
  { id: "institucional", label: "Impacto institucional", question: "A pesquisa contribui para políticas, processos ou tomada de decisão institucional?" },
];

const DIMENSION_PATTERNS: Record<ImpactDimension, RegExp> = {
  social: /\b(social|sociedade|comunidade|trabalhadores|servidores|publico|público)\b/i,
  cientifico: /\b(cientific|conhecimento|teoric|metodologic|pesquisa|lacuna|evidencia|evidência)\b/i,
  economico: /\b(economic|custo|recurso|orcamento|orçamento|produtividade|trabalho|gestao|gestão)\b/i,
  cultural: /\b(cultural|cultura|valores|memoria|memória|formacao|formação|saberes)\b/i,
  ambiental: /\b(ambiental|sustentabilidade|socioambiental|territorio|território|saude|saúde|bem-estar)\b/i,
  institucional: /\b(institucional|universidade|ufla|politica|política|processo|decisao|decisão|gestores)\b/i,
};

export function assessImpactIndicators(text: string): ImpactIndicatorAssessment {
  const presentDimensions = IMPACT_DIMENSIONS
    .filter((dimension) => DIMENSION_PATTERNS[dimension.id].test(text))
    .map((dimension) => dimension.id);

  const missingDimensions = IMPACT_DIMENSIONS
    .filter((dimension) => !presentDimensions.includes(dimension.id))
    .map((dimension) => dimension.id);

  const hasMinimumCoverage = presentDimensions.length >= 3 && text.trim().split(/\s+/).length >= 80;

  return {
    presentDimensions,
    missingDimensions,
    hasMinimumCoverage,
    message: hasMinimumCoverage
      ? "Indicadores de impacto possuem cobertura mínima para revisão manual."
      : "Indicadores de impacto precisam de mais desenvolvimento antes da versão final.",
  };
}

export function impactPromptSkeleton(): string {
  return IMPACT_DIMENSIONS
    .map((dimension) => `${dimension.label}: ${dimension.question}`)
    .join("\n");
}
