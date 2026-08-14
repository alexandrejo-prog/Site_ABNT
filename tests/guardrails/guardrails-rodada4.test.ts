import { readFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { generateDocxBlob } from "../../src/export-docx";
import { generateCpgDocxBlob } from "../../src/export-cpg-docx";
import { emptyAcademicFields, type AcademicFields } from "../../src/ufla-rules";
import { hasHeadingAtLevel, loadDocxParts } from ".././test-utils/ooxml";

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

async function generatedXml(editorText: string, documentFields: AcademicFields = fields) {
  const blob = await generateDocxBlob({ fields: documentFields, editorText });
  return extractFileFromZip(Buffer.from(await blob.arrayBuffer()), "word/document.xml");
}

async function generatedCpgXml(editorText: string, documentFields: AcademicFields) {
  const blob = await generateCpgDocxBlob({ fields: documentFields, editorText });
  return extractFileFromZip(Buffer.from(await blob.arrayBuffer()), "word/document.xml");
}

function fieldInstructionRuns(documentXml: string): string {
  return [...documentXml.matchAll(/<w:instrText[^>]*>([\s\S]*?)<\/w:instrText>/g)]
    .map((match) => match[1])
    .join(" ");
}

const fields: AcademicFields = {
  ...emptyAcademicFields(),
  workType: "monografia",
  author: "Maria Silva",
  title: "Qualidade do café no sul de Minas",
  advisor: "Prof. João Souza",
  location: "Lavras - MG",
  year: "2026",
  resumo: "Resumo do trabalho.",
  palavrasChave: "café; qualidade",
  abstractText: "Abstract text.",
  keywords: "coffee; quality",
  introducao: "Texto da introdução.",
  referencias: "SILVA, M. Qualidade do café. Lavras: UFLA, 2024.",
};

describe("Rodada 4 - conformidade DOCX/OpenXML", () => {
  it("TOC nativo existe no XML para tese", async () => {
    const documentXml = await generatedXml("# 1 Introdução\nTexto comum.\n## 1.1 Contexto\nTexto.", { ...fields, workType: "tese" });
    const toc = fieldInstructionRuns(documentXml);
    expect(toc).toContain("TOC");
    expect(toc).toMatch(/\\o\s+&quot;1-3&quot;/);
    expect(toc).toContain("\\h");
    expect(toc).toContain("\\z");
    expect(toc).toContain("\\u");
    expect(documentXml).toContain("SUMÁRIO");
  });

  it("não há sumário em CPG", async () => {
    const documentXml = await generatedCpgXml("", { ...fields, workType: "resumo_cpg", resumo: "Resumo.", abstractText: "Abstract.", palavrasChave: "a; b", keywords: "a; b" });
    expect(documentXml).not.toContain("SUMÁRIO");
    expect(fieldInstructionRuns(documentXml)).not.toContain("TOC");
  });

  it("não há ficha/capa em CPG", async () => {
    const documentXml = await generatedCpgXml("", { ...fields, workType: "resumo_expandido_cpg", resumo: "Resumo.", abstractText: "Abstract.", palavrasChave: "a; b", keywords: "a; b" });
    expect(documentXml).not.toContain("FICHA CATALOGR");
    expect(documentXml).not.toContain("FOLHA DE ROSTO");
    expect(documentXml).not.toContain("FOLHA DE APROVA");
  });

  it("caracteres especiais não quebram DOCX", async () => {
    const documentXml = await generatedXml("# 1 Introdução\nUso de <tags> & símbolos > comuns e \"aspas\" invisíveis.");
    expect(documentXml).toContain("Uso de");
    expect(documentXml).toContain("símbolos");
    expect(documentXml.length).toBeGreaterThan(100);
  });

  it("tabela IBGE não contém bordas verticais no XML", async () => {
    const documentXml = await generatedXml(
      "Quadro 1 - Cronograma\nEtapa Meses Período Atividades principais\n1º semestre 1 a 6 2026/2026 a 2026/2026 Levantamento\nFonte: elaborado pelo autor.",
    );
    expect(documentXml).toContain("Cronograma");
    const borders = documentXml.match(/<w:tblBorders[\s\S]*?<\/w:tblBorders>/g) ?? [];
    expect(borders.length).toBeGreaterThan(0);
    const joined = borders.join("");
    for (const vertical of ["insideV", "left", "right"]) {
      const re = new RegExp(`<w:${vertical}\\b[^>]*w:val="(?<val>[^"]*)"`);
      const match = joined.match(re);
      expect(match).toBeTruthy();
      expect(match?.groups?.val).toBe("none");
    }
  });

  it("tabela IBGE mantém bordas horizontais principais", async () => {
    const documentXml = await generatedXml(
      "Quadro 1 - Cronograma\nEtapa Meses Período Atividades principais\n1º semestre 1 a 6 2026/2026 a 2026/2026 Levantamento\nFonte: elaborado pelo autor.",
    );
    const borders = documentXml.match(/<w:tblBorders[\s\S]*?<\/w:tblBorders>/g)?.join("") ?? "";
    expect(borders).toContain('w:val="single"');
  });

  it("headings corretos aparecem no XML (semântica de título 1..3)", async () => {
    const blob = await generateDocxBlob({
      fields,
      editorText: "# 1 Introdução\nTexto.\n## 1.3 Objetivos\nTexto.\n### 1.3.1 Objetivo geral\nTexto.",
    });
    const parts = await loadDocxParts(blob);
    expect(hasHeadingAtLevel(parts.documentXml, parts.stylesXml, 1, "1 INTRODUÇÃO")).toBe(true);
    expect(hasHeadingAtLevel(parts.documentXml, parts.stylesXml, 2, "1.3 Objetivos")).toBe(true);
    expect(hasHeadingAtLevel(parts.documentXml, parts.stylesXml, 3, "1.3.1 Objetivo geral")).toBe(true);
  });

  it("App.tsx comunica rascunho editável e não promete conformidade total", () => {
    const source = readFileSync(new URL("../../src/App.tsx", import.meta.url), "utf8");
    expect(source).toContain("Assistente de estruturação e normalização acadêmica");
    expect(source).toContain("O DOCX é rascunho técnico");
    expect(source).toContain("devem ser conferidos no Word/LibreOffice");
    expect(source).not.toContain("Normalização Acadêmica UFLA — DOCX editável");
  });
});
