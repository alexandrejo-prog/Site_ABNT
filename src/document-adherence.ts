import { calculateAdherenceScore, type AdherenceScore } from "./adherence-score";
import type { ValidationIssue } from "./validators";

export interface DocumentAdherenceReport {
  score: AdherenceScore;
  summary: string;
  canGenerateSafely: boolean;
  blockingCodes: string[];
  warningCodes: string[];
}

export function documentAdherenceReport(issues: ValidationIssue[]): DocumentAdherenceReport {
  const score = calculateAdherenceScore(issues);
  const blockingCodes = issues.filter((issue) => issue.severity === "error").map((issue) => issue.code);
  const warningCodes = issues.filter((issue) => issue.severity === "warning").map((issue) => issue.code);
  const canGenerateSafely = blockingCodes.length === 0;

  const summary = canGenerateSafely
    ? `Aderência ${score.level}: ${score.score}/100. Há ${warningCodes.length} alerta(s) para revisão manual.`
    : `Aderência ${score.level}: ${score.score}/100. Resolva ${blockingCodes.length} erro(s) bloqueante(s) antes da versão final.`;

  return {
    score,
    summary,
    canGenerateSafely,
    blockingCodes,
    warningCodes,
  };
}
