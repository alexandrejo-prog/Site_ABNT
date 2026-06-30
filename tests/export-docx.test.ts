import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { calculateTextualStartPage, generateDocxBlob, parseEditorContent } from "../src/export-docx";
import { UFLA_RULES, emptyAcademicFields, type AcademicFields } from "../src/ufla-rules";

const fields: AcademicFields = {
  ...emptyAcademicFields(),
  workType: "artigo",
  author: "Maria Silva",
  title: "Qualidade do cafe no sul de Minas",
  location: "Lavras - MG",
  year: "2026",
  resumo: "Resumo do trabalho.",
  palavrasChave: "cafe; qualidade",
  abstractText: "Abstract text.",
  keywords: "coffee; quality",
  introducao: "Texto da introducao.",
  referencias: "SILVA, M. Qualidade do cafe. Lavras: UFLA, 2024.",
};

async function generatedXml(editorText = "# 1 Introducao\nTexto comum.") {
  const blob = await generateDocxBlob({ fields, editorText });
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const documentXml = await zip.file("word/document.xml")?.async("string");
  if (!documentXml) throw new Error("DOCX sem document.xml.");
  return documentXml;
}

describe("DOCX export", () => {
  it("creates a valid Blob", async () => {
    const blob = await generateDocxBlob({ fields, editorText: "# Introducao\nTexto comum." });
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(100);
  });

  it("parses editor text", () => {
    expect(parseEditorContent("# Introducao\n## Contexto\n> Citacao")).toEqual([
      { type: "heading1", text: "Introducao" },
      { type: "heading2", text: "Contexto" },
      { type: "longQuote", text: "Citacao" },
    ]);
  });

  it("keeps UFLA margins", () => {
    expect(UFLA_RULES.margins.topCm).toBe(3);
    expect(UFLA_RULES.margins.leftCm).toBe(3);
    expect(UFLA_RULES.margins.bottomCm).toBe(2);
    expect(UFLA_RULES.margins.rightCm).toBe(2);
  });

  it("calculates textual start page", () => {
    expect(calculateTextualStartPage(fields, true)).toBe(5);
    expect(calculateTextualStartPage({ ...fields, workType: "dissertacao" }, true)).toBe(7);
  });

  it("includes main fields and TC TOC markers", async () => {
    const documentXml = await generatedXml("# 1 Introducao\nTexto comum.\n## 1.1 Contexto\nTexto.");
    expect(documentXml).toContain("Maria Silva");
    expect(documentXml).toContain("QUALIDADE DO CAFE NO SUL DE MINAS");
    expect(documentXml).toContain("Resumo do trabalho.");
    expect(documentXml).toContain("TOC \\f \\h \\z");
    expect(documentXml).toContain('TC &quot;1 INTRODUCAO&quot; \\l 1');
    expect(documentXml).toContain('TC &quot;1.1 Contexto&quot; \\l 2');
    expect(documentXml).not.toContain('w:val="Heading1"');
    expect(documentXml).not.toContain('w:val="Heading2"');
  });
});
