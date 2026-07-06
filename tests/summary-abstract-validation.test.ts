import { describe, expect, it } from "vitest";
import { emptyAcademicFields } from "../src/ufla-rules";
import { hasBlockingErrors, validateWork } from "../src/validators";

function words(count: number): string {
  return Array.from({ length: count }, (_, index) => `palavra${index + 1}`).join(" ");
}

describe("validação de resumo, abstract e indicadores", () => {
  it("alerta resumo fora da faixa de palavras e com mais de um parágrafo", () => {
    const fields = {
      ...emptyAcademicFields(),
      workType: "monografia" as const,
      title: "Título",
      author: "Maria Silva",
      resumo: "Resumo curto.\n\nSegundo parágrafo.",
      referencias: "SILVA, M. Título. Lavras: UFLA, 2024.",
    };

    const issues = validateWork(fields, "# INTRODUÇÃO\nTexto.");
    const codes = issues.map((issue) => issue.code);

    expect(codes).toContain("resumo-word-count");
    expect(codes).toContain("resumo-single-paragraph");
    expect(hasBlockingErrors(issues)).toBe(false);
  });

  it("alerta palavras-chave e keywords fora da faixa ou sem separador esperado", () => {
    const fields = {
      ...emptyAcademicFields(),
      workType: "monografia" as const,
      title: "Título",
      author: "Maria Silva",
      resumo: words(160),
      palavrasChave: "universidade, trabalho",
      abstractText: words(160),
      keywords: "university, work",
      referencias: "SILVA, M. Título. Lavras: UFLA, 2024.",
    };

    const issues = validateWork(fields, "# INTRODUÇÃO\nTexto.");
    const codes = issues.map((issue) => issue.code);

    expect(codes).toContain("palavras-chave-count");
    expect(codes).toContain("keywords-count");
  });

  it("não alerta resumo e abstract em faixa usual", () => {
    const fields = {
      ...emptyAcademicFields(),
      workType: "monografia" as const,
      title: "Título",
      author: "Maria Silva",
      resumo: words(160),
      palavrasChave: "universidade; trabalho; saúde",
      abstractText: words(160),
      keywords: "university; work; health",
      referencias: "SILVA, M. Título. Lavras: UFLA, 2024.",
    };

    const issues = validateWork(fields, "# INTRODUÇÃO\nTexto.");
    const codes = issues.map((issue) => issue.code);

    expect(codes).not.toContain("resumo-word-count");
    expect(codes).not.toContain("abstract-word-count");
    expect(codes).not.toContain("palavras-chave-count");
    expect(codes).not.toContain("keywords-count");
  });

  it("bloqueia geração quando indicadores de impacto estão vazios em tese", () => {
    const fields = {
      ...emptyAcademicFields(),
      workType: "tese" as const,
      title: "Título",
      author: "Maria Silva",
      advisor: "Prof. João",
      resumo: words(160),
      palavrasChave: "universidade; trabalho; saúde",
      abstractText: words(160),
      keywords: "university; work; health",
      referencias: "SILVA, M. Título. Lavras: UFLA, 2024.",
    };

    const issues = validateWork(fields, "# INTRODUÇÃO\nTexto.");
    const codes = issues.map((issue) => issue.code);

    expect(codes).toContain("impact-indicators-missing");
    expect(hasBlockingErrors(issues)).toBe(true);
  });
});
