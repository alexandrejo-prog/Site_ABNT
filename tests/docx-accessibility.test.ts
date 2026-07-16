import { describe, expect, it } from "vitest";
import { analyzeExportedDocxAccessibility, collectDocxAccessibilityWarnings } from "../src/docx-accessibility";
import { generateDocxBlob } from "../src/export-docx";
import { emptyAcademicFields } from "../src/ufla-rules";
import { loadDocxParts } from "./test-utils/ooxml";

describe("acessibilidade real do DOCX (6a ed. UFLA)", () => {
  it("define idioma pt-BR em docDefaults (w:lang) no DOCX gerado", async () => {
    const fields = {
      ...emptyAcademicFields(),
      workType: "monografia" as const,
      author: "Maria Silva",
      title: "Trabalho UFLA",
      location: "Lavras - MG",
      year: "2026",
      resumo: "Resumo.",
      abstractText: "Abstract.",
      referencias: "SILVA, M. Trabalho. Lavras: UFLA, 2024.",
    };
    const editorText = "# 1 Introducao\nTexto.\n## 1.1 Contexto\nTexto.";
    const { stylesXml } = await loadDocxParts(await generateDocxBlob({ fields, editorText }));

    expect(stylesXml).toMatch(/<w:lang\b[^>]*\bw:val="pt-BR"/i);

    const result = analyzeExportedDocxAccessibility(stylesXml + "");
    const langIssue = result.issues.find((i) => i.id === "doc-language-missing");
    expect(langIssue).toBeUndefined();
  });

  it("inspeciona XML ausente e nao quebra", () => {
    const result = analyzeExportedDocxAccessibility("");
    expect(result.inspected).toBe(false);
    expect(result.issues).toEqual([]);
  });

  it("detecta idioma ausente no XML (sem docDefaults)", () => {
    const result = analyzeExportedDocxAccessibility("<w:document/>");
    expect(result.languageOk).toBe(false);
    expect(result.issues.some((i) => i.id === "doc-language-missing")).toBe(true);
  });

  it("nao considera idioma de run isolado como idioma do documento", () => {
    // w:lang dentro de um run comum (citacao estrangeira) nao conta.
    const xml =
      '<w:document><w:body><w:p><w:r><w:rPr><w:lang w:val="en-US"/></w:rPr></w:r></w:p></w:body></w:document>';
    const result = analyzeExportedDocxAccessibility(xml);
    expect(result.languageOk).toBe(false);
    expect(result.issues.some((i) => i.id === "doc-language-missing")).toBe(true);
  });

  it("considera idioma divergente (nao pt-BR) como aviso, nao como ausente", () => {
    const xml =
      '<w:docDefaults><w:rPrDefault><w:rPr><w:lang w:val="en-US"/></w:rPr></w:rPrDefault></w:docDefaults>';
    const result = analyzeExportedDocxAccessibility(xml);
    expect(result.languageDetected).toBe("en-US");
    expect(result.issues.some((i) => i.id === "doc-language-divergent")).toBe(true);
    expect(result.issues.some((i) => i.id === "doc-language-missing")).toBe(false);
  });

  it("detecta salto de hierarquia no outline (1 -> 1.1.1)", () => {
    const xml = [
      '<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr></w:p>',
      '<w:p><w:pPr><w:pStyle w:val="Heading3"/></w:pPr></w:p>',
    ].join("");
    const result = analyzeExportedDocxAccessibility(xml);
    expect(result.issues.some((i) => i.id === "doc-outline-jump")).toBe(true);
  });

  it("nao gera falso positivo de salto quando os niveis sao continuos", () => {
    const xml = [
      '<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr></w:p>',
      '<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr></w:p>',
      '<w:p><w:pPr><w:pStyle w:val="Heading3"/></w:pPr></w:p>',
    ].join("");
    const result = analyzeExportedDocxAccessibility(xml);
    expect(result.issues.some((i) => i.id === "doc-outline-jump")).toBe(false);
  });

  it("nao conta TOC como salto de hierarquia", () => {
    const xml = [
      '<w:p><w:pPr><w:pStyle w:val="TOC1"/></w:pPr></w:p>',
      '<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr></w:p>',
    ].join("");
    const result = analyzeExportedDocxAccessibility(xml);
    expect(result.issues.some((i) => i.id === "doc-outline-jump")).toBe(false);
  });

  it("detecta figura sem texto alternativo (por desenho)", () => {
    const xml = '<w:drawing><wp:inline><wp:docPr id="1" name="fig"/><a:graphic/></wp:inline></w:drawing>';
    const result = analyzeExportedDocxAccessibility(xml);
    expect(result.issues.some((i) => i.id === "doc-illustration-alt-missing")).toBe(true);
  });

  it("nao gera falso positivo quando a figura tem alt (title/desc)", () => {
    const xml =
      '<w:drawing><wp:inline><wp:docPr id="1" name="fig" title="Grafico de barras"/><a:graphic/></wp:inline></w:drawing>';
    const result = analyzeExportedDocxAccessibility(xml);
    expect(result.issues.some((i) => i.id === "doc-illustration-alt-missing")).toBe(false);
  });

  it("contabiliza corretamente multiplos desenhos (um com alt, outro sem)", () => {
    const xml = [
      '<w:drawing><wp:inline><wp:docPr id="1" title="Ok"/><a:graphic/></wp:inline></w:drawing>',
      '<w:drawing><wp:inline><wp:docPr id="2" name="sem"/><a:graphic/></wp:inline></w:drawing>',
    ].join("");
    const result = analyzeExportedDocxAccessibility(xml);
    const issue = result.issues.find((i) => i.id === "doc-illustration-alt-missing");
    expect(issue).toBeDefined();
    expect(issue?.message).toContain("1 figura(s)");
  });

  it("nao emite aviso de alt para imagem importada com legenda preservada", () => {
    const fields = {
      ...emptyAcademicFields(),
      workType: "monografia" as const,
      imageWarnings: "1 imagem importada com legenda preservada.",
    };
    const editorText = "Texto com [Imagem detectada: figura com legenda].";
    const issues = collectDocxAccessibilityWarnings(fields, editorText);
    expect(issues.some((i) => i.id === "illustration-alt-missing")).toBe(false);
  });
});
