/**
 * A5 (checklist-15): números do SUMÁRIO coerentes com as páginas reais.
 *
 * O gate completo roda contra o PDF renderizado pelo Word (ufla:audit); aqui
 * cobrimos a lógica pura (casamento por palavras inteiras, normalização,
 * skipped-no-word) e a integração no regenerate via teste do runner direto.
 */
import { describe, it, expect } from "vitest";
import { lineContainsWords, normalizeTocText, checkTocPageConsistency } from "../../scripts/ufla-compliance/toc-page-consistency";

describe("A5 — sumário × páginas reais (lógica pura)", () => {
  it("casa título como palavras inteiras (não substring)", () => {
    expect(lineContainsWords("INTRODUÇÃO", "INTRODUCAO")).toBe(true);
    expect(lineContainsWords("permaneçam válidas ... resolver este problema", "RESOLVE")).toBe(false);
    expect(lineContainsWords("5 DISPONÍVEL EM:", "17 DISPONÍVEL EM")).toBe(false);
    expect(lineContainsWords("5 DISPONÍVEL EM:", "DISPONÍVEL")).toBe(true);
    expect(lineContainsWords("REFERENCIAL TEÓRICO", "REFERENCIAL TEORICO")).toBe(true);
    expect(lineContainsWords("16 CRONOGRAMA", "16 CRONOGRAMA")).toBe(true);
  });

  it("normaliza acentos/maiúsculas/espaços para comparação", () => {
    expect(normalizeTocText("Política Pública de Acesso Aberto")).toBe("POLITICA PUBLICA DE ACESSO ABERTO");
    expect(normalizeTocText("Coração  ão  ção")).toBe("CORACAO AO CAO");
  });

  it("sem PDF/DOCX do Word → skipped-no-word (gate passed, sem o que analisar)", async () => {
    const result = await checkTocPageConsistency();
    // O teste roda em ambiente sem os artefatos Word garantidos; o contrato do
    // gate é: ou wordAvailable com verificação real, ou passed (skipped).
    expect(result.passed).toBe(true);
    expect(result.wordAvailable).toBe(result.checked > 0);
    if (!result.wordAvailable) {
      expect(result.failures).toContainEqual(expect.stringContaining("indisponível"));
    }
  });
});
