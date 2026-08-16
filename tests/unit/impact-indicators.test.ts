import { describe, expect, it } from "vitest";
import { emptyAcademicFields, type AcademicFields } from "../../src/ufla-rules";
import {
  IMPACT_DIMENSIONS,
  assessImpactIndicators,
  buildFlowingImpactText,
  impactPromptSkeleton,
  stripImpactLabels,
} from "../../src/impact-indicators";

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
      impactoEducacional: "Melhora o ensino.",
      impactoAmbiental: "Preserva o meio ambiente.",
      impactoTecnologico: "Gera renda.",
      publicoBeneficiado: "Estudantes e orientadores.",
      aderenciaOds: "Aderência.",
    };
    const text = buildFlowingImpactText(fields);
    expect(text).not.toContain("Impacto social:");
    expect(text).not.toContain("Impacto científico:");
    expect(text).not.toContain("Impacto educacional:");
    expect(text).not.toContain("Impacto ambiental:");
    expect(text).not.toContain("Impacto tecnológico/econômico:");
    expect(text).not.toContain("Público beneficiado:");
    expect(text).not.toContain("Aderência a ODS/política institucional:");
    expect(text).toContain("Beneficia comunidades locais.");
    expect(text).toContain("Avança a pesquisa em educacao.");
    expect(text).toContain("Melhora o ensino.");
    expect(text).toContain("Preserva o meio ambiente.");
    expect(text).toContain("Gera renda.");
    expect(text).toContain("Estudantes e orientadores.");
    expect(text).toContain("Aderência.");
  });

  it("stripImpactLabels remove rotulos de texto ja consolidado", () => {
    const text = stripImpactLabels("Impacto social: beneficia a comunidade; Impacto científico: avança a pesquisa.");
    expect(text).not.toContain("Impacto social:");
    expect(text).not.toContain("Impacto científico:");
    expect(text).toContain("beneficia a comunidade");
    expect(text).toContain("avança a pesquisa");
  });

  it("stripImpactLabels remove todos os rotulos mesmo em linhas separadas por quebra", () => {
    const consolidated = [
      "Impacto social: beneficia a comunidade local.",
      "Impacto científico: avança a pesquisa em educacao.",
      "Impacto educacional: melhora o ensino.",
      "Impacto ambiental: preserva o meio ambiente.",
      "Impacto tecnológico/econômico: gera renda.",
      "Público beneficiado: estudantes e orientadores.",
      "Aderência a ODS/política institucional: alinhado ao plano.",
    ].join("\n");
    const text = stripImpactLabels(consolidated);
    expect(text).not.toContain("Impacto social:");
    expect(text).not.toContain("Impacto científico:");
    expect(text).not.toContain("Impacto educacional:");
    expect(text).not.toContain("Impacto ambiental:");
    expect(text).not.toContain("Impacto tecnológico/econômico:");
    expect(text).not.toContain("Público beneficiado:");
    expect(text).not.toContain("Aderência a ODS/política institucional:");
    expect(text).toContain("beneficia a comunidade local.");
    expect(text).toContain("avança a pesquisa em educacao.");
    expect(text).toContain("estudantes e orientadores.");
    expect(text).not.toContain("\n");
  });

  it("buildFlowingImpactText retorna vazio quando nada informado", () => {
    const fields: AcademicFields = { ...emptyAcademicFields(), workType: "tese" };
    expect(buildFlowingImpactText(fields)).toBe("");
  });
});
