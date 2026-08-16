import { describe, it, expect } from "vitest";
import { runExpandedComplianceGate } from "@scripts/ufla-compliance/gate";

describe("runExpandedComplianceGate", () => {
  it("returns result with technical checks", async () => {
    const result = await runExpandedComplianceGate("missing.docx");
    expect(result).toBeDefined();
    expect(result.technical).toBeDefined();
  });
});
