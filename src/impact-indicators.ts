import type { AcademicFieldKey, AcademicFields } from "./ufla-rules";

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

// IMPACT_DIMENSIONS representa dimensões de análise de texto livre usadas por assessImpactIndicators.
// IMPACT_FIELD_ENTRIES representa campos estruturados do formulário do usuário usados por consolidateImpactIndicators.
// São taxonomias complementares: uma mede texto livre, outra mede formulário estruturado.

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

export interface ImpactFieldEntry {
  key: AcademicFieldKey;
  label: string;
  value: string;
}

export const IMPACT_FIELD_ENTRIES: ImpactFieldEntry[] = [
  { key: "impactoSocial", label: "Impacto social", value: "" },
  { key: "impactoCientifico", label: "Impacto científico", value: "" },
  { key: "impactoEducacional", label: "Impacto educacional", value: "" },
  { key: "impactoAmbiental", label: "Impacto ambiental", value: "" },
  { key: "impactoTecnologico", label: "Impacto tecnológico/econômico", value: "" },
  { key: "publicoBeneficiado", label: "Público beneficiado", value: "" },
  { key: "aderenciaOds", label: "Aderência a ODS/política institucional", value: "" },
];

function fieldValue(fields: AcademicFields, key: AcademicFieldKey): string {
  return fields[key].trim();
}

// Texto consolidado usando somente dados informados pelo usuário.
// Mantido para o rascunho/preview (exibe os rótulos agrupados).
export function consolidateImpactIndicators(fields: AcademicFields): string {
  const explicit = fieldValue(fields, "indicadoresImpacto");
  if (explicit) return explicit;

  const filled = IMPACT_FIELD_ENTRIES
    .map((entry) => ({ label: entry.label, value: fieldValue(fields, entry.key) }))
    .filter((entry) => entry.value.length > 0);

  if (filled.length === 0) return "";
  // Texto corrido em parágrafo único (terceira pessoa), conforme Manual de Normalização UFLA.
  return filled.map((entry) => `${entry.label}: ${entry.value}`).join("; ");
}

const IMPACT_LABEL_PREFIX =
  /^\s*(impacto social|impacto científico|impacto educacional|impacto ambiental|impacto tecnológico\/econômico|público beneficiado|aderência a ods\/política institucional)\s*:\s*/i;

// Remove os rótulos ("Impacto social:", "Impacto científico:", etc.) de um texto
// já consolidado, transformando-o em texto corrido sem lista de rótulos.
export function stripImpactLabels(text: string): string {
  return text
    .split(";")
    .map((segment) => segment.replace(IMPACT_LABEL_PREFIX, "").trim())
    .filter(Boolean)
    .join("; ");
}

function ensureImpactPeriod(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/[.;]$/.test(trimmed)) return trimmed;
  return `${trimmed}.`;
}

function impactClauseConnector(key: AcademicFieldKey): string {
  switch (key) {
    case "impactoSocial":
      return "O trabalho contribui socialmente ao";
    case "impactoCientifico":
      return "apresenta impacto científico ao";
    case "impactoEducacional":
      return "favorece a formação educacional ao";
    case "impactoAmbiental":
      return "reduz impactos ambientais relacionados a";
    case "impactoTecnologico":
      return "contribui tecnológica e economicamente para";
    case "publicoBeneficiado":
      return "beneficia";
    case "aderenciaOds":
      return "adere aos objetivos institucionais relacionados a";
    default:
      return "";
  }
}

// Texto de indicadores de impacto em parágrafo único, em terceira pessoa, sem
// rótulos e sem lista/tópicos. Usado no bloco pré-textual do DOCX (Manual UFLA).
export function buildFlowingImpactText(fields: AcademicFields): string {
  const explicit = fieldValue(fields, "indicadoresImpacto").trim();
  if (explicit) return stripImpactLabels(explicit);

  const filled = IMPACT_FIELD_ENTRIES
    .map((entry) => ({ key: entry.key, value: fieldValue(fields, entry.key) }))
    .filter((entry) => entry.value.length > 0);

  if (filled.length === 0) return "";

  const clauses = filled.map((entry) => {
    const connector = impactClauseConnector(entry.key);
    const value = entry.value.trim();
    return connector ? `${connector} ${value}` : value;
  });

  return ensureImpactPeriod(clauses.join(" "));
}

// Considera suficiente quando há ao menos dois campos específicos de impacto
// preenchidos com texto real, ou o campo consolidado preenchido.
export function hasSufficientImpactIndicators(fields: AcademicFields): boolean {
  if (fieldValue(fields, "indicadoresImpacto").length > 0) return true;
  const impactKeys: AcademicFieldKey[] = ["impactoSocial", "impactoCientifico", "impactoEducacional", "impactoAmbiental", "impactoTecnologico"];
  const filledImpacts = impactKeys.filter((key) => fieldValue(fields, key).length > 0).length;
  if (filledImpacts >= 2) return true;
  const allFields = IMPACT_FIELD_ENTRIES.filter((entry) => fieldValue(fields, entry.key).length > 0);
  return allFields.length >= 2;
}
