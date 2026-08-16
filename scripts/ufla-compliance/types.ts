export interface ComplianceIssue {
  code: string;
  message: string;
  severity: "error" | "warning" | "info";
  rule: string;
  item?: string;
  position?: number;
  action?: string;
}

export interface ReferenceRuleIssue extends ComplianceIssue {
  reference?: string;
  position?: number;
}

export interface PhysicalPageInfo {
  index: number;
  pageNumber: number;
  charCount: number;
  blank: boolean;
  images: number;
  hasHeaderNumber: boolean;
  headerNumberText: string;
  firstLine: string;
  headingsHit: string[];
}

export interface PhysicalAnalysis {
  totalPages: number;
  introPhysicalPage: number | null;
  introPrintedNumber: number | null;
  referencesPhysicalPage: number | null;
  summaryPhysicalPage: number | null;
  coverPhysicalPage: number | null;
  abstractPhysicalPage: number | null;
  blankPages: number[];
  pages: PhysicalPageInfo[];
  hasHeaderPageNumbers: boolean;
  pageSizePt: { width: number; height: number };
  issues: ComplianceIssue[];
}

export interface RenderedManifest {
  approved: boolean;
  openedByRepair: boolean;
  openedReadOnly: boolean;
  pagesBeforeFields: number | null;
  pagesAfterFields: number | null;
  pagesAfterToc: number | null;
  pdfExported: boolean;
  pdfSizeBytes: number | null;
  wordVersion: string | null;
  metrics?: {
    paragraphs?: number;
    tables?: number;
    sections?: number;
    inlineShapes?: number;
    pageWidth?: number;
    pageHeight?: number;
    leftMargin?: number;
    rightMargin?: number;
    topMargin?: number;
    bottomMargin?: number;
    [key: string]: unknown;
  };
  warnings: string[];
  failures: { code: string; message: string }[];
  exitCode: number;
}

export interface DocumentCompliance {
  path: string;
  workType: string;
  ooxmlIssues: ComplianceIssue[];
  ooxmlErrorCount: number;
  ooxmlWarningCount: number;
  rendered: RenderedManifest | null;
  physical: PhysicalAnalysis | null;
  pdfPath: string | null;
}

export interface DiffMatrixEntry {
  property: string;
  reference: string;
  generated: string;
  equal: boolean;
  allowed: boolean;
}

export interface ComplianceGateReport {
  timestamp: string;
  gate: string;
  command: string;
  workType: string;
  fixture: string;
  version: {
    node: string;
    renderer: string | null;
    rendererVersion: string | null;
    python: string | null;
  };
  preGenerationValidation: {
    issueCount: number;
    errors: ComplianceIssue[];
    warnings: ComplianceIssue[];
    passedBlockingCheck: boolean;
  };
  referenceRules: ReferenceRuleIssue[];
  referenceRuleErrors: number;
  referenceRuleWarnings: number;
  generated: DocumentCompliance;
  reference: DocumentCompliance | null;
  diffMatrix: DiffMatrixEntry[];
  blockers: ComplianceIssue[];
  criticalFailures: number;
  status: "CONFORME" | "DOCX GERADO; CONFORMIDADE UFLA AINDA NÃO COMPROVADA" | "SUÍTE UNITÁRIA VERDE; GATE DE CONFORMIDADE REPROVADO";
  artifacts: {
    docx: string;
    pdf: string;
    reportJson: string;
    reportMd: string;
    renderedPages: string;
    referencePdf: string;
  };
}