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
  warnings: string[];
};
