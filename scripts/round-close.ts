/**
 * C2 (checklist-15): rotina ÚNICA de fechamento de rodada.
 *
 * Valida as pré-condições antes de declarar uma rodada fechada:
 *   1. lint 0/0
 *   2. typecheck limpo (tsc --noEmit)
 *   3. suíte de testes verde
 *   4. auditoria FRESCA e com todos os gates passed — lê artifacts/ufla-audit/
 *      gates.json e compara sourceFingerprint com a fonte atual (WORKSLOP-003);
 *      se stale → manda rodar `npm run ufla:audit` (o gate "11/11"/"13/13" só é
 *      verdade quando a evidência foi regenerada com a fonte atual).
 *   5. árvore git: aviso se houver mudanças não commitadas (a rodada fecha com
 *      commits granulares).
 *
 * Ao final aponta os arquivos canônicos a atualizar. Exit 0 = pré-condições ok.
 *
 * Uso: npm run round:close
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { checkArtifactFreshness, sourceFingerprint } from "./ufla-compliance/freshness.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function run(command: string, args: string[]): { ok: boolean; output: string } {
  try {
    const output = execFileSync(command, args, { cwd: ROOT, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], timeout: 600_000 });
    return { ok: true, output };
  } catch (error) {
    const stdout = (error as { stdout?: string }).stdout ?? "";
    const stderr = (error as { stderr?: string }).stderr ?? "";
    return { ok: false, output: `${stdout}\n${stderr}`.trim() };
  }
}

const failures: string[] = [];
const warnings: string[] = [];
const ok = (label: string) => console.log(`  ✔ ${label}`);
const fail = (label: string, detail: string) => {
  failures.push(label);
  console.log(`  ✘ ${label}: ${detail.split("\n").slice(-6).join("\n")}`);
};
const warn = (label: string) => {
  warnings.push(label);
  console.log(`  ⚠ ${label}`);
};

console.log("Fechamento de rodada — pré-condições\n");

// 1) Lint
console.log("[1/5] lint");
const lint = run("npm", ["run", "lint", "--silent"]);
if (!lint.ok) {
  fail("lint", lint.output || "lint falhou");
} else if (/[1-9]\d*\s+(error|warning)/.test(lint.output)) {
  fail("lint", lint.output);
} else {
  ok("lint 0/0");
}

// 2) Typecheck
console.log("[2/5] typecheck");
const tsc = run("npx", ["tsc", "--noEmit", "-p", "tsconfig.json"]);
if (!tsc.ok) {
  fail("typecheck", tsc.output || "tsc falhou");
} else {
  ok("tsc --noEmit limpo");
}

// 3) Suíte de testes
console.log("[3/5] testes");
const tests = run("npm", ["test", "--", "--run"]);
if (!tests.ok) {
  fail("testes", tests.output || "suíte falhou");
} else {
  ok("suíte verde");
}

// 4) Auditoria fresca + gates passed
console.log("[4/5] auditoria (frescor + gates)");
const gatesPath = join(ROOT, "artifacts", "ufla-audit", "gates.json");
if (!existsSync(gatesPath)) {
  fail("auditoria", "artifacts/ufla-audit/gates.json ausente — rode `npm run ufla:audit` nesta máquina com Word.");
} else {
  let gates: { freshness?: { sourceFingerprint?: string }; meta?: { sourceFingerprint?: string }; overall?: string; gates?: Record<string, { status: string }> };
  try {
    gates = JSON.parse(readFileSync(gatesPath, "utf8"));
  } catch {
    fail("auditoria", "gates.json ilegível — rode `npm run ufla:audit`.");
    gates = {};
  }
  const freshnessFailures = checkArtifactFreshness(gates, "artifacts/ufla-audit/gates.json");
  if (freshnessFailures.length > 0) {
    fail("auditoria fresca", freshnessFailures.join("; ") + " — rode `npm run ufla:audit`.");
  } else {
    ok(`auditoria fresca (sourceFingerprint ${sourceFingerprint()})`);
  }
  const gateList = Object.entries(gates.gates ?? {});
  const failedGates = gateList.filter(([, g]) => g.status !== "passed");
  if (gates.overall && gates.overall === "passed" && failedGates.length === 0) {
    ok(`gates todos passed (${gateList.length}/${gateList.length})`);
  } else if (gates.overall) {
    fail("gates", `overall=${gates.overall}; gates não-passed: ${failedGates.map(([n]) => n).join(", ") || "nenhum"}`);
  } else {
    fail("gates", "gates.json sem overall — rode `npm run ufla:audit`.");
  }
}

// 5) Árvore git
console.log("[5/5] árvore git");
const git = run("git", ["status", "--porcelain"]);
if (git.ok && git.output.trim()) {
  warn(`há mudanças não commitadas (${git.output.trim().split("\n").length} arquivos) — a rodada fecha com commits granulares`);
} else {
  ok("árvore limpa");
}

console.log("\nArquivos canônicos a atualizar ao fechar a rodada:");
console.log("  - docs/STATUS_ATUAL.md  (rodada + evidências + suíte de testes)");
console.log("  - context.md            (seção da rodada + sumário executivo)");
console.log("  - docs/checklist-15-melhorias.md (marcar [x] com evidências)");

if (failures.length > 0) {
  console.log(`\nFECHAMENTO BLOQUEADO — ${failures.length} pré-condição(ões) não atendida(s): ${failures.join(", ")}`);
  process.exit(1);
}
console.log(warnings.length > 0 ? `\nPRÉ-CONDIÇÕES OK (${warnings.length} aviso(s)) — pode fechar a rodada.` : "\nPRÉ-CONDIÇÕES OK — pode fechar a rodada.");
process.exit(0);
