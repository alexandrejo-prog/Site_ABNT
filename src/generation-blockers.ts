import type { ValidationIssue } from "./validators";
import type { AcademicFields } from "./ufla-rules";

const NON_OVERRIDABLE_ERROR_CODES = [
  "work-type-required",
  "author-required",
  "author-institutional",
  "title-required",
  "advisor-required",
  "placeholder-detected",
  "draft-placeholder-detected",
  "natural-placeholder-detected",
  "program-conflict",
  "abstract-topic-conflict",
  "program-degree-incompatible",
  "required-section-missing",
  "references-missing",
  "invalid-hierarchy",
  "worktype-profile-unresolved",
  "pretextual-missing",
] as const;

const ABSOLUTE_GENERATION_BLOCKER_CODES = [
  "work-type-required",
  "draft-placeholder-detected",
  "natural-placeholder-detected",
  "required-section-missing",
  "references-missing",
  "invalid-hierarchy",
  "worktype-profile-unresolved",
  "pretextual-missing",
] as const;

export function isNonOverridableError(issue: ValidationIssue): boolean {
  return NON_OVERRIDABLE_ERROR_CODES.includes(issue.code as typeof NON_OVERRIDABLE_ERROR_CODES[number]);
}

export function isAbsoluteGenerationBlocker(issue: ValidationIssue): boolean {
  return ABSOLUTE_GENERATION_BLOCKER_CODES.includes(issue.code as typeof ABSOLUTE_GENERATION_BLOCKER_CODES[number]);
}

export function getAbsoluteGenerationBlockers(issues: ValidationIssue[], _formState: AcademicFields): ValidationIssue[] {
  return issues.filter((issue) => issue.severity === "error" && isAbsoluteGenerationBlocker(issue));
}
