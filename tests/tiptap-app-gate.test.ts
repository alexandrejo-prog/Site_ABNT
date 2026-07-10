import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Tiptap app gate", () => {
  const source = readFileSync(join(process.cwd(), "src", "App.tsx"), "utf8");

  it("mantem editor legacy e adiciona gate experimental", () => {
    expect(source).toContain("AcademicTiptapEditor");
    expect(source).toContain('lazy(() => import("./components/AcademicTiptapEditor"))');
    expect(source).toContain("Suspense");
    expect(source).toContain("useTiptapExperimentalEditor");
    expect(source).toContain('searchParams.set("editor", "tiptap")');
    expect(source).toContain("contentEditable");
    expect(source).toContain("editorRef");
    expect(source).toContain("isTiptapEditorEnabled ?");
  });
});
