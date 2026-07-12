import type { ImportedPdfDocument } from "./imported-pdf";
import type { AcademicFields } from "./ufla-rules";
import { emptyAcademicFields, emptyConfidenceMap } from "./ufla-rules";

export const PDF_DRAFT_WARNING =
  "Rascunho gerado a partir de PDF. Revise estrutura, tabelas, quadros, gráficos, imagens, paginação, sumário e referências.";

export const PDF_DRAFT_STATUS_NOTE =
  "É possível gerar um rascunho textual experimental em DOCX, mas quadros, tabelas, gráficos e imagens exigem revisão manual. Os recortes visuais detectados ainda não são inseridos automaticamente no DOCX.";

export function pdfDraftStatusMessage(fileName: string, pageCount: number): string {
  return `PDF lido: ${fileName} (${pageCount} páginas). ${PDF_DRAFT_STATUS_NOTE}`;
}

export type PdfDraftInput = {
  fields: AcademicFields;
  confidence: ReturnType<typeof emptyConfidenceMap>;
  editorText: string;
  messages: string[];
  fileName: string;
};

export function buildPdfDraftInput(
  document: ImportedPdfDocument,
  fileName: string,
  workType?: string,
): PdfDraftInput {
  const pdfText = document.pages.map((page) => page.normalizedText).join("\n\n");
  const baseFields = emptyAcademicFields();
  if (workType) baseFields.workType = workType as AcademicFields["workType"];

  const editorText =
    pdfText.trim().length > 0 ? `${PDF_DRAFT_WARNING}\n\n${pdfText}` : PDF_DRAFT_WARNING;

  return {
    fields: baseFields,
    confidence: emptyConfidenceMap(),
    editorText,
    messages: [PDF_DRAFT_WARNING],
    fileName,
  };
}
