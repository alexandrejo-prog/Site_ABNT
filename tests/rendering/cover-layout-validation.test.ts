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

  it("precisão física da capa: blocos em ordem vertical, com folga e dentro da área útil", async () => {
    const result = await validateCoverLayout(pdfPath);
    expect(result.passed).toBe(true);
    const joined = [...result.errors, ...result.warnings].join(" ");
    expect(joined).not.toMatch(/fora de ordem vertical/);
    expect(joined).not.toMatch(/sobrepostos\/colados/);
    expect(joined).not.toMatch(/fora da área útil/);
    expect(joined).not.toMatch(/ordem invertida entre título e local\/ano/);
  });

  it("precisão da banca: linhas distintas sem sobreposição e dentro da área útil", async () => {
    const result = await validateCoverLayout(pdfPath);
    expect(result.passed).toBe(true);
    const joined = [...result.errors, ...result.warnings].join(" ");
    expect(joined).not.toMatch(/Linhas da banca sobrepostas/);
    expect(joined).not.toMatch(/Linha final da banca invadiu a margem inferior/);
  });

  it("ficha com Cutter real seria validada na posição (verso) — placeholder do reference não dispara", async () => {
    const result = await validateCoverLayout(pdfPath);
    expect(result.passed).toBe(true);
    // o documento de referência tem ficha placeholder (sem Cutter): a checagem
    // de posição do cartão só atua quando há Cutter real — sem falso positivo
    const joined = [...result.errors, ...result.warnings].join(" ");
    expect(joined).not.toMatch(/Cartão da ficha catalográfica/);
  });

  it("reporta erro quando o PDF não existe (contrato do validador)", async () => {
    const result = await validateCoverLayout(join(root, "artifacts", "ufla-compliance", "rendered", "nao-existe.pdf"));
    expect(result.passed).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
