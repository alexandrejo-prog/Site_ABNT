import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const analysisPath = new URL("../../artifacts/ufla-compliance/pdf-physical-analysis.json", import.meta.url);

describe("blank page detection", () => {
  const analysis = JSON.parse(readFileSync(analysisPath, "utf-8"));

  it("não deve detectar páginas em branco introduzidas pela normalização", () => {
    const blankPages = analysis.summary.blankPages;
    const normalizationArtifacts = blankPages.filter(
      (b: any) => b.cause === "normalization_artifact_not_authorized_by_explicit_ufla_rule",
    );
    expect(normalizationArtifacts.length).toBe(0);
  });

  it("não deve detectar páginas em branco indevidas no corpo principal", () => {
    const blankPages = analysis.summary.blankPages;
    const unintended = blankPages.filter((b: any) => b.cause === "empty");
    expect(unintended.length).toBe(0);
  });

  it("deve registrar a causa de cada página em branco", () => {
    for (const bp of analysis.summary.blankPages) {
      expect(bp.classification).toBe("blank");
      expect(bp.cause).toBeDefined();
      expect(["intentional_break", "intentional_break_between_pretextual", "header_footer_only", "empty", "normalization_artifact_not_authorized_by_explicit_ufla_rule"]).toContain(bp.cause);
    }
  });

  it("deve manter a classificação de páginas em branco consistente com o documento", () => {
    expect(["passed", "not-detected"]).toContain(analysis.coverage.blankPages);
    expect(analysis.summary.blankPages.length).toBe(0);
  });
});
