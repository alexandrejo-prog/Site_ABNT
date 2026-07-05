import { describe, expect, it } from "vitest";
import { documentAdherenceReport } from "../src/document-adherence";
import type { ValidationIssue } from "../src/validators";

describe("aderencia do documento", () => {
  it("marca documento sem erro como geravel", () => {
    const issues: ValidationIssue[] = [{ severity: "warning", code: "w", message: "Alerta" }];
    const report = documentAdherenceReport(issues);

    expect(report.canGenerateSafely).toBe(true);
    expect(report.warningCodes).toEqual(["w"]);
    expect(report.summary).toContain("Aderência");
  });

  it("marca documento com erro como bloqueado", () => {
    const issues: ValidationIssue[] = [{ severity: "error", code: "e", message: "Erro" }];
    const report = documentAdherenceReport(issues);

    expect(report.canGenerateSafely).toBe(false);
    expect(report.blockingCodes).toEqual(["e"]);
  });
});
