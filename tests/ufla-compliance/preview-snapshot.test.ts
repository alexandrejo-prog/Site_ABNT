import { expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describeWithArtifacts } from "../test-utils/artifact-guard";
import {
  buildPreviewSnapshot,
  classifyPdfChange,
  comparePdfReference,
  compareSnapshots,
  docxDigestFor,
  type PreviewSnapshot,
  type PreviewSnapshotTemplate,
} from "../../scripts/ufla-compliance/check-preview-snapshot";
import { TEMPLATES } from "../../scripts/ufla-compliance/compare-preview-docx";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const root = join(__dirname, "..", "..");
const SNAPSHOT = join(root, "scripts", "ufla-compliance", "snapshots", "preview-docx-snapshot.json");

describeWithArtifacts(
  "ufla-compliance: snapshot de paginação do preview (regressões entre releases)",
  ["../scripts/ufla-compliance/snapshots/preview-docx-snapshot.json"],
  () => {
    it("snapshot cobre os 6 templates com paginação, digest do DOCX e referência do PDF", () => {
      const committed = JSON.parse(readFileSync(SNAPSHOT, "utf8")).templates as PreviewSnapshot;
      const ids = Object.keys(committed).sort();
      expect(ids).toEqual(["artigo", "dissertacao", "monografia", "projeto_pesquisa", "resumo_expandido_cpg", "tese"].sort());
      for (const [id, t] of Object.entries(committed)) {
        expect(t.previewPages, id).toBeGreaterThan(0);
        expect(t.signatures.length, id).toBe(t.previewPages);
        expect(t.pageNumbers.length, id).toBe(t.previewPages);
        expect(typeof t.docxDigest, id).toBe("string");
        if (t.pdfPages !== null) {
          expect(t.pdfSignatures?.length, id).toBe(t.pdfPages);
          expect(t.pdfPageNumbers?.length, id).toBe(t.pdfPages);
        }
      }
    });

    it("buildPreviewSnapshot é determinístico (duas execuções idênticas, incluindo digest)", async () => {
      const a = await buildPreviewSnapshot();
      const b = await buildPreviewSnapshot();
      expect(a).toEqual(b);
    });

    it("digest do DOCX é estável entre gerações (bookmark ids normalizados)", async () => {
      for (const tpl of TEMPLATES) {
        const d1 = await docxDigestFor(tpl.input, tpl.generate);
        const d2 = await docxDigestFor(tpl.input, tpl.generate);
        expect(d1, tpl.id).toBe(d2);
        expect(d1.length).toBe(16);
      }
    });

    it("preview atual e DOCX gerado estão em conformidade com o snapshot commitado", async () => {
      const committed = JSON.parse(readFileSync(SNAPSHOT, "utf8")).templates as PreviewSnapshot;
      const current = await buildPreviewSnapshot();
      expect(compareSnapshots(committed, current)).toEqual([]);
    });

    it("detecta regressão de paginação (página a mais) e de numeração", async () => {
      const committed = JSON.parse(readFileSync(SNAPSHOT, "utf8")).templates as PreviewSnapshot;
      const current = await buildPreviewSnapshot();
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

    it("detecta regressão do DOCX gerado (digest muda)", async () => {
      const committed = JSON.parse(readFileSync(SNAPSHOT, "utf8")).templates as PreviewSnapshot;
      const current = await buildPreviewSnapshot();
      const withDocxChange: PreviewSnapshot = structuredClone(current);
      const tpl = withDocxChange.monografia as PreviewSnapshotTemplate;
      tpl.docxDigest = "ffffffffffffffff";
      const failures = compareSnapshots(committed, withDocxChange);
      expect(failures.some((f) => f.includes("REGRESSÃO DO DOCX monografia"))).toBe(true);
    });

    it("detecta regressão de conteúdo por página (assinatura muda)", async () => {
      const committed = JSON.parse(readFileSync(SNAPSHOT, "utf8")).templates as PreviewSnapshot;
      const current = await buildPreviewSnapshot();
      const withContentChange: PreviewSnapshot = structuredClone(current);
      const tpl = withContentChange.artigo as PreviewSnapshotTemplate;
      tpl.signatures = [...tpl.signatures];
      tpl.signatures[0] = "ffffffffffffffff";
      const failures = compareSnapshots(committed, withContentChange);
      expect(failures.some((f) => f.includes("REGRESSÃO DE CONTEÚDO artigo página 1"))).toBe(true);
    });

    it("detecta regressão do lado PDF: página a mais renderizada pelo Word", async () => {
      const committed = JSON.parse(readFileSync(SNAPSHOT, "utf8")).templates as PreviewSnapshot;
      const committedMono = committed.monografia as PreviewSnapshotTemplate;
      // A referência commitada precisa ter o lado PDF (rodada local com Word).
      expect(committedMono.pdfPages, "monografia deve ter referência PDF commitada").not.toBeNull();
      const withMorePages: PreviewSnapshot = structuredClone(committed);
      const tpl = withMorePages.monografia as PreviewSnapshotTemplate;
      tpl.pdfPages = (tpl.pdfPages ?? 0) + 1;
      tpl.pdfSignatures = [...(tpl.pdfSignatures ?? []), "0000000000000000"];
      tpl.pdfPageNumbers = [...(tpl.pdfPageNumbers ?? []), 99];
      const failures = comparePdfReference(committed, withMorePages);
      expect(failures.some((f) => f.includes("REGRESSÃO PDF monografia"))).toBe(true);
      // Mesma mudança não é regressão de preview (compareSnapshots não olha o PDF).
      expect(compareSnapshots(committed, withMorePages)).toEqual([]);
    });

    it("detecta regressão do lado PDF: numeração visível alterada", async () => {
      const committed = JSON.parse(readFileSync(SNAPSHOT, "utf8")).templates as PreviewSnapshot;
      const withNum: PreviewSnapshot = structuredClone(committed);
      const tpl = withNum.dissertacao as PreviewSnapshotTemplate;
      tpl.pdfPageNumbers = [...(tpl.pdfPageNumbers ?? [])];
      tpl.pdfPageNumbers[0] = 999;
      const failures = comparePdfReference(committed, withNum);
      expect(failures.some((f) => f.includes("REGRESSÃO PDF dissertacao página 1") && f.includes("numeração"))).toBe(true);
    });

    it("detecta regressão do lado PDF: conteúdo renderizado pelo Word mudou", async () => {
      const committed = JSON.parse(readFileSync(SNAPSHOT, "utf8")).templates as PreviewSnapshot;
      const withSig: PreviewSnapshot = structuredClone(committed);
      const tpl = withSig.tese as PreviewSnapshotTemplate;
      tpl.pdfSignatures = [...(tpl.pdfSignatures ?? [])];
      tpl.pdfSignatures[0] = "ffffffffffffffff";
      const failures = comparePdfReference(committed, withSig);
      expect(failures.some((f) => f.includes("REGRESSÃO PDF tese página 1") && f.includes("assinatura"))).toBe(true);
    });

    it("classifica: PDF divergiu sem mudança de preview/digest → regressão (fail)", async () => {
      const committed = JSON.parse(readFileSync(SNAPSHOT, "utf8")).templates as PreviewSnapshot;
      const withOnlyPdfChange: PreviewSnapshot = structuredClone(committed);
      const tpl = withOnlyPdfChange.monografia as PreviewSnapshotTemplate;
      tpl.pdfPageNumbers = [...(tpl.pdfPageNumbers ?? [])];
      tpl.pdfPageNumbers[0] = 42;
      const d = classifyPdfChange(committed, withOnlyPdfChange);
      expect(d.pdfFailures.length).toBeGreaterThan(0);
      expect(d.previewOrDocxChanged).toBe(false);
      expect(d.action).toBe("fail");
    });

    it("classifica: PDF divergiu junto com preview/digest → atualização intencional (update)", async () => {
      const committed = JSON.parse(readFileSync(SNAPSHOT, "utf8")).templates as PreviewSnapshot;
      const withBoth: PreviewSnapshot = structuredClone(committed);
      const tpl = withBoth.monografia as PreviewSnapshotTemplate;
      tpl.pdfPageNumbers = [...(tpl.pdfPageNumbers ?? [])];
      tpl.pdfPageNumbers[0] = 42;
      tpl.docxDigest = "abcdef0123456789";
      const d = classifyPdfChange(committed, withBoth);
      expect(d.pdfFailures.length).toBeGreaterThan(0);
      expect(d.previewOrDocxChanged).toBe(true);
      expect(d.action).toBe("update");
    });

    it("classifica: PDF em sincronia → match", async () => {
      const committed = JSON.parse(readFileSync(SNAPSHOT, "utf8")).templates as PreviewSnapshot;
      const d = classifyPdfChange(committed, structuredClone(committed));
      expect(d.pdfFailures).toEqual([]);
      expect(d.action).toBe("match");
    });
  },
);

it("snapshot commitado deve existir (contrato do CI sem Word)", () => {
  expect(existsSync(SNAPSHOT)).toBe(true);
});
