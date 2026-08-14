import { describe, expect, it } from "vitest";
import { generateDocxBlob } from "../../src/export-docx";
import { emptyAcademicFields, type AcademicFields } from "../../src/ufla-rules";
import { loadDocxParts } from ".././test-utils/ooxml";

function baseFields(overrides: Partial<AcademicFields> = {}): AcademicFields {
  return {
    ...emptyAcademicFields(),
    author: "Maria Silva",
    title: "Qualidade do cafe no sul de Minas",
    location: "Lavras - MG",
    year: "2026",
    resumo: "Resumo do trabalho.",
    palavrasChave: "cafe; qualidade",
    abstractText: "Abstract text.",
    keywords: "coffee; quality",
    referencias: "SILVA, M. Qualidade do cafe. Lavras: UFLA, 2024.",
    ...overrides,
  };
}

async function renderXml(fields: AcademicFields, editorText?: string): Promise<string> {
  const blob = await generateDocxBlob({ fields, editorText: editorText ?? "# 1 Introducao\nTexto.\n# 2 Metodologia\nTexto." });
  return (await loadDocxParts(blob)).documentXml;
}

describe("Pendências P1-P4 (tabelas, paginação, aprovação)", () => {
  it("P1: tabela IBGE usa traço duplo superior e inferior", async () => {
    const fields = baseFields({
      workType: "monografia",
      course: "Bacharelado em Biologia",
    });
    const editorText = [
      "# 1 Introducao",
      "Texto.",
      "Quadro 1 - Cronograma de execucao",
      "1o semestre 1 a 6 Jan/2026 a Jun/2026 Revisao",
      "Fonte: elaborado pelo autor (2026).",
    ].join("\n");
    const documentXml = await renderXml(fields, editorText);

    const borders = documentXml.match(/<w:tblBorders[\s\S]*?<\/w:tblBorders>/g)?.join("") ?? "";
    const top = borders.match(/<w:top\b[^>]*w:val="(?<val>[^"]*)"/)?.groups?.val;
    const bottom = borders.match(/<w:bottom\b[^>]*w:val="(?<val>[^"]*)"/)?.groups?.val;
    expect(top).toBe("double");
    expect(bottom).toBe("double");
  });

  it("P2: apêndices e anexos mantêm numeração de página (mesma seção textual)", async () => {
    const fields = baseFields({
      workType: "dissertacao",
      program: "Ciência do Solo",
      advisor: "Prof. Dr. João Silva",
      apendices: "APÊNDICE A - ROTEIRO\nTexto do apêndice.",
      anexos: "ANEXO A - FORMULÁRIO\nTexto do anexo.",
      indicadoresImpacto: "Impacto social: informado.",
      impactIndicators: "Social impact text.",
    });
    const documentXml = await renderXml(fields);

    const sectionStart = documentXml.lastIndexOf("<w:sectPr");
    expect(sectionStart).toBeGreaterThan(-1);
    const firstSection = documentXml.slice(0, sectionStart);
    expect(firstSection).toContain("APÊNDICE A");
    expect(firstSection).toContain("ANEXO A");
    expect(documentXml).toContain('w:pgNumType w:start="8"');
  });

  it("P3: título em inglês aparece na folha de aprovação de tese e dissertação", async () => {
    for (const workType of ["tese", "dissertacao"] as const) {
      const fields = baseFields({
        workType,
        program: "Ciência do Solo",
        advisor: "Prof. Dr. João Silva",
        englishTitle: "Coffee quality in southern Minas Gerais",
        indicadoresImpacto: "Impacto social: informado.",
        impactIndicators: "Social impact text.",
      });
      const documentXml = await renderXml(fields);

      expect(documentXml).toContain("Coffee quality in southern Minas Gerais");
      expect(documentXml).toContain("APROVADO EM");
    }
  });

  it("P3: monografia não exige título em inglês na folha de aprovação", async () => {
    const fields = baseFields({
      workType: "monografia",
      course: "Bacharelado em Biologia",
      advisor: "Prof. Dr. João Silva",
      englishTitle: "Coffee quality in southern Minas Gerais",
    });
    const documentXml = await renderXml(fields);

    expect(documentXml).not.toContain("Coffee quality in southern Minas Gerais");
  });

  it("P4: coorientador aparece na folha de aprovação quando preenchido", async () => {
    const fields = baseFields({
      workType: "dissertacao",
      program: "Ciência do Solo",
      advisor: "Prof. Dr. João Silva",
      coadvisor: "Profa. Dra. Ana Souza",
      indicadoresImpacto: "Impacto social: informado.",
      impactIndicators: "Social impact text.",
    });
    const documentXml = await renderXml(fields);

    expect(documentXml).toContain("Profa. Dra. Ana Souza");
    expect(documentXml).toContain("Coorientador(a) - UFLA");
  });
});
