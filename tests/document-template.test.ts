import { describe, expect, it } from "vitest";
import { templateForWorkType } from "../src/document-template";

describe("document-template", () => {
  it("usa template de artigo para artigo", () => {
    expect(templateForWorkType("artigo").id).toBe("artigo");
  });

  it("usa template de projeto para projeto_pesquisa", () => {
    expect(templateForWorkType("projeto_pesquisa").id).toBe("projeto-pesquisa");
  });

  it("usa template CPG quando aplicavel", () => {
    expect(templateForWorkType("resumo_cpg").id).toBe("cpg");
    expect(templateForWorkType("resumo_expandido_cpg").id).toBe("cpg");
    expect(templateForWorkType("artigo_completo_cpg").id).toBe("cpg");
  });

  it("usa template geral por padrao", () => {
    expect(templateForWorkType("").id).toBe("geral");
    expect(templateForWorkType("tipo_desconhecido").id).toBe("geral");
  });

  it("usa template de artigo para artigo_cientifico_ufla e artigo simples", () => {
    expect(templateForWorkType("artigo_cientifico_ufla").id).toBe("artigo");
    expect(templateForWorkType("artigo").id).toBe("artigo");
  });

  it("usa template de rascunho longo para monografia, dissertacao e tese", () => {
    expect(templateForWorkType("monografia").id).toBe("rascunho-longo-editavel");
    expect(templateForWorkType("dissertacao").id).toBe("rascunho-longo-editavel");
    expect(templateForWorkType("tese").id).toBe("rascunho-longo-editavel");
  });
});
