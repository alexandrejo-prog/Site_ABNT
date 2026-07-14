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

export type PdfRegionKind = "table-visual" | "chart-visual" | "figure-visual";

export type PdfRegion = {
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  kind: PdfRegionKind;
  caption: string;
  source?: string;
  confidence: "high" | "medium" | "low";
  warnings?: string[];
};

export type RenderedPdfRegion = {
  pageNumber: number;
  region: PdfRegion;
  mimeType: "image/png";
  dataUrl: string;
  widthPx: number;
  heightPx: number;
};

export type PdfRegionCropRect = {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
};
