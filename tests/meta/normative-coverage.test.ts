import { describe, expect, it } from "vitest";
import {
  NORMATIVE_COVERAGE_MATRIX,
  coverageByStatus,
  highPriorityPendingCoverage,
} from "../../src/normative-coverage";

describe("matriz de cobertura normativa", () => {
  it("cobre as categorias estratégicas do checklist", () => {
    const categories = NORMATIVE_COVERAGE_MATRIX.map((item) => item.category);

    expect(categories).toContain("Posicionamento");
    expect(categories).toContain("Cobertura normativa");
    expect(categories).toContain("Ficha catalográfica");
    expect(categories).toContain("Resumo/Abstract");
    expect(categories).toContain("Indicadores de impacto");
    expect(categories).toContain("Importação DOCX");
    expect(categories).toContain("Exportação DOCX");
    expect(categories).toContain("UX de revisão");
    expect(categories).toContain("Transparência");
    expect(categories).toContain("Testes");
    expect(categories).toContain("Acessibilidade");
    expect(categories).toContain("Performance");
    expect(categories).toContain("Governança");
  });

  it("mantém evidência e próximo passo para todo item", () => {
    for (const item of NORMATIVE_COVERAGE_MATRIX) {
      expect(item.id).toBeTruthy();
      expect(item.problem).toBeTruthy();
      expect(item.evidence.length).toBeGreaterThan(0);
      expect(item.nextStep).toBeTruthy();
      expect(item.estimatedEffort).toBeTruthy();
    }
  });

  it("identifica pendências de alta prioridade", () => {
    const pending = highPriorityPendingCoverage();

    expect(pending.length).toBeGreaterThan(0);
    expect(pending.every((item) => item.priority === "alta")).toBe(true);
    expect(pending.every((item) => item.currentStatus !== "implemented")).toBe(true);
  });

  it("filtra itens por status", () => {
    expect(coverageByStatus("implemented").some((item) => item.id === "positioning-no-ai")).toBe(true);
    expect(coverageByStatus("pending").some((item) => item.id === "catalog-card")).toBe(true);
  });
});
