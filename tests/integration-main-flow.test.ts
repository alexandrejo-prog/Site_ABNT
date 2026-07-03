import { describe, expect, it } from "vitest";
import { validateWork, hasBlockingErrors } from "../src/validators";
import { generateDocxBlob } from "../src/export-docx";
import { emptyAcademicFields, type AcademicFields } from "../src/ufla-rules";

describe("Fluxo principal de geração DOCX", () => {
  function buildMinimalFields(): AcademicFields {
    const fields = emptyAcademicFields();
    return {
      ...fields,
      workType: "artigo",
      author: "Maria Silva",
      title: "Qualidade do café no sul de Minas",
      location: "Lavras - MG",
      year: "2026",
      resumo: "Resumo do trabalho.",
      palavrasChave: "café; qualidade",
      abstractText: "Abstract text.",
      keywords: "coffee; quality",
      introducao: "Texto da introdução.",
      referencias: "SILVA, M. Qualidade do café. Lavras: UFLA, 2024.",
    };
  }

  it("aceita fluxo mínimo sem erros bloqueantes", () => {
    const fields = buildMinimalFields();
    const issues = validateWork(fields, "# 1 Introdução\nTexto comum.");
    const blockingErrors = issues.filter((issue) => issue.severity === "error");

    expect(blockingErrors).toHaveLength(0);
    expect(hasBlockingErrors(issues)).toBe(false);
  });

  it("gera DOCX válido a partir do fluxo mínimo", async () => {
    const fields = buildMinimalFields();
    const editorText = "# 1 Introdução\nTexto comum.";

    const blob = await generateDocxBlob({ fields, editorText });

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
    expect(blob.type).toMatch(/^application\/(vnd\.openxmlformats-officedocument\.wordprocessingml\.document|octet-stream)/);
  });

  it("mantém fluxo independente de IA, API externa ou backend", () => {
    const fields = buildMinimalFields();
    const issues = validateWork(fields, "# 1 Introdução\nTexto comum.");

    const mentionsExternal = issues.some((issue) =>
      /ia|api|backend|autentica|groq|gemini|deepseek|openrouter|chave/i.test(
        `${issue.message} ${issue.what ?? ""} ${issue.why ?? ""} ${issue.action ?? ""}`,
      ),
    );

    expect(mentionsExternal).toBe(false);
  });
});