import { describe, expect, it } from "vitest";
import { generateDocxBlob } from "../src/export-docx";
import { generateResearchProjectDocxBlob } from "../src/export-research-project-docx";
import { UFLA_RULES, emptyAcademicFields } from "../src/ufla-rules";
import {
  assertSectionOrder,
  hasHeadingWithText,
  loadDocxParts,
  tocInstruction,
} from "./test-utils/ooxml";

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
    const { documentXml, stylesXml, settingsXml } = await loadDocxParts(await generateDocxBlob({ fields, editorText }));

    expect(settingsXml).toMatch(/<w:updateFields\b/);
    expect(tocInstruction(documentXml)).toContain("TOC");
    expect(tocInstruction(documentXml)).toContain("1-3");
    expect(documentXml).toMatch(/SUM[\s\S]{0,80}RIO/);
    expect(hasHeadingWithText(documentXml, "Heading1", "1 INTRODUÇÃO")).toBe(true);
    expect(hasHeadingWithText(documentXml, "Heading2", "1.1 Contexto")).toBe(true);
    assertSectionOrder(documentXml, ["1 INTRODUÇÃO", "1.1 Contexto"]);
    expect(documentXml).toContain("<w:pgMar");
    expect(documentXml).toContain(`w:top="${UFLA_RULES.margins.topTwip}"`);
    expect(documentXml).toContain(`w:left="${UFLA_RULES.margins.leftTwip}"`);
    expect(`${stylesXml}\n${documentXml}`).toContain("Times New Roman");
    expect(hasHeadingWithText(documentXml, "Heading1", "1 INTRODUÇÃO")).toBe(true);
    expect(documentXml).toContain(`w:left="${UFLA_RULES.typography.longQuoteLeftIndentTwip}"`);
  });

  it("gera projeto de pesquisa com TOC atualizavel e layout OOXML coerente", async () => {
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
    const { documentXml, stylesXml, settingsXml } = await loadDocxParts(await generateResearchProjectDocxBlob({ fields, editorText }));

    expect(settingsXml).toMatch(/<w:updateFields\b/);
    expect(tocInstruction(documentXml)).toContain("TOC");
    expect(tocInstruction(documentXml)).toContain("1-3");
    expect(documentXml).toMatch(/SUM[\s\S]{0,80}RIO/);
    expect(hasHeadingWithText(documentXml, "Heading1", "1 INTRODUÇÃO")).toBe(true);
    expect(hasHeadingWithText(documentXml, "Heading1", "2 METODOLOGIA")).toBe(true);
    assertSectionOrder(documentXml, ["1 INTRODUÇÃO", "2 METODOLOGIA"]);
    expect(documentXml).toContain("<w:pgMar");
    expect(documentXml).toContain(`w:right="${UFLA_RULES.margins.rightTwip}"`);
    expect(`${stylesXml}\n${documentXml}`).toContain("Times New Roman");
    expect(documentXml).toContain(`w:top="${UFLA_RULES.margins.topTwip}"`);
    expect(documentXml).toContain(`w:left="${UFLA_RULES.margins.leftTwip}"`);
    expect(documentXml).toContain(`w:pgNumType w:start="1"`);
  });
});
