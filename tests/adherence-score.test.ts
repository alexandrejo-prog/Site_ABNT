import { describe, expect, it } from "vitest";
import { calculateAdherenceScore } from "../src/adherence-score";
import type { ValidationIssue } from "../src/validators";

describe("score de aderência", () => {
  it("retorna 100 e nível alto sem pendências", () => {
    expect(calculateAdherenceScore([])).toEqual({
      score: 100,
      level: "alto",
      blockingErrors: 0,
      warnings: 0,
    });
  });

  it("penaliza alertas sem bloquear", () => {
    const issues: ValidationIssue[] = [
      { severity: "warning", code: "w1", message: "Alerta 1" },
      { severity: "warning", code: "w2", message: "Alerta 2" },
    ];

    expect(calculateAdherenceScore(issues)).toMatchObject({
      score: 90,
      level: "alto",
      blockingErrors: 0,
      warnings: 2,
    });
  });

  it("penaliza erros bloqueantes com maior peso", () => {
    const issues: ValidationIssue[] = [
      { severity: "error", code: "e1", message: "Erro 1" },
      { severity: "error", code: "e2", message: "Erro 2" },
      { severity: "warning", code: "w1", message: "Alerta 1" },
    ];

    expect(calculateAdherenceScore(issues)).toMatchObject({
      score: 45,
      level: "baixo",
      blockingErrors: 2,
      warnings: 1,
    });
  });
});
