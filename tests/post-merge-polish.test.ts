import { describe, expect, it } from "vitest";
import { AcademicFields, emptyAcademicFields } from "../src/ufla-rules";
import { hasBlockingErrors, validateWork } from "../src/validators";

function baseFields(overrides: Partial<AcademicFields> = {}): AcademicFields {
  return {
    ...emptyAcademicFields(),
    workType: "dissertacao",
    author: "Alexandre José de Oliveira",
    title: "Métricas, trabalho e saúde dos servidores técnico-administrativos em educação da UFLA",
    advisor: "Prof. Dr. Nome Real",
    program: "Programa de Pós-Graduação em Educação Científica e Ambiental",
    workNature: "Dissertação apresentada à Universidade Federal de Lavras, como parte das exigências do Programa de Pós-Graduação em Educação Científica e Ambiental do Instituto de Ciências Naturais, para obtenção do título de Mestre em Ciências.",
    resumo: "Este estudo analisa o Programa de Gestão e Desempenho no trabalho dos servidores técnico-administrativos em educação da UFLA por meio de pesquisa qualitativa.",
    palavrasChave: "PGD; trabalho; saúde",
    abstractText: "This study analyzes the Management and Performance Program in the work of technical-administrative education staff at UFLA through qualitative research.",
    keywords: "PGD; work; health",
    introducao: "Introdução.",
    referencias: "SILVA, M. Livro de teste. Lavras: UFLA, 2024.",
    impactoSocial: "Contribui para o debate institucional sobre saúde e condições de trabalho dos TAEs.",
    impactoCientifico: "Produz conhecimento sobre gestão, trabalho e Educação Ambiental Crítica no ambiente universitário.",
    ...overrides,
  };
}

describe("polimento pós-guardrails", () => {
  it("trata orientador ausente em dissertação como erro bloqueante", () => {
    const issues = validateWork(baseFields({ advisor: "" }));
    expect(issues).toContainEqual(expect.objectContaining({ code: "advisor-required", severity: "error" }));
    expect(hasBlockingErrors(issues)).toBe(true);
  });

  it("bloqueia natureza gramaticalmente quebrada", () => {
    const issues = validateWork(baseFields({ workNature: "Dissertação apresentada à Universidade Federal de Lavras, como parte das exigências do Educação Científica e Ambiental do Instituto de Ciências Naturais, para obtenção do título de Mestre em Ciências." }));
    expect(issues).toContainEqual(expect.objectContaining({ code: "work-nature-malformed", severity: "error" }));
  });

  it("bloqueia conflito entre dissertação e natureza de projeto", () => {
    const issues = validateWork(baseFields({ workNature: "Projeto de pesquisa apresentado à Universidade Federal de Lavras, como parte das atividades do Programa de Pós-Graduação em Educação Científica e Ambiental." }));
    expect(issues).toContainEqual(expect.objectContaining({ code: "work-type-nature-conflict", severity: "error" }));
  });

  it("não bloqueia natureza coerente de dissertação PPGECA", () => {
    const issues = validateWork(baseFields());
    expect(issues).not.toContainEqual(expect.objectContaining({ code: "advisor-required" }));
    expect(issues).not.toContainEqual(expect.objectContaining({ code: "work-nature-malformed" }));
    expect(issues).not.toContainEqual(expect.objectContaining({ code: "work-type-nature-conflict" }));
  });
});
