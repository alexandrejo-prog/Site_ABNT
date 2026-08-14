import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Tiptap UX cleanliness", () => {
  const appSource = readFileSync(join(process.cwd(), "src", "App.tsx"), "utf8");
  const toolbarSource = readFileSync(join(process.cwd(), "src", "components", "EditorToolbar.tsx"), "utf8");
  const cssSource = readFileSync(join(process.cwd(), "src", "styles.css"), "utf8");
  const tiptapCssSource = readFileSync(join(process.cwd(), "src", "components", "AcademicTiptapEditor.css"), "utf8");

  it("contem aviso resumido do Tiptap", () => {
    expect(toolbarSource).toContain("Modo Tiptap experimental. Use para testar a nova edição.");
  });

  it("nao contem multiplos banners redundantes no fluxo Tiptap", () => {
    expect(appSource).not.toContain("Régua ainda em adaptação");
    expect(appSource).not.toContain("Editor Tiptap experimental ativo");
  });

  it("CSS contem classe da toolbar Tiptap", () => {
    expect(cssSource).toContain(".tiptap-toolbar");
  });

  it("CSS contem classe do banner Tiptap", () => {
    expect(cssSource).toContain(".tiptap-mode-banner");
  });

  it("CSS do Tiptap define fonte e tamanho academicos", () => {
    expect(tiptapCssSource).toContain("Times New Roman");
    expect(tiptapCssSource).toContain("12pt");
    expect(tiptapCssSource).toContain("line-height: 1.5");
  });
});
