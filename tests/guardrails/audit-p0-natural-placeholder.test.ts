import { describe, expect, it } from "vitest";
import { emptyAcademicFields } from "../../src/ufla-rules";
import { normalizeFieldsForSelectedModel } from "../../src/work-type-field-normalizer";
import { validateWork } from "../../src/validators";

describe("auditoria P0 - bloqueio de placeholder em linguagem natural", () => {
  it("monografia sem curso nao gera workNature com frase placeholder", () => {
    const fields = normalizeFieldsForSelectedModel({
      ...emptyAcademicFields(),
      workType: "monografia",
      workNature: "Projeto de pesquisa apresentado à Universidade Federal de Lavras.",
    });

    expect(fields.workNature).not.toContain("curso de graduação informado pelo usuário");
    expect(fields.workNature).not.toContain("grau acadêmico correspondente");
  });

  it("monografia sem curso gera erro explicito pedindo o curso", () => {
    const issues = validateWork({ ...emptyAcademicFields(), workType: "monografia" });
    const courseIssue = issues.find((issue) => issue.code === "course-required");
    expect(courseIssue).toBeDefined();
    expect(courseIssue?.severity).toBe("error");
  });

  it("dissertacao sem programa gera erro", () => {
    const issues = validateWork({ ...emptyAcademicFields(), workType: "dissertacao" });
    const programIssue = issues.find((issue) => issue.code === "program-required");
    expect(programIssue).toBeDefined();
    expect(programIssue?.severity).toBe("error");
  });

  it("tese sem programa gera erro", () => {
    const issues = validateWork({ ...emptyAcademicFields(), workType: "tese" });
    const programIssue = issues.find((issue) => issue.code === "program-required");
    expect(programIssue).toBeDefined();
    expect(programIssue?.severity).toBe("error");
  });

  it("frase 'grau acadêmico correspondente' dispara natural-placeholder-detected", () => {
    const issues = validateWork({
      ...emptyAcademicFields(),
      workType: "monografia",
      course: "Licenciatura em Física",
      workNature: "Monografia apresentada com grau acadêmico correspondente.",
    });
    const placeholderIssue = issues.find((issue) => issue.code === "natural-placeholder-detected");
    expect(placeholderIssue).toBeDefined();
    expect(placeholderIssue?.severity).toBe("error");
  });

  it("frase 'Programa de Pós-Graduação informado pelo usuário' dispara natural-placeholder-detected", () => {
    const issues = validateWork({
      ...emptyAcademicFields(),
      workType: "dissertacao",
      resumo: "Este trabalho pertence ao Programa de Pós-Graduação informado pelo usuário.",
    });
    const placeholderIssue = issues.find((issue) => issue.code === "natural-placeholder-detected");
    expect(placeholderIssue).toBeDefined();
    expect(placeholderIssue?.severity).toBe("error");
  });

  it("natureza valida de monografia com curso nao dispara erro de placeholder", () => {
    const fields = normalizeFieldsForSelectedModel({
      ...emptyAcademicFields(),
      workType: "monografia",
      course: "Licenciatura em Física",
    });
    expect(fields.workNature).toContain("Licenciado em Física");
    expect(fields.workNature).not.toContain("informado pelo usuário");
  });
});
