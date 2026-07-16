import type { PdfPretextualDiagnostic, PdfTextReconstructionDiagnostic } from "./imported-pdf-diagnostic";

export interface PdfTextDraftLogoAsset {
  data: ArrayBuffer | Uint8Array;
  width?: number;
  height?: number;
}

export interface PdfTextDraftVisualAsset {
  data: ArrayBuffer | Uint8Array;
  width: number;
  height: number;
  altText?: { title?: string; description?: string; name?: string };
}

export interface PdfTextDraftExportInput {
  sourceKind: "pdf";
  documentMode: "pdf-text-draft";
  fileName: string;
  pageCount: number;
  pretextual?: PdfPretextualDiagnostic;
  reconstruction: PdfTextReconstructionDiagnostic;
  includeReconstructedPretextuals?: boolean;
  allowMissingPretextualFields?: boolean;
  logo?: PdfTextDraftLogoAsset;
  visualAssets?: Record<string, PdfTextDraftVisualAsset>;
}

export interface PdfTextDraftValidation {
  canExport: boolean;
  blockers: string[];
  warnings: string[];
}
