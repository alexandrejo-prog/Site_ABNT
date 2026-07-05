import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("interface estática", () => {
  const app = readFileSync(join(process.cwd(), "src", "App.tsx"), "utf8");
  const styles = readFileSync(join(process.cwd(), "src", "styles.css"), "utf8");

  it("mantém regiões nomeadas para revisão", () => {
    expect(app).toContain('aria-label="Campos acadêmicos"');
    expect(app).toContain('aria-label="Editor do texto"');
    expect(app).toContain('aria-label="Validação"');
  });

  it("mantém avisos anunciáveis", () => {
    expect(app).toContain('aria-live="polite"');
    expect(app).toContain('role="alert"');
    expect(app).toContain('role="status"');
  });

  it("mantém breakpoints para tablet e celular", () => {
    expect(styles).toContain("@media (max-width: 1180px)");
    expect(styles).toContain("@media (max-width: 780px)");
    expect(styles).toContain("min-width: 320px");
  });

  it("mantém foco visível para navegação por teclado", () => {
    expect(styles).toContain("button:focus-visible");
    expect(styles).toContain(".rich-editor:focus");
    expect(styles).toContain("outline:");
  });
});
