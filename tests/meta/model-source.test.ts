import { describe, expect, it } from "vitest";
import { ruleSourceForWorkType } from "../../src/model-rule-source";

describe("model source", () => {
  it("maps congress models", () => {
    expect(ruleSourceForWorkType("resumo_cpg").primary).toContain("Congresso");
    expect(ruleSourceForWorkType("resumo_expandido_cpg").fallback).toContain("ABNT");
    expect(ruleSourceForWorkType("artigo_completo_cpg").fallback).toContain("ABNT");
  });

  it("maps final academic works", () => {
    expect(ruleSourceForWorkType("monografia").primary).toContain("Manual");
    expect(ruleSourceForWorkType("dissertacao").fallback).toContain("ABNT");
    expect(ruleSourceForWorkType("tese").fallback).toContain("ABNT");
  });

  it("maps research project", () => {
    expect(ruleSourceForWorkType("projeto_pesquisa").primary).toContain("15287");
  });
});
