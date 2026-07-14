import { describe, expect, it } from "vitest";
import { isPdfTocEligibleHeadingText, normalizePdfTocHeading, pdfTocHeadingLevel } from "../src/pdf-toc-eligibility";
import { patchPdfTextDraftDocumentXml } from "../src/pdf-text-draft-toc-field-patch";

function tocParagraph(title: string, bookmark: string): string {
  return `<w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr><w:r><w:t>${title}</w:t></w:r><w:r><w:tab/></w:r><w:r><w:t>__PDF_PAGEREF_${bookmark}__</w:t></w:r></w:p>`;
}

function bodyHeading(title: string, bookmark: string): string {
  return `<w:p><w:r><w:t>__PDF_BM_START_${bookmark}__</w:t></w:r><w:r><w:t>${title}</w:t></w:r><w:r><w:t>__PDF_BM_END_${bookmark}__</w:t></w:r></w:p>`;
}

describe("elegibilidade do sumario do rascunho PDF", () => {
  it("aceita titulos academicos e rejeita frases, resultados e campos", () => {
    expect(isPdfTocEligibleHeadingText("1 INTRODUÇÃO")).toBe(true);
    expect(isPdfTocEligibleHeadingText("1.1 Objetivo geral")).toBe(true);
    expect(isPdfTocEligibleHeadingText("4.5.2.10 Constituição de uma comissão de apoio")).toBe(true);
    expect(isPdfTocEligibleHeadingText("REFERÊNCIAS")).toBe(true);
    expect(isPdfTocEligibleHeadingText("APÊNDICES")).toBe(true);

    expect(isPdfTocEligibleHeadingText("4.2 descreve as principais características dos participantes")).toBe(false);
    expect(isPdfTocEligibleHeadingText("15 a 19 anos (22,1%)")).toBe(false);
    expect(isPdfTocEligibleHeadingText("4 têm 4 anos no cargo de gestor atual")).toBe(false);
    expect(isPdfTocEligibleHeadingText("1 funciona, funcionou, tem funcionado muito bem.")).toBe(false);
    expect(isPdfTocEligibleHeadingText("3 Escolaridade:")).toBe(false);
  });

  it("calcula nivel visual pela profundidade da numeracao", () => {
    expect(pdfTocHeadingLevel("1 INTRODUÇÃO")).toBe(1);
    expect(pdfTocHeadingLevel("2.3 Teletrabalho")).toBe(2);
    expect(pdfTocHeadingLevel("4.5.2 Desafios")).toBe(3);
    expect(pdfTocHeadingLevel("4.5.2.10 Comissão")).toBe(4);
    expect(pdfTocHeadingLevel("REFERÊNCIAS")).toBe(1);
  });

  it("aceita titulo numerado colado (4.3Título) e normaliza o espaco", () => {
    expect(isPdfTocEligibleHeadingText("4.3Título")).toBe(true);
    expect(normalizePdfTocHeading("4.3Título")).toBe("4.3 Título");
  });

  it("aceita titulo com numero, ponto e espaco (4.3. Título)", () => {
    expect(isPdfTocEligibleHeadingText("4.3. Título")).toBe(true);
    expect(normalizePdfTocHeading("4.3. Título")).toBe("4.3. Título");
  });

  it("nao altera titulos academicos sem numeracao", () => {
    expect(normalizePdfTocHeading("REFERÊNCIAS")).toBe("REFERÊNCIAS");
    expect(isPdfTocEligibleHeadingText("REFERÊNCIAS")).toBe(true);
  });

  it("envolve w:tab orfao em w:r e mantem lider pontilhado e PAGEREF", () => {
    const tocEntries = `<w:p><w:pPr><w:tabs><w:tab w:val="right" w:leader="dot" w:pos="8500"/></w:tabs></w:pPr><w:r><w:t>1 INTRODUÇÃO</w:t></w:r></w:r><w:tab/><w:r><w:t>__PDF_PAGEREF_PDFBM001__</w:t></w:r></w:p>`;
    const body = `<w:p><w:r><w:t>__PDF_BM_START_PDFBM001__</w:t></w:r><w:r><w:t>1 INTRODUÇÃO</w:t></w:r><w:r><w:t>__PDF_BM_END_PDFBM001__</w:t></w:r></w:p>`;
    const patched = patchPdfTextDraftDocumentXml(`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${tocEntries}${body}</w:body></w:document>`);

    expect(patched).not.toContain("</w:r><w:tab/><w:r>");
    expect(patched).toContain("<w:r><w:tab/></w:r>");
    expect(patched).toContain("w:leader=\"dot\"");
    expect(patched).toContain("PAGEREF PDFBM001 \\h");
    expect(patched).not.toContain("w:outlineLvl");
  });

  it("remove entradas inelegiveis e preserva tab, lider pontilhado e PAGEREF", () => {
    const tocEntries = [
      tocParagraph("1 INTRODUÇÃO", "PDFBM001"),
      tocParagraph("4.2 descreve as principais características", "PDFBM002"),
      tocParagraph("1 funciona, funcionou, tem funcionado muito bem.", "PDFBM003"),
      tocParagraph("3 Escolaridade:", "PDFBM004"),
      tocParagraph("REFERÊNCIAS", "PDFBM005"),
    ].join("");
    const body = [
      bodyHeading("1 INTRODUÇÃO", "PDFBM001"),
      bodyHeading("4.2 descreve as principais características", "PDFBM002"),
      bodyHeading("1 funciona, funcionou, tem funcionado muito bem.", "PDFBM003"),
      bodyHeading("3 Escolaridade:", "PDFBM004"),
      bodyHeading("REFERÊNCIAS", "PDFBM005"),
    ].join("");
    const patched = patchPdfTextDraftDocumentXml(`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${tocEntries}${body}</w:body></w:document>`);

    expect(patched).toContain("1 INTRODUÇÃO");
    expect(patched).toContain("REFERÊNCIAS");
    expect(patched).not.toContain("<w:t>4.2 descreve as principais características</w:t></w:r><w:r><w:tab");
    expect(patched).not.toContain("<w:t>1 funciona, funcionou, tem funcionado muito bem.</w:t></w:r><w:r><w:tab");
    expect(patched).not.toContain("<w:t>3 Escolaridade:</w:t></w:r><w:r><w:tab");
    expect(patched).toContain("w:leader=\"dot\"");
    expect(patched).toContain("w:pos=\"8500\"");
    expect(patched).toContain("<w:tab/>");
    expect(patched).toContain("PAGEREF PDFBM001 \\h");
    expect(patched).toContain("PAGEREF PDFBM005 \\h");
    expect(patched).not.toContain("w:outlineLvl");
  });
});
