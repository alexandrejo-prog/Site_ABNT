import type { ValidationIssue } from "./validators";

export type AdherenceLevel = "alto" | "medio" | "baixo";

export interface AdherenceScore {
  score: number;
  level: AdherenceLevel;
  blockingErrors: number;
  warnings: number;
}

export function calculateAdherenceScore(issues: ValidationIssue[]): AdherenceScore {
  const blockingErrors = issues.filter((issue) => issue.severity === "error").length;
  const warnings = issues.filter((issue) => issue.severity === "warning").length;
  const penalty = blockingErrors * 25 + warnings * 5;
  const score = Math.max(0, Math.min(100, 100 - penalty));

  const level: AdherenceLevel = score >= 80 ? "alto" : score >= 50 ? "medio" : "baixo";

  return {
    score,
    level,
    blockingErrors,
    warnings,
  };
}
