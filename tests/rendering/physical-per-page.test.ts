import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describeWithArtifacts } from "../test-utils/artifact-guard";
import { analyzePdf } from "../../scripts/ufla-compliance/analyze-pdf-physical";
import { computeCoverage } from "../../scripts/ufla-compliance/coverage-docx-pdf";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const root = join(__dirname, "..", "..");

describeWithArtifacts(
  "rendering: análise física POR PÁGINA (imagens, tabelas, equações)",
  ["ufla-compliance/pdf-physical-analysis.json", "ufla-compliance/rendered/normalized-dissertacao.pdf"],
  () => {
    it("summary traz contagens por página consistentes com pagesAnalysis", async () => {
      const analysis = await analyzePdf(join(root, "artifacts", "ufla-compliance", "rendered", "normalized-dissertacao.pdf"));
      const { imagesByPage, tablesByPage, equationsByPage } = analysis.summary;

      // consistência: soma das contagens por página == total
      const imageSum = Object.values(imagesByPage).reduce((a, b) => a + b, 0);
      const tableSum = Object.values(tablesByPage).reduce((a, b) => a + b, 0);
      const eqSum = Object.values(equationsByPage).reduce((a, b) => a + b, 0);
      expect(imageSum).toBe(analysis.summary.totalImages);
      expect(tableSum).toBe(analysis.summary.totalTables);
      expect(eqSum).toBe(analysis.summary.totalEquations);

      // consistência com as listas por página
      for (const page of analysis.pagesAnalysis) {
        expect(imagesByPage[page.page] ?? 0).toBe(page.images.length);
        expect(tablesByPage[page.page] ?? 0).toBe(page.tables.length);
        expect(equationsByPage[page.page] ?? 0).toBe(page.equations.length);
      }

      // o documento de referência tem imagens e tabelas renderizadas de verdade
      expect(analysis.summary.totalImages).toBeGreaterThan(0);
      expect(analysis.summary.totalTables).toBeGreaterThan(0);
      expect(analysis.coverage.equations).toBeDefined();
    });

    it("artefato commitado tem os novos campos de cobertura por página", () => {
      const analysis = JSON.parse(
        readFileSync(join(root, "artifacts", "ufla-compliance", "pdf-physical-analysis.json"), "utf8"),
      );
      expect(analysis.summary.imagesByPage).toBeDefined();
      expect(analysis.summary.tablesByPage).toBeDefined();
      expect(analysis.summary.equationsByPage).toBeDefined();
      expect(analysis.coverage.equations).toBeDefined();
      expect(analysis.summary.maskedImages).toBeTypeOf("number");
    });
  },
);

describeWithArtifacts(
  "rendering: equações OMML renderizadas no PDF (fixture Word)",
  ["ufla-compliance/rendered/fixtures/eq-fixture.pdf"],
  () => {
    it("detecta os glifos matemáticos da equação renderizada pelo Word", async () => {
      const analysis = await analyzePdf(join(root, "artifacts", "ufla-compliance", "rendered", "fixtures", "eq-fixture.pdf"));
      expect(analysis.coverage.equations).toBe("passed");
      expect(analysis.summary.totalEquations).toBeGreaterThanOrEqual(1);
      const eqElements = analysis.elements.filter((e) => e.kind === "equation");
      // fração (\frac) e raiz (\sqrt) geram runs matemáticos distintos
      const joined = eqElements.map((e) => e.text).join(" ");
      expect(joined).toMatch(/Equação renderizada/);
    });
  },
);

describeWithArtifacts(
  "rendering: conciliação DOCX→PDF página-a-página (coverage-docx-pdf)",
  [
    "ufla-compliance/normalized-dissertacao.docx",
    "ufla-compliance/pdf-physical-analysis.json",
  ],
  () => {
    it("pageMap associa cada tabela OOXML a uma página física", async () => {
      const coverage = await computeCoverage();
      expect(coverage.passed).toBe(true);
      expect(coverage.tables.total).toBeGreaterThan(0);
      expect(coverage.tables.matched).toBe(coverage.tables.total);
      expect(coverage.tables.pageMap).toHaveLength(coverage.tables.total);
      const unmatched = coverage.tables.pageMap.filter((p) => p.page === null);
      expect(unmatched).toHaveLength(0);
    });

    it("pageMapping é a visão reversa (página física → índices das tabelas)", async () => {
      const coverage = await computeCoverage();
      const pageIndices = new Set<number>();
      for (const indices of Object.values(coverage.pageMapping)) {
        for (const idx of indices) {
          expect(idx).toBeGreaterThan(0);
          expect(idx).toBeLessThanOrEqual(coverage.tables.total);
          pageIndices.add(idx);
        }
      }
      expect(pageIndices.size).toBe(coverage.tables.matched);
    });

    it("razão físico/OOXML de tabelas fica na banda esperada", async () => {
      const coverage = await computeCoverage();
      expect(coverage.tableRatio).toBeGreaterThanOrEqual(0.7);
      expect(coverage.tableRatio).toBeLessThanOrEqual(1.8);
    });
  },
);
