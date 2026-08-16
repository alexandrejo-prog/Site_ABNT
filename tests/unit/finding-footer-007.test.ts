import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { generateDocxBlob } from "../../src/export-docx";
import { emptyAcademicFields } from "../../src/ufla-rules";

describe("FINDING-FOOTER-007: fontes e legendas", () => {
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

  it("parágrafo combinando legenda e fonte deve ser separado em dois parágrafos com tamanhos corretos", async () => {
    const editorText = `# 1 INTRODUCAO\nFigura 1: Modelo do sistema político Fonte: Dagnino (2002, online).\n`;
    const blob = await generateDocxBlob({
      fields: dissertacaoFields(),
      editorText,
    });
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const docXml = (await zip.file("word/document.xml")?.async("string")) ?? "";

    const paragraphs = docXml.match(/<w:p\b[^>]*>.*?<\/w:p>/gs) ?? [];
    const captionParagraphs = paragraphs.filter((p) => {
      const hasCaption = p.includes("Modelo do sistema político");
      const hasPageref = p.includes("PAGEREF");
      return hasCaption && !hasPageref;
    });
    const fonteParagraphs = paragraphs.filter((p) => {
      const hasFonte = p.includes("Fonte: Dagnino");
      const hasPageref = p.includes("PAGEREF");
      return hasFonte && !hasPageref;
    });

    expect(captionParagraphs.length).toBeGreaterThanOrEqual(1);
    expect(fonteParagraphs.length).toBeGreaterThanOrEqual(1);

    const captionSize = captionParagraphs[0].match(/<w:sz[^>]*w:val="(\d+)"/)?.[1];
    const fonteSize = fonteParagraphs[0].match(/<w:sz[^>]*w:val="(\d+)"/)?.[1];

    expect(captionSize).toBe("24");
    expect(fonteSize).toBe("22");
  });
});
