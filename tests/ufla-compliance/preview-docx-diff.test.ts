import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describeWithArtifacts } from "../test-utils/artifact-guard";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const root = join(__dirname, "..", "..");

interface TemplateEntry {
  previewPages: number;
  pdfPages: number;
  pageDelta: number;
  similarity: number;
  similarityPreviewToPdf: number;
  similarityPdfToPreview: number;
  perPage: Array<{ page: number; pdfPage: number | null; bestMatchOverlap: number; sequentialOverlap: number }>;
  screenshots: Array<{ page: number; diffRatio: number }>;
  status: string;
  passed: boolean;
}

interface PreviewDiffArtifact {
  wordAvailable: boolean;
  templates: Record<string, TemplateEntry>;
  overall: { passedTemplates: number; templates: number };
  status: string;
  passed: boolean;
}

const EXPECTED_TEMPLATES = ["monografia", "dissertacao", "tese", "artigo", "resumo_expandido_cpg", "projeto_pesquisa"];

describeWithArtifacts(
  "ufla-compliance: fidelidade do preview vs DOCX renderizado (Word COM, 6 templates)",
  ["ufla-compliance/preview-docx-diff.json"],
  () => {
    const artifact = join(root, "artifacts", "ufla-compliance", "preview-docx-diff.json");

    function load(): PreviewDiffArtifact {
      return JSON.parse(readFileSync(artifact, "utf8"));
    }

    it("os 6 templates foram comparados e todos passaram no gate (sim ≥ 0.65, Δpáginas ≤ 3)", () => {
      const a = load();
      if (!a.wordAvailable) return;
      expect(Object.keys(a.templates).sort()).toEqual([...EXPECTED_TEMPLATES].sort());
      expect(a.overall.passedTemplates).toBe(EXPECTED_TEMPLATES.length);
      expect(a.passed).toBe(true);
      for (const [id, e] of Object.entries(a.templates)) {
        expect(e.similarity, id).toBeGreaterThanOrEqual(0.65);
        expect(e.pageDelta, id).toBeLessThanOrEqual(3);
        expect(e.passed, id).toBe(true);
      }
    });

    it("conteúdo do preview existe no DOCX (best-match médio ≥ 0.4 por template)", () => {
      const a = load();
      if (!a.wordAvailable) return;
      for (const [id, e] of Object.entries(a.templates)) {
        expect(e.perPage.length, id).toBeGreaterThan(0);
        const avg = e.perPage.reduce((s, p) => s + p.bestMatchOverlap, 0) / e.perPage.length;
        expect(avg, id).toBeGreaterThanOrEqual(0.4);
      }
    });

    it("evidência visual lado a lado gerada para os templates (screenshots com diffRatio)", () => {
      const a = load();
      if (!a.wordAvailable) return;
      for (const [id, e] of Object.entries(a.templates)) {
        expect(e.screenshots.length, id).toBeGreaterThanOrEqual(1);
        for (const s of e.screenshots) {
          expect(s.diffRatio, id).toBeGreaterThanOrEqual(0);
          expect(s.diffRatio, id).toBeLessThanOrEqual(1);
        }
      }
    });

    it("artigo e CPG têm similaridade alta (estrutura simples casa com o Word)", () => {
      const a = load();
      if (!a.wordAvailable) return;
      expect(a.templates.artigo.similarity).toBeGreaterThanOrEqual(0.9);
      expect(a.templates.resumo_expandido_cpg.similarity).toBeGreaterThanOrEqual(0.9);
    });
  },
);
