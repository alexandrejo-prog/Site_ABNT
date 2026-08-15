import { describe, expect, it } from "vitest";
import {
  ACADEMIC_PRODUCTION_TYPE_IDS,
  ACADEMIC_PRODUCTION_TYPES,
  academicProductionTypeFor,
} from "../../src/academic-production-types";
import { emptyAcademicFields, WORK_TYPE_LABELS, WORK_TYPES } from "../../src/ufla-rules";
import { validateWork } from "../../src/validators";

const EXPECTED_IDS = [
  "artigo_cientifico_ufla",
  "patente_ufla",
  "revisao_sistematica_ufla",
  "estudo_caso_ufla",
  "software_aplicativo_ufla",
  "cultivar_ufla",
  "relatorio_estagio_ufla",
  "proposta_intervencao_ufla",
] as const;

describe("Colecao Producao Academica UFLA", () => {
  it("cadastra os oito formatos da colecao", () => {
    expect(ACADEMIC_PRODUCTION_TYPE_IDS).toEqual(EXPECTED_IDS);
    for (const id of EXPECTED_IDS) expect(WORK_TYPES).toContain(id);
  });

  it("define rotulo, campos obrigatorios e validacao manual para cada formato", () => {
    for (const type of ACADEMIC_PRODUCTION_TYPES) {
      expect(WORK_TYPE_LABELS[type.id]).toBeTruthy();
      expect(type.requiredFields.length).toBeGreaterThan(0);
      expect(type.sectionAliases.length).toBeGreaterThan(0);
      expect(type.manualValidationNotes.length).toBeGreaterThan(0);
      expect(type.supportStatus).toBe("inicial");
    }
  });

  it("localiza definicao pelo tipo de trabalho", () => {
    expect(academicProductionTypeFor("patente_ufla")?.label).toBe("Patente UFLA");
    expect(academicProductionTypeFor("relatorio_estagio_ufla")?.sourceCollectionNumber).toBe(7);
  });

  it("relatorio_estagio_ufla nao exige resumo/referencias por definicao propria", () => {
    const type = academicProductionTypeFor("relatorio_estagio_ufla");
    expect(type?.requiredFields).not.toContain("resumo");
    expect(type?.requiredFields).not.toContain("referencias");
  });

  it("todos os tipos possuem aliases documentados", () => {
    for (const type of ACADEMIC_PRODUCTION_TYPES) {
      expect(type.sectionAliases.length).toBeGreaterThan(0);
    }
  });

  it("novos tipos entram no fluxo de validacao sem quebrar", () => {
    for (const id of EXPECTED_IDS) {
      const issues = validateWork({ ...emptyAcademicFields(), workType: id }, "");
      expect(issues.some((issue) => issue.code === "author-required")).toBe(true);
    }
  });

  it("requiredFields de secao sao satisfeitos por heading no editor (mesmo criterio do gate por tipo)", () => {
    const fields = {
      ...emptyAcademicFields(),
      workType: "estudo_caso_ufla" as const,
      author: "Maria Silva",
      title: "Estudo de caso",
      resumo: "Resumo.",
      referencias: "SILVA, M. Estudo. Lavras: UFLA, 2024.",
    };
    // introducao e metodologia sem valor de campo, mas com secoes no editor.
    const editorText = "# 1 Introducao\nTexto.\n# 4 Metodologia\nMetodo.";
    const issues = validateWork(fields, editorText);
    expect(issues.some((i) => i.code === "ufla-collection-introducao-required")).toBe(false);
    expect(issues.some((i) => i.code === "ufla-collection-metodologia-required")).toBe(false);
  });

  it("requiredFields de secao sem campo e sem heading geram erro (mesmo criterio do gate)", () => {
    const fields = {
      ...emptyAcademicFields(),
      workType: "estudo_caso_ufla" as const,
      author: "Maria Silva",
      title: "Estudo de caso",
      resumo: "Resumo.",
      referencias: "SILVA, M. Estudo. Lavras: UFLA, 2024.",
    };
    const issues = validateWork(fields, "# 1 Introducao\nTexto.");
    expect(issues.some((i) => i.code === "ufla-collection-metodologia-required")).toBe(true);
    expect(issues.some((i) => i.code === "ufla-collection-introducao-required")).toBe(false);
  });

  it("campo de conteudo obrigatorio vazio gera erro mesmo com outras secoes presentes", () => {
    const fields = {
      ...emptyAcademicFields(),
      workType: "revisao_sistematica_ufla" as const,
      author: "Maria Silva",
      title: "Revisao sistematica",
      resumo: "Resumo.",
      referencias: "SILVA, M. Revisao. Lavras: UFLA, 2024.",
      palavrasChave: "cafe; qualidade",
    };
    const editorText = "# 1 Introducao\nTexto.\n# 4 Metodologia\nMetodo.";
    const issues = validateWork(fields, editorText);
    // objetivoGeral e obrigatorio para revisao_sistematica e nao ha secao/campo.
    expect(issues.some((i) => i.code === "ufla-collection-objetivoGeral-required")).toBe(true);
  });
});
