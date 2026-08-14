import { describe, expect, it } from "vitest";
import { generateDocxBlob } from "../../src/export-docx";
import { emptyAcademicFields, type AcademicFields } from "../../src/ufla-rules";
import { loadDocxParts } from "../test-utils/ooxml";

/**
 * Acceptance test baseline-driven (referencia real dissertacao-geometria-sistema.docx).
 * A dissertacao aprovada real tem a secao textual iniciando a numeracao no valor das
 * paginas pre-textuais contadas + 1 (pgNumType start=9 no OOXML da referencia), nunca
 * em 1. Este teste trava esse comportamento para nao regredir.
 */
describe("acceptance: paginacao textual comeca nas pre-textuais contadas (nao em 1)", () => {
  const fields = {
    ...emptyAcademicFields(),
    workType: "dissertacao" as const,
    author: "Maria Silva",
    title: "Qualidade do cafe no sul de Minas",
    location: "Lavras - MG",
    year: "2026",
    program: "Educação Científica e Ambiental",
    advisor: "Prof. Dr. João Silva",
    resumo: "Resumo do trabalho.",
    palavrasChave: "cafe; qualidade",
    abstractText: "Abstract text.",
    keywords: "coffee; quality",
    referencias: "SILVA, M. Qualidade do cafe. Lavras: UFLA, 2024.",
  };

  async function sectionStarts(editorText: string, overrides: Partial<AcademicFields> = {}) {
    const blob = await generateDocxBlob({ fields: { ...fields, ...overrides }, editorText });
    const { documentXml } = await loadDocxParts(blob);
    const sectPrs = documentXml.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/g) ?? [];
    return sectPrs.map((s) => {
      const m = s.match(/w:pgNumType[^>]*w:start="(\d+)"/);
      return { hasHeader: s.includes("w:headerReference"), start: m ? parseInt(m[1], 10) : null };
    });
  }

  it("secao textual (header) comeca na folha 9 quando ha ficha, aprovacao, resumo, abstract, indicadores, 2 listas e sumario", async () => {
    const editorText = [
      "# 1 INTRODUCAO",
      "Texto.",
      "Figura 1 - Modelo conceitual",
      "Fonte: elaborado pelo autor (2026).",
      "Tabela 1 - Dados coletados",
      "Fonte: elaborado pelo autor (2026).",
      "# 2 METODOLOGIA",
      "Texto.",
    ].join("\n");

    const sections = await sectionStarts(editorText, { indicadoresImpacto: "Impacto social: informado." });

    const textual = sections.filter((s) => s.hasHeader);
    expect(textual.length).toBe(1);
    expect(textual[0].start, "secao textual deve comecar no valor contado (folha 9)").toBe(9);
  });

  it("secao pre-textual nao define inicio de numeracao (sem header e sem start)", async () => {
    const editorText = "# 1 INTRODUCAO\nTexto.";
    const sections = await sectionStarts(editorText, { indicadoresImpacto: "Impacto social: informado." });

    const preTextual = sections.filter((s) => !s.hasHeader);
    expect(preTextual.length).toBe(1);
    expect(preTextual[0].start).toBeNull();
  });

  it("monografia sem indicadores comeca a numeracao na folha 6 (folha+aprovacao+resumo+abstract+sumario)", async () => {
    const editorText = "# 1 INTRODUCAO\nTexto.";
    const sections = await sectionStarts(editorText, { workType: "monografia", course: "Licenciatura em Física" });

    const textual = sections.filter((s) => s.hasHeader);
    expect(textual[0].start, "monografia sem indicadores comeca na folha 6").toBe(6);
  });
});
