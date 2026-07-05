import { describe, expect, it } from "vitest";
import { IMPACT_DIMENSIONS, assessImpactIndicators, impactPromptSkeleton } from "../src/impact-indicators";

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
});
