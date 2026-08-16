import { readFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { isNonOverridableError } from "../../src/generation-blockers";
import { generateDocxBlob } from "../../src/export-docx";
import { emptyAcademicFields, type AcademicFields } from "../../src/ufla-rules";
import { validateWork, type ValidationIssue } from "../../src/validators";
import { normalizeFieldsForSelectedModel } from "../../src/work-type-field-normalizer";

const FORBIDDEN_NATURAL_PLACEHOLDERS = [
  "informado pelo usuário",
  "grau acadêmico correspondente",
  "Programa de Pós-Graduação informado pelo usuário",
];

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

async function documentXml(fields: AcademicFields): Promise<string> {
  const blob = await generateDocxBlob({ fields, editorText: "# 1 Introducao\nTexto comum." });
  return extractFileFromZip(Buffer.from(await blob.arrayBuffer()), "word/document.xml");
}

describe("criterios de aceite P0", () => {
  it.each(FORBIDDEN_NATURAL_PLACEHOLDERS)("dispara natural-placeholder-detected para %s", (phrase) => {
    const issues = validateWork({
      ...emptyAcademicFields(),
      workType: "dissertacao",
      title: "Titulo valido",
      author: "Maria Silva",
      program: "Ciência do Solo",
      workNature: phrase,
    });
    expect(issues).toContainEqual(expect.objectContaining({ code: "natural-placeholder-detected", severity: "error" }));
  });

  it("natural-placeholder-detected nunca pode ser sobreposto por gerar mesmo assim", () => {
    const issue: ValidationIssue = { severity: "error", code: "natural-placeholder-detected", message: "teste" };
    expect(isNonOverridableError(issue)).toBe(true);
  });

  it.each([
    { workType: "monografia" as const, course: "", program: "" },
    { workType: "dissertacao" as const, course: "", program: "" },
    { workType: "tese" as const, course: "", program: "" },
  ])("DOCX de $workType com campos vazios nao contem placeholders naturais", async (partial) => {
    const fields = normalizeFieldsForSelectedModel({
      ...emptyAcademicFields(),
      ...partial,
      title: "Titulo valido",
      author: "Maria Silva",
      location: "Lavras - MG",
      year: "2026",
      resumo: "Resumo valido.",
      abstractText: "Valid abstract.",
      palavrasChave: "UFLA; ABNT; DOCX",
      keywords: "UFLA; ABNT; DOCX",
      introducao: "Texto comum.",
    });
    const xml = await documentXml(fields);
    for (const phrase of FORBIDDEN_NATURAL_PLACEHOLDERS) {
      expect(xml).not.toContain(phrase);
    }
  });

  it("runValidation e leitura pura e nao reescreve fields", () => {
    const source = readFileSync(new URL("../../src/App.tsx", import.meta.url), "utf8");
    const body = source.match(/function runValidation[\s\S]*?\n {2}async function handleGenerateDocx/)?.[0] ?? "";
    expect(body).not.toContain("setFields(");
    expect(source).not.toContain("setFields(normalizedFields)");
  });
});
