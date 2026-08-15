/**
 * Verificações de conformidade executáveis no CI (sem Word/PDF).
 *
 * Roda as partes do pipeline que NÃO dependem de renderização Word:
 *  1. Auditoria cruzada de formatos (UFLA-formatos-20) — mapeamento completo.
 *  2. Gate expandido por tipo de trabalho — gera os 15 DOCX de exemplo e roda
 *     o gate (pré-textuais/textuais/pós-textuais/referências/citações/figuras/
 *     seções/tabelas/equações/paginação + requiredFields da Coleção).
 *
 * Uso (CI): npx tsx scripts/ufla-compliance/ci-checks.ts
 * Saída: artifacts/ufla-compliance/ci-checks.json; exit != 0 em falha.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { auditFormatsCross } from "./audit-formats-cross";
import { runPerTypeGates } from "./run-gate-per-type";
import { runPerTypePhysical } from "./analyze-per-type-pdfs";
import { runPreviewSnapshotCheck } from "./check-preview-snapshot";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");

async function main(): Promise<void> {
  const failures: string[] = [];

  // 1) Auditoria cruzada de formatos
  const formats = auditFormatsCross();
  const formatsOk =
    formats.checks.allFormatsMapped &&
    formats.checks.noOrphanRequirements &&
    formats.checks.noDeadTypes &&
    formats.checks.allCoverageOk;
  if (!formatsOk) {
    failures.push(
      `Auditoria cruzada: ${[
        ...formats.checks.unmappedFormats.map((f) => `formato sem mapeamento: ${f}`),
        ...formats.checks.orphanRequirements.map((r) => `requisito órfão: ${r}`),
        ...formats.checks.deadTypes.map((t) => `tipo morto: ${t}`),
        ...formats.checks.formatsWithoutCoverage.map((f) => `formato sem cobertura: ${f}`),
      ].join("; ")}`,
    );
  }

  // 2) Gate por tipo (gera DOCX e roda o gate expandido)
  const perType = await runPerTypeGates();
  for (const [formatId, result] of Object.entries(perType)) {
    const r = result as { passed: boolean; gaps: string[] };
    if (!r.passed) failures.push(`Gate ${formatId}: ${r.gaps.join("; ")}`);
  }

  // 3) Física PDF por tipo — sem Word no CI: todos os tipos ficam skipped-no-word
  //    e o gate passa de forma graciosa (sem PDF não há o que analisar).
  const perTypePhysical = await runPerTypePhysical();
  if (!perTypePhysical.wordAvailable) {
    console.log("CI: Word indisponível — física PDF por tipo saltada (skipped-no-word), gate passed.");
  } else if (!perTypePhysical.passed) {
    failures.push(`Física PDF por tipo: ${perTypePhysical.failures.join("; ")}`);
  }

  // 4) Snapshot de paginação do preview — Word-free: qualquer mudança de
  //    paginação/conteúdo por página entre releases falha o CI.
  const previewSnapshot = await runPreviewSnapshotCheck();
  if (!previewSnapshot.passed) failures.push(`Snapshot de preview: ${previewSnapshot.failures.join("; ")}`);

  const summary = {
    schema: "ufla-audit/ci-checks/v1",
    generatedAt: new Date().toISOString(),
    formatsCross: formats.checks,
    perType: Object.fromEntries(
      Object.entries(perType).map(([id, r]) => [id, (r as { passed: boolean }).passed]),
    ),
    totalPerType: Object.keys(perType).length,
    perTypePhysical: {
      wordAvailable: perTypePhysical.wordAvailable,
      rendered: Object.keys(perTypePhysical.rendered).length,
      passed: perTypePhysical.passed,
    },
    previewSnapshot: { passed: previewSnapshot.passed },
    passed: failures.length === 0,
    failures,
  };

  mkdirSync(join(ROOT, "artifacts", "ufla-compliance"), { recursive: true });
  writeFileSync(join(ROOT, "artifacts", "ufla-compliance", "ci-checks.json"), JSON.stringify(summary, null, 2) + "\n", "utf8");

  console.log(`Formatos: ${formats.summary.totalFormats} | Tipos gateados: ${summary.totalPerType}`);
  console.log(`CI CHECKS: ${summary.passed ? "PASSED" : `FAILED (${failures.length})`}`);
  for (const f of failures) console.log(`  - ${f}`);
  if (!summary.passed) process.exitCode = 1;
}

const isDirectRun =
  typeof process.argv[1] === "string" && process.argv[1].endsWith("ci-checks.ts");
if (isDirectRun) {
  void main();
}
