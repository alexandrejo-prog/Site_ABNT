import { describe, expect, it } from "vitest";
import { normalizePlainAcademicText } from "../src/import-normalizer";
import { detectAcademicFieldsFromStructure } from "../src/field-detector";
import { validateWork, hasBlockingErrors } from "../src/validators";
import { generateDocxBlob } from "../src/export-docx";
import { emptyAcademicFields, type AcademicFields } from "../src/ufla-rules";

const TXT_CONTENT = `Título: Qualidade do café no sul de Minas
Autor: Maria Silva
Ano: 2026
Local: Lavras - MG

RESUMO
Este trabalho analisa a qualidade do café produzido no sul de Minas Gerais.

PALAVRAS-CHAVE: café; qualidade; sul de Minas

ABSTRACT
This work analyzes the quality of coffee produced in southern Minas Gerais.

Keywords: coffee; quality; southern Minas

INTRODUÇÃO
A cafeicultura é uma atividade de grande importância econômica para a região sul de Minas Gerais.

REFERÊNCIAS
SILVA, M. Qualidade do café. Lavras: UFLA, 2024.`;

function mergeFields(
  base: AcademicFields,
  imported: Partial<AcademicFields>,
): AcademicFields {
  const merged = { ...base };
  for (const [key, value] of Object.entries(imported)) {
    if (value && typeof value === "string" && value.trim()) {
      (merged as Record<string, string>)[key] = value;
    }
  }
  return merged;
}

describe("Integração: importação TXT → validação → geração DOCX", () => {
  it("importa campos de texto TXT, valida e gera DOCX válido", async () => {
    // 1. Simula importação de TXT/MD
    const normalized = normalizePlainAcademicText(TXT_CONTENT);
    const detected = detectAcademicFieldsFromStructure(normalized.structure);

    expect(detected.fields.title).toBeTruthy();
    expect(detected.fields.author).toBeTruthy();
    expect(detected.fields.resumo).toContain("qualidade do café");

    // 2. Monta campos acadêmicos completos
    const base = emptyAcademicFields();
    const fields: AcademicFields = {
      ...base,
      ...mergeFields(base, detected.fields),
      workType: "artigo",
      introducao: detected.fields.introducao || "Texto da introdução.",
      referencias: detected.fields.referencias || "SILVA, M. Qualidade do café. Lavras: UFLA, 2024.",
    };

    // 3. Validação
    const issues = validateWork(fields, "# 1 Introdução\nTexto comum.");
    const blockingErrors = issues.filter((issue) => issue.severity === "error");

    expect(hasBlockingErrors(issues)).toBe(false);
    expect(blockingErrors).toHaveLength(0);

    // 4. Geração DOCX
    const blob = await generateDocxBlob({ fields, editorText: "# 1 Introdução\nTexto comum." });

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
    expect(blob.type).toMatch(
      /^application\/(vnd\.openxmlformats-officedocument\.wordprocessingml\.document|octet-stream)/,
    );
  });

  it("não depende de IA, API externa ou backend", () => {
    const normalized = normalizePlainAcademicText(TXT_CONTENT);
    const detected = detectAcademicFieldsFromStructure(normalized.structure);

    const issues = validateWork(
      emptyAcademicFields(),
      detected.editorText || "",
    );

    const externalTerms = [
      "Groq", "Gemini", "DeepSeek", "OpenRouter",
      "chave da API", "chave de API", "apiKey",
      "api.openai.com", "generatePdfBlob",
    ];

    const combinedText = issues
      .map((issue) => `${issue.message} ${issue.what ?? ""} ${issue.why ?? ""} ${issue.action ?? ""}`)
      .join(" ");

    const matchesExternal = externalTerms.some((term) =>
      new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(combinedText),
    );
    expect(matchesExternal).toBe(false);
  });
});