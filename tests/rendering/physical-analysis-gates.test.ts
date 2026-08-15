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

  it("renderedLayoutGate deve estar failed enquanto houver not-detected/failed crítico", () => {
    const coverage = physicalAnalysis.coverage;
    const critical = ["footnotes", "footers", "pageNumbers", "tableSources", "figureSources", "headers", "images", "tables"];
    const hasCritical = Object.entries(coverage).some(
      ([key, value]) => (value === "not-detected" || value === "failed") && critical.includes(key)
    );
    const hasFailed = Object.entries(coverage).some(([_key, value]) => value === "failed");
    expect(renderedAnalysis.gates.renderedLayoutGate.status).toBe(hasCritical || hasFailed ? "failed" : "passed");
  });

  it("fullComplianceGate deve refletir o gate expandido real", () => {
    // sem not-detected/failed crítico e com os demais gates verdes, o gate
    // expandido precisa estar passed — nunca failed por inércia
    const coverage = physicalAnalysis.coverage;
    const critical = ["footnotes", "footers", "pageNumbers", "tableSources", "figureSources", "headers", "images", "tables"];
    const hasCriticalGap = Object.entries(coverage).some(
      ([key, value]) => (value === "not-detected" || value === "failed") && critical.includes(key)
    );
    const allGreen =
      renderedAnalysis.gates.codeGate.status === "passed" &&
      renderedAnalysis.gates.ooxmlGate.status === "passed" &&
      renderedAnalysis.gates.contentPreservationGate.status === "passed" &&
      renderedAnalysis.gates.renderedLayoutGate.status === "passed" &&
      !hasCriticalGap;

    if (allGreen) {
      expect(renderedAnalysis.gates.fullComplianceGate.status).toBe("passed");
    } else {
      expect(renderedAnalysis.gates.fullComplianceGate.status).toBe("failed");
    }
  });

  it("declaração de conformidade no report deve ser consistente com o fullComplianceGate", () => {
    const reportPath = new URL("../../artifacts/ufla-compliance/report.md", import.meta.url);
    const report = readFileSync(reportPath, "utf-8");
    const fullPassed = renderedAnalysis.gates.fullComplianceGate.status === "passed";
    if (fullPassed) {
      expect(report).toContain("CONFORMIDADE UFLA APROVADA");
    } else {
      expect(report).not.toContain("CONFORMIDADE UFLA APROVADA");
    }
  });

  it("wordValidationResult deve ser WORD_OPEN_AND_EXPORT_VALIDATION_PASSED", () => {
    expect(renderedAnalysis.wordValidationResult).toBe("WORD_OPEN_AND_EXPORT_VALIDATION_PASSED");
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
    // detecção física real: imagens via opList/CTM, tabelas via grade de colunas
    expect(coverage.images).toBe("passed");
    expect(coverage.tables).toBe("passed");
  });
});
