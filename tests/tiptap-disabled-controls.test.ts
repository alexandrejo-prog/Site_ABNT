import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Tiptap disabled controls", () => {
  const source = readFileSync(join(process.cwd(), "src", "App.tsx"), "utf8");

  it("condiciona EditorRuler ao modo legacy", () => {
    expect(source).toContain("{!isTiptapEditorEnabled && <EditorRuler");
  });

  it("esconde controles de tabulacao e recuo no Tiptap", () => {
    expect(source).toContain("{!isTiptapEditorEnabled && <ToolButton title=\"Inserir tabulação\"");
    expect(source).toContain("{!isTiptapEditorEnabled && <ToolButton title=\"Diminuir recuo\"");
    expect(source).toContain("{!isTiptapEditorEnabled && <ToolButton title=\"Aumentar recuo\"");
  });

  it("esconde controles de espacamento no Tiptap", () => {
    expect(source).toContain("{!isTiptapEditorEnabled && <ToolButton title=\"Espaçamento simples\"");
    expect(source).toContain("{!isTiptapEditorEnabled && <ToolButton title=\"Espaçamento 1,5\"");
    expect(source).toContain("{!isTiptapEditorEnabled && <ToolButton title=\"Espaçamento duplo\"");
  });

  it("mantem botoes funcionais do Tiptap visiveis", () => {
    expect(source).toContain("runEditorAction(\"bold\"");
    expect(source).toContain("runEditorAction(\"italic\"");
    expect(source).toContain("runEditorAction(\"underline\"");
    expect(source).toContain("runEditorAction(\"heading1\"");
    expect(source).toContain("runEditorAction(\"heading2\"");
    expect(source).toContain("runEditorAction(\"blockquote\"");
    expect(source).toContain("runEditorAction(\"reference\"");
    expect(source).toContain("runEditorAction(\"bulletList\"");
    expect(source).toContain("runEditorAction(\"orderedList\"");
    expect(source).toContain("runEditorAction(\"alignLeft\"");
    expect(source).toContain("runEditorAction(\"alignCenter\"");
    expect(source).toContain("runEditorAction(\"alignJustify\"");
    expect(source).toContain("runEditorAction(\"clearFormatting\"");
    expect(source).toContain("runEditorAction(\"undo\"");
    expect(source).toContain("runEditorAction(\"redo\"");
  });
});
