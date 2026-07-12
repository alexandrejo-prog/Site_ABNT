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

// Caixa delimitadora em pontos (espaço de coordenadas do PDF: origem no canto
// inferior esquerdo, eixo y crescente para cima). Usada para posicionar linhas
// e regiões visuais dentro da página.
export interface PdfBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ----- Modelo semântico de reconstrução de texto de PDF ---------------------

export type PdfSemanticBlockKind =
  | "paragraph"
  | "heading"
  | "list-item"
  | "caption"
  | "source"
  | "visual"
  | "review-note";

export interface PdfSemanticBlockBase {
  id: string;
  kind: PdfSemanticBlockKind;
  pageNumber: number;
  // Coordenada vertical (topo) em pontos — usada para ordenação e diagnóstico.
  y: number;
  text: string;
  lines: import("./import-pdf-text").PdfTextLine[];
  confidence: "high" | "medium" | "low";
  warnings?: string[];
}

export interface PdfParagraphBlock extends PdfSemanticBlockBase {
  kind: "paragraph";
}

export interface PdfHeadingBlock extends PdfSemanticBlockBase {
  kind: "heading";
  level: number;
}

export interface PdfListItemBlock extends PdfSemanticBlockBase {
  kind: "list-item";
  marker: string;
}

export interface PdfCaptionBlock extends PdfSemanticBlockBase {
  kind: "caption";
}

export interface PdfSourceBlock extends PdfSemanticBlockBase {
  kind: "source";
}

export interface PdfVisualBlock extends PdfSemanticBlockBase {
  kind: "visual";
  visualRegion: PdfRegion;
}

export interface PdfReviewNoteBlock extends PdfSemanticBlockBase {
  kind: "review-note";
  note: string;
}

export type PdfSemanticBlock =
  | PdfParagraphBlock
  | PdfHeadingBlock
  | PdfListItemBlock
  | PdfCaptionBlock
  | PdfSourceBlock
  | PdfVisualBlock
  | PdfReviewNoteBlock;

export interface PdfReconstructionOptions {
  // Quando false (padrão), descarta blocos anteriores ao primeiro título de
  // seção de nível 1 (ex.: "1 INTRODUÇÃO"). Quando true, mantém todo o texto,
  // incluindo páginas pré-textuais.
  includePreTextualPages?: boolean;
}
