import { describe, it, expect } from "vitest";
import { validatePageLayout, validateTypography } from "@scripts/ufla-compliance/validate-page-layout";

describe("validatePageLayout", () => {
  it("returns failed when docx does not exist", async () => {
    const results = await validatePageLayout("missing.docx");
    expect(results.some((r: any) => r.status === "failed")).toBe(true);
  });
});

describe("validateTypography", () => {
  it("returns failed when docx does not exist", async () => {
    const results = await validateTypography("missing.docx");
    expect(results.some((r: any) => r.status === "failed")).toBe(true);
  });
});
