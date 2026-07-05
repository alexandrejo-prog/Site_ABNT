import { describe, expect, it } from "vitest";
import { WORK_TYPES } from "../src/ufla-rules";
import {
  outputPolicyFor,
  shouldShowApprovalPage,
  shouldShowCatalogCard,
  shouldShowImpactIndicators,
} from "../src/work-type-output-policy";

describe("politica de saida por tipo de trabalho", () => {
  it("possui politica para todos os tipos cadastrados", () => {
    for (const workType of WORK_TYPES) {
      expect(outputPolicyFor(workType).workType).toBe(workType);
    }
  });

  it("separa artigos e modelos CPG da estrutura completa UFLA", () => {
    for (const workType of ["artigo", "resumo_cpg", "resumo_expandido_cpg", "artigo_completo_cpg"] as const) {
      const policy = outputPolicyFor(workType);
      expect(policy.hasCover).toBe(false);
      expect(policy.hasTitlePage).toBe(false);
      expect(policy.hasCatalogCard).toBe(false);
      expect(policy.hasApprovalPage).toBe(false);
      expect(policy.hasSummary).toBe(false);
      expect(policy.hasImpactIndicators).toBe(false);
    }
  });

  it("mantem ficha e aprovacao apenas para monografia dissertacao e tese", () => {
    expect(shouldShowCatalogCard("monografia")).toBe(true);
    expect(shouldShowCatalogCard("dissertacao")).toBe(true);
    expect(shouldShowCatalogCard("tese")).toBe(true);
    expect(shouldShowCatalogCard("projeto_pesquisa")).toBe(false);

    expect(shouldShowApprovalPage("monografia")).toBe(true);
    expect(shouldShowApprovalPage("dissertacao")).toBe(true);
    expect(shouldShowApprovalPage("tese")).toBe(true);
    expect(shouldShowApprovalPage("projeto_pesquisa")).toBe(false);
  });

  it("mantem indicadores de impacto apenas para dissertacao e tese", () => {
    expect(shouldShowImpactIndicators("dissertacao")).toBe(true);
    expect(shouldShowImpactIndicators("tese")).toBe(true);
    expect(shouldShowImpactIndicators("monografia")).toBe(false);
    expect(shouldShowImpactIndicators("projeto_pesquisa")).toBe(false);
  });

  it("define natureza esperada para modelos com folha de rosto", () => {
    expect(outputPolicyFor("projeto_pesquisa").expectedNatureStart).toContain("Projeto de pesquisa apresentada");
    expect(outputPolicyFor("monografia").expectedNatureStart).toContain("Monografia apresentada");
    expect(outputPolicyFor("dissertacao").expectedNatureStart).toContain("Dissertação apresentada");
    expect(outputPolicyFor("tese").expectedNatureStart).toContain("Tese apresentada");
  });
});
