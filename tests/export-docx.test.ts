import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { generateDocxBlob, parseEditorContent } from "../src/export-docx";
import { UFLA_RULES, emptyAcademicFields } from "../src/ufla-rules";

const fields = {
  ...emptyAcademicFields(),
  workType: "artigo" as const,
  author: "Maria Silva",
  title: "Qualidade do café no sul de Minas",
  location: "Lavras - MG",
  year: "2026",
  resumo: "Resumo do trabalho.",
  palavrasChave: "café; qualidade",
  abstractText: "Abstract text.",
  keywords: "coffee; quality",
  introducao: "Texto da introdução.",
  referencias: "SILVA, M. Qualidade do café. Lavras: UFLA, 2024.",
};

async function generatedXml() {
  const logoPath = join(process.cwd(), "public", "assets", "ufla-logo.jpeg");
  const blob = await generateDocxBlob({
    fields,
    editorText: "# 1 Introdução\nTexto comum.\n> Citação longa.",
    logo: {
      data: readFileSync(logoPath),
      width: 120,
      height: 44,
    },
  });
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const documentXml = await zip.file("word/document.xml")?.async("string");
  if (!documentXml) throw new Error("DOCX sem document.xml.");
  return { zip, documentXml };
}

describe("exportação DOCX", () => {
  it("gera Blob válido", async () => {
    const blob = await generateDocxBlob({
      fields,
      editorText: "# Introdução\nTexto comum.\n> Citação longa.",
    });

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(100);
  });

  it("converte texto do editor para blocos internos", () => {
    expect(parseEditorContent("# Introdução\n## Contexto\n> Citação")).toEqual([
      { type: "heading1", text: "Introdução" },
      { type: "heading2", text: "Contexto" },
      { type: "longQuote", text: "Citação" },
    ]);
  });

  it("mantém margens UFLA corretas", () => {
    expect(UFLA_RULES.margins.topCm).toBe(3);
    expect(UFLA_RULES.margins.leftCm).toBe(3);
    expect(UFLA_RULES.margins.bottomCm).toBe(2);
    expect(UFLA_RULES.margins.rightCm).toBe(2);
  });

  it("inclui campos acadêmicos principais no DOCX gerado", async () => {
    const { documentXml } = await generatedXml();
    expect(documentXml).toContain("Maria Silva");
    expect(documentXml).toContain("QUALIDADE DO CAFÉ NO SUL DE MINAS");
    expect(documentXml).toContain("Resumo do trabalho.");
    expect(documentXml).toContain("Abstract text.");
    expect(documentXml).toContain("Texto comum.");
    expect(documentXml).toContain("SILVA, M. Qualidade do café.");
  });

  it("não aplica cor azul ao resumo ou abstract", async () => {
    const { documentXml } = await generatedXml();
    expect(documentXml).not.toMatch(/w:color\s+w:val="(?:0000ff|0070c0|0563c1)"/i);
  });

  it("inclui mídia da logo quando o ativo está disponível", async () => {
    const logoPath = join(process.cwd(), "public", "assets", "ufla-logo.jpeg");
    expect(existsSync(logoPath)).toBe(true);

    const { zip } = await generatedXml();
    expect(Object.keys(zip.files).some((name) => name.startsWith("word/media/"))).toBe(true);
  });
});
