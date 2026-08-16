import { inflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { generateDocxBlob } from "../../src/export-docx";
import { buildPreviewHtml } from "../../src/preview-html";
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

function textContent(xml: string): string {
  return [...xml.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map((m) => m[1]).join("");
}

function baseFields(overrides: Partial<AcademicFields> = {}): AcademicFields {
  return {
    ...emptyAcademicFields(),
    workType: "monografia" as const,
    author: "Maria Silva",
    title: "Titulo valido",
    location: "Lavras - MG",
    year: "2026",
    course: "Ciencia da Computacao",
    advisor: "Prof. Dr. Joao Souza",
    resumo: "Este e um resumo com extensao suficiente para os testes de pre-textuais.",
    palavrasChave: "UFLA; ABNT; DOCX",
    abstractText: "This abstract is long enough for the pre-textual tests.",
    keywords: "UFLA; ABNT; DOCX",
    referencias: "SILVA, M. Livro. Lavras: UFLA, 2024.",
    ...overrides,
  };
}

describe("indice remissivo opcional - Manual UFLA 3.1.2.4.4 / NBR 6034", () => {
  it("DOCX renderiza o indice quando preenchido, apos anexos", async () => {
    const blob = await generateDocxBlob({
      fields: baseFields({ anexos: "ANEXO AA - TERMO DE CONSENTIMENTO", indice: "Aleitamento, 3-8, 12, 14\nConjunto\n  aberto, 61\n  enumeravel, 2" }),
      editorText: "# 1 Introducao\nTexto.",
    });
    const xml = extractFileFromZip(Buffer.from(await blob.arrayBuffer()), "word/document.xml");
    const text = textContent(xml);
    expect(text).toContain("ÍNDICE");
    expect(text).toContain("Aleitamento, 3-8, 12, 14");
    expect(text).toContain("Conjunto");
  });

  it("DOCX nao emite titulo de indice quando o campo esta vazio", async () => {
    const blob = await generateDocxBlob({
      fields: baseFields({ anexos: "", indice: "" }),
      editorText: "# 1 Introducao\nTexto.",
    });
    const xml = extractFileFromZip(Buffer.from(await blob.arrayBuffer()), "word/document.xml");
    const text = textContent(xml);
    expect(text).not.toContain("ÍNDICE");
  });

  it("preview renderiza a pagina do indice apos anexos", () => {
    const html = buildPreviewHtml({
      fields: baseFields({ anexos: "ANEXO AA - TERMO DE CONSENTIMENTO", indice: "Aleitamento, 3-8, 12, 14\nConjunto" }),
      editorText: "# 1 Introducao\nTexto.",
    });
    const anexosPos = html.indexOf("ANEXOS");
    const indicePos = html.indexOf("Aleitamento, 3-8, 12, 14");
    expect(anexosPos).toBeGreaterThan(-1);
    expect(indicePos).toBeGreaterThan(anexosPos);
    expect(html).toContain("ÍNDICE");
  });

  it("o titulo do indice fica centralizado e em maiusculas (expectativa de estilo semantico)", async () => {
    const blob = await generateDocxBlob({
      fields: baseFields({ indice: "Aleitamento, 3-8, 12, 14" }),
      editorText: "# 1 Introducao\nTexto.",
    });
    const xml = extractFileFromZip(Buffer.from(await blob.arrayBuffer()), "word/document.xml");
    const paragraphs = xml.match(/<w:p[^>]*>(?:(?!<\/w:p>)[\s\S])*?<\/w:p>/g) ?? [];
    const indexTitle = paragraphs.find((p) => /<w:t[^>]*>ÍNDICE<\/w:t>/.test(p));
    expect(indexTitle).toBeDefined();
    expect(indexTitle!.replace(/\s+/g, " ").match(/<w:jc[^>]*w:val="center"/)).toBeTruthy();
  });
});