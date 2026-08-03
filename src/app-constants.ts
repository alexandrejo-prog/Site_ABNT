import { isCpgWork, isResearchProject, isUflaCollectionWork } from "./ufla-rules";

export const FIELD_LABELS: Record<string, string> = {
  author: "Autor", title: "Título", subtitle: "Subtítulo", englishTitle: "Título em inglês", workNature: "Natureza do trabalho",
  course: "Curso", program: "Programa", advisor: "Orientador", coadvisor: "Coorientador",
  location: "Local", year: "Ano", resumo: "Resumo", palavrasChave: "Palavras-chave",
  abstractText: "Abstract", keywords: "Keywords", introducao: "Introdução", conclusao: "Conclusão",
  referencias: "Referências", anexos: "Anexos", apendices: "Apêndices",
  dedicatoria: "Dedicatória", agradecimentos: "Agradecimentos", epigrafe: "Epígrafe", errata: "Errata",
  listaAbreviaturas: "Lista de abreviaturas", listaSimbolos: "Lista de símbolos", glossario: "Glossário",
  indicadoresImpacto: "Indicadores de impacto", impactIndicators: "Impact indicators",
  imageWarnings: "Avisos de imagens", tema: "Tema", delimitacaoTema: "Delimitação do Tema",
  problemaPesquisa: "Problema de Pesquisa", hipotese: "Hipótese",
  objetivoGeral: "Objetivo Geral", objetivosEspecificos: "Objetivos Específicos",
  justificativa: "Justificativa", referencialTeorico: "Referencial Teórico",
  metodologia: "Metodologia", cronograma: "Cronograma",
  recursosOrcamento: "Recursos/Orçamento", resultadosEsperados: "Resultados Esperados",
  corpusDados: "Corpus/Dados", contextoInstitucional: "Contexto Institucional",
  conclusaoProvisoria: "Conclusão Provisória", contribuicoesImpactos: "Contribuições/Impactos",
  impactoSocial: "Impacto social", impactoCientifico: "Impacto científico",
  impactoEducacional: "Impacto educacional", impactoAmbiental: "Impacto ambiental",
  impactoTecnologico: "Impacto tecnológico/econômico", publicoBeneficiado: "Público beneficiado",
  aderenciaOds: "Aderência a ODS/política institucional",
  areaConcentracao: "Área de concentração",
  aprovalDate: "Data de aprovação",
  approvalMembers: "Membros da banca",
};

export const RESEARCH_PROJECT_FIELD_KEYS: string[] = ["tema", "delimitacaoTema", "problemaPesquisa", "hipotese", "objetivoGeral", "objetivosEspecificos", "justificativa", "referencialTeorico", "metodologia", "cronograma", "recursosOrcamento", "resultadosEsperados"];

export const ASSISTED_FIELD_KEYS: string[] = ["tema", "problemaPesquisa", "objetivoGeral", "objetivosEspecificos", "justificativa", "referencialTeorico", "corpusDados", "contextoInstitucional", "metodologia", "resultadosEsperados", "conclusaoProvisoria", "contribuicoesImpactos"];

export const LONG_FIELDS = new Set([...RESEARCH_PROJECT_FIELD_KEYS, "workNature", "resumo", "abstractText", "introducao", "conclusao", "referencias", "anexos", "apendices", "dedicatoria", "agradecimentos", "epigrafe", "indicadoresImpacto", "impactIndicators", "imageWarnings", "approvalMembers"]);

export const EDITOR_DESCRIPTION_ID = "editor-mode-note";

export const IMPACT_KEYS = ["impactoSocial", "impactoCientifico", "impactoEducacional", "impactoAmbiental", "impactoTecnologico", "publicoBeneficiado", "aderenciaOds"];

export function rowsForField(key: string): number {
  if (key === "referencias") return 12;
  if (key === "anexos" || key === "apendices") return 7;
  return LONG_FIELDS.has(key) ? 5 : 1;
}

const HIDDEN_PRETEXTUAL = ["dedicatoria", "agradecimentos", "epigrafe", "errata", "listaSiglas", "listaQuadros", "listaGraficos", "listaTabelas", "listaAbreviaturas", "listaSimbolos", "glossario", "indicadoresImpacto", "impactIndicators"];

export function visibleField(key: string, workType: string): boolean {
  if (RESEARCH_PROJECT_FIELD_KEYS.includes(key)) return isResearchProject(workType as any);
  if (IMPACT_KEYS.includes(key)) return false;
  if (key === "englishTitle") return workType === "dissertacao" || workType === "tese";
  if (workType === "artigo") return !HIDDEN_PRETEXTUAL.includes(key);
  if (isUflaCollectionWork(workType as any)) return !HIDDEN_PRETEXTUAL.includes(key);
  if (isCpgWork(workType as any)) return ![...HIDDEN_PRETEXTUAL, "workNature", "anexos", "apendices"].includes(key);
  return true;
}

export function courseFieldLabel(workType: string): string {
  return isCpgWork(workType as any) ? "E-mail dos autores" : "Curso";
}
