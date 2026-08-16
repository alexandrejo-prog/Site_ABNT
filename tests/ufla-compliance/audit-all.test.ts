import { describe, it, expect } from "vitest";
import { runUnifiedAudit } from "@scripts/ufla-compliance/audit-all";

describe("runUnifiedAudit", () => {
  it("returns failed result when docx does not exist", async () => {
    const result = await runUnifiedAudit("missing.docx");
    expect(result.passed).toBe(false);
    expect(result.score).toBeLessThan(100);
  });
});
