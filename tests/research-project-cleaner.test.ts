import { describe, expect, it } from "vitest";
import {
  hasResearchProjectTechnicalNoise,
  isResearchProjectProvisionalText,
  normalizeKeywordSentence,
  normalizeResearchProjectEditorText,
} from "../src/research-project-cleaner";

describe("saneamento estrutural de Projeto de pesquisa", () => {
  it("remove marcadores TITLE, artefatos Toc e recupera títulos acentuados", () => {
    const normalized = normalizeResearchProjectEditorText([
      "TITLE 1 INTRODUÇÃO Toc234433198",
      "TITLE 1 REFERENCIAL TERICO",
      "SUMRIO Toc12345",
      "Texto com citação (UNIVERSIDADE FEDERAL DE LAVRAS, 2024, p. 6-8).",
    ].join("\n"));

    expect(normalized).toContain("# INTRODUÇÃO");
    expect(normalized).toContain("# REFERENCIAL TEÓRICO");
    expect(normalized).toContain("# SUMÁRIO");
    expect(normalized).toContain("UNIVERSIDADE FEDERAL DE LAVRAS, 2025, p. 6-8");
    expect(normalized).not.toContain("TITLE");
    expect(normalized).not.toContain("Toc234433198");
    expect(normalized).not.toContain("REFERENCIAL TERICO");
  });

  it("detecta ruído técnico e placeholders naturais", () => {
    expect(hasResearchProjectTechnicalNoise("TITLE 1 INTRODUÇÃO")).toBe(true);
    expect(hasResearchProjectTechnicalNoise("SUMRIO")).toBe(true);
    expect(isResearchProjectProvisionalText("nome do orientador")).toBe(true);
    expect(isResearchProjectProvisionalText("Título do trabalho")).toBe(true);
    expect(isResearchProjectProvisionalText("Prof. Dr. João da Silva")).toBe(false);
  });

  it("normaliza palavras-chave como sentença pontuada", () => {
    expect(normalizeKeywordSentence("PGD; saúde do trabalhador; educação ambiental crítica")).toBe(
      "PGD. saúde do trabalhador. educação ambiental crítica.",
    );
    expect(normalizeKeywordSentence("PGD. saúde do trabalhador")).toBe("PGD. saúde do trabalhador.");
  });
});
