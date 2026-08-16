import { it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { describeWithArtifacts } from "../test-utils/artifact-guard";

const jsonPath = new URL("../../artifacts/ufla-compliance/rendered-analysis.json", import.meta.url);

describeWithArtifacts("acceptance: rendered layout", ["ufla-compliance/rendered-analysis.json"], () => {
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