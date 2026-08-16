import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Tiptap command bridge", () => {
  const editorSource = readFileSync(join(process.cwd(), "src", "components", "AcademicTiptapEditor.tsx"), "utf8");
  const appSource = readFileSync(join(process.cwd(), "src", "App.tsx"), "utf8");

  it("AcademicTiptapEditor executa comandos basicos", () => {
    expect(editorSource).toContain("commandSignal");
    expect(editorSource).toContain("toggleBold");
    expect(editorSource).toContain("toggleItalic");
    expect(editorSource).toContain("toggleUnderline");
    expect(editorSource).toContain("toggleHeading");
    expect(editorSource).toContain("toggleBlockquote");
    expect(editorSource).toContain("toggleBulletList");
    expect(editorSource).toContain("toggleOrderedList");
    expect(editorSource).toContain("setTextAlign");
  });

  it("App despacha comandos Tiptap sem remover chamadas legacy", () => {
    expect(appSource).toContain("tiptapCommandSignal");
    expect(appSource).toContain("runTiptapCommand");
    expect(appSource).toContain("editorCommandAdapter");
    expect(appSource).toContain("applyBlockStyle");
  });
});
