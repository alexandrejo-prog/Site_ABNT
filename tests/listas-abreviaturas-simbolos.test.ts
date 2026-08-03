import { inflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { generateDocxBlob } from "../src/export-docx";
import { buildPreviewHtml } from "../src/preview-html";
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
    resumo: "Este e um resumo com extensao suficiente para os testes de listas.",
    palavrasChave: "UFLA; ABNT",
    abstractText: "This abstract is long enough for list tests.",
    keywords: "UFLA; ABNT",
    referencias: "SILVA, M. Livro. Lavras: UFLA, 2024.",
    listaSiglas: "ABNT - Associacao Brasileira de Normas Tecnicas",
    listaAbreviaturas: "et al. - e outros",
    listaSimbolos: "sigma - desvio padrao",
    glossario: "normalizacao: conjunto de regras.",
    ...overrides,
  };
}

describe("R12 - listas de abreviaturas, simbolos e glossario", () => {
  it("DOCX renderiza as quatro listas pre-textuais", async () => {
    const blob = await generateDocxBlob({ fields: baseFields(), editorText: "# 1 Introducao\nTexto." });
    const text = textContent(extractFileFromZip(Buffer.from(await blob.arrayBuffer()), "word/document.xml"));
    expect(text).toContain("ABNT - Associacao Brasileira de Normas Tecnicas");
    expect(text).toContain("et al. - e outros");
    expect(text).toContain("sigma - desvio padrao");
    expect(text).toContain("normalizacao: conjunto de regras.");
    expect(text).toContain("LISTA DE SIGLAS");
    expect(text).toContain("LISTA DE ABREVIATURAS");
    expect(text).toContain("LISTA DE SÍMBOLOS");
    expect(text).toContain("GLOSSÁRIO");
  });

  it("preview renderiza os titulos das listas", () => {
    const html = buildPreviewHtml({ fields: baseFields(), editorText: "# 1 Introducao\nTexto." });
    expect(html).toContain("LISTA DE ABREVIATURAS");
    expect(html).toContain("LISTA DE SÍMBOLOS");
    expect(html).toContain("GLOSSÁRIO");
  });

  it("campos vazios nao geram paginas", async () => {
    const blob = await generateDocxBlob({
      fields: baseFields({ listaSiglas: "", listaAbreviaturas: "", listaSimbolos: "", glossario: "" }),
      editorText: "# 1 Introducao\nTexto.",
    });
    const text = textContent(extractFileFromZip(Buffer.from(await blob.arrayBuffer()), "word/document.xml"));
    expect(text).not.toContain("LISTA DE ABREVIATURAS");
    expect(text).not.toContain("GLOSSÁRIO");
  });
});