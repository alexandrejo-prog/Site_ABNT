/**
 * Auditoria UFLA completa em UM comando (npm run ufla:audit).
 *
 * Orquestra, com LOCK e falha rápida, o pipeline inteiro de conformidade:
 *  1. lint
 *  2. regenerate-official-artifacts (Word COM + PDF físico + gate expandido +
 *     gate por tipo + auditoria cruzada de formatos + artefatos/traceability;
 *     roda o npm test interno com spawnSync — não lança, grava artefatos
 *     CONSISTENTES mesmo com testes falhando)
 *  3. verify (testes + build) — valida os artefatos FRESCOS do regenerate
 *
 * Ordem regenerate → verify: o verify valida os artefatos recém-gerados em vez
 * de artefatos stale de uma rodada anterior falha — se uma rodada falha, o
 * artefato fica consistente (codeGate/fullComplianceGate failed) e a próxima
 * auditoria se auto-cura quando o código voltar a passar.
 *
 * Lock: artifacts/ufla-audit/.audit.lock contém o PID; uma segunda execução
 * concorrente aborta imediatamente. Locks órfãos (processo morto) são
 * reaproveitados automaticamente.
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const LOCK = join(ROOT, "artifacts", "ufla-audit", ".audit.lock");
const MAX_STEP_MS = 15 * 60 * 1000;

function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function acquireLock(): boolean {
  if (existsSync(LOCK)) {
    const pid = parseInt(readFileSync(LOCK, "utf8").trim(), 10);
    if (Number.isFinite(pid) && processAlive(pid)) {
      console.error(`[ufla:audit] LOCK ativo (PID ${pid}) — outra execução em andamento. Abortando.`);
      return false;
    }
    console.warn(`[ufla:audit] Lock órfão (PID ${pid} morto) — reaproveitando.`);
    rmSync(LOCK, { force: true });
  }
  writeFileSync(LOCK, String(process.pid), "utf8");
  return true;
}

function releaseLock(): void {
  rmSync(LOCK, { force: true });
}

function runStep(name: string, command: string): void {
  console.log(`\n===== [ufla:audit] ${name} =====`);
  execSync(command, { cwd: ROOT, stdio: "inherit", timeout: MAX_STEP_MS, shell: process.platform === "win32" ? "cmd.exe" : "/bin/bash" });
  console.log(`[ufla:audit] ${name}: OK`);
}

async function main(): Promise<void> {
  if (!acquireLock()) process.exit(1);
  const started = Date.now();
  try {
    const steps: Array<[string, string]> = [
      ["LINT", "npm run lint"],
      ["TYPECHECK (scripts/ufla-compliance)", "npm run typecheck:scripts"],
      ["REGENERATE (Word COM + PDF físico + gates + artefatos)", "npx tsx scripts/ufla-compliance/regenerate-official-artifacts.ts"],
      ["VERIFY (testes + build)", "npm run verify"],
    ];
    for (const [name, cmd] of steps) runStep(name, cmd);

    const gates = JSON.parse(readFileSync(join(ROOT, "artifacts", "ufla-audit", "gates.json"), "utf8"));
    const elapsed = Math.round((Date.now() - started) / 1000);
    console.log(`\n===== [ufla:audit] RESUMO (${elapsed}s) =====`);
    for (const [name, gate] of Object.entries(gates.gates as Record<string, { status: string }>)) {
      console.log(`  ${name}: ${gate.status}`);
    }
    console.log(`  overall: ${gates.overall}`);
    console.log(`  conclusion: ${gates.conclusion}`);
    if (gates.overall !== "passed") {
      console.error("[ufla:audit] FALHOU — gates não estão todos passed.");
      process.exitCode = 1;
    }
  } finally {
    releaseLock();
  }
}

const isDirectRun =
  typeof process.argv[1] === "string" && process.argv[1].endsWith("run-ufla-audit.ts");
if (isDirectRun) {
  void main();
}
