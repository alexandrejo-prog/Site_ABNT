import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Editor não expõe controles de fonte/tamanho", () => {
  const source = readFileSync(join(process.cwd(), "src", "App.tsx"), "utf8");

  it("não importa FontSelector sem uso", () => {
    const importMatches = source.match(/import\s+{[^}]*FontSelector[^}]*}\s+from\s+["'][^"']+["']/g);
    expect(importMatches).toBeNull();
  });

  it("não renderiza caixa editável de fonte", () => {
    expect(source).not.toContain("Times New Roman");
    expect(source).not.toContain('value="Times New Roman"');
    expect(source).not.toContain('placeholder="Times New Roman"');
  });

  it("não renderiza caixa editável de tamanho 12", () => {
    expect(source).not.toContain('value="12"');
    expect(source).not.toContain('placeholder="12"');
  });

  it("não reintroduz seletor de fonte ou tamanho em App.tsx", () => {
    expect(source).not.toContain("FontSelector");
    expect(source).not.toContain('font-family');
    expect(source).not.toContain('fontSize');
  });
});
