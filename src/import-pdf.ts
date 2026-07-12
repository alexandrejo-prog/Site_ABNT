import type {
  ImportedPdfDocument,
  PdfPageText,
  PdfTextItem,
  PdfDocumentBlock,
  PdfImportDiagnostic,
  PdfImportSource,
} from "./imported-pdf";
import { groupPdfTextIntoLines, buildPageNormalizedText, detectPdfBlockCandidates, normalizePdfTextItems } from "./import-pdf-text";

// PDF.js é carregado dinamicamente (lazy) para que os testes de funções puras
// não precisem inicializar o motor de PDF no ambiente Node/jsdom.
export async function loadPdfJs(): Promise<typeof import("pdfjs-dist") & { GlobalWorkerOptions: { workerSrc?: string } }> {
  const pdfjsLib = (await import("pdfjs-dist")) as unknown as typeof import("pdfjs-dist") & {
    GlobalWorkerOptions: { workerSrc?: string };
  };
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    // No Vite, o sufixo `?url` é resolvido para a URL do worker em tempo de build.
    // Em ambiente de teste (Node) esse trecho não é executado porque importPdfDocument
    // não é chamado nos testes de funções puras.
    const workerModule = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerModule.default;
  }
  return pdfjsLib;
}

export async function importPdfDocument(
  file: File | ArrayBuffer,
  fileName?: string,
): Promise<ImportedPdfDocument> {
  const pdfjsLib = await loadPdfJs();

  const data = file instanceof ArrayBuffer ? file : await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data }).promise;
  const pageCount = doc.numPages;
  const fingerprints = (doc as unknown as { fingerprints?: string[]; fingerprint?: string }).fingerprints;
  const fingerprint = Array.isArray(fingerprints)
    ? fingerprints[0]
    : (doc as unknown as { fingerprint?: string }).fingerprint;

  const pages: PdfPageText[] = [];
  const diagnostics: PdfImportDiagnostic[] = [];
  const allBlocks: PdfDocumentBlock[] = [];

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const rawItems = content.items as Array<{
      str?: unknown;
      transform: number[];
      width?: number;
      height?: number;
      fontName?: string;
    }>;
    const items: PdfTextItem[] = rawItems
      .filter((it) => typeof it.str === "string")
      .map((it) => {
        const transform = it.transform;
        return {
          text: it.str as string,
          pageNumber,
          x: transform[4] ?? 0,
          y: transform[5] ?? 0,
          width: it.width ?? 0,
          height: it.height ?? 0,
          fontName: it.fontName,
        };
      });

    pages.push({
      pageNumber,
      width: viewport.width,
      height: viewport.height,
      items: normalizePdfTextItems(items),
      normalizedText: buildPageNormalizedText(items),
    });

    const lines = groupPdfTextIntoLines(items);
    allBlocks.push(...detectPdfBlockCandidates(lines));
  }

  const totalItems = pages.reduce((sum, p) => sum + p.items.length, 0);
  const visualBlocks = allBlocks.filter(
    (b) => b.kind === "table-candidate" || b.kind === "image-candidate",
  ).length;

  const textConfidence: ImportedPdfDocument["quality"]["textConfidence"] = totalItems > 0 ? "high" : "low";
  const layoutConfidence: ImportedPdfDocument["quality"]["layoutConfidence"] =
    visualBlocks > 0 ? "low" : "medium";
  const requiresManualReview = visualBlocks > 0 || textConfidence === "low";

  diagnostics.push({
    severity: "info",
    code: "pdf-import-experimental",
    message:
      "Importação de PDF é experimental e não usa OCR. Tabelas, quadros e figuras podem exigir revisão manual.",
  });
  if (requiresManualReview) {
    diagnostics.push({
      severity: "warning",
      code: "pdf-requires-manual-review",
      message:
        "A estrutura visual do PDF não foi totalmente compreendida automaticamente. Revise tabelas, quadros e figuras antes de gerar o DOCX.",
    });
  }

  const source: PdfImportSource = {
    fileName: fileName ?? (file instanceof File ? file.name : "documento.pdf"),
    pageCount,
    fingerprint,
  };

  return {
    source,
    pages,
    blocks: allBlocks,
    diagnostics,
    quality: { textConfidence, layoutConfidence, requiresManualReview },
  };
}
