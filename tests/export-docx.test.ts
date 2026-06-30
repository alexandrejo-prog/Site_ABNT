import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import {
  calculateTextualStartPage,
  generateDocxBlob,
  parseEditorContent,
} from "../src/export-docx";
import { UFLA_RULES, emptyAcademicFields, type AcademicFields } from "../src/ufla-rules";

const fields: AcademicFields = {
  ...emptyAcademicFields(),
  workType: "artigo",
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

async function generatedXml(
  inputFields = fields,
  editorText = "# 1 Introdução\nTexto comum.\n> Citação longa.",
) {
  const blob = await generateDocxBlob({ fields: inputFields, editorText });
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const documentXml = await zip.file("word/document.xml")?.async("string");
  if (!documentXml) throw new Error("DOCX sem document.xml.");
  return { zip, documentXml };
}

function paragraphsIn(documentXml: string): string[] {
  return documentXml.match(/<w:p\b[\s\S]*?<\/w:p>/g) ?? [];
}

function textFromXml(documentXml: string): string {
  return [...documentXml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)]
    .map((match) => match[1])
    .join("");
}

function paragraphXmlContaining(documentXml: string, text: string): string {
  const paragraph = paragraphsIn(documentXml).find((item) => item.includes(text));
  expect(paragraph).toBeTruthy();
  return paragraph ?? "";
}

describe("exportação DOCX", () => {
  it("gera Blob válido", async () => {
    const blob = await generateDocxBlob({ fields, editorText: "# Introdução\nTexto comum." });
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

  it("calcula a numeração inicial textual conforme pré-textuais UFLA", () => {
    expect(calculateTextualStartPage(fields, true)).toBe(5);
    expect(calculateTextualStartPage({ ...fields, workType: "dissertacao" }, true)).toBe(7);
  });

  it("inclui campos acadêmicos principais no DOCX gerado", async () => {
    const { documentXml } = await generatedXml();
    expect(documentXml).toContain("Maria Silva");
    expect(documentXml).toContain("QUALIDADE DO CAFÉ NO SUL DE MINAS");
    expect(documentXml).toContain("Resumo do trabalho.");
    expect(documentXml).toContain("Abstract text.");
    expect(textFromXml(documentXml)).toContain("SILVA, M. Qualidade do café.");
  });

  it("usa campos TC no sumário e remove nível de tópico dos títulos visuais", async () => {
    const { documentXml } = await generatedXml(
      { ...fields, conclusao: "Texto final importado do campo." },
      "# 1 Introdução\nTexto comum.\n## 1.1 Contexto\nTexto.\n# 6 Considerações finais\nTexto final do editor.",
    );

    expect(documentXml).toContain("TOC \\f \\h \\z");
    expect(documentXml).toContain('TC &quot;1 INTRODUÇÃO&quot; \\l 1');
    expect(documentXml).toContain('TC &quot;1.1 Contexto&quot; \\l 2');
    expect(documentXml).toContain('TC &quot;6 CONSIDERAÇÕES FINAIS&quot; \\l 1');
    expect(documentXml).not.toMatch(/<w:pStyle\s+w:val="Heading[123]"\s*\/>/);
    expect(documentXml).not.toMatch(/<w:outlineLvl\b/);

    const summaryTitle = paragraphXmlContaining(documentXml, "SUMÁRIO");
    const tocParagraph = paragraphsIn(documentXml).find((paragraph) => paragraph.includes("TOC \\f \\h \\z"));
    expect(tocParagraph).toBeTruthy();
    expect(tocParagraph).not.toBe(summaryTitle);
    expect(tocParagraph).not.toContain("<w:b");
  });

  it("não duplica conclusão quando o corpo já tem considerações finais", async () => {
    const { documentXml } = await generatedXml(
      { ...fields, conclusao: "Texto final importado do campo." },
      "# 1 Introdução\nTexto comum.\n# 6 Considerações finais\nTexto final do editor.",
    );
    const text = textFromXml(documentXml);
    const finalConsiderations = paragraphsIn(documentXml).filter(
      (paragraph) => paragraph.includes("6 CONSIDERAÇÕES FINAIS") && !paragraph.includes("<w:instrText"),
    );

    expect(text.split("6 CONSIDERAÇÕES FINAIS").length - 1).toBe(1);
    expect(finalConsiderations).toHaveLength(1);
    expect(finalConsiderations[0]).not.toMatch(/<w:pStyle\s+w:val="Heading1"\s*\/>/);
    expect(text).not.toContain("CONCLUSÃO");
    expect(text).not.toContain("Texto final importado do campo.");
  });

  it("não aplica cor azul ao resumo ou abstract", async () => {
    const { documentXml } = await generatedXml();
    expect(documentXml).not.toMatch(/w:color\s+w:val="(?:0000ff|0070c0|0563c1)"/i);
  });
});
