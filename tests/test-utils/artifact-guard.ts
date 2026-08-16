import { existsSync } from "node:fs";
import { describe } from "vitest";

/**
 * Describe que PULA a suíte quando algum artefato obrigatório de artifacts/
 * não existe (ex.: CI do GitHub Actions, que não roda o pipeline Word/PDF
 * que regenera artifacts/).
 *
 * WORKSLOP-003: testes que leem artefatos devem falhar OU pular até a
 * regeneração — nunca aprovar estado falso por artefato desatualizado.
 *
 * @param name nome do describe (mesmo contrato do vitest)
 * @param requiredArtifacts caminhos relativos a artifacts/
 *   (ex.: "ufla-compliance/rendered-analysis.json")
 * @param fn callback do describe
 */
export function describeWithArtifacts(
  name: string,
  requiredArtifacts: string[],
  fn: () => void,
): void {
  const missing = requiredArtifacts.filter(
    (rel) => !existsSync(new URL(`../../artifacts/${rel}`, import.meta.url)),
  );
  describe.skipIf(missing.length > 0)(name, fn);
}
