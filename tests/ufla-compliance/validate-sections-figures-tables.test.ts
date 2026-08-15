import { describe, it, expect } from "vitest";
import { validateSections, validateFigures, validateTables } from "@scripts/ufla-compliance/validate-sections-figures-tables";

describe("validateSections", () => {
  it("returns failed when docx does not exist", async () => {
    const results = await validateSections("missing.docx");
    expect(results.some((r: any) => r.status === "failed")).toBe(true);
  });
});

describe("validateFigures", () => {
  it("returns failed when docx does not exist", async () => {
    const results = await validateFigures("missing.docx");
    expect(results.some((r: any) => r.status === "failed")).toBe(true);
  });
});

describe("validateTables", () => {
  it("returns failed when docx does not exist", async () => {
    const results = await validateTables("missing.docx");
    expect(results.some((r: any) => r.status === "failed")).toBe(true);
  });
});
