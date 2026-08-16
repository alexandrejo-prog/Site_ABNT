import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describeWithArtifacts } from "../test-utils/artifact-guard";
import { analyzePdf } from "../../scripts/ufla-compliance/analyze-pdf-physical";

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
