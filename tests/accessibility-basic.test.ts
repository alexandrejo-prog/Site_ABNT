import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const sidebarSource = readFileSync(new URL("../src/components/ValidationSidebar.tsx", import.meta.url), "utf8");
const stylesSource = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
const combined = `${appSource}\n${sidebarSource}`;

describe("Acessibilidade básica da interface", () => {
  it("possui exatamente um skip-link na interface", () => {
    const matches = appSource.match(/className="skip-link"/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBe(1);
  });

  it("possui rótulo acessível no botão de importação", () => {
    expect(appSource).toContain('type="file"');
    expect(appSource).toContain('accept=".docx,.txt,.md"');
    expect(appSource).toContain("Importar");
  });

  it("painel de aderência possui atributos ARIA de expansão", () => {
    const panelSource = readFileSync(new URL("../src/components/AdherencePanel.tsx", import.meta.url), "utf8");
    expect(panelSource).toContain('aria-expanded={expanded}');
    expect(panelSource).toContain('aria-controls');
    expect(panelSource).toContain('id="');
  });

  it("botões da toolbar possuem type e title", () => {
    const toolButtonMatches = appSource.match(/<ToolButton[^>]*>/g) ?? [];
    expect(toolButtonMatches.length).toBeGreaterThanOrEqual(6);

    const hasTitleAttr = toolButtonMatches.every((button) =>
      button.includes('title='),
    );
    expect(hasTitleAttr).toBe(true);
  });

  it("área de status possui aria-live", () => {
    expect(combined).toContain('aria-live="polite"');
  });

  it("editor rich-text possui aria-label", () => {
    expect(appSource).toContain('aria-label=');
    expect(appSource).toContain('role="textbox"');
    expect(appSource).toContain('aria-multiline="true"');
  });

  it("botão de geração DOCX possui estado disabled acessível", () => {
    expect(appSource).toContain('disabled={isGenerating}');
    expect(appSource).toContain("Gerando...");
  });

  it("estilos possuem foco visível para elementos interativos", () => {
    expect(stylesSource).toContain(":focus");
    expect(stylesSource).toContain(":focus-visible");
    expect(stylesSource).toContain("outline");
  });

  it("erros bloqueantes possuem role=\"alert\"", () => {
    const count = (combined.match(/role="alert"/g) || []).length;
    expect(count).toBeGreaterThanOrEqual(1);
  });

  it("alertas não bloqueantes possuem role=\"status\"", () => {
    const count = (combined.match(/role="status"/g) || []).length;
    expect(count).toBeGreaterThanOrEqual(3);
  });

  it("estados vazios de validação possuem role=\"status\"", () => {
    const emptyStatus = combined.match(/className="empty-state"[^>]*role="status"/g);
    expect(emptyStatus).not.toBeNull();
    expect(emptyStatus!.length).toBeGreaterThanOrEqual(2);
  });

  it("listas de validação possuem aria-label", () => {
    expect(combined).toContain('aria-label="Erros de validação"');
    expect(combined).toContain('aria-label="Alertas de validação"');
  });

  it("não há referências funcionais a IA ou APIs externas", () => {
    const aiPatterns = [
      /\bAI\b/i,
      /\bGroq\b/i,
      /\bGemini\b/i,
      /\bDeepSeek\b/i,
      /\bOpenRouter\b/i,
      /\bapiKey\b/i,
      /\bapi\.openai\.com\b/i,
      /\bgeneratePdfBlob\b/i,
    ];

    for (const pattern of aiPatterns) {
      const matches = appSource.match(pattern);
      expect(matches).toBeNull();
    }
  });
});