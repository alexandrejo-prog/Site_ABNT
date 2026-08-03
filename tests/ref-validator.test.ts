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

  it("alerta documento institucional nao normativo sem editora ou orgao responsavel", () => {
    expect(codesFor(
      "UNIVERSIDADE FEDERAL DE LAVRAS. Política de Saúde Mental. Lavras, MG, 2024.",
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

  it("nao alerta ordem quando referencias estao em ordem alfabetica", () => {
    const codes = codesFor(
      "BRASIL. Lei nº 14.133. Brasília, DF, 2021.\n" +
        "SILVA, Maria. Introdução à pesquisa. Lavras: UFLA, 2023.",
    );
    expect(codes).not.toContain("reference-order");
  });

  it("alerta referencias fora da ordem alfabetica", () => {
    const codes = codesFor(
      "SILVA, Maria. Introdução à pesquisa. Lavras: UFLA, 2023.\n" +
        "BRASIL. Lei nº 14.133. Brasília, DF, 2021.",
    );
    expect(codes).toContain("reference-order");
  });

  it("usa ordenacao pt-BR (acentos) ao avaliar ordem", () => {
    const codes = codesFor(
      "ÁVILA, Carlos. Primeiro autor.\n" +
        "BASTOS, João. Segundo autor.\n" +
        "AQUINO, Pedro. Terceiro autor.",
    );
    expect(codes).toContain("reference-order");
  });

  it("alerta livro sem editora detectada (NBR 6023)", () => {
    expect(codesFor("SILVA, Maria. Introdução à pesquisa. 2023.")).toContain("reference-livro-publisher-missing");
  });

  it("nao alerta livro com editora no formato Local: Editora, ano", () => {
    expect(codesFor("SILVA, Maria. Introdução à pesquisa. Lavras: UFLA, 2023.")).not.toContain("reference-livro-publisher-missing");
  });
});
