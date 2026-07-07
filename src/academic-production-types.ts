import type { AcademicFieldKey } from "./ufla-rules";

export const UFLA_ACADEMIC_PRODUCTION_TYPE_IDS = [
  "artigo_cientifico_ufla",
  "patente_ufla",
  "revisao_sistematica_ufla",
  "estudo_caso_ufla",
  "software_aplicativo_ufla",
  "cultivar_ufla",
  "relatorio_estagio_ufla",
  "proposta_intervencao_ufla",
] as const;

export type UflaAcademicProductionTypeId = (typeof UFLA_ACADEMIC_PRODUCTION_TYPE_IDS)[number];

export type AcademicProductionSupportStatus = "inicial" | "parcial";

export interface AcademicProductionTypeDefinition {
  id: UflaAcademicProductionTypeId;
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
    label: "Artigo cientÃ­fico UFLA",
    description: "TCC organizado como artigo cientÃ­fico conforme a ColeÃ§Ã£o ProduÃ§Ã£o AcadÃªmica UFLA.",
    sourceCollectionNumber: 1,
    requiredFields: [...COMMON_REQUIRED_FIELDS, "palavrasChave", "introducao"],
    optionalFields: [...COMMON_OPTIONAL_FIELDS, "metodologia", "conclusao"],
    sectionAliases: ["artigo cientifico", "artigo", "paper", "manuscrito"],
    recommendedSections: ["IntroduÃ§Ã£o", "Metodologia ou material e mÃ©todos", "Resultados e discussÃ£o", "ConclusÃ£o", "ReferÃªncias"],
    manualValidationNotes: ["Conferir guia da coleÃ§Ã£o, escopo do periÃ³dico ou curso, figuras, tabelas, citaÃ§Ãµes e referÃªncias."],
    supportStatus: "inicial",
  },
  {
    id: "patente_ufla",
    label: "Patente UFLA",
    description: "TCC em formato de patente, com descriÃ§Ã£o tÃ©cnica, estado da tÃ©cnica e reivindicaÃ§Ãµes.",
    sourceCollectionNumber: 2,
    requiredFields: [...COMMON_REQUIRED_FIELDS, "introducao", "referencialTeorico"],
    optionalFields: [...COMMON_OPTIONAL_FIELDS, "metodologia", "conclusao", "anexos"],
    sectionAliases: ["patente", "pedido de patente", "propriedade intelectual", "reivindicacoes", "reivindicaÃ§Ãµes"],
    recommendedSections: ["Campo da invenÃ§Ã£o", "Estado da tÃ©cnica", "DescriÃ§Ã£o da invenÃ§Ã£o", "ReivindicaÃ§Ãµes", "Desenhos", "ReferÃªncias"],
    manualValidationNotes: ["Conferir sigilo, titularidade, novidade, desenhos e reivindicaÃ§Ãµes com orientaÃ§Ã£o institucional especializada."],
    supportStatus: "inicial",
  },
  {
    id: "revisao_sistematica_ufla",
    label: "RevisÃ£o sistemÃ¡tica e aprofundada UFLA",
    description: "TCC baseado em revisÃ£o sistemÃ¡tica, integrativa ou aprofundada da literatura.",
    sourceCollectionNumber: 3,
    requiredFields: [...COMMON_REQUIRED_FIELDS, "palavrasChave", "objetivoGeral", "metodologia"],
    optionalFields: [...COMMON_OPTIONAL_FIELDS, "objetivosEspecificos", "referencialTeorico", "conclusao"],
    sectionAliases: ["revisao sistematica", "revisÃ£o sistemÃ¡tica", "revisao aprofundada", "revisÃ£o aprofundada", "protocolo de revisao", "PRISMA"],
    recommendedSections: ["Pergunta de pesquisa", "CritÃ©rios de inclusÃ£o e exclusÃ£o", "Bases de dados", "EstratÃ©gia de busca", "SÃ­ntese dos achados"],
    manualValidationNotes: ["Conferir protocolo, strings de busca, fluxograma, critÃ©rios de elegibilidade e quadros de extraÃ§Ã£o."],
    supportStatus: "inicial",
  },
  {
    id: "estudo_caso_ufla",
    label: "Estudo de caso ou casos mÃºltiplos UFLA",
    description: "TCC estruturado como estudo de caso Ãºnico, casos mÃºltiplos ou relato de caso.",
    sourceCollectionNumber: 4,
    requiredFields: [...COMMON_REQUIRED_FIELDS, "introducao", "metodologia"],
    optionalFields: [...COMMON_OPTIONAL_FIELDS, "referencialTeorico", "conclusao", "anexos"],
    sectionAliases: ["estudo de caso", "casos multiplos", "casos mÃºltiplos", "estudo multicaso", "relato de caso"],
    recommendedSections: ["Contexto do caso", "Unidade de anÃ¡lise", "Coleta de dados", "AnÃ¡lise de dados", "Resultados e discussÃ£o"],
    manualValidationNotes: ["Conferir delimitaÃ§Ã£o do caso, evidÃªncias, autorizaÃ§Ãµes, aspectos Ã©ticos e anexos."],
    supportStatus: "inicial",
  },
  {
    id: "software_aplicativo_ufla",
    label: "Software e aplicativos UFLA",
    description: "TCC cujo produto principal Ã© software, aplicativo ou artefato computacional documentado.",
    sourceCollectionNumber: 5,
    requiredFields: [...COMMON_REQUIRED_FIELDS, "objetivoGeral", "metodologia"],
    optionalFields: [...COMMON_OPTIONAL_FIELDS, "objetivosEspecificos", "resultadosEsperados", "anexos"],
    sectionAliases: ["software", "aplicativo", "aplicacao", "aplicaÃ§Ã£o", "sistema computacional", "desenvolvimento de software"],
    recommendedSections: ["Requisitos", "Tecnologias utilizadas", "Arquitetura", "Funcionalidades", "Testes", "Manual de uso"],
    manualValidationNotes: ["Conferir requisitos, arquitetura, telas, repositÃ³rio, instalaÃ§Ã£o, testes, seguranÃ§a e licenÃ§a."],
    supportStatus: "inicial",
  },
  {
    id: "cultivar_ufla",
    label: "Cultivar UFLA",
    description: "TCC sobre cultivar, melhoramento, caracterizaÃ§Ã£o ou desempenho agronÃ´mico.",
    sourceCollectionNumber: 6,
    requiredFields: [...COMMON_REQUIRED_FIELDS, "metodologia"],
    optionalFields: [...COMMON_OPTIONAL_FIELDS, "resultadosEsperados", "conclusao", "anexos"],
    sectionAliases: ["cultivar", "nova cultivar", "melhoramento genetico", "melhoramento genÃ©tico", "descritores agronomicos", "DHE"],
    recommendedSections: ["Origem e desenvolvimento", "CaracterÃ­sticas", "Desempenho agronÃ´mico", "RecomendaÃ§Ãµes", "ReferÃªncias"],
    manualValidationNotes: ["Conferir descritores oficiais, registros, proteÃ§Ã£o, ensaios, ambientes e tabelas agronÃ´micas."],
    supportStatus: "inicial",
  },
  {
    id: "relatorio_estagio_ufla",
    label: "RelatÃ³rio de estÃ¡gio UFLA",
    description: "Documento acadÃªmico que relata local, perÃ­odo, supervisÃ£o e atividades de estÃ¡gio.",
    sourceCollectionNumber: 7,
    requiredFields: ["author", "title", "course", "introducao", "metodologia", "conclusao"],
    optionalFields: [...COMMON_OPTIONAL_FIELDS, "referencias", "anexos"],
    // RelatÃ³rio de estÃ¡gio nÃ£o exige resumo/referÃªncias por padrÃ£o: Ã© documento descritivo da coleÃ§Ã£o UFLA, com foco em curso, introduÃ§Ã£o, metodologia e conclusÃ£o, nÃ£o estrutura de TCC/artigo.
    sectionAliases: ["relatorio de estagio", "relatÃ³rio de estÃ¡gio", "estagio supervisionado", "estÃ¡gio supervisionado", "atividades de estagio"],
    recommendedSections: ["IdentificaÃ§Ã£o", "Plano de atividades", "Atividades desenvolvidas", "Aprendizados", "ConsideraÃ§Ãµes finais"],
    manualValidationNotes: ["Conferir regras do curso, dados do local, carga horÃ¡ria, supervisor, assinaturas e anexos."],
    supportStatus: "inicial",
  },
  {
    id: "proposta_intervencao_ufla",
    label: "Proposta de intervenÃ§Ã£o UFLA",
    description: "TCC voltado a diagnÃ³stico, planejamento e intervenÃ§Ã£o em contexto clÃ­nico ou de serviÃ§o.",
    sourceCollectionNumber: 8,
    requiredFields: [...COMMON_REQUIRED_FIELDS, "justificativa", "objetivoGeral", "metodologia", "cronograma"],
    optionalFields: [...COMMON_OPTIONAL_FIELDS, "objetivosEspecificos", "resultadosEsperados", "anexos"],
    sectionAliases: ["proposta de intervencao", "proposta de intervenÃ§Ã£o", "intervencao clinica", "intervenÃ§Ã£o clÃ­nica", "procedimentos clinicos", "servico pertinente"],
    recommendedSections: ["DiagnÃ³stico situacional", "Justificativa", "Objetivos", "Plano de execuÃ§Ã£o", "Indicadores", "Resultados esperados"],
    manualValidationNotes: ["Conferir pertinÃªncia clÃ­nica ou de serviÃ§o, aspectos Ã©ticos, autorizaÃ§Ãµes, cronograma e indicadores."],
    supportStatus: "inicial",
  },
];

export const ACADEMIC_PRODUCTION_TYPE_IDS = UFLA_ACADEMIC_PRODUCTION_TYPE_IDS;

export function isAcademicProductionType(workType: string | null | undefined): workType is UflaAcademicProductionTypeId {
  return ACADEMIC_PRODUCTION_TYPES.some((type) => type.id === workType);
}

export function academicProductionTypeFor(workType: string | null | undefined): AcademicProductionTypeDefinition | undefined {
  return ACADEMIC_PRODUCTION_TYPES.find((type) => type.id === workType);
}


export const ACADEMIC_PRODUCTION_INITIAL_SUPPORT_NOTICE =
  "Formato cadastrado com suporte inicial. Revise a estrutura conforme o guia da ColeÃ§Ã£o ProduÃ§Ã£o AcadÃªmica UFLA e confira o DOCX final no Word ou LibreOffice.";

export function academicProductionTypeById(workType: string | null | undefined): AcademicProductionTypeDefinition | undefined {
  return academicProductionTypeFor(workType);
}

