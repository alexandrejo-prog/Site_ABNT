// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import App from "../src/App";

const appSource = readFileSync(resolve(process.cwd(), "src/App.tsx"), "utf8");
const sidebarSource = readFileSync(resolve(process.cwd(), "src/components/ValidationSidebar.tsx"), "utf8");
const importBlockSource = readFileSync(resolve(process.cwd(), "src/components/ImportBlock.tsx"), "utf8");
const toolbarSource = readFileSync(resolve(process.cwd(), "src/components/EditorToolbar.tsx"), "utf8");
const editorSectionSource = readFileSync(resolve(process.cwd(), "src/components/EditorSection.tsx"), "utf8");
const metadataSource = readFileSync(resolve(process.cwd(), "src/components/MetadataFields.tsx"), "utf8");
const appConstantsSource = readFileSync(resolve(process.cwd(), "src/app-constants.ts"), "utf8");
const stylesSource = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");
const combined = `${appSource}\n${sidebarSource}\n${importBlockSource}\n${toolbarSource}\n${editorSectionSource}\n${metadataSource}\n${appConstantsSource}`;

describe("Acessibilidade básica da interface", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it("possui exatamente um skip-link apontando para o conteudo principal", () => {
    const { container } = render(createElement(App));
    const skipLinks = container.querySelectorAll(".skip-link");
    const workspace = container.querySelector("main#main-content");

    expect(skipLinks).toHaveLength(1);
    expect(skipLinks[0]).toHaveAttribute("href", "#main-content");
    expect(skipLinks[0]).toHaveTextContent("Pular para o conte\u00fado principal");
    expect(workspace).toBeInTheDocument();
  });

  it("rotula o campo de e-mail do CPG como 'E-mail dos autores'", () => {
    expect(combined).toContain('"E-mail dos autores"');
    expect(combined).toContain("courseFieldLabel");
  });

  it("possui rótulo acessível no botão de importação", () => {
    expect(combined).toContain('type="file"');
    expect(combined).toContain('accept=".docx,.txt,.md"');
    expect(combined).toContain("Importar");
  });

  it("painel de aderência possui atributos ARIA de expansão", () => {
    const panelSource = readFileSync(resolve(process.cwd(), "src/components/AdherencePanel.tsx"), "utf8");
    expect(panelSource).toContain('aria-expanded={expanded}');
    expect(panelSource).toContain('aria-controls');
    expect(panelSource).toContain('id="');
  });

  it("botões da toolbar possuem type e title", () => {
    const toolButtonMatches = toolbarSource.match(/<ToolButton[^>]*>/g) ?? [];
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
    expect(editorSectionSource).toContain('aria-label=');
    expect(editorSectionSource).toContain('role="textbox"');
    expect(editorSectionSource).toContain('aria-multiline="true"');
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
