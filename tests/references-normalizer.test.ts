import { describe, expect, it } from "vitest";
import { normalizeReference } from "../src/references-normalizer";

describe("references normalizer", () => {
  it("detects a book title", () => {
    const normalized = normalizeReference("SILVA, M. Coffee quality. Lavras: UFLA, 2024.");
    expect(normalized.detectedHighlight).toBe("Coffee quality");
    expect(normalized.runs.some((run) => run.bold)).toBe(true);
  });
});
