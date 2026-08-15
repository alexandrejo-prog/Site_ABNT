export type DocumentType = "dissertacao" | "tese" | "artigo" | "tcc" | "monografia" | "resumo_cpg" | "resumo_expandido_cpg" | "artigo_completo_cpg" | "projeto_pesquisa" | "outro";

export type DocumentSection = "pre-textual" | "textual" | "post-textual" | "technical";

export type Severity = "critical" | "major" | "minor" | "info" | "not-applicable";

export type RequirementStatus = "passed" | "failed" | "manual-required" | "not-applicable" | "blocked";

export interface DocumentRequirement {
  id: string;
  documentTypes: DocumentType[];
  section: DocumentSection;
  required: boolean | ((context: DocumentContext) => boolean);
  validator: string;
  source: string;
  severity: Severity;
  description: string;
}

export interface DocumentContext {
  documentType: DocumentType;
  paragraphs: string[];
  styles: string[];
  bookmarks: string[];
  hasTocField: boolean;
  hasCatalogCard: boolean;
  hasApprovalPage: boolean;
  hasAbstract: boolean;
  hasResumo: boolean;
  hasReferences: boolean;
  hasGlossary: boolean;
  hasAppendices: boolean;
  hasAnnexes: boolean;
  tableCount: number;
  figureCount: number;
  equationCount: number;
  sectionCount: number;
  headingCount: number;
}

