import { describe, expect, it } from "vitest";
import { detectAcademicFieldsFromText } from "../src/field-detector";

describe("field-detector", () => {
  it("detecta work types tradicionais sem regressao", () => {
    expect(detectAcademicFieldsFromText("TESE DE DOUTORADO").fields.workType).toBe("tese");
    expect(detectAcademicFieldsFromText("DISSERTACAO DE MESTRADO").fields.workType).toBe("dissertacao");
    expect(detectAcademicFieldsFromText("MONOGRAFIA / TCC").fields.workType).toBe("monografia");
    expect(detectAcademicFieldsFromText("ARTIGO").fields.workType).toBe("artigo");
  });

  it("detecta revisao_sistematica_ufla por alias protocolo de revisao", () => {
    expect(detectAcademicFieldsFromText("REVISAO SISTEMATICA\nProtocolo de revisao PRISMA").fields.workType).toBe("revisao_sistematica_ufla");
  });

  it("detecta revisao_sistematica_ufla por alias PRISMA", () => {
    expect(detectAcademicFieldsFromText("REVISAO SISTEMATICA\nPRISMA").fields.workType).toBe("revisao_sistematica_ufla");
  });

  it("detecta cultivar_ufla por alias DHE", () => {
    expect(detectAcademicFieldsFromText("CULTIVAR\nDHE").fields.workType).toBe("cultivar_ufla");
  });

  it("detecta patente_ufla por alias propriedade intelectual", () => {
    expect(detectAcademicFieldsFromText("PATENTE\nPropriedade intelectual").fields.workType).toBe("patente_ufla");
  });

  it("detecta estudo_caso_ufla por alias relato de caso", () => {
    expect(detectAcademicFieldsFromText("ESTUDO DE CASO\nRelato de caso").fields.workType).toBe("estudo_caso_ufla");
  });

  it("detecta estudo_caso_ufla por alias estudo multicaso", () => {
    expect(detectAcademicFieldsFromText("ESTUDO DE CASO\nEstudo multicaso").fields.workType).toBe("estudo_caso_ufla");
  });

  it("nao confunde artigo generico com artigo_cientifico_ufla", () => {
    const result = detectAcademicFieldsFromText("ARTIGO");
    expect(result.fields.workType).toBe("artigo");
  });

  it("detecta artigo_cientifico_ufla por alias paper", () => {
    expect(detectAcademicFieldsFromText("ARTIGO CIENTIFICO\nPaper").fields.workType).toBe("artigo_cientifico_ufla");
  });
});
