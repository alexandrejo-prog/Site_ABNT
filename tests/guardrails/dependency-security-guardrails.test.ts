import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

interface PackageLock {
  packages?: Record<string, { version?: string }>;
}

function parseVersion(version: string): [number, number, number] {
  const [major = "0", minor = "0", patch = "0"] = version.split(".");
  return [Number(major), Number(minor), Number(patch.replace(/\D.*/, ""))];
}

function isAtLeast(version: string, minimum: string): boolean {
  const current = parseVersion(version);
  const required = parseVersion(minimum);

  for (let index = 0; index < required.length; index += 1) {
    if (current[index] > required[index]) return true;
    if (current[index] < required[index]) return false;
  }

  return true;
}

describe("guardrails de seguranca de dependencias", () => {
  const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8"));
  const packageLock = JSON.parse(readFileSync(join(process.cwd(), "package-lock.json"), "utf8")) as PackageLock;

  it("declara mammoth em faixa segura", () => {
    expect(packageJson.dependencies.mammoth).toBe("^1.12.0");
    expect(packageJson.dependencies.mammoth).not.toBe("^1.8.0");
  });

  it("mantem o lockfile resolvendo mammoth 1.12.0 ou superior", () => {
    const lockedVersion = packageLock.packages?.["node_modules/mammoth"]?.version;
    expect(lockedVersion).toBeDefined();
    expect(isAtLeast(lockedVersion!, "1.12.0")).toBe(true);
  });
});
