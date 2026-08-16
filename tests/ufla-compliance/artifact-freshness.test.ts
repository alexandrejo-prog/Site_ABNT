import { it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describeWithArtifacts } from "../test-utils/artifact-guard";
import { checkArtifactFreshness, sourceFingerprint, reportFreshnessFromMarkdown } from "../../scripts/ufla-compliance/freshness";

// Durante o teste INTERNO da regeneração os artefatos ainda são os da rodada
// anterior (a regeneração grava os novos DEPOIS de rodar o npm test) — a
// checagem de frescor seria um falso negativo de transição. O VERIFY externo
// do ufla:audit (e o CI) valida o frescor com os artefatos já escritos.
const internalRegen = process.env.UFLA_REGEN_INTERNAL_TEST === "1";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function readJson(rel: string): unknown {
  return JSON.parse(readFileSync(join(ROOT, rel), "utf8"));
}

describeWithArtifacts(
  "frescor dos artefatos (WORKSLOP-003)",
  [
    "ufla-audit/gates.json",
    "ufla-compliance/rendered-analysis.json",
    "ufla-compliance/report.md",
  ],
  () => {
    it.skipIf(internalRegen)("gates.json carrega a impressão digital da fonte atual", () => {
      const failures = checkArtifactFreshness(readJson("artifacts/ufla-audit/gates.json"), "gates.json");
      expect(failures).toEqual([]);
    });

    it.skipIf(internalRegen)("rendered-analysis.json carrega a impressão digital da fonte atual", () => {
      const failures = checkArtifactFreshness(
        readJson("artifacts/ufla-compliance/rendered-analysis.json"),
        "rendered-analysis.json",
      );
      expect(failures).toEqual([]);
    });

    it.skipIf(internalRegen)("report.md (canônico) registra a impressão digital da fonte atual", () => {
      const markdown = readFileSync(join(ROOT, "artifacts/ufla-compliance/report.md"), "utf8");
      const fp = reportFreshnessFromMarkdown(markdown);
      expect(fp).toBeDefined();
      expect(fp).toBe(sourceFingerprint());
    });

    it("detecta impressão digital divergente (fonte mudou sem re-auditoria)", () => {
      const stale = {
        schema: "ufla-audit/gates/v1",
        freshness: { sourceFingerprint: "0000000000000000", generatedAt: "2026-01-01T00:00:00Z", tool: "test" },
      };
      const failures = checkArtifactFreshness(stale, "gates.json");
      expect(failures.length).toBeGreaterThan(0);
      expect(failures[0]).toContain("DESATUALIZADO");
    });

    it("detecta artefato sem impressão digital (pré-guarda)", () => {
      const failures = checkArtifactFreshness({ schema: "ufla-audit/gates/v1", gates: {} }, "gates.json");
      expect(failures.length).toBeGreaterThan(0);
      expect(failures[0]).toContain("SEM impressão digital");
    });
  },
);
