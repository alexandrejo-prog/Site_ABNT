import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("interface estática", () => {
  const app = readFileSync(join(process.cwd(), "src", "App.tsx"), "utf8");
  const sidebar = readFileSync(join(process.cwd(), "src", "components", "ValidationSidebar.tsx"), "utf8");
  const adherence = readFileSync(join(process.cwd(), "src", "components", "AdherencePanel.tsx"), "utf8");
  const styles = readFileSync(join(process.cwd(), "src", "styles.css"), "utf8");
  const combined = `${app}\n${sidebar}\n${adherence}`;

  it("mantém regiões nomeadas para revisão", () => {
    expect(combined).toContain('aria-label="Campos acadêmicos"');
    expect(combined).toContain('aria-label="Editor do texto"');
    expect(combined).toContain('aria-label="Validação"');
  });

  it("mantém avisos anunciáveis", () => {
    expect(combined).toContain('aria-live="polite"');
    expect(combined).toContain('role="alert"');
    expect(combined).toContain('role="status"');
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
