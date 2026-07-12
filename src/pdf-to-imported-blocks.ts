import type { ImportedPdfDocument, PdfDocumentBlock } from "./imported-pdf";
import type { AcademicFields } from "./ufla-rules";
import { emptyAcademicFields, emptyConfidenceMap } from "./ufla-rules";
import { detectPdfVisualRegionCandidates } from "./pdf-region-renderer";

export const PDF_DRAFT_WARNING =
  "Rascunho gerado a partir de PDF (experimental, sem OCR). Revise estrutura, tabelas, quadros, gráficos, imagens, paginação, sumário e referências antes de usar.";

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

export function buildPdfDraftInput(
  document: ImportedPdfDocument,
  fileName: string,
  workType?: string,
): PdfDraftInput {
  const baseFields = emptyAcademicFields();
  if (workType) baseFields.workType = workType as AcademicFields["workType"];

  const title = extractSuggestedTitle(document);
  const regions = detectPdfVisualRegionCandidates(document);
  const pdfText = document.pages.map((page) => page.normalizedText).join("\n\n").trim();

  const bodyLines: string[] = [PDF_DRAFT_WARNING];
  if (title) {
    bodyLines.push("", `Título sugerido (verificar na capa): ${title}`);
  }
  bodyLines.push("", "Texto extraído do PDF (revisar e reorganizar):", "");
  bodyLines.push(pdfText || "(sem texto extraível)");

  if (regions.length > 0) {
    bodyLines.push(
      "",
      "Elementos visuais detectados (revisão manual — não inseridos no DOCX):",
    );
    for (const region of regions) {
      const source = region.source ? ` — ${region.source}` : "";
      bodyLines.push(`- p.${region.pageNumber} | ${region.caption ?? region.kind}${source}`);
    }
  }

  const editorText = bodyLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();

  return {
    fields: baseFields,
    confidence: emptyConfidenceMap(),
    editorText: editorText.length > 0 ? editorText : PDF_DRAFT_WARNING,
    messages: [PDF_DRAFT_WARNING],
    fileName,
  };
}
