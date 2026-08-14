import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const analysisPath = new URL("../../artifacts/ufla-compliance/pdf-physical-analysis.json", import.meta.url);

describe("physical cutoff detection", () => {
  const analysis = JSON.parse(readFileSync(analysisPath, "utf-8"));

  it("não deve reportar corte no PDF atual", () => {
    const totalCutoffs = analysis.summary.totalCutoffs;
    expect(totalCutoffs).toBe(0);
  });

  it("nenhuma página deve ter elementos marcados como cutoff", () => {
    const pagesWithCutoff = analysis.pagesAnalysis.filter(
      (p: any) => p.cutoffs.length > 0
    );
    expect(pagesWithCutoff.length).toBe(0);
  });

  it("todos os elementos devem estar withinPage=true", () => {
    const allElements = analysis.pagesAnalysis.flatMap((p: any) => p.elements);
    const outsideElements = allElements.filter((e: any) => e.withinPage === false);
    expect(outsideElements.length).toBe(0);
  });

  it("nenhuma página deve ter status failed por corte", () => {
    const failedByCutoff = analysis.pagesAnalysis.filter(
      (p: any) => p.status === "failed" && p.cutoffs.length > 0
    );
    expect(failedByCutoff.length).toBe(0);
  });
});
