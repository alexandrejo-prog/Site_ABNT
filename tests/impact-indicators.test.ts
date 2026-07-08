import { describe, expect, it } from "vitest";
import { emptyAcademicFields, type AcademicFields } from "../src/ufla-rules";
import {
  IMPACT_DIMENSIONS,
  assessImpactIndicators,
  buildFlowingImpactText,
  impactPromptSkeleton,
  stripImpactLabels,
} from "../src/impact-indicators";

describe("indicadores de impacto", () => {
  it("define dimensoes orientadoras", () => {
    const ids = IMPACT_DIMENSIONS.map((dimension) => dimension.id);
    expect(ids).toContain("social");
    expect(ids).toContain("cientifico");
    expect(ids).toContain("ambiental");
    expect(ids).toContain("institucional");
  });

  it("avalia cobertura minima", () => {
    const text = Array.from({ length: 90 }, () => "pesquisa social institucional ambiental universidade trabalhadores conhecimento").join(" ");
    const result = assessImpactIndicators(text);

    expect(result.hasMinimumCoverage).toBe(true);
    expect(result.presentDimensions.length).toBeGreaterThanOrEqual(3);
  });

  it("identifica texto insuficiente", () => {
    const result = assessImpactIndicators("Impacto social breve.");

    expect(result.hasMinimumCoverage).toBe(false);
    expect(result.missingDimensions.length).toBeGreaterThan(0);
  });

  it("gera esqueleto de perguntas", () => {
    expect(impactPromptSkeleton()).toContain("Impacto social");
  });

  it("consolida campos separados em texto unico sem rotulos", () => {
    const fields: AcademicFields = {
      ...emptyAcademicFields(),
      workType: "tese",
      impactoSocial: "Beneficia comunidades locais.",
      impactoCientifico: "Avança a pesquisa em educacao.",
      publicoBeneficiado: "Estudantes e orientadores.",
    };
    const text = buildFlowingImpactText(fields);
    expect(text).not.toContain("Impacto social:");
    expect(text).not.toContain("Impacto científico:");
    expect(text).not.toContain("Público beneficiado:");
    expect(text).toContain("Beneficia comunidades locais.");
    expect(text).toContain("Avança a pesquisa em educacao.");
    expect(text).toContain("Estudantes e orientadores.");
  });

  it("stripImpactLabels remove rotulos de texto ja consolidado", () => {
    const text = stripImpactLabels("Impacto social: beneficia a comunidade; Impacto científico: avança a pesquisa.");
    expect(text).not.toContain("Impacto social:");
    expect(text).not.toContain("Impacto científico:");
    expect(text).toContain("beneficia a comunidade");
    expect(text).toContain("avança a pesquisa");
  });

  it("buildFlowingImpactText retorna vazio quando nada informado", () => {
    const fields: AcademicFields = { ...emptyAcademicFields(), workType: "tese" };
    expect(buildFlowingImpactText(fields)).toBe("");
  });
});
