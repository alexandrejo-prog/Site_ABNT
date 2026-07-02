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

  it("resume alertas repetidos de referências e não alerta normas destacadas automaticamente", () => {
    const issues = validateWork(
      baseFields({
        referencias: [
          "REFERENCIA AMBIGUA SEM TITULO IDENTIFICAVEL 2024",
          "OUTRA REFERENCIA AMBIGUA SEM TITULO IDENTIFICAVEL 2025",
          "TERCEIRA REFERENCIA AMBIGUA SEM TITULO IDENTIFICAVEL 2026",
          "BRASIL. Lei nº 9.795, de 27 de abril de 1999. Dispõe sobre a educação ambiental. Brasília, DF, 1999.",
          "MINAS GERAIS. Decreto nº 48.636, de 19 de junho de 2023. Regulamenta procedimentos administrativos. Belo Horizonte, MG, 2023.",
        ].join("\n"),
      }),
    );

    const highlightIssues = issues.filter((issue) => issue.code === "reference-highlight-missing");
    const normativeIssues = issues.filter((issue) => issue.code === "reference-normative-preserved");
    const repeatedStrongPhrase = issues.filter((issue) =>
      issue.message.includes("Documento ainda não está plenamente conforme"),
    );

    expect(highlightIssues).toHaveLength(1);
    expect(highlightIssues[0].message).toContain("Há 3 referência(s)");
    expect(highlightIssues[0].message).toContain("Revise antes da versão final");
    expect(normativeIssues).toHaveLength(0);
    expect(repeatedStrongPhrase).toHaveLength(0);
  });

  it("mantém alerta de imagem como conferência informativa", () => {
    const issues = validateWork(
      baseFields({ imageWarnings: "1 imagem(ns) detectada(s)." }),
    );
    const imageIssues = issues.filter((issue) => issue.code === "imported-image-warning");

    expect(imageIssues).toHaveLength(1);
    expect(imageIssues[0].message).toContain("Confira posição, qualidade e legenda");
    expect(imageIssues[0].message).not.toContain("Documento ainda não está plenamente conforme");
  });

  it("alerta PDF obrigatorio para todos os modos CPG", () => {
    for (const workType of ["resumo_cpg", "resumo_expandido_cpg", "artigo_completo_cpg"] as const) {
      const issues = validateWork(baseFields({ workType }), "Texto do corpo.");
      expect(issues).toContainEqual(
        expect.objectContaining({
          severity: "warning",
          code: "cpg-mode-selected",
        }),
      );
      expect(issues.find((issue) => issue.code === "cpg-mode-selected")?.message).toContain("PDF");
    }
  });

  it("alerta limite de 1 pagina para resumo CPG", () => {
    const issues = validateWork(baseFields({ workType: "resumo_cpg" }), "Texto do resumo.");
    expect(issues).toContainEqual(
      expect.objectContaining({
        severity: "warning",
        code: "cpg-resumo-one-page",
      }),
    );
  });

  it("alerta faixa de 4 a 6 paginas para resumo expandido CPG", () => {
    const issues = validateWork(baseFields({ workType: "resumo_expandido_cpg" }), "Texto curto.");
    expect(issues).toContainEqual(
      expect.objectContaining({
        severity: "warning",
        code: "cpg-expanded-pages",
      }),
    );
  });

  it("alerta faixa de 8 a 14 paginas para artigo completo CPG", () => {
    const issues = validateWork(baseFields({ workType: "artigo_completo_cpg" }), "Texto curto.");
    expect(issues).toContainEqual(
      expect.objectContaining({
        severity: "warning",
        code: "cpg-full-pages",
      }),
    );
  });
});
