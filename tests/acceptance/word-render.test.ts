import { it, expect } from "vitest";
import { statSync } from "node:fs";
import { describeWithArtifacts } from "../test-utils/artifact-guard";

const pdfPath = new URL("../../artifacts/ufla-compliance/rendered/normalized-dissertacao.pdf", import.meta.url);

describeWithArtifacts("acceptance: word render", ["ufla-compliance/rendered/normalized-dissertacao.pdf"], () => {
  it("rendered PDF exists when Word COM is available", async () => {
    const stats = statSync(pdfPath);
    expect(stats.size).toBeGreaterThan(0);
  });
});