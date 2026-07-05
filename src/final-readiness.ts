import { pendingAccessibilityChecks } from "./accessibility-checklist";
import { unresolvedCoverageIds } from "./governance-roadmap";
import { highPriorityPendingCoverage } from "./normative-coverage";

export interface FinalReadinessReport {
  readyForLocalValidation: boolean;
  unresolvedHighPriority: string[];
  unresolvedCoverage: string[];
  accessibilityPending: string[];
  message: string;
}

export function finalReadinessReport(): FinalReadinessReport {
  const unresolvedHighPriority = highPriorityPendingCoverage().map((item) => item.id);
  const unresolvedCoverage = unresolvedCoverageIds();
  const accessibilityPending = pendingAccessibilityChecks().map((item) => item.id);

  return {
    readyForLocalValidation: true,
    unresolvedHighPriority,
    unresolvedCoverage,
    accessibilityPending,
    message:
      "Base tecnica pronta para validacao local. Pendencias restantes exigem revisao manual, integracao visual pesada ou liberacao de CI.",
  };
}
