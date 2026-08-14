import { it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { describeWithArtifacts } from "../test-utils/artifact-guard";

const renderedAnalysisPath = new URL("../../artifacts/ufla-compliance/rendered-analysis.json", import.meta.url);
const physicalAnalysisPath = new URL("../../artifacts/ufla-compliance/pdf-physical-analysis.json", import.meta.url);

describeWithArtifacts("page count consistency: Word COM vs PDF físico", ["ufla-compliance/rendered-analysis.json", "ufla-compliance/pdf-physical-analysis.json"], () => {
  it("Word COM pagesBeforeFields deve ser igual à contagem física do PDF (tolerância zero)", () => {
    const renderedAnalysis = JSON.parse(readFileSync(renderedAnalysisPath, "utf-8"));
    const physicalAnalysis = JSON.parse(readFileSync(physicalAnalysisPath, "utf-8"));
    const wordPageCount = renderedAnalysis.pagesBeforeFields;
    const pdfPageCount = physicalAnalysis.pages;

    expect(wordPageCount).toBe(pdfPageCount);
  });

  it("Word COM pagesAfterFields deve ser igual à contagem física do PDF (tolerância zero)", () => {
    const renderedAnalysis = JSON.parse(readFileSync(renderedAnalysisPath, "utf-8"));
    const physicalAnalysis = JSON.parse(readFileSync(physicalAnalysisPath, "utf-8"));
    const wordPageCount = renderedAnalysis.pagesAfterFields;
    const pdfPageCount = physicalAnalysis.pages;

    expect(wordPageCount).toBe(pdfPageCount);
  });

  it("Word COM pagesAfterToc deve ser igual à contagem física do PDF (tolerância zero)", () => {
    const renderedAnalysis = JSON.parse(readFileSync(renderedAnalysisPath, "utf-8"));
    const physicalAnalysis = JSON.parse(readFileSync(physicalAnalysisPath, "utf-8"));
    const wordPageCount = renderedAnalysis.pagesAfterToc;
    const pdfPageCount = physicalAnalysis.pages;

    expect(wordPageCount).toBe(pdfPageCount);
  });
});
