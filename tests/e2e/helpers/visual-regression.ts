import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Locator } from "@playwright/test";

export interface CapturedRegion {
  name: string;
  path: string;
  byteLength: number;
  hash: string;
}

function sha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export async function captureRegion(
  locator: Locator,
  outputPath: string
): Promise<CapturedRegion> {
  const buffer = await locator.screenshot({ path: outputPath, animations: "disabled" });
  return {
    name: locator.toString(),
    path: outputPath,
    byteLength: buffer.length,
    hash: sha256(buffer),
  };
}

export async function readBaselineHash(baselinePath: string): Promise<string | null> {
  try {
    await access(baselinePath);
    const raw = await readFile(baselinePath, "utf8");
    return raw.trim();
  } catch {
    return null;
  }
}

export async function writeBaselineHash(baselinePath: string, hash: string): Promise<void> {
  await mkdir(dirname(baselinePath), { recursive: true });
  await writeFile(baselinePath, `${hash}\n`, "utf8");
}

export function baselineFileName(name: string): string {
  return `${sanitize(name)}.sha256`;
}

export interface RegionExpectation {
  minBytes: number;
}

export interface RegionCheck {
  name: string;
  captured: CapturedRegion;
  baselineHash: string | null;
  matchesBaseline: boolean | null;
  withinMinSize: boolean;
}

export async function checkRegion(
  captured: CapturedRegion,
  baselineDirectory: string,
  expectation: RegionExpectation
): Promise<RegionCheck> {
  const baselinePath = join(baselineDirectory, `${sanitize(captured.name)}.sha256`);
  const baselineHash = await readBaselineHash(baselinePath);
  return {
    name: captured.name,
    captured,
    baselineHash,
    matchesBaseline: baselineHash === null ? null : baselineHash === captured.hash,
    withinMinSize: captured.byteLength >= expectation.minBytes,
  };
}

function sanitize(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(-80);
}

export function summarizeChecks(checks: RegionCheck[]): string {
  const lines = checks.map((c) => {
    const size = c.withinMinSize ? "ok" : `PEQUENO(${c.captured.byteLength})`;
    const base =
      c.baselineHash === null
        ? "sem baseline"
        : c.matchesBaseline
          ? "baseline ok"
          : "BASELINE DIVERGENTE";
    return `- ${c.name}: ${size}; ${base} [${c.captured.hash.slice(0, 12)}]`;
  });
  return lines.join("\n");
}

export function assertChecks(checks: RegionCheck[], updateBaseline: boolean): void {
  for (const check of checks) {
    if (!check.withinMinSize) {
      throw new Error(`Regiao visual '${check.name}' vazia ou muito pequena (${check.captured.byteLength} bytes).`);
    }
    if (check.baselineHash !== null && check.matchesBaseline === false && !updateBaseline) {
      throw new Error(
        `Regressao visual em '${check.name}': hash atual ${check.captured.hash.slice(0, 12)} difere do baseline ${check.baselineHash.slice(0, 12)}.`
      );
    }
  }
}
