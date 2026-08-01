import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Tiptap app gate", () => {
  const appSource = readFileSync(join(process.cwd(), "src", "App.tsx"), "utf8");
  const editorSectionSource = readFileSync(join(process.cwd(), "src", "components", "EditorSection.tsx"), "utf8");

  it("mantem editor legacy e adiciona gate experimental", () => {
    expect(editorSectionSource).toContain("AcademicTiptapEditor");
    expect(editorSectionSource).toContain('lazy(() => import("./AcademicTiptapEditor"))');
    expect(editorSectionSource).toContain("Suspense");
    expect(appSource).toContain("useTiptapExperimentalEditor");
    expect(editorSectionSource).toContain("contentEditable");
    expect(appSource).toContain("editorRef");
    expect(editorSectionSource).toContain("isTiptapEditorEnabled ?");
  });
});
