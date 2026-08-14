import { inflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { generateDocxBlob } from "../../src/export-docx";
import { tokenizeMarkup } from "../../src/docx-render-core";
import { inlineMarkupToHtml } from "../../src/editor-markup";
import { emptyAcademicFields, type AcademicFields } from "../../src/ufla-rules";

function readUInt16(buffer: Buffer, offset: number): number {
  return buffer.readUInt16LE(offset);
}
function readUInt32(buffer: Buffer, offset: number): number {
  return buffer.readUInt32LE(offset);
}
function extractFileFromZip(buffer: Buffer, fileName: string): string {
  let offset = 0;
  while (offset < buffer.length - 30) {
    if (readUInt32(buffer, offset) !== 0x04034b50) {
      offset += 1;
      continue;
    }
    const compression = readUInt16(buffer, offset + 8);
    const compressedSize = readUInt32(buffer, offset + 18);
    const fileNameLength = readUInt16(buffer, offset + 26);
    const extraLength = readUInt16(buffer, offset + 28);
    const nameStart = offset + 30;
    const name = buffer.subarray(nameStart, nameStart + fileNameLength).toString("utf8");
    const dataStart = nameStart + fileNameLength + extraLength;
    const dataEnd = dataStart + compressedSize;
    if (name === fileName) {
      const data = buffer.subarray(dataStart, dataEnd);
      if (compression === 0) return data.toString("utf8");
      if (compression === 8) return inflateRawSync(data).toString("utf8");
      throw new Error(`Compactacao nao suportada: ${compression}.`);
    }
    offset = dataEnd;
  }
  throw new Error(`Arquivo nao encontrado no DOCX: ${fileName}.`);
}

function baseFields(): AcademicFields {
  return {
    ...emptyAcademicFields(),
    workType: "monografia" as const,
    author: "Maria Silva",
    title: "Titulo valido",
    location: "Lavras - MG",
    year: "2026",
    course: "Ciencia da Computacao",
    advisor: "Prof. Dr. Joao Souza",
    resumo: "Este e um resumo com extensao suficiente para os testes.",
    palavrasChave: "UFLA; ABNT",
    abstractText: "This abstract is long enough for tests.",
    keywords: "UFLA; ABNT",
    referencias: "SILVA, M. Livro. Lavras: UFLA, 2024.",
    introducao: "Texto comum.",
  };
}

describe("R11 - et al. em italico no corpo", () => {
  it("tokenizeMarkup italiza 'et al.' no texto do corpo", () => {
    const runs = tokenizeMarkup("Conforme Silva et al. (2024) concluíram.");
    const etAl = runs.find((run) => run.text.toLowerCase() === "et al.");
    expect(etAl).toBeTruthy();
    expect(etAl && etAl.italics).toBe(true);
  });

  it("inlineMarkupToHtml envolve 'et al.' com <em> no preview", () => {
    const html = inlineMarkupToHtml("Conforme Silva et al. (2024).");
    expect(html).toContain("<em>et al.</em>");
  });

  it("DOCX iterado marca italics no run 'et al.'", async () => {
    const blob = await generateDocxBlob({
      fields: baseFields(),
      editorText: "# 1 Introducao\nTexto com (SILVA et al., 2024) citado aqui.",
    });
    const xml = extractFileFromZip(Buffer.from(await blob.arrayBuffer()), "word/document.xml");
    const runs = [...xml.matchAll(/<w:r>[\s\S]*?<\/w:r>/g)].map((m) =>
      [...m[0].matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map((t) => t[1]).join(""),
    );
    const etAlRunIndex = runs.findIndex((r) => r.toLowerCase() === "et al.");
    expect(etAlRunIndex).toBeGreaterThan(-1);
  });
});