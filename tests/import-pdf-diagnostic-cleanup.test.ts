import { describe, expect, it, vi } from "vitest";
import { importPdfDiagnostic } from "../src/import-pdf-diagnostic";

interface MockDocOptions {
  pageCount?: number;
  getPageError?: Error;
  destroyError?: Error;
}

function makeDoc(options: MockDocOptions = {}) {
  const destroy = vi.fn(async () => {
    if (options.destroyError) throw options.destroyError;
  });
  const getPage = vi.fn(async () => {
    if (options.getPageError) throw options.getPageError;
    return {
      getViewport: () => ({ width: 1000, height: 1000, rotation: 0, transform: [1, 0, 0, 1, 0, 0] }),
      getTextContent: async () => ({ items: [] }),
    };
  });
  return {
    numPages: options.pageCount ?? 1,
    getPage,
    destroy,
  };
}

const getDocumentMock = vi.hoisted(() => vi.fn());

vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => ({
  getDocument: getDocumentMock,
}));

function mockDoc(options: MockDocOptions = {}) {
  const doc = makeDoc(options);
  getDocumentMock.mockReturnValue({ promise: Promise.resolve(doc) });
  return doc;
}

function pdfFile(): File {
  return new File([new Uint8Array([1, 2, 3, 4])], "exemplo.pdf");
}

describe("limpeza do documento pdf.js no diagnostico", () => {
  it("destroi o documento apos leitura bem sucedida", async () => {
    const doc = mockDoc({ pageCount: 2 });
    const result = await importPdfDiagnostic(pdfFile());
    expect(result.fileName).toBe("exemplo.pdf");
    expect(doc.destroy).toHaveBeenCalledTimes(1);
  });

  it("destroi o documento mesmo quando a leitura falha", async () => {
    const doc = mockDoc({ getPageError: new Error("falha de pagina") });
    await expect(importPdfDiagnostic(pdfFile())).rejects.toThrow();
    expect(doc.destroy).toHaveBeenCalledTimes(1);
  });

  it("destroi o documento depois de ler todas as paginas", async () => {
    const doc = mockDoc({ pageCount: 3 });
    await importPdfDiagnostic(pdfFile());
    expect(doc.getPage).toHaveBeenCalledTimes(3);
    expect(doc.destroy).toHaveBeenCalledTimes(1);
  });

  it("erro no destroy nao mascara o diagnostico construido com sucesso", async () => {
    const doc = mockDoc({ pageCount: 1, destroyError: new Error("falha ao destruir") });
    const result = await importPdfDiagnostic(pdfFile());
    expect(result.fileName).toBe("exemplo.pdf");
    expect(doc.destroy).toHaveBeenCalledTimes(1);
  });
});
