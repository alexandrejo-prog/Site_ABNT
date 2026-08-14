import { describe, expect, it } from "vitest";
import { isNonOverridableError } from "../../src/generation-blockers";
import type { ValidationIssue } from "../../src/validators";

describe("bloqueio de geracao com erros criticos", () => {
  const nonOverridableCodes = [
    "work-type-required",
    "author-required",
    "author-institutional",
    "title-required",
    "advisor-required",
    "placeholder-detected",
    "draft-placeholder-detected",
    "program-conflict",
    "abstract-topic-conflict",
    "program-degree-incompatible",
  ];

  for (const code of nonOverridableCodes) {
    it(`bloqueia erro critico nao sobreponivel: ${code}`, () => {
      const issue: ValidationIssue = { severity: "error", code, message: "teste" };
      expect(isNonOverridableError(issue)).toBe(true);
    });
  }

  it("nao bloqueia warning", () => {
    const issue: ValidationIssue = { severity: "warning", code: "resumo-required", message: "teste" };
    expect(isNonOverridableError(issue)).toBe(false);
  });

  it("nao bloqueia indicadores de impacto como erro nao sobreponivel", () => {
    const issue: ValidationIssue = { severity: "error", code: "impact-indicators-missing", message: "teste" };
    expect(isNonOverridableError(issue)).toBe(false);
  });

  it("nao bloqueia erro sobreponivel generico", () => {
    const issue: ValidationIssue = { severity: "error", code: "some-other-error", message: "teste" };
    expect(isNonOverridableError(issue)).toBe(false);
  });
});
