import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ADHERENCE_CATEGORIES } from "../src/validators";

describe("painel de aderência normativa", () => {
  it("ADHERENCE_CATEGORIES possui pelo menos 8 categorias", () => {
    expect(ADHERENCE_CATEGORIES.length).toBeGreaterThanOrEqual(8);
  });

  it("cada categoria possui key, label, status e statusLabel válidos", () => {
    const validStatuses = ["implemented", "partial", "pending", "manual"] as const;

    for (const category of ADHERENCE_CATEGORIES) {
      expect(category.key).toBeTruthy();
      expect(category.label).toBeTruthy();
      expect(category.status).toBeTruthy();
      expect(category.statusLabel).toBeTruthy();
      expect(validStatuses).toContain(category.status);
    }
  });

  it("categorias incluem elementos esperados do fluxo de trabalho", () => {
    const expectedKeys = [
      "metadata",
      "pretextual",
      "resumo",
      "abstract",
      "keywords",
      "body",
      "illustrations",
      "references",
      "posttextual",
      "export",
    ];

    const foundKeys = ADHERENCE_CATEGORIES.map((category) => category.key);
    for (const key of expectedKeys) {
      expect(foundKeys).toContain(key);
    }
  });

  it("nenhuma categoria finge conformidade completa indevidamente", () => {
    const fakeFullCompliance = ADHERENCE_CATEGORIES.filter(
      (category) => category.status === "implemented" && category.key !== "metadata" && category.key !== "keywords" && category.key !== "body" && category.key !== "export",
    );

    expect(fakeFullCompliance.length).toBeLessThan(ADHERENCE_CATEGORIES.length);
  });

  it("App.tsx integra o componente AdherencePanel e mantém fluxo pós-geração", () => {
    const appSource = readFileSync(join(process.cwd(), "src", "App.tsx"), "utf8");
    const panelSource = readFileSync(join(process.cwd(), "src", "components", "AdherencePanel.tsx"), "utf8");
    const sidebarSource = readFileSync(join(process.cwd(), "src", "components", "ValidationSidebar.tsx"), "utf8");

    expect(appSource).toContain("AdherencePanel");
    expect(sidebarSource).toContain("Após gerar o DOCX:");
    expect(sidebarSource).toContain("Abra no Word ou LibreOffice");
    expect(sidebarSource).toContain("atualize campos dinâmicos e o sumário");
    expect(sidebarSource).toContain("exporte para PDF para submissão");

    expect(panelSource).toContain("Painel de aderência normativa");
    expect(panelSource).toContain("ADHERENCE_CATEGORIES");
    expect(panelSource).toContain("adherence-panel");
    expect(panelSource).toContain("Este painel reflete o que o sistema implementa atualmente");
  });
});