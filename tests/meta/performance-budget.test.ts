import { describe, expect, it } from "vitest";
import { PERFORMANCE_BUDGETS, exceededBudget, performanceAction } from "../../src/performance-budget";

describe("performance", () => {
  it("define limites para importacao e exportacao", () => {
    const ids = PERFORMANCE_BUDGETS.map((budget) => budget.id);
    expect(ids).toContain("docx-import-small");
    expect(ids).toContain("docx-import-large");
    expect(ids).toContain("docx-export");
  });

  it("detecta estouro de limite", () => {
    expect(exceededBudget("docx-export", 6000)).toBe(true);
    expect(exceededBudget("docx-export", 1000)).toBe(false);
  });

  it("retorna acao de mitigacao", () => {
    expect(performanceAction("docx-import-large")).toBeTruthy();
  });
});
