import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Tiptap clean toolbar", () => {
  const source = readFileSync(join(process.cwd(), "src", "App.tsx"), "utf8");

  it("renderiza toolbar compacta do Tiptap", () => {
    expect(source).toContain("tiptap-toolbar");
  });

  it("contem botao Normal", () => {
    expect(source).toContain("runEditorAction(\"paragraph\"");
    expect(source).toContain("Normal");
  });

  it("contem botoes de texto", () => {
    expect(source).toContain("runEditorAction(\"bold\"");
    expect(source).toContain("runEditorAction(\"italic\"");
    expect(source).toContain("runEditorAction(\"underline\"");
  });

  it("contem botoes de estrutura", () => {
    expect(source).toContain("runEditorAction(\"heading1\"");
    expect(source).toContain("runEditorAction(\"heading2\"");
    expect(source).toContain("runEditorAction(\"blockquote\"");
    expect(source).toContain("runEditorAction(\"reference\"");
  });

  it("contem botoes de listas", () => {
    expect(source).toContain("runEditorAction(\"bulletList\"");
    expect(source).toContain("runEditorAction(\"orderedList\"");
  });

  it("contem botoes de alinhamento", () => {
    expect(source).toContain("runEditorAction(\"alignLeft\"");
    expect(source).toContain("runEditorAction(\"alignCenter\"");
    expect(source).toContain("runEditorAction(\"alignJustify\"");
  });

  it("contem botoes de historico", () => {
    expect(source).toContain("runEditorAction(\"undo\"");
    expect(source).toContain("runEditorAction(\"redo\"");
  });

  it("nao renderiza EditorRuler no modo Tiptap", () => {
    expect(source).toContain("{!isTiptapEditorEnabled && <EditorRuler");
  });

  it("nao renderiza botoes de espacamento no modo Tiptap", () => {
    expect(source).toContain("{!isTiptapEditorEnabled && <ToolButton title=\"Espaçamento simples\"");
    expect(source).toContain("{!isTiptapEditorEnabled && <ToolButton title=\"Espaçamento 1,5\"");
    expect(source).toContain("{!isTiptapEditorEnabled && <ToolButton title=\"Espaçamento duplo\"");
  });
});
