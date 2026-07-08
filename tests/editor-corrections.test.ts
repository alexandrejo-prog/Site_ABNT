import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("editor e fluxo de importação", () => {
  const appSource = readFileSync(join(process.cwd(), "src", "App.tsx"), "utf8");

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
    expect(appSource).toContain('editorMode === "body"');
    expect(appSource).toContain('editorMode === "references"');
    expect(appSource).toContain('setEditorMode("body")');
    expect(appSource).toContain('setEditorMode("references")');
  });

  it("App.tsx contém botões de Desfazer e Refazer", () => {
    expect(appSource).toContain("Desfazer");
    expect(appSource).toContain("Refazer");
    expect(appSource).toContain('editorCommandAdapter.applyEditorCommand("undo")');
    expect(appSource).toContain('editorCommandAdapter.applyEditorCommand("redo")');
  });

  it("App.tsx não usa dangerouslySetInnerHTML no editor", () => {
    const editorMatches = appSource.match(/<div[^>]*ref={editorRef}[^>]*>/g);
    expect(editorMatches).toBeTruthy();

    const editorDiv = editorMatches![0];
    expect(editorDiv).not.toContain("dangerouslySetInnerHTML");
  });

  it("App.tsx contém lógica de sincronização segura do editor", () => {
    expect(appSource).toContain("editorContentVersionRef");
    expect(appSource).toContain("lastAppliedEditorTextRef");
    expect(appSource).toContain("contentChanged");
    expect(appSource).toContain("isEditing");
  });

  it("App.tsx atualiza editor após importação", () => {
    expect(appSource).toContain("editorContentVersionRef.current += 1");
    expect(appSource).toContain("lastAppliedEditorTextRef.current = newEditorText");
    expect(appSource).toContain("editorRef.current.innerHTML = editorMarkupToHtml(newEditorText)");
  });

  it("App.tsx preserva conteúdo ao alternar modos", () => {
    expect(appSource).toContain("activeEditorText");
    expect(appSource).toContain("editorMode === \"references\" ? fields.referencias : editorText");
  });

  it("App.tsx valida com texto do modo ativo usando candidateFields", () => {
    expect(appSource).toContain("textToValidate = editorMode === \"references\" ? normalizedFields.referencias : editorText");
  });

  it("funções de formatação usam setTimeout para evitar perda de seleção", () => {
    expect(appSource).toContain('setTimeout(() => requestAnimationFrame(handleRichEditorInput), 0)');
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