export const DOCUMENT_TYPE_MATRIX: DocumentRequirement[] = [
  {
    id: "REQ-001",
    documentTypes: ["dissertacao", "tese", "monografia", "tcc", "outro"],
    section: "pre-textual",
    required: true,
    validator: "validateCover",
    source: "Manual UFLA §3.1.1",
    severity: "critical",
    description: "Capa com identificação UFLA, título, autor, natureza, curso/programa, local e ano.",
  },
  {
    id: "REQ-002",
    documentTypes: ["dissertacao", "tese", "monografia", "tcc", "outro"],
    section: "pre-textual",
    required: true,
    validator: "validateTitlePage",
    source: "Manual UFLA §3.1.2",
    severity: "critical",
    description: "Folha de rosto com título, autor, orientador, coorientador (se houver), natureza, curso/programa, local e ano.",
  },
  {
    id: "REQ-003",
    documentTypes: ["dissertacao", "tese", "monografia"],
    section: "pre-textual",
    required: true,
    validator: "validateCatalogCard",
    source: "Manual UFLA §3.1.3",
    severity: "major",
    description: "Ficha catalográfica completa com campos obrigatórios.",
  },
  {
    id: "REQ-004",
    documentTypes: ["dissertacao", "tese", "monografia", "tcc", "outro"],
    section: "pre-textual",
    required: true,
    validator: "validateApprovalPage",
    source: "Manual UFLA §3.1.4",
    severity: "major",
    description: "Folha de aprovação com título, autor, natureza, curso/programa, orientador, local, ano e assinaturas.",
  },
  {
    id: "REQ-005",
    documentTypes: ["dissertacao", "tese", "monografia", "tcc", "projeto_pesquisa", "outro"],
    section: "pre-textual",
    required: true,
    validator: "validateResumo",
    source: "Manual UFLA §3.1.5",
    severity: "critical",
    description: "Resumo em português (150–500 palavras) + palavras-chave.",
  },
  {
    id: "REQ-006",
    documentTypes: ["dissertacao", "tese", "monografia", "tcc", "projeto_pesquisa", "outro"],
    section: "pre-textual",
    required: true,
    validator: "validateAbstract",
    source: "Manual UFLA §3.1.6",
    severity: "critical",
    description: "Abstract correspondente em inglês + keywords.",
  },
  {
    id: "REQ-007",
    documentTypes: ["dissertacao", "tese", "monografia", "outro"],
    section: "pre-textual",
    required: true,
    validator: "validateToc",
    source: "Manual UFLA §3.1.7",
    severity: "critical",
    description: "Sumário com TOC real (PAGEREF atualizado pelo Word).",
  },
  {
    id: "REQ-008",
    documentTypes: ["artigo", "resumo_cpg", "resumo_expandido_cpg", "artigo_completo_cpg"],
    section: "pre-textual",
    required: false,
    validator: "validateToc",
    source: "Manual UFLA §3.1.7",
    severity: "not-applicable",
    description: "Sumário não exigido para artigo/CPG.",
  },
  {
    id: "REQ-009",
    documentTypes: ["dissertacao", "tese", "monografia", "tcc", "projeto_pesquisa", "outro"],
    section: "pre-textual",
    required: false,
    validator: "validateListOfIllustrations",
    source: "Manual UFLA §3.2.10",
    severity: "minor",
    description: "Lista de ilustrações quando houver figuras/quadros.",
  },
  {
    id: "REQ-010",
    documentTypes: ["dissertacao", "tese", "monografia", "tcc", "projeto_pesquisa", "outro"],
    section: "pre-textual",
    required: false,
    validator: "validateListOfTables",
    source: "Manual UFLA §3.2.11",
    severity: "minor",
    description: "Lista de tabelas quando houver tabelas.",
  },
  {
    id: "REQ-011",
    documentTypes: ["dissertacao", "tese", "monografia", "tcc", "projeto_pesquisa", "outro"],
    section: "textual",
    required: true,
    validator: "validateIntroduction",
    source: "Manual UFLA §3.1",
    severity: "critical",
    description: "Introdução como primeira seção textual.",
  },
  {
    id: "REQ-012",
    documentTypes: ["dissertacao", "tese", "monografia", "tcc", "projeto_pesquisa", "outro"],
    section: "textual",
    required: true,
    validator: "validateDevelopment",
    source: "Manual UFLA §3.1",
    severity: "critical",
    description: "Desenvolvimento/capítulos textuais.",
  },
  {
    id: "REQ-013",
    documentTypes: ["dissertacao", "tese", "monografia", "tcc", "projeto_pesquisa", "outro"],
    section: "textual",
    required: true,
    validator: "validateConclusion",
    source: "Manual UFLA §3.1",
    severity: "major",
    description: "Conclusão como última seção textual.",
  },
  {
    id: "REQ-014",
    documentTypes: ["dissertacao", "tese", "monografia", "tcc", "projeto_pesquisa", "outro"],
    section: "post-textual",
    required: true,
    validator: "validateReferences",
    source: "Manual UFLA §3.1.13",
    severity: "critical",
    description: "Referências bibliográficas em ordem alfabética pt-BR.",
  },
  {
    id: "REQ-015",
    documentTypes: ["dissertacao", "tese", "monografia", "tcc", "projeto_pesquisa", "outro"],
    section: "post-textual",
    required: false,
    validator: "validateGlossary",
    source: "Manual UFLA §3.1.15",
    severity: "minor",
    description: "Glossário quando aplicável.",
  },
  {
    id: "REQ-016",
    documentTypes: ["dissertacao", "tese", "monografia", "tcc", "projeto_pesquisa", "outro"],
    section: "post-textual",
    required: false,
    validator: "validateAppendices",
    source: "Manual UFLA §3.1.14",
    severity: "minor",
    description: "Apêndices quando houver material complementar.",
  },
  {
    id: "REQ-017",
    documentTypes: ["dissertacao", "tese", "monografia", "tcc", "projeto_pesquisa", "outro"],
    section: "post-textual",
    required: false,
    validator: "validateAnnexes",
    source: "Manual UFLA §3.1.14",
    severity: "minor",
    description: "Anexos quando houver documentos complementares.",
  },
  {
    id: "REQ-018",
    documentTypes: ["dissertacao", "tese", "monografia", "tcc", "projeto_pesquisa", "outro"],
    section: "technical",
    required: true,
    validator: "validatePageLayout",
    source: "Manual UFLA §3.1.8",
    severity: "critical",
    description: "Margens A4: superior 3 cm, esquerda 3 cm, inferior 2 cm, direita 2 cm.",
  },
  {
    id: "REQ-019",
    documentTypes: ["dissertacao", "tese", "monografia", "tcc", "projeto_pesquisa", "outro"],
    section: "technical",
    required: true,
    validator: "validateTypography",
    source: "Manual UFLA §3.1.9",
    severity: "critical",
    description: "Fonte Times New Roman, preta, 12 pt corpo geral, 11 pt citação longa/legendas/fontes, 10 pt paginação.",
  },
  {
    id: "REQ-020",
    documentTypes: ["dissertacao", "tese", "monografia", "tcc", "projeto_pesquisa", "outro"],
    section: "technical",
    required: true,
    validator: "validateSpacing",
    source: "Manual UFLA §3.1.10",
    severity: "critical",
    description: "Espaçamento 1,5 no corpo de texto corrido; espaço simples em citações, notas, referências, resumo, abstract, legendas.",
  },
];
