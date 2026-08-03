import { describe, expect, it } from "vitest";
import { DEMO_EXAMPLE, demoFieldsWithWorkType, demoConfidenceMap } from "../src/demo-example";

describe("exemplo demonstrativo (PROD-02)", () => {
  it("fornece tipo, autor e título prontos", () => {
    expect(DEMO_EXAMPLE.workType).toBe("dissertacao");
    expect(DEMO_EXAMPLE.fields.author).toBeTruthy();
    expect(DEMO_EXAMPLE.fields.title).toBeTruthy();
  });

  it("fornece texto do corpo com títulos de seção", () => {
    expect(DEMO_EXAMPLE.editorText).toContain("# 2");
    expect(DEMO_EXAMPLE.editorText.split("\n").filter((l) => /^#/.test(l)).length).toBeGreaterThanOrEqual(4);
  });

  it("inclui referências em formato ABNT aproximado", () => {
    expect(DEMO_EXAMPLE.fields.referencias ?? "").toMatch(/EMBRAPA\./);
    expect(DEMO_EXAMPLE.fields.referencias ?? "").toMatch(/Lavras:/);
  });

  it("produz campos completos ao aplicar o tipo", () => {
    const fields = demoFieldsWithWorkType();
    expect(fields.workType).toBe("dissertacao");
    expect(fields.author).toBe(DEMO_EXAMPLE.fields.author);
  });

  it("produz mapa de confiança para os campos principais", () => {
    const conf = demoConfidenceMap();
    expect(conf.author).toBe("alta");
    expect(conf.resumo).toBe("alta");
  });
});