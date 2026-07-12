import type { ImportedPdfDocument, PdfDocumentBlock, PdfPageText, PdfSemanticBlock } from "./imported-pdf";
import type { AcademicFields } from "./ufla-rules";
import { emptyAcademicFields, emptyConfidenceMap } from "./ufla-rules";
import { detectPdfVisualRegionCandidates, isListOrSummaryPage } from "./pdf-region-renderer";
import { reconstructPdfSemanticBlocks, semanticBlocksToEditorText } from "./pdf-text-reconstruction";
import type { ImportedDocumentPayload } from "./import-contract";

export const PDF_DRAFT_WARNING =
  "Rascunho gerado a partir de PDF (experimental, sem OCR). Revise estrutura, tabelas, quadros, gráficos, imagens, paginação, sumário e referências antes de usar.";

export const PDF_DRAFT_STATUS_NOTE =
  "É possível gerar um rascunho experimental em DOCX. Quadros, tabelas, gráficos e figuras detectados podem ser inseridos como imagens (opcional); a formatação final exige revisão manual.";

export function pdfDraftStatusMessage(fileName: string, pageCount: number): string {
  return `PDF lido: ${fileName} (${pageCount} páginas). ${PDF_DRAFT_STATUS_NOTE}`;
}

export type PdfDraftInput = ImportedDocumentPayload;

function extractSuggestedTitle(document: ImportedPdfDocument): string {
  const heading = document.blocks.find(
    (b: PdfDocumentBlock) =>
      b.kind === "heading" &&
      b.text.trim().length >= 4 &&
      b.text.trim().length <= 140 &&
      !/LISTA DE|SUM[ÁA]RIO|ÍNDICE/i.test(b.text),
  );
  if (heading) return heading.text.trim();
  for (const page of document.pages) {
    const first = page.normalizedText
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.length > 0 && !/LISTA DE|SUM[ÁA]RIO|ÍNDICE/i.test(line));
    if (first) return first;
  }
  return "";
}

function isPreTextualPage(page: PdfPageText): boolean {
  return isListOrSummaryPage(page);
}

export function buildPdfDraftInput(
  document: ImportedPdfDocument,
  fileName: string,
  workType?: string,
  options: { pdfFile?: File | ArrayBuffer } = {},
): PdfDraftInput {
  const baseFields = emptyAcademicFields();
  if (workType) baseFields.workType = workType as AcademicFields["workType"];

  const title = extractSuggestedTitle(document);
  const regions = detectPdfVisualRegionCandidates(document);

  // Texto bruto de todas as páginas (preservado para o diagnóstico).
  const rawPageText = document.pages.map((page) => page.normalizedText).join("\n\n").trim();
  // Texto ordenado para exportação (sem pré-textuais), preservado para fallback.
  const orderedText = document.pages
    .filter((page) => !isPreTextualPage(page))
    .map((page) => page.normalizedText)
    .join("\n\n")
    .trim();

  // Blocos semânticos reconstruídos. Por padrão mantém TODAS as páginas; o
  // filtro de pré-textuais é aplicado no momento da geração (conforme a opção
  // escolhida pelo usuário), para que o rascunho possa ser reconfigurado.
  const semanticBlocks: PdfSemanticBlock[] = reconstructPdfSemanticBlocks(document, {
    includePreTextualPages: true,
  });

  const editorText =
    semanticBlocksToEditorText(semanticBlocks, regions, title) || PDF_DRAFT_WARNING;

  return {
    sourceKind: "pdf",
    documentMode: "pdf-text-draft",
    fields: baseFields,
    confidence: emptyConfidenceMap(),
    editorText: editorText.length > 0 ? editorText : PDF_DRAFT_WARNING,
    messages: [PDF_DRAFT_WARNING],
    fileName,
    rawPageText,
    orderedText,
    regionDiagnostics: regions,
    semanticBlocks,
    pdfFile: options.pdfFile,
    pdfDraftOptions: {
      includeVisuals: true,
      includePreTextualPages: false,
    },
    importMetadata: {
      pageCount: document.source.pageCount,
      fingerprint: document.source.fingerprint,
      quality: document.quality,
    },
  };
}
