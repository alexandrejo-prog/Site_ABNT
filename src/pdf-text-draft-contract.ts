import type { PdfPretextualDiagnostic, PdfTextReconstructionDiagnostic } from "./imported-pdf-diagnostic";

export interface PdfTextDraftLogoAsset {
  data: ArrayBuffer | Uint8Array;
  width?: number;
  height?: number;
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
}

export interface PdfTextDraftValidation {
  canExport: boolean;
  blockers: string[];
  warnings: string[];
}
