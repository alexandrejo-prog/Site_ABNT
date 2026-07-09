import { describe, expect, it } from "vitest";
import { getAbsoluteGenerationBlockers, isAbsoluteGenerationBlocker } from "../src/generation-blockers";
import type { ValidationIssue } from "../src/validators";
import { emptyAcademicFields } from "../src/ufla-rules";

describe("generation blockers", () => {
  const formState = emptyAcademicFields();

  it("somente placeholders do editor ou naturais sao bloqueadores absolutos", () => {
    expect(isAbsoluteGenerationBlocker({ severity: "error", code: "placeholder-detected", message: "" })).toBe(false);
    expect(isAbsoluteGenerationBlocker({ severity: "error", code: "draft-placeholder-detected", message: "" })).toBe(true);
    expect(isAbsoluteGenerationBlocker({ severity: "error", code: "natural-placeholder-detected", message: "" })).toBe(true);
  });

  it("work-type-required is absolute blocker", () => {
    expect(isAbsoluteGenerationBlocker({ severity: "error", code: "work-type-required", message: "" })).toBe(true);
  });

  it("academic issues are not absolute blockers", () => {
    expect(isAbsoluteGenerationBlocker({ severity: "error", code: "program-conflict", message: "" })).toBe(false);
    expect(isAbsoluteGenerationBlocker({ severity: "error", code: "impact-indicators-missing", message: "" })).toBe(false);
    expect(isAbsoluteGenerationBlocker({ severity: "error", code: "program-degree-incompatible", message: "" })).toBe(false);
    expect(isAbsoluteGenerationBlocker({ severity: "error", code: "abstract-topic-conflict", message: "" })).toBe(false);
    expect(isAbsoluteGenerationBlocker({ severity: "error", code: "author-required", message: "" })).toBe(false);
    expect(isAbsoluteGenerationBlocker({ severity: "error", code: "title-required", message: "" })).toBe(false);
    expect(isAbsoluteGenerationBlocker({ severity: "error", code: "advisor-required", message: "" })).toBe(false);
    expect(isAbsoluteGenerationBlocker({ severity: "error", code: "program-required", message: "" })).toBe(false);
    expect(isAbsoluteGenerationBlocker({ severity: "error", code: "course-required", message: "" })).toBe(false);
  });

  it("ficha catalografica provisoria nao e bloqueador absoluto", () => {
    expect(isAbsoluteGenerationBlocker({ severity: "warning", code: "catalog-card-missing", message: "ficha" })).toBe(false);
  });

  it("getAbsoluteGenerationBlockers returns only absolute blockers", () => {
    const issues: ValidationIssue[] = [
      { severity: "error", code: "program-conflict", message: "conflito" },
      { severity: "error", code: "impact-indicators-missing", message: "indicadores" },
      { severity: "error", code: "placeholder-detected", message: "placeholder de campo" },
      { severity: "warning", code: "image-caption-warning", message: "imagem" },
      { severity: "error", code: "natural-placeholder-detected", message: "placeholder" },
    ];
    const blockers = getAbsoluteGenerationBlockers(issues, formState);
    expect(blockers).toHaveLength(1);
    expect(blockers[0].code).toBe("natural-placeholder-detected");
  });

  it("getAbsoluteGenerationBlockers ignores warnings and infos", () => {
    const issues: ValidationIssue[] = [
      { severity: "warning", code: "image-caption-warning", message: "imagem" },
      { severity: "info", code: "abstract-language-review", message: "abstract" },
    ];
    const blockers = getAbsoluteGenerationBlockers(issues, formState);
    expect(blockers).toHaveLength(0);
  });
});
