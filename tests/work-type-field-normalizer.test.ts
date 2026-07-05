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
    expect(fields.workNature).toContain("Licenciado em Física");
    expect(fields.workNature).not.toContain("Projeto de pesquisa apresentado");
  });

  it("evita titulo duplicado quando monografia nao tem curso informado", () => {
    const fields = normalizeFieldsForSelectedModel({
      ...emptyAcademicFields(),
      workType: "monografia",
      workNature: "Projeto de pesquisa apresentado à Universidade Federal de Lavras.",
    });

    expect(fields.workNature).toContain("curso de graduação informado pelo usuário");
    expect(fields.workNature).toContain("grau acadêmico correspondente");
    expect(fields.workNature).not.toContain("título de título correspondente");
  });

  it("remove orientador quando importacao confunde local com nome", () => {
    const fields = normalizeFieldsForSelectedModel({
      ...emptyAcademicFields(),
      workType: "monografia",
      location: "LAVRAS - MG",
      advisor: "LAVRAS - MG",
    });

    expect(fields.advisor).toBe("");
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

  it("usa titulo neutro quando artigo simples nao tem titulo detectado", () => {
    const fields = normalizeFieldsForSelectedModel({
      ...emptyAcademicFields(),
      workType: "artigo",
      title: "",
    });

    expect(fields.title).toBe("Artigo acadêmico sem título detectado");
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
