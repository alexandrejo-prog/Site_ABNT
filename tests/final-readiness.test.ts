import { describe, expect, it } from "vitest";
import { finalReadinessReport } from "../src/final-readiness";

describe("prontidao final", () => {
  it("consolida pendencias conhecidas", () => {
    const report = finalReadinessReport();

    expect(report.readyForLocalValidation).toBe(true);
    expect(report.unresolvedHighPriority.length).toBeGreaterThan(0);
    expect(report.unresolvedCoverage).toContain("catalog-card");
    expect(report.accessibilityPending.length).toBeGreaterThan(0);
  });
});
