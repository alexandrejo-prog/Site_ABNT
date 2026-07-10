import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("editor body first-line indent", () => {
  const styles = readFileSync(join(process.cwd(), "src", "styles.css"), "utf8");
  const tiptapStyles = readFileSync(join(process.cwd(), "src", "components", "AcademicTiptapEditor.css"), "utf8");
  const app = readFileSync(join(process.cwd(), "src", "App.tsx"), "utf8");
  const tiptapComponent = readFileSync(join(process.cwd(), "src", "components", "AcademicTiptapEditor.tsx"), "utf8");
  const ruler = readFileSync(join(process.cwd(), "src", "components", "EditorRuler.tsx"), "utf8");

  it("define variavel de recuo de primeira linha como 1.25cm", () => {
    expect(styles).toContain("--ufla-body-first-line-indent: 1.25cm");
  });

  it("define line-height 1.5 para corpo textual", () => {
    expect(styles).toContain("--ufla-body-line-height: 1.5");
  });

  it("aplica recuo apenas no escopo do editor legacy", () => {
    expect(styles).toContain('.editor.rich-editor[data-editor-mode="body"] p');
    expect(styles).toContain("text-indent: var(--ufla-body-first-line-indent)");
  });

  it("exclui blockquote do recuo no legacy", () => {
    expect(styles).toContain('.editor.rich-editor[data-editor-mode="body"] blockquote p');
    expect(styles).toContain("text-indent: 0");
  });

  it("exclui listas do recuo no legacy", () => {
    expect(styles).toContain('.editor.rich-editor[data-editor-mode="body"] li p');
    expect(styles).toContain("text-indent: 0");
  });

  it("exclui referencias marcadas do recuo no legacy", () => {
    expect(styles).toContain('.editor.rich-editor[data-editor-mode="body"] p[data-reference="true"]');
    expect(styles).toContain("text-indent: 0");
  });

  it("nao aplica recuo global em body/main/app-shell", () => {
    expect(styles).not.toContain("body p { text-indent");
    expect(styles).not.toContain("main p { text-indent");
    expect(styles).not.toContain(".app-shell p { text-indent");
  });

  it("aplica recuo no Tiptap apenas em paragrafos comuns do ProseMirror", () => {
    expect(tiptapStyles).toContain('.tiptap-editor[data-editor-mode="body"] .ProseMirror > p');
    expect(tiptapStyles).toContain("text-indent: var(--ufla-body-first-line-indent)");
  });

  it("exclui blockquote do recuo no Tiptap", () => {
    expect(tiptapStyles).toContain(".tiptap-editor .ProseMirror blockquote p");
    expect(tiptapStyles).toContain("text-indent: 0");
  });

  it("exclui listas do recuo no Tiptap", () => {
    expect(tiptapStyles).toContain(".tiptap-editor .ProseMirror li p");
    expect(tiptapStyles).toContain("text-indent: 0");
  });

  it("exclui referencias marcadas do recuo no Tiptap", () => {
    expect(tiptapStyles).toContain(".tiptap-editor .ProseMirror p[data-reference=\"true\"]");
    expect(tiptapStyles).toContain("text-indent: 0");
  });

  it("legacy repassa modo de editor via data-editor-mode", () => {
    expect(app).toContain('data-editor-mode={editorMode}');
  });

  it("Tiptap recebe prop editorMode", () => {
    expect(app).toContain("editorMode={editorMode}");
    expect(tiptapComponent).toContain("editorMode?: \"body\" | \"references\"");
    expect(tiptapComponent).toContain('"data-editor-mode": editorMode');
  });

  it("regra do editor mantem 1.25 cm como padrao de primeira linha", () => {
    expect(ruler).toContain("firstLine: 1.25");
  });

  it("nenhum arquivo de exportacao DOCX foi alterado", () => {
    const docxFiles = [
      "src/export-docx.ts",
      "src/export-article-docx.ts",
      "src/export-cpg-docx.ts",
      "src/export-research-project-docx.ts",
      "src/export-graduate-editable-draft-docx.ts",
      "src/docx-toc-field-patch.ts",
    ];
    for (const file of docxFiles) {
      const content = readFileSync(join(process.cwd(), file), "utf8");
      expect(content).not.toContain("text-indent: var(--ufla-body-first-line-indent)");
      expect(content).not.toContain("--ufla-body-first-line-indent");
    }
  });
});
