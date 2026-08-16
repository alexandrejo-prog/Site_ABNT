/**
 * Gate de regressão do PDF do Word contra a referência COMMITADA (previewPdfReferenceGate).
 *
 * Requer Word COM (máquina local com Word ou runner self-hosted com Word):
 *  1. Rende os 6 templates (DOCX → PDF via Word COM) e extrai páginas, numeração
 *     visível e assinaturas por página (pdfjs).
 *  2. Compara com a referência commitada (scripts/ufla-compliance/snapshots/
 *     preview-docx-snapshot.json) via classifyPdfChange:
 *       - match  → exit 0 (a renderização do Word está EM SINCRONIA com a referência).
 *       - update → exit 1 (preview/digest do DOCX mudaram — o snapshot precisa ser
 *                 regenerado e commitado; rode o regenerate local).
 *       - fail   → exit 1 (REGRESSÃO: o PDF mudou SEM mudança de preview/digest —
 *                 versão do Word, fontes, impressoras ou pipeline).
 *  3. Modo --refresh: regenera e ATUALIZA a referência commitada (usado para criar
 *     a run de referência no commit atual — esta máquina tem Word).
 *
 * Uso:
 *   npx tsx scripts/ufla-compliance/check-pdf-reference.ts          (gate)
 *   npx tsx scripts/ufla-compliance/check-pdf-reference.ts --refresh (criar referência)
 *
 * Saída: artifacts/ufla-compliance/pdf-reference-check.json; exit != 0 em falha.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { runPreviewDocxCompare } from "./compare-preview-docx.js";
import {
  buildPreviewSnapshot,
  classifyPdfChange,
  readCommittedPreviewSnapshot,
  writePreviewSnapshot,
  snapshotPath,
} from "./check-preview-snapshot.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");

export async function runPdfReferenceGate(refresh = false): Promise<{
  passed: boolean;
  action: "match" | "update" | "fail" | "skipped-no-word";
  failures: string[];
  wordAvailable: boolean;
  refreshed: boolean;
}> {
  // 1) Renderização atual do Word (compare completo: preview + PDF + evidência visual).
  //    Sem Word o compare aborta cedo e reporta wordAvailable=false (skipped-no-word).
  const compare = await runPreviewDocxCompare();
  if (!compare.wordAvailable) {
    return {
      passed: true,
      action: "skipped-no-word",
      failures: ["Word indisponível — gate do PDF não re-verificável; o digest do DOCX cobre o lado gerado."],
      wordAvailable: false,
      refreshed: false,
    };
  }

  const committed = readCommittedPreviewSnapshot();
  if (!committed) {
    return {
      passed: false,
      action: "fail",
      failures: ["Referência commitada ausente — rode com --refresh nesta máquina (com Word) para criá-la."],
      wordAvailable: true,
      refreshed: false,
    };
  }
  const cmp = compare.result.templates as Record<
    string,
    { pdfPages?: number | null; pdfSignatures?: Array<string> | null; pdfPageNumbers?: Array<number | null> | null }
  >;

  // 2) Monta o snapshot atual com o lado PDF fresco.
  const freshBase = await buildPreviewSnapshot();
  const fresh: Record<string, unknown> = {};
  for (const [id, entry] of Object.entries(freshBase)) {
    fresh[id] = {
      ...entry,
      pdfPages: cmp[id]?.pdfPages ?? null,
      pdfSignatures: cmp[id]?.pdfSignatures ?? null,
      pdfPageNumbers: cmp[id]?.pdfPageNumbers ?? null,
    };
  }

  // 3) Classifica a divergência contra a referência commitada.
  const { pdfFailures, action } = classifyPdfChange(committed, fresh as never);

  let refreshed = false;
  if (refresh && action === "update") {
    writePreviewSnapshot(fresh as never);
    refreshed = true;
  }

  const failures =
    action === "match"
      ? []
      : action === "update"
        ? [
            `Referência desatualizada: o preview/digest do DOCX mudou e a renderização do Word acompanhou (${pdfFailures.length} divergências). ${
              refresh ? "Referência REGENERADA e gravada em " + snapshotPath() + " — revise e commite."
              : "Rode o regenerate local (com Word) e commite o snapshot atualizado."
            }`,
          ]
        : pdfFailures;

  return {
    passed: action === "match" || (refresh && action === "update"),
    action,
    failures,
    wordAvailable: true,
    refreshed,
  };
}

async function main(): Promise<void> {
  const refresh = process.argv.includes("--refresh");
  const result = await runPdfReferenceGate(refresh);
  const out = join(ROOT, "artifacts", "ufla-compliance", "pdf-reference-check.json");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify({ ...result, generatedAt: new Date().toISOString(), refresh }, null, 2) + "\n", "utf8");
  console.log("OK:", "artifacts/ufla-compliance/pdf-reference-check.json");

  const label = { match: "PASSED (referência em sincronia)", update: "DESATUALIZADA", fail: "REGRESSÃO", "skipped-no-word": "SKIPPED (sem Word)" }[result.action];
  console.log(`Referência do PDF do Word: ${label}${refresh && result.refreshed ? " — referência regenerada" : ""}`);
  if (result.failures.length > 0) {
    console.log("  - " + result.failures.join("\n  - "));
  }
  process.exit(result.passed ? 0 : 1);
}

if (basename(process.argv[1] ?? "") === "check-pdf-reference.ts") {
  void main();
}
