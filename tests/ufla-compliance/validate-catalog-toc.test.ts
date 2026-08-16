import { describe, it, expect } from "vitest";
import { validateCatalogCard, validateToc } from "@scripts/ufla-compliance/validate-catalog-toc";

describe("validateCatalogCard", () => {
  it("returns failed when docx does not exist", async () => {
    const results = await validateCatalogCard("missing.docx");
    expect(results.some((r: any) => r.status === "failed")).toBe(true);
  });
});

describe("validateToc", () => {
  it("returns failed when docx does not exist", async () => {
    const results = await validateToc("missing.docx");
    expect(results.some((r: any) => r.status === "failed")).toBe(true);
  });
});
