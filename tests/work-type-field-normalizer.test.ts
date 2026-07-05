import { describe, expect, it } from "vitest";
import { emptyAcademicFields } from "../src/ufla-rules";
import { normalizeFieldsForSelectedModel } from "../src/work-type-field-normalizer";

describe("normalizacao de campos por modelo selecionado", () => {
  it("converte natureza de projeto quando o modelo selecionado e monografia", () => {
    const fields = normalizeFieldsForSelectedModel({
      ...emptyAcademicFields(),
      workType: "monografia",
      course: "Licenciatura em Física",
      workNature: "Projeto de pesquisa apresentado à Universidade Federal de Lavras, como parte das atividades do Programa.",
    });

    expect(fields.workNature).toContain("Monografia apresentada à Universidade Federal de Lavras");
    expect(fields.workNature).not.toContain("Projeto de pesquisa apresentado");
  });

  it("remove natureza e pre-textuais indevidos de artigo simples", () => {
    const fields = normalizeFieldsForSelectedModel({
      ...emptyAcademicFields(),
      workType: "artigo",
      workNature: "Projeto de pesquisa apresentado à Universidade Federal de Lavras.",
      dedicatoria: "Texto",
      indicadoresImpacto: "Texto",
    });

    expect(fields.workNature).toBe("");
    expect(fields.dedicatoria).toBe("");
    expect(fields.indicadoresImpacto).toBe("");
  });

  it("remove estrutura de monografia em modelos cpg", () => {
    const fields = normalizeFieldsForSelectedModel({
      ...emptyAcademicFields(),
      workType: "resumo_expandido_cpg",
      workNature: "Monografia apresentada à Universidade Federal de Lavras.",
      epigrafe: "Texto",
      impactIndicators: "Texto",
    });

    expect(fields.workNature).toBe("");
    expect(fields.epigrafe).toBe("");
    expect(fields.impactIndicators).toBe("");
  });
});
