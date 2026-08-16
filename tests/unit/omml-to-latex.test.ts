import { describe, expect, it } from "vitest";
import katex from "katex";
import { ommlToLatex } from "../../src/omml-to-latex";

const oMath = (inner: string) => `<m:oMath>${inner}</m:oMath>`;
const run = (text: string) => `<m:r><m:t>${text}</m:t></m:r>`;

describe("ommlToLatex — conversão OMML → LaTeX (eq importadas no preview)", () => {
  it("texto simples", () => {
    expect(ommlToLatex(oMath(run("E = mc²")))).toBe("E = mc²");
  });

  it("fração (m:f) → \\frac", () => {
    const xml = oMath(
      "<m:f><m:num><m:r><m:t>a</m:t></m:r></m:num><m:den><m:r><m:t>b</m:t></m:r></m:den></m:f>",
    );
    expect(ommlToLatex(xml)).toBe("\\frac{a}{b}");
  });

  it("raiz com grau (m:rad) → \\sqrt[3]", () => {
    const xml = oMath(
      "<m:rad><m:deg><m:r><m:t>3</m:t></m:r></m:deg><m:e><m:r><m:t>x</m:t></m:r></m:e></m:rad>",
    );
    expect(ommlToLatex(xml)).toBe("\\sqrt[3]{x}");
  });

  it("sobrescrito (m:sSup) → base^{sup}", () => {
    const xml = oMath(
      "<m:sSup><m:e><m:r><m:t>x</m:t></m:r></m:e><m:sup><m:r><m:t>2</m:t></m:r></m:sup></m:sSup>",
    );
    expect(ommlToLatex(xml)).toBe("{x}^{2}");
  });

  it("sub+sup (m:sSubSup) → base_{sub}^{sup}", () => {
    const xml = oMath(
      "<m:sSubSup><m:e><m:r><m:t>x</m:t></m:r></m:e><m:sub><m:r><m:t>i</m:t></m:r></m:sub><m:sup><m:r><m:t>2</m:t></m:r></m:sup></m:sSubSup>",
    );
    expect(ommlToLatex(xml)).toBe("{x}_{i}^{2}");
  });

  it("somatório com limites (m:nary ∑) → \\sum_{i=1}^{n}", () => {
    const xml = oMath(
      "<m:nary><m:naryPr><m:chr m:val=\"∑\"/></m:naryPr><m:sub><m:r><m:t>i=1</m:t></m:r></m:sub><m:sup><m:r><m:t>n</m:t></m:r></m:sup><m:e><m:r><m:t>x</m:t></m:r></m:e></m:nary>",
    );
    expect(ommlToLatex(xml)).toBe("\\sum_{i=1}^{n} x");
  });

  it("integral (m:nary ∫) → \\int_{a}^{b}", () => {
    const xml = oMath(
      "<m:nary><m:naryPr><m:chr m:val=\"∫\"/></m:naryPr><m:sub><m:r><m:t>a</m:t></m:r></m:sub><m:sup><m:r><m:t>b</m:t></m:r></m:sup><m:e><m:r><m:t>x</m:t></m:r></m:e></m:nary>",
    );
    expect(ommlToLatex(xml)).toBe("\\int_{a}^{b} x");
  });

  it("limite com limite abaixo (m:limLow) → \\lim_{x → 0}", () => {
    const xml = oMath(
      "<m:limLow><m:lim><m:r><m:t>lim</m:t></m:r></m:lim><m:e><m:r><m:t>x → 0</m:t></m:r></m:e></m:limLow>",
    );
    expect(ommlToLatex(xml)).toBe("\\lim_{x → 0}");
  });

  it("delimitadores (m:d) → \\left( ... \\right)", () => {
    const xml = oMath(
      "<m:d><m:dPr><m:begChr m:val=\"(\"/><m:endChr m:val=\")\"/></m:dPr><m:e><m:r><m:t>x</m:t></m:r></m:e></m:d>",
    );
    expect(ommlToLatex(xml)).toBe("\\left(x\\right)");
  });

  it("delimitadores { } escapados → \\left\\{ ... \\right\\}", () => {
    const xml = oMath(
      "<m:d><m:dPr><m:begChr m:val=\"{\"/><m:endChr m:val=\"}\"/></m:dPr><m:e><m:r><m:t>x</m:t></m:r></m:e></m:d>",
    );
    expect(ommlToLatex(xml)).toBe("\\left\\{x\\right\\}");
  });

  it("função (m:func sin) → \\sin\\left(x\\right)", () => {
    const xml = oMath(
      "<m:func><m:fName><m:r><m:t>sin</m:t></m:r></m:fName><m:e><m:r><m:t>x</m:t></m:r></m:e></m:func>",
    );
    expect(ommlToLatex(xml)).toBe("\\sin\\left(x\\right)");
  });

  it("escapa caracteres LaTeX especiais no texto (_, ^, %, &)", () => {
    expect(ommlToLatex(oMath(run("a_b % &")))).toBe("a\\_b \\% \\&");
  });

  it("w:t dentro de m:r também é lido", () => {
    const xml = oMath('<m:r><w:t xml:space="preserve"> + 2x - 1 = 0</w:t></m:r>');
    expect(ommlToLatex(xml)).toBe("+ 2x - 1 = 0");
  });

  it("XML inválido → string vazia (degradação graciosa)", () => {
    expect(ommlToLatex("<m:oMath>")).toBe("");
  });

  it("round-trip do token OMML importado gera LaTeX KaTeX-válido", () => {
    // Formato que o import-docx grava no rascunho (token \\uF001OMML:...)
    const xml =
      '<m:oMath><m:f><m:num><m:r><m:t>x</m:t></m:r></m:num><m:den><m:r><m:t>2</m:t></m:r></m:den></m:f><m:r><m:t> + </m:t></m:r><m:r><m:t>y</m:t></m:r></m:oMath>';
    const latex = ommlToLatex(xml);
    expect(latex).toBe("\\frac{x}{2} + y");
    // KaTeX aceita o resultado sem lançar
    expect(() => katex.renderToString(latex, { throwOnError: true, strict: false })).not.toThrow();
  });
});
