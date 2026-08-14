import { describe, expect, it } from "vitest";
import { normalizeReferencesText } from "../../src/references-normalizer";

describe("reference heading filtering", () => {
  it("filters standalone reference headings", () => {
    const normalized = normalizeReferencesText(
      "REFERENCIAS\nBIBLIOGRAFICAS\nSILVA, M. Livro de teste. Lavras: UFLA, 2024.",
    );

    expect(normalized).toHaveLength(1);
    expect(normalized[0].text).toContain("SILVA, M. Livro de teste");
  });
});
