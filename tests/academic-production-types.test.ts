import { describe, expect, it } from "vitest";
import {
  ACADEMIC_PRODUCTION_TYPE_IDS,
  ACADEMIC_PRODUCTION_TYPES,
  academicProductionTypeFor,
} from "../src/academic-production-types";
import { emptyAcademicFields, WORK_TYPE_LABELS, WORK_TYPES } from "../src/ufla-rules";
import { validateWork } from "../src/validators";

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

  it("novos tipos entram no fluxo de validacao sem quebrar", () => {
    for (const id of EXPECTED_IDS) {
      const issues = validateWork({ ...emptyAcademicFields(), workType: id }, "");
      expect(issues.some((issue) => issue.code === "author-required")).toBe(true);
    }
  });
});
