import { describe, it, expect, beforeAll } from "vitest";
import JSZip from "jszip";
import { generateDocxBlob } from "../../src/export-docx";
import { emptyAcademicFields } from "../../src/ufla-rules";
import { loadDocxParts, normalizedParagraphTexts, tocInstruction } from ".././test-utils/ooxml";

/**
 * Layout real do DOCX gerado vivo (dissertacao sintetica minima).
 * Falha se margens/fonte/espacamento/cabecalho/rodape fugirem do Manual.
 * Complementa tests/acceptance/rendered-layout.test.ts (que so le artefato pre-gerado).
 */
describe("acceptance: layout renderizado (DOCX vivo)", () => {
  const fields = {
    ...emptyAcademicFields(),
    workType: "dissertacao" as const,
    author: "Maria Silva",
    title: "Qualidade do cafe no sul de Minas",
    location: "Lavras - MG",
    year: "2026",
    program: "EducaÃ§Ã£o CientÃ­fica e Ambiental",
    advisor: "Prof. Dr. JoÃ£o Silva",
    resumo: "Resumo do trabalho.",
    palavrasChave: "cafe; qualidade",
    abstractText: "Abstract text.",
    keywords: "coffee; quality",
    referencias: "SILVA, M. Qualidade do cafe. Lavras: UFLA, 2024.",
  };
  const editorText = "# 1 INTRODUCAO\nTexto.\n# 2 REFERENCIAS\n";

  let documentXml: string;
  let headerXmls: string[];
  let footerCount: number;

  beforeAll(async () => {
    const blob = await generateDocxBlob({ fields, editorText });
    const parts = await loadDocxParts(blob);
    documentXml = parts.documentXml;

    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    headerXmls = await Promise.all(
      Object.keys(zip.files)
        .filter((n) => /word\/header\d+\.xml/.test(n))
        .map((n) => zip.file(n)!.async("string")),
    );
    footerCount = Object.keys(zip.files).filter((n) => /word\/footer\d+\.xml/.test(n)).length;
  });

  it("margens 3/3/2/2 cm (1701/1701/1134/1134 twips)", () => {
    expect(documentXml).toMatch(/w:pgMar[^>]*w:top="1701"/);
    expect(documentXml).toMatch(/w:pgMar[^>]*w:left="1701"/);
    expect(documentXml).toMatch(/w:pgMar[^>]*w:bottom="1134"/);
    expect(documentXml).toMatch(/w:pgMar[^>]*w:right="1134"/);
  });

  it("fonte Times New Roman presente", () => {
    expect(documentXml).toContain("Times New Roman");
  });

  it("corpo com espacamento 1,5 (w:line=360) e primeira linha 1,25 cm (709 twips)", () => {
    expect(documentXml).toMatch(/w:spacing[^>]*w:line="360"/);
    expect(documentXml).toMatch(/w:ind[^>]*w:firstLine="709"/);
  });

  it("cabecalho com campo PAGE, 10 pt (w:sz 20) e alinhamento a direita", () => {
    expect(headerXmls.length).toBeGreaterThan(0);
    const header = headerXmls.join("");
    expect(header).toContain("PAGE");
    expect(header).toMatch(/w:sz w:val="20"/);
    expect(header).toMatch(/w:jc w:val="right"/);
  });

  it("sem rodape de pagina inesperado no DOCX gerado (ausencia quando nao aplicavel)", () => {
    // O Manual UFLA usa cabecalho com numero de pagina (canto superior direito,
    // §3.2.7); rodape de pagina NAO e obrigatorio de forma incondicional. A
    // aplicabilidade e condicional (notas quando utilizadas, referencias de anexo,
    // fontes/legendas abaixo do elemento) — coberta por tests/footer-*.test.ts.
    // Decisao automatica: RODAPE = COBERTURA PARCIAL; ausencia verificada aqui.
    expect(footerCount).toBe(0);
    expect(documentXml).not.toContain("<w:footerReference");
    expect(documentXml).not.toContain("<w:footerReference ");
  });

  it("capa contem a instituicao UNIVERSIDADE FEDERAL DE LAVRAS", () => {
    const texts = normalizedParagraphTexts(documentXml);
    expect(texts.some((t) => t.includes("UNIVERSIDADE FEDERAL DE LAVRAS"))).toBe(true);
  });

  it("sumario com campo TOC real", () => {
    expect(normalizedParagraphTexts(documentXml)).toContain("SUMARIO");
    expect(tocInstruction(documentXml)).toContain("TOC");
  });
});

