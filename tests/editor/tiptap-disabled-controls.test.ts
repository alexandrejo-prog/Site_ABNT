import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Tiptap disabled controls", () => {
  const source = readFileSync(join(process.cwd(), "src", "components", "EditorToolbar.tsx"), "utf8");

  it("nao renderiza EditorRuler", () => {
    expect(source).not.toContain("<EditorRuler");
  });

  it("nao renderiza controles de tabulacao e recuo", () => {
    expect(source).not.toContain("Inserir tabulação");
    expect(source).not.toContain("Diminuir recuo");
    expect(source).not.toContain("Aumentar recuo");
  });

  it("nao renderiza controles de espacamento manual", () => {
    expect(source).not.toContain("Espaçamento simples");
    expect(source).not.toContain("Espaçamento 1,5");
    expect(source).not.toContain("Espaçamento duplo");
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
