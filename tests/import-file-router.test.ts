import { describe, expect, it } from "vitest";
import { detectImportableFileKind } from "../src/import-file-router";

describe("detectImportableFileKind", () => {
  it("arquivo .docx retorna docx", () => {
    expect(detectImportableFileKind({ fileName: "tese.docx" })).toBe("docx");
  });

  it("arquivo .pdf retorna pdf", () => {
    expect(detectImportableFileKind({ fileName: "artigo.pdf" })).toBe("pdf");
  });

  it("MIME application/pdf retorna pdf", () => {
    expect(detectImportableFileKind({ fileName: "semext", mimeType: "application/pdf" })).toBe("pdf");
  });

  it("MIME Word retorna docx", () => {
    expect(
      detectImportableFileKind({
        fileName: "doc.docx",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
    ).toBe("docx");
  });

  it("extensão desconhecida retorna unknown", () => {
    expect(detectImportableFileKind({ fileName: "imagem.png" })).toBe("unknown");
  });

  it("txt e md também são roteados como docx", () => {
    expect(detectImportableFileKind({ fileName: "resumo.txt" })).toBe("docx");
    expect(detectImportableFileKind({ fileName: "notas.md" })).toBe("docx");
  });
});
