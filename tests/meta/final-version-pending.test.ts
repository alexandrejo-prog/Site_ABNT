import { describe, expect, it } from "vitest";
import { finalVersionPendingReport } from "../../src/final-version-pending";
import { emptyAcademicFields } from "../../src/ufla-rules";

describe("final version pending", () => {
  function fields(overrides: Record<string, unknown> = {}) {
    return { ...emptyAcademicFields(), ...overrides };
  }

  it("retorna vazio para artigo simples preenchido", () => {
    const report = finalVersionPendingReport(
      fields({ workType: "artigo", author: "Maria", title: "Artigo", resumo: "Resumo." }),
      "Texto do artigo.",
    );
    expect(report.hasPendingItems).toBe(false);
    expect(report.blocksFinalVersion).toBe(false);
  });

  it("lista orientador provisorio, ficha provisoria e folha de aprovacao provisoria para dissertacao", () => {
    const report = finalVersionPendingReport(
      fields({ workType: "dissertacao", advisor: "[nome do orientador]", program: "ECA", resumo: "Resumo." }),
      "# 1 Introducao\nTexto.",
    );
    expect(report.hasPendingItems).toBe(true);
    const labels = report.items.map((item) => item.label);
    expect(labels).toContain("Orientador(a) provisorio");
    expect(labels).toContain("Ficha catalografica provisoria");
    expect(labels).toContain("Folha de aprovacao provisoria");
    expect(labels).toContain("Sumario a atualizar");
    expect(report.blocksFinalVersion).toBe(true);
    expect(report.allowsDraftGeneration).toBe(true);
  });

  it("lista ficha provisoria para tese", () => {
    const report = finalVersionPendingReport(
      fields({ workType: "tese", advisor: "Prof. Dr. Joao", program: "ECA", resumo: "Resumo." }),
      "# 1 Introducao\nTexto.",
    );
    const labels = report.items.map((item) => item.label);
    expect(labels).toContain("Ficha catalografica provisoria");
    expect(labels).toContain("Folha de aprovacao provisoria");
  });

  it("nao lista ficha para projeto de pesquisa", () => {
    const report = finalVersionPendingReport(
      fields({ workType: "projeto_pesquisa", program: "ECA", resumo: "Resumo." }),
      "# 1 Introducao\nTexto.",
    );
    expect(report.items.some((item) => item.label.includes("Ficha catalografica"))).toBe(false);
    expect(report.items.some((item) => item.label.includes("Folha de aprovação"))).toBe(false);
  });

  it("lista ficha e folha de aprovacao para monografia", () => {
    const report = finalVersionPendingReport(
      fields({ workType: "monografia", advisor: "Prof. Dr. Joao", course: "Licenciatura em Física", resumo: "Resumo." }),
      "# 1 Introducao\nTexto.",
    );
    const labels = report.items.map((item) => item.label);
    expect(labels).toContain("Ficha catalografica provisoria");
    expect(labels).toContain("Folha de aprovacao provisoria");
    expect(labels).toContain("Sumario a atualizar");
  });

  it("nao lista ficha para colecao ufla", () => {
    const report = finalVersionPendingReport(
      fields({ workType: "artigo_cientifico_ufla", title: "Artigo", author: "Maria" }),
      "Texto.",
    );
    expect(report.items.some((item) => item.label.includes("Ficha catalografica"))).toBe(false);
    expect(report.items.some((item) => item.label.includes("Folha de aprovação"))).toBe(false);
  });

  it("permite rascunho mesmo com pendencias", () => {
    const report = finalVersionPendingReport(
      fields({ workType: "dissertacao", advisor: "Prof. Dr. Joao", program: "ECA", resumo: "Resumo." }),
      "# 1 Introducao\nTexto.",
    );
    expect(report.allowsDraftGeneration).toBe(true);
  });
});
