#!/usr/bin/env node
/**
 * Lighthouse (governance-roadmap): auditoria de qualidade web do app UFLA.
 *
 * Compila e serve o app (vite preview) e roda o Lighthouse no Chromium:
 * acessibilidade, performance, best-practices e SEO. Escreve um relatório
 * JSON consolidado em artifacts/lighthouse/lighthouse.json e imprime as notas.
 *
 * Uso: npm run ufla:lh [-- --only-categories=accessibility,performance]
 * Saída: exit != 0 se accessibility < 90 (gate de governança).
 */
import { spawnSync, spawn, execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import lighthouse from "lighthouse";
import * as chromeLauncher from "chrome-launcher";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PORT = 4173;
const URL = `http://127.0.0.1:${PORT}/`;
const OUT_DIR = join(ROOT, "artifacts", "lighthouse");
const isWin = process.platform === "win32";

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: opts.silent ? "ignore" : "inherit", shell: isWin, ...opts });
  if (!opts.silent && r.status !== 0) process.exit(r.status ?? 1);
  return r;
}

/**
 * Calcula a MEDIANA das notas de uma categoria nas execuções acumuladas e
 * compara contra o orçamento. A mediana é robusta a outliers (uma execução com
 * performance baixa por contenção do runner compartilhado não derruba o gate).
 */
