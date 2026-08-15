export interface DocxAnalysis {
  page: {
    widthTwip: number;
    heightTwip: number;
    marginTopCm: number;
    marginBottomCm: number;
    marginLeftCm: number;
    marginRightCm: number;
  };
  header: {
    marginTopCm: number;
    hasPageNumber: boolean;
    pageNumberAlign: string;
  };
  fonts: {
    defaultFont: string;
    defaultSize: number;
    fontConsistency: { font: string; count: number }[];
  };
  spacing: {
    bodyLine: number;
    bodyAfter: number;
    bodyBefore: number;
    bodyJustified: boolean;
    firstLineIndent: boolean;
  };
  titles: {
    primaryCount: number;
    secondaryCount: number;
    primaryBold: boolean;
    primaryStartNewPage: boolean;
    primaryFormat: string;
    maxDepth: number;
  };
  references: {
    headingCount: number;
    headingBold: boolean;
    headingCentered: boolean;
    entryCount: number;
    entriesAlignedLeft: boolean;
    entriesSingleSpaced: boolean;
    entriesHangingIndent: boolean;
    entriesBoldTitle: boolean;
    sortedCorrectly: boolean;
    entries: string[];
    duplicateHeadings: boolean;
    duplicateEntries: boolean;
    duplicateClusters: { cluster: string[]; occurrences: number }[];
  };
  tables: {
    count: number;
    hasBorders: boolean;
    hasAboveTitle: boolean;
    hasBelowSource: boolean;
    tableDetails: {
      rows: number;
      cols: number;
      hasBorders: boolean;
    }[];
  };
  images: {
    count: number;
  };
  cover: {
    exists: boolean;
    hasLogo: boolean;
    authorCentered: boolean;
    authorUppercase: boolean;
    authorBold: boolean;
    authorSize: number;
    titleCentered: boolean;
    titleUppercase: boolean;
    titleBold: boolean;
    titleSize: number;
    location: string;
    locationUppercase: boolean;
    locationBold: boolean;
    locationSize: number;
    yearBold: boolean;
    yearSize: number;
    logoWidthCm: number;
    logoHeightCm: number;
    logoSizeValid: boolean;
    pageNumberVisible: boolean;
  };
  catalogCard: {
    exists: boolean;
    hasPlaceholder: boolean;
  };
  titlePage: {
    exists: boolean;
    hasNature: boolean;
    natureText: string;
    hasCourse: boolean;
    hasProgram: boolean;
    hasAdvisor: boolean;
    hasCoadvisor: boolean;
    hasEnglishTitle: boolean;
    englishTitleText: string;
  };
  toc: {
    exists: boolean;
    hasFieldCode: boolean;
    hasFieldChars: boolean;
    hasCorrectRange: boolean;
    hasHyperlinkFlag: boolean;
    headingStyleRange: string;
    hyperlink: boolean;
  };
  pagination: {
    visibleStartsAtIntroduction: boolean;
    usesArabicNumerals: boolean;
    usesWordField: boolean;
    coverNotCounted: boolean;
    preTextualNotVisible: boolean;
  };
  summary: {
    exists: boolean;
    headingCentered: boolean;
    headingUppercase: boolean;
    headingBold: boolean;
    hasTocEntries: boolean;
    includesReferences: boolean;
    includesAppendices: boolean;
    includesAnnexes: boolean;
    tocIncludesAppendices: boolean;
    tocIncludesAnnexes: boolean;
    excludesCover: boolean;
    excludesPreTextual: boolean;
  };
  resumo: {
    titleCentered: boolean;
  };
  equations: {
    count: number;
    hasCenteredWithRightNumber: boolean;
  };
  footnotes: {
    count: number;
    fontSizePt: number;
    smallerThanBody: boolean;
    singleSpaced: boolean;
    timesNewRoman: boolean;
    hasDefinitions: boolean;
  };
  colors: {
    hasBlueInBody: boolean;
    hasBlueInReferences: boolean;
    hasBlueInResumo: boolean;
    hasBlueInAbstract: boolean;
  };
  paragraphCount: number;
  totalCharacters: number;
}

export interface ChecklistItem {
  id: string;
  section: string;
  description: string;
  status: "ok" | "fail" | "partial" | "unchecked";
  severity: "grave" | "medio" | "baixo";
  location: string;
  suggestion: string;
  fixType: "code" | "manual" | "none";
  fixFile?: string;
  fixLine?: number;
  fixInstruction?: string;
}

export interface ComplianceReport {
  timestamp: string;
  fileAnalyzed: string;
  analysis: DocxAnalysis;
  items: ChecklistItem[];
  summary: {
    total: number;
    ok: number;
    fail: number;
    partial: number;
    unchecked: number;
    grave: number;
    medio: number;
    baixo: number;
  };
  passed: boolean;
}

export interface FixSuggestion {
  itemId: string;
  description: string;
  severity: string;
  fixType: "code" | "manual";
  codeFile?: string;
  codeLine?: number;
  codeSnippet?: string;
  manualSteps: string[];
}
