import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("segurança runtime da interface", () => {
  const main = readFileSync(join(process.cwd(), "src", "main.tsx"), "utf8");
  const errorBoundary = readFileSync(join(process.cwd(), "src", "ErrorBoundary.tsx"), "utf8");
  const scrollFix = readFileSync(join(process.cwd(), "src", "editor-scroll-fix.ts"), "utf8");

  it("monta a aplicação com ErrorBoundary", () => {
    expect(main).toContain("<ErrorBoundary>");
    expect(main).toContain("</ErrorBoundary>");
    expect(errorBoundary).toContain("componentDidCatch");
    expect(errorBoundary).toContain('role="alert"');
  });

  it("não importa injeção DOM duplicada de undo/redo", () => {
    expect(main).not.toContain("editor-undo-redo");
    expect(existsSync(join(process.cwd(), "src", "editor-undo-redo.ts"))).toBe(false);
  });

  it("scroll fix do editor expõe cleanup e não instala MutationObserver global", () => {
    expect(scrollFix).toContain("installEditorScrollFix");
    expect(scrollFix).toContain("installedCleanup");
    expect(scrollFix).not.toContain("new MutationObserver");
    expect(scrollFix).not.toContain("observer.observe(document.body");
  });

  it("scroll fix não faz monkeypatch global de focus ou execCommand", () => {
    expect(scrollFix).not.toContain("HTMLElement.prototype.focus =");
    expect(scrollFix).not.toContain("document.execCommand =");
  });
});
