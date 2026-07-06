import { AcademicFieldKey } from "./ufla-rules";

interface SectionAlias {
  headings: string[];
  fieldKey: AcademicFieldKey;
}

const SECTION_ALIASES: SectionAlias[] = [
  { headings: ["CONCLUSAO", "CONSIDERACOES FINAIS"], fieldKey: "conclusao" },
  { headings: ["REFERENCIAS", "REFERÊNCIAS", "REFERENCIAS BIBLIOGRAFICAS", "REFERÊNCIAS BIBLIOGRÁFICAS"], fieldKey: "referencias" },
  { headings: ["REFERENCIAL TEORICO", "FUNDAMENTACAO TEORICA", "REVISAO BIBLIOGRAFICA"], fieldKey: "referencialTeorico" },
  { headings: ["METODOLOGIA", "PROCEDIMENTOS METODOLICOS", "PROCEDIMENTOS METODOLÓGICOS", "MATERIAL E METODOS", "MATERIAIS E METODOS", "METODOLOGIA E TECNICAS"], fieldKey: "metodologia" },
  { headings: ["OBJETIVO GERAL"], fieldKey: "objetivoGeral" },
  { headings: ["OBJETIVOS ESPECIFICOS", "OBJETIVOS ESPECÍFICOS"], fieldKey: "objetivosEspecificos" },
  { headings: ["RESULTADOS ESPERADOS"], fieldKey: "resultadosEsperados" },
  { headings: ["CRONOGRAMA", "CRONOGRAMA DE EXECUCAO"], fieldKey: "cronograma" },
  { headings: ["REVISAO DA LITERATURA", "ESTADO DA TECNICA"], fieldKey: "referencialTeorico" },
  { headings: ["REIVINDICACOES", "REQUISITOS", "DESENVOLVIMENTO", "ATIVIDADES DESENVOLVIDAS", "PLANO DE EXECUCAO"], fieldKey: "metodologia" },
  { headings: ["JUSTIFICATIVA", "DIAGNOSTICO SITUACIONAL"], fieldKey: "justificativa" },
  { headings: ["RESULTADOS", "RESULTADOS E DISCUSSAO", "DESEMPENHO AGRONOMICO"], fieldKey: "resultadosEsperados" },
];

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeSectionTitle(value: string): string {
  const normalized = normalize(value);
  return normalized.replace(/^\d+(?:\.\d+)*\.?\s*/, "").trim();
}

export function getSectionKeyFromTitle(title: string): AcademicFieldKey | undefined {
  const normalized = normalizeSectionTitle(title);
  for (const alias of SECTION_ALIASES) {
    if (alias.headings.some((h) => normalize(h) === normalized)) {
      return alias.fieldKey;
    }
  }
  return undefined;
}

export function isEquivalentSectionTitle(title: string, expectedKey: AcademicFieldKey): boolean {
  const alias = SECTION_ALIASES.find((a) => a.fieldKey === expectedKey);
  if (!alias) return false;
  const normalized = normalizeSectionTitle(title);
  return alias.headings.some((h) => normalize(h) === normalized);
}

export function getKnownSectionHeadings(): string[] {
  return SECTION_ALIASES.flatMap((alias) => alias.headings);
}
