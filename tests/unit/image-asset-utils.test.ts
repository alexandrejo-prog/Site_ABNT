import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { isValidImageBytes, readImageDimensions, MAX_FICHA_IMAGE_BYTES } from "../../src/image-asset-utils";
import { generateDocxBlob } from "../../src/export-docx";
import { emptyAcademicFields } from "../../src/ufla-rules";

const PNG_1x1 = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
  0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
  0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]);

const JPEG_SOF = Uint8Array.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11,
  0x08, 0x00, 0x78, 0x00, 0x50, 0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01,
  0x03, 0x11, 0x01, 0xff, 0xd9,
]);

describe("C10 — image-asset-utils (magic bytes e dimensões)", () => {
  it("reconhece PNG/JPEG/WebP e rejeita bytes não-imagem", () => {
    expect(isValidImageBytes(PNG_1x1)).toBe(true);
    expect(isValidImageBytes(JPEG_SOF)).toBe(true);
    const webp = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
    expect(isValidImageBytes(webp)).toBe(true);
    expect(isValidImageBytes(Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]))).toBe(false);
    expect(isValidImageBytes(new Uint8Array(4))).toBe(false);
  });

  it("lê dimensões do cabeçalho PNG (IHDR) sem decodificar", () => {
    expect(readImageDimensions(PNG_1x1)).toEqual({ width: 1, height: 1 });
  });

  it("lê dimensões do cabeçalho JPEG (SOF0)", () => {
    expect(readImageDimensions(JPEG_SOF)).toEqual({ width: 80, height: 120 });
  });

  it("limite de tamanho da ficha é 10 MB", () => {
    expect(MAX_FICHA_IMAGE_BYTES).toBe(10 * 1024 * 1024);
  });
});

describe("C10 — export cai para texto quando o ArrayBuffer não é imagem válida", () => {
  const baseFields = {
    ...emptyAcademicFields(),
    workType: "dissertacao" as const,
    author: "SILVA, J.",
    title: "Titulo",
    resumo: "Resumo.",
    palavrasChave: "palavras; chave",
  };

  it("sem <w:drawing> e sem crash quando a imagem é inválida", async () => {
    const invalid = Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x00, 0x01, 0x02]);
    const blob = await generateDocxBlob({
      fields: baseFields,
      editorText: "# 1 Introducao\nTexto comum.",
      fichaCatalograficaImage: { data: invalid, width: 100, height: 60 },
    });
    const buffer = Buffer.from(await blob.arrayBuffer());
    const zip = await JSZip.loadAsync(buffer);
    const documentXml = (await zip.file("word/document.xml")?.async("string")) ?? "";
    expect(documentXml).toContain("FICHA CATALOGR");
    expect(documentXml).not.toContain("<w:drawing");
  });

  it("imagem PNG válida continua gerando <w:drawing>", async () => {
    const blob = await generateDocxBlob({
      fields: baseFields,
      editorText: "# 1 Introducao\nTexto comum.",
      fichaCatalograficaImage: { data: PNG_1x1, width: 100, height: 60 },
    });
    const buffer = Buffer.from(await blob.arrayBuffer());
    const zip = await JSZip.loadAsync(buffer);
    const documentXml = (await zip.file("word/document.xml")?.async("string")) ?? "";
    expect(documentXml).toContain("FICHA CATALOGR");
    expect(documentXml).toContain("<w:drawing");
  });
});
