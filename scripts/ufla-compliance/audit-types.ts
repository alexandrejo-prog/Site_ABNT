export type WorkType = "dissertacao" | "tese" | "artigo" | "tcc" | "relatorio" | "projeto_pesquisa" | "resumo_cpg" | "resumo_expandido_cpg";

export interface AuditGap {
  section: string;
  rule: string;
  severity: "critical" | "major" | "minor";
  description: string;
  suggestion?: string;
  autoFixable?: boolean;
}

export interface SectionAuditResult {
  passed: boolean;
  score: number;
  itemsFound: string[];
  itemsMissing: string[];
  gaps: AuditGap[];
}

export interface PretextualAuditResult extends SectionAuditResult {
  cover: SectionAuditResult;
  titlePage: SectionAuditResult;
  catalogCard: SectionAuditResult;
  approvalPage: SectionAuditResult;
  abstract: SectionAuditResult;
  lists: SectionAuditResult;
  summary: SectionAuditResult;
}

export interface TextualAuditResult extends SectionAuditResult {
  introduction: SectionAuditResult;
  chapters: SectionAuditResult;
  conclusion: SectionAuditResult;
  numbering: SectionAuditResult;
}

export interface PosttextualAuditResult extends SectionAuditResult {
  references: SectionAuditResult;
  glossary: SectionAuditResult;
  appendices: SectionAuditResult;
  annexes: SectionAuditResult;
}

export interface ReferenceValidationResult {
  raw: string;
  authors: string[];
  title: string;
  edition?: string;
  location: string;
  publisher: string;
  year: string;
  doi?: string;
  url?: string;
  valid: boolean;
  issues: string[];
}

export interface CitationValidationResult {
  raw: string;
  authors: string[];
  year: string;
  page?: string;
  valid: boolean;
  issues: string[];
}

export interface FigureValidationResult {
  type: "figura" | "quadro" | "grafico" | "mapa" | "imagem" | "ilustracao" | "tabela" | "equacao";
  number: string;
  caption: string;
  source?: string;
  valid: boolean;
  issues: string[];
}

export interface ExpandedAuditResult {
  documentType: WorkType;
  preTextual: PretextualAuditResult;
  textual: TextualAuditResult;
  postTextual: PosttextualAuditResult;
  technical: {
    footers: boolean;
    tables: boolean;
    pagination: boolean;
    equations: boolean;
    pdfPhysical: boolean;
    coverLayout: boolean;
    references: boolean;
    citations: boolean;
    figures: boolean;
    sections: boolean;
    omml: boolean;
    citationsValidator: boolean;
    referencesValidator: boolean;
    sectionsValidator: boolean;
    figuresValidator: boolean;
    tablesValidator: boolean;
  };
  gaps: AuditGap[];
  score: number;
  compliant: boolean;
}
