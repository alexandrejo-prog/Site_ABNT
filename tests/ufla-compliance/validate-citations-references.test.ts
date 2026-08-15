import { describe, it, expect } from "vitest";
import { validateCitations, validateReferences } from "@scripts/ufla-compliance/validate-citations-references";

describe("validateCitations", () => {
  it("returns failed when docx does not exist", async () => {
    const results = await validateCitations("missing.docx");
    expect(results.some((r: any) => r.status === "failed")).toBe(true);
  });
});

describe("validateReferences", () => {
  it("returns failed when docx does not exist", async () => {
    const results = await validateReferences("missing.docx");
    expect(results.some((r: any) => r.status === "failed")).toBe(true);
  });
});
