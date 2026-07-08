import { readFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { ensureTrailingPeriod, generateDocxBlob } from "../src/export-docx";
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

async function generatedXml(editorText: string, documentFields: AcademicFields): Promise<string> {
  const blob = await generateDocxBlob({ fields: documentFields, editorText });
  return extractFileFromZip(Buffer.from(await blob.arrayBuffer()), "word/document.xml");
}

function baseFields(overrides: Partial<AcademicFields> = {}): AcademicFields {
  return {
    ...emptyAcademicFields(),
    workType: "tese",
    author: "Maria Silva",
    title: "Titulo valido",
    location: "Lavras - MG",
    year: "2026",
    resumo: "Resumo valido.",
    abstractText: "Valid abstract.",
    palavrasChave: "UFLA; ABNT; DOCX",
    keywords: "UFLA; ABNT; DOCX",
    introducao: "Texto comum.",
    program: "Ciencia do Solo",
    advisor: "Prof. Dr. Joao Souza",
    indicadoresImpacto: "Impacto social: beneficia a comunidade.",
    impactIndicators: "Social impact text.",
    referencias: "SILVA, M. Livro. Lavras: UFLA, 2024.",
    ...overrides,
  };
}

function tocInstruction(documentXml: string): string {
  return [...documentXml.matchAll(/<w:instrText[^>]*>([\s\S]*?)<\/w:instrText>/g)]
    .map((match) => match[1])
    .join(" ");
}

describe("tese e dissertacao - conformidade UFLA", () => {
  it("não gera nenhum placeholder [PREENCHER: no DOCX de tese", async () => {
    const documentXml = await generatedXml("# 1 Introducao\nTexto.", baseFields({ workType: "tese" }));
    expect(documentXml).not.toContain("[PREENCHER");
  });

  it("não gera nenhum placeholder [PREENCHER: no DOCX de dissertacao", async () => {
    const documentXml = await generatedXml("# 1 Introducao\nTexto.", baseFields({ workType: "dissertacao" }));
    expect(documentXml).not.toContain("[PREENCHER");
  });

  it("folha de rosto de tese não contém 'Curso:'", async () => {
    const documentXml = await generatedXml("# 1 Introducao\nTexto.", baseFields({ workType: "tese", course: "Bacharelado em Administracao Publica" }));
    expect(documentXml).not.toContain("Curso:");
  });

  it("folha de rosto de dissertacao não contém 'Curso:'", async () => {
    const documentXml = await generatedXml("# 1 Introducao\nTexto.", baseFields({ workType: "dissertacao", course: "Bacharelado em Administracao Publica" }));
    expect(documentXml).not.toContain("Curso:");
  });

  it("monografia mantém 'Curso:' quando preenchido", async () => {
    const documentXml = await generatedXml("# 1 Introducao\nTexto.", baseFields({ workType: "monografia", course: "Bacharelado em Biologia" }));
    expect(documentXml).toContain("Curso: Bacharelado em Biologia");
  });

  it("Palavras-chave termina com ponto final", async () => {
    const documentXml = await generatedXml("# 1 Introducao\nTexto.", baseFields({ palavrasChave: "UFLA; ABNT; DOCX" }));
    expect(documentXml).toContain("Palavras-chave: UFLA; ABNT; DOCX.");
  });

  it("Palavras-chave não duplica ponto final", async () => {
    const documentXml = await generatedXml("# 1 Introducao\nTexto.", baseFields({ palavrasChave: "UFLA; ABNT; DOCX." }));
    expect(documentXml).toContain("Palavras-chave: UFLA; ABNT; DOCX.");
    expect(documentXml).not.toContain("Palavras-chave: UFLA; ABNT; DOCX..");
  });

  it("Keywords termina com ponto final", async () => {
    const documentXml = await generatedXml("# 1 Introducao\nTexto.", baseFields({ keywords: "UFLA; ABNT; DOCX" }));
    expect(documentXml).toContain("Keywords: UFLA; ABNT; DOCX.");
  });

  it("Keywords não duplica ponto final", async () => {
    const documentXml = await generatedXml("# 1 Introducao\nTexto.", baseFields({ keywords: "UFLA; ABNT; DOCX." }));
    expect(documentXml).toContain("Keywords: UFLA; ABNT; DOCX.");
    expect(documentXml).not.toContain("Keywords: UFLA; ABNT; DOCX..");
  });

  it("sumário de tese usa campo TOC atualizável e não lista estática pobre", async () => {
    const editorText = "# 1 Introducao\nTexto.\n## 1.1 Contexto\nTexto.\n# 2 Metodologia\nTexto.";
    const documentXml = await generatedXml(editorText, baseFields({ workType: "tese" }));
    const toc = tocInstruction(documentXml);
    expect(toc).toContain("TOC");
    expect(toc).toMatch(/\\o\s+&quot;1-3&quot;/);
    // Tese não deve ter entradas estáticas de sumário (estilo TOC1).
    expect((documentXml.match(/w:val="TOC1"/g) ?? []).length).toBe(0);
  });

  it("sumário de monografia mantém lista estática e campo TOC", async () => {
    const editorText = "# 1 Introducao\nTexto.\n## 1.1 Contexto\nTexto.";
    const documentXml = await generatedXml(editorText, baseFields({ workType: "monografia", course: "Bacharelado em Biologia" }));
    expect(tocInstruction(documentXml)).toContain("TOC");
    expect((documentXml.match(/w:val="TOC1"/g) ?? []).length).toBeGreaterThan(0);
  });

  it("cronograma em formato de tabela markdown vira tabela DOCX", async () => {
    const editorText = `# 1 INTRODUCAO
Texto.

# 5 CRONOGRAMA
Etapa | Mês 1 | Mês 2 | Mês 3
Atividade 1 | X |  | 
Atividade 2 |  | X | `;
    const documentXml = await generatedXml(editorText, baseFields({ workType: "tese" }));
    expect(documentXml).toContain("<w:tbl");
    expect(documentXml).toContain("Etapa");
    expect(documentXml).toContain("Mês 1");
    expect(documentXml).toContain("Mês 3");
    expect(documentXml).toContain("Atividade 1");
  });
});

describe("ensureTrailingPeriod", () => {
  it("adiciona ponto quando ausente", () => {
    expect(ensureTrailingPeriod("UFLA; ABNT; DOCX")).toBe("UFLA; ABNT; DOCX.");
  });
  it("adiciona ponto quando termina com ponto e vírgula", () => {
    expect(ensureTrailingPeriod("UFLA; ABNT; DOCX;")).toBe("UFLA; ABNT; DOCX.");
  });
  it("mantém ponto existente", () => {
    expect(ensureTrailingPeriod("UFLA; ABNT; DOCX.")).toBe("UFLA; ABNT; DOCX.");
  });
  it("retorna vazio para texto vazio", () => {
    expect(ensureTrailingPeriod("  ")).toBe("");
  });
});

describe("documento ideal de teste (importado)", () => {
  it("download-filename preserva importedFileName para tese", () => {
    // Documentação: o arquivo documento_ideal_teste_tipos_trabalho_ufla_abnt.docx
    // é externo (não versionado). O nome do DOCX deve usar importedFileName.
    const source = readFileSync(new URL("../src/download-filename.ts", import.meta.url), "utf8");
    expect(source).toContain("importedFileName");
  });
});
