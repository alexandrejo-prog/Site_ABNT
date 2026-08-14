import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Editor não expõe termos técnicos de legado na UI", () => {
  const source = readFileSync(join(process.cwd(), "src", "App.tsx"), "utf8");

  it("não contém 'Legado estável' visível", () => {
    expect(source).not.toContain("Legado estável");
  });

  it("não reintroduz seletor de editor na interface", () => {
    expect(source).not.toContain("editor-mode-select");
    expect(source).not.toContain('value="legacy"');
    expect(source).not.toContain('value="tiptap"');
  });

  it("mantém apenas ativação técnica por URL", () => {
    expect(source).toContain("isTiptapExperimentalEditor");
  });
});
