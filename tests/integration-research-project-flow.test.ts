import { describe, expect, it } from "vitest";
import { emptyAcademicFields } from "../src/ufla-rules";
import { validateWork, hasBlockingErrors } from "../src/validators";
import { generateResearchProjectDocxBlob } from "../src/export-research-project-docx";
import { normalizePlainAcademicText } from "../src/import-normalizer";

describe("Fluxo de integração TXT/MD para Projeto de pesquisa", () => {
  const RESEARCH_PROJECT_TXT = `Título do Projeto de Pesquisa
Maria Silva

# PROBLEMA DE PESQUISA
Descrição detalhada do problema a ser investigado nesta pesquisa.

# OBJETIVO GERAL
Analisar a influência do café na produtividade acadêmica.

# JUSTIFICATIVA
Justificativa completa explicando a relevância do tema.

# METODOLOGIA
Metodologia a ser empregada na pesquisa.

# CRONOGRAMA
Planejamento das atividades ao longo do tempo.

# REFERÊNCIAS
SILVA, M. Projeto de pesquisa. Lavras: UFLA, 2024.
SOUZA, J. Pesquisa aplicada. São Paulo: Editora, 2023.
`;

  it("fluxo completo TXT → validação → DOCX", async () => {
    const normalized = normalizePlainAcademicText(RESEARCH_PROJECT_TXT);

    const fields = {
      ...emptyAcademicFields(),
      workType: "projeto_pesquisa" as const,
      title: "Título do Projeto de Pesquisa",
      author: "Maria Silva",
      location: "Lavras - MG",
      year: "2026",
      resumo: "Resumo do projeto.",
      abstractText: "Abstract do projeto.",
    };

    const issues = validateWork(fields, normalized.text);

    expect(issues.some((i) => i.code === "research-project-partial")).toBe(true);
    expect(hasBlockingErrors(issues)).toBe(false);

    const blob = await generateResearchProjectDocxBlob({
      fields,
      editorText: normalized.text,
    });

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
    expect(blob.type).toMatch(/^application\/(vnd\.openxmlformats-officedocument\.wordprocessingml\.document|octet-stream)/);
  });

  it("projeto incompleto gera erros para seções faltantes", () => {
    const incompleteText = `Título do Projeto

Maria Silva

# OBJETIVOS ESPECÍFICOS
- Objetivo 1
- Objetivo 2

# REFERÊNCIAS
SILVA, M. 2024.
`;

    const fields = {
      ...emptyAcademicFields(),
      workType: "projeto_pesquisa" as const,
      title: "Título do Projeto",
      author: "Maria Silva",
    };

    const issues = validateWork(fields, incompleteText);
    const blockingErrors = issues.filter((i) => i.severity === "error");

    expect(blockingErrors.some((i) => i.code === "research-problem-required")).toBe(true);
    expect(blockingErrors.some((i) => i.code === "research-goal-required")).toBe(true);
    expect(blockingErrors.some((i) => i.code === "research-justification-required")).toBe(true);
    expect(blockingErrors.some((i) => i.code === "research-methodology-required")).toBe(true);
    expect(blockingErrors.some((i) => i.code === "research-schedule-required")).toBe(true);

    for (const issue of blockingErrors) {
      expect(issue.what).toBeTruthy();
      expect(issue.why).toBeTruthy();
      expect(issue.action).toBeTruthy();
    }
  });

  it("objetivo geral presente não gera erro", () => {
    const completeText = `TíTULO

AUTOR

# PROBLEMA DE PESQUISA
Problema.

# OBJETIVO GERAL
Objetivo geral da pesquisa.

# JUSTIFICATIVA
Justificativa.

# METODOLOGIA
Metodologia.

# CRONOGRAMA
Cronograma.

# REFERÊNCIAS
Referências.
`;

    const fields = {
      ...emptyAcademicFields(),
      workType: "projeto_pesquisa" as const,
      title: "TíTULO",
      author: "AUTOR",
    };

    const issues = validateWork(fields, completeText);

    expect(issues.some((i) => i.code === "research-goal-required")).toBe(false);
  });

  it("seção genérica OBJETIVOS não satisfaz objetivo geral", () => {
    const genericObjectivesText = `Título do Projeto

Autor

# PROBLEMA DE PESQUISA
Problema.

# OBJETIVOS
Lista de objetivos sem especificar geral.

# JUSTIFICATIVA
Justificativa.

# METODOLOGIA
Metodologia.

# CRONOGRAMA
Cronograma.

# REFERÊNCIAS
Referências.
`;

    const fields = {
      ...emptyAcademicFields(),
      workType: "projeto_pesquisa" as const,
      title: "Título do Projeto",
      author: "Autor",
    };

    const issues = validateWork(fields, genericObjectivesText);

    expect(issues.some((i) => i.code === "research-goal-required")).toBe(true);
  });

  it("não menciona IA ou API externa no fluxo de projeto de pesquisa", async () => {
    const externalTerms = [
      "Groq",
      "Gemini",
      "DeepSeek",
      "OpenRouter",
      "chave da API",
      "chave de API",
      "apiKey",
      "api.openai.com",
      "inteligência artificial",
    ];

    const fields = {
      ...emptyAcademicFields(),
      workType: "projeto_pesquisa" as const,
      title: "Título",
      author: "Autor",
    };

    const issues = validateWork(fields, "# PROBLEMA DE PESQUISA\n# OBJETIVO GERAL\n# JUSTIFICATIVA\n# METODOLOGIA\n# CRONOGRAMA\n# REFERÊNCIAS\n");

    const combinedText = issues.map((i) => `${i.message} ${i.what ?? ""} ${i.why ?? ""} ${i.action ?? ""}`).join(" ");

    for (const term of externalTerms) {
      expect(combinedText).not.toMatch(
        new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i"),
      );
    }

    const blob = await generateResearchProjectDocxBlob({ fields, editorText: "# Teste" });
    const blobText = await blob.text();
    for (const term of externalTerms) {
      expect(blobText).not.toMatch(
        new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i"),
      );
    }
  });
});