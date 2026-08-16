/**
 * Frescor dos artefatos por IMPRESSÃO DIGITAL DA FONTE (fecha WORKSLOP-003).
 *
 * O problema: gates liam artefatos de artifacts/ sem validar se a fonte que os
 * gera mudou desde a última regeneração — um artefato presente porém
 * DESATUALIZADO aprovava estado falso. Comparar mtime não funciona em git
 * (checkout normaliza timestamps), então o regenerador embute um hash do
 * conteúdo da fonte (src/ + scripts/ + package.json) em cada artefato, e quem
 * lê o artefato valida o hash contra a fonte ATUAL.
 *
 * Uso:
 *   import { embedFreshness, checkArtifactFreshness } from "./freshness";
 *   writeJson("artifacts/ufla-audit/gates.json", embedFreshness(gates));
 *   const failures = checkArtifactFreshness(json, "gates.json");
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");

export interface ArtifactFreshness {
  sourceFingerprint: string;
  generatedAt: string;
  tool: string;
}

/** Fontes que determinam o DOCX/preview gerado — fora: testes, snapshots, binários. */
const SOURCE_BASES = ["src", "scripts/ufla-compliance"];
const SOURCE_FILES = ["package.json", "vite.config.ts"];
const SKIP_PATTERNS = [/snapshots[\\/]/, /tmp-/, /\.(docx|pdf|png|jpg|jpeg|html)$/];

function collectFiles(dir: string, out: string[]): void {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(abs, out);
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      const rel = abs.slice(ROOT.length + 1).replace(/\\/g, "/");
      if (SKIP_PATTERNS.some((p) => p.test(rel))) continue;
      out.push(rel);
    }
  }
}

/** sha256 sobre (caminho + conteúdo) ordenados — estável entre plataformas. */
export function sourceFingerprint(): string {
  const files: string[] = [];
  for (const base of SOURCE_BASES) collectFiles(join(ROOT, base), files);
  for (const f of SOURCE_FILES) if (existsSync(join(ROOT, f))) files.push(f);
  files.sort();
  const hash = createHash("sha256");
  for (const rel of files) {
    hash.update(rel);
    hash.update("\0");
    hash.update(readFileSync(join(ROOT, rel)));
    hash.update("\0");
  }
  return hash.digest("hex").slice(0, 16);
}

export function embedFreshness<T extends object>(data: T): T & { freshness: ArtifactFreshness } {
  return {
    ...data,
    freshness: {
      sourceFingerprint: sourceFingerprint(),
      generatedAt: new Date().toISOString(),
      tool: "ufla-regenerate (anti-WORKSLOP-003)",
    },
  };
}

/**
 * Falhas de frescor de um artefato JSON lido do disco. Artefato sem
 * impressão digital (pré-guarda) ou com impressão divergente da fonte atual
 * é considerado DESATUALIZADO — nunca aprova estado falso.
 */
export function checkArtifactFreshness(artifact: unknown, label: string): string[] {
  if (!artifact || typeof artifact !== "object") {
    return [`${label}: artefato ilegível — rode npm run ufla:audit nesta máquina para regenerar a evidência.`];
  }
  const obj = artifact as { freshness?: ArtifactFreshness; meta?: { sourceFingerprint?: string } };
  // Impressão pode estar em freshness (embedFreshness) ou em meta.sourceFingerprint
  // (writeJson do regenerate, que embute o META em todos os artefatos).
  const fingerprint = obj.freshness?.sourceFingerprint ?? obj.meta?.sourceFingerprint;
  if (!fingerprint) {
    return [
      `${label}: artefato SEM impressão digital de frescor (gerado antes da guarda WORKSLOP-003) — rode npm run ufla:audit nesta máquina para regenerar a evidência.`,
    ];
  }
  const current = sourceFingerprint();
  if (fingerprint !== current) {
    return [
      `${label}: ARTEFATO DESATUALIZADO (fonte mudou desde a regeneração: impressão ${fingerprint} ≠ fonte atual ${current}) — rode npm run ufla:audit nesta máquina.`,
    ];
  }
  return [];
}

/** Extrai a impressão digital do rodapé do report.md (canônico, regenerado). */
export function reportFreshnessFromMarkdown(markdown: string): string | undefined {
  return markdown.match(/Impressão digital da fonte:\s*`([a-f0-9]{16})`/)?.[1];
}
