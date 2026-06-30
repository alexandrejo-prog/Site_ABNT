import { describe, expect, it } from "vitest";
import { normalizeReference } from "../src/references-normalizer";

describe("references normalizer", () => {
  it("detects a book title", () => {
    const normalized = normalizeReference("SILVA, M. Qualidade do café. Lavras: UFLA, 2024.");
    expect(normalized.detectedHighlight).toBe("Qualidade do café");
    expect(normalized.runs.some((run) => run.bold)).toBe(true);
  });
});
