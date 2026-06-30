import { describe, expect, it } from "vitest";
import { AcademicFields, emptyAcademicFields } from "../src/ufla-rules";
import { validateWork } from "../src/validators";

function baseFields(overrides: Partial<AcademicFields> = {}): AcademicFields {
  return {
    ...emptyAcademicFields(),
    workType: "artigo",
    author: "Maria Silva",
    title: "Qualidade do café no sul de Minas",
    location: "Lavras - MG",
    year: "2026",
    resumo: "Resumo do trabalho.",
    palavrasChave: "café; qualidade",
    introducao: "Texto da introdução.",
    referencias: "SILVA, M. Qualidade do café. Lavras: UFLA, 2024.",
    ...overrides,
  };
}

describe("validação normativa", () => {
  it("acusa erro quando falta título", () => {
    const issues = validateWork(baseFields({ title: "" }));
    expect(issues).toContainEqual(
      expect.objectContaining({ severity: "error", code: "title-required" }),
    );
  });

  it("acusa erro quando falta autor", () => {
    const issues = validateWork(baseFields({ author: "" }));
    expect(issues).toContainEqual(
      expect.objectContaining({ severity: "error", code: "author-required" }),
    );
  });

  it("alerta orientador ausente para monografia, dissertação e tese", () => {
    for (const workType of ["monografia", "dissertacao", "tese"] as const) {
      const issues = validateWork(baseFields({ workType, advisor: "" }));
      expect(issues).toContainEqual(
        expect.objectContaining({
          severity: "warning",
          code: "advisor-required",
        }),
      );
    }
  });

  it("alerta quando referências e introdução estão ausentes", () => {
    const issues = validateWork(baseFields({ referencias: "", introducao: "" }));
    expect(issues).toContainEqual(
      expect.objectContaining({ severity: "warning", code: "references-required" }),
    );
    expect(issues).toContainEqual(
      expect.objectContaining({ severity: "warning", code: "intro-required" }),
    );
  });

  it("aceita artigo com campos mínimos", () => {
    const issues = validateWork(baseFields());
    expect(issues.filter((issue) => issue.severity === "error")).toHaveLength(0);
  });

  it("resume alertas repetidos de referências", () => {
    const issues = validateWork(
      baseFields({
        referencias: [
          "REFERENCIA AMBIGUA SEM TITULO IDENTIFICAVEL 2024",
          "OUTRA REFERENCIA AMBIGUA SEM TITULO IDENTIFICAVEL 2025",
          "TERCEIRA REFERENCIA AMBIGUA SEM TITULO IDENTIFICAVEL 2026",
          "BRASIL. Lei normativa preservada sem destaque automático. 2024.",
          "MINAS GERAIS. Decreto normativo preservado sem destaque automático. 2025.",
        ].join("\n"),
      }),
    );

    const highlightIssues = issues.filter((issue) => issue.code === "reference-highlight-missing");
    const normativeIssues = issues.filter((issue) => issue.code === "reference-normative-preserved");

    expect(highlightIssues).toHaveLength(1);
    expect(highlightIssues[0].message).toContain("Há 3 referência(s)");
    expect(normativeIssues).toHaveLength(1);
    expect(normativeIssues[0].message).toContain("Há 2 referência(s) normativas");
  });
});