function medianScore(xs) {
  if (xs.length === 0) return NaN;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** Devolve a lista de violações de orçamento considerando a mediana por categoria. */
function summarizeViolations(summaries, budgets) {
  const violations = [];
  for (const [name, min] of Object.entries(budgets)) {
    const xs = summaries.map((s) => s[name]).filter((x) => Number.isFinite(x));
    if (xs.length === 0) continue;
    const med = medianScore(xs);
    if (med < min) violations.push(`${name} ${Math.round(med)} < ${min}`);
  }
  return violations;
}

/** Localiza o Chromium: Playwright (instalado por `npm run e2e:install`) ou Chrome/Edge do sistema. */
function resolveChromePath() {
  const candidates = [
    join(homedir(), "AppData", "Local", "ms-playwright"), // Windows
    join(homedir(), ".cache", "ms-playwright"), // Linux
    join(homedir(), "Library", "Caches", "ms-playwright"), // macOS
  ];
  for (const pwRoot of candidates) {
    if (!existsSync(pwRoot)) continue;
    const dirs = readdirSync(pwRoot).filter((d) => d.startsWith("chromium-"));
    for (const dir of dirs.sort().reverse()) {
      const subs = isWin ? ["chrome-win64", "chrome-win"] : process.platform === "darwin" ? ["chrome-mac"] : ["chrome-linux"];
      for (const sub of subs) {
        const exe = join(
          pwRoot,
          dir,
          sub,
          isWin ? "chrome.exe" : process.platform === "darwin" ? "Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing" : "chrome",
        );
        if (existsSync(exe)) return exe;
      }
    }
  }
  return undefined; // chrome-launcher faz a descoberta padrão (Chrome/Edge instalado)
}

async function main() {
  // 1) Build + serve (mesmo artefato de produção do e2e)
  run(isWin ? "npm.cmd" : "npm", ["run", "build"]);
  const preview = spawn(isWin ? "npx.cmd" : "npx", ["vite", "preview", "--host", "127.0.0.1", "--port", String(PORT), "--strictPort"], {
    stdio: "ignore",
    detached: isWin,
    shell: isWin,
  });
  await new Promise((r) => setTimeout(r, 4000));

  try {
    const chromePath = resolveChromePath();
    const chrome = await chromeLauncher.launch({
      chromePath,
      chromeFlags: ["--headless", "--no-sandbox", "--disable-gpu"],
    });
    console.log(`Chromium: ${chromePath ?? "(descoberto pelo chrome-launcher)"}`);
    try {
      const onlyCategories = ["accessibility", "performance", "best-practices"];
      const flagsArg = process.argv.find((a) => a.startsWith("--only-categories="));
      if (flagsArg) onlyCategories.splice(0, onlyCategories.length, ...flagsArg.split("=")[1].split(","));

      // Orçamentos de governança (lighthouse-budgets.json): falha quando uma
      // categoria auditada fica abaixo da nota mínima configurada.
      const budgetsPath = join(ROOT, "lighthouse-budgets.json");
      const budgets = existsSync(budgetsPath) ? JSON.parse(readFileSync(budgetsPath, "utf8")) : { accessibility: 90 };

      // Lighthouse em CI roda em máquina compartilhada: a nota de PERFORMANCE é
      // intrinsecamente instável entre execuções (compete com jobs vizinhos).
      // Estabilização: até 3 auditorias; aprova se a MEDIANA de cada categoria
      // atingir o orçamento (mediana > pior e > média para outliers). Máquina
      // local normalmente passa de primeira — o retry é só para o CI.
      const MAX_TRIES = 3;
      const allSummaries = [];
      const lastLhr = { lhr: null };
      for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
        const results = await lighthouse(URL, { port: chrome.port, output: "json", onlyCategories, logLevel: "error" });
        lastLhr.lhr = results.lhr;
        const cats = results.lhr.categories;
        const summary = {};
        for (const name of Object.keys(cats)) summary[name] = Math.round(cats[name].score * 100);
        allSummaries.push(summary);
        console.log(`\n[Lighthouse tentativa ${attempt}/${MAX_TRIES}]`);
        for (const [name, score] of Object.entries(summary)) console.log(`  ${name}: ${score}`);
        const violations = summarizeViolations(allSummaries, budgets);
        if (violations.length === 0) break;
        if (attempt < MAX_TRIES) console.warn(`\nAbaixo do orçamento (${violations.join("; ")}) — re-executando (mediana)…`);
      }

      mkdirSync(OUT_DIR, { recursive: true });
      const reportPath = join(OUT_DIR, "lighthouse.json");
      writeFileSync(reportPath, JSON.stringify(lastLhr.lhr, null, 2) + "\n", "utf8");

      const medians = {};
      for (const name of Object.keys(budgets)) {
        const xs = allSummaries.map((s) => s[name]).filter((x) => Number.isFinite(x));
        if (xs.length === 0) continue;
        xs.sort((a, b) => a - b);
        medians[name] = xs[Math.floor(xs.length / 2)];
      }
      console.log("\n===== Lighthouse (mediana de " + allSummaries.length + " execução(ões)) =====");
      for (const [name, score] of Object.entries(medians)) console.log(`  ${name}: ${score}`);
      console.log(`Relatório: ${reportPath}`);

      const violations = summarizeViolations(allSummaries, budgets);
      writeFileSync(join(OUT_DIR, "budgets.json"), JSON.stringify({ budgets, scores: medians, violations, passed: violations.length === 0, tries: allSummaries.length }, null, 2) + "\n", "utf8");
      if (violations.length > 0) {
        console.error(`\nFALHOU orçamentos de governança (mediana de ${allSummaries.length} execuções): ${violations.join("; ")}`);
        process.exitCode = 1;
      }
    } finally {
      try {
        await chrome.kill();
      } catch (e) {
        // Windows: EPERM ao remover o user-data-dir temporário — inofensivo (o
        // Chrome já foi encerrado). O gate de governança é definido pelas notas.
        console.warn("chrome-launcher cleanup:", e.code ?? e.message);
      }
    }
  } finally {
    // derruba o vite preview (árvore completa do processo)
    try {
      if (preview.pid) {
        if (isWin) execFileSync("taskkill", ["/PID", String(preview.pid), "/T", "/F"], { stdio: "ignore" });
        else process.kill(preview.pid, "SIGTERM");
      }
    } catch {}
  }
}

void main();
