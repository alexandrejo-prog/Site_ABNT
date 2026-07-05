import { describe, expect, it } from "vitest";
import { GOVERNANCE_ROADMAP, roadmapCoverageIsValid, unresolvedCoverageIds } from "../src/governance-roadmap";

describe("roadmap de governança", () => {
  it("possui milestones rastreáveis", () => {
    expect(GOVERNANCE_ROADMAP.length).toBeGreaterThanOrEqual(4);
    expect(GOVERNANCE_ROADMAP.every((milestone) => milestone.coverageIds.length > 0)).toBe(true);
  });

  it("usa apenas ids existentes na matriz normativa", () => {
    expect(roadmapCoverageIsValid()).toBe(true);
  });

  it("mantém lista de pendências para acompanhamento", () => {
    expect(unresolvedCoverageIds()).toContain("catalog-card");
    expect(unresolvedCoverageIds()).toContain("review-ux");
  });
});
