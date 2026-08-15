import { expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describeWithArtifacts } from "../test-utils/artifact-guard";
import { buildPreviewSnapshot, compareSnapshots, type PreviewSnapshot, type PreviewSnapshotTemplate } from "../../scripts/ufla-compliance/check-preview-snapshot";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const root = join(__dirname, "..", "..");
const SNAPSHOT = join(root, "scripts", "ufla-compliance", "snapshots", "preview-docx-snapshot.json");

describeWithArtifacts(
  "ufla-compliance: snapshot de paginação do preview (regressões entre releases)",
  ["../scripts/ufla-compliance/snapshots/preview-docx-snapshot.json"],
  () => {
    it("snapshot cobre os 6 templates e tem paginação por página", () => {
      const committed = JSON.parse(readFileSync(SNAPSHOT, "utf8")).templates as PreviewSnapshot;
      const ids = Object.keys(committed).sort();
      expect(ids).toEqual(["artigo", "dissertacao", "monografia", "projeto_pesquisa", "resumo_expandido_cpg", "tese"].sort());
      for (const [id, t] of Object.entries(committed)) {
        expect(t.previewPages, id).toBeGreaterThan(0);
        expect(t.signatures.length, id).toBe(t.previewPages);
        expect(t.pageNumbers.length, id).toBe(t.previewPages);
      }
    });

    it("buildPreviewSnapshot é determinístico (duas execuções idênticas)", () => {
      const a = buildPreviewSnapshot();
      const b = buildPreviewSnapshot();
      expect(a).toEqual(b);
    });

    it("preview atual está em conformidade com o snapshot commitado", () => {
      const committed = JSON.parse(readFileSync(SNAPSHOT, "utf8")).templates as PreviewSnapshot;
      const current = buildPreviewSnapshot();
      expect(compareSnapshots(committed, current)).toEqual([]);
    });

    it("detecta regressão de paginação (página a mais) e de numeração", () => {
      const committed = JSON.parse(readFileSync(SNAPSHOT, "utf8")).templates as PreviewSnapshot;
      const current = buildPreviewSnapshot();
      const withExtraPage: PreviewSnapshot = structuredClone(current);
      const tpl = withExtraPage.monografia as PreviewSnapshotTemplate;
      tpl.previewPages += 1;
      tpl.signatures.push("0000000000000000");
      tpl.pageNumbers.push(99);
      const pagFailures = compareSnapshots(committed, withExtraPage);
      expect(pagFailures.some((f) => f.includes("REGRESSÃO DE PAGINAÇÃO monografia"))).toBe(true);

      const withNumChange: PreviewSnapshot = structuredClone(current);
      (withNumChange.monografia as PreviewSnapshotTemplate).pageNumbers = [...(withNumChange.monografia as PreviewSnapshotTemplate).pageNumbers];
      (withNumChange.monografia as PreviewSnapshotTemplate).pageNumbers[5] = 999;
      const numFailures = compareSnapshots(committed, withNumChange);
      expect(numFailures.some((f) => f.includes("REGRESSÃO DE NUMERAÇÃO monografia página 6"))).toBe(true);
    });

    it("detecta regressão de conteúdo por página (assinatura muda)", () => {
      const committed = JSON.parse(readFileSync(SNAPSHOT, "utf8")).templates as PreviewSnapshot;
      const current = buildPreviewSnapshot();
      const withContentChange: PreviewSnapshot = structuredClone(current);
      const tpl = withContentChange.artigo as PreviewSnapshotTemplate;
      tpl.signatures = [...tpl.signatures];
      tpl.signatures[0] = "ffffffffffffffff";
      const failures = compareSnapshots(committed, withContentChange);
      expect(failures.some((f) => f.includes("REGRESSÃO DE CONTEÚDO artigo página 1"))).toBe(true);
    });
  },
);

it("snapshot commitado deve existir (contrato do CI sem Word)", () => {
  expect(existsSync(SNAPSHOT)).toBe(true);
});
