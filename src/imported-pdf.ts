export type PdfImportSource = {
  fileName: string;
  pageCount: number;
  fingerprint?: string;
};

export type PdfTextItem = {
  text: string;
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  fontName?: string;
};

export type PdfPageText = {
  pageNumber: number;
  width: number;
  height: number;
  items: PdfTextItem[];
  normalizedText: string;
};

export type PdfBlockKind =
  | "text"
  | "heading"
  | "caption"
  | "source"
  | "table-candidate"
  | "image-candidate"
  | "unknown";

export type PdfDocumentBlock = {
  id: string;
  kind: PdfBlockKind;
  pageNumber: number;
  text: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  confidence: "high" | "medium" | "low";
  warnings?: string[];
};

export type PdfImportDiagnostic = {
  severity: "info" | "warning" | "error";
  code: string;
  message: string;
  pageNumber?: number;
};

export type ImportedPdfDocument = {
  source: PdfImportSource;
  pages: PdfPageText[];
  blocks: PdfDocumentBlock[];
  diagnostics: PdfImportDiagnostic[];
  quality: {
    textConfidence: "high" | "medium" | "low";
    layoutConfidence: "high" | "medium" | "low";
    requiresManualReview: boolean;
  };
};
