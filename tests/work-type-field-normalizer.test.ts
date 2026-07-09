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

  it("nao gera prosa falsa quando monografia nao tem curso informado", () => {
    const fields = normalizeFieldsForSelectedModel({
      ...emptyAcademicFields(),
      workType: "monografia",
      workNature: "Projeto de pesquisa apresentado à Universidade Federal de Lavras.",
    });

    expect(fields.workNature).not.toContain("curso de graduação informado pelo usuário");
    expect(fields.workNature).not.toContain("grau acadêmico correspondente");
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

  it("normaliza multiplos emails no campo course quando modelo e cpg", () => {
    const fields = normalizeFieldsForSelectedModel({
      ...emptyAcademicFields(),
      workType: "resumo_expandido_cpg",
      course: "autor1@ufla.br, autor2@ufla.br autor3@ufla.br",
    });

    expect(fields.course).toBe("autor1@ufla.br; autor2@ufla.br; autor3@ufla.br");
  });

  it("nao trata curso de monografia como email", () => {
    const fields = normalizeFieldsForSelectedModel({
      ...emptyAcademicFields(),
      workType: "monografia",
      course: "Licenciatura em Física, modalidade presencial",
    });

    expect(fields.course).toBe("Licenciatura em Física, modalidade presencial");
  });

  it("preserva curso apenas em monografia academica", () => {
    const fields = normalizeFieldsForSelectedModel({
      ...emptyAcademicFields(),
      workType: "monografia",
      course: "Licenciatura em Física",
    });

    expect(fields.course).toBe("Licenciatura em Física");
  });

  it("remove curso de artigo, projeto, dissertacao, tese e colecao ufla", () => {
    for (const workType of ["artigo", "projeto_pesquisa", "dissertacao", "tese", "software_aplicativo_ufla"] as const) {
      const fields = normalizeFieldsForSelectedModel({
        ...emptyAcademicFields(),
        workType,
        program: "Administração",
        course: "Bacharelado em Administração Pública",
      });

      expect(fields.course).toBe("");
    }
  });

  it("nao usa texto interno da Colecao UFLA como natureza", () => {
    const fields = normalizeFieldsForSelectedModel({
      ...emptyAcademicFields(),
      workType: "software_aplicativo_ufla",
      workNature: "",
    });

    expect(fields.workNature).toContain("Trabalho acadêmico apresentado à Universidade Federal de Lavras");
    expect(fields.workNature).toContain("requisitos acadêmicos aplicáveis");
    expect(fields.workNature).not.toContain("Software e aplicativos UFLA");
    expect(fields.workNature).not.toContain("Colecao Producao Academica");
    expect(fields.workNature).not.toContain("suporte inicial no sistema");
  });

  it("normaliza natureza malformada de dissertacao com PPGECA", () => {
    const fields = normalizeFieldsForSelectedModel({
      ...emptyAcademicFields(),
      workType: "dissertacao",
      program: "Educação Científica e Ambiental",
      workNature: "Dissertação apresentada à Universidade Federal de Lavras, como parte das exigências do Educação Científica e Ambiental...",
    });

    expect(fields.workNature).toContain("Dissertação apresentada à Universidade Federal de Lavras");
    expect(fields.workNature).toContain("Programa de Pós-Graduação em Educação Científica e Ambiental");
    expect(fields.workNature).toContain("para obtenção do título de Mestre em Ciências.");
    expect(fields.workNature).not.toContain("exigências do Educação Científica");
  });

  it("nao duplica prefixo quando programa ja vem formatado", () => {
    const fields = normalizeFieldsForSelectedModel({
      ...emptyAcademicFields(),
      workType: "dissertacao",
      program: "Programa de Pós-Graduação em Educação Científica e Ambiental",
      workNature: "",
    });

    expect(fields.workNature).toContain("Programa de Pós-Graduação em Educação Científica e Ambiental");
    expect(fields.workNature).not.toContain("Programa de Pós-Graduação em Programa de Pós-Graduação");
  });

  it("normaliza natureza de tese com programa valido para doutorado", () => {
    const fields = normalizeFieldsForSelectedModel({
      ...emptyAcademicFields(),
      workType: "tese",
      program: "Administração",
      workNature: "Tese apresentada à Universidade Federal de Lavras, como parte das exigências do Administração...",
    });

    expect(fields.workNature).toContain("Tese apresentada à Universidade Federal de Lavras");
    expect(fields.workNature).toContain("Programa de Pós-Graduação em Administração");
    expect(fields.workNature).toContain("para obtenção do título de Doutor em Ciências.");
  });

  it("substitui natureza generica importada com rotulo quando modelo selecionado e tese", () => {
    const fields = normalizeFieldsForSelectedModel({
      ...emptyAcademicFields(),
      workType: "tese",
      program: "Administração",
      workNature: "Natureza do trabalho: Trabalho acadêmico apresentado à Universidade Federal de Lavras como parte dos requisitos acadêmicos aplicáveis.",
    });

    expect(fields.workNature).toContain("Tese apresentada à Universidade Federal de Lavras");
    expect(fields.workNature).toContain("Programa de Pós-Graduação em Administração");
    expect(fields.workNature).toContain("para obtenção do título de Doutor em Ciências.");
    expect(fields.workNature).not.toContain("Natureza do trabalho:");
    expect(fields.workNature).not.toContain("Trabalho acadêmico apresentado");
  });
});
