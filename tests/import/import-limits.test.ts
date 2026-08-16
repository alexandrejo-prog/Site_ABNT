import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import {
  assertReasonableUncompressedSize,
  extractDocxStructure,
  MAX_UNCOMPRESSED_IMPORT_BYTES,
} from "../../src/word-structure-extractor";
import { importDocumentFile, MAX_IMPORT_FILE_BYTES } from "../../src/import-docx";

async function minimalDocxZip(): Promise<ArrayBuffer> {
  const zip = new JSZip();
  zip.file(
    "word/document.xml",
    '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Introducao</w:t></w:r></w:p></w:body></w:document>',
  );
  zip.file("word/styles.xml", "<w:styles/>");
  return zip.generateAsync({ type: "arraybuffer" });
}

describe("C12 — limites de tamanho/compressão na importação", () => {
  it("aceita ZIP com descompressão normal (assertReasonableUncompressedSize)", async () => {
    const zip = await JSZip.loadAsync(await minimalDocxZip());
    expect(() => assertReasonableUncompressedSize(zip)).not.toThrow();
  });

  it("recusa descompressão anômala (zip bomb) sem alocar memória", async () => {
    const zip = await JSZip.loadAsync(await minimalDocxZip());
    // simula entrada cujo conteúdo declarado excede o teto (sem alocar 500 MB)
    (zip.files["word/document.xml"] as unknown as { _data: { uncompressedSize: number } })._data.uncompressedSize =
      MAX_UNCOMPRESSED_IMPORT_BYTES + 1;
    expect(() => assertReasonableUncompressedSize(zip)).toThrow(/descomprimido excessivo/);
  });

  it("extractDocxStructure continua funcional com DOCX normal", async () => {
    const structure = await extractDocxStructure(await minimalDocxZip());
    expect(structure.text).toContain("Introducao");
  });

  it("importDocumentFile recusa arquivo acima do limite com erro amigável", async () => {
    const file = new File([await minimalDocxZip()], "grande.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    Object.defineProperty(file, "size", { value: MAX_IMPORT_FILE_BYTES + 1 });
    await expect(importDocumentFile(file)).rejects.toThrow(/muito grande/);
  });

  it("importDocumentFile continua importando DOCX normal", async () => {
    const file = new File([await minimalDocxZip()], "normal.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    const result = await importDocumentFile(file);
    expect(result.text).toContain("Introducao");
    expect(result.messages).toBeDefined();
  });
});
