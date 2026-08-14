import { describe, expect, it } from "vitest";
import { AcademicFields, emptyAcademicFields } from "../../src/ufla-rules";
import { validateWork } from "../../src/validators";
import { TextDiagnosticPanel } from "../../src/text-diagnostic-panel";
import { buildTextDiagnostic } from "../../src/text-diagnostics";
import { renderToStaticMarkup } from "react-dom/server";

function baseFields(overrides: Partial<AcademicFields> = {}): AcademicFields {
  return {
    ...emptyAcademicFields(),
    workType: "monografia",
    author: "Maria Silva",
    title: "Ensino de biologia no ensino médio",
    advisor: "Prof. João Souza",
    resumo: "Este trabalho objetiva investigar a docência de biologia. Utilizou-se uma metodologia qualitativa com observação em sala. Os resultados indicam melhoria. Conclui-se que a prática pedagógica é eficaz.",
    palavrasChave: "biologia; ensino; docência",
    abstractText: "This study aims to investigate biology teaching using a qualitative methodology. Results indicate improvement. It is concluded that pedagogical practice is effective.",
    keywords: "biology; teaching; pedagogy",
    introducao: "Introdução.",
    referencias: "SILVA, M. Livro. Lavras: UFLA, 2024.",
    ...overrides,
  };
}

describe("Rodada 2 - diagnóstico textual", () => {
  it("resumo sem método gera warning", () => {
    const issues = validateWork(baseFields({ resumo: "Este trabalho objetiva investigar a docência de biologia. Conclui-se que é importante." }));
    expect(issues).toContainEqual(expect.objectContaining({ severity: "warning", code: "resumo-missing-method" }));
  });

  it("resumo com método não gera warning", () => {
    const issues = validateWork(baseFields());
    expect(issues).not.toContainEqual(expect.objectContaining({ code: "resumo-missing-method" }));
  });

  it("abstract em português gera warning", () => {
    const issues = validateWork(baseFields({ abstractText: "Este resumo em português descreve o trabalho e seus resultados obtidos na pesquisa realizada." }));
    expect(issues).toContainEqual(expect.objectContaining({ severity: "warning", code: "abstract-looks-portuguese" }));
  });

  it("abstract de agricultura em trabalho de docência gera error", () => {
    const issues = validateWork(
      baseFields({
        title: "Docência de biologia no ensino médio",
        resumo: "Este trabalho investiga a docência de biologia e avalia práticas pedagógicas em escolas de ensino médio.",
        abstractText: "This study analyzes the transformative role of artificial intelligence in modern agriculture and crop farming yields.",
      }),
    );
    expect(issues).toContainEqual(expect.objectContaining({ code: "abstract-topic-conflict", severity: "error" }));
  });

  it("texto genérico gera warning", () => {
    const issues = validateWork(baseFields({ resumo: "Este trabalho aborda diversos aspectos da temática em questão de forma relevante." }));
    expect(issues).toContainEqual(expect.objectContaining({ severity: "warning", code: "generic-ai-like-text" }));
  });

  it("validação exibe contagem correta", () => {
    const issues = validateWork(baseFields({ resumo: "Texto curto sem método." }));
    const errors = issues.filter((i) => i.severity === "error").length;
    const warnings = issues.filter((i) => i.severity === "warning" || i.severity === "info").length;
    expect(errors + warnings).toBe(issues.length);
  });

  it("painel de diagnóstico renderiza", () => {
    const html = renderToStaticMarkup(<TextDiagnosticPanel fields={baseFields()} />);
    expect(html).toContain("Diagnóstico textual");
    expect(html).toContain("Consistência Título");
  });

  it("buildTextDiagnostic detecta método ausente", () => {
    const diag = buildTextDiagnostic(baseFields({ resumo: "Objetiva investigar. Conclui-se que é relevante." }));
    expect(diag.hasMethod).toBe(false);
    expect(diag.hasObjective).toBe(true);
  });
});
