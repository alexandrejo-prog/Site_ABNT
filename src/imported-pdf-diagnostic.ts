export type PdfPageDiagnostic = {
  pageNumber: number;
  rawText: string;
  textItemCount: number;
};

export type ImportedPdfDiagnostic = {
  fileName: string;
  pageCount: number;
  pages: PdfPageDiagnostic[];
  warnings: string[];
};
