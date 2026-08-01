import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("contrato do Tiptap experimental", () => {
  const appSource = readFileSync(join(process.cwd(), "src", "App.tsx"), "utf8");
  const editorSectionSource = readFileSync(join(process.cwd(), "src", "components", "EditorSection.tsx"), "utf8");
  const featureFlagSource = readFileSync(join(process.cwd(), "src", "editor-feature-flags.ts"), "utf8");
  const tocPatchSource = readFileSync(join(process.cwd(), "src", "docx-toc-field-patch.ts"), "utf8");

  it("ativa Tiptap somente por parametro experimental", () => {
    expect(featureFlagSource).toContain('get("editor") === "tiptap"');
    expect(appSource).toContain("useTiptapExperimentalEditor");
    expect(appSource).toContain("isTiptapEditorEnabled");
  });

  it("mantem editor legacy presente e Tiptap isolado", () => {
    expect(editorSectionSource).toContain("contentEditable");
    expect(appSource).toContain("editorRef");
    expect(editorSectionSource).toContain("AcademicTiptapEditor");
    expect(editorSectionSource).toContain('import("./AcademicTiptapEditor")');
  });

  it("mantem editorText como fonte canonica para exportacao DOCX", () => {
    expect(appSource).toContain("templateForWorkType");
    expect(appSource).toContain("handleGenerateDocx");
    expect(appSource).toContain("editorText");
    expect(appSource).toContain("generate({ fields: generationFields, editorText, importedImages, importedTables });");
  });

  it("mantem patch de sumario reconhecivel e separado", () => {
    expect(tocPatchSource).toContain("ensureDynamicTocField");
    expect(tocPatchSource).toContain("__uflaDynamicTocPatch");
    expect(tocPatchSource).toContain("TOC_FIELD_PATTERN");
  });
});
