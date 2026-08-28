/**
 * A7 (checklist-15): mojibake zero em TODOS os DOCX por tipo.
 *
 * O gate por tipo (runPerTypeGates) agora reimporta cada DOCX gerado e conta
 * linhas corrompidas com a MESMA definição do DOCX de referência (Ã+alto ou
 * U+FFFD). Este teste cobre a função pura e o wiring end-to-end nos 4 tipos
 * principais; a matriz completa 15/15 é validada pelo `ufla:audit`
 * (gates-per-type.json → mojibake.checked=true, mojibakeLines=0).
 */
import { describe, it, expect } from "vitest";
import { countMojibakeLines, MOJIBAKE_RE } from "../../scripts/ufla-compliance/mojibake-check";
import { runPerTypeGates } from "../../scripts/ufla-compliance/run-gate-per-type";

describe("A7 — mojibake zero por tipo", () => {
  it("detecta mojibake real (UTF-8 lido como latin1: Ã + acento alto) e U+FFFD", () => {
    expect(countMojibakeLines("SÃ£o Paulo, 2024")).toBe(1); // "ã" corrompido
    expect(countMojibakeLines("coraÃ§Ã£o partido")).toBe(1); // "çã" corrompido
    expect(countMojibakeLines("texto limpo com ção ã é ó ú")).toBe(0);
    expect(countMojibakeLines("linha ok\ncom \uFFFD aqui")).toBe(1);
    expect(countMojibakeLines("")).toBe(0);
  });

  it("a regex compartilhada pega a faixa C2–C3 codificada em CP1252", () => {
    // "Ã£" = mojibake de "ã"; "Ã©" = mojibake de "é"
    expect(MOJIBAKE_RE.test("coraÃ§Ã£o")).toBe(true);
    expect(MOJIBAKE_RE.test("SÃ£o")).toBe(true);
    expect(MOJIBAKE_RE.test("normalizado")).toBe(false);
  });

  it("wiring end-to-end: 4 tipos principais geram DOCX sem mojibake (gate.mojibake.checked)", async () => {
    const results = await runPerTypeGates({ only: ["artigo", "tcc", "resumo_expandido_cpg", "projeto_pesquisa"] });
    const ids = ["artigo", "tcc", "resumo_expandido_cpg", "projeto_pesquisa"];
    for (const id of ids) {
      const r = results[id] as { passed: boolean; mojibake: { checked: boolean; mojibakeLines: number }; gaps: string[] };
      expect(r, `gate ${id} deve existir`).toBeTruthy();
      expect(r.mojibake.checked, `gate ${id} deve ter checagem de mojibake`).toBe(true);
      expect(r.mojibake.mojibakeLines, `gate ${id} não pode ter linhas corrompidas`).toBe(0);
      expect(r.passed, `gate ${id} deve passar: ${r.gaps.join("; ")}`).toBe(true);
    }
  });
});
