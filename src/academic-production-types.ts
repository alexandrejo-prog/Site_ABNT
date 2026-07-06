import type { AcademicFieldKey, WorkType, WorkTypeValue } from "./ufla-rules";

export type AcademicProductionSupportStatus = "inicial" | "parcial";

export interface AcademicProductionTypeDefinition {
  id: WorkType;
  label: string;
  description: string;
  sourceCollectionNumber: number;
  requiredFields: AcademicFieldKey[];
  optionalFields: AcademicFieldKey[];
  sectionAliases: string[];
  recommendedSections: string[];
  manualValidationNotes: string[];
  supportStatus: AcademicProductionSupportStatus;
}

const COMMON_REQUIRED_FIELDS: AcademicFieldKey[] = ["author", "title", "resumo", "referencias"];
const COMMON_OPTIONAL_FIELDS: AcademicFieldKey[] = ["subtitle", "course", "program", "advisor", "coadvisor", "abstractText", "keywords", "anexos", "apendices"];

export const ACADEMIC_PRODUCTION_TYPES: AcademicProductionTypeDefinition[] = [
  {
    id: "artigo_cientifico_ufla",
    label: "Artigo científico UFLA",
    description: "TCC organizado como artigo científico conforme a Coleção Produção Acadêmica UFLA.",
    sourceCollectionNumber: 1,
    requiredFields: [...COMMON_REQUIRED_FIELDS, "palavrasChave", "introducao"],
    optionalFields: [...COMMON_OPTIONAL_FIELDS, "metodologia", "conclusao"],
    sectionAliases: ["artigo cientifico", "artigo", "paper", "manuscrito"],
    recommendedSections: ["Introdução", "Metodologia ou material e métodos", "Resultados e discussão", "Conclusão", "Referências"],
    manualValidationNotes: ["Conferir guia da coleção, escopo do periódico ou curso, figuras, tabelas, citações e referências."],
    supportStatus: "inicial",
  },
  {
    id: "patente_ufla",
    label: "Patente UFLA",
    description: "TCC em formato de patente, com descrição técnica, estado da técnica e reivindicações.",
    sourceCollectionNumber: 2,
    requiredFields: [...COMMON_REQUIRED_FIELDS, "introducao", "referencialTeorico"],
    optionalFields: [...COMMON_OPTIONAL_FIELDS, "metodologia", "conclusao", "anexos"],
    sectionAliases: ["patente", "pedido de patente", "propriedade intelectual", "reivindicacoes", "reivindicações"],
    recommendedSections: ["Campo da invenção", "Estado da técnica", "Descrição da invenção", "Reivindicações", "Desenhos", "Referências"],
    manualValidationNotes: ["Conferir sigilo, titularidade, novidade, desenhos e reivindicações com orientação institucional especializada."],
    supportStatus: "inicial",
  },
  {
    id: "revisao_sistematica_ufla",
    label: "Revisão sistemática e aprofundada UFLA",
    description: "TCC baseado em revisão sistemática, integrativa ou aprofundada da literatura.",
    sourceCollectionNumber: 3,
    requiredFields: [...COMMON_REQUIRED_FIELDS, "palavrasChave", "objetivoGeral", "metodologia"],
    optionalFields: [...COMMON_OPTIONAL_FIELDS, "objetivosEspecificos", "referencialTeorico", "conclusao"],
    sectionAliases: ["revisao sistematica", "revisão sistemática", "revisao aprofundada", "revisão aprofundada", "protocolo de revisao", "PRISMA"],
    recommendedSections: ["Pergunta de pesquisa", "Critérios de inclusão e exclusão", "Bases de dados", "Estratégia de busca", "Síntese dos achados"],
    manualValidationNotes: ["Conferir protocolo, strings de busca, fluxograma, critérios de elegibilidade e quadros de extração."],
    supportStatus: "inicial",
  },
  {
    id: "estudo_caso_ufla",
    label: "Estudo de caso ou casos múltiplos UFLA",
    description: "TCC estruturado como estudo de caso único, casos múltiplos ou relato de caso.",
    sourceCollectionNumber: 4,
    requiredFields: [...COMMON_REQUIRED_FIELDS, "introducao", "metodologia"],
    optionalFields: [...COMMON_OPTIONAL_FIELDS, "referencialTeorico", "conclusao", "anexos"],
    sectionAliases: ["estudo de caso", "casos multiplos", "casos múltiplos", "estudo multicaso", "relato de caso"],
    recommendedSections: ["Contexto do caso", "Unidade de análise", "Coleta de dados", "Análise de dados", "Resultados e discussão"],
    manualValidationNotes: ["Conferir delimitação do caso, evidências, autorizações, aspectos éticos e anexos."],
    supportStatus: "inicial",
  },
  {
    id: "software_aplicativo_ufla",
    label: "Software e aplicativos UFLA",
    description: "TCC cujo produto principal é software, aplicativo ou artefato computacional documentado.",
    sourceCollectionNumber: 5,
    requiredFields: [...COMMON_REQUIRED_FIELDS, "objetivoGeral", "metodologia"],
    optionalFields: [...COMMON_OPTIONAL_FIELDS, "objetivosEspecificos", "resultadosEsperados", "anexos"],
    sectionAliases: ["software", "aplicativo", "aplicacao", "aplicação", "sistema computacional", "desenvolvimento de software"],
    recommendedSections: ["Requisitos", "Tecnologias utilizadas", "Arquitetura", "Funcionalidades", "Testes", "Manual de uso"],
    manualValidationNotes: ["Conferir requisitos, arquitetura, telas, repositório, instalação, testes, segurança e licença."],
    supportStatus: "inicial",
  },
  {
    id: "cultivar_ufla",
    label: "Cultivar UFLA",
    description: "TCC sobre cultivar, melhoramento, caracterização ou desempenho agronômico.",
    sourceCollectionNumber: 6,
    requiredFields: [...COMMON_REQUIRED_FIELDS, "metodologia"],
    optionalFields: [...COMMON_OPTIONAL_FIELDS, "resultadosEsperados", "conclusao", "anexos"],
    sectionAliases: ["cultivar", "nova cultivar", "melhoramento genetico", "melhoramento genético", "descritores agronomicos", "DHE"],
    recommendedSections: ["Origem e desenvolvimento", "Características", "Desempenho agronômico", "Recomendações", "Referências"],
    manualValidationNotes: ["Conferir descritores oficiais, registros, proteção, ensaios, ambientes e tabelas agronômicas."],
    supportStatus: "inicial",
  },
  {
    id: "relatorio_estagio_ufla",
    label: "Relatório de estágio UFLA",
    description: "Documento acadêmico que relata local, período, supervisão e atividades de estágio.",
    sourceCollectionNumber: 7,
    requiredFields: ["author", "title", "course", "introducao", "metodologia", "conclusao"],
    optionalFields: [...COMMON_OPTIONAL_FIELDS, "referencias", "anexos"],
    sectionAliases: ["relatorio de estagio", "relatório de estágio", "estagio supervisionado", "estágio supervisionado", "atividades de estagio"],
    recommendedSections: ["Identificação", "Plano de atividades", "Atividades desenvolvidas", "Aprendizados", "Considerações finais"],
    manualValidationNotes: ["Conferir regras do curso, dados do local, carga horária, supervisor, assinaturas e anexos."],
    supportStatus: "inicial",
  },
  {
    id: "proposta_intervencao_ufla",
    label: "Proposta de intervenção UFLA",
    description: "TCC voltado a diagnóstico, planejamento e intervenção em contexto clínico ou de serviço.",
    sourceCollectionNumber: 8,
    requiredFields: [...COMMON_REQUIRED_FIELDS, "justificativa", "objetivoGeral", "metodologia", "cronograma"],
    optionalFields: [...COMMON_OPTIONAL_FIELDS, "objetivosEspecificos", "resultadosEsperados", "anexos"],
    sectionAliases: ["proposta de intervencao", "proposta de intervenção", "intervencao clinica", "intervenção clínica", "procedimentos clinicos", "servico pertinente"],
    recommendedSections: ["Diagnóstico situacional", "Justificativa", "Objetivos", "Plano de execução", "Indicadores", "Resultados esperados"],
    manualValidationNotes: ["Conferir pertinência clínica ou de serviço, aspectos éticos, autorizações, cronograma e indicadores."],
    supportStatus: "inicial",
  },
];

export const ACADEMIC_PRODUCTION_TYPE_IDS = ACADEMIC_PRODUCTION_TYPES.map((type) => type.id);

export function isAcademicProductionType(workType: WorkTypeValue): workType is WorkType {
  return ACADEMIC_PRODUCTION_TYPES.some((type) => type.id === workType);
}

export function academicProductionTypeFor(workType: WorkTypeValue): AcademicProductionTypeDefinition | undefined {
  return ACADEMIC_PRODUCTION_TYPES.find((type) => type.id === workType);
}
