export interface PdfTextItemDiagnostic {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontName?: string;
  hasEol?: boolean;
  transform?: readonly number[];
}

export interface PdfLineDiagnostic {
  pageNumber: number;
  text: string;
  items: PdfTextItemDiagnostic[];
  left: number;
  right: number;
  top: number;
  bottom: number;
  height: number;
}

export interface PdfBodyStartDiagnostic {
  found: boolean;
  pageNumber?: number;
  lineIndex?: number;
  text?: string;
  matchType?: "numbered-introduction" | "unnumbered-introduction";
  reason?: string;
}

export type PdfLineRole =
  | "body"
  | "heading"
  | "list-item"
  | "caption"
  | "source"
  | "page-number"
  | "repeated-header"
  | "repeated-footer"
  | "layout-sensitive";

export interface PdfReconstructedBlockDiagnostic {
  type: "paragraph" | "heading" | "list-item" | "caption" | "source" | "unresolved";
  text: string;
  pageStart: number;
  pageEnd: number;
  sourceLines: Array<{
    pageNumber: number;
    lineIndex: number;
  }>;
  confidence: "high" | "medium" | "low";
  reasons: string[];
  layoutRegionId?: string;
}

export interface PdfBodyLayoutMetrics {
  dominantLeft: number;
  dominantRight: number;
  medianLineHeight: number;
  medianLineGap: number;
  probableFirstLineIndent: number;
  probableBodyFontHeight: number;
  confidence: "high" | "medium" | "low";
}

export interface PdfLayoutSensitiveRegionDiagnostic {
  id: string;
  pageStart: number;
  pageEnd: number;
  startLineIndex: number;
  endLineIndex: number;
  kind: "quadro" | "tabela" | "figura" | "grafico" | "multicolumn" | "unknown";
  caption?: string;
  source?: string;
  confidence: "high" | "medium" | "low";
  reasons: string[];
  logicalVisualId?: string;
}

export interface PdfHyphenationDiagnostic {
  pageNumber: number;
  lineIndex: number;
  originalEnd: string;
  nextStart: string;
  action: "joined-without-hyphen" | "preserved-hyphen" | "uncertain";
  reason: string;
}

export interface PdfTextReconstructionDiagnostic {
  blocks: PdfReconstructedBlockDiagnostic[];
  ignoredLines: Array<{
    pageNumber: number;
    lineIndex: number;
    role: PdfLineRole;
    text: string;
  }>;
  bodyStart: PdfBodyStartDiagnostic;
  bodyLayoutMetrics: PdfBodyLayoutMetrics;
  layoutRegions: PdfLayoutSensitiveRegionDiagnostic[];
  hyphenation: PdfHyphenationDiagnostic[];
  alerts: string[];
  statistics: {
    paragraphCount: number;
    headingCount: number;
    listItemCount: number;
    captionCount: number;
    sourceCount: number;
    unresolvedCount: number;
    removedPageNumberCount: number;
    removedHeaderCount: number;
    removedFooterCount: number;
    averageLinesPerParagraph: number;
    medianLinesPerParagraph: number;
    singleLineParagraphCount: number;
    multiPageParagraphCount: number;
    lowConfidenceBlockCount: number;
    uncertainHyphenationCount: number;
    layoutRegionCount: number;
    mixedCaseHeadingCount: number;
    combinedHeadingCount: number;
  };
}

export type PdfPageDiagnostic = {
  pageNumber: number;
  width: number;
  height: number;
  rotation: number;
  rawText: string;
  textItemCount: number;
  items: PdfTextItemDiagnostic[];
  lines: PdfLineDiagnostic[];
};

export type ImportedPdfDiagnostic = {
  fileName: string;
  pageCount: number;
  pages: PdfPageDiagnostic[];
  bodyStart: PdfBodyStartDiagnostic;
  reconstruction: PdfTextReconstructionDiagnostic;
  warnings: string[];
};
