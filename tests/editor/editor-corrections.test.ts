import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("editor e fluxo de importação", () => {
  const appSource = readFileSync(join(process.cwd(), "src", "App.tsx"), "utf8");
  const toolbarSource = readFileSync(join(process.cwd(), "src", "components", "EditorToolbar.tsx"), "utf8");
  const editorSectionSource = readFileSync(join(process.cwd(), "src", "components", "EditorSection.tsx"), "utf8");
  const combined = `${appSource}\n${toolbarSource}\n${editorSectionSource}`;

  it("App.tsx não contém geração direta de PDF", () => {
    const pdfGenerationPatterns = [
      /gotenberg/i,
      /generatePdf|pdfGeneration|convertToPdf/i,
      /pdf-generation|pdf_generation/i,
    ];

    for (const pattern of pdfGenerationPatterns) {
      expect(appSource).not.toMatch(pattern);
    }
  });

  it("App.tsx contém modo Texto e Referências", () => {
    expect(combined).toContain('editorMode === "body"');
    expect(combined).toContain('editorMode === "references"');
    expect(combined).toContain('setEditorMode("body")');
    expect(combined).toContain('setEditorMode("references")');
  });

  it("App.tsx contém botões de Desfazer e Refazer", () => {
    expect(combined).toContain("Desfazer");
    expect(combined).toContain("Refazer");
    expect(combined).toContain('editorCommandAdapter.applyEditorCommand("undo")');
    expect(combined).toContain('editorCommandAdapter.applyEditorCommand("redo")');
  });

  it("App.tsx não usa dangerouslySetInnerHTML no editor", () => {
    const editorMatches = editorSectionSource.match(/<div[^>]*ref=\{editorRef[^>]*\}[^>]*>/g);
    expect(editorMatches).toBeTruthy();

    const editorDiv = editorMatches![0];
    expect(editorDiv).not.toContain("dangerouslySetInnerHTML");
  });

  it("App.tsx contém lógica de sincronização segura do editor", () => {
    const editorSource = readFileSync(join(process.cwd(), "src", "hooks", "useEditor.ts"), "utf8");
    expect(editorSource).toContain("editorContentVersionRef");
    expect(editorSource).toContain("lastAppliedEditorTextRef");
    expect(appSource).toContain("editorContentVersionRef");
    expect(appSource).toContain("lastAppliedEditorTextRef");
  });

  it("App.tsx atualiza editor após importação", () => {
    expect(appSource).toContain("editorContentVersionRef.current += 1");
    expect(appSource).toContain("lastAppliedEditorTextRef.current = ");
    expect(appSource).toContain("editorRef.current.innerHTML = editorMarkupToHtml(");
  });

  it("App.tsx preserva conteúdo ao alternar modos", () => {
    expect(appSource).toContain("activeEditorText");
    expect(appSource).toContain("editorMode === \"references\" ? fields.referencias : editorText");
  });

  it("App.tsx valida com texto do modo ativo usando candidateFields", () => {
    const validationSource = readFileSync(join(process.cwd(), "src", "hooks", "useValidation.ts"), "utf8");
    expect(validationSource).toContain("textToValidate = editorMode === \"references\" ? fields.referencias : editorText");
  });

  it("funções de formatação usam setTimeout para evitar perda de seleção", () => {
    expect(appSource).toContain('setTimeout(() => requestAnimationFrame(handleEditorInput), 0)');
  });

  it("importação preserva editorText completo e aplica reparo seguro", () => {
    const importSource = readFileSync(join(process.cwd(), "src", "import-docx.ts"), "utf8");
    expect(importSource).toContain("detected.editorText || text");
    expect(importSource).toContain("repairHeadingFragments");
  });

  it("field-detector gera editorText com corpo completo", () => {
    const detectorSource = readFileSync(join(process.cwd(), "src", "field-detector.ts"), "utf8");
    expect(detectorSource).toContain("function blocksToEditorText");
    expect(detectorSource).toContain("function blocksToEditorTextForCpg");
  });

  it("export-docx parseia editorText preservando estrutura", () => {
    const exportSource = readFileSync(join(process.cwd(), "src", "export-docx.ts"), "utf8");
    expect(exportSource).toContain("export function parseEditorContent");
    expect(exportSource).toContain("editorText: string");
  });
});
