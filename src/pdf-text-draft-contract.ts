import type { PdfTextReconstructionDiagnostic } from "./imported-pdf-diagnostic";

export interface PdfTextDraftExportInput {
  sourceKind: "pdf";
  documentMode: "pdf-text-draft";
  fileName: string;
  pageCount: number;
  reconstruction: PdfTextReconstructionDiagnostic;
}

export interface PdfTextDraftValidation {
  canExport: boolean;
  blockers: string[];
  warnings: string[];
}
