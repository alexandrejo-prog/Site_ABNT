import { describe, expect, it } from "vitest";
import { catalogCardRequirement, catalogCardStatus, hasCatalogCardContent, hasCutterNumber } from "../../src/catalog-card";

describe("catalog card", () => {
  it("exige item para trabalhos finais", () => {
    expect(catalogCardRequirement("monografia")).toBe("required");
    expect(catalogCardRequirement("dissertacao")).toBe("required");
    expect(catalogCardRequirement("tese")).toBe("required");
  });

  it("trata projeto como nao aplicavel", () => {
    expect(catalogCardRequirement("projeto_pesquisa")).toBe("not_applicable");
    expect(catalogCardStatus("projeto_pesquisa", "").message).toContain("nao aplicavel");
  });

  it("rejeita texto padrao como conteudo valido", () => {
    expect(hasCatalogCardContent("Inserir aqui a ficha catalografica oficial gerada pela Biblioteca")).toBe(false);
  });

  it("bloqueia trabalho final sem conteudo", () => {
    expect(catalogCardStatus("dissertacao", "").blocking).toBe(true);
  });

  it("aceita conteudo preenchido", () => {
    const content = "Dados oficiais de catalogacao na publicacao gerados pela Biblioteca Universitaria da UFLA com autoria titulo e descritores.";
    expect(catalogCardStatus("dissertacao", content).blocking).toBe(false);
    expect(catalogCardStatus("dissertacao", content).hasContent).toBe(true);
  });
});

describe("ficha catalografica: numero de Cutter", () => {
  it("detecta numero de Cutter-Sanborn padrao (letra + digito da tabela + letra do titulo)", () => {
    expect(hasCutterNumber("S586f")).toBe(true);
    expect(hasCutterNumber("Ficha catalografica elaborada pela Biblioteca Universitaria da UFLA. S586f Silva, M. A.")).toBe(true);
    expect(hasCutterNumber("M1234")).toBe(true);
  });

  it("aceita classificacao CDU como alternativa ao Cutter", () => {
    expect(hasCutterNumber("CDU 630.11:582.632.2")).toBe(true);
    expect(hasCutterNumber("630.11:582.632.2")).toBe(true);
  });

  it("rejeita texto sem codigo de classificacao", () => {
    expect(hasCutterNumber("Dados oficiais de catalogacao na publicacao")).toBe(false);
    expect(hasCutterNumber("Inserir aqui a ficha catalografica oficial")).toBe(false);
    expect(hasCutterNumber("")).toBe(false);
  });

  it("status alerta conteudo sem Cutter mas nao bloqueia", () => {
    const status = catalogCardStatus("dissertacao", "Dados oficiais de catalogacao na publicacao com autoria titulo e descritores.");
    expect(status.hasContent).toBe(true);
    expect(status.cutterDetected).toBe(false);
    expect(status.blocking).toBe(false);
    expect(status.message).toContain("Cutter");
  });

  it("status confirma Cutter detectado em ficha completa", () => {
    const content = "Ficha catalografica elaborada pela Biblioteca Universitaria da UFLA. S586f Silva, M. A. Titulo do trabalho. Lavras: UFLA, 2024.";
    const status = catalogCardStatus("dissertacao", content);
    expect(status.hasContent).toBe(true);
    expect(status.cutterDetected).toBe(true);
    expect(status.blocking).toBe(false);
    expect(status.message).toContain("Cutter detectado");
  });
});
