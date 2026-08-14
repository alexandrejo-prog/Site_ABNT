import { describe, expect, it } from "vitest";
import { describeOutputType } from "../../src/output-type";

describe("describeOutputType (UX-04)", () => {
  it("com erros essenciais marca como bloqueado", () => {
    const r = describeOutputType({ hasBlockingErrors: true, hasFinalPending: true, generateAnyway: false });
    expect(r.badge).toBe("blocked");
    expect(r.label).toBe("Exportação bloqueada");
  });

  it("com pendências de versão final gera rascunho editável", () => {
    const r = describeOutputType({ hasBlockingErrors: false, hasFinalPending: true, generateAnyway: false });
    expect(r.badge).toBe("draft");
    expect(r.label).toBe("Rascunho editável");
  });

  it("com generateAnyway forçado classifica como rascunho", () => {
    const r = describeOutputType({ hasBlockingErrors: false, hasFinalPending: false, generateAnyway: true });
    expect(r.badge).toBe("draft");
  });

  it("sem bloqueio e sem pendências classifica como versão para revisão", () => {
    const r = describeOutputType({ hasBlockingErrors: false, hasFinalPending: false, generateAnyway: false });
    expect(r.badge).toBe("review");
    expect(r.label).toBe("Versão para revisão");
  });

  it("sempre expõe detalhe orientador", () => {
    for (const badge of ["blocked", "draft", "review"] as const) {
      const r = describeOutputType({
        hasBlockingErrors: badge === "blocked",
        hasFinalPending: badge === "draft",
        generateAnyway: false,
      });
      expect(r.badge).toBe(badge);
      expect(r.detail.length).toBeGreaterThan(0);
    }
  });
});