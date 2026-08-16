import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

/**
 * Diretório de evidências dos testes (fora do repositório).
 *
 * Testes NÃO devem sobrescrever artefatos oficiais em artifacts/ ou coverage/:
 * eles produzem evidências no tmpdir do SO. Artefatos oficiais são gerados
 * explicitamente por scripts de auditoria e carregam metadados
 * (generatedAt/commit/branch/manualEdition/status).
 */
export function testEvidenceDir(): string {
  return join(tmpdir(), "site-abnt-test-evidence");
}

export function writeTestEvidence(relativePath: string, content: string): string {
  const target = join(testEvidenceDir(), relativePath);
  mkdirSync(join(target, ".."), { recursive: true });
  writeFileSync(target, content, "utf8");
  return target;
}
