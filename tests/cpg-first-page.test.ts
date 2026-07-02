import { inflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { generateCpgDocxBlob } from "../src/export-cpg-docx";
import { emptyAcademicFields, type AcademicFields } from "../src/ufla-rules";

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

function paragraphsIn(documentXml: string): string[] {
  return documentXml.match(/<w:p\b[\s\S]*?<\/w:p>/g) ?? [];
}

function paragraphXmlContaining(documentXml: string, text: string): string {
  const paragraph = paragraphsIn(documentXml).find((item) => item.includes(text));
  expect(paragraph).toBeTruthy();
  return paragraph ?? "";
}

function paragraphText(paragraphXml: string): string {
  return [...paragraphXml.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)]
    .map((match) => match[1])
    .join("");
}

function titleOccurrences(documentXml: string, title: string): number {
  return paragraphsIn(documentXml).filter((paragraph) => paragraph.includes(title)).length;
}

function spacingBefore(paragraphXml: string): number {
  const value = paragraphXml.match(/w:before="(\d+)"/)?.[1];
  return value ? Number(value) : 0;
}

function hasPositiveBold(xml: string): boolean {
  return /<w:b\s*\/>|<w:b\b(?=[^>]*w:val="(?:1|true|on)")/.test(xml);
}

const cpgFields: AcademicFields = {
  ...emptyAcademicFields(),
  workType: "resumo_expandido_cpg",
  title: "Qualidade do cafe no sul de Minas",
  author: "Maria Silva, Joao Souza",
  program: "Universidade Federal de Lavras\nPrograma de Pos-Graduacao",
  course: "maria@ufla.br, joao@ufla.br",
  resumo: "Resumo do trabalho.",
  palavrasChave: "cafe; qualidade",
  abstractText: "Abstract text.",
  keywords: "coffee; quality",
  referencias: "SILVA, M. Qualidade do cafe. Lavras: UFLA, 2024.",
};

async function generatedCpgXml(): Promise<string> {
  const blob = await generateCpgDocxBlob({
    fields: cpgFields,
    editorText: "# Introducao\nTexto comum.",
  });
  return extractFileFromZip(Buffer.from(await blob.arrayBuffer()), "word/document.xml");
}

describe("CPG first page layout", () => {
  it("keeps title as first real paragraph without empty spacer or page break", async () => {
    const documentXml = await generatedCpgXml();
    const title = paragraphXmlContaining(documentXml, "Qualidade do cafe no sul de Minas");

    expect(titleOccurrences(documentXml, "Qualidade do cafe no sul de Minas")).toBe(1);
    expect(paragraphsIn(documentXml)[0]).toBe(title);
    expect(title).not.toContain('w:br w:type="page"');
    expect(spacingBefore(title)).toBeLessThanOrEqual(240);
    expect(title).toContain('w:jc w:val="center"');
    expect(title).toContain('w:sz w:val="32"');
    expect(hasPositiveBold(title)).toBe(true);
  });

  it("keeps authors bold and affiliation normal on the first page", async () => {
    const documentXml = await generatedCpgXml();
    const authors = paragraphXmlContaining(documentXml, "Maria Silva, Joao Souza");
    const affiliation = paragraphXmlContaining(documentXml, "Universidade Federal de Lavras");

    expect(paragraphText(authors).split(",")).toHaveLength(2);
    expect(authors).toContain('w:jc w:val="center"');
    expect(authors).toContain('w:sz w:val="24"');
    expect(hasPositiveBold(authors)).toBe(true);
    expect(affiliation).toContain('w:jc w:val="center"');
    expect(affiliation).toContain('w:sz w:val="24"');
    expect(hasPositiveBold(affiliation)).toBe(false);
  });
});
