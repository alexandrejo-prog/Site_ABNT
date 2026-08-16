import { expect, it } from "vitest";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describeWithArtifacts } from "../test-utils/artifact-guard";
import { validateCoverLayout } from "../../scripts/ufla-compliance/validate-cover-layout";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const root = join(__dirname, "..", "..");
const pdfPath = join(root, "artifacts", "ufla-compliance", "rendered", "normalized-dissertacao.pdf");

describeWithArtifacts("rendering: validação física de capa e folha de rosto", ["ufla-compliance/rendered/normalized-dissertacao.pdf"], () => {
  it("capa e folha de rosto do DOCX renderizado passam no layout físico UFLA", async () => {
    const result = await validateCoverLayout(pdfPath);
    expect(result.passed).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("ficha catalográfica está no verso da folha de rosto e a banca forma grade física", async () => {
    const result = await validateCoverLayout(pdfPath);
    expect(result.passed).toBe(true);
    const joined = [...result.errors, ...result.warnings].join(" ");
    expect(joined).not.toMatch(/Ficha catalográfica fora do verso/);
    expect(joined).not.toMatch(/grade física da banca/);
    expect(joined).not.toMatch(/Folha de aprovação .* não detectada/);
  });

  it("reporta erro quando o PDF não existe (contrato do validador)", async () => {
    const result = await validateCoverLayout(join(root, "artifacts", "ufla-compliance", "rendered", "nao-existe.pdf"));
    expect(result.passed).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
