import { describe, expect, it } from "vitest";
import { emptyAcademicFields } from "../../src/ufla-rules";
import { validateWork } from "../../src/validators";

function codesFor(body: string): Set<string> {
  const fields = {
    ...emptyAcademicFields(),
    workType: "monografia" as const,
    title: "Título",
    author: "Maria Silva",
    resumo: "Este é um resumo com quantidade suficiente de palavras para se situar na faixa usual de extensão para trabalhos academicos e assim nao gerar avisos de contagem.",
    abstractText: "This abstract length is fine for these tests and should stay silent.",
    referencias: "SILVA, M. Título. Lavras: UFLA, 2024.",
  };
  const issues = validateWork(fields, body);
  return new Set(issues.map((issue) => issue.code));
}

describe("validação de citação direta curta autor-data-página (NBR 10520)", () => {
  it("não acusa citação no formato autor-data-página válido", () => {
    const c = codesFor(`Texto "entre aspas" (SILVA, 2024, p. 15).`);
    expect(c.has("citation-year-missing")).toBe(false);
    expect(c.has("citation-author-missing")).toBe(false);
    expect(c.has("citation-page-missing")).toBe(false);
  });

  it("sugere página quando citação direta (com aspas) não indica página", () => {
    const c = codesFor(`Segundo o autor, "a regra é clara" (SILVA, 2024).`);
    expect(c.has("citation-direct-locator")).toBe(true);
  });

  it("não acusa citação sem aspas (citação indireta) sem página", () => {
    const c = codesFor(`Conforme observado (SILVA, 2024), o resultado seguiu o esperado.`);
    expect(c.has("citation-direct-locator")).toBe(false);
    expect(c.has("citation-year-missing")).toBe(false);
  });

  it("acusa citação sem ano", () => {
    const c = codesFor("Texto com (SILVA, p. 15) sem ano.");
    expect(c.has("citation-year-missing")).toBe(true);
  });

  it("acusa citação sem autor identificável", () => {
    const c = codesFor("Texto com (2024, p. 15) sem autor.");
    expect(c.has("citation-author-missing")).toBe(true);
  });

  it("acusa página indicada mas vazia", () => {
    const c = codesFor("Trecho (SILVA, 2024, p.) incompleto.");
    expect(c.has("citation-page-missing")).toBe(true);
  });

  it("citações em parênteses longas demais para citação são ignoradas", () => {
    const c = codesFor("Dados (a instituição informou uma quantidade muito elevada de registros que ultrapassa o limite razoável de caracteres).");
    expect(c.has("citation-author-missing")).toBe(false);
    expect(c.has("citation-year-missing")).toBe(false);
  });
});
