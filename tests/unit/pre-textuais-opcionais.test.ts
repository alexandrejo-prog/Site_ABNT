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
    dedicatoria: "Dedico este trabalho a minha familia.",
    agradecimentos: "Agradeco a todos os professores.",
    epigrafe: "A educacao e a arma mais poderosa. Nelson Mandela.",
    errata: "Pagina 12, linha 5: onde se le 2020, leia-se 2024.",
    ...overrides,
  };
}

describe("pre-textuais opcionais - R10", () => {
  it("DOCX renderiza dedicatoria, agradecimentos, epigrafe e errata", async () => {
    const blob = await generateDocxBlob({ fields: baseFields(), editorText: "# 1 Introducao\nTexto." });
    const xml = extractFileFromZip(Buffer.from(await blob.arrayBuffer()), "word/document.xml");
    const text = textContent(xml);
    expect(text).toContain("Dedico este trabalho a minha familia.");
    expect(text).toContain("Agradeco a todos os professores.");
    expect(text).toContain("A educacao e a arma mais poderosa.");
    expect(text).toContain("Pagina 12, linha 5: onde se le 2020, leia-se 2024.");
    expect(text).toContain("ERRATA");
    expect(text).toContain("AGRADECIMENTOS");
  });

  it("preview renderiza os titulos das pre-textuais opcionais", () => {
    const html = buildPreviewHtml({ fields: baseFields(), editorText: "# 1 Introducao\nTexto." });
    expect(html).toContain("DEDICATÓRIA");
    expect(html).toContain("AGRADECIMENTOS");
    expect(html).toContain("EPÍGRAFE");
    expect(html).toContain("ERRATA");
  });

  it("pre-textuais vazias nao geram paginas no DOCX", async () => {
    const blob = await generateDocxBlob({
      fields: baseFields({ dedicatoria: "", agradecimentos: "", epigrafe: "", errata: "" }),
      editorText: "# 1 Introducao\nTexto.",
    });
    const xml = extractFileFromZip(Buffer.from(await blob.arrayBuffer()), "word/document.xml");
    const text = textContent(xml);
    expect(text).not.toContain("Dedico este trabalho");
    expect(text).not.toContain("Agradeco a todos");
    expect(text).not.toContain("ERRATA");
  });
});
