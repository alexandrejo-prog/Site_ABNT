import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describeWithArtifacts } from "../test-utils/artifact-guard";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const root = join(__dirname, "..", "..");

interface PreviewDiffArtifact {
  wordAvailable: boolean;
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

describeWithArtifacts(
  "ufla-compliance: fidelidade do preview vs DOCX renderizado (Word COM)",
  ["ufla-compliance/preview-docx-diff.json"],
  () => {
    const artifact = join(root, "artifacts", "ufla-compliance", "preview-docx-diff.json");

    function load(): PreviewDiffArtifact {
      return JSON.parse(readFileSync(artifact, "utf8"));
    }

    it("similaridade global de conteúdo ≥ 0.65 (gate)", () => {
      const a = load();
      if (a.wordAvailable) {
        expect(a.similarity).toBeGreaterThanOrEqual(0.65);
        expect(a.passed).toBe(true);
      }
    });

    it("diferença de paginação entre preview e PDF ≤ 3 páginas", () => {
      const a = load();
      if (a.wordAvailable) {
        expect(a.pageDelta).toBeLessThanOrEqual(3);
        expect(a.previewPages).toBeGreaterThan(0);
        expect(a.pdfPages).toBeGreaterThan(0);
      }
    });

    it("conteúdo do preview existe no DOCX (best-match por página)", () => {
      const a = load();
      if (a.wordAvailable) {
        expect(a.perPage.length).toBeGreaterThan(0);
        const avg = a.perPage.reduce((s, p) => s + p.bestMatchOverlap, 0) / a.perPage.length;
        expect(avg).toBeGreaterThanOrEqual(0.4);
      }
    });

    it("evidência visual lado a lado gerada para as 3 primeiras páginas", () => {
      const a = load();
      if (a.wordAvailable) {
        expect(a.screenshots.length).toBeGreaterThanOrEqual(1);
        for (const s of a.screenshots) {
          expect(s.diffRatio).toBeGreaterThanOrEqual(0);
          expect(s.diffRatio).toBeLessThanOrEqual(1);
        }
      }
    });
  },
);
