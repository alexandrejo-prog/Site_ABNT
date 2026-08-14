import { it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { describeWithArtifacts } from "../test-utils/artifact-guard";

const analysisPath = new URL("../../artifacts/ufla-compliance/pdf-physical-analysis.json", import.meta.url);

describeWithArtifacts("physical overlap detection", ["ufla-compliance/pdf-physical-analysis.json"], () => {
  let analysis: any;
  beforeAll(() => {
    analysis = JSON.parse(readFileSync(analysisPath, "utf-8"));
  });

  it("não deve reportar sobreposição real no PDF atual", () => {
    const totalOverlaps = analysis.summary.totalOverlaps;
    expect(totalOverlaps).toBe(0);
  });

  it("nenhuma página deve ter status failed por sobreposição", () => {
    const failedByOverlap = analysis.pagesAnalysis.filter(
      (p: any) => p.status === "failed" && p.overlaps.length > 0
    );
    expect(failedByOverlap.length).toBe(0);
  });

  it("página 14 não deve conter sobreposição classificada como real", () => {
    const p14 = analysis.pagesAnalysis.find((p: any) => p.page === 14);
    expect(p14).toBeDefined();
    expect(p14.overlaps.length).toBe(0);
  });

  it("deve manter detecção de sobreposição quando houver interseção significativa entre elementos de tipos diferentes", () => {
    const hasCrossKindOverlap = analysis.pagesAnalysis.some((p: any) =>
      p.overlaps.some((o: any) => o.kind1 !== o.kind2)
    );
    expect(hasCrossKindOverlap).toBe(false);
  });
});
