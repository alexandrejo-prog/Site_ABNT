import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("AcademicTiptapEditor scaffold", () => {
  const source = readFileSync(join(process.cwd(), "src", "components", "AcademicTiptapEditor.tsx"), "utf8");

  it("declara dependencias e conversores do scaffold Tiptap", () => {
    expect(source).toContain("useEditor");
    expect(source).toContain("EditorContent");
    expect(source).toContain("StarterKit");
    expect(source).toContain("Underline");
    expect(source).toContain("TextAlign");
    expect(source).toContain("tiptapHtmlToEditorMarkup");
    expect(source).toContain("editorMarkupToTiptapHtml");
  });
});
