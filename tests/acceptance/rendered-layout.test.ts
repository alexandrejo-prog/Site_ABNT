import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const jsonPath = new URL("../../artifacts/ufla-compliance/rendered-analysis.json", import.meta.url);

describe("acceptance: rendered layout", () => {
  it("rendered analysis JSON has required fields", () => {
    const raw = readFileSync(jsonPath, "utf8");
    const data = JSON.parse(raw);
    expect(data.renderer).toBeDefined();
    expect(data.input).toBeDefined();
    expect(data.output).toBeDefined();
    expect(data.status).toBe("rendered");
    expect(data.physicalAnalysis).toBeDefined();
    expect(data.physicalAnalysis.pages).toBeGreaterThan(0);
  });
});