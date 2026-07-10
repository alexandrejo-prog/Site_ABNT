import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("editor body paragraph spacing", () => {
  const styles = readFileSync(join(process.cwd(), "src", "styles.css"), "utf8");
  const tiptapStyles = readFileSync(join(process.cwd(), "src", "components", "AcademicTiptapEditor.css"), "utf8");

  it("aplica margin 0 em paragrafos comuns do legacy", () => {
    expect(styles).toContain('.editor.rich-editor[data-editor-mode="body"] p {');
    expect(styles).toContain("margin-top: 0");
    expect(styles).toContain("margin-bottom: 0");
    expect(styles).toContain("line-height: var(--ufla-body-line-height)");
    expect(styles).toContain("text-indent: var(--ufla-body-first-line-indent)");
    expect(styles).toContain("text-align: justify");
  });

  it("aplica margin 0 em paragrafos comuns do Tiptap", () => {
    expect(tiptapStyles).toContain('.tiptap-editor[data-editor-mode="body"] .ProseMirror > p {');
    expect(tiptapStyles).toContain("margin-top: 0");
    expect(tiptapStyles).toContain("margin-bottom: 0");
    expect(tiptapStyles).toContain("line-height: var(--ufla-body-line-height)");
    expect(tiptapStyles).toContain("text-indent: var(--ufla-body-first-line-indent)");
    expect(tiptapStyles).toContain("text-align: justify");
  });

  it("exclui blockquote, listas e referencias do recuo e margin", () => {
    expect(styles).toContain('.editor.rich-editor[data-editor-mode="body"] blockquote p,');
    expect(styles).toContain("text-indent: 0");
    expect(styles).toContain('.editor.rich-editor[data-editor-mode="body"] li p,');
    expect(styles).toContain("text-indent: 0");
    expect(styles).toContain('.editor.rich-editor[data-editor-mode="body"] p[data-reference="true"] {');
    expect(styles).toContain("text-indent: 0");

    expect(tiptapStyles).toContain(".tiptap-editor .ProseMirror blockquote p,");
    expect(tiptapStyles).toContain("text-indent: 0");
    expect(tiptapStyles).toContain(".tiptap-editor .ProseMirror li p,");
    expect(tiptapStyles).toContain("text-indent: 0");
    expect(tiptapStyles).toContain('.tiptap-editor .ProseMirror p[data-reference="true"] {');
    expect(tiptapStyles).toContain("text-indent: 0");
  });

  it("nao aplica margin 0 global em todos os paragrafos", () => {
    expect(styles).not.toContain("body p { text-indent");
    expect(styles).not.toContain("main p { text-indent");
    expect(styles).not.toContain(".app-shell p { text-indent");
  });
});
