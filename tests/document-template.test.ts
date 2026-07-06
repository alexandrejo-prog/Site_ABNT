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
    expect(templateForWorkType("monografia").id).toBe("geral");
    expect(templateForWorkType("tipo_desconhecido").id).toBe("geral");
  });
});
