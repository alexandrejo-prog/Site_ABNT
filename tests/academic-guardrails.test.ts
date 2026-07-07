import { describe, expect, it } from "vitest";
import {
  detectGenericAiLikeText,
  detectNaturalPlaceholder,
  detectPlaceholderText,
} from "../src/academic-guardrails";

describe("academic guardrails - texto generico de IA", () => {
  it("'É importante ressaltar que' sozinho não dispara generic-ai-like-text", () => {
    const text =
      "É importante ressaltar que a educação ambiental crítica contribui para a formação cidadã dos estudantes.";
    expect(detectGenericAiLikeText(text)).toBe(false);
  });

  it("texto com múltiplos clichês ainda dispara generic-ai-like-text", () => {
    const text =
      "No mundo atual, este estudo aborda diversos aspectos e busca contribuir significativamente para a área.";
    expect(detectGenericAiLikeText(text)).toBe(true);
  });
});

describe("academic guardrails - placeholder natural", () => {
  it("detecta 'grau acadêmico correspondente'", () => {
    expect(detectNaturalPlaceholder("Monografia com grau acadêmico correspondente.")).toBe(true);
  });

  it("detecta 'informado pelo usuário'", () => {
    expect(detectNaturalPlaceholder("curso de graduação informado pelo usuário")).toBe(true);
  });

  it("detecta 'Programa de Pós-Graduação informado pelo usuário'", () => {
    expect(detectNaturalPlaceholder("Programa de Pós-Graduação informado pelo usuário")).toBe(true);
  });

  it("texto normal não detecta placeholder natural", () => {
    expect(detectNaturalPlaceholder("Programa de Pós-Graduação em Educação Científica e Ambiental")).toBe(false);
  });
});

describe("academic guardrails - placeholder explícito", () => {
  it("detecta marcadores controlados", () => {
    expect(detectPlaceholderText("[PREENCHER: título]")).toBe(true);
    expect(detectPlaceholderText("{{preencher}}")).toBe(true);
    expect(detectPlaceholderText("<preencher>")).toBe(true);
    expect(detectPlaceholderText("lorem ipsum")).toBe(true);
  });
});
