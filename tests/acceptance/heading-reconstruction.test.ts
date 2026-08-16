import { it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { describeWithArtifacts } from "../test-utils/artifact-guard";

const jsonPath = new URL("../../artifacts/ufla-compliance/input-structure.json", import.meta.url);

describeWithArtifacts("acceptance: heading reconstruction", ["ufla-compliance/input-structure.json"], () => {
  it("produces a valid JSON artifact with required fields", () => {
    const raw = readFileSync(jsonPath, "utf8");
    const data = JSON.parse(raw);

    expect(data.input).toContain("dissertacao-referencia.docx");
    expect(data.totalParagraphs).toBeGreaterThan(0);
    expect(data.headingCount).toBeGreaterThan(0);
    expect(Array.isArray(data.headings)).toBe(true);
    expect(data.unmatchedPrimary).toBeDefined();
    expect(Array.isArray(data.unmatchedPrimary)).toBe(true);
    expect(data.unmatchedSecondary).toBeDefined();
    expect(Array.isArray(data.unmatchedSecondary)).toBe(true);
    expect(data.classifiedParagraphCount).toBeDefined();
  });

  it("detects primary section headings", () => {
    const raw = readFileSync(jsonPath, "utf8");
    const data = JSON.parse(raw);

    const primaryTexts = data.headings
      .filter((h: any) => h.level === 1)
      .map((h: any) => h.text.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\d+$/, "").trim());

    expect(primaryTexts).toContain("INTRODUCAO");
    expect(primaryTexts).toContain("REFERENCIAL TEORICO");
    expect(primaryTexts).toContain("METODOLOGIA");
    expect(primaryTexts).toContain("RESULTADOS");
    expect(primaryTexts).toContain("REFERENCIAS");
  });

  it("heading candidates have confidence and signals", () => {
    const raw = readFileSync(jsonPath, "utf8");
    const data = JSON.parse(raw);

    expect(data.headings.length).toBeGreaterThan(0);
    for (const h of data.headings) {
      expect(h).toHaveProperty("confidence");
      expect(typeof h.confidence).toBe("number");
      expect(h.confidence).toBeGreaterThanOrEqual(0);
      expect(h.confidence).toBeLessThanOrEqual(1);
      expect(Array.isArray(h.signals)).toBe(true);
      expect(h.signals.length).toBeGreaterThan(0);
    }
  });

  it("preserves unmatched primary sections for manual review", () => {
    const raw = readFileSync(jsonPath, "utf8");
    const data = JSON.parse(raw);

    const missing = data.unmatchedPrimary.filter((t: string) => !["ANEXOS"].includes(t));
    expect(missing.length).toBe(0);
  });
});