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
