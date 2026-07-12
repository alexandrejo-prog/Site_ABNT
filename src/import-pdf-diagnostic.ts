import type { ImportedPdfDiagnostic, PdfPageDiagnostic } from "./imported-pdf-diagnostic";

type PdfJsModule = typeof import("pdfjs-dist");

async function loadPdfJs(): Promise<PdfJsModule & { GlobalWorkerOptions: { workerSrc?: string } }> {
  const isBrowser = typeof window !== "undefined" && typeof document !== "undefined";
  if (!isBrowser) {
    return (await import("pdfjs-dist/legacy/build/pdf.mjs")) as PdfJsModule & {
      GlobalWorkerOptions: { workerSrc?: string };
    };
  }

  const pdfjs = (await import("pdfjs-dist")) as PdfJsModule & {
    GlobalWorkerOptions: { workerSrc?: string };
  };
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  }
  return pdfjs;
}

function normalizeRawText(parts: string[]): string {
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

export async function importPdfDiagnostic(file: File): Promise<ImportedPdfDiagnostic> {
  const warnings = [
    "O PDF foi lido para diagnóstico. A conversão para DOCX ainda não está habilitada nesta etapa.",
  ];

  try {
    const pdfjs = await loadPdfJs();
    const data = await file.arrayBuffer();
    const documentTask = pdfjs.getDocument({
      data,
      ...(typeof window === "undefined" ? ({ disableWorker: true } as Record<string, unknown>) : {}),
    });
    const pdf = await documentTask.promise;
    const pages: PdfPageDiagnostic[] = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const textItems = content.items
        .map((item) => ("str" in item && typeof item.str === "string" ? item.str : ""))
        .filter(Boolean);
      pages.push({
        pageNumber,
        rawText: normalizeRawText(textItems),
        textItemCount: textItems.length,
      });
    }

    if (!pages.some((page) => page.rawText.trim())) {
      warnings.push("Nenhum texto bruto extraível foi encontrado. O PDF pode estar digitalizado, protegido ou exigir OCR, que não é usado nesta etapa.");
    }

    return {
      fileName: file.name,
      pageCount: pdf.numPages,
      pages,
      warnings,
    };
  } catch {
    throw new Error("Não foi possível ler o PDF. O arquivo pode estar inválido, protegido, corrompido ou ilegível sem OCR.");
  }
}
