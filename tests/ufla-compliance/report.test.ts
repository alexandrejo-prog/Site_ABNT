import { describe, it, expect } from "vitest";
import { writeHtmlReport } from "@scripts/ufla-compliance/report";

describe("writeHtmlReport", () => {
  it("does not throw for empty result", () => {
    expect(() => {
      writeHtmlReport(
        {
          documentType: "dissertacao",
          compliant: false,
          score: 0,
          preTextual: { passed: false, gaps: [] },
          textual: { passed: false, gaps: [] },
          postTextual: { passed: false, gaps: [] },
          references: { passed: false, gaps: [] },
          citations: { passed: false, gaps: [] },
          figures: { passed: false, gaps: [] },
          sections: { passed: false, gaps: [] },
          layout: { passed: false, gaps: [] },
          typography: { passed: false, gaps: [] },
          catalogCard: { passed: false, gaps: [] },
          toc: { passed: false, gaps: [] },
          omml: { passed: false, gaps: [] },
          documentStructure: { passed: false, gaps: [] },
        } as any,
        "tmp/report-test.html",
      );
    }).not.toThrow();
  });
});
