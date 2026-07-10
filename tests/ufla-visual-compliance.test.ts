import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Conformidade visual UFLA na interface", () => {
  const css = readFileSync(join(process.cwd(), "src", "styles.css"), "utf8");
  const app = readFileSync(join(process.cwd(), "src", "App.tsx"), "utf8");

  it("header usa variáveis institucionais UFLA", () => {
    expect(css).toContain("background: var(--ufla-blue)");
    expect(css).toContain("border-bottom: 4px solid var(--ufla-green)");
  });

  it("interface usa Segoe UI como família institucional", () => {
    expect(css).toContain("font-family: var(--ufla-interface-font)");
  });

  it("editor acadêmico preserva Times New Roman 12 pt", () => {
    expect(css).toContain("--ufla-body-font-family: \"Times New Roman\", Times, serif");
    expect(css).toContain("--ufla-body-font-size: 12pt");
  });

  it("não reintroduz régua, fonte/tamanho editáveis ou 'Legado estável'", () => {
    expect(app).not.toContain("FontSelector");
    expect(app).not.toContain("Times New Roman");
    expect(app).not.toContain("Legado estável");
    expect(app).not.toContain("editor-mode-select");
  });
});
