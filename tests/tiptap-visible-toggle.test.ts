import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Tiptap visible toggle", () => {
  const source = readFileSync(join(process.cwd(), "src", "App.tsx"), "utf8");

  it("nao exibe seletor de editor na interface", () => {
    expect(source).not.toContain("Legado estável");
    expect(source).not.toContain("editor-mode-select");
  });

  it("mantem ativacao por URL como recurso tecnico", () => {
    expect(source).toContain("useTiptapExperimentalEditor");
  });

  it("mantem legacy como padrao quando Tiptap nao esta ativo", () => {
    expect(source).toContain("contentEditable");
    expect(source).toContain("isTiptapEditorEnabled ? (");
  });

  it("mantem aviso experimental apenas no modo Tiptap", () => {
    expect(source).toContain("Modo Tiptap experimental.");
    expect(source).toContain("isTiptapEditorEnabled &&");
  });
});
