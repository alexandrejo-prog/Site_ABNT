import { describe, expect, it } from "vitest";
import { catalogCardRequirement, catalogCardStatus, hasCatalogCardContent } from "../src/catalog-card";

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
