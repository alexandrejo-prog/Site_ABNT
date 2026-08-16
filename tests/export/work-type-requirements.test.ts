import { describe, expect, it } from "vitest";
import { emptyAcademicFields, type AcademicFields } from "../../src/ufla-rules";
import { validateWork } from "../../src/validators";
import { templateForWorkType } from "../../src/document-template";
import { normalizeWorkType } from "../../src/work-type-resolver";
import { getWorkTypeRequirements } from "../../src/work-type-requirements";

function articleFields(overrides: Partial<AcademicFields> = {}): AcademicFields {
  return {
    ...emptyAcademicFields(),
    workType: "artigo",
    title: "Artigo simples sobre educacao ambiental",
    author: "Maria Silva",
    resumo: "Resumo do artigo simples.",
    palavrasChave: "educacao; ambiente; escola",
    referencias: "SILVA, M. Texto. Lavras: UFLA, 2024.",
    ...overrides,
  };
}

describe("work-type requirements", () => {
  it("normaliza ids, rotulos e aliases antes de decidir template", () => {
    expect(normalizeWorkType("Artigo acadêmico simples")).toBe("artigo");
    expect(normalizeWorkType("artigo simples")).toBe("artigo");
    expect(normalizeWorkType("Projeto de pesquisa (NBR 15287:2025)")).toBe("projeto_pesquisa");
    expect(templateForWorkType("Artigo acadêmico simples").id).toBe("artigo");
  });

  it("marca artigo simples sem metadados institucionais, impacto ou pre-textuais", () => {
    expect(getWorkTypeRequirements("artigo")).toEqual({
      requiresInstitutionalMetadata: false,
      requiresProgramMetadata: false,
      requiresImpactIndicators: false,
      requiresCoverAndFrontMatter: false,
      requiresTableOfContents: false,
      requiresCatalogCard: false,
    });
    expect(getWorkTypeRequirements("Artigo acadêmico simples")).toEqual(getWorkTypeRequirements("artigo"));
  });

  it("mantem requisitos institucionais para dissertacao e tese", () => {
    expect(getWorkTypeRequirements("dissertacao")).toMatchObject({
      requiresInstitutionalMetadata: true,
      requiresProgramMetadata: true,
      requiresImpactIndicators: true,
      requiresCoverAndFrontMatter: true,
      requiresTableOfContents: true,
      requiresCatalogCard: true,
    });
    expect(getWorkTypeRequirements("tese").requiresImpactIndicators).toBe(true);
  });

  it("artigo simples nao emite program-conflict nem exigencias institucionais", () => {
    const issues = validateWork(
      articleFields({
        program: "Educação Científica e Ambiental",
        resumo: "Este artigo comenta o Programa de Pós-Graduação em Engenharia de Sistemas e Automação.",
        indicadoresImpacto: "",
        workNature: "",
        advisor: "",
        course: "",
      }),
      "Texto menciona PPGECA e UFLA no corpo do artigo.",
    );
    const codes = issues.map((issue) => issue.code);

    expect(codes).not.toContain("program-conflict");
    expect(codes).not.toContain("impact-indicators-missing");
    expect(codes).not.toContain("program-required");
    expect(codes).not.toContain("course-required");
    expect(codes).not.toContain("advisor-required");
    expect(codes).not.toContain("program-degree-incompatible");
    expect(issues.filter((issue) => issue.severity === "error")).toHaveLength(0);
  });

  it("dissertacao preserva conflito de programa e exigencia de indicadores", () => {
    const issues = validateWork({
      ...emptyAcademicFields(),
      workType: "dissertacao",
      title: "Pesquisa em docencia",
      author: "Maria Silva",
      advisor: "Prof. Joao Souza",
      program: "Educação Científica e Ambiental",
      resumo: "Pesquisa vinculada ao Programa de Pós-Graduação em Engenharia de Sistemas e Automação.",
    });
    const codes = issues.map((issue) => issue.code);

    expect(codes).toContain("program-conflict");
    expect(codes).toContain("impact-indicators-missing");
  });

  it("projeto de pesquisa preserva diagnostico institucional quando ha conflito", () => {
    const issues = validateWork({
      ...emptyAcademicFields(),
      workType: "projeto_pesquisa",
      title: "Projeto com metadados divergentes",
      author: "Maria Silva",
      program: "Educação Científica e Ambiental",
      resumo: "Pesquisa vinculada ao Programa de Pós-Graduação em Engenharia de Sistemas e Automação.",
    });

    expect(issues.map((issue) => issue.code)).toContain("program-conflict");
  });

  it("placeholder natural continua bloqueando artigo simples", () => {
    const issues = validateWork(articleFields({ title: "grau acadêmico correspondente" }));

    expect(issues).toContainEqual(expect.objectContaining({
      severity: "error",
      code: "natural-placeholder-detected",
    }));
  });
});
