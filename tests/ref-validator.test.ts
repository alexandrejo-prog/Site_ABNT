import { describe, expect, it } from "vitest";
import { validateReferencesText } from "../src/references-validator";

function codesFor(value: string): string[] {
  return validateReferencesText(value).map((issue) => issue.code);
}

describe("ref validator", () => {
  it("ignores low confidence institutional title mark", () => {
    const issues = validateReferencesText(
      "UNIVERSIDADE FEDERAL DE LAVRAS. Politica de Saude Mental da UFLA. Lavras: UFLA, 2024.",
    );

    expect(issues.map((issue) => issue.code)).not.toContain("reference-highlight-missing");
  });

  it("alerta trabalho academico sem numero de paginas", () => {
    expect(codesFor(
      "MOTA, Cynthia Araújo. A atividade de trabalho e o adoecimento psíquico em técnico-administrativos em educação. 2018. Dissertação (Mestrado Profissional em Psicologia Organizacional e do Trabalho) – Universidade Potiguar, Natal, 2018.",
    )).toContain("reference-academic-pages-missing");
  });

  it("alerta documento juridico sem orgao ou editora depois do local", () => {
    expect(codesFor(
      "BRASIL. Instrução Normativa Conjunta SGP-SRT-SEGES/MGI nº 24, de 28 de julho de 2023. Estabelece orientações sobre o PGD. Brasília, DF, 2023.",
    )).toContain("reference-legal-publisher-missing");
  });

  it("alerta documento institucional sem editora ou orgao responsavel", () => {
    expect(codesFor(
      "UNIVERSIDADE FEDERAL DE LAVRAS. Conselho Universitário. Resolução CUNI nº 074, de 23 de novembro de 2017. Lavras, MG, 2017.",
    )).toContain("reference-institutional-publisher-missing");
  });

  it("alerta doi como url e url em markdown ou sinais", () => {
    const codes = codesFor(
      "FESTOZO, Marina Battistetti. Relações históricas entre a Educação Ambiental e a participação social. Revista Tempos e Espaços em Educação, São Cristóvão, SE, v. 11, n. 24, p. 253-266, 2018. DOI: https://doi.org/10.20952/revtee.v11i24.6677. [https://periodicos.ufs.br/revtee/article/view/6677](https://periodicos.ufs.br/revtee/article/view/6677).",
    );

    expect(codes).toContain("reference-doi-url-normalized");
    expect(codes).toContain("reference-url-markup-normalized");
  });

  it("alerta grafia de autor que precisa de conferencia", () => {
    expect(codesFor(
      "DEJOURS, Christophe. A loucura do trabalho: estudo de psicopatologia do trabalho. 6. ed. São Paulo: Cortez, 2015.",
    )).toContain("reference-author-spelling-review");
  });
});
