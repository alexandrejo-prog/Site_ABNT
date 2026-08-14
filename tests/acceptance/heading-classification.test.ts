import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const jsonPath = new URL("../../artifacts/ufla-compliance/heading-candidates.json", import.meta.url);

describe("acceptance: heading classification completeness", () => {
  it("classifies all 1313 candidates into exactly one category", () => {
    const raw = readFileSync(jsonPath, "utf8");
    const data = JSON.parse(raw);

    const total = data.candidates.length;
    const classified = data.candidates.filter((c: any) => c.classification && c.classification !== "");
    const summary = data.summary;

    expect(total).toBe(summary.total);
    expect(classified.length).toBe(total);

    const sum = (summary.primaryHeading || 0) +
      (summary.secondaryHeading || 0) +
      (summary.tertiaryHeading || 0) +
      (summary.frontmatterHeading || 0) +
      (summary.referenceHeading || 0) +
      (summary.appendixHeading || 0) +
      (summary.annexHeading || 0) +
      (summary.caption || 0) +
      (summary.listItem || 0) +
      (summary.tableText || 0) +
      (summary.headerFooter || 0) +
      (summary.pageNumber || 0) +
      (summary.referenceEntry || 0) +
      (summary.footnote || 0) +
      (summary.ambiguous || 0) +
      (summary.falsePositive || 0);
    expect(sum).toBe(total);
  });

  it("each candidate has required fields", () => {
    const raw = readFileSync(jsonPath, "utf8");
    const data = JSON.parse(raw);

    for (const c of data.candidates) {
      expect(c).toHaveProperty("sourceIndex");
      expect(c).toHaveProperty("text");
      expect(c).toHaveProperty("classification");
      expect(c).toHaveProperty("accepted");
      expect(c).toHaveProperty("level");
      expect(c).toHaveProperty("confidence");
      expect(c).toHaveProperty("signals");
      expect(c).toHaveProperty("reason");
      expect(c).toHaveProperty("contextBefore");
      expect(c).toHaveProperty("contextAfter");
    }
  });

  it("ambiguous candidates have action field", () => {
    const raw = readFileSync(jsonPath, "utf8");
    const data = JSON.parse(raw);

    const ambiguous = data.candidates.filter((c: any) => c.classification === "ambiguous");
    expect(ambiguous.length).toBeGreaterThan(0);
    for (const c of ambiguous) {
      expect(c).toHaveProperty("action");
      expect(["preserve-as-paragraph", "promote-to-heading", "manual-review"]).toContain(c.action);
    }
  });
});