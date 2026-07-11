import axe, { type AxeResults, type ElementContext, type RunOptions } from "axe-core";

const DEFAULT_RULES: NonNullable<RunOptions["rules"]> = {
  "color-contrast": { enabled: false },
};

export type A11yAuditOptions = RunOptions;

export async function runA11yAudit(
  container: ElementContext = document,
  options: A11yAuditOptions = {},
): Promise<AxeResults> {
  return axe.run(container, {
    ...options,
    rules: {
      ...DEFAULT_RULES,
      ...options.rules,
    },
  });
}

export function criticalA11yViolations(results: AxeResults) {
  return results.violations.filter((violation) => violation.impact === "critical");
}
