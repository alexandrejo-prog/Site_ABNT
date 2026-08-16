import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { generateDocxBlob } from "../../src/export-docx";
import { emptyAcademicFields } from "../../src/ufla-rules";

describe("FINDING-FOOTER-007: fontes e legendas — negativo", () => {
  function dissertacaoFields() {
    return {
      ...emptyAcademicFields(),
      workType: "dissertacao" as const,
      author: "MARIA SILVA",
      title: "Título da pesquisa",
      program: "Programa de Pós-Graduação",
      advisor: "Prof. Dr. João Santos",
      location: "Lavras - MG",
      year: "2026",
      resumo: "Resumo.",
      palavrasChave: "teste",
    };
  }

  it("não deve conter parágrafos com Fonte: e tamanho 24 (2x11pt) no DOCX gerado", async () => {
    const editorText = `# 1 INTRODUCAO\nFigura 1: Modelo do sistema político Fonte: Dagnino (2002, online).\nFigura 2: Classificação Fonte: Diadorim (2012).\nTabela 1: Dados Fonte: Autor (2026).\n`;
    const blob = await generateDocxBlob({
      fields: dissertacaoFields(),
      editorText,
    });
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const docXml = (await zip.file("word/document.xml")?.async("string")) ?? "";

    const paragraphs = docXml.match(/<w:p\b[^>]*>.*?<\/w:p>/gs) ?? [];
    const badParagraphs = paragraphs.filter((p) => {
      if (!/Fonte:/i.test(p)) return false;
      const sz = p.match(/<w:sz[^>]*w:val="(\d+)"/)?.[1];
      return sz === "24";
    });

    expect(badParagraphs).toHaveLength(0);
  });
});
