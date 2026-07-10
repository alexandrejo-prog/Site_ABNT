import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("editor ruler removed", () => {
  const app = readFileSync(join(process.cwd(), "src", "App.tsx"), "utf8");

  it("nao renderiza EditorRuler", () => {
    expect(app).not.toContain("<EditorRuler");
  });

  it("nao contem texto sobre regua alterando recuos", () => {
    expect(app).not.toContain("A régua altera");
    expect(app).not.toContain("Recuos do parágrafo selecionado");
    expect(app).not.toContain("Régua ainda em adaptação");
  });

  it("nao mostra botoes de recuo manual", () => {
    expect(app).not.toContain("Diminuir recuo");
    expect(app).not.toContain("Aumentar recuo");
    expect(app).not.toContain("Inserir tabulação");
  });
});
