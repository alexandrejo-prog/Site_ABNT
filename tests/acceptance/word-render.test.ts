import { describe, it, expect } from "vitest";
import { existsSync, statSync } from "node:fs";

const pdfPath = new URL("../../artifacts/ufla-compliance/rendered/normalized-dissertacao.pdf", import.meta.url);

describe("acceptance: word render", () => {
  it("rendered PDF exists when Word COM is available", async () => {
    if (existsSync(pdfPath)) {
      const stats = statSync(pdfPath);
      expect(stats.size).toBeGreaterThan(0);
    } else {
      expect(false).toBe(true);
    }
  });
});