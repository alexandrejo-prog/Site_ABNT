import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { generateDocxBlob } from "../src/export-docx";
import { generateResearchProjectDocxBlob } from "../src/export-research-project-docx";
import { UFLA_RULES, emptyAcademicFields } from "../src/ufla-rules";

async function docxParts(blob: Blob) {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const documentXml = await zip.file("word/document.xml")?.async("string");
  const stylesXml = await zip.file("word/styles.xml")?.async("string");
  const settingsXml = await zip.file("word/settings.xml")?.async("string");

  if (!documentXml || !stylesXml || !settingsXml) {
    throw new Error("DOCX sem partes OOXML esperadas.");
  }

  return { documentXml, stylesXml, settingsXml };
}

function tocInstruction(documentXml: string): string {
  return [...documentXml.matchAll(/<w:instrText[^>]*>([\s\S]*?)<\/w:instrText>/g)]
    .map((match) => match[1])
    .join(" ");
}

function paragraphs(documentXml: string): string[] {
  return documentXml.match(/<w:p\b[\s\S]*?<\/w:p>/g) ?? [];
}

describe("estrutura OOXML de layout e sumario", () => {
  it("gera DOCX geral com updateFields, sumario, margens, fonte e titulos", async () => {
    const fields = {
      ...emptyAcademicFields(),
      workType: "monografia" as const,
      author: "Maria Silva",
      title: "Pesquisa UFLA",
      location: "Lavras - MG",
      year: "2026",
      resumo: "Resumo.",
      abstractText: "Abstract.",
      referencias: "SILVA, M. Pesquisa. Lavras: UFLA, 2024.",
    };

    const editorText = "# 1 Introducao\nTexto comum.\n## 1.1 Contexto\nTexto.\n> Citacao longa com recuo.";
    const { documentXml, stylesXml, settingsXml } = await docxParts(await generateDocxBlob({ fields, editorText }));
    const headingParagraph = paragraphs(documentXml).find((paragraph) => paragraph.includes("1 INTRODUCAO") && paragraph.includes('w:val="Heading1"')) ?? "";

    expect(settingsXml).toMatch(/<w:updateFields\b/);
    expect(tocInstruction(documentXml)).toContain("TOC");
    expect(documentXml).toMatch(/SUM[\s\S]{0,80}RIO/);
    expect(documentXml).toContain("1 INTRODUCAO");
    expect(documentXml).toContain("1.1 Contexto");
    expect(documentXml).toContain("<w:pgMar");
    expect(documentXml).toContain(`w:top="${UFLA_RULES.margins.topTwip}"`);
    expect(documentXml).toContain(`w:left="${UFLA_RULES.margins.leftTwip}"`);
    expect(`${stylesXml}\n${documentXml}`).toContain("Times New Roman");
    expect(headingParagraph).toContain('w:val="Heading1"');
    expect(documentXml).toContain(`w:left="${UFLA_RULES.typography.longQuoteLeftIndentTwip}"`);
  });

  it("gera projeto de pesquisa com sumario atualizavel e layout OOXML coerente", async () => {
    const fields = {
      ...emptyAcademicFields(),
      workType: "projeto_pesquisa" as const,
      author: "Maria Silva",
      title: "Projeto UFLA",
      location: "Lavras - MG",
      year: "2026",
      resumo: "Resumo.",
      abstractText: "Abstract.",
      referencias: "SILVA, M. Projeto. Lavras: UFLA, 2024.",
    };

    const editorText = "# 1 Introducao\nTexto.\n# 2 Metodologia\nTexto.";
    const { documentXml, stylesXml, settingsXml } = await docxParts(await generateResearchProjectDocxBlob({ fields, editorText }));

    expect(settingsXml).toMatch(/<w:updateFields\b/);
    expect(tocInstruction(documentXml)).toContain("TOC");
    expect(documentXml).toMatch(/SUM[\s\S]{0,80}RIO/);
    expect(documentXml).toContain("1 INTRODUCAO");
    expect(documentXml).toContain("2 METODOLOGIA");
    expect(documentXml).toContain("<w:pgMar");
    expect(documentXml).toContain(`w:right="${UFLA_RULES.margins.rightTwip}"`);
    expect(`${stylesXml}\n${documentXml}`).toContain("Times New Roman");
    expect(documentXml).toContain('w:val="Heading1"');
  });
});
