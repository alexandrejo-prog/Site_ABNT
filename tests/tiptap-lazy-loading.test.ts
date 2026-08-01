import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("carregamento sob demanda do Tiptap experimental", () => {
  const appSource = readFileSync(join(process.cwd(), "src", "App.tsx"), "utf8");
  const editorSectionSource = readFileSync(join(process.cwd(), "src", "components", "EditorSection.tsx"), "utf8");
  const source = `${appSource}\n${editorSectionSource}`;

  it("usa import dinamico para o editor Tiptap", () => {
    const staticImport = source
      .split(/\n/)
      .filter((line) => line.trim().startsWith("import "))
      .some((line) => line.includes("./components/AcademicTiptapEditor"));

    expect(staticImport).toBe(false);
    expect(source).toContain('lazy(() => import("./AcademicTiptapEditor"))');
    expect(source).toContain("Suspense");
    expect(source).toContain("Carregando editor Tiptap experimental");
  });

  it("mantem o editor legado fora do carregamento sob demanda", () => {
    expect(source).toContain("isTiptapEditorEnabled");
    expect(source).toContain("contentEditable");
    expect(source).toContain("editorRef");
  });
});
