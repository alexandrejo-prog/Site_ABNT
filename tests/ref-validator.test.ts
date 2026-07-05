import { describe, expect, it } from "vitest";
import { validateReferencesText } from "../src/references-validator";

describe("ref validator", () => {
  it("ignores low confidence institutional title mark", () => {
    const issues = validateReferencesText(
      "UNIVERSIDADE FEDERAL DE LAVRAS. Politica de Saude Mental da UFLA. Lavras: UFLA, 2024.",
    );

    expect(issues.map((issue) => issue.code)).not.toContain("reference-highlight-missing");
  });
});
