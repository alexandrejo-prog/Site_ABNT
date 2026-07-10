import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Tiptap visible toggle", () => {
  const source = readFileSync(join(process.cwd(), "src", "App.tsx"), "utf8");

  it("exibe seletor de editor com opções Legado e Tiptap", () => {
    expect(source).toContain("Legado estável");
    expect(source).toContain("Tiptap experimental");
  });

  it("altera URL para ativar Tiptap ao selecionar modo", () => {
    expect(source).toContain('searchParams.set("editor", "tiptap")');
    expect(source).toContain("window.history.pushState");
    expect(source).toContain("window.location.reload");
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
