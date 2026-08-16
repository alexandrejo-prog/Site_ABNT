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
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { auditFormatsCross } from "./audit-formats-cross";
import { runPerTypeGates } from "./run-gate-per-type";
import { runPerTypePhysical } from "./analyze-per-type-pdfs";
import { runPreviewSnapshotCheck, readCommittedPreviewSnapshot, validateSnapshotOoxmlCoherence } from "./check-preview-snapshot";
import { embedFreshness, checkArtifactFreshness, sourceFingerprint, reportFreshnessFromMarkdown } from "./freshness";

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

  // 5) Referência do PDF do Word (previewPdfReferenceGate): sem Word o CI não
  //    re-renderiza — o gate roda na máquina com Word (regenerate). Aqui valida-se
  //    a COERÊNCIA da referência commitada (páginas × numeração × assinaturas) e
  //    a coerência OOXML↔PDF (pgNumType w:start do DOCX gerado ↔ primeiro número
  //    visível da referência — DECISION-010).
  const committedSnap = readCommittedPreviewSnapshot();
  const pdfCoherenceFailures: string[] = [];
  if (committedSnap) {
    for (const [id, t] of Object.entries(committedSnap)) {
      if (t.pdfPages === null) continue;
      if (t.pdfSignatures?.length !== t.pdfPages || t.pdfPageNumbers?.length !== t.pdfPages) {
        pdfCoherenceFailures.push(`referência PDF de ${id} incoerente: ${t.pdfPages} páginas vs ${t.pdfSignatures?.length} assinaturas / ${t.pdfPageNumbers?.length} numerações.`);
      }
    }
    const ooxmlCoherence = await validateSnapshotOoxmlCoherence(committedSnap);
    if (ooxmlCoherence.length > 0) pdfCoherenceFailures.push(...ooxmlCoherence);
  } else {
    pdfCoherenceFailures.push("snapshot de paginação não encontrado — rode o regenerate local com Word para criá-lo.");
  }
  if (pdfCoherenceFailures.length > 0) failures.push(`Referência PDF commitada: ${pdfCoherenceFailures.join("; ")}`);

  // 6) Frescor dos artefatos (WORKSLOP-003): se a fonte mudou desde a última
  //    regeneração sem re-auditoria, a evidência está desatualizada. artifacts/
  //    é gitignored e só existe onde o ufla:audit rodou (máquina com Word); no
  //    CI sem artefatos a checagem é skipped (nada a validar), como os demais
  //    gates word-dependentes. ONDE O ARTEFATO EXISTE, a checagem é ESTRITA.
  const artifactChecks: Array<{ artifact: string; fresh: boolean; failures: string[] }> = [];
  for (const rel of [
    "artifacts/ufla-audit/gates.json",
    "artifacts/ufla-compliance/rendered-analysis.json",
    "artifacts/ufla-compliance/report.md",
  ]) {
    const path = join(ROOT, rel);
    if (!existsSync(path)) {
      artifactChecks.push({ artifact: rel, fresh: true, failures: [`${rel}: ausente (artifacts/ gitignored) — checagem skipped no CI sem Word.`] });
      continue;
    }
    try {
      if (rel.endsWith(".md")) {
        const text = readFileSync(path, "utf8");
        const fp = reportFreshnessFromMarkdown(text);
        const failures = fp === sourceFingerprint() ? [] : [
          `${rel}: ${fp ? `impressão ${fp} ≠ fonte atual ${sourceFingerprint()}` : "sem impressão digital no rodapé"} — rode npm run ufla:audit nesta máquina com Word.`,
        ];
        artifactChecks.push({ artifact: rel, fresh: failures.length === 0, failures });
      } else {
        const json = JSON.parse(readFileSync(path, "utf8"));
        const failures = checkArtifactFreshness(json, rel);
        artifactChecks.push({ artifact: rel, fresh: failures.length === 0, failures });
      }
    } catch {
      artifactChecks.push({ artifact: rel, fresh: false, failures: [`${rel}: ilegível — rode npm run ufla:audit nesta máquina com Word.`] });
    }
  }
  const staleArtifacts = artifactChecks.filter((a) => !a.fresh);
  if (staleArtifacts.length > 0) {
    failures.push(`Frescor dos artefatos (WORKSLOP-003): ${staleArtifacts.flatMap((a) => a.failures).join("; ")}`);
  }

  const summary = embedFreshness({
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
    previewPdfReference: {
      status: "skipped-no-word",
      evidence:
        "Referência do PDF do Word não re-verificável no CI (sem Word) — o gate roda na máquina com Word (regenerate) comparando a renderização atual com a referência commitada; aqui valida-se apenas a coerência da referência (páginas × numeração × assinaturas) e o digest do DOCX cobre o lado gerado.",
      coherent: pdfCoherenceFailures.length === 0,
    },
    artifactFreshness: {
      checked: artifactChecks,
      stale: staleArtifacts.map((a) => a.artifact),
    },
    passed: failures.length === 0,
    failures,
  });

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
