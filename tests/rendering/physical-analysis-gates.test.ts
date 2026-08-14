import { it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { describeWithArtifacts } from "../test-utils/artifact-guard";

const renderedAnalysisPath = new URL("../../artifacts/ufla-compliance/rendered-analysis.json", import.meta.url);
const physicalAnalysisPath = new URL("../../artifacts/ufla-compliance/pdf-physical-analysis.json", import.meta.url);

describeWithArtifacts("gates de conformidade física", ["ufla-compliance/rendered-analysis.json", "ufla-compliance/pdf-physical-analysis.json", "ufla-compliance/report.md"], () => {
  let renderedAnalysis: any;
  let physicalAnalysis: any;

  beforeAll(() => {
    renderedAnalysis = JSON.parse(readFileSync(renderedAnalysisPath, "utf-8"));
    physicalAnalysis = JSON.parse(readFileSync(physicalAnalysisPath, "utf-8"));
  });

  it("codeGate deve estar passed", () => {
    expect(renderedAnalysis.gates.codeGate.status).toBe("passed");
  });

  it("ooxmlGate deve estar passed", () => {
    expect(renderedAnalysis.gates.ooxmlGate.status).toBe("passed");
  });

  it("contentPreservationGate deve estar passed", () => {
    expect(renderedAnalysis.gates.contentPreservationGate.status).toBe("passed");
  });

  it("renderedLayoutGate deve estar failed enquanto houver not-detected crítico", () => {
    const coverage = physicalAnalysis.coverage;
    const hasNotDetected = Object.entries(coverage).some(
      ([key, value]) => value === "not-detected" && 
      ["footnotes", "footers", "pageNumbers", "tableSources", "figureSources", "headers", "images", "tables"].includes(key)
    );
    const hasFailed = Object.entries(coverage).some(([_key, value]) => value === "failed");
    
    if (hasNotDetected || hasFailed) {
      expect(renderedAnalysis.gates.renderedLayoutGate.status).toBe("failed");
    }
  });

  it("fullComplianceGate deve estar failed quando renderedLayoutGate falhar", () => {
    expect(renderedAnalysis.gates.fullComplianceGate.status).toBe("failed");
  });

  it("wordValidationResult deve ser WORD_OPEN_AND_EXPORT_VALIDATION_PASSED", () => {
    expect(renderedAnalysis.wordValidationResult).toBe("WORD_OPEN_AND_EXPORT_VALIDATION_PASSED");
  });

  it("não deve declarar CONFORMIDADE UFLA APROVADA", () => {
    const reportPath = new URL("../../artifacts/ufla-compliance/report.md", import.meta.url);
    const report = readFileSync(reportPath, "utf-8");
    expect(report).not.toContain("CONFORMIDADE UFLA APROVADA");
  });

  it("pdf-physical-analysis deve conter pagesAnalysis com estrutura por página", () => {
    expect(Array.isArray(physicalAnalysis.pagesAnalysis)).toBe(true);
    expect(physicalAnalysis.pagesAnalysis.length).toBeGreaterThan(0);
    
    const firstPage = physicalAnalysis.pagesAnalysis[0];
    expect(firstPage).toHaveProperty("page");
    expect(firstPage).toHaveProperty("elements");
    expect(firstPage).toHaveProperty("footnotes");
    expect(firstPage).toHaveProperty("tables");
    expect(firstPage).toHaveProperty("images");
    expect(firstPage).toHaveProperty("overlaps");
    expect(firstPage).toHaveProperty("cutoffs");
    expect(firstPage).toHaveProperty("status");
  });

  it("coverage deve refletir detecções reais do PDF", () => {
    const coverage = physicalAnalysis.coverage;
    expect(coverage.footnotes).toBe("passed");
    expect(coverage.footers).toBe("passed");
    expect(coverage.pageNumbers).toBe("passed");
    expect(coverage.tableSources).toBe("passed");
    expect(coverage.figureSources).toBe("passed");
    expect(coverage.headers).toBe("passed");
    expect(coverage.images).toBe("not-detected");
    expect(coverage.tables).toBe("not-detected");
  });
});
