import { describe, expect, it } from "vitest";
import { AcademicFields, emptyAcademicFields } from "../src/ufla-rules";
import { validateWork } from "../src/validators";
import { detectPlaceholderText } from "../src/academic-guardrails";
import { readFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";
import { generateDocxBlob } from "../src/export-docx";

function baseFields(overrides: Partial<AcademicFields> = {}): AcademicFields {
  return {
    ...emptyAcademicFields(),
    workType: "dissertacao",
    author: "Maria Silva",
    title: "Título da pesquisa",
    advisor: "Prof. João Souza",
    resumo: "Resumo do trabalho.",
    palavrasChave: "a; b",
    abstractText: "Abstract text.",
    keywords: "a; b",
    introducao: "Introdução.",
    referencias: "SILVA, M. Livro. UFLA, 2024.",
    ...overrides,
  };
}

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

async function generatedXml(fields: AcademicFields) {
  const blob = await generateDocxBlob({ fields, editorText: "# 1 Introdução\nTexto." });
  return extractFileFromZip(Buffer.from(await blob.arrayBuffer()), "word/document.xml");
}

describe("Indicadores de impacto - sem texto genérico", () => {
  it("detecta marcador [PREENCHER: indicadores de impacto]", () => {
    expect(detectPlaceholderText("[PREENCHER: indicadores de impacto]")).toBe(true);
    expect(detectPlaceholderText("Texto real de impacto social.")).toBe(false);
  });

  it("dissertação/tese com indicadores vazios gera error, não warning", () => {
    const issues = validateWork(baseFields({ indicadoresImpacto: "" }));
    const error = issues.find((i) => i.code === "impact-indicators-missing");
    expect(error).toBeTruthy();
    expect(error?.severity).toBe("error");
    expect(error?.message).toBe("Preencha os Indicadores de Impacto antes da versão final.");
    expect(error?.what).toContain("vazios");
    expect(error?.why).toContain("UFLA");
    expect(error?.action).toContain("campos de impacto");
  });

  it("dissertação/tese com texto instrucional gera error", () => {
    const issues = validateWork(baseFields({ indicadoresImpacto: "Texto a ser preenchido aqui." }));
    expect(issues).toContainEqual(expect.objectContaining({ severity: "error", code: "impact-indicators-missing" }));
  });

  it("DOCX não contém texto instrucional genérico de indicadores quando vazio", async () => {
    const documentXml = await generatedXml(baseFields({ indicadoresImpacto: "" }));
    expect(documentXml).not.toContain("Esta pesquisa apresenta impacto social");
    expect(documentXml).not.toContain("This research has social and institutional impact");
    expect(documentXml).toContain("[PREENCHER: indicadores de impacto]");
  });

  it("DOCX não contém defaultImpactIndicators quando vazio", async () => {
    const documentXml = await generatedXml(baseFields({ indicadoresImpacto: "" }));
    expect(documentXml).not.toContain("servidores técnico-administrativos");
  });

  it("quando indicadores reais são preenchidos, aparecem no DOCX", async () => {
    const realText = "Este trabalho impacta a agricultura familiar por meio de extensão rural.";
    const documentXml = await generatedXml(baseFields({ indicadoresImpacto: realText }));
    expect(documentXml).toContain(realText);
    expect(documentXml).not.toContain("[PREENCHER: indicadores de impacto]");
  });

  it("monografia não exige indicadores de impacto", () => {
    const issues = validateWork(baseFields({ workType: "monografia", indicadoresImpacto: "" }));
    expect(issues).not.toContainEqual(expect.objectContaining({ code: "impact-indicators-missing" }));
  });

  it("App.tsx não contém mais defaultImpactIndicators", () => {
    const source = readFileSync(new URL("../src/export-docx.ts", import.meta.url), "utf8");
    expect(source).not.toContain("defaultImpactIndicators");
  });
});
